import type { IntelligenceRequest, IntelligenceResponse } from "@/intelligence/contracts/types";

export interface MaiaCore {
  execute(request: IntelligenceRequest): Promise<IntelligenceResponse>;
}
