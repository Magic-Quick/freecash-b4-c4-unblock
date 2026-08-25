import { GamePhase } from './GamePhase';

// Plain-модель сессии: единственный уровень (DESIGN_UPDATE_PLAN.md решение 0.2 — монеты/FC отменены
// решением 0.3), фаза, счётчик ходов и single-fire guards. Guards централизованы здесь (а не в каждой
// System), чтобы правило «drive/CTA — максимум один раз на уровень/сессию» (AGENTS.md §4,
// IMPLEMENTATION_PHASES Фаза 1 п.6) имело одну точку правды.
export class GameStateModel {
    // Уровень один (DESIGN_UPDATE_PLAN.md §5 Шаг 2.4) — id из levels.json, не переключается за сессию.
    // Свойство остаётся read-only (не setter), чтобы DriveSystem.onMainPathClear() читал его без изменений.
    private readonly _currentLevel = 1;
    private _phase: GamePhase = GamePhase.INTRO;
    private _moves = 0;

    private readonly _driveFiredForLevel: Set<number> = new Set();
    private _ctaRequested = false;

    public get currentLevel(): number {
        return this._currentLevel;
    }

    public get phase(): GamePhase {
        return this._phase;
    }

    public set phase(phase: GamePhase) {
        this._phase = phase;
    }

    public get moves(): number {
        return this._moves;
    }

    // Каждый успешный ход (BoardSystem, после push в стек истории) увеличивает счётчик.
    public incrementMoves(): number {
        this._moves += 1;
        return this._moves;
    }

    // Undo уменьшает счётчик обратно — после N ходов и N undo счётчик равен нулю (DESIGN_UPDATE_PLAN.md §3 gate).
    public decrementMoves(): number {
        this._moves = Math.max(0, this._moves - 1);
        return this._moves;
    }

    // Restart обнуляет счётчик вместе с остальным уровневым состоянием (DESIGN_UPDATE_PLAN.md §8.2 п.6).
    public resetMoves(): void {
        this._moves = 0;
    }

    // Ввод (свайпы) принимается только в LEVEL_PLAY — единственная проверка фазы для входящего EVT_SWIPE.
    public canAcceptInput(): boolean {
        return this._phase === GamePhase.LEVEL_PLAY;
    }

    // Guard: автопроезд главного блока стартует не более одного раза на уровень.
    public tryStartDrive(level: number): boolean {
        if (this._driveFiredForLevel.has(level)) {
            return false;
        }
        this._driveFiredForLevel.add(level);
        return true;
    }

    // Guard: CTA запрашивается не более одного раза за сессию.
    public tryRequestCta(): boolean {
        if (this._ctaRequested) {
            return false;
        }
        this._ctaRequested = true;
        return true;
    }
}
