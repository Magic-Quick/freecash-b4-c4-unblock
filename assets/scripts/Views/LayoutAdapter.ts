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
// Ширина HUD-колонки в landscape — подобрана под ширину LevelPanel/CoinCounter (160/80px) с запасом.
const LANDSCAPE_HUD_COLUMN_WIDTH = 200;

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
    private gameplayLayerHeight = 0;
    private hudLayerPos = new Vec3();
    private hudLayerSize = new Size(DESIGN_WIDTH, 0);
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
            this.gameplayLayerHeight = gameplayTransform.contentSize.height;
        }
        if (this.hudLayer) {
            this.hudLayerPos = this.hudLayer.position.clone();
            const hudTransform = this.hudLayer.getComponent(UITransform);
            if (hudTransform) {
                this.hudLayerSize = hudTransform.contentSize.clone();
            }
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
            this.hudLayer.getComponent(UITransform)?.setContentSize(this.hudLayerSize);
        }
        this.hudLevelPanel?.setPosition(this.hudLevelPanelPos);
        this.hudMovesPanel?.setPosition(this.hudMovesPanelPos);
        this.hudCoinCounter?.setPosition(this.hudCoinCounterPos);
    }

    // Владелец: "плата увеличивается, боковые паддинги в portrait становятся вертикальными в landscape,
    // HUD перестраивается в колонку слева" (Фаза 6). Видимая высота в landscape не меняется относительно
    // базовых 640×2=1280 (см. applyLayout) — доступное вертикальное место фиксировано, поэтому масштаб
    // платы тоже фиксирован (не зависит от текущего aspect, зависит только от ориентации).
    private applyLandscape(visibleHalfWidth: number): void {
        if (this.boardArea && this.gameplayLayerHeight > 0) {
            const availableHeight = DESIGN_HEIGHT * (1 - 2 * BOARD_MARGIN_RATIO);
            const scale = availableHeight / this.gameplayLayerHeight;
            this.boardArea.setScale(scale, scale, 1);
            // Плата уходит вправо от HUD-колонки, центрируясь в оставшейся ширине.
            this.boardArea.setPosition(LANDSCAPE_HUD_COLUMN_WIDTH / 2, 0, 0);
        }
        if (this.hudLayer) {
            this.hudLayer.setPosition(-visibleHalfWidth + LANDSCAPE_HUD_COLUMN_WIDTH / 2, 0, 0);
            this.hudLayer.getComponent(UITransform)?.setContentSize(LANDSCAPE_HUD_COLUMN_WIDTH, DESIGN_HEIGHT);
        }
        // Колонка: LevelPanel сверху, CoinCounter снизу, MovesPanel (декор) — между ними.
        this.hudLevelPanel?.setPosition(0, 350, 0);
        this.hudMovesPanel?.setPosition(0, 0, 0);
        this.hudCoinCounter?.setPosition(0, -350, 0);
    }
}
