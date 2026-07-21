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
// конвертирует их в локальные пиксели через GameConfig.cellSize/cellSpacing, используя тот же "шаг
// сетки", что и BoardView/BlockView, чтобы указывать ровно на реальные позиции ячеек.
@ccclass('TutorialFingerView')
export class TutorialFingerView extends Component {
    @property(GameConfig)
    public config: GameConfig | null = null;

    private loopTween: Tween<Node> | null = null;

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

    // Петля свайпа: from → to → from, с короткой паузой на концах, пока не придёт EVT_TUTORIAL_HIDE.
    public showHint(fromCell: GridCell, toCell: GridCell): void {
        if (!this.config) {
            return;
        }
        this.node.active = true;
        const pitch = this.config.cellSize + this.config.cellSpacing;
        const from = new Vec3((fromCell.col + 0.5) * pitch, -(fromCell.row + 0.5) * pitch, 0);
        const to = new Vec3((toCell.col + 0.5) * pitch, -(toCell.row + 0.5) * pitch, 0);
        this.node.setPosition(from);
        this.stopLoop();
        this.loopTween = tween(this.node)
            .to(0.5, { position: to })
            .delay(0.15)
            .to(0.5, { position: from })
            .delay(0.15)
            .union()
            .repeatForever()
            .start();
    }

    public hide(): void {
        this.stopLoop();
        this.node.active = false;
    }

    private stopLoop(): void {
        if (this.loopTween) {
            this.loopTween.stop();
            this.loopTween = null;
        }
    }
}
