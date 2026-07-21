import { _decorator, Component } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_LEVEL_SOLVED,
    LevelSolvedEvent,
    EVT_COINS_CHANGED,
    CoinsChangedEvent,
    EVT_REWARD_SEQUENCE_DONE,
    RewardSequenceDoneEvent,
} from '../event-bus/events';
import { GameStateSystem } from './GameStateSystem';

const { ccclass, property } = _decorator;

// Начисление наград (AGENTS.md §3/§4, ARCHITECTURE.md §2). isFinal=true только для level 2 — это то,
// что GameStateSystem использует, чтобы отличить «следующий уровень» от «пора показывать CTA».
@ccclass('RewardSystem')
export class RewardSystem extends Component {
    @property(GameConfig)
    private config: GameConfig | null = null;

    private readonly _onLevelSolved = this.onLevelSolved.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelSolvedEvent>(EVT_LEVEL_SOLVED, this._onLevelSolved);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelSolvedEvent>(EVT_LEVEL_SOLVED, this._onLevelSolved);
    }

    private onLevelSolved(event: LevelSolvedEvent): void {
        const model = GameStateSystem.model;
        // Guard на GameStateModel — награда начисляется не более одного раза на уровень.
        if (!model.tryGrantReward(event.level)) {
            return;
        }
        if (!this.config) {
            return;
        }
        const reward = event.level === 1 ? this.config.level1Reward : this.config.level2Reward;
        const total = model.addCoins(reward);
        const isFinal = event.level === 2;
        // Публикуем сразу — View запускает fly-in монет не дожидаясь ничего дополнительного.
        GlobalEventBus.publish<CoinsChangedEvent>(EVT_COINS_CHANGED, { total, delta: reward, isFinal });
        // Фикс Фазы 0: следующий уровень/CTA не должны стартовать раньше, чем визуально долетят монеты —
        // ждём coinFlyDuration через scheduleOnce (не raw setTimeout) и только тогда сигналим о завершении.
        this.scheduleOnce(() => {
            GlobalEventBus.publish<RewardSequenceDoneEvent>(EVT_REWARD_SEQUENCE_DONE, { level: event.level, isFinal });
        }, this.config.coinFlyDuration);
    }
}
