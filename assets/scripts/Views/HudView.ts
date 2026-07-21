import { _decorator, Component, Label } from 'cc';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_LEVEL_STARTED, LevelStartedEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// Декоративные LEVEL/MOVES панели (ARCHITECTURE.md §3). MOVES — статический декор без функционального
// счётчика (нет fail-state, OPEN_ISSUES.md #6), поэтому здесь только обновление номера уровня.
@ccclass('HudView')
export class HudView extends Component {
    @property(Label)
    public levelNumberLabel: Label | null = null;

    private readonly _onLevelStarted = this.onLevelStarted.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
    }

    private onLevelStarted(event: LevelStartedEvent): void {
        if (this.levelNumberLabel) {
            this.levelNumberLabel.string = `${event.level}`;
        }
    }
}
