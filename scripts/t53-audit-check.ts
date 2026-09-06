import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const rows = await db.adminAuditLog.findMany({ where: { action: { startsWith: 'cyber_' } }, orderBy: { createdAt: 'desc' }, take: 5 });
console.log(JSON.stringify(rows.map(r => ({ action: r.action, target: r.targetId, details: r.details, at: r.createdAt })), null, 1));
await db.$disconnect();
