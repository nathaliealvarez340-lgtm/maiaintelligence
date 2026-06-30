import {
  PrismaClient,
  type PrismaClient as PrismaClientInstance,
} from "@/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  maiaPrisma?: PrismaClientInstance;
};

export const getAuthenticationPrismaClient = (): PrismaClientInstance => {
  if (globalForPrisma.maiaPrisma) {
    return globalForPrisma.maiaPrisma;
  }

  const accelerateUrl = process.env.PRISMA_ACCELERATE_URL ?? process.env.DATABASE_URL;
  if (!accelerateUrl) {
    throw new Error("Prisma database URL is not configured.");
  }

  const client = new PrismaClient({ accelerateUrl });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.maiaPrisma = client;
  }

  return client;
};
