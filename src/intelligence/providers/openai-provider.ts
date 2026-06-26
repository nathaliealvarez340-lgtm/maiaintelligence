import type { ActionSuggestion, IntelligenceIntent } from "@/intelligence/contracts/types";
import type { AIProvider, GenerateResponseInput } from "./provider";

export interface OpenAIChatClient {
  createChatCompletion(input: {
    systemPrompt: string;
    userMessage: string;
    context: Record<string, unknown>;
  }): Promise<string>;
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";

  constructor(private readonly client: OpenAIChatClient) {}

  generateResponse(input: GenerateResponseInput) {
    return this.client.createChatCompletion({
      systemPrompt: input.systemPrompt,
      userMessage: input.userMessage,
      context: input.context as unknown as Record<string, unknown>,
    });
  }

  async classifyIntent(): Promise<{ intent: IntelligenceIntent; confidence: number }> {
    return { intent: "analyze", confidence: 0.7 };
  }

  async summarize(content: string) {
    return content.length > 220 ? `${content.slice(0, 217)}...` : content;
  }

  async extractActions(): Promise<ActionSuggestion[]> {
    return [
      {
        actionId: "suggest-next-actions",
        title: "Review assistant response",
        rationale: "Sprint 1 keeps actions simulated and human-reviewed.",
        priority: "medium",
      },
    ];
  }
}
