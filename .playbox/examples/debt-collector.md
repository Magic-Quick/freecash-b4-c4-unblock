# Пример проекта: Merge Playable «Debt Collector»

Это **референс-пример** заполнения проектного контракта для `/build-playable`.
Он показывает, какого уровня конкретики ждут агенты в `GDD.md` / `AGENTS.md` / `ARCHITECTURE.md`
и в доках `.playbox/game-design/`. Копируй структуру, а не значения — под новый плейбл значения свои.

> Как использовать: разложи разделы ниже по своим source-of-truth докам (GDD/AGENTS/SCENE_SETUP/ASSET_SPEC),
> затем запусти `/build-playable`. Команда читает именно те доки, а не этот файл.

---

## Концепт

Merge-плейбл: игрок сливает чемоданы (L0→L3), зарабатывает баланс, в середине появляется
«коллектор»-блокер, которого нужно затапать, затем финальный мердж двух сейфов → климакс → CTA.

## GameConfig (тюнинг)

- `mergeRewards: number[] = [2, 2.5, 3, 3, 3.5]`
- `finalReward: number = 5`
- `collectorTaps: number = 12`
- `gridRows = 3`, `gridCols = 3`, `cellSize = 180`, `spacing = 12`
- Сохранить существующие `allowSwap`, `allowMoveToEmpty`, синглтон `instance`.

## Фазы состояния

`enum GamePhase { FTUE=0, MERGE_SESSION=1, BLOCKER=2, CLIMAX=3, CTA=4 }`

## События EventBus (добавить в конец events.ts)

`EVT_PHASE_CHANGED`, `EVT_BALANCE_CHANGED`, `EVT_COLLECTOR_HIT`, `EVT_COLLECTOR_DEFEATED`,
`EVT_FINAL_MERGE`, `EVT_REQUEST_CTA` — с соответствующими `*Event` интерфейсами.

## Systems

- **GameStateSystem** — держит `GameStateModel`; подписан на `EVT_CELL_MERGED`, `EVT_COLLECTOR_DEFEATED`,
  `EVT_FINAL_MERGE`; переключает фазы, публикует `EVT_PHASE_CHANGED`; экспортирует `getModel()`.
- **BalanceSystem** — на `EVT_CELL_MERGED`/`EVT_FINAL_MERGE` начисляет награду (`mergeRewards`/`finalReward`),
  публикует `EVT_BALANCE_CHANGED` с флагом `isFinal`; финал только в фазе CLIMAX.
- **SpawnSystem** — `@property(Node) bootstrapNode`; на `EVT_CELL_MERGED`: merge #1 → 3×L0 в пустые ячейки,
  #2–4 → 1–2×L0, #5 → ничего; на `EVT_COLLECTOR_DEFEATED` → ровно 2 сейфа (L3). Пустые ячейки — `grid.getEmptyCells()`.
- **CollectorSystem** — `@property(Node) viewNode` (CollectorView); активируется на BLOCKER; на `EVT_TAP`
  проверяет `view.isHit(x, y)`, уменьшает health, публикует `EVT_COLLECTOR_HIT`; при health==0 → `EVT_COLLECTOR_DEFEATED`.
- **TutorialSystem** — `@property(Node) fingerViewNode`, `@property([Node]) demoCells`; палец на старте,
  скрыть после первого `EVT_CELL_MERGED`.
- **FinalPhaseSystem** — оркестратор климакса. На CLIMAX ждёт спавн сейфов; слушает `EVT_DRAG_END`/`EVT_CELL_SWAPPED`;
  при столкновении двух сейфов в CLIMAX публикует `EVT_FINAL_MERGE`, запускает shake + money fountain,
  затем `EVT_REQUEST_CTA` с `totalBalance=19.00`. NB: MergeController не сольёт L3+L3 (isMaxLevel) — детектим столкновение сами.
- **SoundSystem** — STUB: пустой Component на `EVT_PLAY_SOUND`.

## Views

`BalanceView` (лейбл `$X.XX`, reward popup, bounce монеты), `CollectorView` (`show/hide/isHit/onHit/flyAway`,
stun-bar, dim-overlay), `TutorialFingerView` (drag-петля между двумя Vec3), `MoneyFountainView`
(20 купюр tween-разлётом), `ScreenShakeView` (`@property(Camera)`, shake на `EVT_FINAL_MERGE`),
`CTAView` (панель, лейбл баланса, pulse-кнопка, `plbx.download()` на клик), `CellDecoratorView` (опц. spark+bounce).

## Ассеты

Sprites (180×180, кроме коллектора 240×360): `suitcase_l0..l3`, `collector_body`, `cell_bg`, `background` (720×1280),
`spark` (128), `finger` (80×120). UI: `freecash_logo`, `coin` (80), `bill_green`/`bill_gold` (120×60),
`button_green` (320×90), `panel_wood` (640×640), `stun_bar_bg` (240×40), `stun_bar_fill` (220×28).
Цветовые коды и стиль — см. промпт `cocos-asset-maker`.

## Сцена (720×1280, origin 360,640)

```
Canvas
├── Camera
├── Background (background.png, fit)
├── GridBackground (panel_wood, 600×600, pos 0,-50)
├── Grid (3×3, cellSize=180, spacing=12, pos 0,-50)
├── DimOverlay (чёрный alpha 0, fullscreen, active=false)
├── CollectorContainer (pos 0,-50)
├── UI_Top (pos 0,550): CurrentSessionLabel, BalancePanel(CoinIcon + BalanceLabel "$0.00"), BalanceView
├── TutorialFingerContainer / MoneyFountainContainer (pos 0,-50)
├── CTAOverlay (active=false): BlackBg, Panel(FreecashLogo, TitleLabel, BalanceLabel "$19.00", CashOutButton), CTAView
└── GameManager: GameEntryPoint + Systems(GameState, Balance, Spawn, Collector, Tutorial, FinalPhase, Sound)
```

## Ручные шаги в редакторе (после сборки)

1. Открыть `assets/scene.scene` — Cocos сгенерирует `.meta`.
2. В `System/CellBase.icons[]` прокинуть 4 SpriteFrame: `suitcase_l0..l3`.
3. Play → пройти тест-сценарий (см. `.playbox/game-design/QA_CHECKLIST.md`).

## Известные ограничения

- Звук — stub.
- CTA-URL — плейсхолдер, подставляется рекламодателем.
