import { _decorator, Component } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { GameStateModel } from '../Models/GameStateModel';
import { GamePhase } from '../Models/GamePhase';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_LEVEL_SOLVED,
    LevelSolvedEvent,
    EVT_PHASE_CHANGED,
    PhaseChangedEvent,
    EVT_LEVEL_STARTED,
    LevelStartedEvent,
    EVT_REQUEST_CTA,
    RequestCtaEvent,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Держит единственный экземпляр GameStateModel на сессию (ARCHITECTURE.md §2) и раздаёт его другим
// системам через статический аксессор — System-компоненты не связаны @property-ссылками друг с другом
// (ARCHITECTURE.md §5 перечисляет только ссылки System→View), а GameStateModel — общий plain-контракт.
@ccclass('GameStateSystem')
export class GameStateSystem extends Component {
    @property(GameConfig)
    private config: GameConfig | null = null;

    private static readonly _model: GameStateModel = new GameStateModel();

    public static get model(): GameStateModel {
        return GameStateSystem._model;
    }

    private readonly _onLevelSolved = this.onLevelSolved.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelSolvedEvent>(EVT_LEVEL_SOLVED, this._onLevelSolved);
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
        GlobalEventBus.unsubscribe<LevelSolvedEvent>(EVT_LEVEL_SOLVED, this._onLevelSolved);
    }

    // Единственный уровень (DESIGN_UPDATE_PLAN.md §4.2) — решённый уровень ведёт прямо в CTA, ветки
    // "следующий уровень" больше нет. Пауза winFxDuration держит место, где раньше ждали долёт монет.
    private onLevelSolved(): void {
        const model = GameStateSystem._model;
        if (!model.tryRequestCta()) {
            return;
        }
        const delay = this.config?.winFxDuration ?? 0;
        this.scheduleOnce(() => {
            model.phase = GamePhase.CTA;
            GlobalEventBus.publish<PhaseChangedEvent>(EVT_PHASE_CHANGED, { phase: model.phase });
            GlobalEventBus.publish<RequestCtaEvent>(EVT_REQUEST_CTA, {});
        }, delay);
    }
}
