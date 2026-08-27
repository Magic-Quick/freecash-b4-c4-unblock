import { _decorator, Component, Node, Tween, tween, Vec3, EventTouch, UITransform, Sprite, SpriteFrame } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { BlockModel } from '../Models/BlockModel';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    GridCell,
    EVT_SWIPE,
    SwipeEvent,
    EVT_MAIN_REACHED_EXIT,
    MainReachedExitEvent,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Визуал и ввод одного блока (ARCHITECTURE.md §3). View НЕ решает валидность хода/коллизии — только
// репортит жест (EVT_SWIPE) и реагирует на то, что уже решил BoardSystem (slideTo/playBlocked).
@ccclass('BlockView')
export class BlockView extends Component {
    @property(GameConfig)
    public config: GameConfig | null = null;

    // Одна и та же нода/prefab обслуживает и препятствие, и главный блок (ARCHITECTURE.md §3,
    // IMPLEMENTATION_PHASES.md Фаза 4) — вид выбирается здесь по BlockModel.isMain, а не отдельными
    // заранее разложенными в сцене блоками.
    @property(Sprite)
    public sprite: Sprite | null = null;

    // 4 запечённых кадра — длина × роль (DESIGN_UPDATE_PLAN.md §3, §4.1, §5 Шаг 4.1). Цвет уже в PNG,
    // Sprite.color остаётся свободен под FX.
    @property(SpriteFrame)
    public len2ObstFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public len2MainFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public len3ObstFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public len3MainFrame: SpriteFrame | null = null;

    private blockModel: BlockModel | null = null;
    // Шаг сетки по X/Y (GameConfig.colPitch/rowPitch — ячейка не квадратная, DESIGN_UPDATE_PLAN.md §2),
    // переданный из BoardView.buildLevel() — держит BlockView в той же системе координат, что и BoardView.
    private colPitch = 0;
    private rowPitch = 0;
    private level = 1;
    // Смещение центра блока (в ячейках) вдоль его оси относительно "базовой" (col,row) ячейки —
    // считается один раз в setup(), т.к. length/axis блока не меняются в течение уровня.
    private axisCenterOffset = 0;
    // Сдвиг от локального (0,0) контейнера (= центр платы) к левому-верхнему углу внутреннего поля —
    // тот же расчёт, что и в BoardView.buildLevel()/TutorialFingerView.showHint(), чтобы все три View
    // рисовали ячейки в одном и том же месте. Без него ячейка (0,0) рисуется в (0,0) контейнера, а не
    // в углу поля — вся сетка уезжает в правый нижний квадрант относительно центрированного BoardFrame.
    private gridOffsetX = 0;
    private gridOffsetY = 0;

    private activeTween: Tween<Node> | null = null;
    private touchStartPos: { x: number; y: number } | null = null;

    private readonly _onTouchStart = this.onTouchStart.bind(this);
    private readonly _onTouchEnd = this.onTouchEnd.bind(this);

    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
        this.stopActiveTween();
    }

    public setup(blockModel: BlockModel, colPitch: number, rowPitch: number, level: number): void {
        this.blockModel = blockModel;
        this.colPitch = colPitch;
        this.rowPitch = rowPitch;
        this.level = level;
        this.axisCenterOffset = (blockModel.length - 1) / 2;
        this.gridOffsetX = this.config?.gridOriginX ?? 0;
        this.gridOffsetY = this.config?.gridOriginY ?? 0;
        this.applyPosition({ col: blockModel.col, row: blockModel.row });
        if (this.sprite) {
            // Sprite.type=SIMPLE, а не SLICED: арт запечён под целевую длину, растягивать по border'ам
            // не нужно (DESIGN_UPDATE_PLAN.md §3/§5 Шаг 4.1 — закрывает бывшую 9-slice-политику).
            this.sprite.type = Sprite.Type.SIMPLE;
            this.sprite.spriteFrame = this.pickSpriteFrame(blockModel);
        }
        // Художник нарисовал только вертикальный арт (решение 0.3, §4.1): горизонтальные блоки — тот
        // же кадр, повёрнутый на 90°. Размер задаём в "довращательных" терминах — ширина/высота
        // поменяны местами для horizontal, — чтобы ПОСЛЕ поворота на экране получилось ровно
        // length*pitch вдоль оси блока и pitch поперёк неё (DESIGN_UPDATE_PLAN.md §5 Шаг 4.1).
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            const along = blockModel.axis === 'horizontal' ? blockModel.length * colPitch : blockModel.length * rowPitch;
            const across = blockModel.axis === 'horizontal' ? rowPitch : colPitch;
            uiTransform.setContentSize(across, along);
        }
        this.node.angle = blockModel.axis === 'horizontal' ? -90 : 0;
    }

    private pickSpriteFrame(blockModel: BlockModel): SpriteFrame | null {
        if (blockModel.length >= 3) {
            return blockModel.isMain ? this.len3MainFrame : this.len3ObstFrame;
        }
        return blockModel.isMain ? this.len2MainFrame : this.len2ObstFrame;
    }

    private cellToLocal(cell: GridCell): Vec3 {
        const model = this.blockModel;
        if (!model) {
            return new Vec3();
        }
        if (model.axis === 'horizontal') {
            const x = (cell.col + this.axisCenterOffset + 0.5) * this.colPitch + this.gridOffsetX;
            const y = -(cell.row + 0.5) * this.rowPitch + this.gridOffsetY;
            return new Vec3(x, y, 0);
        }
        const x = (cell.col + 0.5) * this.colPitch + this.gridOffsetX;
        const y = -(cell.row + this.axisCenterOffset + 0.5) * this.rowPitch + this.gridOffsetY;
        return new Vec3(x, y, 0);
    }

    private applyPosition(cell: GridCell): void {
        this.node.setPosition(this.cellToLocal(cell));
    }

    // Твин слайда: отменяет любой предыдущий tween этого блока перед стартом нового — при быстрых
    // повторных ходах или смене уровня нельзя оставлять "хвост" анимации на переиспользуемой ноде.
    public slideTo(cell: GridCell): void {
        this.stopActiveTween();
        const duration = this.config?.blockSlideDuration ?? 0.18;
        const target = this.cellToLocal(cell);
        this.activeTween = tween(this.node)
            .to(duration, { position: target })
            .call(() => {
                this.activeTween = null;
            })
            .start();
    }

    // Короткий шейк без мутации состояния — блок остаётся там же, только сигнализирует "ход невозможен".
    public playBlocked(): void {
        this.stopActiveTween();
        const base = this.node.position.clone();
        const bump = 8;
        this.activeTween = tween(this.node)
            .to(0.04, { position: new Vec3(base.x + bump, base.y, base.z) })
            .to(0.08, { position: new Vec3(base.x - bump, base.y, base.z) })
            .to(0.04, { position: base })
            .call(() => {
                this.activeTween = null;
            })
            .start();
    }

    // Автопроезд главного блока за правый край поля (ARCHITECTURE.md §3). По завершении твина
    // публикует EVT_MAIN_REACHED_EXIT{level} — единственный сигнал, которого ждёт DriveSystem, чтобы
    // объявить уровень решённым (DriveSystem сам ничего не таймирует/не симулирует, см. Systems/DriveSystem.ts).
    public driveToExit(): void {
        this.stopActiveTween();
        const duration = this.config?.mainDriveDuration ?? 0.7;
        // Визуальная ширина на экране (после поворота — UITransform.width её больше не отражает,
        // содержимое довращательное, см. setup()): горизонтальный блок растянут на length*colPitch,
        // вертикальный занимает один шаг сетки поперёк оси.
        const model = this.blockModel;
        const visualWidth = model && model.axis === 'horizontal' ? model.length * this.colPitch : this.colPitch;
        // Правый край внутреннего поля платы в локальных координатах контейнера: gridOffsetX — это уже
        // ЛЕВЫЙ край поля (GameConfig.gridOriginX), поэтому правый = левый + полная ширина сетки
        // (DESIGN_UPDATE_PLAN.md §4.1 — дистанция от правого края inner rect, а не захардкоженное число
        // ячеек). Половину ширины сетки здесь брать нельзя: поле на Board_full.png не отцентровано в
        // текстуре платы, и блок останавливался бы, не дойдя до кармана выхода.
        const rightEdgeX = this.gridOffsetX + (this.config?.gridCols ?? 0) * this.colPitch;
        const current = this.node.position;
        const exitDistance = rightEdgeX - current.x + visualWidth;
        const target = new Vec3(current.x + exitDistance, current.y, current.z);
        this.activeTween = tween(this.node)
            .to(duration, { position: target })
            .call(() => {
                this.activeTween = null;
                GlobalEventBus.publish<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, { level: this.level });
            })
            .start();
    }

    private stopActiveTween(): void {
        if (this.activeTween) {
            this.activeTween.stop();
            this.activeTween = null;
        }
    }

    private onTouchStart(event: EventTouch): void {
        const loc = event.getUILocation();
        this.touchStartPos = { x: loc.x, y: loc.y };
    }

    // Тап вместо свайпа: блок жёстко привязан к своей оси, поэтому направление хода не нужно жестировать —
    // тап по одной половине блока (вдоль его оси) предполагает движение в её сторону. View не решает
    // валидность/коллизии (см. класс-комментарий) — это только геометрическая догадка о намерении; если
    // предположенная сторона окажется занята, а противоположная свободна, BoardSystem сам развернёт ход
    // (см. onSwipe в BoardSystem.ts) — событие и его обработка на стороне System не меняются.
    private onTouchEnd(event: EventTouch): void {
        const start = this.touchStartPos;
        this.touchStartPos = null;
        if (!start || !this.blockModel) {
            return;
        }
        const dir = this.resolveTapDirection(start);
        if (!dir) {
            return;
        }
        GlobalEventBus.publish<SwipeEvent>(EVT_SWIPE, { blockId: this.blockModel.id, dir });
    }

    private resolveTapDirection(point: { x: number; y: number }): 'left' | 'right' | 'up' | 'down' | null {
        const model = this.blockModel;
        const uiTransform = this.node.getComponent(UITransform);
        if (!model || !uiTransform) {
            return null;
        }
        const local = uiTransform.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        // node.angle поворачивает horizontal-блоки на -90° (setup()) поверх "довращательного" кадра, где
        // локальная +Y всегда идёт вдоль оси блока (см. setup()/cellToLocal). После такого поворота
        // локальная +Y смотрит в мировое "право" у horizontal и остаётся мировым "верх" у vertical —
        // единственная проверка знака local.y корректна для обеих осей без отдельной ветки на угол.
        if (model.axis === 'horizontal') {
            return local.y > 0 ? 'right' : 'left';
        }
        return local.y > 0 ? 'up' : 'down';
    }
}
