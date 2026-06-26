import type { IntelligenceRequest } from "@/intelligence/contracts/types";
import type { AIProvider } from "@/intelligence/providers/provider";
import type { ReasoningContext } from "./reasoning-context";
import type { ReasoningResult } from "./reasoning-types";

export class ReasoningPipeline {
  constructor(private readonly provider: AIProvider) {}

  async run(request: IntelligenceRequest, context: ReasoningContext): Promise<ReasoningResult> {
    const providerMessage = await this.provider.generateResponse({
      systemPrompt: "Respond safely using only the supplied Sprint 1 context package.",
      userMessage: request.message,
      context: context.businessContext,
    });
    const summary = await this.provider.summarize(providerMessage);
    const actionSuggestions = await this.provider.extractActions(summary);

    return {
      assistantMessage: providerMessage,
      analysis: {
        summary,
        analysis: [
          providerMessage,
          `Routed through ${context.decision.domain} reasoning with ${context.decision.responseStrategy} strategy.`,
        ],
        risks: context.businessContext.risks.length
          ? context.businessContext.risks
          : ["Insufficient durable business context may reduce recommendation quality."],
      },
      recommendation: {
        recommendations: [
          "Validate assumptions with an accountable owner.",
          "Define one measurable outcome and a review date.",
        ],
        actionSuggestions,
      },
      actionSuggestions,
      traceSummary: `Provider ${this.provider.id} returned a safe assistant response for ${request.productContext}.`,
    };
  }
}
