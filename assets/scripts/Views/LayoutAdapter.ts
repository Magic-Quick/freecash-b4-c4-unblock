import { _decorator, Component, view, screen, Camera, Node, Widget, UITransform, Vec3, Size } from 'cc';

const { ccclass, property } = _decorator;

// Дизайн-разрешение проекта (Project Settings, AGENTS.md §1) — единственная точка правды для формул
// ниже, чтобы не разойтись с настройкой движка, если её когда-нибудь поменяют.
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
// Паддинг платы в portrait — расстояние от края GameplayLayer до края видимой области по ширине.
// Текущая плата (DESIGN_UPDATE_PLAN.md §2, ревизия 4): Board_full.png 755×679 натянута на
// contentSize 640×600 на канвасе 720×1280, т.е. (720 - 640) / 2 = 40, соотношение 40/720.
// BOARD_MARGIN_RATIO сам по себе нигде не пересчитывается кодом — portrait-геометрия платы берётся из
// авторской позиции сцены (captureBaseline); константа документирует происхождение BOARD_WIDTH_DESIGN.
// В landscape этот паддинг больше не переносится напрямую на высоту (QA-фикс наезда платы на bottomBar)
// — см. LANDSCAPE_BOARD_TOP_MARGIN/_BOTTOM_GAP ниже, у которых теперь своя, независимая от
// BOARD_MARGIN_RATIO формула.
const BOARD_WIDTH_DESIGN = 640;
const BOARD_MARGIN_RATIO = (DESIGN_WIDTH - BOARD_WIDTH_DESIGN) / 2 / DESIGN_WIDTH;
// Итерация 4 (по запросу владельца): не высчитываем "ширину колонки" под конкретный aspect ratio —
// на телефоне и планшете landscape выглядит по-разному (у планшета aspect ближе к 4:3, у телефона
// может доходить до ~2:1), а фиксированный паддинг в дизайн-единицах работает одинаково хорошо на обоих,
// т.к. и так пересчитывается через уже существующую формулу visibleHalfWidth/orthoHeight ниже.
const LANDSCAPE_BOARD_LEFT_PADDING = 40;
const LANDSCAPE_HUD_LEFT_PADDING = 650;
// Landscape vertical budget for boardArea (QA-фикс: увеличенная плата наезжала на bottomBar — плата
// центрировалась в (0,0) на полную дизайн-высоту 1280, игнорируя фиксированную полосу бара внизу экрана).
// В landscape сверху экрана ничего нет (HUD ушёл в левую колонку), поэтому верхний отступ — небольшой
// фиксированный инсет; нижний — обязан оставить видимый зазор до верхнего края bottomBar (тот остаётся на
// своей portrait-позиции и в landscape, см. applyLayout — истинный нижний край экрана в landscape всегда
// ровно -DESIGN_HEIGHT/2, тот же ноль отсчёта, от которого автор изначально разместил бар в portrait).
const LANDSCAPE_BOARD_TOP_MARGIN = 40;
const LANDSCAPE_BOARD_BOTTOM_GAP = 40;
// HUD-панели в дизайне мелкие относительно освободившегося в landscape пространства — владелец попросил
// визуально укрупнить. Масштабируем весь hudLayer целиком (не каждую панель по отдельности) — так
// вместе с размером панелей пропорционально растёт и интервал между ними, без отдельной константы spacing.
const LANDSCAPE_HUD_SCALE = 1.5;

// Portrait/landscape adaptive layout (IMPLEMENTATION_PHASES.md §Фаза 3 п.6, трижды доработано в Фазе 6 —
// подробная история итераций 1–2 (зум → леттербокс-полосы → orthoHeight без полос) в
// IMPLEMENTATION_PHASES.md). Итерация 3 (текущая) — по прямому запросу владельца: убрать остаточную
// полосу в portrait (единой cover-fit формулой для фона, той же что и раньше давала бы полосы) и
// реализовать реальную landscape-композицию: фон растягивается по ширине и обрезается по высоте (cover),
// плата увеличивается (паддинг по бокам в portrait становится паддингом сверху/снизу в landscape), HUD
// перестраивается в колонку слева.
//
// Механика: `boardArea` — обёртка над GameplayLayer/TutorialLayer/FxLayer (Фаза 6, реструктуризация
// сцены), масштабируется и двигается как единое целое, чтобы CellsContainer/BlocksContainer/TutorialFinger/
// MoneyFountain остались в одной системе координат друг с другом. Portrait-позиции/размеры HUD, фона и
// boardArea читаются из сцены ОДИН раз в onLoad (до первого applyLayout) и используются как база для
// восстановления при возврате в portrait — не дублируем их числами в коде.
@ccclass('LayoutAdapter')
export class LayoutAdapter extends Component {
    @property(Camera)
    public camera: Camera | null = null;

    @property(Node)
    public backgroundNode: Node | null = null;

    @property(Node)
    public boardArea: Node | null = null;

    @property(Node)
    public gameplayLayer: Node | null = null;

    @property(Node)
    public hudLayer: Node | null = null;

    @property(Node)
    public hudLevelPanel: Node | null = null;

    @property(Node)
    public hudMovesPanel: Node | null = null;

    // Нижний бар (4 кнопки) и дисклеймер — фиксированный "chrome" внизу экрана, не часть платы/HUD
    // (DESIGN_UPDATE_PLAN.md §5 Шаг 4.8, §8.1). Оба живут прямо под SafeArea, не внутри hudLayer.
    @property(Node)
    public bottomBar: Node | null = null;

    @property(Node)
    public disclaimer: Node | null = null;

    private readonly _onResize = this.onResize.bind(this);

    // Portrait-база, захваченная один раз из сцены (см. captureBaseline).
    private backgroundSize = new Size(DESIGN_WIDTH, DESIGN_HEIGHT);
    private boardAreaPos = new Vec3();
    private gameplayLayerWidth = 0;
    private gameplayLayerHeight = 0;
    private hudLayerPos = new Vec3();
    private hudLevelPanelPos = new Vec3();
    private hudMovesPanelPos = new Vec3();
    private bottomBarPos = new Vec3();
    private disclaimerPos = new Vec3();
    // Верхний край bottomBar на его portrait-позиции (та же и в landscape — см. LANDSCAPE_BOARD_TOP_MARGIN
    // выше) — используется как нижняя граница вертикального бюджета платы в landscape.
    private bottomBarTopY = 0;

    protected onLoad(): void {
        this.captureBaseline();
        // Widget пересчитывал бы HUD/фон каждый кадр и конфликтовал с ручным layout ниже — с этого
        // момента и portrait, и landscape целиком ведёт этот компонент.
        this.disableWidget(this.backgroundNode);
        this.disableWidget(this.hudLayer);
        view.on('canvas-resize', this._onResize, this);
        this.applyLayout();
    }

    protected onDestroy(): void {
        view.off('canvas-resize', this._onResize, this);
    }

    private onResize(): void {
        this.applyLayout();
    }

    private captureBaseline(): void {
        const bgTransform = this.backgroundNode?.getComponent(UITransform);
        if (bgTransform) {
            this.backgroundSize = bgTransform.contentSize.clone();
        }
        if (this.boardArea) {
            this.boardAreaPos = this.boardArea.position.clone();
        }
        const gameplayTransform = this.gameplayLayer?.getComponent(UITransform);
        if (gameplayTransform) {
            this.gameplayLayerWidth = gameplayTransform.contentSize.width;
            this.gameplayLayerHeight = gameplayTransform.contentSize.height;
        }
        if (this.hudLayer) {
            this.hudLayerPos = this.hudLayer.position.clone();
        }
        if (this.hudLevelPanel) {
            this.hudLevelPanelPos = this.hudLevelPanel.position.clone();
        }
        if (this.hudMovesPanel) {
            this.hudMovesPanelPos = this.hudMovesPanel.position.clone();
        }
        if (this.bottomBar) {
            this.bottomBarPos = this.bottomBar.position.clone();
            const bottomBarTransform = this.bottomBar.getComponent(UITransform);
            this.bottomBarTopY = this.bottomBarPos.y + (bottomBarTransform?.contentSize.height ?? 0) / 2;
        }
        if (this.disclaimer) {
            this.disclaimerPos = this.disclaimer.position.clone();
        }
    }

    private disableWidget(node: Node | null): void {
        const widget = node?.getComponent(Widget);
        if (widget) {
            widget.enabled = false;
        }
    }

    private applyLayout(): void {
        const windowSize = screen.windowSize;
        if (windowSize.width <= 0 || windowSize.height <= 0) {
            return;
        }
        const screenAspect = windowSize.width / windowSize.height;
        const isLandscape = windowSize.width > windowSize.height;

        // Камера: landscape не меняет базовые 640 (лишняя ширина открывает больше фона), узкие экраны
        // (aspect уже дизайна) увеличивают orthoHeight, чтобы ничего не обрезалось по ширине.
        if (this.camera) {
            this.camera.orthoHeight = Math.max(DESIGN_HEIGHT / 2, DESIGN_WIDTH / 2 / screenAspect);
        }
        // Реально видимая половина высоты в мировых единицах — то же значение, что и orthoHeight выше.
        const visibleHalfHeight = this.camera?.orthoHeight ?? DESIGN_HEIGHT / 2;
        const visibleHalfWidth = visibleHalfHeight * screenAspect;

        // Фон — единая cover-fit формула для ОБЕИХ ориентаций: растягивается по большей из двух осей,
        // вторая переполняется за экран (обрезается), полос быть не может ни при каком aspect ratio.
        if (this.backgroundNode) {
            const coverScale = Math.max(
                (visibleHalfWidth * 2) / this.backgroundSize.width,
                (visibleHalfHeight * 2) / this.backgroundSize.height,
            );
            this.backgroundNode.setScale(coverScale, coverScale, 1);
            this.backgroundNode.setPosition(0, 0, 0);
        }

        // Нижний бар и дисклеймер — та же portrait-позиция в обеих ориентациях (DESIGN_UPDATE_PLAN.md
        // §8.1/§5 Шаг 4.8). В landscape камера держит orthoHeight = DESIGN_HEIGHT/2 (см. выше — для
        // landscape 360/screenAspect всегда < 640), т.е. видимая высота равна дизайн-канвасу так же, как
        // и в portrait с "родным" 9:16 — авторская позиция остаётся у нижнего края без досчёта. На более
        // высоких, чем 9:16, portrait-экранах открывается дополнительное поле сверху/снизу (как и у
        // остальных элементов ниже) — бар/дисклеймер при этом просто не касаются самого края, что не
        // ломает требование «всегда видимы» (GDD §3, план §8.1).
        this.bottomBar?.setPosition(this.bottomBarPos);
        this.disclaimer?.setPosition(this.disclaimerPos);

        if (isLandscape) {
            this.applyLandscape(visibleHalfWidth);
        } else {
            this.applyPortrait();
        }
    }

    private applyPortrait(): void {
        this.boardArea?.setScale(1, 1, 1);
        this.boardArea?.setPosition(this.boardAreaPos);
        if (this.hudLayer) {
            this.hudLayer.setPosition(this.hudLayerPos);
            this.hudLayer.setScale(1, 1, 1);
        }
        this.hudLevelPanel?.setPosition(this.hudLevelPanelPos);
        this.hudMovesPanel?.setPosition(this.hudMovesPanelPos);
    }

    // Итерация 4 (по запросу владельца): не резервируем отдельную "ширину HUD-колонки" — плата просто
    // получает небольшой фиксированный отступ слева (LANDSCAPE_BOARD_LEFT_PADDING) и использует всё
    // остальное пространство; HUD висит у левого края с собственным (независимым) отступом и увеличенным
    // масштабом для читаемости. Оба паддинга — фиксированные дизайн-единицы, поэтому одинаково работают
    // и на "вытянутом" телефонном landscape, и на более квадратном планшетном — без отдельной ветки под
    // класс устройства: пересчёт всё равно идёт через уже адаптивный visibleHalfWidth ниже.
    private applyLandscape(visibleHalfWidth: number): void {
        if (this.boardArea && this.gameplayLayerHeight > 0 && this.gameplayLayerWidth > 0) {
            // Вертикальный бюджет платы фиксирован (зависит только от ориентации, не от текущего aspect
            // ratio — visibleHalfHeight в landscape всегда 640, см. applyLayout), но, в отличие от старой
            // симметричной формулы, границы не равны: сверху — только небольшой инсет (нечем перекрывать),
            // снизу — обязательный зазор до bottomBar (см. LANDSCAPE_BOARD_TOP_MARGIN/_BOTTOM_GAP выше).
            const topY = DESIGN_HEIGHT / 2 - LANDSCAPE_BOARD_TOP_MARGIN;
            const bottomY = this.bottomBarTopY + LANDSCAPE_BOARD_BOTTOM_GAP;
            const availableHeight = topY - bottomY;
            const scale = availableHeight / this.gameplayLayerHeight;
            this.boardArea.setScale(scale, scale, 1);
            // Левый край платы — ровно LANDSCAPE_BOARD_LEFT_PADDING от левого края экрана.
            const boardHalfWidth = (this.gameplayLayerWidth / 2) * scale;
            this.boardArea.setPosition(0, (topY + bottomY) / 2, 0);
        }
        if (this.hudLayer) {
            this.hudLayer.setPosition(0 - LANDSCAPE_HUD_LEFT_PADDING, 0, 0);
            this.hudLayer.setScale(LANDSCAPE_HUD_SCALE, LANDSCAPE_HUD_SCALE, 1);
        }
        // Колонка: LevelPanel сверху, MovesPanel (декор) — снизу. Локальные позиции внутри hudLayer не
        // меняются — интервал между панелями растёт вместе с масштабом hudLayer выше, отдельная константа
        // spacing не нужна.
        this.hudLevelPanel?.setPosition(0, 200, 0);
        this.hudMovesPanel?.setPosition(0, 0, 0);
    }
}
