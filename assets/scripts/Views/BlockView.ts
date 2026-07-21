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

    @property(SpriteFrame)
    public tileFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public mainFrame: SpriteFrame | null = null;

    private blockModel: BlockModel | null = null;
    // "Шаг сетки" (cellSize+cellSpacing одним числом), переданный из BoardView.buildLevel() — держит
    // BlockView в той же системе координат, что и BoardView (см. комментарий там).
    private cellPitch = 0;
    private level = 1;
    // Смещение центра блока (в ячейках) вдоль его оси относительно "базовой" (col,row) ячейки —
    // считается один раз в setup(), т.к. length/axis блока не меняются в течение уровня.
    private axisCenterOffset = 0;
    // Сдвиг, центрирующий сетку на локальном (0,0) контейнера — тот же расчёт, что и в
    // BoardView.buildLevel()/TutorialFingerView.showHint(), чтобы все три View рисовали ячейки в
    // одном и том же месте. Без него ячейка (0,0) рисуется в (0,0) контейнера, а не в его углу —
    // вся сетка уезжает в правый нижний квадрант относительно центрированного BoardFrame.
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

    public setup(blockModel: BlockModel, cellPitch: number, level: number): void {
        this.blockModel = blockModel;
        this.cellPitch = cellPitch;
        this.level = level;
        this.axisCenterOffset = (blockModel.length - 1) / 2;
        this.gridOffsetX = -((this.config?.gridCols ?? 0) * cellPitch) / 2;
        this.gridOffsetY = ((this.config?.gridRows ?? 0) * cellPitch) / 2;
        this.applyPosition({ col: blockModel.col, row: blockModel.row });
        if (this.sprite) {
            this.sprite.spriteFrame = blockModel.isMain ? this.mainFrame : this.tileFrame;
        }
        // Визуальный размер вдоль оси растёт с length (9-slice не искажает углы); поперёк оси блок
        // всегда занимает ровно одну ячейку. spacing вычитается один раз, т.к. cellPitch уже включает
        // зазор после каждой ячейки, а последняя занятая ячейка блока зазора после себя не добавляет.
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            const spacing = this.config?.cellSpacing ?? 0;
            const span = blockModel.length * cellPitch - spacing;
            const cross = cellPitch - spacing;
            uiTransform.setContentSize(
                blockModel.axis === 'horizontal' ? span : cross,
                blockModel.axis === 'horizontal' ? cross : span,
            );
        }
    }

    private cellToLocal(cell: GridCell): Vec3 {
        const model = this.blockModel;
        if (!model) {
            return new Vec3();
        }
        if (model.axis === 'horizontal') {
            const x = (cell.col + this.axisCenterOffset + 0.5) * this.cellPitch + this.gridOffsetX;
            const y = -(cell.row + 0.5) * this.cellPitch + this.gridOffsetY;
            return new Vec3(x, y, 0);
        }
        const x = (cell.col + 0.5) * this.cellPitch + this.gridOffsetX;
        const y = -(cell.row + this.axisCenterOffset + 0.5) * this.cellPitch + this.gridOffsetY;
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
        const uiTransform = this.node.getComponent(UITransform);
        // Проезд за край поля: 6 ячеек вправо с запасом на собственную ширину ноды, чтобы блок
        // полностью скрылся за правым краем видимой области, а не просто доехал до него.
        const exitDistance = this.cellPitch * 6 + (uiTransform?.width ?? this.cellPitch);
        const current = this.node.position;
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

    private onTouchEnd(event: EventTouch): void {
        if (!this.touchStartPos || !this.blockModel) {
            this.touchStartPos = null;
            return;
        }
        const endLoc = event.getUILocation();
        const dx = endLoc.x - this.touchStartPos.x;
        const dy = endLoc.y - this.touchStartPos.y;
        this.touchStartPos = null;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = this.config?.swipeMinDistance ?? 30;
        if (distance < minDistance) {
            return;
        }
        // Нормализация свободного жеста в кардинальное направление: берём ось с наибольшим
        // абсолютным смещением. Cocos UI-координаты — y растёт вверх, поэтому dy>0 значит "up".
        const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'up' : 'down';
        // View не решает валидность хода — просто репортит жест, решение о движении остаётся за BoardSystem.
        GlobalEventBus.publish<SwipeEvent>(EVT_SWIPE, { blockId: this.blockModel.id, dir });
    }
}
