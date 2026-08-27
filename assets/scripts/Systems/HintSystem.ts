import { _decorator, Component } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { BoardSolver } from '../Models/BoardSolver';
import { BoardSystem } from './BoardSystem';
import { GameStateSystem } from './GameStateSystem';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_LEVEL_STARTED,
    LevelStartedEvent,
    EVT_HINT_REQUEST,
    HintRequestEvent,
    EVT_TUTORIAL_SHOW,
    TutorialShowEvent,
    EVT_HINTS_CHANGED,
    HintsChangedEvent,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Счётчик подсказок (DESIGN_UPDATE_PLAN.md §5 Шаг 3.3): на EVT_HINT_REQUEST спрашивает BoardSolver
// о ходе из ТЕКУЩЕГО снапшота поля (BoardSystem.getSnapshot()), а не из состояния на старте уровня —
// поэтому подсказка остаётся корректной после любого числа undo/restart.
@ccclass('HintSystem')
export class HintSystem extends Component {
    @property(GameConfig)
    private config: GameConfig | null = null;

    // Инициализируется из config.hintCount ровно один раз, на самый первый EVT_LEVEL_STARTED за сессию.
    // Открытый вопрос §6.F (сбрасывать ли счётчик подсказок при рестарте) владельцем ещё не отвечен;
    // план приводит свой рекомендованный дефолт (§8.2 п.6) — НЕ сбрасывать, иначе рестарт даёт
    // бесконечные подсказки. Поэтому повторные EVT_LEVEL_STARTED от рестарта (BoardSystem.onRestartRequest)
    // счётчик не трогают — pending owner confirmation.
    private hintsRemaining = 0;
    private initialized = false;

    private readonly _onLevelStarted = this.onLevelStarted.bind(this);
    private readonly _onHintRequest = this.onHintRequest.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.subscribe<HintRequestEvent>(EVT_HINT_REQUEST, this._onHintRequest);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.unsubscribe<HintRequestEvent>(EVT_HINT_REQUEST, this._onHintRequest);
    }

    private onLevelStarted(): void {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.hintsRemaining = this.config?.hintCount ?? 0;
        GlobalEventBus.publish<HintsChangedEvent>(EVT_HINTS_CHANGED, { hints: this.hintsRemaining });
    }

    // Единая точка гейта canAcceptInput() (DESIGN_UPDATE_PLAN.md §8.2 п.1) — тот же choke point, что
    // у EVT_SWIPE/EVT_UNDO_REQUEST/EVT_RESTART_REQUEST; во время автопроезда запрос молча игнорируется,
    // кнопка гасится отдельно на стороне BottomBarView (§8.2 п.2, вне зоны этого файла).
    private onHintRequest(): void {
        if (!GameStateSystem.model.canAcceptInput()) {
            return;
        }
        if (this.hintsRemaining <= 0) {
            return;
        }
        const snapshot = BoardSystem.getSnapshot();
        if (!snapshot) {
            return;
        }
        // Спрашивается заново из ТЕКУЩЕГО снапшота на каждый запрос (не кэшируется при старте уровня) —
        // семантика ходов «до упора», идентичная BoardSystem (§1.2).
        const move = BoardSolver.solve(snapshot);
        // Коридор главного блока уже свободен — хода не требуется, подсказку не расходуем (Шаг 3.3).
        if (!move) {
            return;
        }
        this.hintsRemaining -= 1;
        // Тот же визуал, что и автоподсказка перед первым ходом (TutorialSystem/TutorialFingerView) —
        // палец на fromCell→toCell хода, а не отдельный неотрисовываемый EVT_HINT_SHOW (blockId/dir
        // без позиций никто не слушал, кнопка молча тратила подсказку без визуального отклика).
        const movedBlock = snapshot.blocks.find((block) => block.id === move.blockId);
        GlobalEventBus.publish<TutorialShowEvent>(EVT_TUTORIAL_SHOW, {
            fromCell: move.fromCell,
            toCell: move.toCell,
            blockLength: movedBlock?.length ?? 1,
        });
        GlobalEventBus.publish<HintsChangedEvent>(EVT_HINTS_CHANGED, { hints: this.hintsRemaining });
    }
}
