import type {
  BusinessContext,
  BusinessContextHints,
  IntelligenceRequest,
} from "@/intelligence/contracts/types";
import type { MemoryRepository } from "@/intelligence/memory/memory-repository";
import { MaiaError } from "@/intelligence/shared/errors";
import type { AuthorizedContext } from "../authorization/authorization-context";
import { AuthorizationError } from "../authorization/authorization-errors";
import { requirePermissionAccess } from "../authorization/authorization-enforcement";
import { Permissions } from "../contracts/enums";
import { isProductContextId } from "./product-contexts";

export interface ContextEngine {
  // Internal callers must supply context from the canonical server authorization boundary.
  build(
    request: IntelligenceRequest,
    authorization: AuthorizedContext,
  ): Promise<BusinessContext>;
}

export class BusinessContextEngine implements ContextEngine {
  constructor(private readonly memory: MemoryRepository) {}

  async build(
    request: IntelligenceRequest,
    authorization: AuthorizedContext,
  ): Promise<BusinessContext> {
    if (!authorization || !authorization.tenantId?.trim()) {
      throw new AuthorizationError(
        "AUTHORIZATION_CONTEXT_REQUIRED",
        "A valid MAIA authorization context is required.",
      );
    }

    const authorizedContext = await requirePermissionAccess(Permissions.memoryRead, authorization);

    if (!isProductContextId(request.productContext)) {
      throw new MaiaError("UNKNOWN_PRODUCT_CONTEXT", "Unknown productContext.", 400, {
        productContext: request.productContext,
      });
    }

    const records = await this.memory.search({
      tenantId: authorizedContext.tenantId,
      productId: request.productId ?? request.productContext,
      type: "business-context",
    });
    const remembered = records.reduce<BusinessContextHints>(
      (context, record) => ({ ...context, ...(record.content as BusinessContextHints) }),
      {},
    );
    const hints = { ...remembered, ...request.contextHints };

    // Only business fields may enter from stored context or request hints.
    return {
      tenantId: authorizedContext.tenantId,
      productContext: request.productContext,
      productId: request.productId ?? request.productContext,
      company: hints.company ?? {},
      strategicGoals: hints.strategicGoals ?? [],
      kpis: hints.kpis ?? [],
      projects: hints.projects ?? [],
      clients: hints.clients ?? [],
      risks: hints.risks ?? [],
      priorities: hints.priorities ?? [],
      decisions: hints.decisions ?? [],
      operationalStatus: hints.operationalStatus ?? [],
    };
  }
}
