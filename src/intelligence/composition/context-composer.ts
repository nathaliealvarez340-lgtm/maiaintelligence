import { productContexts } from "@/intelligence/context/product-contexts";
import type { BusinessContext } from "@/intelligence/contracts/types";
import type { ContextPackage } from "./context-package";
import type { RequestContext } from "./request-context";

export class ContextComposer {
  compose(input: {
    request: RequestContext;
    businessContext: BusinessContext;
  }): ContextPackage {
    const product = productContexts[input.request.productContext];

    return {
      request: input.request,
      product: {
        id: product.id,
        label: product.label,
      },
      businessContext: input.businessContext,
      sensitiveSessionState: {
        accessLevel: input.request.sensitiveAccess,
        allowed: input.request.sensitiveAccess !== "none",
      },
    };
  }
}
