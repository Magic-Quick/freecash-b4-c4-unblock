import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

// Дисклеймер обязателен всегда, независимо от GamePhase (AGENTS.md §8, QA_CHECKLIST.md) — статичный
// текст, устанавливается один раз и никогда не скрывается никаким событием/фазой/системой.
@ccclass('DisclaimerView')
export class DisclaimerView extends Component {
    @property(Label)
    public label: Label | null = null;

    @property({ tooltip: 'Текст дисклеймера — единственный источник, не дублировать литералом в другом месте' })
    public text = 'For illustration purposes only';

    protected start(): void {
        if (this.label) {
            this.label.string = this.text;
        }
        this.node.active = true;
    }
}
