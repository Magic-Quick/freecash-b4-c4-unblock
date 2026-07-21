import { _decorator, Component } from 'cc';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_PLAY_SOUND, PlaySoundEvent } from '../event-bus/events';

const { ccclass } = _decorator;

// Stub (AGENTS.md §7 / OPEN_ISSUES.md): звук в прототипе не реализован, но подписка/отписка уже
// соответствует финальному контракту, чтобы подключение реального аудио не требовало правок в других системах.
@ccclass('SoundSystem')
export class SoundSystem extends Component {
    private readonly _onPlaySound = this.onPlaySound.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<PlaySoundEvent>(EVT_PLAY_SOUND, this._onPlaySound);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<PlaySoundEvent>(EVT_PLAY_SOUND, this._onPlaySound);
    }

    private onPlaySound(_event: PlaySoundEvent): void {
        // No-op stub — реальный AudioController появится позже (OPEN_ISSUES.md #9).
    }
}
