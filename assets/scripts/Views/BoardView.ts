import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { LevelsDataFile } from '../Models/BoardModel';
import { BlockModel } from '../Models/BlockModel';
import { BlockView } from './BlockView';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_LEVEL_STARTED,
    LevelStartedEvent,
    EVT_BLOCK_MOVED,
    BlockMovedEvent,
    EVT_BLOCK_BLOCKED,
    BlockBlockedEvent,
    EVT_MAIN_DRIVE_START,
    MainDriveStartEvent,
} from '../event-bus/events';

const { ccclass, property } = _decorator;

// Визуальный слой поля (ARCHITECTURE.md §3). Раскладку блоков читает из GameConfig.levelsData
// самостоятельно — это статичные данные для спавна визуала, не дублирование правил BoardSystem:
// коллизии/сдвиги остаются только там, BoardView лишь синхронизирует позиции по её событиям.
@ccclass('BoardView')
export class BoardView extends Component {
    @property(GameConfig)
    public config: GameConfig | null = null;

    @property(Prefab)
    public cellPrefab: Prefab | null = null;

    @property(Prefab)
    public blockPrefab: Prefab | null = null;

    @property(Node)
    public cellsContainer: Node | null = null;

    @property(Node)
    public blocksContainer: Node | null = null;

    @property(Node)
    public exitArrow: Node | null = null;

    private readonly blockViews: Map<number, BlockView> = new Map();
    // Ссылка на View главного блока — нужна, чтобы по EVT_MAIN_DRIVE_START вызвать driveToExit()
    // без find()/getComponentInChildren(): BoardView и так держит map blockId→BlockView при спавне.
    private mainBlockView: BlockView | null = null;

    private readonly _onLevelStarted = this.onLevelStarted.bind(this);
    private readonly _onBlockMoved = this.onBlockMoved.bind(this);
    private readonly _onBlockBlocked = this.onBlockBlocked.bind(this);
    private readonly _onMainDriveStart = this.onMainDriveStart.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.subscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.subscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.subscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.unsubscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.unsubscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.unsubscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        this.clearLevel();
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
        this.buildLevel(levelData.blocks, event.level);
    }

    // Строит визуальный уровень с нуля: чистит предыдущий, спавнит ячейки сетки и блоки из данных
    // уровня. Позиционирование — из GameConfig.cellSize/cellSpacing, никаких пиксельных литералов.
    public buildLevel(blocks: BlockModel[], level: number): void {
        this.clearLevel();
        if (!this.config) {
            return;
        }
        // "Шаг сетки" — cellSize+cellSpacing одним числом; та же величина передаётся в BlockView.setup()
        // и используется TutorialFingerView, чтобы все Views считали позиции в одной системе координат.
        const pitch = this.config.cellSize + this.config.cellSpacing;
        // Центрирующий сдвиг: без него ячейка (0,0) рисуется в локальном (0,0) контейнера, а не в его
        // углу — вся сетка уезжает в правый нижний квадрант относительно центрированного BoardFrame
        // (контейнеры без anchorPoint-смещения детей, см. SCENE_SETUP.md). Тот же расчёт в
        // BlockView.setup()/TutorialFingerView.showHint() — все три View обязаны рисовать в одном месте.
        const offsetX = -(this.config.gridCols * pitch) / 2;
        const offsetY = (this.config.gridRows * pitch) / 2;
        if (this.cellPrefab && this.cellsContainer) {
            for (let row = 0; row < this.config.gridRows; row++) {
                for (let col = 0; col < this.config.gridCols; col++) {
                    const cellNode = instantiate(this.cellPrefab);
                    cellNode.setPosition((col + 0.5) * pitch + offsetX, -(row + 0.5) * pitch + offsetY, 0);
                    this.cellsContainer.addChild(cellNode);
                }
            }
        }
        if (this.blockPrefab && this.blocksContainer) {
            blocks.forEach((block) => {
                const blockNode = instantiate(this.blockPrefab as Prefab);
                this.blocksContainer!.addChild(blockNode);
                const blockView = blockNode.getComponent(BlockView);
                if (!blockView) {
                    return;
                }
                // BlockView instantiates at runtime — a prefab @property can't be wired to the
                // scene's GameConfig node ahead of time, so BoardView forwards its own reference.
                blockView.config = this.config;
                blockView.setup(block, pitch, level);
                this.blockViews.set(block.id, blockView);
                if (block.isMain) {
                    this.mainBlockView = blockView;
                }
            });
        }
    }

    public clearLevel(): void {
        this.blockViews.clear();
        this.mainBlockView = null;
        // destroy(), не removeAllChildren(): removeAllChildren() только отсоединяет ноду от родителя,
        // не вызывает onDestroy() — активные твины/touch-листенеры BlockView (см. BlockView.onDestroy())
        // никогда бы не остановились, а просто продолжали жить на осиротевшей ноде (реальный leak при
        // каждом переходе между уровнями).
        this.destroyAllChildren(this.cellsContainer);
        this.destroyAllChildren(this.blocksContainer);
    }

    private destroyAllChildren(container: Node | null): void {
        if (!container) {
            return;
        }
        // Копия массива: destroy() синхронно укорачивает container.children, обход исходного массива
        // пропустил бы элементы.
        container.children.slice().forEach((child) => child.destroy());
    }

    private onBlockMoved(event: BlockMovedEvent): void {
        this.blockViews.get(event.blockId)?.slideTo(event.toCell);
    }

    private onBlockBlocked(event: BlockBlockedEvent): void {
        this.blockViews.get(event.blockId)?.playBlocked();
    }

    // DriveSystem ждёт EVT_MAIN_REACHED_EXIT именно от View главного блока (ARCHITECTURE.md §2) —
    // BoardView уже знает, какой BlockView главный (isMain), поэтому именно оно решает, кому дать
    // команду на автопроезд, вместо find()/getComponentInChildren() по сцене.
    private onMainDriveStart(): void {
        this.mainBlockView?.driveToExit();
    }
}
