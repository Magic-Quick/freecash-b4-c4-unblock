import { _decorator, Component, Label, Sprite, SpriteFrame } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { LevelsDataFile } from '../Models/BoardModel';
import { GlobalEventBus } from '../event-bus/event-bus';
import { EVT_LEVEL_STARTED, LevelStartedEvent } from '../event-bus/events';

const { ccclass, property } = _decorator;

// LevelPanel (DESIGN_UPDATE_PLAN.md §5 Шаг 4.4, SCENE_SETUP.md): заголовок "Puzzle" — статический
// текст, задаётся прямо на ноде в сцене, HudView его не трогает (номер уровня больше не показываем,
// уровень один — решение 0.2). Звёзды и подпись сложности читаются из levels.json (difficulty.stars/
// label), а не из номера уровня — то же чтение, что BoardView/BoardSystem уже делают из
// config.levelsData (ARCHITECTURE.md §3: Views читают раскладку через GameConfig, не хардкодят).
@ccclass('HudView')
export class HudView extends Component {
    @property(GameConfig)
    public config: GameConfig | null = null;

    @property(Sprite)
    public starSprites: Sprite[] = [];

    @property(SpriteFrame)
    public starOnFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public starOffFrame: SpriteFrame | null = null;

    @property(Label)
    public difficultyLabel: Label | null = null;

    private readonly _onLevelStarted = this.onLevelStarted.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
    }

    private onLevelStarted(event: LevelStartedEvent): void {
        if (!this.config || !this.config.levelsData) {
            return;
        }
        const file = this.config.levelsData.json as LevelsDataFile;
        const levelData = file.levels.find((entry) => entry.level === event.level);
        if (!levelData) {
            return;
        }
        const stars = levelData.difficulty.stars;
        this.starSprites.forEach((sprite, index) => {
            sprite.spriteFrame = index < stars ? this.starOnFrame : this.starOffFrame;
        });
        if (this.difficultyLabel) {
            this.difficultyLabel.string = levelData.difficulty.label;
        }
    }
}
