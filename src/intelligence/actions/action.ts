import type {
  ActionSuggestion,
  BusinessContext,
  BusinessDomain,
} from "@/intelligence/contracts/types";

export interface ActionExecution {
  actionId: string;
  status: "simulated" | "completed" | "failed";
  message: string;
}

export interface IntelligenceAction {
  id: string;
  name: string;
  description: string;
  supportedDomains: BusinessDomain[];
  execute(suggestion: ActionSuggestion, context: BusinessContext): Promise<ActionExecution>;
}

export interface ActionRegistry {
  register(action: IntelligenceAction): void;
  get(id: string): IntelligenceAction;
  list(): IntelligenceAction[];
}
