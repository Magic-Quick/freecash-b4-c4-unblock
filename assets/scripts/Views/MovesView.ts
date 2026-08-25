import { _decorator, Component, Label } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_MOVES_CHANGED, MovesChangedEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// MovesPanel (DESIGN_UPDATE_PLAN.md §5 Шаг 4.5, SCENE_SETUP.md): движок счётчика ходов —
// movesLabel живой, обновляется на каждый EVT_MOVES_CHANGED (BoardSystem публикует его на ход/undo/
// restart, включая сброс к 0 при EVT_LEVEL_STARTED — отдельная подписка здесь не нужна). recordLabel —
// статичный декор со значением из макета (§8.5 плана, решение 0.11 — «команда просила не менять»):
// пишется один раз из config.movesRecord, чтобы число «52» жило только в GameConfig, а не дублировалось
// литералом ещё и здесь, и никогда не пересчитывается.
@ccclass('MovesView')
export class MovesView extends Component {
    @property(GameConfig)
    public config: GameConfig | null = null;

    @property(Label)
    public movesLabel: Label | null = null;

    @property(Label)
    public recordLabel: Label | null = null;

    private readonly _onMovesChanged = this.onMovesChanged.bind(this);

    protected onLoad(): void {
        if (this.recordLabel && this.config) {
            this.recordLabel.string = String(this.config.movesRecord);
        }
        GlobalEventBus.subscribe<MovesChangedEvent>(EVT_MOVES_CHANGED, this._onMovesChanged);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<MovesChangedEvent>(EVT_MOVES_CHANGED, this._onMovesChanged);
    }

    private onMovesChanged(event: MovesChangedEvent): void {
        if (this.movesLabel) {
            this.movesLabel.string = String(event.moves);
        }
    }
}
