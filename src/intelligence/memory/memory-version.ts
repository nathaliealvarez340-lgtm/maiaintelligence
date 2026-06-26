import { createId } from "@/intelligence/shared/ids";
import type { MemoryRecord } from "./memory-repository";

export interface MemoryVersion<T = unknown> {
  id: string;
  memoryId: string;
  tenantId: string;
  content: T;
  createdAt: string;
}

export const createMemoryVersion = <T>(record: MemoryRecord<T>): MemoryVersion<T> => ({
  id: createId("memory_version"),
  memoryId: record.id,
  tenantId: record.tenantId,
  content: record.content,
  createdAt: new Date().toISOString(),
});
