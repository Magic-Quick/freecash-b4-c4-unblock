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

export const EVT_COINS_CHANGED = 'EVT_COINS_CHANGED';
export interface CoinsChangedEvent {
    total: number;
    delta: number;
    isFinal: boolean;
}

export const EVT_TUTORIAL_SHOW = 'EVT_TUTORIAL_SHOW';
export interface TutorialShowEvent {
    fromCell: GridCell;
    toCell: GridCell;
}

export const EVT_TUTORIAL_HIDE = 'EVT_TUTORIAL_HIDE';
export interface TutorialHideEvent {}

export const EVT_REQUEST_CTA = 'EVT_REQUEST_CTA';
export interface RequestCtaEvent {
    totalFc: number;
}

export const EVT_PLAY_SOUND = 'EVT_PLAY_SOUND';
export interface PlaySoundEvent {
    id: string;
}

export const EVT_TAP = 'EVT_TAP';
export interface TapEvent {}

// Добавлено на Фазе 0: GameStateSystem слушает именно это событие, а не сырой EVT_LEVEL_SOLVED,
// чтобы FX награды (fly-in монет) L1 гарантированно долетел до старта L2 (см. ARCHITECTURE.md §2).
export const EVT_REWARD_SEQUENCE_DONE = 'EVT_REWARD_SEQUENCE_DONE';
export interface RewardSequenceDoneEvent {
    level: number;
    isFinal: boolean;
}
