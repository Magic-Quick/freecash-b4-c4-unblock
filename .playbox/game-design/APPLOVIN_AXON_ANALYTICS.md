# APPLOVIN_AXON_ANALYTICS — AppLovin Axon Playable Analytics Events

> 📊 **AppLovin Axon Playable Analytics** — SDK для репорта lifecycle/engagement событий из плеебла. SDK сам инжектит глобал `window.ALPlayableAnalytics`; креатив фирит события через него. Релевантно **только для сети AppLovin** — дополняет, а не заменяет стандартные `plbx.*` вызовы из `PLBX_LIFECYCLE_GUIDE.md`.
>
> Для этого проекта `1cl`/`xcl`-статус и, соответственно, нужны ли `CHALLENGE_*` (см. §«Правила CHALLENGE_\*» ниже) —
> **не определены, см. `OPEN_ISSUES.md` #8** (новый пункт, добавлен при синке этого документа).

## API

```js
if (typeof window.ALPlayableAnalytics != 'undefined') {
  window.ALPlayableAnalytics.trackEvent('DISPLAYED');
}
```

- Один метод: `trackEvent('EVENT_NAME')`. Без payload и параметров.
- **Кастомные события не трекаются** — только предопределённые имена ниже.
- **Не определяй `ALPlayableAnalytics` сам** — его предоставляет SDK. Всегда оборачивай вызов в проверку `typeof … != 'undefined'`.
- Имена событий — ALL_CAPS через подчёркивание.

## События (12, в порядке lifecycle)

| Событие             | Значение                                      | Статус          |
| ------------------- | --------------------------------------------- | --------------- |
| `LOADING`           | Старт загрузки внутри плеебла                 | Пара²           |
| `LOADED`            | Загрузка завершена                            | Пара²           |
| `DISPLAYED`         | Креатив показан и готов к взаимодействию      | **Обязательно** |
| `CHALLENGE_STARTED` | Юзер начал челлендж / значимое взаимодействие | Опционально     |
| `CHALLENGE_FAILED`  | Юзер достиг fail-состояния                    | Условно¹        |
| `CHALLENGE_RETRY`   | Юзер ретраит проваленный челлендж             | Условно¹        |
| `CHALLENGE_PASS_25` | 25% прохождения                               | Опционально     |
| `CHALLENGE_PASS_50` | 50% прохождения                               | Опционально     |
| `CHALLENGE_PASS_75` | 75% прохождения                               | Опционально     |
| `CHALLENGE_SOLVED`  | Челлендж успешно завершён                     | Условно¹        |
| `CTA_CLICKED`       | Клик по call-to-action                        | Опционально     |
| `ENDCARD_SHOWN`     | Показан энд-кард / экран-саммари              | Опционально     |

¹ Если используется `CHALLENGE_STARTED`, должно вызываться **хотя бы одно** из `CHALLENGE_SOLVED` / `CHALLENGE_FAILED` / `CHALLENGE_RETRY`.

² `LOADING` и `LOADED` — симметричная пара: фири **оба** или **ни одного**. Одинокий `LOADING` (загрузка не завершилась) или одинокий `LOADED` (завершилась без старта) флагается.

## Рекомендуемый порядок lifecycle

1. `LOADING` → `LOADED` (опциональная пара)
2. `DISPLAYED` (обязательно)
3. `CHALLENGE_STARTED` → прогресс (`CHALLENGE_PASS_*`) → `CHALLENGE_SOLVED` / `CHALLENGE_FAILED` (+ `CHALLENGE_RETRY` на ретраях)
4. `CTA_CLICKED` (в любой момент после `DISPLAYED`), `ENDCARD_SHOWN`

## Правила CHALLENGE\_\* (требования клиента)

- `CHALLENGE_STARTED` фирится **один раз** — только по первому клику пользователя.
- **Минимум 50 ms между любыми двумя `CHALLENGE_*`** — AppLovin запрещает одновременную отправку; каждое должно отражать отдельный момент геймплея. `CTA_CLICKED` может вклиниваться между вызовами `CHALLENGE_*`.
- **`CHALLENGE_SOLVED` всегда до `ENDCARD_SHOWN`** (если энд-кард существует).
- **1-клик (`1cl`) плееблы НЕ реализуют `CHALLENGE_*`.** Для `xcl` (x-click) версий — фири `CHALLENGE_*` по логике плеебла. Валидатор не детектит click-count автоматически — правило ручное.

## Дедуп (fire-once)

Фирятся **ровно один раз**: `LOADING`, `LOADED`, `DISPLAYED`, `ENDCARD_SHOWN`, `CHALLENGE_STARTED`, `CTA_CLICKED`.

Остальные `CHALLENGE_*` (PASS/FAILED/RETRY) могут повторяться — это легитимно на ретраях.

## Проверки валидатора

Все чеки **advisory (warn-only)** — события пишет геймдев, упаковщик их не инжектит и не валит билд.

| Правило                                                      | Уровень   |
| ------------------------------------------------------------ | --------- |
| `DISPLAYED` присутствует (единственное обязательное)         | warn      |
| Только spec-имена — нет кастомных/опечаток                   | **error** |
| `LOADING` и `LOADED` оба, либо ни одного (симметричная пара) | warn      |
| Completion-событие есть, когда есть `CHALLENGE_STARTED`      | warn      |
| Не переопределяет `window.ALPlayableAnalytics`               | warn      |
| Порядок lifecycle (по first-fire, retry-safe)                | warn      |
| Fire-once события фирятся один раз                           | warn      |
| `CHALLENGE_*` ≥ 50 ms друг от друга                          | warn      |

### Где запускается

- **Package-time gate** — статический скан исходников билда. `trackEvent()` литералы лежат в plaintext JS, _не_ в base64-zip финального HTML. Нарушения → `PackageResult.warnings`.
- **Package-панель** — видимый advisory-блок warnings; скан при загрузке панели / смене build-dir, когда выбран AppLovin.
- **Preview-валидатор** — live runtime-чек: мок `ALPlayableAnalytics` репортит каждое событие; чеклист + порядок + дедуп + spacing.

## Связанные документы
- `PLBX_LIFECYCLE_GUIDE.md` — базовый `plbx.*` lifecycle (game_ready/tap/download/game_end), общий для всех сетей; этот документ его не заменяет.
- `EXPORT_CHECKLIST.md` — билд под AppLovin входит в список из 11 сетей; добавить проверку `DISPLAYED`-события в общий чеклист перед сдачей AppLovin-билда.
- `OPEN_ISSUES.md` #8 — открытый вопрос про `1cl`/`xcl` и объём `CHALLENGE_*`.
