// Безопасная обёртка над глобальным `plbx` (см. PLBX_LIFECYCLE_GUIDE.md, ARCHITECTURE.md §6).
// В Cocos Editor / Preview без установленного расширения `plbx` не определён — тогда все методы
// становятся no-op и ничего не бросают (OPEN_ISSUES.md #3: реальный SDK инжектится на сборке под сеть).
interface PlbxApi {
    game_ready?: () => void;
    tap?: () => void;
    download?: () => void;
    game_end?: () => void;
    is_muted?: () => boolean;
    on_mute_change?: (cb: (muted: boolean) => void) => void;
    is_audio?: () => boolean;
    expose?: (name: string, fn: () => void, label?: string) => void;
}

function resolvePlbx(): PlbxApi | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const candidate = (window as any).plbx;
    return typeof candidate !== 'undefined' ? (candidate as PlbxApi) : null;
}

export class Playbox {
    // Вызывать ровно один раз за сессию — из GameEntryPoint после wiring сцены.
    public static game_ready(): void {
        resolvePlbx()?.game_ready?.();
    }

    // Центральный input-handler дергает это на TOUCH_START/MOUSE_DOWN с дебаунсом 100ms (см. гайд).
    public static tap(): void {
        resolvePlbx()?.tap?.();
    }

    // Клик по CTA-кнопке.
    public static download(): void {
        resolvePlbx()?.download?.();
    }

    // Показ CTA — терминальное состояние геймплея.
    public static game_end(): void {
        resolvePlbx()?.game_end?.();
    }

    // По умолчанию не замьючено, если контейнер сети не сообщил обратное.
    public static is_muted(): boolean {
        return resolvePlbx()?.is_muted?.() ?? false;
    }

    public static on_mute_change(cb: (muted: boolean) => void): void {
        resolvePlbx()?.on_mute_change?.(cb);
    }

    // По умолчанию звук разрешён, если сеть не запретила его явно.
    public static is_audio(): boolean {
        return resolvePlbx()?.is_audio?.() ?? true;
    }

    public static expose(name: string, fn: () => void, label?: string): void {
        resolvePlbx()?.expose?.(name, fn, label);
    }
}
