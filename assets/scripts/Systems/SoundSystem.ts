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

    private lastBlockSlideAt = 0;
    private lastBlockBlockedAt = 0;

    private readonly _onBlockMoved = this.onBlockMoved.bind(this);
    private readonly _onBlockBlocked = this.onBlockBlocked.bind(this);
    private readonly _onMainPathClear = this.onMainPathClear.bind(this);
    private readonly _onMainDriveStart = this.onMainDriveStart.bind(this);
    private readonly _onMainReachedExit = this.onMainReachedExit.bind(this);
    private readonly _onBlockUndone = this.onBlockUndone.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.subscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.subscribe<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, this._onMainPathClear);
        GlobalEventBus.subscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        GlobalEventBus.subscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
        GlobalEventBus.subscribe<BlockUndoneEvent>(EVT_BLOCK_UNDONE, this._onBlockUndone);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.unsubscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.unsubscribe<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, this._onMainPathClear);
        GlobalEventBus.unsubscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        GlobalEventBus.unsubscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
        GlobalEventBus.unsubscribe<BlockUndoneEvent>(EVT_BLOCK_UNDONE, this._onBlockUndone);
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
        this.play(this.blockSlideClip);
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
        this.play(this.blockBlockedClip);
    }

    private onMainPathClear(_event: MainPathClearEvent): void {
        this.play(this.pathClearClip);
    }

    private onMainDriveStart(_event: MainDriveStartEvent): void {
        this.play(this.mainDriveClip);
    }

    private onMainReachedExit(_event: MainReachedExitEvent): void {
        this.play(this.exitWhooshClip);
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
        this.play(this.blockSlideClip);
    }

    // Замьюченный контейнер (start_muted) и явный plbx.is_audio()=false должны молчать без исключений —
    // OPEN_ISSUES.md #9 требует видимую mute-кнопку отдельно, здесь только гейт на воспроизведение.
    private play(clip: AudioClip | null): void {
        if (!clip || !this.audioSource || Playbox.is_muted() || !Playbox.is_audio()) {
            return;
        }
        this.audioSource.playOneShot(clip);
    }
}
