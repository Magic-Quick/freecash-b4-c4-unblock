import { _decorator, Component, view, ResolutionPolicy } from 'cc';

const { ccclass } = _decorator;

// Дизайн-разрешение проекта (Project Settings, AGENTS.md §1) — единственная точка правды для
// SHOW_ALL ниже, чтобы не разойтись с настройкой движка, если её когда-нибудь поменяют.
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

// Portrait/landscape adaptive layout (IMPLEMENTATION_PHASES.md §Фаза 3 п.6, доработано в Фазе 6 —
// найден реальный баг на прогоне владельца: landscape давал сильный зум по центру экрана, потому
// что design resolution policy нигде явно не выставлялась. `ResolutionPolicy.SHOW_ALL` — штатный
// механизм Cocos, который гарантирует, что весь дизайн-прямоугольник 720×1280 целиком видим при
// любом aspect ratio (портрет/ландшафт/узкий/широкий): движок подбирает единый масштаб под более
// тесное измерение и леттербоксит другое, вместо того чтобы обрезать/зумить контент.
@ccclass('LayoutAdapter')
export class LayoutAdapter extends Component {
    private readonly _onResize = this.onResize.bind(this);

    protected onLoad(): void {
        view.on('canvas-resize', this._onResize, this);
        this.applyLayout();
    }

    protected onDestroy(): void {
        view.off('canvas-resize', this._onResize, this);
    }

    private onResize(): void {
        this.applyLayout();
    }

    private applyLayout(): void {
        view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);
        const size = view.getVisibleSize();
        const isLandscape = size.width > size.height;
        if (isLandscape) {
            // TODO(OPEN_ISSUES.md #7): бespoke landscape-композиция (HUD-панели реально по краям
            // освободившейся ширины, а не леттербокс-поля вокруг portrait-раскладки) — предмет
            // отдельного визуального прохода с владельцем проекта после подтверждения SHOW_ALL
            // (см. IMPLEMENTATION_PHASES.md Фаза 6). SHOW_ALL уже гарантирует, что ничего не
            // обрезается — это базовый гейт Фазы 6, закрыт этим вызовом независимо от ориентации.
            return;
        }
        // Portrait — базовая раскладка уже полностью собрана сценой (SCENE_SETUP.md), доп. действий
        // на уровне кода не требуется.
    }
}
