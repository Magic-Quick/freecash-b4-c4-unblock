import { _decorator, Component } from 'cc';
import { GameStateModel } from '../Models/GameStateModel';
import { GamePhase } from '../Models/GamePhase';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_REWARD_SEQUENCE_DONE,
    RewardSequenceDoneEvent,
    EVT_PHASE_CHANGED,
    PhaseChangedEvent,
    EVT_LEVEL_STARTED,
    LevelStartedEvent,
    EVT_REQUEST_CTA,
    RequestCtaEvent,
} from '../event-bus/events';

const { ccclass } = _decorator;

// Держит единственный экземпляр GameStateModel на сессию (ARCHITECTURE.md §2) и раздаёт его другим
// системам через статический аксессор — System-компоненты не связаны @property-ссылками друг с другом
// (ARCHITECTURE.md §5 перечисляет только ссылки System→View), а GameStateModel — общий plain-контракт.
@ccclass('GameStateSystem')
export class GameStateSystem extends Component {
    private static readonly _model: GameStateModel = new GameStateModel();

    public static get model(): GameStateModel {
        return GameStateSystem._model;
    }

    private readonly _onRewardSequenceDone = this.onRewardSequenceDone.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<RewardSequenceDoneEvent>(EVT_REWARD_SEQUENCE_DONE, this._onRewardSequenceDone);
    }

    protected start(): void {
        // Единственный источник самого первого EVT_LEVEL_STARTED за сессию (IMPLEMENTATION_PHASES §Фаза 2 п.4).
        // К моменту start() у всех компонентов сцены уже отработал onLoad, так что подписчики (BoardSystem,
        // TutorialSystem, ...) гарантированно готовы принять событие.
        const model = GameStateSystem._model;
        model.phase = GamePhase.LEVEL_PLAY;
        GlobalEventBus.publish<PhaseChangedEvent>(EVT_PHASE_CHANGED, { phase: model.phase });
        GlobalEventBus.publish<LevelStartedEvent>(EVT_LEVEL_STARTED, { level: model.currentLevel });
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<RewardSequenceDoneEvent>(EVT_REWARD_SEQUENCE_DONE, this._onRewardSequenceDone);
    }

    private onRewardSequenceDone(event: RewardSequenceDoneEvent): void {
        const model = GameStateSystem._model;
        console.error('[DEBUG GameStateSystem] onRewardSequenceDone', { level: event.level, isFinal: event.isFinal });
        if (!event.isFinal) {
            // L1 полностью долетел (монеты + FX) — переходим на L2 (AGENTS.md §4, Фаза 0 handoff).
            model.currentLevel = 2;
            model.phase = GamePhase.LEVEL_PLAY;
            GlobalEventBus.publish<PhaseChangedEvent>(EVT_PHASE_CHANGED, { phase: model.phase });
            GlobalEventBus.publish<LevelStartedEvent>(EVT_LEVEL_STARTED, { level: 2 });
            return;
        }
        // L2 завершён — единственный переход в CTA за сессию.
        if (!model.tryRequestCta()) {
            console.error('[DEBUG GameStateSystem] tryRequestCta REJECTED (already requested this session)');
            return;
        }
        model.phase = GamePhase.CTA;
        GlobalEventBus.publish<PhaseChangedEvent>(EVT_PHASE_CHANGED, { phase: model.phase });
        console.error('[DEBUG GameStateSystem] publish EVT_REQUEST_CTA', { totalFc: model.totalCoins });
        GlobalEventBus.publish<RequestCtaEvent>(EVT_REQUEST_CTA, { totalFc: model.totalCoins });
    }
}
