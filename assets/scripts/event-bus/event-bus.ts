type EventCallback<T> = (payload: T) => void;

// Единственный путь межсистемной связи (ARCHITECTURE.md §1). Статический класс — один общий шина на всю сессию.
export class GlobalEventBus {
    private static readonly listeners: Map<string, Set<EventCallback<any>>> = new Map();

    public static subscribe<T>(evt: string, cb: EventCallback<T>): void {
        let set = GlobalEventBus.listeners.get(evt);
        if (!set) {
            set = new Set();
            GlobalEventBus.listeners.set(evt, set);
        }
        set.add(cb);
    }

    public static unsubscribe<T>(evt: string, cb: EventCallback<T>): void {
        GlobalEventBus.listeners.get(evt)?.delete(cb);
    }

    public static publish<T>(evt: string, payload: T): void {
        const set = GlobalEventBus.listeners.get(evt);
        if (!set || set.size === 0) {
            return;
        }
        // Копия набора: подписчик может отписаться (unsubscribe) прямо внутри своего коллбека.
        Array.from(set).forEach((cb) => cb(payload));
    }
}
