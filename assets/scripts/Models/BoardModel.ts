import { BlockModel } from './BlockModel';

// Одна раскладка уровня — как она приходит из levels.json (level, reward, exitRow, exitSide, blocks[]).
export interface LevelData {
    level: number;
    reward: number;
    exitRow: number;
    exitSide: 'right';
    blocks: BlockModel[];
}

// Корень levels.json: массив раскладок L1/L2 (и далее, без изменения BoardSystem — см. IMPLEMENTATION_PHASES §Фаза 0).
export interface LevelsDataFile {
    levels: LevelData[];
}

// Plain-модель состояния поля. Логика перемещений/коридора — зона BoardSystem (Фаза 2);
// здесь только структура данных, которую BoardSystem будет строить и мутировать.
export class BoardModel {
    public readonly cols: number;
    public readonly rows: number;
    public readonly exitRow: number;
    public readonly blocks: Map<number, BlockModel>;

    constructor(cols: number, rows: number, exitRow: number, blocks: BlockModel[]) {
        this.cols = cols;
        this.rows = rows;
        this.exitRow = exitRow;
        this.blocks = new Map(blocks.map((block) => [block.id, block]));
    }
}
