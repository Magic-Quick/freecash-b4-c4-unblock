import { _decorator, Component, Node, Prefab, instantiate, tween, Tween, Vec3 } from 'cc';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_COINS_CHANGED,
    CoinsChangedEvent,
    EVT_MAIN_REACHED_EXIT,
    MainReachedExitEvent,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Разлёт монет FC на solve + вспышка на выходе (ARCHITECTURE.md §3, GDD §3 Juice & Feedback).
// coinFxPrefab — переиспользуемый FX-элемент из Фазы 4 (`assets/prefabs/CoinFx.prefab`); ref отсутствует
// до тех пор — burst() предсказуемый no-op (правило Фазы 3: null-ссылка не прячет обязательный
// wiring-баг, но и не бросает исключение). sparksNode — нода `FxLayer/Sparks` (spark.png), у которой
// не было владельца ни в ARCHITECTURE.md §3, ни в SCENE_SETUP.md (единственная нода без [ViewClass] —
// найдено при дебаг-проходе после Фазы 3); теперь её включает этот View по EVT_MAIN_REACHED_EXIT.
@ccclass('MoneyFountainView')
export class MoneyFountainView extends Component {
    @property(Prefab)
    public coinFxPrefab: Prefab | null = null;

    @property(Node)
    public sparksNode: Node | null = null;

    private readonly activeCoins: Node[] = [];
    private sparkTween: Tween<Node> | null = null;

    private readonly _onCoinsChanged = this.onCoinsChanged.bind(this);
    private readonly _onMainReachedExit = this.onMainReachedExit.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<CoinsChangedEvent>(EVT_COINS_CHANGED, this._onCoinsChanged);
        GlobalEventBus.subscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
        if (this.sparksNode) {
            this.sparksNode.active = false;
        }
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<CoinsChangedEvent>(EVT_COINS_CHANGED, this._onCoinsChanged);
        GlobalEventBus.unsubscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
        this.activeCoins.forEach((node) => Tween.stopAllByTarget(node));
        this.activeCoins.length = 0;
        this.stopSparkTween();
    }

    private onCoinsChanged(event: CoinsChangedEvent): void {
        // Разлёт масштабируется наградой (с потолком, чтобы не заспамить FX на большом delta).
        this.burst(Math.max(1, Math.min(event.delta, 12)));
    }

    private onMainReachedExit(): void {
        this.flashExit();
    }

    // Короткая вспышка (scale-in/scale-out) на выходе, синхронно с моментом, когда главный блок
    // покинул поле (EVT_MAIN_REACHED_EXIT публикует BlockView по завершении driveToExit()).
    // Без fade по альфе намеренно: на ноде Sparks нет UIOpacity в текущей сцене (Фаза 5/6 её ещё не
    // добавляла), а придумывать недостающий компонент сцены не в зоне Фазы 3.
    public flashExit(): void {
        if (!this.sparksNode) {
            return;
        }
        this.stopSparkTween();
        this.sparksNode.active = true;
        this.sparksNode.setScale(0.4, 0.4, 1);
        this.sparkTween = tween(this.sparksNode)
            .to(0.12, { scale: new Vec3(1.3, 1.3, 1) })
            .to(0.18, { scale: new Vec3(1, 1, 1) })
            .call(() => {
                if (this.sparksNode) {
                    this.sparksNode.active = false;
                }
                this.sparkTween = null;
            })
            .start();
    }

    private stopSparkTween(): void {
        if (this.sparkTween) {
            this.sparkTween.stop();
            this.sparkTween = null;
        }
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
