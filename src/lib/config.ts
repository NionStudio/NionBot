import { Prisma, type GuildConfig } from '@prisma/client';
import { prisma } from './prisma.js';
import { EMOJI } from './emojis.js';

const cache = new Map<string, GuildConfig>();

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId },
    update: {},
  });

  cache.set(guildId, config);
  return config;
}

export async function updateGuildConfig(
  guildId: string,
  data: Omit<Prisma.GuildConfigUncheckedCreateInput, 'guildId'>,
): Promise<GuildConfig> {
  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, ...data },
    update: data,
  });

  cache.set(guildId, config);
  return config;
}

export function invalidateGuildConfig(guildId: string): void {
  cache.delete(guildId);
}

export interface TemplateVars {
  user: string;
  username: string;
  server: string;
  count: number;

  creationDate?: string;

  invitedBy?: string;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  const count = vars.count.toLocaleString('en-US');
  return template
    .replaceAll('{user}', vars.user)
    .replaceAll('{username}', vars.username)
    .replaceAll('{server}', vars.server)
    .replaceAll('{count}', count)
    .replaceAll('{new_member_count}', count)
    .replaceAll('{creation_date}', vars.creationDate ?? '')
    .replaceAll('{invited_by}', vars.invitedBy ?? '')
    .replaceAll('{e:icon}', EMOJI.icon)
    .replaceAll('{e:user}', EMOJI.user)
    .replaceAll('{e:creation}', EMOJI.creation)
    .replaceAll('{e:invited}', EMOJI.invited);
}
