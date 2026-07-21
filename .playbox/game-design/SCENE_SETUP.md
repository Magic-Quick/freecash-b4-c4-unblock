# SCENE_SETUP — «Unblock» (Freecash B4C4)

> Рецепт иерархии сцены для `cocos-scene-builder`. Правки — только через MCP `plbx-cocos`
> (`apply_edits` с `dryRun` → запись → `validate_document`). Адресация по пути/`_id`, не `__id__`.

## Canvas
- Размер (designResolution): **720×1280**, origin **360,640**. Fit: Show All / Height (проверить в get_project_info).

## Целевая иерархия
```
Canvas
├── Camera
├── BackgroundLayer
│   └── Background            (Sprite background.png, Widget: stretch all)
├── SafeArea                  (cc.SafeArea + Widget)
│   ├── HudLayer              (Widget: top)
│   │   ├── LevelPanel        (panel.png; "LEVEL" + LevelNumberLabel + Stars)   [HudView]
│   │   ├── MovesPanel        (panel.png; "MOVES" + MovesLabel + RecordLabel)   [декор]
│   │   └── CoinCounter       (coin_fc.png + FcLabel "0")                        [CoinCounterView]
│   ├── GameplayLayer         (центр, pos ~0,-40)
│   │   ├── BoardFrame        (board_frame.png 9-slice, под размер поля)
│   │   ├── CellsContainer    (пусто; BoardView спавнит Cell.prefab)
│   │   ├── BlocksContainer   (пусто; BoardView спавнит Block.prefab)
│   │   ├── Board             (пустая нода-якорь)                                [BoardView]
│   │   └── ExitArrow         (exit_arrow.png у правого края, на строке выхода)  [ExitArrowView]
│   ├── TutorialLayer
│   │   └── Finger            (finger.png)                                       [TutorialFingerView]
│   ├── FxLayer
│   │   ├── MoneyFountain     (пустой контейнер)                                 [MoneyFountainView]
│   │   └── Sparks            (spark.png, active=false — включает MoneyFountainView.flashExit())
│   └── DisclaimerLabel       ("For illustration purposes only", низ, всегда виден) [DisclaimerView]
├── CTAOverlay                (active=false)
│   ├── Dim                   (чёрный Sprite alpha ~0.6, fullscreen)
│   └── Panel                 (panel.png)                                        [CTAView]
│       ├── FreecashLogo      (freecash_logo.png)
│       ├── TitleLabel        ("LEVEL COMPLETE")
│       ├── FcRow             (пустой контейнер)
│       │   ├── FcIcon        (coin_fc.png, отдельная нода — сохраняет квадратный аспект иконки)
│       │   └── FcTotalLabel  ("19")
│       └── PlayButton        (button_play.png, "PLAY & EARN")
└── GameManager
    ├── GameEntryPoint        [GameConfig, GameEntryPoint]
    ├── Systems
    │   ├── GameStateSystem   [GameStateSystem]
    │   ├── BoardSystem       [BoardSystem]
    │   ├── DriveSystem       [DriveSystem]
    │   ├── RewardSystem      [RewardSystem]
    │   ├── TutorialSystem    [TutorialSystem]
    │   └── SoundSystem       [SoundSystem]
    ├── InputRouter           [InputRouter]  — глобальный tap-счётчик, см. Фаза 3 handoff
    └── LayoutAdapter         [LayoutAdapter] — детекция ориентации, см. Фаза 3 handoff / OPEN_ISSUES #7
```

`GameConfig` живёт как компонент на самой ноде `GameEntryPoint` (не отдельная нода) — так его читают
`GameEntryPoint.config` и все `*.config`-ссылки систем/views по одному и тому же node-пути (Фаза 5, готово).

## Wiring (@property → нода/компонент)
| Компонент.свойство | Цель (путь или ассет) |
|--------------------|-----------------------|
| `GameEntryPoint.config` | `GameManager/GameEntryPoint` (GameConfig on same node) |
| `GameEntryPoint.gameStateSystem` | `GameManager/Systems/GameStateSystem` |
| `GameEntryPoint.boardSystem` | `GameManager/Systems/BoardSystem` |
| `GameEntryPoint.driveSystem` | `GameManager/Systems/DriveSystem` |
| `GameEntryPoint.rewardSystem` | `GameManager/Systems/RewardSystem` |
| `GameEntryPoint.tutorialSystem` | `GameManager/Systems/TutorialSystem` |
| `GameEntryPoint.ctaView` | `CTAOverlay/Panel` (CTAView) |
| `BoardSystem.config` | `GameManager/GameEntryPoint` (GameConfig) |
| `RewardSystem.config` | `GameManager/GameEntryPoint` (GameConfig) |
| `TutorialSystem.config` | `GameManager/GameEntryPoint` (GameConfig) |
| `BoardView.config` | `GameManager/GameEntryPoint` (GameConfig) |
| `BoardView.cellPrefab` | `db://assets/prefabs/Cell.prefab` |
| `BoardView.blockPrefab` | `db://assets/prefabs/Block.prefab` |
| `MoneyFountainView.coinFxPrefab` | `db://assets/prefabs/CoinFx.prefab` |
| `MoneyFountainView.sparksNode` | `.../FxLayer/Sparks` |
| `BoardView.cellsContainer` | `.../GameplayLayer/CellsContainer` |
| `BoardView.blocksContainer` | `.../GameplayLayer/BlocksContainer` |
| `BoardView.exitArrow` | `.../GameplayLayer/ExitArrow` (ExitArrowView) |
| `CTAView.logoNode` | `CTAOverlay/Panel/FreecashLogo` |
| `CTAView.titleLabel` | `CTAOverlay/Panel/TitleLabel` (Label) |
| `CTAView.fcLabel` | `CTAOverlay/Panel/FcRow/FcTotalLabel` (Label) |
| `CTAView.playButton` | `CTAOverlay/Panel/PlayButton` (Button) |
| `CoinCounterView.label` | `.../HudLayer/CoinCounter/FcLabel` (Label) |

## Placeholder-политика
- Ассеты без UUID (напр. клиентский логотип) → `@property = null` + запись в `OPEN_ISSUES.md` как ручной шаг.
- Без fake UUID и ручных `.meta`.

## Адаптив (GDD §4)
- Portrait — базовая раскладка выше. Landscape — обязателен: HUD-панели по краям, поле по центру.
  Реализация: `Widget` на слоях + компонент-адаптер, переключающий раскладку по aspect ratio (см. OPEN_ISSUES #7).
- Ключевое правило: поле и CTA-кнопка полностью в видимой области в обеих ориентациях, ничего не обрезается.

## Legacy-ноды
Нет (проект чистый `NewProject`). Все ноды создаются с нуля.
