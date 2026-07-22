import { _decorator, Component, JsonAsset } from 'cc';

const { ccclass, property } = _decorator;

// Единственный источник тюнинговых чисел проекта (AGENTS.md §3). Системы и Views обязаны читать
// значения отсюда — дублирующий числовой литерал в другом файле считается нарушением контракта.
@ccclass('GameConfig')
export class GameConfig extends Component {
    @property({ tooltip: 'Ширина игрового поля, ячеек' })
    public gridCols = 6;

    @property({ tooltip: 'Высота игрового поля, ячеек' })
    public gridRows = 6;

    @property({ tooltip: 'Размер одной ячейки, px' })
    public cellSize = 96;

    @property({ tooltip: 'Зазор между ячейками, px' })
    public cellSpacing = 6;

    @property({ tooltip: 'Награда FC за уровень 1' })
    public level1Reward = 9;

    @property({ tooltip: 'Награда FC за уровень 2 (итого 19 FC с level1Reward)' })
    public level2Reward = 10;

    @property({ tooltip: 'Порог распознавания свайпа, px' })
    public swipeMinDistance = 30;

    @property({ tooltip: 'Длительность слайда блока при ходе, сек' })
    public blockSlideDuration = 0.18;

    @property({ tooltip: 'Длительность автопроезда главного блока к выходу, сек' })
    public mainDriveDuration = 0.7;

    @property({ tooltip: 'Длительность полёта монет к счётчику, сек' })
    public coinFlyDuration = 0.6;

    @property({ type: JsonAsset, tooltip: 'Раскладки уровней L1/L2 — assets/data/levels.json' })
    public levelsData: JsonAsset | null = null;

    @property({ tooltip: 'Минимальный интервал между повторными block_slide SFX, сек (гасит спам быстрых свайпов)' })
    public sfxBlockSlideMinInterval = 0.15;

    @property({ tooltip: 'Минимальный интервал между повторными block_blocked SFX, сек' })
    public sfxBlockBlockedMinInterval = 0.2;
}
