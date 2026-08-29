import { _decorator, Component, AudioSource, AudioClip, tween, Tween } from 'cc';
import { Playbox } from '../Core/Playbox';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_TAP, TapEvent, EVT_REQUEST_CTA, RequestCtaEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// AUDIO_GENERATION_PLAN.md §6.3: длительность fade-out gameplay-loop при показе CTA. Не в GameConfig —
// ничего кроме этого tween её не читает (тот же прецедент, что и pulse-tween в CTAView).
const CTA_MUSIC_FADE_DURATION = 0.22;

// Музыкальный слой из AUDIO_GENERATION_PLAN.md §6/§7. Looped gameplay-музыка стартует на первый
// EVT_TAP — тот же жест, которым InputRouter уже разблокирует Playbox.tap() (браузерный autoplay
// требует user gesture до звука). При EVT_REQUEST_CTA loop плавно уходит и уступает место одноразовому
// packshot-sting; после этого loop не возобновляется — CTA терминальна (CTAView.show()/game_end()).
@ccclass('MusicSystem')
export class MusicSystem extends Component {
    @property(AudioSource)
    private loopSource: AudioSource | null = null;

    @property(AudioClip)
    private loopClip: AudioClip | null = null;

    @property(AudioSource)
    private stingSource: AudioSource | null = null;

    @property(AudioClip)
    private stingClip: AudioClip | null = null;

    private started = false;
    private fadeTween: Tween<AudioSource> | null = null;

    private readonly _onTap = this.onTap.bind(this);
    private readonly _onRequestCta = this.onRequestCta.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<TapEvent>(EVT_TAP, this._onTap);
        GlobalEventBus.subscribe<RequestCtaEvent>(EVT_REQUEST_CTA, this._onRequestCta);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<TapEvent>(EVT_TAP, this._onTap);
        GlobalEventBus.unsubscribe<RequestCtaEvent>(EVT_REQUEST_CTA, this._onRequestCta);
        this.fadeTween?.stop();
    }

    private onTap(_event: TapEvent): void {
        if (this.started || !this.loopSource || !this.loopClip) {
            return;
        }
        if (Playbox.is_muted() || !Playbox.is_audio()) {
            return;
        }
        this.started = true;
        this.loopSource.clip = this.loopClip;
        this.loopSource.loop = true;
        this.loopSource.play();
    }

    private onRequestCta(_event: RequestCtaEvent): void {
        this.fadeOutLoop();
        this.playSting();
    }

    private fadeOutLoop(): void {
        if (!this.loopSource || !this.loopSource.playing) {
            return;
        }
        const source = this.loopSource;
        this.fadeTween = tween(source)
            .to(CTA_MUSIC_FADE_DURATION, { volume: 0 })
            .call(() => source.stop())
            .start();
    }

    private playSting(): void {
        if (!this.stingSource || !this.stingClip || Playbox.is_muted() || !Playbox.is_audio()) {
            return;
        }
        this.stingSource.playOneShot(this.stingClip);
    }
}
