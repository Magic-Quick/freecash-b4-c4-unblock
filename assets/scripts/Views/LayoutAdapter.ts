import { _decorator, Component, view } from 'cc';

const { ccclass } = _decorator;

// Точка расширения portrait/landscape (IMPLEMENTATION_PHASES.md §Фаза 3 п.6). Точное landscape-
// поведение — открытый вопрос OPEN_ISSUES.md #7 (не подтверждено, каким сетям реально нужен
// landscape), поэтому здесь только детекция ориентации и явный no-op branch как якорь для будущей
// реализации — не придумываем непроверенную раскладку заранее.
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
        const size = view.getVisibleSize();
        const isLandscape = size.width > size.height;
        if (isLandscape) {
            // TODO(OPEN_ISSUES.md #7): landscape repositioning — HUD по краям сцены, поле по центру,
            // CTA/disclaimer в пределах safe area. Не реализуется до подтверждения владельцем, каким
            // сетям реально нужен landscape (см. вопрос в OPEN_ISSUES.md).
            return;
        }
        // Portrait — базовая раскладка уже полностью собрана сценой (SCENE_SETUP.md), доп. действий
        // на уровне кода не требуется.
    }
}
