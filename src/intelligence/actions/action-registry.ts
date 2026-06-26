import type { ActionRegistry, IntelligenceAction } from "./action";

export class DefaultActionRegistry implements ActionRegistry {
  private readonly actions = new Map<string, IntelligenceAction>();

  constructor(actions: IntelligenceAction[] = []) {
    actions.forEach((action) => this.register(action));
  }

  register(action: IntelligenceAction) {
    this.actions.set(action.id, action);
  }

  get(id: string) {
    const action = this.actions.get(id);
    if (!action) throw new Error(`Action "${id}" is not registered.`);
    return action;
  }

  list() {
    return [...this.actions.values()];
  }
}
