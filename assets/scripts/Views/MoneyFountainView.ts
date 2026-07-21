import { _decorator, Component, Node, Prefab, instantiate, tween, Tween, Vec3 } from 'cc';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_COINS_CHANGED, CoinsChangedEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// Разлёт монет FC на solve (ARCHITECTURE.md §3). coinFxPrefab — переиспользуемый FX-элемент из
// Фазы 4 (`assets/prefabs/CoinFx.prefab`); ref отсутствует до тех пор — burst() предсказуемый no-op
// (правило Фазы 3: null-ссылка не прячет обязательный wiring-баг, но и не бросает исключение).
@ccclass('MoneyFountainView')
export class MoneyFountainView extends Component {
    @property(Prefab)
    public coinFxPrefab: Prefab | null = null;

    private readonly activeCoins: Node[] = [];

    private readonly _onCoinsChanged = this.onCoinsChanged.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<CoinsChangedEvent>(EVT_COINS_CHANGED, this._onCoinsChanged);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<CoinsChangedEvent>(EVT_COINS_CHANGED, this._onCoinsChanged);
        this.activeCoins.forEach((node) => Tween.stopAllByTarget(node));
        this.activeCoins.length = 0;
    }

    private onCoinsChanged(event: CoinsChangedEvent): void {
        // Разлёт масштабируется наградой (с потолком, чтобы не заспамить FX на большом delta).
        this.burst(Math.max(1, Math.min(event.delta, 12)));
    }

    // Разлетает `count` частиц из центра ноды в случайные стороны, затем самоуничтожается каждая.
    public burst(count: number): void {
        if (!this.coinFxPrefab) {
            return;
        }
        for (let i = 0; i < count; i++) {
            const coin = instantiate(this.coinFxPrefab);
            this.node.addChild(coin);
            this.activeCoins.push(coin);
            const angle = Math.random() * Math.PI * 2;
            const radius = 60 + Math.random() * 60;
            const target = new Vec3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
            tween(coin)
                .to(0.5, { position: target })
                .call(() => {
                    const idx = this.activeCoins.indexOf(coin);
                    if (idx >= 0) {
                        this.activeCoins.splice(idx, 1);
                    }
                    coin.destroy();
                })
                .start();
        }
    }
}
