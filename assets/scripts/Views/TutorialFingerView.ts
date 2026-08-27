import { _decorator, Component, Node, tween, Tween, Vec3 } from 'cc';
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
        this.showHint(event.fromCell, event.toCell);
    }

    private onHide(): void {
        this.hide();
    }

    // Петля тапа: палец задерживается у нужной половины блока и делает "нажатие" (пульс масштаба) —
    // ход теперь по тапу, а не по свайпу (BlockView.resolveTapDirection), поэтому подсказка не должна
    // изображать перетаскивание через всё поле, иначе жест введёт игрока в заблуждение.
    public showHint(fromCell: GridCell, toCell: GridCell): void {
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
        // Нужная для хода половина блока — направление from→to, сдвиг на четверть шага сетки от
        // fromCell в его сторону (BlockView.resolveTapDirection делит блок ровно пополам по той же оси).
        const dirVec = new Vec3(to.x - from.x, to.y - from.y, 0).normalize();
        const tapOffset = Math.min(colPitch, rowPitch) * 0.25;
        const tapPoint = new Vec3(from.x + dirVec.x * tapOffset, from.y + dirVec.y * tapOffset, 0);
        this.stopLoop();
        // Вход в кадр вдоль dirVec — палец подъезжает к точке тапа с той стороны, куда двинется блок,
        // так что само движение входа уже показывает направление свайпа, а не произвольный slide-in.
        const entranceDistance = Math.min(colPitch, rowPitch) * 0.8;
        const entryPoint = new Vec3(tapPoint.x - dirVec.x * entranceDistance, tapPoint.y - dirVec.y * entranceDistance, 0);
        this.node.setPosition(entryPoint);
        this.node.setScale(0.6, 0.6, 1);
        const pressScale = 0.82;
        this.entranceTween = tween(this.node)
            .to(0.25, { position: tapPoint, scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
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
