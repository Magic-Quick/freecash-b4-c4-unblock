import { _decorator, Component, Node, tween, Tween, Vec2, Vec3 } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    GridCell,
    EVT_TUTORIAL_SHOW,
    TutorialShowEvent,
    EVT_TUTORIAL_HIDE,
    TutorialHideEvent,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Палец-подсказка (ARCHITECTURE.md §3). Позиции приходят как ячейки сетки в payload события —
// конвертирует их в локальные пиксели через GameConfig.colPitch/rowPitch, используя тот же "шаг
// сетки", что и BoardView/BlockView, чтобы указывать ровно на реальные позиции ячеек.
@ccclass('TutorialFingerView')
export class TutorialFingerView extends Component {
    @property(GameConfig)
    public config: GameConfig | null = null;

    // Ручная поправка финальной точки тапа поверх расчётной (design-units, локальные оси ноды) — для
    // точечной правки конкретного уровня/блока без изменения формулы центра (например, если кончик
    // пальца на art не совпадает с пиксельным центром спрайта). 0,0 — расчётная точка не трогается.
    @property({ tooltip: 'Ручное смещение финальной точки тапа поверх расчётной, design-units' })
    public tapPointOffset: Vec2 = new Vec2(0, 0);

    // Заход в кадр (entrance) и петля тапа (pulse) — разные твины: entrance завершается один раз и
    // передаёт эстафету pulse через .call(), stopLoop() гасит оба разом, каким бы ни застали hide().
    private entranceTween: Tween<Node> | null = null;
    private pulseTween: Tween<Node> | null = null;

    private readonly _onShow = this.onShow.bind(this);
    private readonly _onHide = this.onHide.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<TutorialShowEvent>(EVT_TUTORIAL_SHOW, this._onShow);
        GlobalEventBus.subscribe<TutorialHideEvent>(EVT_TUTORIAL_HIDE, this._onHide);
        this.node.active = false;
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<TutorialShowEvent>(EVT_TUTORIAL_SHOW, this._onShow);
        GlobalEventBus.unsubscribe<TutorialHideEvent>(EVT_TUTORIAL_HIDE, this._onHide);
        this.stopLoop();
    }

    private onShow(event: TutorialShowEvent): void {
        this.showHint(event.fromCell, event.toCell, event.blockLength);
    }

    private onHide(): void {
        this.hide();
    }

    // Точка тапа — геометрический центр самого блока (BlockView.cellToLocal), а не центр одной лишь
    // ячейки fromCell: для блоков length>1 (levels.json — есть length 2/3) это разные точки, и палец,
    // указывающий на центр якорной ячейки, стоял бы заметно мимо визуального центра длинных блоков.
    public showHint(fromCell: GridCell, toCell: GridCell, blockLength: number): void {
        if (!this.config) {
            return;
        }
        this.node.active = true;
        const colPitch = this.config.colPitch;
        const rowPitch = this.config.rowPitch;
        // Тот же сдвиг к углу внутреннего поля, что в BoardView.buildLevel()/BlockView.cellToLocal() —
        // палец должен указывать на реальную позицию ячейки, а не на смещённую (см. комментарий там).
        // Работает только потому, что нода Finger живёт в системе координат центра платы: TutorialLayer
        // стоит в той же точке сцены, что BoardFrame/BlocksContainer (см. SCENE_SETUP.md).
        const offsetX = this.config.gridOriginX;
        const offsetY = this.config.gridOriginY;
        const from = new Vec3((fromCell.col + 0.5) * colPitch + offsetX, -(fromCell.row + 0.5) * rowPitch + offsetY, 0);
        const to = new Vec3((toCell.col + 0.5) * colPitch + offsetX, -(toCell.row + 0.5) * rowPitch + offsetY, 0);
        // Направление хода — только для оси захода в кадр ниже; сама точка тапа теперь не зависит от
        // направления (раньше сдвигалась на четверть клетки в сторону хода, имитируя нужную половину
        // блока под BlockView.resolveTapDirection — по ТЗ переставлено на геометрический центр).
        const dirVec = new Vec3(to.x - from.x, to.y - from.y, 0).normalize();
        // Блок растёт от анкорной (fromCell.col,row) ячейки вдоль своей оси (BlockModel: col+i для
        // horizontal, row+i для vertical) — тот же axisCenterOffset, что и BlockView.setup()/cellToLocal().
        const isHorizontal = fromCell.row === toCell.row;
        const axisCenterOffset = (blockLength - 1) / 2;
        const tapPoint = isHorizontal
            ? new Vec3((fromCell.col + axisCenterOffset + 0.5) * colPitch + offsetX, from.y, 0)
            : new Vec3(from.x, -(fromCell.row + axisCenterOffset + 0.5) * rowPitch + offsetY, 0);
        tapPoint.x += this.tapPointOffset.x;
        tapPoint.y += this.tapPointOffset.y;
        this.stopLoop();
        // Вход в кадр вдоль dirVec — палец подъезжает к точке тапа с той стороны, куда двинется блок,
        // так что само движение входа уже показывает направление свайпа, а не произвольный slide-in.
        // Дистанция — доля габарита платы вдоль оси хода (GameConfig.boardDesignSize), а не доля шага
        // сетки: клетка (~90 design-units) давала едва заметный «подскок» на 0.25с, старт читался как
        // мгновенное появление рядом с точкой тапа, а не заход из-за пределов поля.
        const axisExtent = dirVec.x !== 0 ? this.config.boardDesignSize.width : this.config.boardDesignSize.height;
        const entranceDistance = axisExtent * 0.75;
        const entryPoint = new Vec3(tapPoint.x - dirVec.x * entranceDistance, tapPoint.y - dirVec.y * entranceDistance, 0);
        this.node.setPosition(entryPoint);
        this.node.setScale(0.6, 0.6, 1);
        const pressScale = 0.82;
        this.entranceTween = tween(this.node)
            .to(0.75, { position: tapPoint, scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .call(() => {
                this.pulseTween = tween(this.node)
                    .to(0.15, { scale: new Vec3(pressScale, pressScale, 1) })
                    .to(0.15, { scale: new Vec3(1, 1, 1) })
                    .delay(0.4)
                    .union()
                    .repeatForever()
                    .start();
            })
            .start();
    }

    public hide(): void {
        this.stopLoop();
        this.node.active = false;
    }

    private stopLoop(): void {
        if (this.entranceTween) {
            this.entranceTween.stop();
            this.entranceTween = null;
        }
        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }
    }
}
