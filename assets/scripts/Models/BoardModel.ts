import { BlockModel } from './BlockModel';

// Сложность уровня для HUD (DESIGN_UPDATE_PLAN.md §5 Шаг 2.2): звёзды + подпись, из levels.json.
export interface LevelDifficulty {
    stars: number;
    label: string;
}

// Одна раскладка уровня — как она приходит из levels.json (level, difficulty, exitRow, exitSide,
// blocks[]). Награды отменены (DESIGN_UPDATE_PLAN.md решение 0.3) — поля reward больше нет.
export interface LevelData {
    level: number;
    difficulty: LevelDifficulty;
    exitRow: number;
    exitSide: 'right';
    blocks: BlockModel[];
}

// Корень levels.json: массив раскладок. Один уровень (DESIGN_UPDATE_PLAN.md решение 0.2), схема
// оставлена массивом, чтобы не менять BoardSystem при появлении новых раскладок.
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
