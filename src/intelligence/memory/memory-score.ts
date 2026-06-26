import type { MemoryRecord } from "./memory-repository";

export const scoreMemory = (record: MemoryRecord, queryText?: string) => {
  if (!queryText) return 1;
  return JSON.stringify(record.content).toLowerCase().includes(queryText.toLowerCase()) ? 2 : 0;
};
