---
name: asset-batch
description: |
  Короткий запуск cocos-asset-maker для добавления/перегенерации конкретных ассетов.
  Полезно когда нужно пересоздать один-два спрайта без полного /build-playable.
argument-hint: список ассетов через пробел, например "suitcase_l2 collector_body"
---

# /asset-batch

Запусти под-агент `cocos-asset-maker` с задачей: перегенерировать только перечисленные в аргументе ассеты.

Если аргумент пустой — перегенерировать ВСЕ ассеты из полного списка в промпте `cocos-asset-maker`.

После генерации вывести `ls -la assets/art/sprites assets/art/ui` для верификации.
