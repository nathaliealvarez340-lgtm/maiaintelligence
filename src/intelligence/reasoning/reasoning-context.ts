import type { ContextPackage } from "@/intelligence/composition/context-package";
import type { BusinessContext, ReasoningDecision } from "@/intelligence/contracts/types";

export interface ReasoningContext {
  package: ContextPackage;
  businessContext: BusinessContext;
  decision: ReasoningDecision;
}
