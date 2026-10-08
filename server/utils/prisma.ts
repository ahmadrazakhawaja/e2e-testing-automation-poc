import { PrismaClient } from '@prisma/client'

// Reuse one client across dev hot-reloads instead of opening a new connection each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (import.meta.dev) globalForPrisma.prisma = prisma
