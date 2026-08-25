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
// свайпом, иначе подскажет ход, который нельзя повторить. Доска 6×6 ≈ 1.2k достижимых состояний —
// BFS отрабатывает мгновенно.
export class BoardSolver {
    // Первый ход кратчайшего (оптимального) решения из snapshot. Возвращает null, если коридор
    // главного блока к выходу уже свободен — в этом случае хода не требуется и подсказку расходовать
    // нельзя (§3.3) — либо если раскладка недостижимо решаема из этого состояния (на раскладке,
    // проверенной tools/solve_levels.py, не должно происходить).
    public static solve(snapshot: BoardSnapshot): SolverMove | null {
        const { cols, rows, exitRow } = snapshot;
        const startBlocks = snapshot.blocks.map((block) => ({ ...block }));
        if (BoardSolver.isSolved(cols, rows, exitRow, startBlocks)) {
            return null;
        }

        const visited = new Set<string>([BoardSolver.encode(startBlocks)]);
        const queue: { blocks: BlockModel[]; firstMove: SolverMove }[] = [];

        BoardSolver.legalMoves(cols, rows, startBlocks).forEach((move) => {
            const nextBlocks = BoardSolver.applyMove(startBlocks, move);
            const key = BoardSolver.encode(nextBlocks);
            if (visited.has(key)) {
                return;
            }
            visited.add(key);
            // fromCell/toCell берутся здесь же, на единственном месте, где известны и стартовый блок
            // (startBlocks), и его позиция после сдвига (nextBlocks) — дальше по BFS firstMove просто
            // переносится без изменений до найденного решения.
            const startBlock = startBlocks.find((block) => block.id === move.blockId) as BlockModel;
            const movedBlock = nextBlocks.find((block) => block.id === move.blockId) as BlockModel;
            queue.push({
                blocks: nextBlocks,
                firstMove: {
                    blockId: move.blockId,
                    dir: move.dir,
                    fromCell: { col: startBlock.col, row: startBlock.row },
                    toCell: { col: movedBlock.col, row: movedBlock.row },
                },
            });
        });

        let head = 0;
        while (head < queue.length) {
            const current = queue[head];
            head++;
            if (BoardSolver.isSolved(cols, rows, exitRow, current.blocks)) {
                return current.firstMove;
            }
            BoardSolver.legalMoves(cols, rows, current.blocks).forEach((move) => {
                const nextBlocks = BoardSolver.applyMove(current.blocks, move);
                const key = BoardSolver.encode(nextBlocks);
                if (visited.has(key)) {
                    return;
                }
                visited.add(key);
                queue.push({ blocks: nextBlocks, firstMove: current.firstMove });
            });
        }

        return null;
    }

    // Коридор главного блока к правому выходу свободен, если все ячейки exitRow от правого края
    // главного блока до края поля пусты — то же условие, что BoardSystem.computeMainClear().
    private static isSolved(cols: number, rows: number, exitRow: number, blocks: BlockModel[]): boolean {
        const main = blocks.find((block) => block.isMain);
        if (!main) {
            return false;
        }
        const grid = BoardSolver.buildGrid(cols, rows, blocks);
        for (let col = main.col + main.length; col < cols; col++) {
            if (grid[exitRow][col] !== 0) {
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
    private static encode(blocks: BlockModel[]): string {
        return blocks.map((block) => `${block.col},${block.row}`).join('|');
    }
}
