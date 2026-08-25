import { _decorator, Component, JsonAsset, Size } from 'cc';

const { ccclass, property } = _decorator;

// Единственный источник тюнинговых чисел проекта (AGENTS.md §3). Системы и Views обязаны читать
// значения отсюда — дублирующий числовой литерал в другом файле считается нарушением контракта.
@ccclass('GameConfig')
export class GameConfig extends Component {
    @property({ tooltip: 'Ширина игрового поля, ячеек' })
    public gridCols = 6;

    @property({ tooltip: 'Высота игрового поля, ячеек' })
    public gridRows = 6;

    @property({ type: Size, tooltip: 'Размер текстуры board.png, px (координаты текстуры, DESIGN_UPDATE_PLAN.md §2)' })
    public boardTextureSize: Size = new Size(718, 679);

    // Фактический экранный габарит BoardFrame в design-units (552×522, DESIGN_UPDATE_PLAN.md §2) —
    // плата отрисована на канвасе меньше, чем её исходная текстура (718×679 px), поэтому все геометрические
    // измерения, снятые с текстуры (boardInner*/exitNotch*), нужно проецировать в design-units через
    // scaleX/scaleY, прежде чем отдавать их View'ам как позиции/размеры (см. colPitch/rowPitch ниже).
    @property({ type: Size, tooltip: 'Экранный габарит платы, design-units (DESIGN_UPDATE_PLAN.md §2, contentSize BoardFrame)' })
    public boardDesignSize: Size = new Size(552, 522);

    @property({ tooltip: 'Левая граница внутреннего поля платы, px в координатах текстуры' })
    public boardInnerLeft = 31;

    @property({ tooltip: 'Верхняя граница внутреннего поля платы, px в координатах текстуры' })
    public boardInnerTop = 28;

    @property({ tooltip: 'Правая граница внутреннего поля платы, px в координатах текстуры' })
    public boardInnerRight = 686;

    @property({ tooltip: 'Нижняя граница внутреннего поля платы, px в координатах текстуры' })
    public boardInnerBottom = 650;

    @property({ tooltip: 'Смещение выреза выхода от левого края текстуры платы, px (DESIGN_UPDATE_PLAN.md §2)' })
    public exitNotchOffsetX = 661;

    @property({ tooltip: 'Ширина выреза выхода, px (DESIGN_UPDATE_PLAN.md §2)' })
    public exitNotchWidth = 93;

    @property({ tooltip: 'Число доступных подсказок за уровень' })
    public hintCount = 2;

    @property({ tooltip: 'Рекордное число ходов, показывается в HUD как декор (DESIGN_UPDATE_PLAN.md §8.5 — не меняем)' })
    public movesRecord = 52;

    @property({ tooltip: 'Пауза между EVT_LEVEL_SOLVED и EVT_REQUEST_CTA, сек (DESIGN_UPDATE_PLAN.md §4.2)' })
    public winFxDuration = 0.6;

    // Масштаб текстура→экран по X/Y (boardDesignSize / boardTextureSize, §2). Раздельные scaleX/scaleY,
    // а не единый uniform-коэффициент: измерения board.png дают ≈0.7688 по обеим осям (практически
    // aspect-preserving), но не бит-в-бит равны, а колонки/строки платы не квадратные — единый
    // коэффициент округлил бы одну из осей.
    private get scaleX(): number {
        return this.boardDesignSize.width / this.boardTextureSize.width;
    }

    private get scaleY(): number {
        return this.boardDesignSize.height / this.boardTextureSize.height;
    }

    /** Ширина ячейки поля, design-units (§2: (boardInnerRight - boardInnerLeft) / gridCols * scaleX ≈ 83.9). Геттер, не поле — не должен разъехаться с inner rect. */
    public get colPitch(): number {
        return ((this.boardInnerRight - this.boardInnerLeft) / this.gridCols) * this.scaleX;
    }

    /** Высота ячейки поля, design-units (§2: (boardInnerBottom - boardInnerTop) / gridRows * scaleY ≈ 79.7). Геттер, не поле — не должен разъехаться с inner rect. */
    public get rowPitch(): number {
        return ((this.boardInnerBottom - this.boardInnerTop) / this.gridRows) * this.scaleY;
    }

    // Смещение центра выреза выхода от левого края inner rect платы, design-units (§2). Считает всю
    // формулу (exitNotchOffsetX + exitNotchWidth/2 - boardInnerLeft) в текстурных px и затем проецирует
    // её через scaleX разом — так BoardView.positionExit() складывает её с уже design-unit offsetX
    // (из colPitch), не смешивая единицы измерения самостоятельно.
    public get exitNotchCenterOffsetX(): number {
        return (this.exitNotchOffsetX + this.exitNotchWidth / 2 - this.boardInnerLeft) * this.scaleX;
    }

    @property({ tooltip: 'Длительность слайда блока при ходе, сек' })
    public blockSlideDuration = 0.18;

    @property({ tooltip: 'Длительность автопроезда главного блока к выходу, сек' })
    public mainDriveDuration = 0.7;

    @property({ type: JsonAsset, tooltip: 'Раскладки уровней L1/L2 — assets/data/levels.json' })
    public levelsData: JsonAsset | null = null;

    @property({ tooltip: 'Минимальный интервал между повторными block_slide SFX, сек (гасит спам быстрых свайпов)' })
    public sfxBlockSlideMinInterval = 0.15;

    @property({ tooltip: 'Минимальный интервал между повторными block_blocked SFX, сек' })
    public sfxBlockBlockedMinInterval = 0.2;
}
