# _archive

Ассеты, на которые в проекте не осталось ни одной ссылки (проверено сканом всех
сериализованных файлов `assets/**`: `.scene`, `.prefab`, `.json`, `.ts` — по UUID).

Лежат ВНЕ `assets/`, поэтому Cocos их не импортирует и не кладёт в билд, но файлы и их
`.meta` (а значит и UUID) сохранены: чтобы вернуть ассет в работу, достаточно перенести
пару `<файл>` + `<файл>.meta` обратно в `assets/...` — ссылки по UUID переживут переезд.

Перенесено 2026-08-30, 1.08 MB:

| файл | размер | почему |
|---|---|---|
| `art/board/board.png` | 521 KB | заменён на `Board_full.png` (карман выхода запечён в текстуру) |
| `art/ui/packshot_panel.png` | 290 KB | пэкшот собран из отдельных слоёв, единой панели больше нет |
| `art/ui/freecash_logo.png` | 56 KB | логотип берётся из `art/packshot/logo.png` |
| `art/sprites/background.png` | 58 KB | заменён на `art/bg/bg_gameplay.png` |
| `art/ui/btn_cta_wide.png` | 49 KB | CTA-кнопка — `art/packshot/btn_play_earn.png` |
| `art/ui/btn_base.png` | 32 KB | кнопки бара нарисованы каждая целиком (`btn_undo/restart/hint/pause`) |
| `art/ui/lamp.png` | 24 KB | не использовался |
| `art/sprites/board_frame.png` | 11 KB | плата — цельный арт, Cell-слоя больше нет |
| `art/sprites/exit_arrow.png` | 2.5 KB | заменён на `art/board/exit_arrows.png` |
| `art/ui/button_play.png` | 2.1 KB | placeholder-заглушка |
| `art/sprites/block_main.png` | 1.8 KB | заменён нарезкой `art/blocks/*` |
| `art/sprites/block_tile.png` | 1.8 KB | заменён нарезкой `art/blocks/*` |
| `art/ui/white_pixel.png` | 0.3 KB | не использовался |
| `audio/sfx/*-v1.mp3` (5 шт.) | 47 KB | заменены ревизией v2 |
| `audio/sfx/coin-fly-v1/v2.mp3` | 20 KB | RewardSystem вырезан (OPEN_ISSUES.md #5) |

`art/sprites/spark.png` НЕ архивирован: на него ссылается нода `FxLayer/Sparks` (сейчас
неактивна, но ссылка живая).

`audio/sfx/cta-tap-v2.mp3` НЕ архивирован: он выпал из `SoundSystem.uiTapClip` при
переcериализации сцены в 16214a7 и был возвращён — это общий клик Undo/Restart/Hint/CTA.
