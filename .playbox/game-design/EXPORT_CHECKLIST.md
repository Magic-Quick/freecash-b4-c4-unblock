# EXPORT_CHECKLIST — «Unblock» (Freecash B4C4)

> Гейт выпуска. Каждый билд обязательно валидировать (GDD §10); при сомнениях — к лиду.

## Версия
- Только **store**-версия (лендинг-версия отменена, GDD §8): ссылки на сторы.
  - iOS: `https://apps.apple.com/app/id1673567402`
  - Android: `https://play.google.com/store/apps/details?id=com.freecash.app2`

## Нейминг
- Формат: `PL_B<Batch>C<Concept>_<Network>`, разделитель `_`.
- Этот проект: **`PL_B4C4_<network>`** (Batch 4, Concept 4). Пример: `PL_B4C4_applovin`.
- Архив: **RAR**, внутри папка `store`.

## Сетки (11) — собрать под каждую
- [ ] Mintegral
- [ ] AppLovin
- [ ] Google
- [ ] Unity
- [ ] Moloco
- [ ] IronSource2025
- [ ] TikTok
- [ ] Facebook
- [ ] Smadex
- [ ] Liftoff
- [ ] Snapchat

## Обязательные проверки перед упаковкой
- [ ] Вес каждого билда ≤ **5 MB**.
- [ ] Дисклеймер «For illustration purposes only» присутствует во всех билдах, весь ролик.
- [ ] Нет денежных символов/купюр/$/банк-карт; монета — только «FC».
- [ ] Клиентский логотип Freecash (не игровое/сгенерённое лого).
- [ ] CTA «PLAY & EARN» ведёт на корректный стор для сборки сети.
- [ ] Инжект per-network SDK/тегов (`plbx` adapter) корректен под каждую сеть (см. OPEN_ISSUES #3).
- [ ] Плейбл проходит smoke-сценарий из `QA_CHECKLIST.md` в предпросмотре сети.
- [ ] Валидация в валидаторе каждой сети (Mintegral/AppLovin/… preview) = pass.

## После сборки
- [ ] Все билды провалидированы.
- [ ] Архив(ы) названы по схеме и переданы в чат.
