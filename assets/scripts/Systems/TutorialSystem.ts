import { _decorator, Component } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { LevelsDataFile } from '../Models/BoardModel';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_LEVEL_STARTED,
    LevelStartedEvent,
    EVT_BLOCK_MOVED,
    BlockMovedEvent,
    EVT_TUTORIAL_SHOW,
    TutorialShowEvent,
    EVT_TUTORIAL_HIDE,
    TutorialHideEvent,
    GridCell,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Простая подсказка «какой блок сдвинуть первым» (ARCHITECTURE.md §2/§3). Цель не «идеальный решатель»,
// а один разумный, полностью data-driven хинт — координаты берутся из levels.json на каждый уровень
// заново, никаких захардкоженных ячеек (AGENTS.md §2).
@ccclass('TutorialSystem')
export class TutorialSystem extends Component {
    @property(GameConfig)
    private config: GameConfig | null = null;

    private readonly _onLevelStarted = this.onLevelStarted.bind(this);
    private readonly _onBlockMoved = this.onBlockMoved.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.subscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.unsubscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
    }

    private onLevelStarted(event: LevelStartedEvent): void {
        const hint = this.computeHint(event.level);
        if (hint) {
            GlobalEventBus.publish<TutorialShowEvent>(EVT_TUTORIAL_SHOW, hint);
        } else {
            GlobalEventBus.publish<TutorialHideEvent>(EVT_TUTORIAL_HIDE, {});
        }
    }

    private onBlockMoved(): void {
        // Игрок уже сделал ход — подсказка больше не нужна (эвристика Фазы 2, уточнение — Фаза 3).
        GlobalEventBus.publish<TutorialHideEvent>(EVT_TUTORIAL_HIDE, {});
    }

    // Берёт первый не-главный блок из данных уровня и предлагает сдвинуть его на одну ячейку в сторону
    // свободного края по его же оси — не «решение», а простая наводящая подсказка.
    private computeHint(level: number): TutorialShowEvent | null {
        if (!this.config || !this.config.levelsData) {
            return null;
        }
        const file = this.config.levelsData.json as LevelsDataFile;
        const levelData = file.levels.find((entry) => entry.level === level);
        if (!levelData) {
            return null;
        }
        const target = levelData.blocks.find((block) => !block.isMain);
        if (!target) {
            return null;
        }
        const fromCell: GridCell = { col: target.col, row: target.row };
        let toCell: GridCell;
        if (target.axis === 'vertical') {
            toCell = target.row > 0 ? { col: target.col, row: target.row - 1 } : { col: target.col, row: target.row + 1 };
        } else {
            toCell = target.col > 0 ? { col: target.col - 1, row: target.row } : { col: target.col + 1, row: target.row };
        }
        return { fromCell, toCell };
    }
}
