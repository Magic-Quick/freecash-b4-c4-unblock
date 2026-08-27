import { _decorator, Component, Node, Button, Sprite, Tween, tween, Vec3, Color } from 'cc';

const { ccclass, property } = _decorator;

// Тактильный отклик на нажатие кнопки (ARCHITECTURE.md §3) — заменяет нативный Button.transition=SCALE
// (линейный zoomScale без пружины/затемнения, DESIGN_UPDATE_PLAN.md обсуждение «скудной» анимации):
// squash на TOUCH_START + пружинный overshoot на отпускании + лёгкое затемнение спрайта. Слушает
// touch-события ноды напрямую, а не Button.EventType.CLICK — отклик должен идти на сам факт
// нажатия/отпускания вне зависимости от того, долетел ли клик (interactable=false гасит клик, но
// палец всё ещё физически касается кнопки). Node-компонент Button гейтит только старт press-анимации;
// release всегда отыгрывает без проверки interactable, иначе кнопка застрянет уменьшенной, если
// interactable сменится на false прямо во время удержания (например, старт LEVEL_DRIVE между
// TOUCH_START и TOUCH_END).
@ccclass('ButtonPressView')
export class ButtonPressView extends Component {
    @property(Button)
    public button: Button | null = null;

    @property(Sprite)
    public sprite: Sprite | null = null;

    @property({ tooltip: 'Масштаб в момент нажатия' })
    public pressScale = 0.9;

    @property({ tooltip: 'Длительность squash при нажатии, сек' })
    public pressDuration = 0.06;

    @property({ tooltip: 'Длительность пружинного возврата при отпускании, сек' })
    public releaseDuration = 0.18;

    private readonly normalColor = new Color(255, 255, 255, 255);
    private readonly pressedColor = new Color(220, 220, 220, 255);

    private scaleTween: Tween<Node> | null = null;
    private colorTween: Tween<Sprite> | null = null;

    private readonly _onTouchStart = this.onTouchStart.bind(this);
    private readonly _onTouchEnd = this.onTouchEnd.bind(this);

    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
        this.stopTweens();
    }

    private onTouchStart(): void {
        if (this.button && !this.button.interactable) {
            return;
        }
        this.stopTweens();
        this.scaleTween = tween(this.node)
            .to(this.pressDuration, { scale: new Vec3(this.pressScale, this.pressScale, 1) }, { easing: 'quadOut' })
            .start();
        if (this.sprite) {
            this.colorTween = tween(this.sprite)
                .to(this.pressDuration, { color: this.pressedColor }, { easing: 'quadOut' })
                .start();
        }
    }

    private onTouchEnd(): void {
        this.stopTweens();
        this.scaleTween = tween(this.node)
            .to(this.releaseDuration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
        if (this.sprite) {
            this.colorTween = tween(this.sprite)
                .to(this.releaseDuration, { color: this.normalColor }, { easing: 'quadOut' })
                .start();
        }
    }

    private stopTweens(): void {
        if (this.scaleTween) {
            this.scaleTween.stop();
            this.scaleTween = null;
        }
        if (this.colorTween) {
            this.colorTween.stop();
            this.colorTween = null;
        }
    }
}
