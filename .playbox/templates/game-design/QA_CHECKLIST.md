# QA_CHECKLIST — <Название плейбла>

> Ручной регрессионный прогон перед сдачей. Тестируем весь core loop, не только изменённую фичу.

## Static
- [ ] `npx tsc --noEmit -p tsconfig.json` = 0 ошибок
- [ ] Нет `find(` / `getChildByName(` / `getComponentInChildren(` в новом коде
- [ ] Нет ручных `.meta`, нет production `console.log`, нет новых зависимостей

## Scene
- [ ] `query_scene_graph` совпадает с SCENE_SETUP.md
- [ ] `validate_document` pass; нет missing script / missing property
- [ ] Первый кадр читается корректно (safe-area, фон, без наложений HUD на геймплей)

## Manual (core loop)
- [ ] Первый кадр ясен
- [ ] Туториал / первое взаимодействие
- [ ] Основной цикл ввода
- [ ] Обновление score/экономики
- [ ] Переход в payoff / end-card
- [ ] CTA виден и кликается
- [ ] Idle-поведение
- [ ] Спам-тапы
- [ ] Reload

## Network / lifecycle
- [ ] `plbx.game_ready()` один раз
- [ ] `plbx.tap()` на значимом вводе
- [ ] `plbx.download()` на CTA
- [ ] `plbx.game_end()` в терминале
- [ ] Нет дублей redirect; нет прямых вызовов SDK в обход адаптера
