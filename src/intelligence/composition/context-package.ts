import type { RequestContext } from "./request-context";
import type { BusinessContext } from "@/intelligence/contracts/types";

export interface ContextPackage {
  request: RequestContext;
  product: {
    id: string;
    label: string;
  };
  businessContext: BusinessContext;
  sensitiveSessionState: {
    accessLevel: string;
    allowed: boolean;
  };
}
