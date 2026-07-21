import { _decorator, Component } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { BoardModel, LevelsDataFile } from '../Models/BoardModel';
import { BlockModel } from '../Models/BlockModel';
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
} from '../event-bus/events';
import { GameStateSystem } from './GameStateSystem';

const { ccclass, property } = _decorator;

// Ядро механики (ARCHITECTURE.md §2): держит BoardModel и occupancy grid, не знает о View/спрайтах.
// Раскладки берутся исключительно из GameConfig.levelsData (assets/data/levels.json) — никаких
// захардкоженных координат уровней здесь быть не должно (AGENTS.md §2/§3).
@ccclass('BoardSystem')
export class BoardSystem extends Component {
    @property(GameConfig)
    private config: GameConfig | null = null;

    private boardModel: BoardModel | null = null;
    // grid[row][col] = id блока, который занимает ячейку, либо 0 для пустой ячейки.
    private grid: number[][] = [];
    // Последнее опубликованное состояние коридора главного блока — для дедупликации EVT_MAIN_PATH_CLEAR/BLOCKED.
    private lastMainClear: boolean | null = null;

    private readonly _onLevelStarted = this.onLevelStarted.bind(this);
    private readonly _onSwipe = this.onSwipe.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.subscribe<SwipeEvent>(EVT_SWIPE, this._onSwipe);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.unsubscribe<SwipeEvent>(EVT_SWIPE, this._onSwipe);
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
        this.checkMainPath();
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
        console.error('[DEBUG BoardSystem] checkMainPath', { clear, lastMainClear: this.lastMainClear });
        if (clear === this.lastMainClear) {
            return;
        }
        this.lastMainClear = clear;
        if (clear) {
            console.error('[DEBUG BoardSystem] publish EVT_MAIN_PATH_CLEAR');
            GlobalEventBus.publish<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, {});
        } else {
            GlobalEventBus.publish<MainBlockedEvent>(EVT_MAIN_BLOCKED, {});
        }
    }
}
