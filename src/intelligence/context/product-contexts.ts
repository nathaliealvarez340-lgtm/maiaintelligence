import type { ProductContextId } from "@/intelligence/contracts/types";
import type { ProductContextDefinition } from "./product-context-types";

export const productContexts: Record<ProductContextId, ProductContextDefinition> = {
  maia: {
    id: "maia",
    label: "MAIA",
    description: "Core MAIA Intelligence workspace.",
  },
  mikaelson: {
    id: "mikaelson",
    label: "Mikaelson",
    description: "Mikaelson business context.",
  },
  off: {
    id: "off",
    label: "OFF",
    description: "OFF editorial and operational context.",
  },
  orbit: {
    id: "orbit",
    label: "Orbit",
    description: "Orbit product and data context.",
  },
};

export const isProductContextId = (value: unknown): value is ProductContextId =>
  typeof value === "string" && value in productContexts;
