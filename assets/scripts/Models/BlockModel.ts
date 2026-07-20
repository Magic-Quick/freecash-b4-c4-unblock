// Форма блока строго соответствует схеме assets/data/levels.json (см. AGENTS.md §3, Фаза 0 handoff).
export type BlockAxis = 'horizontal' | 'vertical';

export interface BlockModel {
    id: number;
    axis: BlockAxis;
    length: number;
    col: number;
    row: number;
    isMain: boolean;
}
