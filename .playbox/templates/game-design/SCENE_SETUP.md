# SCENE_SETUP — <Название плейбла>

> Рецепт иерархии сцены для cocos-scene-builder. Правки — только через MCP `plbx-cocos` (`apply_edits`, `build_prefab`).

## Canvas
- Размер: <720×1280>, origin <360,640>.

## Целевая иерархия
```
Canvas
├── Camera
├── BackgroundLayer   <TODO>
├── GameplayLayer     <TODO>
├── HudLayer          <TODO>
├── TutorialLayer     <TODO>
├── ResultLayer / CTAOverlay (active=false)  <TODO>
└── GameManager
    ├── <EntryPoint component>
    └── Systems (<список системных нод>)
System (legacy — сохранить UUID: Bootstrap, Grid, CellBase, …)
```

## Wiring (@property → нода/компонент)
<TODO: таблица: компонент.свойство → путь ноды/компонента>

| Компонент.свойство | Цель (путь или _id) |
|--------------------|---------------------|
| <…> | <…> |

## Placeholder-политика
- Ассеты без UUID → `@property` = null + запись в OPEN_ISSUES как ручной шаг в редакторе.
- Без fake UUID и ручных `.meta`.

## Legacy-ноды (не ломать)
<TODO: перечисли ноды с фиксированными UUID/_id, которые используются как есть>
