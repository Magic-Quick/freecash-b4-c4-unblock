# AGENTS — контракт проекта «Unblock» (Freecash B4C4)

> Рабочий контракт для под-агентов `/build-playable`. Конкретные значения — из `GDD.md`;
> здесь их «застывшая» проекция + правила проекта. Precedence при конфликте:
> `GDD.md` → `OPEN_ISSUES.md` → `ARCHITECTURE.md` → spec-доки → phase-планы → QA/EXPORT → этот файл.

## 1. Технет
- Cocos Creator: **3.8.8** (проект `NewProject`, uuid в `package.json`).
- Ориентация: **portrait основная (720×1280, origin 360,640)** + адаптация под landscape (GDD §4).
- Пути кода: `assets/scripts/{Core,Models,Systems,Views,event-bus}`.
- Пути арта: `assets/art/{sprites,ui}`; данные уровней: `assets/data/`; префабы: `assets/prefabs/`.
- Сцена: `assets/scene.scene`.

## 2. Запрещённые API / правила
- НЕ использовать `find()`, `getChildByName()`, `getComponentInChildren()`, `getComponentsInChildren()`.
- НЕ создавать `.meta` вручную; НЕ править JSON сцены/префабов руками — только MCP `plbx-cocos`.
- НЕ оставлять production `console.log` (для отладки — `console.warn` с префиксом `[Unblock]`).
- НЕ трогать `/temp`, `/library`, `/profiles`, `/settings`, `.creator/`.
- **Комментарии ОБЯЗАТЕЛЬНЫ** в важных/тюнингуемых местах и в нетривиальной логике движения блоков
  (переопределяет дефолт агентов «без комментариев» — так требует владелец проекта).
- **Минимум хардкода**: числа/размеры/награды — через `@property` `GameConfig`; раскладки уровней — данными
  (`assets/data/levels.json`), а не литералами в системах.

## 3. GameConfig (значения из GDD → @property поля)
| Поле | Тип | Значение | Назначение |
|------|-----|----------|------------|
| `gridCols` | number | 6 | ширина поля в ячейках |
| `gridRows` | number | 6 | высота поля в ячейках |
| `cellSize` | number | 96 | размер ячейки, px |
| `cellSpacing` | number | 6 | зазор между ячейками, px |
| `level1Reward` | number | 9 | FC за уровень 1 |
| `level2Reward` | number | 10 | FC за уровень 2 (итого 19) |
| `swipeMinDistance` | number | 30 | порог распознавания свайпа, px |
| `blockSlideDuration` | number | 0.18 | длительность слайда блока, сек |
| `mainDriveDuration` | number | 0.7 | автопроезд главного блока к выходу, сек |
| `coinFlyDuration` | number | 0.6 | полёт монет к счётчику, сек |
| `levelsData` | JsonAsset | `assets/data/levels.json` | раскладки уровней (данные, не код) |

## 4. Фазы состояния
`enum GamePhase { INTRO = 0, LEVEL_PLAY = 1, LEVEL_DRIVE = 2, LEVEL_CLEAR = 3, CTA = 4 }`
+ `currentLevel: 1 | 2` в `GameStateModel`.

Поток: INTRO → LEVEL_PLAY (свайпы) → путь свободен → LEVEL_DRIVE (главный блок автопроездом выезжает вправо за край, монеты) →
LEVEL_CLEAR → (level 1 → следующий LEVEL_PLAY; level 2 → CTA).

## 5. События (EVT_*) — добавлять В КОНЕЦ `event-bus/events.ts`
`EVT_SWIPE`, `EVT_BLOCK_MOVED`, `EVT_BLOCK_BLOCKED`, `EVT_MAIN_PATH_CLEAR`, `EVT_MAIN_BLOCKED`,
`EVT_MAIN_DRIVE_START`, `EVT_MAIN_REACHED_EXIT`, `EVT_LEVEL_STARTED`, `EVT_LEVEL_SOLVED`,
`EVT_PHASE_CHANGED`, `EVT_COINS_CHANGED`, `EVT_TUTORIAL_SHOW`, `EVT_TUTORIAL_HIDE`,
`EVT_REQUEST_CTA`, `EVT_PLAY_SOUND`, `EVT_TAP` — с интерфейсами `*Event` (см. ARCHITECTURE §4).

## 6. Структура сцены (кратко)
`Canvas → BackgroundLayer / SafeArea(HudLayer, GameplayLayer, TutorialLayer, FxLayer, Disclaimer) /
CTAOverlay(active=false) / GameManager(EntryPoint + Systems)`. Детально — `SCENE_SETUP.md`.
Блоки **не пред-размещены**: `BoardView` спавнит `Block.prefab` из данных уровня в `BlocksContainer`.

## 7. Ассеты
Placeholder-генерация (**классическое дерево, concept-1**): деревянные блоки-тайлы (9-slice), красный главный блок,
ячейка, рамка поля, фон, стрелка выхода, монета FC (без $), панель, кнопка Play, палец, спарк.
Главный блок выезжает как блок (без машинки). Логотип Freecash — импорт клиентского лого (источник в OPEN_ISSUES).
Детально + цвета — `ASSET_SPEC.md`.

## 8. Тест-сценарий (smoke)
INTRO → палец подсказывает первый свайп → игрок расчищает путь на L1 → главный блок едет к выходу
и выезжает за край → +9 FC → авто-переход на L2 → расчистка → +10 FC (итого 19) → CTA «PLAY & EARN»
→ клик → `plbx.download()`. Дисклеймер виден всегда. Детально — `QA_CHECKLIST.md`.
