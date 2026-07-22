import { _decorator, Component, Node, Label, Button, tween, Tween, Vec3 } from 'cc';
import { Playbox } from '../Core/Playbox';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_REQUEST_CTA, RequestCtaEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// Экран CTA (ARCHITECTURE.md §3/§6). show() — единственное место, где фирит Playbox.game_end():
// терминальное состояние геймплея наступает в момент ПОКАЗА CTA, а не по клику кнопки — частый
// источник провала валидаторов Moloco, если complete beacon перепутан с click beacon.
//
// Компонент живёт на самой ноде `CTAOverlay` (активной с самого старта сцены), а не на `Panel` —
// найдено на реальном прогоне Фазы 6: если бы он висел на `Panel` внутри неактивного `CTAOverlay`,
// его `onLoad()` вообще не выполнился бы (Cocos не вызывает onLoad для потомков неактивного предка —
// см. Life Cycle Callbacks), и подписка на EVT_REQUEST_CTA никогда бы не зарегистрировалась. Видимость
// переключаем на дочерних `dimNode`/`panelNode`, а не на `this.node`/`this.node.parent`.
@ccclass('CTAView')
export class CTAView extends Component {
    @property(Node)
    public dimNode: Node | null = null;

    @property(Node)
    public panelNode: Node | null = null;

    @property(Node)
    public logoNode: Node | null = null;

    @property(Label)
    public titleLabel: Label | null = null;

    @property(Label)
    public fcLabel: Label | null = null;

    @property(Button)
    public playButton: Button | null = null;

    private pulseTween: Tween<Node> | null = null;

    private readonly _onRequestCta = this.onRequestCta.bind(this);
    private readonly _onPlayClicked = this.onPlayClicked.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<RequestCtaEvent>(EVT_REQUEST_CTA, this._onRequestCta);
        this.playButton?.node.on(Button.EventType.CLICK, this._onPlayClicked, this);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<RequestCtaEvent>(EVT_REQUEST_CTA, this._onRequestCta);
        this.playButton?.node.off(Button.EventType.CLICK, this._onPlayClicked, this);
        this.stopPulse();
    }

    private onRequestCta(event: RequestCtaEvent): void {
        this.show(event.totalFc);
    }

    public show(totalFc: number): void {
        // `CTAOverlay` (this.node) сам активен с запуска сцены — скрыты только визуальные дети.
        if (this.dimNode) {
            this.dimNode.active = true;
        }
        if (this.panelNode) {
            this.panelNode.active = true;
        }
        if (this.fcLabel) {
            this.fcLabel.string = `${totalFc}`;
        }
        // Терминальное состояние геймплея — ровно здесь, на показе CTA (см. комментарий класса).
        Playbox.game_end();
        this.pulse();
    }

    private pulse(): void {
        if (!this.playButton) {
            return;
        }
        this.stopPulse();
        this.pulseTween = tween(this.playButton.node)
            .to(0.35, { scale: new Vec3(1.08, 1.08, 1) })
            .to(0.35, { scale: new Vec3(1, 1, 1) })
            .union()
            .repeatForever()
            .start();
    }

    private stopPulse(): void {
        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }
    }

    private onPlayClicked(): void {
        Playbox.download();
    }
}
