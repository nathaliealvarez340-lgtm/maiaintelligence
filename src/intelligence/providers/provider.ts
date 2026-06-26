import type {
  ActionSuggestion,
  BusinessContext,
  IntelligenceIntent,
} from "@/intelligence/contracts/types";

export interface GenerateResponseInput {
  systemPrompt: string;
  userMessage: string;
  context: BusinessContext;
}

export interface AIProvider {
  readonly id: string;
  generateResponse(input: GenerateResponseInput): Promise<string>;
  classifyIntent(message: string): Promise<{ intent: IntelligenceIntent; confidence: number }>;
  summarize(content: string): Promise<string>;
  extractActions(content: string): Promise<ActionSuggestion[]>;
}
