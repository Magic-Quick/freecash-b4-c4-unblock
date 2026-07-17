# AGENTS — контракт проекта <Название плейбла>

> Рабочий контракт для под-агентов. Конкретные значения — из GDD; здесь их «застывшая» проекция + правила.

## 1. Технет
- Cocos Creator: 3.8.x
- Canvas / origin: <720×1280 / 360,640>
- Пути: код `assets/scripts/{Core,Models,Systems,Views,event-bus}`; арт `assets/art/{sprites,ui}`; префабы `assets/prefabs`.

## 2. Запрещённые API
`find()`, `getChildByName()`, `getComponentInChildren()`, `getComponentsInChildren()`,
ручное создание `.meta`, ручная правка JSON сцены, production `console.log`.

## 3. GameConfig (значения из GDD)
<TODO: перечисли @property-поля и значения>

## 4. Фазы состояния
<TODO: enum GamePhase { … }>

## 5. События (EVT_*)
<TODO: список новых событий и их интерфейсов — добавляются в конец events.ts>

## 6. Структура сцены
<TODO: краткая иерархия — детально в .playbox/game-design/SCENE_SETUP.md>

## 7. Ассеты
<TODO: краткий список — детально в .playbox/game-design/ASSET_SPEC.md; цветовые коды placeholder-ассетов здесь>

## 8. Тест-сценарий (smoke)
<TODO: канонический прогон core loop — детально в .playbox/game-design/QA_CHECKLIST.md>
