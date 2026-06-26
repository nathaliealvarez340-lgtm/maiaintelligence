import type {
  IntelligenceRequest,
  IntelligenceResponse,
} from "@/intelligence/contracts/types";
import type { ActionRegistry } from "@/intelligence/actions/action";
import type { AgentRegistry } from "@/intelligence/agents/agent";
import { ContextComposer } from "@/intelligence/composition/context-composer";
import type { ContextEngine } from "@/intelligence/context/context-engine";
import { TraceService } from "@/intelligence/audit/trace-service";
import type { ReasoningEngine } from "@/intelligence/reasoning/reasoning-engine";
import { ReasoningPipeline } from "@/intelligence/reasoning/reasoning-pipeline";
import type { MaiaCore } from "./maia-core";

export class MaiaIntelligence implements MaiaCore {
  constructor(
    private readonly reasoning: ReasoningEngine,
    private readonly context: ContextEngine,
    private readonly agents: AgentRegistry,
    private readonly actions: ActionRegistry,
    private readonly pipeline: ReasoningPipeline,
    private readonly composer = new ContextComposer(),
    private readonly traces = new TraceService(),
  ) {}

  async execute(request: IntelligenceRequest): Promise<IntelligenceResponse> {
    const decision = await this.reasoning.reason(request);
    const businessContext = await this.context.build(request);
    const agent = this.agents.get(decision.agentId);
    const contextPackage = this.composer.compose({
      request: {
        requestId: request.requestId,
        tenantId: request.tenantId,
        user: {
          id: request.userId ?? "system",
          clerkUserId: request.userId ?? "system",
        },
        role: "member",
        permissions: ["chat:use", "memory:read"],
        productContext: request.productContext,
        sensitiveAccess: "metadata",
      },
      businessContext,
    });
    const reasoningResult = await this.pipeline.run(request, {
      package: contextPackage,
      businessContext,
      decision,
    });
    const executions = await Promise.all(
      reasoningResult.actionSuggestions.map((suggestion) =>
        this.actions.get(suggestion.actionId).execute(suggestion, businessContext),
      ),
    );
    const trace = this.traces.createTrace({
      requestId: request.requestId,
      tenantId: request.tenantId,
      productContext: request.productContext,
      providerId: "configured-provider",
      summary: reasoningResult.traceSummary,
    });

    return {
      requestId: request.requestId,
      tenantId: request.tenantId,
      productContext: request.productContext,
      productId: request.productId ?? request.productContext,
      domain: decision.domain,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        domain: agent.domain,
        capabilities: agent.capabilities,
      },
      intent: decision.intent,
      summary: reasoningResult.analysis.summary,
      analysis: reasoningResult.analysis.analysis,
      risks: reasoningResult.analysis.risks,
      recommendations: reasoningResult.recommendation.recommendations,
      nextSteps: executions.map((execution) => execution.message),
      confidence: decision.confidence,
      createdAt: new Date().toISOString(),
      traceId: trace.id,
    };
  }
}
