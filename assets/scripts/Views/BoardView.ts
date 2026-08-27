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
    EVT_BLOCK_UNDONE,
    BlockUndoneEvent,
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
    public blockPrefab: Prefab | null = null;

    @property(Node)
    public blocksContainer: Node | null = null;

    // Статичная накладка выреза рамки — позиционируется по exitRow уровня (DESIGN_UPDATE_PLAN.md §2/5.4).
    @property(Node)
    public exitNotch: Node | null = null;

    // Пульсирующие стрелки поверх ExitNotch — та же позиция, отдельная нода (план 4.7).
    @property(Node)
    public exitArrows: Node | null = null;

    private readonly blockViews: Map<number, BlockView> = new Map();
    // Ссылка на View главного блока — нужна, чтобы по EVT_MAIN_DRIVE_START вызвать driveToExit()
    // без find()/getComponentInChildren(): BoardView и так держит map blockId→BlockView при спавне.
    private mainBlockView: BlockView | null = null;

    private readonly _onLevelStarted = this.onLevelStarted.bind(this);
    private readonly _onBlockMoved = this.onBlockMoved.bind(this);
    private readonly _onBlockBlocked = this.onBlockBlocked.bind(this);
    private readonly _onMainDriveStart = this.onMainDriveStart.bind(this);
    private readonly _onBlockUndone = this.onBlockUndone.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.subscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.subscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.subscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        GlobalEventBus.subscribe<BlockUndoneEvent>(EVT_BLOCK_UNDONE, this._onBlockUndone);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<LevelStartedEvent>(EVT_LEVEL_STARTED, this._onLevelStarted);
        GlobalEventBus.unsubscribe<BlockMovedEvent>(EVT_BLOCK_MOVED, this._onBlockMoved);
        GlobalEventBus.unsubscribe<BlockBlockedEvent>(EVT_BLOCK_BLOCKED, this._onBlockBlocked);
        GlobalEventBus.unsubscribe<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, this._onMainDriveStart);
        GlobalEventBus.unsubscribe<BlockUndoneEvent>(EVT_BLOCK_UNDONE, this._onBlockUndone);
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
        this.buildLevel(levelData.blocks, levelData.exitRow, event.level);
    }

    // Строит визуальный уровень с нуля: чистит предыдущий, спавнит блоки из данных уровня и
    // переставляет ExitNotch/ExitArrows на строку выхода. Позиционирование — из
    // GameConfig.colPitch/rowPitch и inner rect платы, никаких пиксельных литералов (плата — цельный
    // запечённый арт, Cell-слоя больше нет, DESIGN_UPDATE_PLAN.md §5 Шаг 4.2).
    public buildLevel(blocks: BlockModel[], exitRow: number, level: number): void {
        this.clearLevel();
        if (!this.config) {
            return;
        }
        // Шаг сетки по X/Y (ячейка не квадратная, DESIGN_UPDATE_PLAN.md §2) — те же значения
        // передаются в BlockView.setup() и используются TutorialFingerView, чтобы все Views считали
        // позиции в одной системе координат.
        const colPitch = this.config.colPitch;
        const rowPitch = this.config.rowPitch;
        // Сдвиг к левому-верхнему углу внутреннего поля платы: без него ячейка (0,0) рисуется в
        // локальном (0,0) контейнера, а не в углу поля (контейнеры без anchorPoint-смещения детей,
        // см. SCENE_SETUP.md). Тот же расчёт в BlockView.setup()/TutorialFingerView.showHint() — все
        // три View обязаны рисовать в одном месте. Берём его из GameConfig.gridOrigin*, а не как
        // -(gridCols*colPitch)/2: поле на Board_full.png НЕ отцентровано в текстуре (карман выхода
        // запечён справа), и «центрирующая» формула увела бы всю сетку вправо на ~25 design-units.
        const offsetX = this.config.gridOriginX;
        const offsetY = this.config.gridOriginY;
        this.positionExit(exitRow, offsetX, offsetY, rowPitch);
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
                blockView.setup(block, colPitch, rowPitch, level);
                this.blockViews.set(block.id, blockView);
                if (block.isMain) {
                    this.mainBlockView = blockView;
                }
            });
        }
    }

    // Позиционирует ExitNotch/ExitArrows по exitRow уровня (DESIGN_UPDATE_PLAN.md §2/5.4): карман
    // выхода снят в текстурных координатах платы (exitNotchOffsetX/Width), но проецируется в
    // design-units через GameConfig.exitNotchCenterOffsetX (та же scaleX, что и у colPitch) — иначе
    // offsetX (уже design-units) складывался бы с сырыми texture-px величинами. Строка выхода
    // определяет только Y. Формула Y совпадает с cellToLocal() для row=exitRow (§2: "y_центр =
    // rowLine[R] + rowPitch/2" — тот же центр ячейки), поэтому стрелки всегда встают вровень с рядом
    // блоков, а не по отдельной логике.
    // Обе ноды — дети `Board` (ноды этого компонента), т.е. живут в той же системе координат, что и
    // BlocksContainer: центр платы. Раньше они были сиблингами GameplayLayer, чей центр на 20
    // design-units ниже центра платы, и любая расчётная позиция промахивалась ровно на эти 20.
    // На Board_full.png карман запечён в саму плату, поэтому ExitNotch-накладка выключена в сцене —
    // ссылка остаётся опциональной, двигаем только то, что реально есть.
    private positionExit(exitRow: number, offsetX: number, offsetY: number, rowPitch: number): void {
        if (!this.config) {
            return;
        }
        const notchX = this.config.exitNotchCenterOffsetX + offsetX;
        const notchY = -(exitRow + 0.5) * rowPitch + offsetY;
        this.exitNotch?.setPosition(notchX, notchY, 0);
        this.exitArrows?.setPosition(notchX, notchY, 0);
    }

    public clearLevel(): void {
        this.blockViews.clear();
        this.mainBlockView = null;
        // destroy(), не removeAllChildren(): removeAllChildren() только отсоединяет ноду от родителя,
        // не вызывает onDestroy() — активные твины/touch-листенеры BlockView (см. BlockView.onDestroy())
        // никогда бы не остановились, а просто продолжали жить на осиротевшей ноде (реальный leak при
        // каждом переходе между уровнями).
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

    // Undo — отдельное событие от EVT_BLOCK_MOVED (DESIGN_UPDATE_PLAN.md §8.2 п.4), но визуально это
    // тот же слайд в другую сторону: fromCell/toCell уже зеркалированы BoardSystem.onUndoRequest(), так
    // что slideTo(event.toCell) без изменений двигает ноду туда, откуда блок пришёл (§8.2 п.5 — модель
    // уже обновлена, View лишь догоняет; slideTo() сам гасит предыдущий твин, ждать его не нужно).
    private onBlockUndone(event: BlockUndoneEvent): void {
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
