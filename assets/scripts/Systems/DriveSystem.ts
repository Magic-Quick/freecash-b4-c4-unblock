import { _decorator, Component } from 'cc';
import { GamePhase } from '../Models/GamePhase';
import { GlobalEventBus } from '../event-bus/event-bus';
import {
    EVT_MAIN_PATH_CLEAR,
    MainPathClearEvent,
    EVT_MAIN_DRIVE_START,
    MainDriveStartEvent,
    EVT_MAIN_REACHED_EXIT,
    MainReachedExitEvent,
    EVT_LEVEL_SOLVED,
    LevelSolvedEvent,
} from '../event-bus/events';
import { GameStateSystem } from './GameStateSystem';

const { ccclass } = _decorator;

// Автопроезд главного блока — только оркестрация, сам визуальный проезд делает View (Фаза 3).
// EVT_MAIN_REACHED_EXIT сюда придёт от View (BlockView.driveToExit() → сигнал по завершении твина);
// здесь его нарочно не симулируют таймером — это чужая (View) зона ответственности.
@ccclass('DriveSystem')
export class DriveSystem extends Component {
    private readonly _onMainPathClear = this.onMainPathClear.bind(this);
    private readonly _onMainReachedExit = this.onMainReachedExit.bind(this);

    protected onLoad(): void {
        GlobalEventBus.subscribe<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, this._onMainPathClear);
        GlobalEventBus.subscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
    }

    protected onDestroy(): void {
        GlobalEventBus.unsubscribe<MainPathClearEvent>(EVT_MAIN_PATH_CLEAR, this._onMainPathClear);
        GlobalEventBus.unsubscribe<MainReachedExitEvent>(EVT_MAIN_REACHED_EXIT, this._onMainReachedExit);
    }

    private onMainPathClear(): void {
        const model = GameStateSystem.model;
        const level = model.currentLevel;
        // Guard на GameStateModel — drive стартует не более одного раза на уровень (защита от повторных
        // EVT_MAIN_PATH_CLEAR при быстрых повторных свайпах, гейт Фазы 2).
        if (!model.tryStartDrive(level)) {
            return;
        }
        // Явный выход из LEVEL_PLAY — canAcceptInput() сразу перестаёт пропускать свайпы на время проезда.
        model.phase = GamePhase.LEVEL_DRIVE;
        GlobalEventBus.publish<MainDriveStartEvent>(EVT_MAIN_DRIVE_START, {});
    }

    private onMainReachedExit(event: MainReachedExitEvent): void {
        GlobalEventBus.publish<LevelSolvedEvent>(EVT_LEVEL_SOLVED, { level: event.level });
    }
}
