import type { MemoryRecord, MemoryRepository, MemorySearchQuery } from "./memory-repository";

export class MockMemoryRepository implements MemoryRepository {
  private readonly records = new Map<string, MemoryRecord>();

  async save<T>(record: MemoryRecord<T>) {
    this.records.set(record.id, record);
    return record;
  }

  async retrieve<T>(tenantId: string, id: string) {
    const record = this.records.get(id);
    return record?.tenantId === tenantId ? (record as MemoryRecord<T>) : null;
  }

  async update<T>(
    tenantId: string,
    id: string,
    changes: Partial<Pick<MemoryRecord<T>, "content" | "tags" | "type">>,
  ) {
    const current = await this.retrieve<T>(tenantId, id);
    if (!current) return null;
    const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
    this.records.set(id, updated);
    return updated;
  }

  async search(query: MemorySearchQuery) {
    const text = query.text?.toLowerCase();
    return [...this.records.values()].filter((record) => {
      const searchable = JSON.stringify(record.content).toLowerCase();
      return (
        record.tenantId === query.tenantId &&
        (!query.productId || record.productId === query.productId) &&
        (!query.type || record.type === query.type) &&
        (!query.tags || query.tags.every((tag) => record.tags.includes(tag))) &&
        (!text || searchable.includes(text))
      );
    });
  }

  async delete(tenantId: string, id: string) {
    const record = await this.retrieve(tenantId, id);
    return record ? this.records.delete(id) : false;
  }
}
