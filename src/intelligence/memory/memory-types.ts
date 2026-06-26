import type { MemoryReviewStatus } from "@/intelligence/contracts/enums";

export interface MemoryLifecycleFields {
  archivedAt?: string;
  reviewStatus: MemoryReviewStatus;
}
