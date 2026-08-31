// Безопасная обёртка над playable-SDK сети (см. PLBX_LIFECYCLE_GUIDE.md, ARCHITECTURE.md §6).
//
// ВАЖНО: сборка Playbox инжектит глобал `window.plbx_html` (у старых сборок — `window.super_html`),
// а НЕ `window.plbx`. Раньше resolve шёл по `window.plbx`, поэтому все вызовы (в т.ч. download()
// по клику CTA и set_app_store_url/set_google_play_url) молча становились no-op: ссылки на сторы
// лежали в бандле и были видны в билде, но до SDK не доезжали и редиректа не происходило.
//
// Разрешение глобала и цепочка plbx_html → super_html целиком делегированы сгенерированному
// расширением адаптеру `plbx_html/plbx_html_playable.ts` — единственному файлу, который знает
// актуальные имена API сетей и обновляется вместе с расширением. Здесь остаётся только защита от
// окружения без `window` (Cocos Editor / нода): там всё превращается в no-op и ничего не бросает.
import plbx from '../plbx_html/plbx_html_playable';

function api(): typeof plbx | null {
    return typeof window === 'undefined' ? null : plbx;
}

export class Playbox {
    // Вызывать ровно один раз за сессию — из GameEntryPoint после wiring сцены.
    public static game_ready(): void {
        api()?.game_ready();
    }

    // Центральный input-handler дергает это на TOUCH_START/MOUSE_DOWN с дебаунсом 100ms (см. гайд).
    public static tap(): void {
        api()?.tap();
    }

    // Клик по CTA-кнопке.
    public static download(): void {
        api()?.download();
    }

    // Показ CTA — терминальное состояние геймплея.
    public static game_end(): void {
        api()?.game_end();
    }

    // По умолчанию не замьючено, если контейнер сети не сообщил обратное.
    public static is_muted(): boolean {
        return api()?.is_muted() ?? false;
    }

    public static on_mute_change(cb: (muted: boolean) => void): void {
        api()?.on_mute_change(cb);
    }

    // По умолчанию звук разрешён, если сеть не запретила его явно.
    public static is_audio(): boolean {
        return api()?.is_audio() ?? true;
    }

    public static expose(name: string, fn: () => void, label?: string): void {
        api()?.expose(name, fn, label);
    }

    // Вызывать один раз в onLoad композиционного корня, до game_ready() (см. PLBX_LIFECYCLE_GUIDE.md).
    public static set_app_store_url(url: string): void {
        api()?.set_app_store_url(url);
    }

    public static set_google_play_url(url: string): void {
        api()?.set_google_play_url(url);
    }
}
