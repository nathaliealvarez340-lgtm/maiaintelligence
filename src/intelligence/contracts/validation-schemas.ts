import { isProductContextId } from "@/intelligence/context/product-contexts";
import type { SprintChatRequest } from "./api-contracts";

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

export const validateSprintChatRequest = (input: unknown): ValidationResult<SprintChatRequest> => {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const candidate = input as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof candidate.requestId !== "string" || candidate.requestId.length === 0) {
    errors.push("requestId is required.");
  }
  if (typeof candidate.tenantId !== "string" || candidate.tenantId.length === 0) {
    errors.push("tenantId is required.");
  }
  if (!isProductContextId(candidate.productContext)) {
    errors.push("productContext must be one of: maia, mikaelson, off, orbit.");
  }
  if (typeof candidate.message !== "string" || candidate.message.trim().length === 0) {
    errors.push("message is required.");
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      requestId: candidate.requestId as string,
      tenantId: candidate.tenantId as string,
      productContext: candidate.productContext as SprintChatRequest["productContext"],
      message: (candidate.message as string).trim(),
    },
    errors: [],
  };
};
