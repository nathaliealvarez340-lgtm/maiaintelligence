import type {
  BusinessDomain,
  IntelligenceRequest,
  ReasoningDecision,
} from "@/intelligence/contracts/types";
import type { AIProvider } from "@/intelligence/providers/provider";

export interface ReasoningEngine {
  reason(request: IntelligenceRequest): Promise<ReasoningDecision>;
}

const domainTerms: Record<BusinessDomain, string[]> = {
  strategy: ["strategy", "market", "growth", "position", "roadmap", "goal"],
  finance: ["finance", "revenue", "margin", "cash", "budget", "cost", "profit"],
  operations: ["operations", "process", "delivery", "capacity", "workflow", "efficiency"],
};

export class DeterministicReasoningEngine implements ReasoningEngine {
  constructor(private readonly provider: AIProvider) {}

  async reason(request: IntelligenceRequest): Promise<ReasoningDecision> {
    const normalized = request.message.toLowerCase();
    const ranked = Object.entries(domainTerms)
      .map(([domain, terms]) => ({
        domain: domain as BusinessDomain,
        score: terms.filter((term) => normalized.includes(term)).length,
      }))
      .sort((a, b) => b.score - a.score);
    const selected = ranked[0];
    const intent = await this.provider.classifyIntent(request.message);
    const domain = selected.score > 0 ? selected.domain : "strategy";

    return {
      intent: intent.intent,
      domain,
      agentId: `${domain}-agent`,
      confidence: Math.min(0.95, intent.confidence + (selected.score > 0 ? 0.1 : 0)),
      responseStrategy: intent.intent === "summarize" ? "executive-summary" : "action-oriented",
    };
  }
}
