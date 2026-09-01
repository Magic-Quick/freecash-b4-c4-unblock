import { _decorator, Component, view, screen, Camera, Label, Node, Widget, UITransform, Vec3, Size } from 'cc';

const { ccclass, property } = _decorator;

// Дизайн-разрешение проекта (Project Settings, AGENTS.md §1) — единственная точка правды для формул
// ниже, чтобы не разойтись с настройкой движка, если её когда-нибудь поменяют.
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

// Снимок трансформа ноды, снятый один раз в onLoad (до первого applyLayout). Нужен по двум причинам:
// 1) вернуть portrait-раскладку без дублирования авторских координат числами в коде;
// 2) мерить колонки по «чистому» размеру — у кнопок ButtonPressView тви́нит node.scale на нажатии,
//    поэтому читать живой scale во время layout нельзя.
class NodeBaseline {
    public readonly position: Vec3;
    public readonly scale: Vec3;
    public readonly angle: number;
    public readonly width: number;
    public readonly height: number;

    constructor(node: Node) {
        this.position = node.position.clone();
        this.scale = node.scale.clone();
        this.angle = node.angle;
        const transform = node.getComponent(UITransform);
        // Габарит колонки считаем по contentSize с учётом собственного масштаба ноды из сцены
        // (у ChevronNext он 1.2), но БЕЗ поворота: чевron почти квадратный, разница на глаз не видна.
        this.width = (transform?.contentSize.width ?? 0) * Math.abs(this.scale.x);
        this.height = (transform?.contentSize.height ?? 0) * Math.abs(this.scale.y);
    }
}

// Portrait/landscape adaptive layout (IMPLEMENTATION_PHASES.md §Фаза 3 п.6).
//
// Portrait — авторская раскладка сцены один-в-один (позиции читаются из сцены в onLoad, см.
// captureBaseline), меняется только cover-fit фона и orthoHeight камеры на узких экранах.
//
// Landscape — самостоятельная композиция в три колонки (ревизия 5, по запросу владельца):
//   [ HudLayer ]  [ плата на всю высоту экрана ]  [ кнопки BottomBar ]
// HudLayer и BottomBar перестраиваются из горизонтальных рядов в вертикальные, плата растягивается
// на весь вертикальный бюджет экрана и по возможности стоит ровно по центру по X.
//
// Механика: `boardArea` — обёртка над GameplayLayer/TutorialLayer/FxLayer, масштабируется и двигается
// как единое целое, чтобы CellsContainer/BlocksContainer/TutorialFinger/MoneyFountain остались в одной
// системе координат друг с другом. Масштаб платы считается по `boardFrame` (реальный видимый
// прямоугольник платы 640×600), а НЕ по UITransform GameplayLayer (680×760) — тот заметно больше
// содержимого, и подгонка по нему съедала ~20% высоты экрана впустую.
@ccclass('LayoutAdapter')
export class LayoutAdapter extends Component {
    @property(Camera)
    public camera: Camera | null = null;

    @property(Node)
    public backgroundNode: Node | null = null;

    // Фон пэкшота (CTAOverlay/PackshotBg) — та же cover-fit формула, что у backgroundNode, но
    // считается по своему собственному raw-размеру: пэкшот уже единственный слой на CTAOverlay
    // и не участвует в portrait/landscape композиции доски, ему нужен только cover.
    @property(Node)
    public packshotBg: Node | null = null;

    // Пэкшот в landscape — трёхколоночная композиция, как у HUD/платы/BottomBar: Logo слева,
    // PlayButton справа, CenterGroup (YouWon/Gift/Bonus) по центру со scale-to-fit.
    @property(Node)
    public ctaLogo: Node | null = null;

    @property(Node)
    public ctaPlayButton: Node | null = null;

    @property(Node)
    public ctaCenterGroup: Node | null = null;

    // Обёртка платы: её двигаем/масштабируем целиком.
    @property(Node)
    public boardArea: Node | null = null;

    // Видимый прямоугольник платы внутри boardArea — эталон для расчёта масштаба и центровки.
    @property(Node)
    public boardFrame: Node | null = null;

    @property(Node)
    public hudLayer: Node | null = null;

    // Содержимое HUD в порядке СВЕРХУ ВНИЗ для landscape-колонки (в portrait позиции берутся из сцены).
    // Порядок задаётся в инспекторе — менять композицию можно без правки кода.
    @property({ type: [Node], tooltip: 'HUD в landscape: сверху вниз' })
    public hudColumn: Node[] = [];

    // Нижний бар (кнопки) и дисклеймер — фиксированный "chrome", не часть платы/HUD
    // (DESIGN_UPDATE_PLAN.md §5 Шаг 4.8, §8.1). Оба живут прямо под SafeArea, не внутри hudLayer.
    @property(Node)
    public bottomBar: Node | null = null;

    // Кнопки бара в порядке СВЕРХУ ВНИЗ для landscape-колонки.
    @property({ type: [Node], tooltip: 'Кнопки в landscape: сверху вниз' })
    public buttonColumn: Node[] = [];

    @property(Node)
    public disclaimer: Node | null = null;

    // Декоративный чеврон между панелями HUD: в portrait смотрит вправо (панели в ряд), в landscape
    // разворачиваем вниз (панели в колонку).
    @property(Node)
    public chevronNext: Node | null = null;

    // --- Тюнинг landscape (всё в дизайн-единицах, правится в инспекторе) ---

    @property({ tooltip: 'landscape: отступ платы от верха экрана' })
    public landscapeBoardTopMargin = 30;

    @property({ tooltip: 'landscape: зазор платы до дисклеймера/низа экрана' })
    public landscapeBoardBottomMargin = 24;

    @property({ tooltip: 'landscape: отступ боковых колонок от края экрана' })
    public landscapeEdgePadding = 30;

    @property({ tooltip: 'landscape: зазор между платой и боковой колонкой' })
    public landscapeColumnGap = 36;

    @property({ tooltip: 'landscape: вертикальный интервал между панелями HUD (после Logo — landscapeHudLogoGap)' })
    public landscapeHudSpacing = 32;

    @property({ tooltip: 'landscape: зазор именно после Logo, отдельно от интервала между панелями' })
    public landscapeHudLogoGap = 36;

    @property({ tooltip: 'landscape: масштаб колонки HUD' })
    public landscapeHudScale = 1;

    @property({ tooltip: 'landscape: вертикальный интервал между кнопками' })
    public landscapeButtonSpacing = 36;

    @property({ tooltip: 'landscape: масштаб колонки кнопок' })
    public landscapeButtonScale = 1.1;

    @property({ tooltip: 'landscape: поворот чеврона (право → вниз)' })
    public landscapeChevronAngle = -90;

    @property({ tooltip: 'landscape: суммарный запас по ширине экрана для строки Logo–CenterGroup–PlayButton' })
    public landscapeCtaEdgePadding = 60;

    @property({ tooltip: 'landscape: зазор между Logo/PlayButton пэкшота и CenterGroup' })
    public landscapeCtaColumnGap = 40;

    @property({ tooltip: 'landscape: общая горизонталь Logo/PlayButton пэкшота (Y в дизайн-единицах)' })
    public landscapeCtaBaselineY = 0;

    // --- Нижний «подвал» (дисклеймер + бар), обе ориентации ---

    @property({ tooltip: 'Отступ дисклеймера от нижней кромки кадра' })
    public bottomChromeMargin = 40;

    @property({ tooltip: 'Зазор между дисклеймером и нижним баром' })
    public minChromeGap = 16;

    // Кегль дисклеймера зависит от ориентации. В portrait остаётся авторский из сцены: там строка
    // идёт поперёк узкого кадра и читается. В landscape кадр вчетверо шире, строка визуально тонет
    // у нижней кромки — на авторском кегле её практически не видно, поэтому здесь он поднимается.
    @property({ tooltip: 'landscape: кегль дисклеймера (в portrait берётся авторский из сцены)' })
    public landscapeDisclaimerFontSize = 36;

    @property({ tooltip: 'landscape: межстрочный интервал дисклеймера' })
    public landscapeDisclaimerLineHeight = 49;

    @property({ tooltip: 'portrait: зазор платы до шапки' })
    public portraitBoardGap = 20;

    @property({ tooltip: 'portrait: зазор между платой и рядом кнопок (кнопки жёстко следуют за платой)' })
    public portraitBoardBarGap = 20;

    @property({ tooltip: 'portrait: отступ платы от боковых кромок кадра' })
    public portraitBoardSidePadding = 0;

    private readonly _onResize = this.onResize.bind(this);

    // Portrait-база, захваченная один раз из сцены (см. captureBaseline).
    private backgroundSize = new Size(DESIGN_WIDTH, DESIGN_HEIGHT);
    private packshotBgSize = new Size(DESIGN_WIDTH, DESIGN_HEIGHT);
    private boardAreaBase: NodeBaseline | null = null;
    private boardFrameBase: NodeBaseline | null = null;
    // Смещение центра boardFrame относительно начала координат boardArea при scale = 1.
    private boardFrameOffset = new Vec3();
    private hudLayerBase: NodeBaseline | null = null;
    private bottomBarBase: NodeBaseline | null = null;
    private disclaimerBase: NodeBaseline | null = null;
    private disclaimerFontSizeBase = 0;
    private disclaimerLineHeightBase = 0;
    private hudColumnBase: NodeBaseline[] = [];
    private buttonColumnBase: NodeBaseline[] = [];
    private ctaLogoBase: NodeBaseline | null = null;
    private ctaPlayButtonBase: NodeBaseline | null = null;
    private ctaCenterGroupBase: NodeBaseline | null = null;

    protected onLoad(): void {
        this.captureBaseline();
        // Widget пересчитывал бы фон/HUD каждый кадр и конфликтовал с ручным layout ниже — с этого
        // момента и portrait, и landscape целиком ведёт этот компонент.
        this.disableWidget(this.backgroundNode);
        this.disableWidget(this.packshotBg);
        this.disableWidget(this.hudLayer);
        // Widget на BottomBar теперь гасится НАСОВСЕМ (раньше — только на время landscape). Он
        // выравнивал бар по нижней кромке КАНВАСА, а канвас при policy FIXED_WIDTH (720×720/aspect) и
        // клампе orthoHeight ниже не совпадает с реально видимой областью: на «квадратных» экранах
        // канвас 720×960, а камера показывает 1280 по высоте — бар уезжал на 160 юнитов вверх, на
        // плату. Ниже весь низ экрана ведёт этот компонент от кромки кадра камеры — единственной
        // границы, которая всегда совпадает с тем, что реально видит игрок.
        this.disableWidget(this.bottomBar);
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
        const packshotBgTransform = this.packshotBg?.getComponent(UITransform);
        if (packshotBgTransform) {
            this.packshotBgSize = packshotBgTransform.contentSize.clone();
        }
        this.boardAreaBase = this.boardArea ? new NodeBaseline(this.boardArea) : null;
        this.boardFrameBase = this.boardFrame ? new NodeBaseline(this.boardFrame) : null;
        this.hudLayerBase = this.hudLayer ? new NodeBaseline(this.hudLayer) : null;
        this.bottomBarBase = this.bottomBar ? new NodeBaseline(this.bottomBar) : null;
        this.disclaimerBase = this.disclaimer ? new NodeBaseline(this.disclaimer) : null;
        const disclaimerLabel = this.disclaimer?.getComponent(Label) ?? null;
        if (disclaimerLabel) {
            this.disclaimerFontSizeBase = disclaimerLabel.fontSize;
            this.disclaimerLineHeightBase = disclaimerLabel.lineHeight;
        }
        this.hudColumnBase = this.hudColumn.map((node) => new NodeBaseline(node));
        this.buttonColumnBase = this.buttonColumn.map((node) => new NodeBaseline(node));
        this.ctaLogoBase = this.ctaLogo ? new NodeBaseline(this.ctaLogo) : null;
        this.ctaPlayButtonBase = this.ctaPlayButton ? new NodeBaseline(this.ctaPlayButton) : null;
        this.ctaCenterGroupBase = this.ctaCenterGroup ? new NodeBaseline(this.ctaCenterGroup) : null;
        if (this.boardFrame && this.boardArea) {
            this.boardFrameOffset = LayoutAdapter.offsetWithin(this.boardFrame, this.boardArea);
        }
    }

    // Сумма локальных позиций по цепочке родителей до ancestor. Промежуточные ноды внутри boardArea
    // (GameplayLayer) стоят без своего масштаба и поворота, поэтому простого сложения достаточно.
    private static offsetWithin(node: Node, ancestor: Node): Vec3 {
        const offset = new Vec3();
        let current: Node | null = node;
        while (current && current !== ancestor) {
            offset.add(current.position);
            current = current.parent;
        }
        return offset;
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

        // Пэкшот-фон — та же cover-fit формула, отдельная база размера (см. captureBaseline).
        if (this.packshotBg) {
            const packshotCoverScale = Math.max(
                (visibleHalfWidth * 2) / this.packshotBgSize.width,
                (visibleHalfHeight * 2) / this.packshotBgSize.height,
            );
            this.packshotBg.setScale(packshotCoverScale, packshotCoverScale, 1);
            this.packshotBg.setPosition(0, 0, 0);
        }

        // Дисклеймер — нижняя кромка кадра плюс отступ, в ОБЕИХ ориентациях. Раньше он стоял в
        // фиксированной координате y = -710, а бар висел на Widget: две разные системы привязки, из-за
        // чего они расходились на каждом формате. Хуже того, -710 лежит ВНЕ дизайн-канваса (±640), и
        // условие видимости было aspect <= 0.488 — на 9:16, iPad и во всём landscape обязательный по
        // GDD §3 дисклеймер просто уходил за кадр. Теперь он привязан к тому же краю, что и бар.
        this.applyDisclaimerFont(isLandscape);
        // Высоту читаем с ЖИВОГО UITransform, а не из baseline: у Label overflow = NONE, он сам
        // пересчитывает contentSize под кегль, и правка размера шрифта в сцене (или смена кегля по
        // ориентации выше) не должна требовать правки формул. Baseline — только страховка.
        const disclaimerHeight = this.disclaimer?.getComponent(UITransform)?.contentSize.height
            ?? this.disclaimerBase?.height ?? 0;
        const disclaimerY = -visibleHalfHeight + this.bottomChromeMargin + disclaimerHeight / 2;
        this.disclaimer?.setPosition(this.disclaimerBase?.position.x ?? 0, disclaimerY, 0);
        const disclaimerTopY = disclaimerY + disclaimerHeight / 2;

        if (isLandscape) {
            this.applyLandscape(visibleHalfWidth, visibleHalfHeight, disclaimerTopY);
        } else {
            this.applyPortrait(visibleHalfWidth, visibleHalfHeight, disclaimerTopY);
        }
    }

    // Portrait: шапка прижата к верхней кромке кадра, подвал складывается снизу вверх от нижней,
    // плата занимает всё, что осталось между ними.
    // Кегль по ориентации. Перевыставляем только при реальном изменении: Label.fontSize — сеттер,
    // который дёргает пересборку рендер-данных, а applyLayout вызывается на каждый canvas-resize.
    private applyDisclaimerFont(isLandscape: boolean): void {
        const label = this.disclaimer?.getComponent(Label) ?? null;
        if (!label) {
            return;
        }
        const fontSize = isLandscape ? this.landscapeDisclaimerFontSize : this.disclaimerFontSizeBase;
        const lineHeight = isLandscape ? this.landscapeDisclaimerLineHeight : this.disclaimerLineHeightBase;
        if (label.fontSize === fontSize && label.lineHeight === lineHeight) {
            return;
        }
        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
        // Свой contentSize Label пересчитывает в проходе рендера, то есть уже ПОСЛЕ этого кадра.
        // Без принудительного пересчёта позицию ниже мы посчитали бы по старой высоте, и дисклеймер
        // прыгнул бы на один кадр при каждой смене ориентации.
        label.updateRenderData(true);
    }

    private applyPortrait(visibleHalfWidth: number, visibleHalfHeight: number, disclaimerTopY: number): void {
        // Шапка остаётся на авторской позиции из сцены и НЕ прижимается к верхней кромке кадра.
        // Прижим пробовался и отменён: на вытянутых экранах кадр выше дизайн-канваса, шапка уезжала
        // вверх на 140 юнитов и логотип попадал в зону выреза/«острова». Выигрыша от прижима нет —
        // плата на таких экранах и так помещается в масштабе 1, лишняя высота ей не нужна, поэтому
        // весь запас уходит в воздух над шапкой, где он безвреден.
        let hudBottomY = visibleHalfHeight;
        if (this.hudLayer && this.hudLayerBase) {
            this.hudLayer.setPosition(this.hudLayerBase.position);
            this.hudLayer.setScale(this.hudLayerBase.scale);
            hudBottomY = this.hudLayerBase.position.y - this.hudLayerBase.height / 2;
        }

        this.fitBoardAndBar(visibleHalfWidth, hudBottomY, disclaimerTopY);

        LayoutAdapter.restoreColumn(this.hudColumn, this.hudColumnBase);
        LayoutAdapter.restoreColumn(this.buttonColumn, this.buttonColumnBase);
        if (this.ctaLogo && this.ctaLogoBase) {
            this.ctaLogo.setPosition(this.ctaLogoBase.position);
        }
        if (this.ctaPlayButton && this.ctaPlayButtonBase) {
            this.ctaPlayButton.setPosition(this.ctaPlayButtonBase.position);
        }
        if (this.ctaCenterGroup && this.ctaCenterGroupBase) {
            this.ctaCenterGroup.setPosition(this.ctaCenterGroupBase.position);
            this.ctaCenterGroup.setScale(this.ctaCenterGroupBase.scale);
        }
    }

    // Плата и ряд кнопок — ОДИН жёсткий блок: кнопки всегда стоят на фиксированном зазоре под платой
    // (portraitBoardBarGap) и едут вместе с ней. Блок целиком вписывается в полосу между шапкой и
    // дисклеймером; единственный элемент внизу, привязанный к кромке экрана, — сам дисклеймер.
    //
    // Так портрет ведёт себя так же, как landscape, где колонка кнопок тоже висит на кромке платы, а
    // не на кромке экрана. Прежняя схема (бар отсчитывался от дисклеймера, плата занимала остаток)
    // давала одинаковые числа на зажатых форматах, но на вытянутых экранах бар отрывался от платы и
    // уезжал вниз вместе с кромкой — кнопки жили своей жизнью.
    //
    // Пока авторская геометрия помещается — плата остаётся ровно на своём месте из сцены в масштабе 1,
    // и весь запас высоты уходит под кнопки, между ними и дисклеймером. Когда полосы не хватает
    // (9:16 и квадратнее, где полувысота кадра зафиксирована на 640), блок ужимается: масштабируется
    // плата, кнопки остаются в натуральную величину, чтобы не терять размер тач-таргета.
    //
    // Кламп не нуждается в ветке «влезло / не влезло»: при нехватке полосы обе его границы сходятся
    // в одну точку.
    private fitBoardAndBar(visibleHalfWidth: number, hudBottomY: number, disclaimerTopY: number): void {
        if (!this.boardArea || !this.boardAreaBase || !this.boardFrameBase) {
            return;
        }
        const barHeight = this.bottomBarBase?.height ?? 0;
        const bandTop = hudBottomY - this.portraitBoardGap;
        const bandBottom = disclaimerTopY + this.minChromeGap;
        // Плате достаётся полоса за вычетом того, что жёстко висит под ней.
        const boardBudget = Math.max(1, bandTop - bandBottom - barHeight - this.portraitBoardBarGap);
        const availableWidth = Math.max(1, visibleHalfWidth * 2 - this.portraitBoardSidePadding * 2);
        const scale = Math.min(
            1,
            boardBudget / this.boardFrameBase.height,
            availableWidth / this.boardFrameBase.width,
        );
        const frameHalfHeight = (this.boardFrameBase.height * scale) / 2;
        // Авторский центр рамки в системе координат родителя boardArea.
        const authoredX = this.boardAreaBase.position.x + this.boardFrameOffset.x;
        const authoredY = this.boardAreaBase.position.y + this.boardFrameOffset.y;
        const lowestY = bandBottom + barHeight + this.portraitBoardBarGap + frameHalfHeight;
        const highestY = bandTop - frameHalfHeight;
        const frameY = Math.min(Math.max(authoredY, lowestY), highestY);
        this.boardArea.setScale(scale, scale, 1);
        this.boardArea.setPosition(
            authoredX - this.boardFrameOffset.x * scale,
            frameY - this.boardFrameOffset.y * scale,
            0,
        );

        // Кнопки — жёстко под платой и по её горизонтальному центру.
        if (this.bottomBar && this.bottomBarBase) {
            this.bottomBar.setPosition(
                authoredX,
                frameY - frameHalfHeight - this.portraitBoardBarGap - barHeight / 2,
                0,
            );
            this.bottomBar.setScale(this.bottomBarBase.scale);
        }
    }

    private static restoreColumn(nodes: Node[], baselines: NodeBaseline[]): void {
        for (let i = 0; i < nodes.length && i < baselines.length; i++) {
            nodes[i].setPosition(baselines[i].position);
            nodes[i].angle = baselines[i].angle;
        }
    }

    // Landscape-композиция: HUD-колонка слева, плата по центру на всю доступную высоту, колонка кнопок
    // справа. Ширины колонок НЕ захардкожены — меряются по contentSize реального содержимого, поэтому
    // добавление/удаление панели или кнопки в сцене автоматически меняет геометрию.
    private applyLandscape(visibleHalfWidth: number, visibleHalfHeight: number, disclaimerTopY: number): void {
        if (!this.boardArea || !this.boardFrameBase) {
            return;
        }

        // --- 1. Вертикальный бюджет платы: от верха экрана до верхней кромки дисклеймера.
        const topY = visibleHalfHeight - this.landscapeBoardTopMargin;
        // disclaimerTopY приходит из applyLayout — от реальной кромки кадра. Раньше он считался от
        // фиксированной y = -710, которая в landscape лежит за кадром: плата получала лишние ~120
        // юнитов высоты и занимала место невидимого дисклеймера. Теперь дисклеймер виден и плата ему
        // не мешает.
        const bottomY = Math.max(
            -visibleHalfHeight + this.landscapeBoardBottomMargin,
            disclaimerTopY + this.landscapeBoardBottomMargin,
        );
        const availableHeight = Math.max(1, topY - bottomY);

        // --- 2. Колонки меряем ДО платы: их ширина — вычет из горизонтального бюджета.
        const hudGaps = LayoutAdapter.buildGaps(this.hudColumnBase.length, this.landscapeHudSpacing, this.landscapeHudLogoGap);
        const buttonGaps = LayoutAdapter.buildGaps(this.buttonColumnBase.length, this.landscapeButtonSpacing);
        const hudSize = LayoutAdapter.measureColumn(this.hudColumnBase, hudGaps, this.landscapeHudScale);
        const buttonSize = LayoutAdapter.measureColumn(this.buttonColumnBase, buttonGaps, this.landscapeButtonScale);
        const sideBudget =
            this.landscapeEdgePadding * 2 +
            hudSize.width +
            buttonSize.width +
            this.landscapeColumnGap * 2;
        const availableWidth = Math.max(1, visibleHalfWidth * 2 - sideBudget);

        // --- 3. Масштаб платы — по более жёсткому из двух ограничений (обычно это высота).
        const scale = Math.min(availableHeight / this.boardFrameBase.height, availableWidth / this.boardFrameBase.width);
        const frameHalfWidth = (this.boardFrameBase.width * scale) / 2;

        // Плата стоит ровно по центру экрана, пока это не выдавливает колонку за край; на «квадратных»
        // planshet-landscape (4:3) бюджета не хватает и композиция уплотняется — тогда центр съезжает
        // ровно настолько, чтобы обе колонки уместились с их отступами от края.
        const minFrameX = -visibleHalfWidth + this.landscapeEdgePadding + hudSize.width + this.landscapeColumnGap + frameHalfWidth;
        const maxFrameX = visibleHalfWidth - this.landscapeEdgePadding - buttonSize.width - this.landscapeColumnGap - frameHalfWidth;
        const frameX = Math.min(Math.max(0, minFrameX), maxFrameX);
        const frameY = (topY + bottomY) / 2;

        // boardArea двигаем так, чтобы центр boardFrame попал в (frameX, frameY): собственное смещение
        // рамки внутри обёртки тоже масштабируется.
        this.boardArea.setScale(scale, scale, 1);
        this.boardArea.setPosition(frameX - this.boardFrameOffset.x * scale, frameY - this.boardFrameOffset.y * scale, 0);

        // --- 4. Колонки прижимаются к плате с одинаковым зазором и центрируются по её вертикали.
        if (this.hudLayer) {
            this.hudLayer.setPosition(frameX - frameHalfWidth - this.landscapeColumnGap - hudSize.width / 2, frameY, 0);
            this.hudLayer.setScale(this.landscapeHudScale, this.landscapeHudScale, 1);
        }
        LayoutAdapter.stackColumn(this.hudColumn, this.hudColumnBase, hudGaps);

        if (this.bottomBar) {
            this.bottomBar.setPosition(frameX + frameHalfWidth + this.landscapeColumnGap + buttonSize.width / 2, frameY, 0);
            this.bottomBar.setScale(this.landscapeButtonScale, this.landscapeButtonScale, 1);
        }
        LayoutAdapter.stackColumn(this.buttonColumn, this.buttonColumnBase, buttonGaps);

        if (this.chevronNext) {
            this.chevronNext.angle = this.landscapeChevronAngle;
        }

        // --- 5. Пэкшот: Logo и PlayButton встают вплотную к CenterGroup по бокам (не у края экрана),
        // на одной общей горизонтали. CenterGroup остаётся по центру и масштабируется, если всей
        // строке не хватает ширины экрана.
        if (this.ctaLogoBase && this.ctaPlayButtonBase && this.ctaCenterGroupBase) {
            const logoWidth = this.ctaLogoBase.width;
            const buttonWidth = this.ctaPlayButtonBase.width;
            const availableWidth = Math.max(1, visibleHalfWidth * 2 - this.landscapeCtaEdgePadding * 2);
            const availableForCenter = Math.max(
                1,
                availableWidth - logoWidth - buttonWidth - this.landscapeCtaColumnGap * 2,
            );
            const centerScale = Math.min(1, availableForCenter / this.ctaCenterGroupBase.width);
            const centerHalfWidth = (this.ctaCenterGroupBase.width * centerScale) / 2;
            const logoX = -(centerHalfWidth + this.landscapeCtaColumnGap + logoWidth / 2);
            const buttonX = centerHalfWidth + this.landscapeCtaColumnGap + buttonWidth / 2;

            this.ctaLogo?.setPosition(logoX, this.landscapeCtaBaselineY, 0);
            this.ctaPlayButton?.setPosition(buttonX, this.landscapeCtaBaselineY, 0);
            this.ctaCenterGroup?.setPosition(this.ctaCenterGroupBase.position);
            this.ctaCenterGroup?.setScale(centerScale, centerScale, 1);
        }
    }

    // Зазоры между соседними элементами колонки (length = count - 1). firstGap, если задан, идёт сразу
    // после первого элемента (Logo отделяется от панелей сильнее, чем панели друг от друга) — остальные
    // зазоры берут общий spacing.
    private static buildGaps(count: number, spacing: number, firstGap?: number): number[] {
        const gaps = new Array(Math.max(0, count - 1)).fill(spacing);
        if (firstGap !== undefined && gaps.length > 0) {
            gaps[0] = firstGap;
        }
        return gaps;
    }

    // Габарит вертикальной колонки в экранных единицах: ширина — по самому широкому элементу,
    // высота — сумма высот плюс зазоры между ними.
    private static measureColumn(baselines: NodeBaseline[], gaps: number[], scale: number): Size {
        let width = 0;
        let height = 0;
        for (const baseline of baselines) {
            width = Math.max(width, baseline.width);
            height += baseline.height;
        }
        height += gaps.reduce((sum, gap) => sum + gap, 0);
        return new Size(width * scale, height * scale);
    }

    // Раскладывает элементы колонки сверху вниз в ЛОКАЛЬНЫХ координатах контейнера (масштаб контейнера
    // уже применён снаружи), центрируя стопку относительно его начала координат. gaps[i] — зазор между
    // элементом i и i+1.
    private static stackColumn(nodes: Node[], baselines: NodeBaseline[], gaps: number[]): void {
        const count = Math.min(nodes.length, baselines.length);
        if (count === 0) {
            return;
        }
        let totalHeight = 0;
        for (let i = 0; i < count; i++) {
            totalHeight += baselines[i].height;
            if (i < count - 1) {
                totalHeight += gaps[i] ?? 0;
            }
        }
        let cursorY = totalHeight / 2;
        for (let i = 0; i < count; i++) {
            const half = baselines[i].height / 2;
            cursorY -= half;
            nodes[i].setPosition(0, cursorY, 0);
            cursorY -= half + (gaps[i] ?? 0);
        }
    }
}
