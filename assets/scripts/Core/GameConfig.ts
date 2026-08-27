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

    @property({ type: Size, tooltip: 'Размер текстуры Board_full.png, px (координаты текстуры, DESIGN_UPDATE_PLAN.md §2)' })
    public boardTextureSize: Size = new Size(755, 679);

    // Фактический экранный габарит BoardFrame в design-units (640×600 — contentSize ноды BoardFrame,
    // расставленной автором вручную, DESIGN_UPDATE_PLAN.md §2). Плата отрисована на канвасе меньше,
    // чем её исходная текстура (755×679 px), поэтому все геометрические измерения, снятые с текстуры
    // (boardInner*/exitNotch*), нужно проецировать в design-units через scaleX/scaleY, прежде чем
    // отдавать их View'ам как позиции/размеры (см. colPitch/rowPitch/gridOrigin* ниже).
    @property({ type: Size, tooltip: 'Экранный габарит платы, design-units (contentSize BoardFrame)' })
    public boardDesignSize: Size = new Size(640, 600);

    @property({ tooltip: 'Левая граница внутреннего поля платы, px в координатах текстуры' })
    public boardInnerLeft = 32;

    @property({ tooltip: 'Верхняя граница внутреннего поля платы, px в координатах текстуры' })
    public boardInnerTop = 29;

    @property({ tooltip: 'Правая граница внутреннего поля платы, px в координатах текстуры' })
    public boardInnerRight = 663;

    @property({ tooltip: 'Нижняя граница внутреннего поля платы, px в координатах текстуры' })
    public boardInnerBottom = 649;

    @property({ tooltip: 'Левый край кармана выхода от левого края текстуры платы, px (DESIGN_UPDATE_PLAN.md §2)' })
    public exitNotchOffsetX = 664;

    @property({ tooltip: 'Ширина кармана выхода, px (DESIGN_UPDATE_PLAN.md §2)' })
    public exitNotchWidth = 65;

    @property({ tooltip: 'Число доступных подсказок за уровень' })
    public hintCount = 2;

    @property({ tooltip: 'Рекордное число ходов, показывается в HUD как декор (DESIGN_UPDATE_PLAN.md §8.5 — не меняем)' })
    public movesRecord = 52;

    @property({ tooltip: 'Пауза между EVT_LEVEL_SOLVED и EVT_REQUEST_CTA, сек (DESIGN_UPDATE_PLAN.md §4.2)' })
    public winFxDuration = 0.6;

    // Масштаб текстура→экран по X/Y (boardDesignSize / boardTextureSize, §2). Раздельные scaleX/scaleY,
    // а не единый uniform-коэффициент: Board_full.png (755×679, аспект 1.112) вписан в ноду 640×600
    // (аспект 1.067), т.е. плата на канвасе слегка сжата по X относительно Y — единый коэффициент
    // увёл бы сетку от нарисованных линий по одной из осей.
    // Sprite стоит в sizeMode=CUSTOM/trimmedMode=false, поэтому на contentSize ноды натянут ПОЛНЫЙ
    // raw-габарит текстуры (755×679), а не обрезанный rect спрайт-фрейма — проекция ниже верна.
    private get scaleX(): number {
        return this.boardDesignSize.width / this.boardTextureSize.width;
    }

    private get scaleY(): number {
        return this.boardDesignSize.height / this.boardTextureSize.height;
    }

    // Ширина ячейки поля, design-units (§2: (boardInnerRight - boardInnerLeft) / gridCols * scaleX ≈ 89.2).
    // Геттер, не поле — не должен разъехаться с inner rect. Шаг равномерный, хотя нарисованные на
    // Board_full.png линии колонок неравномерны (109/109/109/110/96/95 px: художник поджал две правые
    // колонки, освобождая место под карман выхода). Держим равномерную сетку и совмещаем её с рамкой по
    // краям inner rect — так блоки встают вплотную к стенкам; расхождение с внутренними линиями ≤18 px
    // текстуры (≈15 design-units) на линии №4, а сами линии контрастны лишь на ~4% и блоками перекрыты.
    public get colPitch(): number {
        return ((this.boardInnerRight - this.boardInnerLeft) / this.gridCols) * this.scaleX;
    }

    /** Высота ячейки поля, design-units (§2: (boardInnerBottom - boardInnerTop) / gridRows * scaleY ≈ 91.3). Геттер, не поле — не должен разъехаться с inner rect. */
    public get rowPitch(): number {
        return ((this.boardInnerBottom - this.boardInnerTop) / this.gridRows) * this.scaleY;
    }

    // Левый/верхний край внутреннего поля платы в design-units, отсчитанный ОТ ЦЕНТРА ноды BoardFrame
    // (у неё anchorPoint 0.5/0.5, и BlocksContainer/Board стоят в той же точке сцены — см. SCENE_SETUP.md).
    // Раньше View'ы считали этот сдвиг как -(gridCols*colPitch)/2, т.е. молча предполагали, что поле
    // отцентровано в текстуре. Для Board_full.png это уже неверно: карман выхода запечён в правую часть
    // текстуры, поэтому поле смещено влево (поля 32 px слева против 92 px справа). Origin считается прямо
    // из inner rect, а не из ширины сетки, — единственная точка, где живёт эта асимметрия.
    public get gridOriginX(): number {
        return (this.boardInnerLeft - this.boardTextureSize.width / 2) * this.scaleX;
    }

    /** Верхний край внутреннего поля платы, design-units от центра BoardFrame (ось Y вверх, текстурная — вниз). */
    public get gridOriginY(): number {
        return (this.boardTextureSize.height / 2 - this.boardInnerTop) * this.scaleY;
    }

    // Смещение центра кармана выхода от левого края inner rect платы, design-units (§2). Считает всю
    // формулу (exitNotchOffsetX + exitNotchWidth/2 - boardInnerLeft) в текстурных px и затем проецирует
    // её через scaleX разом — так BoardView.positionExit() складывает её с уже design-unit gridOriginX,
    // не смешивая единицы измерения самостоятельно.
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
