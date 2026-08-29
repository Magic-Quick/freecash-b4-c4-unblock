import { _decorator, Component, Node } from 'cc';
import { GameConfig } from './GameConfig';
import { Playbox } from './Playbox';

const { ccclass, property } = _decorator;

// Композиционный корень (ARCHITECTURE.md §4/§6): единственное место явного wiring систем и
// единоразового старта Playbox lifecycle. Системные ссылки типизированы как Node — конкретные
// System-компоненты (GameStateSystem/BoardSystem/DriveSystem/RewardSystem/TutorialSystem) создаются
// в Фазе 2 (IMPLEMENTATION_PHASES.md); cocos-scene-builder уже может привязать ноды по SCENE_SETUP.md,
// типы `@property` уточнятся после Фазы 2 без изменения путей wiring.
@ccclass('GameEntryPoint')
export class GameEntryPoint extends Component {
    @property(GameConfig)
    public config: GameConfig | null = null;

    @property(Node)
    public gameStateSystem: Node | null = null;

    @property(Node)
    public boardSystem: Node | null = null;

    @property(Node)
    public driveSystem: Node | null = null;

    @property(Node)
    public rewardSystem: Node | null = null;

    @property(Node)
    public tutorialSystem: Node | null = null;

    @property(Node)
    public ctaView: Node | null = null;

    // Ссылки на карточки в сторах (GDD.md §8/§App Links, EXPORT_CHECKLIST.md) — задаются один раз
    // до game_ready(), сама маршрутизация по платформе — на стороне plbx (PLBX_LIFECYCLE_GUIDE.md).
    private static readonly APP_STORE_URL = 'https://apps.apple.com/app/id1673567402';
    private static readonly GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.freecash.app2';

    // Защита от повторной инициализации (например, повторный onLoad при hot-reload в редакторе).
    private _initialized = false;

    protected onLoad(): void {
        if (this._initialized) {
            return;
        }
        this._initialized = true;
        Playbox.set_app_store_url(GameEntryPoint.APP_STORE_URL);
        Playbox.set_google_play_url(GameEntryPoint.GOOGLE_PLAY_URL);
        // Явное подключение систем к EventBus происходит внутри самих System-компонентов (Фаза 2);
        // здесь фиксируется только состав ссылок композиционного корня.
    }

    protected start(): void {
        if (!this._initialized) {
            return;
        }
        // Ровно один раз за сессию, после того как wiring сцены готов (ARCHITECTURE.md §6).
        Playbox.game_ready();
    }
}
