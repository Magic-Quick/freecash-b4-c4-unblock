# MOLOCO_V2_EXPORT_GUIDE — билд и сдача плейбла для Moloco V2 (пошаговый гайд)

> 📘 Полный пайплайн: от коллбеков в коде игры до сдачи launcher-final.html ПМу. Предполагается установленное расширение Playbox и готовый web-mobile билд. Дополняет сетевой ряд `EXPORT_CHECKLIST.md` (сеть **Moloco** из списка 11) конкретными шагами именно для Moloco V2 (Launcher API).

## Шаг 1. Реализовать коллбеки

Подключи lifecycle- и аудио-коллбеки по `PLBX_LIFECYCLE_GUIDE.md`:

- `plbx.game_ready()` — сцена загружена
- `plbx.tap()` — каждый тап (**TOUCH_START + MOUSE_DOWN**, дебаунс 100ms)
- `plbx.download()` — CTA-кнопка
- `plbx.game_end()` — конец геймплея
- `plbx.is_muted()` + `plbx.on_mute_change()` + кнопка звука в игре (требование Moloco при start_muted)

Собери web-mobile: Cocos → Project → Build → платформа web-mobile.

## Шаг 2. Упаковка

Панель **Playbox → Package** → отметь **Moloco V2.0 (Launcher API)** (в блоке «More networks») → **Pack All**.

Результат в `build/plbx-html/molocoV2/`:

- `launcher.html` — ланчер с плейсхолдером `#PAYLOAD_URL#` (< 3 KB)
- `payload.js` — вся игра одним IIFE
- `launcher-local.html` — локальная сборка для ручного смоук-теста в браузере

> 💡 Гейт размера считает лаунчер с резервом под реальный CDN-URL. Если упаковка падает по размеру — укороти Asset Title.

> 📷 *Скриншот Package-таба с выбранным Moloco V2 — не перенесён из исходного Notion-документа.*

## Шаг 3. Локальная валидация

Нажми **Validate** в Package-табе — откроется локальный превью-валидатор, таб **Moloco V2.0 (Launcher API)**.

> ⚠️ Плейбл **не запустится сам**: Moloco V2 стартует только после сигнала viewable от контейнера. В превью нажми кнопку **Viewable** в Manual Triggers (слева сверху) — до этого висит сплеш. В проде контейнер фирит viewable автоматически.

Проверь чеклист (всё должно стать ✅):

| Событие                    | Как тригернуть                                          |
| -------------------------- | ------------------------------------------------------- |
| mraid_viewable             | кнопка Viewable                                         |
| game_viewable              | авто (plbx.game_ready())                                |
| engagement                 | тап по канвасу 1× или Simulate taps                     |
| redirection                | тап 3× или Simulate taps                                |
| complete                   | пройти игру или End game                                |
| click + final_url          | тап по CTA                                              |
| start_muted + кнопка звука | Mute/Unmute в Manual Triggers — спрайт и звук реагируют |

> 📷 *Скриншот валидатора с зелёным чеклистом — не перенесён из исходного Notion-документа.*

## Шаг 4. Deploy — данные и креды

Переходи в таб **Deploy** → карточка **Moloco CDN** (появляется только когда есть собранный molocoV2-билд):

- **API Key** — выдаёт Moloco (хранится глобально, спроси у своего тех-лида)
- **Ad Account ID** — выдаёт Moloco (спроси у своего тех-лида)
- **Asset Provider** — предзаполнен `Playbox`
- **Asset Title** — предзаполнен именем проекта; только буквы/цифры/пробел/`._-`

> ⚠️ VPN может ломать загрузку: api.moloco.cloud блокирует некоторые датацентровые IP (403 Forbidden на всё). Если не пускает, попробуйте загрузку без VPN.

> 📷 *Скриншот карточки Moloco CDN с заполненными полями — не перенесён из исходного Notion-документа.*

## Шаг 5. Upload

Жми **Upload to Moloco CDN**. Что происходит:

1. `payload.js` улетает на CDN Moloco (через их creative-assets API)
2. В `launcher.html` подставляется полученный asset_url → записывается **`launcher-final.html`**

Статус рядом с кнопкой покажет URL ассета при успехе.

## Шаг 6. Проверка в валидаторе Moloco

Открой валидатор от инженеров Moloco: playable-preview

1. Открой `build/plbx-html/molocoV2/launcher-final.html` в редакторе, скопируй **всё содержимое**
2. Вставь в поле Playable snippet → **Preview**
3. Выставь Taps for engagement / redirection для проверки порогов

> 📷 *Скриншот валидатора Moloco с логом событий — не перенесён из исходного Notion-документа.*

## Шаг 7. Проверка событий

В логе справа (таб All / Event) должны появиться:

| Событие                                                    | Когда                                       |
| ---------------------------------------------------------- | ------------------------------------------- |
| INFO: macros / IMP_BEACON / mraid.js / no relative payload | сразу, все зелёные                          |
| MRAID_VIEWABLE fired                                       | после старта                                |
| GAME_VIEWABLE fired                                        | игра загрузилась                            |
| ENGAGEMENT fired                                           | на N-м тапе (порог в настройках валидатора) |
| REDIRECTION fired                                          | на M-м тапе                                 |
| COMPLETE fired                                             | конец игры                                  |
| CTA button clicked + CLICK fired                           | по одному на каждый клик CTA (не два!)      |

Также проверь: таб **Errors** пуст, звук включается кнопкой в игре.

## Шаг 8. Сдача

Всё зелёное → отдай ПМу:

- `launcher-final.html` (payload уже на CDN Moloco — отдельно слать не надо)
- скрин зелёного лога из валидатора Moloco

ПМ передаёт лаунчер аккаунт-менеджеру Moloco на QA.

## Troubleshooting

- **403 Forbidden при Upload** — выключи VPN (блок по IP), проверь что API Key от Moloco Cloud DSP и активен
- **engagement не фирит в валидаторе** — tap() слушает только TOUCH_START, добавь MOUSE_DOWN (см. шаг 1)
- **Серый экран / сплеш висит** — не нажат Viewable (превью) или не вызван plbx.game_ready() (код)
- **Лаунчер превысил 3 KB** — укороти Asset Title в Deploy-карточке, перепакуй

## Связанные документы
- `PLBX_LIFECYCLE_GUIDE.md` — коллбеки шага 1 (lifecycle + аудио), общие для всех сетей.
- `EXPORT_CHECKLIST.md` — Moloco входит в общий список 11 сетей; нейминг архива `PL_B4C4_moloco` (folder `molocoV2` — внутренний id упаковщика, не имя архива для сдачи).
- `OPEN_ISSUES.md` #3 — Moloco API Key и Ad Account ID пока не получены; см. пункт до старта Шага 4.
