export type ProductContextId = "maia" | "mikaelson" | "off" | "orbit";

export type BusinessDomain = "strategy" | "finance" | "operations";

export type IntelligenceIntent =
  | "analyze"
  | "plan"
  | "assess-risk"
  | "summarize"
  | "recommend";

export type ResponseStrategy = "analytical" | "action-oriented" | "executive-summary";

export interface CompanyProfile {
  name?: string;
  industry?: string;
  businessModel?: string;
}

export interface BusinessContext {
  tenantId: string;
  productContext: ProductContextId;
  productId: string;
  company: CompanyProfile;
  strategicGoals: string[];
  kpis: string[];
  projects: string[];
  clients: string[];
  risks: string[];
  priorities: string[];
  decisions: string[];
  operationalStatus: string[];
}

export type BusinessContextHints = Partial<
  Omit<BusinessContext, "tenantId" | "productContext" | "productId">
>;

export interface IntelligenceRequest {
  requestId: string;
  tenantId: string;
  productContext: ProductContextId;
  productId?: string;
  message: string;
  contextHints?: BusinessContextHints;
  userId?: string;
}

export interface ReasoningDecision {
  intent: IntelligenceIntent;
  domain: BusinessDomain;
  agentId: string;
  confidence: number;
  responseStrategy: ResponseStrategy;
}

export interface AgentIdentity {
  id: string;
  name: string;
  role: string;
  domain: BusinessDomain;
  capabilities: string[];
}

export interface ActionSuggestion {
  actionId: string;
  title: string;
  rationale: string;
  priority: "low" | "medium" | "high";
}

export interface AgentAnalysis {
  summary: string;
  analysis: string[];
  risks: string[];
}

export interface AgentRecommendation {
  recommendations: string[];
  actionSuggestions: ActionSuggestion[];
}

export interface IntelligenceResponse {
  requestId: string;
  tenantId: string;
  productContext: ProductContextId;
  productId: string;
  domain: BusinessDomain;
  agent: AgentIdentity;
  intent: IntelligenceIntent;
  summary: string;
  analysis: string[];
  risks: string[];
  recommendations: string[];
  nextSteps: string[];
  confidence: number;
  createdAt: string;
  traceId: string;
}
