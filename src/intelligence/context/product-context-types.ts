import type { ProductContextId } from "@/intelligence/contracts/types";

export interface ProductContextDefinition {
  id: ProductContextId;
  label: string;
  description: string;
}
