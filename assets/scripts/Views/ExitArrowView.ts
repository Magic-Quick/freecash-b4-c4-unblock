import { _decorator, Component, Node, tween, Tween, Vec3 } from 'cc';

const { ccclass } = _decorator;

// Простая идле-подсказка направления выхода (ARCHITECTURE.md §3). Не завязана на конкретное событие
// (IMPLEMENTATION_PHASES §Фаза 3 п.7 — оставить простой continuous pulse допустимо) — пульсирует
// непрерывно с момента появления ноды в сцене.
@ccclass('ExitArrowView')
export class ExitArrowView extends Component {
    private loopTween: Tween<Node> | null = null;

    protected onLoad(): void {
        this.pulse();
    }

    protected onDestroy(): void {
        if (this.loopTween) {
            this.loopTween.stop();
            this.loopTween = null;
        }
    }

    public pulse(): void {
        if (this.loopTween) {
            return;
        }
        this.loopTween = tween(this.node)
            .to(0.4, { scale: new Vec3(1.15, 1.15, 1) })
            .to(0.4, { scale: new Vec3(1, 1, 1) })
            .union()
            .repeatForever()
            .start();
    }
}
