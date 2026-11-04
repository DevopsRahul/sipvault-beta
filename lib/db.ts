import { PrismaClient } from "@prisma/client";

// Re-use a single Prisma client (avoids exhausting DB connections during hot reload in dev).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
