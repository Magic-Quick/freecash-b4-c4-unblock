# PLBX_LIFECYCLE_GUIDE — Cocos Extension Lifecycle events (гайд для creators)

> Гайд для Playable-разработчиков: как засетапить Cocos-проект, чтобы все валидаторы рекламных сетей
> (Moloco V2, Mintegral PlayTurbo, AppLovin, IronSource и др.) корректно детектили lifecycle-события.
> Это документ уровня **spec-доков** (см. precedence в корневом `CLAUDE.md`) — детализирует
> `Core/Playbox.ts` из `ARCHITECTURE.md` §6 и закрывает `OPEN_ISSUES.md` #3.

Один адаптер (`plbx_html_playable.ts`) покрывает все поддерживаемые сети. Код пишется один раз — упаковщик сам разруливает различия между сетями.

## Быстрый старт (3 минуты)

### 1. Установите расширение

Скопируйте или сделайте symlink расширения в папку `extensions/` вашего Cocos-проекта, затем включите его в Extension Manager.

### 2. Сгенерируйте адаптер

В Cocos Creator → откройте панель **Playbox** → нажмите **Generate adapter**.

Создаётся `assets/Scripts/plbx_html/plbx_html_playable.ts`. Не редактируйте этот файл — он перегенерируется по требованию.

### 3. Подключите lifecycle

Добавьте **4 вызова** в код игры:

| Вызов             | Где                                                         |
| ----------------- | ----------------------------------------------------------- |
| plbx.game_ready() | Один раз когда главная сцена загружена                      |
| plbx.tap()        | Каждый тап игрока (TOUCH_START + MOUSE_DOWN, дебаунс 100ms) |
| plbx.download()   | Клик по CTA / DOWNLOAD кнопке                               |
| plbx.game_end()   | Когда геймплей завершён                                     |

Готово. Теперь упакуйте через **Playbox панель → Package → выберите сети → Build**.

---

## Lifecycle-методы

Импорт один раз в каждом файле где нужны методы:

```ts
import plbx from '../plbx_html/plbx_html_playable';
```

### plbx.game_ready()

**Когда:** игра загрузилась, сцена видна, готова к игре.

**Фирит:** game_viewable beacon (Moloco V2), gameReady signal (Mintegral PlayTurbo, TikTok/Pangle playableSDK).

**Где вызывать:** главная сцена onLoad() / start(), после initializeSystems().

```ts
protected onLoad(): void {
  this.initializeSystems();
  plbx.game_ready();
}
```

> ⚠️ Вызывать ровно один раз за сессию. Адаптер дедуплицирует внутри, но явный одиночный вызов чище.

### plbx.tap()

**Когда:** каждый значимый тап / тач / клик игрока.

**fire-ит:** engagement beacon на пороге taps_for_engagement (по умолчанию 1), redirection beacon на пороге taps_for_redirection (по умолчанию 3). Moloco DSP переопределяет дефолты per-campaign.

**Где вызывать:** центральный input-handler. Обязательно слушать **оба** типа событий — TOUCH_START и MOUSE_DOWN: десктоп (превью, валидатор Moloco) шлёт только мышиные события, тач-девайсы — тач (и Cocos может синтезировать мышиную пару). Дубль одного физического тапа гасится дебаунсом 100ms:

```ts
import { input, Input, EventTouch, EventMouse } from 'cc';

private _lastTapAt = 0;

input.on(Input.EventType.TOUCH_START, this.onTap, this);
input.on(Input.EventType.MOUSE_DOWN, this.onTap, this);

private onTap(event: EventTouch | EventMouse): void {
  const now = Date.now();
  if (now - this._lastTapAt < 100) return; // touch+mouse пара = один тап
  this._lastTapAt = now;
  plbx.tap();
}
```

> ⚠️ Только TOUCH_START — частый баг: engagement / redirection не фирятся в десктопном превью и в валидаторе Moloco (мышь не диспатчит touch-события).

> 💡 Безопасно вызывать сотни раз — engagement / redirection фирят идемпотентно (по одному разу за сессию).

### plbx.download()

**Когда:** игрок нажал CTA / DOWNLOAD кнопку.

**Фирит:** click beacon, открывает mraid.open(final_url) (Moloco V2) или эквивалент CTA-пути для сети.

```ts
this.ctaButton.node.on(
  Button.EventType.CLICK,
  () => {
    plbx.download();
  },
  this,
);
```

> 💡 Несколько нажатий → несколько click beacon (каждый — отдельный billable клик). Адаптер применяет 100ms debounce на beacon чтобы отфильтровать double-fire баги input-слоёв Cocos.

### plbx.game_end()

**Когда:** сессия геймплея окончена — уровень пройден, время вышло, игрок достиг fail/success экрана.

**Фирит:** complete beacon (Moloco V2), gameEnd signal (Mintegral, Vungle).

```ts
public show(): void {
  this.node.active = true;
  plbx.game_end();
  // ... анимация
}
```

> 💡 Фирит идемпотентно — несколько вызовов дают один complete beacon за сессию.

---

## Аудио-коллбеки

Moloco (и другие сети) управляют звуком плейбла снаружи: `start_muted` при старте + live-сигнал `audioVolumeChange` mid-playback. Адаптер абстрагирует это в три метода.

### plbx.is_muted()

**Когда:** перед инициализацией AudioContext / запуском музыки, и в любой момент для текущего состояния.

**Возвращает:** true если ad-контейнер сейчас замьючен. Сидится из стартового сигнала (Moloco `MOLOCO_MACROS.start_muted`) и обновляется живьём через MRAID `audioVolumeChange`.

```ts
initAudio(): void {
  if (plbx.is_muted()) {
    return; // не запускать звук
  }
  this.musicSource.play();
}
```

### plbx.on_mute_change(cb)

**Когда:** подписка на live mute/unmute от контейнера (пользователь крутит звук на обёртке рекламы mid-playback).

**Поведение:** колбек фирит сразу с текущим состоянием, затем при каждом пересечении mute/unmute. На сетях без live-сигнала — один начальный вызов.

```ts
plbx.on_mute_change((muted: boolean) => {
  if (muted) this.audioController.stopAll();
  else if (this.userWantsSound) this.audioController.resume();
});
```

### plbx.is_audio()

**Возвращает:** false если сеть вообще запрещает звук — тогда прячь кнопку звука и не инициализируй аудио.

### Кнопка звука в игре — требование Moloco

> ⚠️ Moloco: при start_muted=true звук выключен по умолчанию, и **в плейбле обязан быть способ включить его** — кнопка звука, первое взаимодействие и т.п. Без этого фидбек от Moloco QA: "make sure there is a way for user to unmute".

Рабочий паттерн (piggy-merge): пользовательский выбор поверх контейнерного, «последний сигнал побеждает»:

```ts
export class AudioController {
  private containerMuted = false; // от plbx (start_muted + audioVolumeChange)
  private userMuted: boolean | null = null; // явный выбор игрока кнопкой

  constructor() {
    plbx.on_mute_change((m) => {
      this.containerMuted = m;
      this.userMuted = null; // новый сигнал контейнера сбрасывает выбор
      this.reconcile();
    });
  }

  isMuted(): boolean {
    return this.userMuted !== null ? this.userMuted : this.containerMuted;
  }

  toggleMute(): void {
    // вешается на кнопку звука
    this.userMuted = !this.isMuted();
    this.reconcile();
  }

  private reconcile(): void {
    const on = !this.isMuted();
    // включить/выключить музыку и SFX, обновить спрайт кнопки
  }
}
```

Спрайт кнопки: `включён = plbx.is_audio() && !isMuted()`.

### plbx.report(eventKey) — опционально

**Когда:** кастомная телеметрия за пределами стандартного lifecycle. Фирит соответствующий MOLOCO_MACROS[eventKey] beacon. No-op на не-Moloco сетях. Стандартный lifecycle предпочтительнее.

---

## Внешние команды — свои методы (Game commands)

plbx.expose(name, fn, label) регистрирует именованную команду, которую внешний код может вызвать СНАРУЖИ игры — ad-контейнер, тест-харнесс или Playbox Preview. Направление обратное обычным методам (игра→наружу): здесь снаружи→игра. Preview рисует по кнопке на каждую зарегистрированную команду, так что состояния (endcard, рестарт, скип) можно прогонять не доигрывая до них.

> 🧩 Сам endcard / packshot рисует игра. expose даёт только хук-слот: имя + обработчик. Внешний код дёргает обработчик — игра показывает своё.

### plbx.expose(name, fn, label)

Когда: на старте сцены, ПОСЛЕ того как игра готова обработать действие.

Что делает: регистрирует команду name → обработчик fn. Внешний код вызывает window.plbx_html.<name>() (и через alias window.super_html.<name>()). label — текст кнопки в Preview (по умолчанию = name).

```ts
import plbx from '../plbx_html/plbx_html_playable';

protected onLoad(): void {
  // регистрируй ПОСЛЕ того как сцена готова показать действие
  plbx.expose('show_endcard', () => this.showEndcard(), 'Show endcard');
  plbx.expose('restart',      () => this.restart(),      'Restart');
}
```

> ⚠️ Один обработчик на имя — повторный expose обновляет обработчик, без дубля кнопки. Регистрируй ПОСЛЕ готовности сцены: если внешний вызов придёт раньше, чем готов рендер, действие не отработает.

### Как вызвать снаружи

Из ad-контейнера, теста или консоли браузера:

```js
window.plbx_html.show_endcard();
```

### Кнопки в Playbox Preview

1. Упакуй билд этим (v0.2.27+) расширением — мост со expose инжектится автоматически.
2. Открой Preview → справа сверху, слева от панели валидации, появится тулбар «Game commands».
3. По кнопке на каждую команду (лейбл = 3-й аргумент expose). Клик → команда вызывается на текущем билде.

> 📷 *Скриншот тулбара «Game commands» в Preview (справа, слева от Validation) — не перенесён из исходного Notion-документа.*

> ℹ️ Тулбар появится только если билд упакован расширением с expose (v0.2.27+). Старым расширением адаптер залогирует «expose unavailable», кнопок не будет.

---

## Полный пример (Cocos Creator)

**GameEntryPoint.ts**:

```ts
import { _decorator, Component, Button } from 'cc';
import plbx from '../plbx_html/plbx_html_playable';

const { ccclass, property } = _decorator;

@ccclass('GameEntryPoint')
export class GameEntryPoint extends Component {
  @property(Button) ctaButton: Button = null;

  protected onLoad(): void {
    plbx.set_app_store_url('https://apps.apple.com/.../id123');
    plbx.set_google_play_url(
      'https://play.google.com/store/apps/details?id=...',
    );

    this.initializeSystems();

    this.ctaButton.node.on(
      Button.EventType.CLICK,
      () => {
        plbx.download();
      },
      this,
    );

    plbx.game_ready();
  }
}
```

**InputSystem.ts** (или где обрабатывается тач):

```ts
import { input, Input, EventTouch, EventMouse } from 'cc';
import plbx from '../plbx_html/plbx_html_playable';

export class InputSystem {
  private _lastTapAt = 0;

  constructor() {
    input.on(Input.EventType.TOUCH_START, this.onTap, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onTap, this); // десктоп/превью
  }

  private onTap(event: EventTouch | EventMouse): void {
    const now = Date.now();
    if (now - this._lastTapAt < 100) return; // touch+mouse пара = один тап
    this._lastTapAt = now;
    plbx.tap();
    // ... ваша input-логика
  }
}
```

**CTAView.ts** (экран конца игры):

```ts
@ccclass('CTAView')
export class CTAView extends Component {
  @property(Button) storeButton: Button = null;

  public show(): void {
    this.node.active = true;
    plbx.game_end();

    this.storeButton.node.on(
      Button.EventType.CLICK,
      () => {
        plbx.download();
      },
      this,
    );
  }
}
```

---

## Процесс валидации

1. Cocos Editor → Project → Build → платформа web-mobile. Создаёт build/web-mobile/.
2. Playbox панель → Package → выберите сети (например molocoV2, applovin, mintegral) → Build. Результат в build/plbx-html/{networkId}/.
3. Playbox панель → кнопка Preview (рядом с Build). Открывает локальный браузер с табами по сетям.

**Smoke-test (на табе каждой сети):**

| Проверка                           | Как тригернуть                               |
| ---------------------------------- | -------------------------------------------- |
| File size                          | авто                                         |
| MRAID ready                        | авто                                         |
| viewableChange listener registered | авто (defer-boot gate регистрирует)          |
| mraid_viewable beacon              | кнопка Viewable (manual trigger)             |
| game_viewable beacon               | авто (Cocos boot вызывает plbx.game_ready()) |
| click beacon                       | тап по CTA в playable ИЛИ кнопка CTA         |
| engagement beacon                  | тап canvas 1× ИЛИ Simulate taps N=1          |
| redirection beacon                 | тап canvas 3× ИЛИ Simulate taps N=3          |
| complete beacon                    | пройти до конца ИЛИ кнопка End game          |
| final_url consumed                 | авто когда CTA фирит mraid.open(final_url)   |

> ✅ Все зелёные ✅ → playable готов к сабмиту в Moloco QA.

---

## Поведение по сетям

Один и тот же код — разные пути beacon для каждой сети. Сетевой код писать НЕ нужно, адаптер абстрагирует.

| Сеть                          | download()                    | game_ready()      | game_end()        | tap()                    |
| ----------------------------- | ----------------------------- | ----------------- | ----------------- | ------------------------ |
| Moloco V2                     | mraid.open(final_url) + click | game_viewable     | complete          | engagement / redirection |
| AppLovin / Unity / IronSource | mraid.open(storeUrl)          | gameReady         | gameEnd           | no-op                    |
| Facebook / Moloco (legacy)    | FbPlayableAd.onCTAClick()     | no-op             | gameEnd           | no-op                    |
| Mintegral                     | window.install()              | gameReady()       | gameEnd()         | no-op                    |
| TikTok / Pangle               | playableSDK.openAppStore()    | reportGameReady() | reportGameClose() | no-op                    |
| Google                        | ExitApi.exit()                | no-op             | no-op             | no-op                    |

---

## Troubleshooting

- **game_viewable не детектится (timeout 30с):** plbx.game_ready() не вызван. Добавь в onLoad главной сцены.
- **mraid_viewable не детектится:** Нажми Viewable manual trigger в preview. В проде ad-контейнер фирит это автоматически когда становится видимым.
- **engagement / redirection не детектятся:** plbx.tap() не подключён к input-handler. Добавь в TOUCH_START **и** MOUSE_DOWN (с дебаунсом 100ms).
- **engagement работает на телефоне, но не в превью / валидаторе Moloco:** слушается только TOUCH_START. Десктоп шлёт мышь — добавь MOUSE_DOWN (см. раздел plbx.tap()).
- **Кнопка звука не реагирует / Moloco QA просит unmute:** нет способа включить звук при start_muted=true. Добавь кнопку звука по паттерну из раздела «Аудио-коллбеки».
- **complete не детектится:** plbx.game_end() не вызван на завершении уровня. Добавь в end-game flow.
- **click beacon фирит 2× на 1 нажатие:** Два листенера дёргают download() одновременно. Адаптер имеет 100ms debounce. Если всё ещё видишь — проверь дубли биндингов на CTA-кнопке.
- **Чёрный экран в проде но работает в preview:** MRAID defer-boot gate. Проверь что \_\_plbx_pre_boot в финальном HTML (чек «viewableChange listener registered» зелёный).
- **Размер больше лимита сети:** Сожми текстуры (вкладка Compress), снизь битрейт аудио, убери неиспользуемые ассеты. Большинство сетей лимит 5 МБ.
- **is_muted() всегда false в preview:** Это ожидаемо. В preview MOLOCO_MACROS.start_muted — строка-плейсхолдер. В проде DSP подставит реальный 1 или 0.

---

## Чего НЕ делать

- Не вызывай mraid.open() / FbPlayableAd.onCTAClick() / window.install() напрямую — используй plbx.download()
- Не читай MOLOCO_MACROS напрямую — используй plbx.is_muted() и т.д.
- Не определяй window.gameReady / window.gameStart / window.gameClose вручную — runtime-loader делает это сам
- Не грузи внешние трекеры (Google Analytics, Facebook Pixel и т.д.) — провалит проверки валидатора
- Не шипи legacy-адаптер super_html_playable.ts — используй только plbx_html_playable.ts

---

## Шпаргалка

```ts
import plbx from '../plbx_html/plbx_html_playable';

// onLoad главной сцены
plbx.set_app_store_url('https://apps.apple.com/.../id123');
plbx.set_google_play_url('https://play.google.com/store/apps/details?id=...');
plbx.game_ready();

// CTA-кнопка
plbx.download();

// Каждый тап
plbx.tap();

// Конец игры
plbx.game_end();

// Звук: стартовое состояние + live mute/unmute от контейнера
if (plbx.is_muted()) {
  /* не запускать музыку */
}
plbx.on_mute_change((m) => {
  /* стоп/возобновить звук */
});
// + кнопка звука в игре (требование Moloco при start_muted)
```

> 🎯 Правильно подключи эти 6 строк — и все валидаторы сетей пройдут.

## Связанные документы
- `APPLOVIN_AXON_ANALYTICS.md` — доп. lifecycle/engagement события для сети AppLovin (`window.ALPlayableAnalytics`), поверх стандартных `plbx.*` вызовов этого гайда.
- `MOLOCO_V2_EXPORT_GUIDE.md` — пошаговый билд/аплоад/сдача конкретно под Moloco V2, использует коллбеки из этого гайда как шаг 1.
- `ARCHITECTURE.md` §6 — контракт `Core/Playbox.ts` на уровне архитектуры проекта.
- `OPEN_ISSUES.md` #3 — статус подключения adapter/SDK в этом проекте.
- `QA_CHECKLIST.md` §Playbox lifecycle и §EXPORT_CHECKLIST.md — гейты, которые проверяют вызовы из этого гайда перед сдачей.
