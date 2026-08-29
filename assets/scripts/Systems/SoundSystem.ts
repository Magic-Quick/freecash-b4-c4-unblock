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
    EVT_MAIN_BLOCKED,
    MainBlockedEvent,
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
    EVT_UNDO_REQUEST,
    UndoRequestEvent,
    EVT_RESTART_REQUEST,
    RestartRequestEvent,
    EVT_HINT_REQUEST,
    HintRequestEvent,
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

    // Общий UI-клик на все кнопки нижнего бара и CTA (Undo/Restart/Hint/Play & Earn) — по своему
    // generate_audio prompt это универсальный "UI button press", не завязанный на конкретную кнопку.
    @property(AudioClip)
    private uiTapClip: AudioClip | null = null;

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
    private readonly _onMainBlocked = this.onMainBlocked.bind(this);
    private readonly _onLevelSolved = this.onLevelSolved.bind(this);
    private readonly _onUiTap = this.onUiTap.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.subscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.subscribe<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, this._onMainPathClear);
        GlobalEventBus.subscribe<MainBlockedEvent>(EVT_MAIN_BLOCKED, this._onMainBlocked);
        GlobalEventBus.subscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        GlobalEventBus.subscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
        GlobalEventBus.subscribe<BlockUndoneEvent>(EVT_BLOCK_UNDONE, this._onBlockUndone);
        GlobalEventBus.subscribe<LevelSolvedEvent>(EVT_LEVEL_SOLVED, this._onLevelSolved);
        GlobalEventBus.subscribe<CtaClickedEvent>(EVT_CTA_CLICKED, this._onUiTap);
        GlobalEventBus.subscribe<UndoRequestEvent>(EVT_UNDO_REQUEST, this._onUiTap);
        GlobalEventBus.subscribe<RestartRequestEvent>(EVT_RESTART_REQUEST, this._onUiTap);
        GlobalEventBus.subscribe<HintRequestEvent>(EVT_HINT_REQUEST, this._onUiTap);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.unsubscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.unsubscribe<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, this._onMainPathClear);
        GlobalEventBus.unsubscribe<MainBlockedEvent>(EVT_MAIN_BLOCKED, this._onMainBlocked);
        GlobalEventBus.unsubscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        GlobalEventBus.unsubscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
        GlobalEventBus.unsubscribe<BlockUndoneEvent>(EVT_BLOCK_UNDONE, this._onBlockUndone);
        GlobalEventBus.unsubscribe<LevelSolvedEvent>(EVT_LEVEL_SOLVED, this._onLevelSolved);
        GlobalEventBus.unsubscribe<CtaClickedEvent>(EVT_CTA_CLICKED, this._onUiTap);
        GlobalEventBus.unsubscribe<UndoRequestEvent>(EVT_UNDO_REQUEST, this._onUiTap);
        GlobalEventBus.unsubscribe<RestartRequestEvent>(EVT_RESTART_REQUEST, this._onUiTap);
        GlobalEventBus.unsubscribe<HintRequestEvent>(EVT_HINT_REQUEST, this._onUiTap);
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

    // Путь к выходу перекрылся заново после того, как уже был свободен (BoardSystem.checkMainPath —
    // debounced по факту смены состояния, не на каждую проверку) — раньше это было беззвучно, хотя
    // path_clear его открытие уже озвучивает. Переиспользуем block_blocked: та же семантика "нельзя".
    private onMainBlocked(_event: MainBlockedEvent): void {
        this.play(this.blockBlockedClip, SoundSystem.VOL_MOVEMENT);
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

    // Общий клик для CTA/Undo/Restart/Hint (EVT_CTA_CLICKED/EVT_UNDO_REQUEST/EVT_RESTART_REQUEST/
    // EVT_HINT_REQUEST) — все четыре публикуются View'ами только когда кнопка реально interactable
    // (BottomBarView.refreshInteractable/CTAView), так что здесь не нужен дополнительный гейт.
    private onUiTap(): void {
        this.play(this.uiTapClip, SoundSystem.VOL_MOVEMENT);
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
