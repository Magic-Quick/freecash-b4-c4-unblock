# ARCHITECTURE — «Unblock» (Freecash B4C4)

> MVC + EventBus. Как устроен рантайм. Синхронизируй при изменении систем/потока состояний.
> Владелец рантайм-кода: `cocos-coder`. Владелец сцены/префабов: `cocos-scene-builder`.

## 1. Слои
- **Model** — состояние и plain-данные (без Cocos-логики): `GameStateModel`, `BoardModel`, `BlockModel`.
- **System** — правила и оркестрация (plain TS / лёгкий `Component`, без поиска по сцене).
- **View** — `Component`: спрайты, лейблы, твины, ввод, UI-фидбек. Методы `show()/setX()/playY()`.
- **Core** — `GameEntryPoint` (композиция/wiring, lifecycle один раз) + `Playbox` (адаптер SDK).
- **GlobalEventBus** — единственный путь межсистемной связи.

## 2. Системы
| System | Подписки (EVT_*) | Публикует | Держит Model |
|--------|------------------|-----------|--------------|
| `GameStateSystem` | `EVT_LEVEL_SOLVED` | `EVT_PHASE_CHANGED`, `EVT_LEVEL_STARTED`, `EVT_REQUEST_CTA` | `GameStateModel` |
| `BoardSystem` | `EVT_SWIPE`, `EVT_LEVEL_STARTED` | `EVT_BLOCK_MOVED`, `EVT_BLOCK_BLOCKED`, `EVT_MAIN_PATH_CLEAR`, `EVT_MAIN_BLOCKED` | `BoardModel` |
| `DriveSystem` | `EVT_MAIN_PATH_CLEAR` | `EVT_MAIN_DRIVE_START`, `EVT_MAIN_REACHED_EXIT`, `EVT_LEVEL_SOLVED` | — |
| `RewardSystem` | `EVT_LEVEL_SOLVED` | `EVT_COINS_CHANGED` | — (счётчик в GameStateModel) |
| `TutorialSystem` | `EVT_LEVEL_STARTED`, `EVT_BLOCK_MOVED` | `EVT_TUTORIAL_SHOW`, `EVT_TUTORIAL_HIDE` | — |
| `SoundSystem` (stub) | `EVT_PLAY_SOUND` | — | — |

- **BoardSystem** — ядро механики. На `EVT_LEVEL_STARTED` строит `BoardModel` из `levels.json`.
  На `EVT_SWIPE{blockId, dir}`: проверяет ось блока, двигает его до крайней свободной ячейки по направлению,
  публикует `EVT_BLOCK_MOVED{blockId, fromCell, toCell, hitWall}` (или `EVT_BLOCK_BLOCKED` если сдвиг = 0).
  После каждого хода проверяет коридор главного блока к выходу → `EVT_MAIN_PATH_CLEAR` / `EVT_MAIN_BLOCKED`.
- **DriveSystem** — на `EVT_MAIN_PATH_CLEAR` запускает автопроезд (View), по завершении → `EVT_LEVEL_SOLVED{level}`.
- **GameStateSystem** — на `EVT_LEVEL_SOLVED`: level 1 → стартует level 2 (`EVT_LEVEL_STARTED`);
  level 2 → `EVT_REQUEST_CTA`. Меняет фазу, публикует `EVT_PHASE_CHANGED`.
- **RewardSystem** — на `EVT_LEVEL_SOLVED` начисляет `level1Reward`/`level2Reward`, `EVT_COINS_CHANGED{total, delta, isFinal}`.

## 3. Views (публичные методы)
- `BoardView` — на `EVT_LEVEL_STARTED` спавнит ячейки и `Block.prefab` из `BoardModel`; держит map `blockId→BlockView`;
  на `EVT_BLOCK_MOVED` вызывает `blockView.slideTo(cell)`. `buildLevel(model)`, `clearLevel()`.
- `BlockView` — `setup(blockModel, cellSize)`, `slideTo(cell)`, `playBlocked()`; ловит touch → вычисляет свайп → `EVT_SWIPE`.
  Главный блок: `driveToExit()` (автопроезд вправо за край поля — как блок, без машинки; концепт-1).
- `CoinCounterView` — `addCoins(delta, total)` (fly-in монет + count-up), `highlight()` (на финале).
- `TutorialFingerView` — `showHint(fromPos, toPos)`, `hide()` (петля свайпа).
- `MoneyFountainView` — `burst(count)` (разлёт монет FC на solve).
- `CTAView` — `show(totalFc)`; клик по кнопке → `Playbox.download()`; pulse кнопки.
- `ExitArrowView` — `pulse()`; `HudView` — LEVEL/MOVES панели (декор); `DisclaimerView` — статичный лейбл.

## 4. События EventBus (payload-интерфейсы; добавляются В КОНЕЦ events.ts)
| EVT_* | Payload | Публикует | Слушает |
|-------|---------|-----------|---------|
| `EVT_SWIPE` | `{blockId:number, dir:'up'\|'down'\|'left'\|'right'}` | BlockView | BoardSystem |
| `EVT_BLOCK_MOVED` | `{blockId, fromCell, toCell, hitWall:boolean}` | BoardSystem | BoardView, TutorialSystem, SoundSystem |
| `EVT_BLOCK_BLOCKED` | `{blockId}` | BoardSystem | BlockView(via BoardView), SoundSystem |
| `EVT_MAIN_PATH_CLEAR` | `{}` | BoardSystem | DriveSystem |
| `EVT_MAIN_BLOCKED` | `{}` | BoardSystem | (резерв) |
| `EVT_MAIN_DRIVE_START` | `{}` | DriveSystem | BoardView, SoundSystem |
| `EVT_MAIN_REACHED_EXIT` | `{level:number}` | DriveSystem | FxLayer, SoundSystem |
| `EVT_LEVEL_STARTED` | `{level:number}` | GameStateSystem | BoardSystem, BoardView, TutorialSystem, HudView |
| `EVT_LEVEL_SOLVED` | `{level:number}` | DriveSystem | GameStateSystem, RewardSystem |
| `EVT_PHASE_CHANGED` | `{phase:GamePhase}` | GameStateSystem | (подписчики по нужде) |
| `EVT_COINS_CHANGED` | `{total:number, delta:number, isFinal:boolean}` | RewardSystem | CoinCounterView, MoneyFountainView |
| `EVT_TUTORIAL_SHOW` | `{fromCell, toCell}` | TutorialSystem | TutorialFingerView |
| `EVT_TUTORIAL_HIDE` | `{}` | TutorialSystem | TutorialFingerView |
| `EVT_REQUEST_CTA` | `{totalFc:number}` | GameStateSystem | CTAView |
| `EVT_PLAY_SOUND` | `{id:string}` | many | SoundSystem |
| `EVT_TAP` | `{}` | BlockView/InputRouter | Playbox (`plbx.tap()`) |

## 5. Явные ссылки (@property) — для scene-builder
- `GameEntryPoint`: ссылки на все ноды-системы + `GameConfig`.
- `BoardSystem.boardViewNode`; `DriveSystem.boardViewNode`; `TutorialSystem.fingerViewNode`;
  `RewardSystem.coinCounterNode`.
- `BoardView`: `cellPrefab`, `blockPrefab`, `blocksContainer`, `cellsContainer`, `config`.
- `CTAView`: `logoNode`, `titleLabel`, `fcLabel`, `playButton`. Все `@property` дефолт `null`.

## 6. Playbox lifecycle (`Core/Playbox.ts` — обёртка над глобальным `plbx`, no-op в редакторе)
- `plbx.game_ready()` — в `GameEntryPoint.start()` после wiring сцены.
- `plbx.tap()` — в центральном пути ввода (первый touch по блоку / `EVT_TAP`); слушать оба `TOUCH_START`
  и `MOUSE_DOWN`, дебаунс 100ms (десктоп-превью/валидаторы шлют только мышь).
- `plbx.download()` — на клик CTA-кнопки.
- `plbx.game_end()` — при показе CTA (терминальное состояние).
- `plbx.is_muted()` / `plbx.on_mute_change()` / `plbx.is_audio()` — состояние звука от ad-контейнера;
  `AudioController` держит его вместе с явным выбором игрока (кнопка mute/unmute — см. `OPEN_ISSUES.md` #9,
  ассет ещё не создан).
- `plbx.expose(name, fn, label)` — опционально, для ручного прогона состояний (endcard/restart) в Preview.

Детальные сигнатуры, debounce-паттерны и per-network поведение — `.playbox/game-design/PLBX_LIFECYCLE_GUIDE.md`.
Сетевые build/export шаги — `MOLOCO_V2_EXPORT_GUIDE.md`, `APPLOVIN_AXON_ANALYTICS.md`.
