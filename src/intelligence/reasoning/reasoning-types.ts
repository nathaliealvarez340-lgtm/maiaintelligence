import type { ActionSuggestion, AgentAnalysis, AgentRecommendation } from "@/intelligence/contracts/types";

export interface ReasoningResult {
  assistantMessage: string;
  analysis: AgentAnalysis;
  recommendation: AgentRecommendation;
  actionSuggestions: ActionSuggestion[];
  traceSummary: string;
}
