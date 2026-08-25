import { GamePhase } from '../Models/GamePhase';

// Все EVT_* — публичный контракт между System/View (ARCHITECTURE.md §4). Новые события — только
// В КОНЕЦ этого файла (AGENTS.md §5), порядок ниже воспроизводит историю добавления, не переставлять.

export interface GridCell {
    col: number;
    row: number;
}

export const EVT_SWIPE = 'EVT_SWIPE';
export interface SwipeEvent {
    blockId: number;
    dir: 'up' | 'down' | 'left' | 'right';
}

export const EVT_BLOCK_MOVED = 'EVT_BLOCK_MOVED';
export interface BlockMovedEvent {
    blockId: number;
    fromCell: GridCell;
    toCell: GridCell;
    hitWall: boolean;
}

export const EVT_BLOCK_BLOCKED = 'EVT_BLOCK_BLOCKED';
export interface BlockBlockedEvent {
    blockId: number;
}

export const EVT_MAIN_PATH_CLEAR = 'EVT_MAIN_PATH_CLEAR';
export interface MainPathClearEvent {}

export const EVT_MAIN_BLOCKED = 'EVT_MAIN_BLOCKED';
export interface MainBlockedEvent {}

export const EVT_MAIN_DRIVE_START = 'EVT_MAIN_DRIVE_START';
export interface MainDriveStartEvent {}

export const EVT_MAIN_REACHED_EXIT = 'EVT_MAIN_REACHED_EXIT';
export interface MainReachedExitEvent {
    level: number;
}

export const EVT_LEVEL_STARTED = 'EVT_LEVEL_STARTED';
export interface LevelStartedEvent {
    level: number;
}

export const EVT_LEVEL_SOLVED = 'EVT_LEVEL_SOLVED';
export interface LevelSolvedEvent {
    level: number;
}

export const EVT_PHASE_CHANGED = 'EVT_PHASE_CHANGED';
export interface PhaseChangedEvent {
    phase: GamePhase;
}

export const EVT_TUTORIAL_SHOW = 'EVT_TUTORIAL_SHOW';
export interface TutorialShowEvent {
    fromCell: GridCell;
    toCell: GridCell;
}

export const EVT_TUTORIAL_HIDE = 'EVT_TUTORIAL_HIDE';
export interface TutorialHideEvent {}

export const EVT_REQUEST_CTA = 'EVT_REQUEST_CTA';
export interface RequestCtaEvent {}

export const EVT_PLAY_SOUND = 'EVT_PLAY_SOUND';
export interface PlaySoundEvent {
    id: string;
}

export const EVT_TAP = 'EVT_TAP';
export interface TapEvent {}

// Добавлено DESIGN_UPDATE_PLAN.md §5 Шаг 3.2/3.6 — нижний бар просит отменить последний ход;
// BoardSystem гейтит запрос через GameStateModel.canAcceptInput() (§8.2 п.1), как и EVT_SWIPE.
export const EVT_UNDO_REQUEST = 'EVT_UNDO_REQUEST';
export interface UndoRequestEvent {}

// Нижний бар просит перезапустить уровень с начала — тот же гейт canAcceptInput(), что и undo.
export const EVT_RESTART_REQUEST = 'EVT_RESTART_REQUEST';
export interface RestartRequestEvent {}

// Отдельное от EVT_BLOCK_MOVED событие для отката хода (DESIGN_UPDATE_PLAN.md §8.2 п.4) — на
// EVT_BLOCK_MOVED подписаны TutorialSystem/SoundSystem/счётчик ходов, откат через него увеличил бы
// счётчик вместо уменьшения. fromCell/toCell зеркалят исходный ход: toCell — куда блок возвращается.
export const EVT_BLOCK_UNDONE = 'EVT_BLOCK_UNDONE';
export interface BlockUndoneEvent {
    blockId: number;
    fromCell: GridCell;
    toCell: GridCell;
}

// Публикуется BoardSystem на каждое изменение счётчика ходов (ход/undo/restart) — источник для
// MovesView (DESIGN_UPDATE_PLAN.md §5 Шаг 4.5).
export const EVT_MOVES_CHANGED = 'EVT_MOVES_CHANGED';
export interface MovesChangedEvent {
    moves: number;
}

// Нижний бар просит подсказку — гейтится тем же canAcceptInput(), что и EVT_SWIPE/UNDO/RESTART
// (DESIGN_UPDATE_PLAN.md §8.2 п.1). Обрабатывается HintSystem (§5 Шаг 3.3).
export const EVT_HINT_REQUEST = 'EVT_HINT_REQUEST';
export interface HintRequestEvent {}

// Публикуется HintSystem только когда BoardSolver.solve() вернул реальный ход (путь ещё не свободен) —
// подсветка блока + направление хода, которое игрок физически сможет воспроизвести свайпом (§1.2).
export const EVT_HINT_SHOW = 'EVT_HINT_SHOW';
export interface HintShowEvent {
    blockId: number;
    dir: 'up' | 'down' | 'left' | 'right';
}

// Публикуется HintSystem на каждое изменение остатка подсказок — источник для badge на кнопке hint
// в BottomBarView (DESIGN_UPDATE_PLAN.md §5 Шаг 4.6).
export const EVT_HINTS_CHANGED = 'EVT_HINTS_CHANGED';
export interface HintsChangedEvent {
    hints: number;
}
