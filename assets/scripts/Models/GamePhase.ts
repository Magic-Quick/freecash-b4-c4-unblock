// Фазы игровой сессии «Unblock». Порядок значений фиксирован контрактом AGENTS.md §4 — не переставлять.
export enum GamePhase {
    INTRO = 0,
    LEVEL_PLAY = 1,
    LEVEL_DRIVE = 2,
    LEVEL_CLEAR = 3,
    CTA = 4,
}
