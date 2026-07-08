import type { Prisma, TicketConfig } from '@prisma/client';
import { prisma } from './prisma.js';
import { seedDefaultOptions } from './ticket-options.js';

const cache = new Map<string, TicketConfig>();

export async function getTicketConfig(guildId: string): Promise<TicketConfig> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const existing = await prisma.ticketConfig.findUnique({ where: { guildId } });
  if (existing) {
    cache.set(guildId, existing);
    return existing;
  }

  const config = await prisma.ticketConfig.create({ data: { guildId } });
  await seedDefaultOptions(guildId);
  cache.set(guildId, config);
  return config;
}

export async function updateTicketConfig(
  guildId: string,
  data: Omit<Prisma.TicketConfigUncheckedCreateInput, 'guildId'>,
): Promise<TicketConfig> {
  const config = await prisma.ticketConfig.upsert({
    where: { guildId },
    create: { guildId, ...data },
    update: data,
  });
  cache.set(guildId, config);
  return config;
}

export function invalidateTicketConfig(guildId: string): void {
  cache.delete(guildId);
}
