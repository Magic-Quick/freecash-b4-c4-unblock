import { _decorator, Component, Button, Label } from 'cc';
import { GamePhase } from '../Models/GamePhase';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_RESTART_REQUEST,
    RestartRequestEvent,
    EVT_UNDO_REQUEST,
    UndoRequestEvent,
    EVT_HINT_REQUEST,
    HintRequestEvent,
    EVT_MOVES_CHANGED,
    MovesChangedEvent,
    EVT_HINTS_CHANGED,
    HintsChangedEvent,
    EVT_PHASE_CHANGED,
    PhaseChangedEvent,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// BottomBar (DESIGN_UPDATE_PLAN.md §5 Шаг 4.6, SCENE_SETUP.md): Restart/Undo/Hint публикуют свои
// EVT_*_REQUEST и проходят один и тот же гейт canAcceptInput() на стороне System (§8.2 п.1) — здесь
// дублируем это же условие через EVT_PHASE_CHANGED, чтобы кнопки визуально гасли, а не просто молча
// игнорировали клик во время автопроезда (§8.2 п.2: "гасить кнопки, а не только игнорировать нажатия").
// PauseButton в баре четвёртый по счёту, но остаётся чистым декором без обработчика — открытый вопрос
// владельца B (§6 плана) о нужности паузы ещё не отвечен, и план сознательно не даёт по нему дефолта
// (в отличие от вопроса F), поэтому функция не изобретается здесь (см. OPEN_ISSUES.md #10, решение 0.9).
@ccclass('BottomBarView')
export class BottomBarView extends Component {
    @property(Button)
    public restartButton: Button | null = null;

    @property(Button)
    public undoButton: Button | null = null;

    @property(Button)
    public hintButton: Button | null = null;

    @property(Label)
    public hintBadgeLabel: Label | null = null;

    @property(Button)
    public pauseButton: Button | null = null;

    private canAcceptInput = false;
    // Инвариант BoardSystem: moveHistory.length === GameStateModel.moves (push+increment и pop+decrement
    // всегда идут парой, restart обнуляет оба разом) — поэтому "история пуста" читаем из EVT_MOVES_CHANGED,
    // не заводя отдельное событие только под доступность кнопки undo.
    private hasMoves = false;
    private hintsRemaining = 0;

    private readonly _onRestartClicked = this.onRestartClicked.bind(this);
    private readonly _onUndoClicked = this.onUndoClicked.bind(this);
    private readonly _onHintClicked = this.onHintClicked.bind(this);
    private readonly _onMovesChanged = this.onMovesChanged.bind(this);
    private readonly _onHintsChanged = this.onHintsChanged.bind(this);
    private readonly _onPhaseChanged = this.onPhaseChanged.bind(this);

    protected onLoad(): void {
        this.restartButton?.node.on(Button.EventType.CLICK, this._onRestartClicked, this);
        this.undoButton?.node.on(Button.EventType.CLICK, this._onUndoClicked, this);
        this.hintButton?.node.on(Button.EventType.CLICK, this._onHintClicked, this);
        GlobalEventBus.subscribe<MovesChangedEvent>(EVT_MOVES_CHANGED, this._onMovesChanged);
        GlobalEventBus.subscribe<HintsChangedEvent>(EVT_HINTS_CHANGED, this._onHintsChanged);
        GlobalEventBus.subscribe<PhaseChangedEvent>(EVT_PHASE_CHANGED, this._onPhaseChanged);
        this.refreshInteractable();
    }

    protected onDestroy(): void {
        this.restartButton?.node.off(Button.EventType.CLICK, this._onRestartClicked, this);
        this.undoButton?.node.off(Button.EventType.CLICK, this._onUndoClicked, this);
        this.hintButton?.node.off(Button.EventType.CLICK, this._onHintClicked, this);
        GlobalEventBus.unsubscribe<MovesChangedEvent>(EVT_MOVES_CHANGED, this._onMovesChanged);
        GlobalEventBus.unsubscribe<HintsChangedEvent>(EVT_HINTS_CHANGED, this._onHintsChanged);
        GlobalEventBus.unsubscribe<PhaseChangedEvent>(EVT_PHASE_CHANGED, this._onPhaseChanged);
    }

    private onRestartClicked(): void {
        GlobalEventBus.publish<RestartRequestEvent>(EVT_RESTART_REQUEST, {});
    }

    private onUndoClicked(): void {
        GlobalEventBus.publish<UndoRequestEvent>(EVT_UNDO_REQUEST, {});
    }

    private onHintClicked(): void {
        GlobalEventBus.publish<HintRequestEvent>(EVT_HINT_REQUEST, {});
    }

    private onMovesChanged(event: MovesChangedEvent): void {
        this.hasMoves = event.moves > 0;
        this.refreshInteractable();
    }

    private onHintsChanged(event: HintsChangedEvent): void {
        this.hintsRemaining = event.hints;
        if (this.hintBadgeLabel) {
            this.hintBadgeLabel.string = String(event.hints);
        }
        this.refreshInteractable();
    }

    private onPhaseChanged(event: PhaseChangedEvent): void {
        this.canAcceptInput = event.phase === GamePhase.LEVEL_PLAY;
        this.refreshInteractable();
    }

    // Один пересчёт на любое из трёх событий — Restart гасится только фазой, Undo и Hint дополнительно
    // гасятся своим локальным условием (пустая история / нулевой остаток, ворота Шага 4 плана).
    private refreshInteractable(): void {
        if (this.restartButton) {
            this.restartButton.interactable = this.canAcceptInput;
        }
        if (this.undoButton) {
            this.undoButton.interactable = this.canAcceptInput && this.hasMoves;
        }
        if (this.hintButton) {
            this.hintButton.interactable = this.canAcceptInput && this.hintsRemaining > 0;
        }
    }
}
