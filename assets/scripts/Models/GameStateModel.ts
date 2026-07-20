import { GamePhase } from './GamePhase';

// Plain-модель сессии: текущий уровень, фаза, накопленные монеты и single-fire guards.
// Guards централизованы здесь (а не в каждой System), чтобы правило «drive/reward/CTA —
// максимум один раз на уровень/сессию» (AGENTS.md §4, IMPLEMENTATION_PHASES Фаза 1 п.6) имело одну точку правды.
export class GameStateModel {
    private _currentLevel: 1 | 2 = 1;
    private _phase: GamePhase = GamePhase.INTRO;
    private _totalCoins = 0;

    private readonly _driveFiredForLevel: Set<number> = new Set();
    private readonly _rewardFiredForLevel: Set<number> = new Set();
    private _ctaRequested = false;

    public get currentLevel(): 1 | 2 {
        return this._currentLevel;
    }

    public set currentLevel(level: 1 | 2) {
        this._currentLevel = level;
    }

    public get phase(): GamePhase {
        return this._phase;
    }

    public set phase(phase: GamePhase) {
        this._phase = phase;
    }

    public get totalCoins(): number {
        return this._totalCoins;
    }

    public addCoins(amount: number): number {
        this._totalCoins += amount;
        return this._totalCoins;
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

    // Guard: награда начисляется не более одного раза на уровень.
    public tryGrantReward(level: number): boolean {
        if (this._rewardFiredForLevel.has(level)) {
            return false;
        }
        this._rewardFiredForLevel.add(level);
        return true;
    }

    // Guard: CTA запрашивается не более одного раза за сессию (только после L2).
    public tryRequestCta(): boolean {
        if (this._ctaRequested) {
            return false;
        }
        this._ctaRequested = true;
        return true;
    }
}
