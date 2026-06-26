import type { IntelligenceIntent } from "@/intelligence/contracts/types";
import type { AIProvider, GenerateResponseInput } from "./provider";

const intentTerms: Record<IntelligenceIntent, string[]> = {
  analyze: ["analyze", "analyse", "review", "evaluate"],
  plan: ["plan", "roadmap", "strategy"],
  "assess-risk": ["risk", "threat", "exposure"],
  summarize: ["summarize", "summary", "status"],
  recommend: ["recommend", "suggest", "next"],
};

export class MockProvider implements AIProvider {
  readonly id = "mock";

  async generateResponse(input: GenerateResponseInput): Promise<string> {
    const company = input.context.company.name ?? "the business";
    return `${company}: ${input.userMessage.trim()} should be evaluated against current priorities, measurable outcomes, and execution constraints.`;
  }

  async classifyIntent(message: string) {
    const normalized = message.toLowerCase();
    const match = Object.entries(intentTerms).find(([, terms]) =>
      terms.some((term) => normalized.includes(term)),
    );
    return {
      intent: (match?.[0] as IntelligenceIntent | undefined) ?? "analyze",
      confidence: match ? 0.82 : 0.58,
    };
  }

  async summarize(content: string): Promise<string> {
    return content.length > 180 ? `${content.slice(0, 177)}...` : content;
  }

  async extractActions(content: string) {
    return [
      {
        actionId: "suggest-next-actions",
        title: "Define the next decision",
        rationale: `Convert the analysis into an accountable decision: ${await this.summarize(content)}`,
        priority: "high" as const,
      },
    ];
  }
}
