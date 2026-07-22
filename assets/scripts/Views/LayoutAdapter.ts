import { _decorator, Component, view, screen, Camera, Node, Widget, UITransform, Vec3, Size } from 'cc';

const { ccclass, property } = _decorator;

// Дизайн-разрешение проекта (Project Settings, AGENTS.md §1) — единственная точка правды для формул
// ниже, чтобы не разойтись с настройкой движка, если её когда-нибудь поменяют.
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
// Паддинг платы в portrait — расстояние от края GameplayLayer до края видимой области по ширине
// (720 - 680) / 2 = 20, т.е. соотношение 20/720. В landscape та же пропорция переносится на высоту
// (Фаза 6, по запросу владельца: "боковые паддинги становятся вертикальными").
const BOARD_MARGIN_RATIO = (DESIGN_WIDTH - 680) / 2 / DESIGN_WIDTH;
// Итерация 4 (по запросу владельца): не высчитываем "ширину колонки" под конкретный aspect ratio —
// на телефоне и планшете landscape выглядит по-разному (у планшета aspect ближе к 4:3, у телефона
// может доходить до ~2:1), а фиксированный паддинг в дизайн-единицах работает одинаково хорошо на обоих,
// т.к. и так пересчитывается через уже существующую формулу visibleHalfWidth/orthoHeight ниже.
const LANDSCAPE_BOARD_LEFT_PADDING = 40;
const LANDSCAPE_HUD_LEFT_PADDING = 650;
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

    @property(Node)
    public hudCoinCounter: Node | null = null;

    private readonly _onResize = this.onResize.bind(this);

    // Portrait-база, захваченная один раз из сцены (см. captureBaseline).
    private backgroundSize = new Size(DESIGN_WIDTH, DESIGN_HEIGHT);
    private boardAreaPos = new Vec3();
    private gameplayLayerWidth = 0;
    private gameplayLayerHeight = 0;
    private hudLayerPos = new Vec3();
    private hudLevelPanelPos = new Vec3();
    private hudMovesPanelPos = new Vec3();
    private hudCoinCounterPos = new Vec3();

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
        if (this.hudCoinCounter) {
            this.hudCoinCounterPos = this.hudCoinCounter.position.clone();
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
        this.hudCoinCounter?.setPosition(this.hudCoinCounterPos);
    }

    // Итерация 4 (по запросу владельца): не резервируем отдельную "ширину HUD-колонки" — плата просто
    // получает небольшой фиксированный отступ слева (LANDSCAPE_BOARD_LEFT_PADDING) и использует всё
    // остальное пространство; HUD висит у левого края с собственным (независимым) отступом и увеличенным
    // масштабом для читаемости. Оба паддинга — фиксированные дизайн-единицы, поэтому одинаково работают
    // и на "вытянутом" телефонном landscape, и на более квадратном планшетном — без отдельной ветки под
    // класс устройства: пересчёт всё равно идёт через уже адаптивный visibleHalfWidth ниже.
    private applyLandscape(visibleHalfWidth: number): void {
        if (this.boardArea && this.gameplayLayerHeight > 0 && this.gameplayLayerWidth > 0) {
            // Видимая высота в landscape не меняется относительно базовых 640×2=1280 (см. applyLayout) —
            // доступное вертикальное место фиксировано, поэтому масштаб платы тоже фиксирован (зависит
            // только от ориентации, не от текущего aspect ratio).
            const availableHeight = DESIGN_HEIGHT * (1 - 2 * BOARD_MARGIN_RATIO);
            const scale = availableHeight / this.gameplayLayerHeight;
            this.boardArea.setScale(scale, scale, 1);
            // Левый край платы — ровно LANDSCAPE_BOARD_LEFT_PADDING от левого края экрана.
            const boardHalfWidth = (this.gameplayLayerWidth / 2) * scale;
            this.boardArea.setPosition(0, 0, 0);
        }
        if (this.hudLayer) {
            this.hudLayer.setPosition(0 - LANDSCAPE_HUD_LEFT_PADDING, 0, 0);
            this.hudLayer.setScale(LANDSCAPE_HUD_SCALE, LANDSCAPE_HUD_SCALE, 1);
        }
        // Колонка: LevelPanel сверху, CoinCounter снизу, MovesPanel (декор) — между ними. Локальные
        // позиции внутри hudLayer не меняются — интервал между панелями растёт вместе с масштабом
        // hudLayer выше, отдельная константа spacing не нужна.
        this.hudLevelPanel?.setPosition(0, 200, 0);
        this.hudMovesPanel?.setPosition(0, 0, 0);
        this.hudCoinCounter?.setPosition(0, -200, 0);
    }
}
