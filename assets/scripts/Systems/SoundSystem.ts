import { _decorator, Component, AudioClip, AudioSource } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { Playbox } from '../Core/Playbox';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_BLOCK_MOVED,
    BlockMovedEvent,
    EVT_BLOCK_BLOCKED,
    BlockBlockedEvent,
    EVT_MAIN_PATH_CLEAR,
    MainPathClearEvent,
    EVT_MAIN_DRIVE_START,
    MainDriveStartEvent,
    EVT_MAIN_REACHED_EXIT,
    MainReachedExitEvent,
    EVT_BLOCK_UNDONE,
    BlockUndoneEvent,
    EVT_LEVEL_SOLVED,
    LevelSolvedEvent,
    EVT_CTA_CLICKED,
    CtaClickedEvent,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Реализация из AUDIO_GENERATION_PLAN.md §7 — SoundSystem сам транслирует доменные EVT_* в SFX
// (Views не знают о звуковых ID). `playOneShot` не прерывает уже играющий клип — совпавшие по времени
// клипы не обрежут друг друга (AUDIO_GENERATION_PLAN.md §8).
@ccclass('SoundSystem')
export class SoundSystem extends Component {
    @property(GameConfig)
    private config: GameConfig | null = null;

    @property(AudioSource)
    private audioSource: AudioSource | null = null;

    @property(AudioClip)
    private blockSlideClip: AudioClip | null = null;

    @property(AudioClip)
    private blockBlockedClip: AudioClip | null = null;

    @property(AudioClip)
    private pathClearClip: AudioClip | null = null;

    @property(AudioClip)
    private mainDriveClip: AudioClip | null = null;

    @property(AudioClip)
    private exitWhooshClip: AudioClip | null = null;

    @property(AudioClip)
    private coinCountClip: AudioClip | null = null;

    @property(AudioClip)
    private levelCompleteClip: AudioClip | null = null;

    @property(AudioClip)
    private finalFanfareClip: AudioClip | null = null;

    @property(AudioClip)
    private ctaTapClip: AudioClip | null = null;

    // Полосы громкости из AUDIO_GENERATION_PLAN.md §7.4 (движение тише, reward-момент заметнее).
    // playOneShot(clip, volumeScale) — независимая величина от AudioSource.volume самого source.
    private static readonly VOL_MOVEMENT = 0.5;
    private static readonly VOL_REWARD = 0.7;

    // Стагер связки coin_count → level_complete → final_fanfare на EVT_LEVEL_SOLVED, сек. Укладывается
    // в паузу GameConfig.winFxDuration (0.6s) до EVT_REQUEST_CTA — не пересекается с packshot-sting.
    private static readonly LEVEL_COMPLETE_DELAY = 0.15;
    private static readonly FINAL_FANFARE_DELAY = 0.35;

    private lastBlockSlideAt = 0;
    private lastBlockBlockedAt = 0;

    private readonly _onBlockMoved = this.onBlockMoved.bind(this);
    private readonly _onBlockBlocked = this.onBlockBlocked.bind(this);
    private readonly _onMainPathClear = this.onMainPathClear.bind(this);
    private readonly _onMainDriveStart = this.onMainDriveStart.bind(this);
    private readonly _onMainReachedExit = this.onMainReachedExit.bind(this);
    private readonly _onBlockUndone = this.onBlockUndone.bind(this);
    private readonly _onLevelSolved = this.onLevelSolved.bind(this);
    private readonly _onCtaClicked = this.onCtaClicked.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.subscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.subscribe<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, this._onMainPathClear);
        GlobalEventBus.subscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        GlobalEventBus.subscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
        GlobalEventBus.subscribe<BlockUndoneEvent>(EVT_BLOCK_UNDONE, this._onBlockUndone);
        GlobalEventBus.subscribe<LevelSolvedEvent>(EVT_LEVEL_SOLVED, this._onLevelSolved);
        GlobalEventBus.subscribe<CtaClickedEvent>(EVT_CTA_CLICKED, this._onCtaClicked);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.unsubscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.unsubscribe<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, this._onMainPathClear);
        GlobalEventBus.unsubscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        GlobalEventBus.unsubscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
        GlobalEventBus.unsubscribe<BlockUndoneEvent>(EVT_BLOCK_UNDONE, this._onBlockUndone);
        GlobalEventBus.unsubscribe<LevelSolvedEvent>(EVT_LEVEL_SOLVED, this._onLevelSolved);
        GlobalEventBus.unsubscribe<CtaClickedEvent>(EVT_CTA_CLICKED, this._onCtaClicked);
        this.unscheduleAllCallbacks();
    }

    private onBlockMoved(_event: BlockMovedEvent): void {
        if (!this.config) {
            return;
        }
        const now = Date.now();
        if (now - this.lastBlockSlideAt < this.config.sfxBlockSlideMinInterval * 1000) {
            return;
        }
        this.lastBlockSlideAt = now;
        this.play(this.blockSlideClip, SoundSystem.VOL_MOVEMENT);
    }

    private onBlockBlocked(_event: BlockBlockedEvent): void {
        if (!this.config) {
            return;
        }
        const now = Date.now();
        if (now - this.lastBlockBlockedAt < this.config.sfxBlockBlockedMinInterval * 1000) {
            return;
        }
        this.lastBlockBlockedAt = now;
        this.play(this.blockBlockedClip, SoundSystem.VOL_MOVEMENT);
    }

    private onMainPathClear(_event: MainPathClearEvent): void {
        this.play(this.pathClearClip, SoundSystem.VOL_REWARD);
    }

    private onMainDriveStart(_event: MainDriveStartEvent): void {
        this.play(this.mainDriveClip, SoundSystem.VOL_MOVEMENT);
    }

    private onMainReachedExit(_event: MainReachedExitEvent): void {
        this.play(this.exitWhooshClip, SoundSystem.VOL_REWARD);
    }

    // Связка на момент решения уровня (AUDIO_GENERATION_PLAN.md §3: coin_count/level_complete/
    // final_fanfare изначально планировались под RewardSystem, который вырезан по OPEN_ISSUES.md #5 —
    // здесь они переиспользованы как единый staggered win-акцент на EVT_LEVEL_SOLVED, а не одновременный
    // залп: §8 запрещает клипам маскировать друг друга).
    private onLevelSolved(_event: LevelSolvedEvent): void {
        this.play(this.coinCountClip, SoundSystem.VOL_REWARD);
        this.scheduleOnce(() => this.play(this.levelCompleteClip, SoundSystem.VOL_REWARD), SoundSystem.LEVEL_COMPLETE_DELAY);
        this.scheduleOnce(() => this.play(this.finalFanfareClip, SoundSystem.VOL_REWARD), SoundSystem.FINAL_FANFARE_DELAY);
    }

    private onCtaClicked(_event: CtaClickedEvent): void {
        this.play(this.ctaTapClip, SoundSystem.VOL_MOVEMENT);
    }

    // Undo — тот же слайд-звук, что и обычный ход, с тем же анти-спам гейтом (DESIGN_UPDATE_PLAN.md
    // §8.2 п.4 требует отдельную подписку на EVT_BLOCK_UNDONE вместо EVT_BLOCK_MOVED — счётчик ходов
    // считает их раздельно, но с точки зрения звука откат блока и обычный сдвиг неотличимы).
    private onBlockUndone(_event: BlockUndoneEvent): void {
        if (!this.config) {
            return;
        }
        const now = Date.now();
        if (now - this.lastBlockSlideAt < this.config.sfxBlockSlideMinInterval * 1000) {
            return;
        }
        this.lastBlockSlideAt = now;
        this.play(this.blockSlideClip, SoundSystem.VOL_MOVEMENT);
    }

    // Замьюченный контейнер (start_muted) и явный plbx.is_audio()=false должны молчать без исключений —
    // OPEN_ISSUES.md #9 требует видимую mute-кнопку отдельно, здесь только гейт на воспроизведение.
    private play(clip: AudioClip | null, volumeScale = 1): void {
        if (!clip || !this.audioSource || Playbox.is_muted() || !Playbox.is_audio()) {
            return;
        }
        this.audioSource.playOneShot(clip, volumeScale);
    }
}
