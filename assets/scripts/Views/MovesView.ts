import { _decorator, Component, Label } from 'cc';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_MOVES_CHANGED, MovesChangedEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// MovesPanel (DESIGN_UPDATE_PLAN.md §5 Шаг 4.5, SCENE_SETUP.md): движок счётчика ходов —
// movesLabel живой, обновляется на каждый EVT_MOVES_CHANGED (BoardSystem публикует его на ход/undo/
// restart, включая сброс к 0 при EVT_LEVEL_STARTED — отдельная подписка здесь не нужна).
// Строка «Record: 52» — статичный декор (§8.5 плана, решение 0.11 — «команда просила не менять») и
// целиком живёт в сцене одной надписью RecordTitleLabel: она никогда не пересчитывается, поэтому и
// ссылка на неё, и @property config (нужный только ради GameConfig.movesRecord) здесь были мёртвым
// кодом — убраны вместе с самим GameConfig.movesRecord.
@ccclass('MovesView')
export class MovesView extends Component {
    @property(Label)
    public movesLabel: Label | null = null;

    private readonly _onMovesChanged = this.onMovesChanged.bind(this);

    protected onLoad(): void {
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
