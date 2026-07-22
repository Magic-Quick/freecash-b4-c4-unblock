import { _decorator, Component, Label, Sprite, SpriteFrame } from 'cc';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_LEVEL_STARTED, LevelStartedEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// Декоративные LEVEL/MOVES панели (ARCHITECTURE.md §3). MOVES — статический декор без функционального
// счётчика (нет fail-state, OPEN_ISSUES.md #6). Звёзды показывают номер уровня (level N → N звёзд
// включено) — тоже декор, не рейтинг результата игрока.
@ccclass('HudView')
export class HudView extends Component {
    @property(Label)
    public levelNumberLabel: Label | null = null;

    @property(Sprite)
    public starSprites: Sprite[] = [];

    @property(SpriteFrame)
    public starOnFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public starOffFrame: SpriteFrame | null = null;

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
        this.starSprites.forEach((sprite, index) => {
            sprite.spriteFrame = index < event.level ? this.starOnFrame : this.starOffFrame;
        });
    }
}
