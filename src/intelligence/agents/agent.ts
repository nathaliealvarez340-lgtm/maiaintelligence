import type {
  AgentIdentity,
  BusinessDomain,
} from "@/intelligence/contracts/types";

export interface PromptTemplates {
  analysis: string;
  recommendation: string;
}

export interface IntelligenceAgent extends AgentIdentity {
  promptTemplates: PromptTemplates;
  placeholderOnly: true;
}

export interface AgentRegistry {
  register(agent: IntelligenceAgent): void;
  get(id: string): IntelligenceAgent;
  findByDomain(domain: BusinessDomain): IntelligenceAgent;
  list(): IntelligenceAgent[];
}
