import { MemoryReviewStatuses, type MemoryReviewStatus } from "@/intelligence/contracts/enums";
import { createId } from "@/intelligence/shared/ids";
import type { MemoryRecord, MemoryRepository, MemorySearchQuery } from "./memory-repository";
import { createMemoryVersion, type MemoryVersion } from "./memory-version";

export class MemoryService {
  private readonly versions: MemoryVersion[] = [];

  constructor(private readonly repository: MemoryRepository) {}

  async createMemory<T>(input: Omit<MemoryRecord<T>, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const record = await this.repository.save({
      ...input,
      id: createId("memory"),
      createdAt: now,
      updatedAt: now,
    });
    this.versions.push(createMemoryVersion(record));
    return record;
  }

  async updateMemory<T>(
    tenantId: string,
    id: string,
    changes: Partial<Pick<MemoryRecord<T>, "content" | "tags" | "type">>,
  ) {
    const updated = await this.repository.update(tenantId, id, changes);
    if (updated) this.versions.push(createMemoryVersion(updated));
    return updated;
  }

  archiveMemory(tenantId: string, id: string) {
    return this.repository.update(tenantId, id, { tags: ["archived"] });
  }

  markReviewStatus(tenantId: string, id: string, status: MemoryReviewStatus) {
    return this.repository.update(tenantId, id, { tags: [`review:${status}`] });
  }

  findTenantMemories(query: MemorySearchQuery) {
    return this.repository.search(query);
  }

  getVersions(memoryId: string) {
    return this.versions.filter((version) => version.memoryId === memoryId);
  }

  defaultReviewStatus() {
    return MemoryReviewStatuses.pending;
  }
}
