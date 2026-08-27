# SCENE_SETUP — «Unblock» (Freecash B4C4)

> Рецепт иерархии сцены для `cocos-scene-builder`. Правки — только через MCP `plbx-cocos`
> (`apply_edits` с `dryRun` → запись → `validate_document`). Адресация по пути/`_id`, не `__id__`.
>
> Ревизия 2 (2026-08-25) — синхронизировано с `DESIGN_UPDATE_PLAN.md` Шаг 5: снят `Cell`-слой и FC-ветка,
> плата — цельный запечённый арт (§2 плана), добавлены `BottomBar` и раздельные `ExitNotch`/`ExitArrows`,
> дисклеймер переставлен под нижний бар (§8.1 плана).

## Canvas
- Размер (designResolution): **720×1280**, origin **360,640**. Fit: Show All / Height (проверить в get_project_info).

## Геометрия поля — не хардкодить

Сетка платы **запечена в `Board_full.png`** (755×679, карман выхода тоже запечён — отдельная накладка
`ExitNotch` выключена), координаты не выводятся из `cellSize`/`cellSpacing` (эти поля удалены, см. план
Шаг 2.1). Источник правды — `GameConfig`: `boardTextureSize`, `boardInner{Left,Top,Right,Bottom}`,
геттеры `colPitch`/`rowPitch`/`gridOriginX`/`gridOriginY`, `exitNotchOffsetX`/`exitNotchWidth`. Габарит
платы в дизайн-юнитах — **640×600** (`contentSize` ноды `BoardFrame`, план §2). Ни одна нода/View не
должна содержать числовой литерал этой геометрии — только чтение из `GameConfig` (ворота Шага 4 плана).

**Поле НЕ отцентровано в текстуре платы** (карман выхода занимает правое поле: 32 px слева против 92 px
справа), поэтому угол сетки берётся из `gridOriginX`/`gridOriginY`, а не как `-(gridCols*colPitch)/2`.
Следствие для сцены: всё, что позиционируется в координатах сетки (`BlocksContainer`, `Board` с его
детьми `ExitNotch`/`ExitArrows`, `TutorialLayer` с `Finger`), обязано стоять **в той же точке, что и
`BoardFrame`** — центр платы. Сейчас это `(0, 20)` внутри `GameplayLayer`/`BoardArea`.

## Целевая иерархия
```
Canvas
├── Camera
├── BackgroundLayer
│   └── Background            (Sprite art/bg/bg_gameplay.png — резкий фон геймплея, решение 0.10;
│                               Widget: stretch all; фит по правилу cover §4.4 плана — LayoutAdapter)
├── SafeArea                  (cc.SafeArea + Widget)
│   ├── HudLayer              (Widget: top)
│   │   ├── LevelPanel        (panel.png; "Puzzle" + Stars(star_on/star_off ×3, горит по
│   │   │                      difficulty.stars=1) + DifficultyLabel "Beginner")            [HudView]
│   │   ├── ChevronNext       (chevron_next.png — чистый декор, без функции; уровень один, §8.6 плана —
│   │   │                      НЕ вешать переход между уровнями)
│   │   └── MovesPanel        (panel.png; "Moves" + MovesLabel(live) + "Record" + RecordLabel("52",
│   │                          статичный декор, §8.5 плана — не менять и не оживлять)          [MovesView]
│   ├── GameplayLayer         (центр)
│   │   ├── BoardFrame        (Sprite art/board/Board_full.png 755×679 @ contentSize 640×600,
│   │   │                      type=SIMPLE, sizeMode=CUSTOM, trimmedMode=false — сетка И карман выхода
│   │   │                      уже нарисованы в текстуре, без 9-slice)                    pos (0, 20)
│   │   ├── BlocksContainer   (пусто; BoardView спавнит Block.prefab: 4 запечённых кадра len2/3 ×
│   │   │                      obst/main, type=SIMPLE, sizeMode=CUSTOM — план 5.1)        pos (0, 20)
│   │   ├── Board             (пустая нода-якорь)                            [BoardView]  pos (0, 20)
│   │   │   ├── ExitNotch     (Sprite art/board/exit_notch.png — накладка выреза для плат БЕЗ
│   │   │   │                  запечённого кармана; на Board_full.png active=false, не удалять —
│   │   │   │                  сцена держит ссылку BoardView.exitNotch)
│   │   │   └── ExitArrows    (Sprite art/board/exit_arrows.png — пульсирует отдельно, план 4.7;
│   │   │                      позиция по exitRow уровня, план §2/5.4)             [ExitArrowView]
│   ├── TutorialLayer                                                                     pos (0, 20)
│   │   └── Finger            (art/ui/finger.png — болванка, реальный спрайт руки ждём от владельца,
│   │                          план §6 вопрос A / GDD §3)                            [TutorialFingerView]
│   ├── FxLayer
│   │   └── Sparks            (art/sprites/spark.png — болванка, GDD §3; active=false, включает
│   │                          вспышку на выходе)
│   ├── BottomBar              (Widget: bottom; 4 кнопки + бейдж подсказок)             [BottomBarView]
│   │   ├── RestartButton     (art/ui/btn_restart.png) — публикует EVT_RESTART_REQUEST
│   │   ├── UndoButton        (art/ui/btn_undo.png) — публикует EVT_UNDO_REQUEST, гаснет при пустой истории
│   │   ├── HintButton        (art/ui/btn_hint.png — лампа + пустой badge)
│   │   │   └── HintBadgeLabel (Label, число из config.hintCount / EVT_HINTS_CHANGED)
│   │   └── PauseButton       (art/ui/btn_pause.png — визуал и функция без изменений, план решение 0.9 /
│   │                          §8.3: место под mute отложено до ответа по паузе, §6 вопрос B/C)
│   │       (порядок кнопок слева направо — Restart/Undo/Hint/Pause; сверить визуально на Шаге 6.1,
│   │        план не фиксирует порядок отдельно)
│   └── DisclaimerLabel       ("For illustration purposes only" — под BottomBar, план §8.1: в портрете
│                              под баром остаётся ≈245 дизайн-px запаса, дисклеймеру нужно ~30 — не
│                              конфликтует; в лендскейпе проверить отдельно на Шаге 6.1, там вертикаль
│                              сжата, а LayoutAdapter увеличивает плату)                [DisclaimerView]
├── CTAOverlay                (active=true — [CTAView] само висит здесь, см. заметку ниже)
│   ├── Dim                   (Sprite art/bg/bg_blur.png — подложка пэкшота вместо чёрного scrim,
│   │                          решение 0.10 / §8.4 плана; fullscreen; active=false до показа CTA)
│   └── Panel                 (panel.png; active=false до показа CTA)
│       ├── FreecashLogo      (Sprite art/ui/freecash_logo.png — реальный логотип вместо cc.Label
│       │                      "FREE CASH", план 5.8)
│       ├── TitleLabel        ("LEVEL COMPLETE")
│       └── PlayButton        (кастомная широкая кнопка "PLAY & EARN", рисуем сами на базе
│                              panel.png + btn_base.png — план §4.3 №1 / Шаг 1.3; финальное имя
│                              файла фиксирует cocos-asset-maker)
└── GameManager
    ├── GameEntryPoint        [GameConfig, GameEntryPoint]
    ├── Systems
    │   ├── GameStateSystem   [GameStateSystem]
    │   ├── BoardSystem       [BoardSystem]
    │   ├── DriveSystem       [DriveSystem]
    │   ├── HintSystem        [HintSystem]           — новый, план 3.3
    │   ├── TutorialSystem    [TutorialSystem]
    │   └── SoundSystem       [SoundSystem]
    ├── InputRouter           [InputRouter]  — глобальный tap-счётчик, см. Фаза 3 handoff
    └── LayoutAdapter         [LayoutAdapter] — детекция ориентации + фит фона (§4.4) + позиция
                               BottomBar/дисклеймера в обеих раскладках, см. OPEN_ISSUES #7
```

**Удалено относительно предыдущей ревизии** (план §4.2, Шаг 5.2/5.9): `CellsContainer` (и спавн
`Cell.prefab`/`art/sprites/cell.png`), `HudLayer/CoinCounter`, `FxLayer/MoneyFountain`,
`CTAOverlay/Panel/FcRow` (+ `FcIcon`/`FcTotalLabel`), `Systems/RewardSystem`, `CoinFx.prefab`,
`art/ui/coin_fc.png`. `RewardSystem` стоял на критическом пути к CTA — цепочка переложена на
`EVT_LEVEL_SOLVED → (пауза winFxDuration) → EVT_REQUEST_CTA` внутри `GameStateSystem` (план §4.2).

`GameConfig` живёт как компонент на самой ноде `GameEntryPoint` (не отдельная нода) — так его читают
`GameEntryPoint.config` и все `*.config`-ссылки систем/views по одному и тому же node-пути (Фаза 5, готово).

**`CTAView` живёт на `CTAOverlay`, не на `Panel`** (исправлено на реальном прогоне Фазы 6). `CTAOverlay`
активен с самого старта сцены — только его дети `Dim`/`Panel` стартуют `active=false`. Причина: Cocos не
вызывает `onLoad()` для потомков неактивного предка (см. [Life Cycle Callbacks](https://docs.cocos.com/creator/3.8/manual/en/scripting/life-cycle-callbacks.html)) — если бы `CTAView` висел на `Panel` внутри
неактивного `CTAOverlay`, его подписка на `EVT_REQUEST_CTA` никогда бы не зарегистрировалась, и CTA не
показывался бы вообще. `CTAView.show()` теперь переключает `dimNode`/`panelNode` напрямую, а не
`this.node`/`this.node.parent`.

## Wiring (@property → нода/компонент)
| Компонент.свойство | Цель (путь или ассет) |
|--------------------|-----------------------|
| `GameEntryPoint.config` | `GameManager/GameEntryPoint` (GameConfig on same node) |
| `GameEntryPoint.gameStateSystem` | `GameManager/Systems/GameStateSystem` |
| `GameEntryPoint.boardSystem` | `GameManager/Systems/BoardSystem` |
| `GameEntryPoint.driveSystem` | `GameManager/Systems/DriveSystem` |
| `GameEntryPoint.hintSystem` | `GameManager/Systems/HintSystem` |
| `GameEntryPoint.tutorialSystem` | `GameManager/Systems/TutorialSystem` |
| `GameEntryPoint.ctaView` | `CTAOverlay` (CTAView) |
| `BoardSystem.config` | `GameManager/GameEntryPoint` (GameConfig) |
| `HintSystem.config` | `GameManager/GameEntryPoint` (GameConfig) |
| `TutorialSystem.config` | `GameManager/GameEntryPoint` (GameConfig) |
| `BoardView.config` | `GameManager/GameEntryPoint` (GameConfig) |
| `BoardView.blockPrefab` | `db://assets/prefabs/Block.prefab` |
| `BoardView.blocksContainer` | `.../GameplayLayer/BlocksContainer` |
| `BoardView.exitNotch` | `.../GameplayLayer/Board/ExitNotch` (active=false при Board_full.png) |
| `BoardView.exitArrows` | `.../GameplayLayer/Board/ExitArrows` (ExitArrowView) |
| `HudView.difficultyLabel` | `.../HudLayer/LevelPanel/DifficultyLabel` (Label) |
| `MovesView.movesLabel` | `.../HudLayer/MovesPanel/MovesLabel` (Label) |
| `MovesView.recordLabel` | `.../HudLayer/MovesPanel/RecordLabel` (Label) — статика §8.5, не пересчитывается |
| `BottomBarView.restartButton` | `.../BottomBar/RestartButton` (Button) |
| `BottomBarView.undoButton` | `.../BottomBar/UndoButton` (Button) |
| `BottomBarView.hintButton` | `.../BottomBar/HintButton` (Button) |
| `BottomBarView.hintBadgeLabel` | `.../BottomBar/HintButton/HintBadgeLabel` (Label) |
| `BottomBarView.pauseButton` | `.../BottomBar/PauseButton` (Button) |
| `LayoutAdapter.bottomBar` | `.../SafeArea/BottomBar` |
| `CTAView.dimNode` | `CTAOverlay/Dim` |
| `CTAView.panelNode` | `CTAOverlay/Panel` |
| `CTAView.logoNode` | `CTAOverlay/Panel/FreecashLogo` |
| `CTAView.titleLabel` | `CTAOverlay/Panel/TitleLabel` (Label) |
| `CTAView.playButton` | `CTAOverlay/Panel/PlayButton` (Button) |

**Удалено из wiring** (план §4.2/5.9): `RewardSystem.config`, `BoardView.cellPrefab`,
`BoardView.cellsContainer`, `BoardView.exitArrow` (заменён на `exitNotch`/`exitArrows` выше),
`MoneyFountainView.*`, `CoinCounterView.label`, `CTAView.fcLabel`.

## Placeholder-политика
- Ассеты без UUID (напр. клиентский логотип) → `@property = null` + запись в `OPEN_ISSUES.md` как ручной шаг.
- Без fake UUID и ручных `.meta`.
- `Finger`/`Sparks` — намеренные болванки (см. иерархию выше), не удалять: сцена на них ссылается
  (план Шаг 1.4).

## Адаптив (GDD §4)
- Portrait — базовая раскладка выше. Landscape — обязателен: HUD-панели по краям, поле по центру,
  `BottomBar` и `DisclaimerLabel` — обе видимы и не пересекаются (план §8.1, проверить на Шаге 6.1).
  Реализация: `Widget` на слоях + компонент-адаптер, переключающий раскладку по aspect ratio (см. OPEN_ISSUES #7).
- Фон: фит-cover `scale = max(screenW/1376, screenH/768)` — портрет по высоте, лендскейп по ширине,
  4:3 лендскейп страхуется от полос (план §4.4).
- Ключевое правило: поле, нижний бар и CTA-кнопка полностью в видимой области в обеих ориентациях,
  ничего не обрезается.

## Legacy-ноды
Нет (проект чистый `NewProject`). Все ноды создаются с нуля.
