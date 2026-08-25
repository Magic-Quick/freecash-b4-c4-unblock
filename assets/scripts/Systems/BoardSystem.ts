import { _decorator, Component } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { BoardModel, LevelsDataFile } from '../Models/BoardModel';
import { BlockModel } from '../Models/BlockModel';
import { BoardSnapshot } from '../Models/BoardSolver';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_LEVEL_STARTED,
    LevelStartedEvent,
    EVT_SWIPE,
    SwipeEvent,
    EVT_BLOCK_MOVED,
    BlockMovedEvent,
    EVT_BLOCK_BLOCKED,
    BlockBlockedEvent,
    EVT_MAIN_PATH_CLEAR,
    MainPathClearEvent,
    EVT_MAIN_BLOCKED,
    MainBlockedEvent,
    GridCell,
    EVT_UNDO_REQUEST,
    UndoRequestEvent,
    EVT_RESTART_REQUEST,
    RestartRequestEvent,
    EVT_BLOCK_UNDONE,
    BlockUndoneEvent,
    EVT_MOVES_CHANGED,
    MovesChangedEvent,
} from '../event-bus/events';
import { GameStateSystem } from './GameStateSystem';

const { ccclass, property } = _decorator;

// Один ход в стеке истории — ровно то, что нужно, чтобы откатить occupancy grid и BlockModel обратно
// (DESIGN_UPDATE_PLAN.md §5 Шаг 3.2). hitWall сюда не входит — он только для one-shot SFX/FX хода.
interface MoveHistoryEntry {
    blockId: number;
    fromCell: GridCell;
    toCell: GridCell;
}

// Ядро механики (ARCHITECTURE.md §2): держит BoardModel и occupancy grid, не знает о View/спрайтах.
// Раскладки берутся исключительно из GameConfig.levelsData (assets/data/levels.json) — никаких
// захардкоженных координат уровней здесь быть не должно (AGENTS.md §2/§3).
@ccclass('BoardSystem')
export class BoardSystem extends Component {
    @property(GameConfig)
    private config: GameConfig | null = null;

    // Статический указатель на единственный экземпляр сцены — тот же приём, что GameStateSystem.model
    // (см. её комментарий): System-компоненты не связаны @property-ссылками друг с другом
    // (ARCHITECTURE.md §5), поэтому HintSystem (Шаг 3.3) читает снапшот через BoardSystem.getSnapshot(),
    // а не через прямую ссылку на ноду.
    private static _instance: BoardSystem | null = null;

    private boardModel: BoardModel | null = null;
    // grid[row][col] = id блока, который занимает ячейку, либо 0 для пустой ячейки.
    private grid: number[][] = [];
    // Последнее опубликованное состояние коридора главного блока — для дедупликации EVT_MAIN_PATH_CLEAR/BLOCKED.
    private lastMainClear: boolean | null = null;
    // Стек успешных ходов текущего уровня — источник для EVT_UNDO_REQUEST (DESIGN_UPDATE_PLAN.md §5 Шаг 3.2).
    // Restart очищает его целиком, undo снимает по одной записи с конца (LIFO — последний ход отменяется первым).
    private moveHistory: MoveHistoryEntry[] = [];

    private readonly _onLevelStarted = this.onLevelStarted.bind(this);
    private readonly _onSwipe = this.onSwipe.bind(this);
    private readonly _onUndoRequest = this.onUndoRequest.bind(this);
    private readonly _onRestartRequest = this.onRestartRequest.bind(this);

    protected onLoad(): void {
        BoardSystem._instance = this;
        GlobalEventBus.subscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.subscribe<SwipeEvent>(EVT_SWIPE, this._onSwipe);
        GlobalEventBus.subscribe<UndoRequestEvent>(EVT_UNDO_REQUEST, this._onUndoRequest);
        GlobalEventBus.subscribe<RestartRequestEvent>(EVT_RESTART_REQUEST, this._onRestartRequest);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.unsubscribe<SwipeEvent>(EVT_SWIPE, this._onSwipe);
        GlobalEventBus.unsubscribe<UndoRequestEvent>(EVT_UNDO_REQUEST, this._onUndoRequest);
        GlobalEventBus.unsubscribe<RestartRequestEvent>(EVT_RESTART_REQUEST, this._onRestartRequest);
        if (BoardSystem._instance === this) {
            BoardSystem._instance = null;
        }
    }

    private onLevelStarted(event: LevelStartedEvent): void {
        if (!this.config || !this.config.levelsData) {
            return;
        }
        const file = this.config.levelsData.json as LevelsDataFile;
        const levelData = file.levels.find((entry) => entry.level === event.level);
        if (!levelData) {
            return;
        }
        // Копируем блоки, чтобы модель уровня мутировалась независимо от исходных данных JsonAsset.
        const blocks: BlockModel[] = levelData.blocks.map((block) => ({ ...block }));
        this.boardModel = new BoardModel(this.config.gridCols, this.config.gridRows, levelData.exitRow, blocks);
        this.grid = this.buildGrid(this.boardModel);
        // Этот же путь используется рестартом (onRestartRequest republish-ит EVT_LEVEL_STARTED) — стек
        // истории и счётчик ходов сбрасываются здесь же, чтобы не разъехаться с перестройкой grid/boardModel
        // (DESIGN_UPDATE_PLAN.md §8.2 п.6).
        this.moveHistory = [];
        GameStateSystem.model.resetMoves();
        GlobalEventBus.publish<MovesChangedEvent>(EVT_MOVES_CHANGED, { moves: GameStateSystem.model.moves });
        // Базовое значение без публикации — первое реальное изменение будет опубликовано после хода.
        this.lastMainClear = this.computeMainClear();
    }

    private buildGrid(model: BoardModel): number[][] {
        const grid: number[][] = Array.from({ length: model.rows }, () => new Array(model.cols).fill(0));
        model.blocks.forEach((block) => {
            for (let i = 0; i < block.length; i++) {
                const col = block.axis === 'horizontal' ? block.col + i : block.col;
                const row = block.axis === 'horizontal' ? block.row : block.row + i;
                grid[row][col] = block.id;
            }
        });
        return grid;
    }

    private onSwipe(event: SwipeEvent): void {
        if (!GameStateSystem.model.canAcceptInput()) {
            return;
        }
        if (!this.boardModel) {
            return;
        }
        const block = this.boardModel.blocks.get(event.blockId);
        if (!block) {
            return;
        }
        // Ось блока должна совпадать с направлением свайпа: горизонтальные блоки — только left/right.
        const isHorizontalSwipe = event.dir === 'left' || event.dir === 'right';
        if (isHorizontalSwipe !== (block.axis === 'horizontal')) {
            return;
        }
        const dx = event.dir === 'left' ? -1 : event.dir === 'right' ? 1 : 0;
        const dy = event.dir === 'up' ? -1 : event.dir === 'down' ? 1 : 0;
        const { shift, hitWall } = this.computeMaxShift(block, dx, dy);
        if (shift === 0) {
            GlobalEventBus.publish<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, { blockId: block.id });
            return;
        }
        const fromCell: GridCell = { col: block.col, row: block.row };
        this.writeBlockToGrid(block, 0);
        block.col += dx * shift;
        block.row += dy * shift;
        this.writeBlockToGrid(block, block.id);
        const toCell: GridCell = { col: block.col, row: block.row };
        GlobalEventBus.publish<BlockMovedEvent>(EVT_BLOCK_MOVED, { blockId: block.id, fromCell, toCell, hitWall });
        // Push только на успешный сдвиг (shift>0 уже проверен выше) — источник для EVT_UNDO_REQUEST.
        this.moveHistory.push({ blockId: block.id, fromCell, toCell });
        GlobalEventBus.publish<MovesChangedEvent>(EVT_MOVES_CHANGED, { moves: GameStateSystem.model.incrementMoves() });
        this.checkMainPath();
    }

    // Undo — единая точка гейта canAcceptInput() (DESIGN_UPDATE_PLAN.md §8.2 п.1): вне LEVEL_PLAY
    // (например во время автопроезда LEVEL_DRIVE) запрос молча игнорируется, кнопка гасится отдельно
    // на стороне View (§8.2 п.2, вне зоны этого файла).
    private onUndoRequest(): void {
        if (!GameStateSystem.model.canAcceptInput()) {
            return;
        }
        if (!this.boardModel || this.moveHistory.length === 0) {
            return;
        }
        const entry = this.moveHistory.pop() as MoveHistoryEntry;
        const block = this.boardModel.blocks.get(entry.blockId);
        if (!block) {
            return;
        }
        // Тот же приём, что и в onSwipe: снять блок с grid, передвинуть модель, записать обратно —
        // только в обратную сторону (toCell → fromCell).
        this.writeBlockToGrid(block, 0);
        block.col = entry.fromCell.col;
        block.row = entry.fromCell.row;
        this.writeBlockToGrid(block, block.id);
        // Отдельное событие, а не переиспользование EVT_BLOCK_MOVED (DESIGN_UPDATE_PLAN.md §8.2 п.4) —
        // на EVT_BLOCK_MOVED подписаны TutorialSystem/SoundSystem/счётчик ходов, откат через него увеличил
        // бы счётчик хода вместо уменьшения. fromCell/toCell зеркалятся относительно исходной записи, чтобы
        // подписчик мог так же вызвать slideTo(event.toCell), как и на обычный ход.
        GlobalEventBus.publish<BlockUndoneEvent>(EVT_BLOCK_UNDONE, {
            blockId: entry.blockId,
            fromCell: entry.toCell,
            toCell: entry.fromCell,
        });
        GlobalEventBus.publish<MovesChangedEvent>(EVT_MOVES_CHANGED, { moves: GameStateSystem.model.decrementMoves() });
        // Пересчитать без публикации (DESIGN_UPDATE_PLAN.md §8.2 п.3) — undo меняет grid в обход onSwipe,
        // поэтому lastMainClear обязан догнать новое состояние сам, иначе следующий реальный EVT_SWIPE
        // может быть ошибочно расценен как «без изменений» и не опубликует EVT_MAIN_PATH_CLEAR/BLOCKED.
        this.lastMainClear = this.computeMainClear();
    }

    // Restart — тот же гейт canAcceptInput(), что и undo (§8.2 п.1). Republish EVT_LEVEL_STARTED
    // переиспользует onLevelStarted целиком: он же перестраивает boardModel/grid из levels.json, чистит
    // стек истории, сбрасывает счётчик ходов и lastMainClear — и попутно даёт BoardView/TutorialSystem
    // штатный сигнал пересобрать визуал и показать подсказку заново (DESIGN_UPDATE_PLAN.md §8.2 п.6).
    private onRestartRequest(): void {
        if (!GameStateSystem.model.canAcceptInput()) {
            return;
        }
        GlobalEventBus.publish<LevelStartedEvent>(EVT_LEVEL_STARTED, { level: GameStateSystem.model.currentLevel });
    }

    // Read-only снапшот текущего состояния поля для солвера (HintSystem, Шаг 3.3) — новый массив
    // и новые объекты блоков при каждом вызове, солвер не может случайно замутировать boardModel/grid.
    public static getSnapshot(): BoardSnapshot | null {
        const model = BoardSystem._instance?.boardModel;
        if (!model) {
            return null;
        }
        return {
            cols: model.cols,
            rows: model.rows,
            exitRow: model.exitRow,
            blocks: Array.from(model.blocks.values()).map((block) => ({ ...block })),
        };
    }

    // Считает максимальный сдвиг блока вдоль (dx,dy) против occupancy grid: останавливается на границе
    // поля (hitWall=true) либо перед другим блоком (hitWall=false). Модель НЕ мутирует эта функция —
    // только читает grid, вызывающий код применяет сдвиг сам.
    private computeMaxShift(block: BlockModel, dx: number, dy: number): { shift: number; hitWall: boolean } {
        const model = this.boardModel as BoardModel;
        const maxSteps = Math.max(model.cols, model.rows);
        let shift = 0;
        for (let step = 1; step <= maxSteps; step++) {
            let outOfBounds = false;
            let blocked = false;
            for (let i = 0; i < block.length; i++) {
                const col = block.axis === 'horizontal' ? block.col + i + dx * step : block.col + dx * step;
                const row = block.axis === 'horizontal' ? block.row + dy * step : block.row + i + dy * step;
                if (col < 0 || col >= model.cols || row < 0 || row >= model.rows) {
                    outOfBounds = true;
                    break;
                }
                const occupant = this.grid[row][col];
                if (occupant !== 0 && occupant !== block.id) {
                    blocked = true;
                    break;
                }
            }
            if (outOfBounds) {
                return { shift, hitWall: true };
            }
            if (blocked) {
                return { shift, hitWall: false };
            }
            shift = step;
        }
        return { shift, hitWall: false };
    }

    private writeBlockToGrid(block: BlockModel, value: number): void {
        for (let i = 0; i < block.length; i++) {
            const col = block.axis === 'horizontal' ? block.col + i : block.col;
            const row = block.axis === 'horizontal' ? block.row : block.row + i;
            this.grid[row][col] = value;
        }
    }

    // Коридор главного блока к правому выходу свободен, если все ячейки exitRow от правого края
    // главного блока до края поля пусты.
    private computeMainClear(): boolean {
        const model = this.boardModel;
        if (!model) {
            return false;
        }
        let main: BlockModel | undefined;
        model.blocks.forEach((block) => {
            if (block.isMain) {
                main = block;
            }
        });
        if (!main) {
            return false;
        }
        const row = model.exitRow;
        for (let col = main.col + main.length; col < model.cols; col++) {
            if (this.grid[row][col] !== 0) {
                return false;
            }
        }
        return true;
    }

    private checkMainPath(): void {
        const clear = this.computeMainClear();
        if (clear === this.lastMainClear) {
            return;
        }
        this.lastMainClear = clear;
        if (clear) {
            GlobalEventBus.publish<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, {});
        } else {
            GlobalEventBus.publish<MainBlockedEvent>(EVT_MAIN_BLOCKED, {});
        }
    }
}
