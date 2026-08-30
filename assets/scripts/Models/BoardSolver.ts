import { BlockModel } from './BlockModel';

// Plain-снапшот состояния поля для солвера (BoardSystem.getSnapshot(), DESIGN_UPDATE_PLAN.md §5 Шаг 3.2) —
// read-only копия, солвер её не мутирует и ничего не публикует в EventBus.
export interface BoardSnapshot {
    cols: number;
    rows: number;
    exitRow: number;
    blocks: BlockModel[];
}

export type SolverDirection = 'up' | 'down' | 'left' | 'right';

// Плоская ячейка сетки — та же форма, что event-bus/events.ts:GridCell, но без импорта оттуда:
// солвер намеренно не знает про EventBus/cc (см. комментарий класса ниже). TS сопоставляет структурно.
export interface SolverCell {
    col: number;
    row: number;
}

export interface SolverMove {
    blockId: number;
    dir: SolverDirection;
    // Позиция блока до и после хода — чтобы вызывающему коду (TutorialSystem, DESIGN_UPDATE_PLAN.md
    // §5 Шаг 3.4) не пришлось заново считать сдвиг «до упора»: солвер уже знает его из applyMove().
    fromCell: SolverCell;
    toCell: SolverCell;
}

interface DirVector {
    dir: SolverDirection;
    dx: number;
    dy: number;
}

// Свайп должен совпадать с осью блока (см. BoardSystem.onSwipe()) — горизонтальные блоки принимают
// только left/right, вертикальные — только up/down.
const HORIZONTAL_DIRS: readonly DirVector[] = [
    { dir: 'left', dx: -1, dy: 0 },
    { dir: 'right', dx: 1, dy: 0 },
];
const VERTICAL_DIRS: readonly DirVector[] = [
    { dir: 'up', dx: 0, dy: -1 },
    { dir: 'down', dx: 0, dy: 1 },
];

interface LegalMove extends DirVector {
    blockId: number;
    shift: number;
}

// Чистый BFS по plain-данным (DESIGN_UPDATE_PLAN.md §5 Шаг 3.1) — без зависимостей от cc/Component,
// вызывается синхронно на каждый запрос подсказки. Семантика хода — «до упора» (§1.2), идентична
// BoardSystem.computeMaxShift(): подсказка обязана совпадать с тем, что игрок физически получит
// свайпом, иначе подскажет ход, который нельзя повторить.
// Доска 6×6 — порядка 900 просмотренных состояний, ~1.1 мс на прогретом десктопном V8 и заметно
// больше на мобильном холодном JIT, т.е. вызов НЕ бесплатный: на старте уровня подсказка постоянна и
// кэшируется в TutorialSystem, а сюда доходит только живой запрос от HintSystem (там снапшот меняется
// после каждого хода/undo, и кэшировать его нельзя).
export class BoardSolver {
    // Первый ход кратчайшего (оптимального) решения из snapshot. Возвращает null, если коридор
    // главного блока к выходу уже свободен — в этом случае хода не требуется и подсказку расходовать
    // нельзя (§3.3) — либо если раскладка недостижимо решаема из этого состояния (на раскладке,
    // проверенной tools/solve_levels.py, не должно происходить).
    public static solve(snapshot: BoardSnapshot): SolverMove | null {
        const { cols, rows, exitRow } = snapshot;
        const startBlocks = snapshot.blocks.map((block) => ({ ...block }));
        if (BoardSolver.isSolved(exitRow, startBlocks)) {
            return null;
        }

        const visited = new Set<string>([BoardSolver.encode(startBlocks, cols)]);
        const queue: { blocks: BlockModel[]; firstMove: SolverMove }[] = [];
        let head = 0;

        // Разворачивание одного состояния — общий код для стартовой раскладки и для каждого узла,
        // снятого с очереди (раньше эти два цикла были продублированы почти дословно).
        // Решение проверяется ЗДЕСЬ, в момент постановки в очередь, а не при снятии: найденное
        // состояние возвращается сразу, а не после того, как BFS домотает до него весь текущий слой.
        // На раскладке levels.json это 887 просмотренных состояний вместо 1047 — ответ тот же,
        // потому что BFS всё так же идёт по слоям и первое встреченное решение остаётся кратчайшим.
        const expand = (blocks: BlockModel[], inheritedFirstMove: SolverMove | null): SolverMove | null => {
            for (const move of BoardSolver.legalMoves(cols, rows, blocks)) {
                const nextBlocks = BoardSolver.applyMove(blocks, move);
                const key = BoardSolver.encode(nextBlocks, cols);
                if (visited.has(key)) {
                    continue;
                }
                visited.add(key);
                // На стартовом состоянии firstMove ещё не задан — он рождается здесь, на единственном
                // месте, где известны и позиция блока до сдвига (blocks), и после (nextBlocks). Дальше
                // по BFS он просто переносится без изменений до найденного решения.
                const firstMove = inheritedFirstMove ?? BoardSolver.describeMove(blocks, nextBlocks, move);
                if (BoardSolver.isSolved(exitRow, nextBlocks)) {
                    return firstMove;
                }
                queue.push({ blocks: nextBlocks, firstMove });
            }
            return null;
        };

        const solvedFromStart = expand(startBlocks, null);
        if (solvedFromStart) {
            return solvedFromStart;
        }
        while (head < queue.length) {
            const current = queue[head];
            head++;
            const solved = expand(current.blocks, current.firstMove);
            if (solved) {
                return solved;
            }
        }

        return null;
    }

    // Восстанавливает публичную форму хода (SolverMove) из пары состояний «до/после» — вынесено из
    // solve() отдельно только чтобы не раздувать expand(): вызывается ровно один раз за solve(),
    // на первом же ходу ветки.
    private static describeMove(blocks: BlockModel[], nextBlocks: BlockModel[], move: LegalMove): SolverMove {
        const before = blocks.find((block) => block.id === move.blockId) as BlockModel;
        const after = nextBlocks.find((block) => block.id === move.blockId) as BlockModel;
        return {
            blockId: move.blockId,
            dir: move.dir,
            fromCell: { col: before.col, row: before.row },
            toCell: { col: after.col, row: after.row },
        };
    }

    // Коридор главного блока к правому выходу свободен, если ни один другой блок не занимает ячейку
    // exitRow правее главного — то же условие, что BoardSystem.computeMainClear().
    // Проверяется прямым обходом блоков, а НЕ через buildGrid(): isSolved() зовётся на каждое новое
    // состояние BFS, и сетка здесь строилась бы вторым разом поверх той, которую legalMoves() уже
    // строит для того же состояния (на раскладке levels.json — 1773 построения сетки вместо 886).
    // Границы поля проверять не нужно: ячеек правее cols не существует, значит и блока там нет.
    private static isSolved(exitRow: number, blocks: BlockModel[]): boolean {
        const main = blocks.find((block) => block.isMain);
        if (!main) {
            return false;
        }
        // Первая ячейка коридора — сразу за правым краем главного блока.
        const corridorStart = main.col + main.length;
        for (const block of blocks) {
            if (block === main) {
                continue;
            }
            if (block.axis === 'horizontal') {
                // Горизонтальный блок мешает, только если лежит в самой exitRow и его правый край
                // дотягивается до коридора.
                if (block.row === exitRow && block.col + block.length - 1 >= corridorStart) {
                    return false;
                }
                continue;
            }
            // Вертикальный блок мешает, если стоит в колонке коридора и перекрывает exitRow по высоте.
            if (block.col >= corridorStart && exitRow >= block.row && exitRow < block.row + block.length) {
                return false;
            }
        }
        return true;
    }

    // Все ходы «до упора» (shift > 0), доступные из текущей раскладки, по одному на (блок, направление).
    private static legalMoves(cols: number, rows: number, blocks: BlockModel[]): LegalMove[] {
        const grid = BoardSolver.buildGrid(cols, rows, blocks);
        const moves: LegalMove[] = [];
        blocks.forEach((block) => {
            const dirs = block.axis === 'horizontal' ? HORIZONTAL_DIRS : VERTICAL_DIRS;
            dirs.forEach(({ dir, dx, dy }) => {
                const shift = BoardSolver.computeMaxShift(grid, cols, rows, block, dx, dy);
                if (shift > 0) {
                    moves.push({ blockId: block.id, dir, dx, dy, shift });
                }
            });
        });
        return moves;
    }

    // Максимальный сдвиг блока вдоль (dx,dy) против occupancy grid — останавливается на границе поля
    // либо перед другим блоком. Не мутирует grid/block, только читает. Эквивалент
    // BoardSystem.computeMaxShift(), но над локальным grid солвера, а не полем системы.
    private static computeMaxShift(grid: number[][], cols: number, rows: number, block: BlockModel, dx: number, dy: number): number {
        const maxSteps = Math.max(cols, rows);
        let shift = 0;
        for (let step = 1; step <= maxSteps; step++) {
            let blocked = false;
            for (let i = 0; i < block.length; i++) {
                const col = block.axis === 'horizontal' ? block.col + i + dx * step : block.col + dx * step;
                const row = block.axis === 'horizontal' ? block.row + dy * step : block.row + i + dy * step;
                if (col < 0 || col >= cols || row < 0 || row >= rows) {
                    blocked = true;
                    break;
                }
                const occupant = grid[row][col];
                if (occupant !== 0 && occupant !== block.id) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) {
                break;
            }
            shift = step;
        }
        return shift;
    }

    private static buildGrid(cols: number, rows: number, blocks: BlockModel[]): number[][] {
        const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
        blocks.forEach((block) => {
            for (let i = 0; i < block.length; i++) {
                const col = block.axis === 'horizontal' ? block.col + i : block.col;
                const row = block.axis === 'horizontal' ? block.row : block.row + i;
                grid[row][col] = block.id;
            }
        });
        return grid;
    }

    private static applyMove(blocks: BlockModel[], move: LegalMove): BlockModel[] {
        return blocks.map((block) => {
            if (block.id !== move.blockId) {
                return block;
            }
            return { ...block, col: block.col + move.dx * move.shift, row: block.row + move.dy * move.shift };
        });
    }

    // Порядок блоков в snapshot.blocks фиксирован вызывающим кодом и сохраняется через applyMove()
    // (map, не reorder), поэтому ключ — просто позиции по порядку; id/axis/length не меняются между
    // состояниями одного BFS, кодировать их избыточно.
    // Один символ на блок — линейный индекс его якорной ячейки (row * cols + col). Индекс всегда
    // меньше cols*rows, т.е. заведомо укладывается в валидный char code при любом размере поля, и
    // отдельная разделяющая запятая между блоками не нужна: ширина символа фиксирована. Раньше ключ
    // собирался как map(...).join('|') и выделял на каждое состояние BFS массив строк плюс результат;
    // теперь остаётся одна строка.
    private static encode(blocks: BlockModel[], cols: number): string {
        let key = '';
        for (const block of blocks) {
            key += String.fromCharCode(block.row * cols + block.col);
        }
        return key;
    }
}
