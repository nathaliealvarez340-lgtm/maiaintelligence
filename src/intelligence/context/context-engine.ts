import type {
  BusinessContext,
  BusinessContextHints,
  IntelligenceRequest,
} from "@/intelligence/contracts/types";
import type { MemoryRepository } from "@/intelligence/memory/memory-repository";
import { MaiaError } from "@/intelligence/shared/errors";
import { isProductContextId } from "./product-contexts";

export interface ContextEngine {
  build(request: IntelligenceRequest): Promise<BusinessContext>;
}

const emptyContext = (request: IntelligenceRequest): BusinessContext => ({
  tenantId: request.tenantId,
  productContext: request.productContext,
  productId: request.productId ?? request.productContext,
  company: {},
  strategicGoals: [],
  kpis: [],
  projects: [],
  clients: [],
  risks: [],
  priorities: [],
  decisions: [],
  operationalStatus: [],
});

export class BusinessContextEngine implements ContextEngine {
  constructor(private readonly memory: MemoryRepository) {}

  async build(request: IntelligenceRequest): Promise<BusinessContext> {
    if (!isProductContextId(request.productContext)) {
      throw new MaiaError("UNKNOWN_PRODUCT_CONTEXT", "Unknown productContext.", 400, {
        productContext: request.productContext,
      });
    }

    const records = await this.memory.search({
      tenantId: request.tenantId,
      productId: request.productId ?? request.productContext,
      type: "business-context",
    });
    const remembered = records.reduce<BusinessContextHints>(
      (context, record) => ({ ...context, ...(record.content as BusinessContextHints) }),
      {},
    );
    return { ...emptyContext(request), ...remembered, ...request.contextHints };
  }
}
