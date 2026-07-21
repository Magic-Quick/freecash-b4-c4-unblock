import { _decorator, Component, Label, Node, tween, Tween, Vec3 } from 'cc';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_COINS_CHANGED, CoinsChangedEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// Счётчик FC в HUD (ARCHITECTURE.md §3, SCENE_SETUP.md wiring: CoinCounterView.label → FcLabel).
// Источник правды — GameStateModel (через payload события), View только визуализирует count-up.
@ccclass('CoinCounterView')
export class CoinCounterView extends Component {
    @property(Label)
    public label: Label | null = null;

    private countTween: Tween<{ value: number }> | null = null;
    private scaleTween: Tween<Node> | null = null;

    private readonly _onCoinsChanged = this.onCoinsChanged.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<CoinsChangedEvent>(EVT_COINS_CHANGED, this._onCoinsChanged);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<CoinsChangedEvent>(EVT_COINS_CHANGED, this._onCoinsChanged);
        this.stopCountTween();
        this.stopScaleTween();
    }

    private onCoinsChanged(event: CoinsChangedEvent): void {
        this.addCoins(event.delta, event.total);
        if (event.isFinal) {
            this.highlight();
        }
    }

    // Полёт-подсветку самих монет ведёт MoneyFountainView/FX-слой — здесь только count-up лейбла от
    // (total - delta) до total, без собственного хранимого счётчика.
    public addCoins(delta: number, total: number): void {
        if (!this.label) {
            return;
        }
        this.stopCountTween();
        const from = total - delta;
        const proxy = { value: from };
        const label = this.label;
        this.countTween = tween(proxy)
            .to(0.4, { value: total }, {
                onUpdate: () => {
                    label.string = `${Math.round(proxy.value)}`;
                },
            })
            .call(() => {
                this.countTween = null;
            })
            .start();
    }

    // Финальная подсветка счётчика (после L2) — короткий scale-flourish.
    public highlight(): void {
        this.stopScaleTween();
        this.scaleTween = tween(this.node)
            .to(0.15, { scale: new Vec3(1.2, 1.2, 1) })
            .to(0.15, { scale: new Vec3(1, 1, 1) })
            .call(() => {
                this.scaleTween = null;
            })
            .start();
    }

    private stopCountTween(): void {
        if (this.countTween) {
            this.countTween.stop();
            this.countTween = null;
        }
    }

    private stopScaleTween(): void {
        if (this.scaleTween) {
            this.scaleTween.stop();
            this.scaleTween = null;
        }
    }
}
