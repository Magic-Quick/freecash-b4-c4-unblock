import { _decorator, Component, AudioSource, AudioClip, tween, Tween } from 'cc';
import { Playbox } from '../Core/Playbox';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_TAP, TapEvent, EVT_REQUEST_CTA, RequestCtaEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// AUDIO_GENERATION_PLAN.md §6.3: длительности duck/restore вокруг packshot-sting. Не в GameConfig —
// ничего кроме этих tween'ов их не читает (тот же прецедент, что и pulse-tween в CTAView).
const CTA_MUSIC_DUCK_DURATION = 0.22;
const CTA_MUSIC_RESTORE_DURATION = 0.6;
const CTA_MUSIC_DUCK_VOLUME = 0.1;
// Запасной хвост, если AudioClip.getDuration() ещё не готов (метаданные не подгрузились) — длиннее
// самого длинного packshot-sting с запасом, чтобы luп не вернулся раньше, чем sting отыграет.
const STING_FALLBACK_DURATION = 5;

// Музыкальный слой из AUDIO_GENERATION_PLAN.md §6/§7. Looped gameplay-музыка стартует на первый
// EVT_TAP — тот же жест, которым InputRouter уже разблокирует Playbox.tap() (браузерный autoplay
// требует user gesture до звука). При EVT_REQUEST_CTA loop не останавливается, а приглушается
// (duck) на время one-shot packshot-sting и возвращается к исходной громкости после — CTA-экран
// висит неопределённо долго до тапа/закрытия сети, и полная тишина после sting'а читалась как баг.
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
    private normalLoopVolume = 1;
    private fadeTween: Tween<AudioSource> | null = null;

    private readonly _onTap = this.onTap.bind(this);
    private readonly _onRequestCta = this.onRequestCta.bind(this);

    protected onLoad(): void {
        if (this.loopSource) {
            this.normalLoopVolume = this.loopSource.volume;
        }
        GlobalEventBus.subscribe<TapEvent>(EVT_TAP, this._onTap);
        GlobalEventBus.subscribe<RequestCtaEvent>(EVT_REQUEST_CTA, this._onRequestCta);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<TapEvent>(EVT_TAP, this._onTap);
        GlobalEventBus.unsubscribe<RequestCtaEvent>(EVT_REQUEST_CTA, this._onRequestCta);
        this.fadeTween?.stop();
        this.unscheduleAllCallbacks();
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
        this.duckLoop();
        this.playSting();
    }

    private duckLoop(): void {
        if (!this.loopSource || !this.loopSource.playing) {
            return;
        }
        this.fadeTween?.stop();
        this.fadeTween = tween(this.loopSource)
            .to(CTA_MUSIC_DUCK_DURATION, { volume: CTA_MUSIC_DUCK_VOLUME })
            .start();
    }

    private restoreLoop(): void {
        if (!this.loopSource || !this.loopSource.playing) {
            return;
        }
        this.fadeTween?.stop();
        this.fadeTween = tween(this.loopSource)
            .to(CTA_MUSIC_RESTORE_DURATION, { volume: this.normalLoopVolume })
            .start();
    }

    private playSting(): void {
        if (!this.stingSource || !this.stingClip || Playbox.is_muted() || !Playbox.is_audio()) {
            return;
        }
        // .play(), не playOneShot(): sting не перекрывает сам себя, а playOneShot(clip, volumeScale)
        // игнорирует AudioSource.volume — так заданная на source'е громкость была бы мёртвой настройкой.
        this.stingSource.clip = this.stingClip;
        this.stingSource.play();
        const duration = this.stingClip.getDuration() || STING_FALLBACK_DURATION;
        this.scheduleOnce(() => this.restoreLoop(), duration);
    }
}
