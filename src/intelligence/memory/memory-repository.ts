export interface MemoryRecord<T = unknown> {
  id: string;
  tenantId: string;
  productId: string;
  type: string;
  content: T;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchQuery {
  tenantId: string;
  productId?: string;
  type?: string;
  text?: string;
  tags?: string[];
}

export interface MemoryRepository {
  save<T>(record: MemoryRecord<T>): Promise<MemoryRecord<T>>;
  retrieve<T>(tenantId: string, id: string): Promise<MemoryRecord<T> | null>;
  update<T>(
    tenantId: string,
    id: string,
    changes: Partial<Pick<MemoryRecord<T>, "content" | "tags" | "type">>,
  ): Promise<MemoryRecord<T> | null>;
  search(query: MemorySearchQuery): Promise<MemoryRecord[]>;
  delete(tenantId: string, id: string): Promise<boolean>;
}
