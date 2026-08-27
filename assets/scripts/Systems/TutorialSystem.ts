import { _decorator, Component } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { LevelsDataFile } from '../Models/BoardModel';
import { BlockModel } from '../Models/BlockModel';
import { BoardSnapshot, BoardSolver } from '../Models/BoardSolver';
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
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Подсказка туториала — первый ход оптимального решения BoardSolver, а не наводящая догадка
// (DESIGN_UPDATE_PLAN.md §5 Шаг 3.4). Снапшот стартовой раскладки строится напрямую из levels.json,
// а не через BoardSystem.getSnapshot(): на EVT_LEVEL_STARTED порядок вызова подписчиков EventBus не
// гарантирован (см. event-bus.ts — Set хранит insertion order), поэтому опираться на то, что
// BoardSystem успеет перестроить своё состояние раньше TutorialSystem, нельзя. Раскладка на старте
// уровня (в т.ч. при рестарте) всегда совпадает с levels.json, так что это тот же снапшот, что и у
// BoardSystem в этот момент.
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

    // EVT_LEVEL_STARTED приходит и на первый старт, и повторно на рестарт (BoardSystem.onRestartRequest
    // republish-ит его целиком) — оба раза пересчитывает и показывает подсказку заново, никакой
    // отдельной подписки на EVT_RESTART_REQUEST не нужно (DESIGN_UPDATE_PLAN.md §5 Шаг 3.4).
    private onLevelStarted(event: LevelStartedEvent): void {
        const hint = this.computeHint(event.level);
        if (hint) {
            GlobalEventBus.publish<TutorialShowEvent>(EVT_TUTORIAL_SHOW, hint);
        } else {
            GlobalEventBus.publish<TutorialHideEvent>(EVT_TUTORIAL_HIDE, {});
        }
    }

    private onBlockMoved(): void {
        // Игрок уже сделал ход — подсказка больше не нужна.
        GlobalEventBus.publish<TutorialHideEvent>(EVT_TUTORIAL_HIDE, {});
    }

    // Строит снапшот стартовой раскладки уровня из levels.json и спрашивает BoardSolver о первом ходе
    // оптимального решения — той же семантики «до упора» (DESIGN_UPDATE_PLAN.md §1.2), что и сам
    // свайп, поэтому подсказка всегда воспроизводима игроком. null, если солвер не нашёл хода (путь
    // уже свободен либо раскладка не описана в levels.json) — тогда подсказку скрываем.
    private computeHint(level: number): TutorialShowEvent | null {
        if (!this.config || !this.config.levelsData) {
            return null;
        }
        const file = this.config.levelsData.json as LevelsDataFile;
        const levelData = file.levels.find((entry) => entry.level === level);
        if (!levelData) {
            return null;
        }
        const blocks: BlockModel[] = levelData.blocks.map((block) => ({ ...block }));
        const snapshot: BoardSnapshot = {
            cols: this.config.gridCols,
            rows: this.config.gridRows,
            exitRow: levelData.exitRow,
            blocks,
        };
        const move = BoardSolver.solve(snapshot);
        if (!move) {
            return null;
        }
        // fromCell — якорная ячейка блока ДО хода (BoardSolver.SolverMove), в blocks (тот же снапшот)
        // ищем сам блок за длиной — длина не меняется ходом, брать из snapshot после solve() было бы
        // эквивалентно, но blocks уже под рукой.
        const movedBlock = blocks.find((block) => block.id === move.blockId);
        return { fromCell: move.fromCell, toCell: move.toCell, blockLength: movedBlock?.length ?? 1 };
    }
}
