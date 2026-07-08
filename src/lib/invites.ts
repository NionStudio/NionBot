import {
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type Invite,
} from 'discord.js';
import { logger } from './logger.js';

interface CachedInvite {
  uses: number;
  inviterId: string | null;
}

const cache = new Map<string, Map<string, CachedInvite>>();

function canManage(guild: Guild): boolean {
  return guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
}

function snapshot(invites: Iterable<Invite>): Map<string, CachedInvite> {
  const map = new Map<string, CachedInvite>();
  for (const invite of invites) {
    map.set(invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviter?.id ?? null,
    });
  }
  return map;
}

export async function cacheGuildInvites(guild: Guild): Promise<void> {
  if (!canManage(guild)) {
    logger.warn(
      { guildId: guild.id },
      'Sin permiso ManageGuild: no se puede rastrear "Invited by"',
    );
    return;
  }
  try {
    const invites = await guild.invites.fetch();
    cache.set(guild.id, snapshot(invites.values()));
    logger.debug({ guildId: guild.id, count: invites.size }, 'Invites cacheadas');
  } catch (err) {
    logger.warn({ guildId: guild.id, err }, 'No se pudieron cachear las invites');
  }
}

export async function cacheAllGuilds(guilds: Iterable<Guild>): Promise<void> {
  await Promise.all([...guilds].map((g) => cacheGuildInvites(g)));
}

export function trackInviteCreate(invite: Invite): void {
  if (!invite.guild || !('id' in invite.guild)) return;
  const map = cache.get(invite.guild.id) ?? new Map<string, CachedInvite>();
  map.set(invite.code, {
    uses: invite.uses ?? 0,
    inviterId: invite.inviter?.id ?? null,
  });
  cache.set(invite.guild.id, map);
}

export function trackInviteDelete(invite: Invite): void {
  if (!invite.guild || !('id' in invite.guild)) return;
  cache.get(invite.guild.id)?.delete(invite.code);
}

export async function resolveInviter(member: GuildMember): Promise<string | null> {
  const guild = member.guild;
  if (!canManage(guild)) return null;

  const before = cache.get(guild.id) ?? new Map<string, CachedInvite>();

  try {
    const invites = await guild.invites.fetch();
    let inviterId: string | null = null;

    for (const invite of invites.values()) {
      const prev = before.get(invite.code)?.uses ?? 0;
      if ((invite.uses ?? 0) > prev) {
        inviterId = invite.inviter?.id ?? null;
        break;
      }
    }

    if (!inviterId) {
      const disappeared = [...before.keys()].filter((code) => !invites.has(code));
      if (disappeared.length === 1) {
        const code = disappeared[0]!;
        inviterId = before.get(code)?.inviterId ?? null;
      }
    }

    cache.set(guild.id, snapshot(invites.values()));
    return inviterId;
  } catch (err) {
    logger.warn(
      { guildId: guild.id, userId: member.id, err },
      'No se pudo resolver el invitador',
    );
    return null;
  }
}
