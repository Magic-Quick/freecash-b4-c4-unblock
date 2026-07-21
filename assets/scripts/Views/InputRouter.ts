import { _decorator, Component, input, Input, EventTouch, EventMouse } from 'cc';
import { Playbox } from '../Core/Playbox';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_TAP, TapEvent } from '../event-bus/events';

const { ccclass } = _decorator;

// Глобальный счётчик тапов (PLBX_LIFECYCLE_GUIDE.md §plbx.tap()): фирит на КАЖДЫЙ дебаунснутый тап
// за всю сессию (не единожды за игру!) — Moloco считает кумулятивные тапы для порогов
// taps_for_engagement/taps_for_redirection. Это отдельный канал от EVT_SWIPE-детекции внутри
// BlockView: слушает глобальный singleton `input`, а не конкретную ноду блока, поэтому тап по блоку
// триггерит ОБА — этот счётчик И (если жест оказался валидным свайпом) EVT_SWIPE из BlockView.
@ccclass('InputRouter')
export class InputRouter extends Component {
    // Дебаунс 100ms схлопывает синтетическую touch+mouse пару одного физического тапа в один вызов —
    // десктоп-превью и валидатор Moloco шлют только мышь, тач-девайсы шлют тач (и Cocos может
    // синтезировать мышиную пару поверх тача).
    private static readonly TAP_DEBOUNCE_MS = 100;
    private lastTapAt = 0;

    private readonly _onTap = this.onTap.bind(this);

    protected onLoad(): void {
        input.on(Input.EventType.TOUCH_START, this._onTap, this);
        input.on(Input.EventType.MOUSE_DOWN, this._onTap, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this._onTap, this);
        input.off(Input.EventType.MOUSE_DOWN, this._onTap, this);
    }

    private onTap(_event: EventTouch | EventMouse): void {
        const now = Date.now();
        if (now - this.lastTapAt < InputRouter.TAP_DEBOUNCE_MS) {
            return;
        }
        this.lastTapAt = now;
        GlobalEventBus.publish<TapEvent>(EVT_TAP, {});
        Playbox.tap();
    }
}
