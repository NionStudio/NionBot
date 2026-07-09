import type { Args } from '@sapphire/framework';
import { ChannelType, OverwriteType } from 'discord.js';
import type { Guild, Message, TextChannel } from 'discord.js';
import { EMOJI } from './emojis.js';
import { buildNoticeMessage } from './components/ticket-panel.js';
import { getTicketConfig } from './ticket-config.js';
import { getTicketByChannel, isStaff } from './tickets.js';

export type Target = { kind: 'member' | 'role'; id: string; mention: string };

export async function resolveTarget(
  guild: Guild,
  input: string,
): Promise<Target | null> {
  const raw = input.trim();
  const roleMatch = raw.match(/^<@&(\d+)>$/);
  const userMatch = raw.match(/^<@!?(\d+)>$/);

  let id: string | null = null;
  let forced: 'member' | 'role' | null = null;
  if (roleMatch) {
    id = roleMatch[1] ?? null;
    forced = 'role';
  } else if (userMatch) {
    id = userMatch[1] ?? null;
    forced = 'member';
  } else if (/^\d{15,25}$/.test(raw)) {
    id = raw;
  }
  if (!id) return null;

  if (forced !== 'role') {
    const member = await guild.members.fetch(id).catch(() => null);
    if (member) return { kind: 'member', id, mention: `<@${id}>` };
    if (forced === 'member') return null;
  }
  const role = await guild.roles.fetch(id).catch(() => null);
  if (role) return { kind: 'role', id, mention: `<@&${id}>` };
  return null;
}

export async function runAccessCommand(
  message: Message,
  args: Args,
  mode: 'add' | 'remove',
): Promise<void> {
  if (!message.inGuild()) return;
  const channel = message.channel;
  if (channel.type !== ChannelType.GuildText) return;

  const ticket = await getTicketByChannel(channel.id);
  if (!ticket) {
    await reply(message, '❌ Este canal no es un ticket.');
    return;
  }

  const config = await getTicketConfig(message.guildId);
  const member = await message.guild.members.fetch(message.author.id);
  if (!isStaff(member, ticket.staffRoleId ?? config.staffRoleId)) {
    await reply(message, '❌ Solo el staff puede usar esto.');
    return;
  }

  const input = await args.rest('string').catch(() => '');
  if (!input) {
    await reply(message, `Uso: \`$${mode} @usuario | @rol | id\``);
    return;
  }

  const target = await resolveTarget(message.guild, input);
  if (!target) {
    await reply(message, '❌ No encontré ese usuario o rol.');
    return;
  }

  const text = channel as TextChannel;
  if (mode === 'add') {
    await text.permissionOverwrites.edit(
      target.id,
      { ViewChannel: true, SendMessages: true, ReadMessageHistory: true },
      { type: target.kind === 'role' ? OverwriteType.Role : OverwriteType.Member },
    );
  } else if (target.kind === 'member') {
    // Denegar (no borrar): el overwrite de miembro tiene prioridad sobre el de
    // rol, así que quien tenga un rol permitido igualmente pierde el acceso.
    await text.permissionOverwrites.edit(
      target.id,
      { ViewChannel: false, SendMessages: false },
      { type: OverwriteType.Member },
    );
  } else {
    await text.permissionOverwrites.delete(target.id).catch(() => {});
  }

  await reply(message, confirmText(target, mode));
}

function confirmText(target: Target, mode: 'add' | 'remove'): string {
  const emoji = mode === 'add' ? EMOJI.add : EMOJI.remove;
  const action = mode === 'add' ? 'agregado al' : 'removido del';
  const subject = target.kind === 'role' ? `El rol ${target.mention}` : target.mention;
  return `${emoji} ${subject} ha sido ${action} ticket.`;
}

function reply(message: Message, content: string): Promise<Message> {
  return message.reply({
    ...buildNoticeMessage(content),
    allowedMentions: { parse: [] },
  });
}
