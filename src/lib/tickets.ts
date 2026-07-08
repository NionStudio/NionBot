import type { Ticket, TicketConfig } from '@prisma/client';
import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type TextChannel,
  type User,
} from 'discord.js';
import { prisma } from './prisma.js';
import { invalidateTicketConfig, updateTicketConfig } from './ticket-config.js';
import { humanizeDuration } from './duration.js';
import type { OptionWithFields } from './ticket-options.js';
import { getOptions } from './ticket-options.js';
import {
  buildClaimMessage,
  buildClosedMessage,
  buildReminderMessage,
  buildReopenMessage,
  buildTicketOpenMessages,
  buildTicketPanel,
  buildTranscriptLog,
} from './components/ticket-panel.js';
import { buildTranscript } from './transcript.js';
import { EMOJI } from './emojis.js';
import { isTranscriptLinkConfigured } from './transcript-link.js';
import { ticketQueue } from './queue/ticket.queue.js';

export interface FormAnswer {
  label: string;
  value: string;
}

export const activeReminders = new Map<
  string,
  { ticketId: number; openerId: string; jobId: string }
>();

export function isStaff(
  member: GuildMember,
  staffRoleId: string | null,
): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return staffRoleId ? member.roles.cache.has(staffRoleId) : false;
}

export function findOpenTicket(
  guildId: string,
  openerId: string,
): Promise<Ticket | null> {
  return prisma.ticket.findFirst({
    where: { guildId, openerId, status: 'OPEN' },
  });
}

export async function findLiveOpenTicket(
  guild: Guild,
  openerId: string,
): Promise<Ticket | null> {
  const ticket = await findOpenTicket(guild.id, openerId);
  if (!ticket) return null;

  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (channel) return ticket;

  await forgetTicket(ticket);
  return null;
}

export async function forgetTicket(ticket: Ticket): Promise<void> {
  await cancelReminder(ticket);
  await prisma.ticket.delete({ where: { id: ticket.id } }).catch(() => {});
}

export function getTicketByChannel(channelId: string): Promise<Ticket | null> {
  return prisma.ticket.findUnique({ where: { channelId } });
}

export type OpenResult =
  | { ok: true; channel: TextChannel }
  | { ok: false; existingChannelId?: string; error?: string };

export async function openTicket(
  guild: Guild,
  opener: User,
  config: TicketConfig,
  option: OptionWithFields,
  answers: FormAnswer[] = [],
): Promise<OpenResult> {
  const existing = await findLiveOpenTicket(guild, opener.id);
  if (existing) return { ok: false, existingChannelId: existing.channelId };

  const categoryId = option.categoryId ?? config.categoryId;
  const staffRoleId = option.staffRoleId ?? config.staffRoleId;
  const openMessage = option.openMessage ?? config.openMessage;
  const responseTime = option.responseTime ?? config.responseTime;

  const bumped = await prisma.ticketConfig.update({
    where: { guildId: guild.id },
    data: { counter: { increment: 1 } },
  });
  invalidateTicketConfig(guild.id);
  const number = bumped.counter;

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: opener.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];
  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  let channel: TextChannel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${String(number).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: categoryId ?? undefined,
      topic: `Ticket #${number} · ${option.label} · ${opener.tag} (${opener.id})`,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  await prisma.ticket.create({
    data: {
      guildId: guild.id,
      channelId: channel.id,
      openerId: opener.id,
      number,
      staffRoleId,
    },
  });

  const greeting = openMessage
    .replaceAll('{user}', `<@${opener.id}>`)
    .replaceAll('{server}', guild.name);

  const messages = buildTicketOpenMessages({
    greeting,
    responseTime,
    openerId: opener.id,
    answers,
  });
  for (const message of messages) {
    await channel.send(message);
  }

  return { ok: true, channel };
}

export type PublishResult =
  | { ok: true; channelId: string }
  | { ok: false; error: string };

export async function publishTicketPanel(
  guild: Guild,
  config: TicketConfig,
): Promise<PublishResult> {
  if (!config.panelChannelId) {
    return { ok: false, error: 'No hay canal del panel configurado.' };
  }
  const channel = await guild.channels
    .fetch(config.panelChannelId)
    .catch(() => null);
  if (!channel?.isTextBased() || !channel.isSendable()) {
    return { ok: false, error: 'El canal del panel no es válido o no puedo escribir en él.' };
  }

  const options = await getOptions(guild.id);
  const payload = buildTicketPanel(config, options);

  if (config.panelMessageId) {
    const existing = await channel.messages
      .fetch(config.panelMessageId)
      .catch(() => null);
    if (existing) {
      await existing.edit(payload);
      return { ok: true, channelId: channel.id };
    }
  }

  const sent = await channel.send(payload);
  await updateTicketConfig(guild.id, { panelMessageId: sent.id });
  return { ok: true, channelId: channel.id };
}

export async function closeTicket(
  channel: TextChannel,
  ticket: Ticket,
  byUserId: string,
  reason?: string,
): Promise<void> {
  await cancelReminder(ticket);
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });

  await channel.permissionOverwrites
    .edit(ticket.openerId, { ViewChannel: false, SendMessages: false })
    .catch(() => {});

  await channel.send(buildClosedMessage(byUserId, reason));
}

export async function saveTranscript(
  channel: TextChannel,
  ticket: Ticket,
  transcriptChannelId: string | null,
): Promise<string | null> {
  if (!transcriptChannelId) return null;
  const dest = await channel.guild.channels
    .fetch(transcriptChannelId)
    .catch(() => null);
  if (!dest?.isTextBased() || !dest.isSendable()) return null;

  const file = await buildTranscript(channel);
  const fileName = file.name ?? 'transcript.html';
  const text = `${EMOJI.transcript} Transcripción de **#${channel.name}** (ticket #${ticket.number}) · abridor <@${ticket.openerId}>`;

  await dest.send({
    ...buildTranscriptLog(text, fileName, {
      getLinkButton: isTranscriptLinkConfigured(),
    }),
    files: [file],
  });
  return dest.id;
}

export async function claimTicket(
  channel: TextChannel,
  ticket: Ticket,
  staff: GuildMember,
  staffRoleId: string | null,
): Promise<void> {
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { claimedById: staff.id },
  });

  if (staffRoleId) {
    await channel.permissionOverwrites
      .edit(staffRoleId, { SendMessages: false })
      .catch(() => {});
  }
  await channel.permissionOverwrites
    .edit(staff.id, { SendMessages: true, ViewChannel: true })
    .catch(() => {});

  await channel.send(buildClaimMessage(staff.id));
}

export async function reopenTicket(
  channel: TextChannel,
  ticket: Ticket,
  staffRoleId: string | null,
): Promise<void> {
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'OPEN', closedAt: null, claimedById: null },
  });

  await channel.permissionOverwrites
    .edit(ticket.openerId, { ViewChannel: true, SendMessages: true })
    .catch(() => {});
  if (staffRoleId) {
    await channel.permissionOverwrites
      .edit(staffRoleId, { SendMessages: null })
      .catch(() => {});
  }

  await channel.send(buildReopenMessage());
}

export async function deleteTicket(
  channel: TextChannel,
  ticket: Ticket,
): Promise<void> {
  await cancelReminder(ticket);
  await prisma.ticket.delete({ where: { id: ticket.id } }).catch(() => {});
  await channel.delete('Ticket borrado').catch(() => {});
}

export async function setReminder(
  channel: TextChannel,
  ticket: Ticket,
  ms: number,
): Promise<void> {
  await cancelReminder(ticket);

  const jobId = `reminder:${ticket.id}:${Date.now()}`;
  await ticketQueue.add(
    'reminder',
    {
      type: 'reminder',
      ticketId: ticket.id,
      channelId: channel.id,
      guildId: ticket.guildId,
    },
    { delay: ms, jobId },
  );
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { reminderJobId: jobId, reminderDeadline: new Date(Date.now() + ms) },
  });
  activeReminders.set(channel.id, {
    ticketId: ticket.id,
    openerId: ticket.openerId,
    jobId,
  });

  await channel.send(
    buildReminderMessage(ticket.openerId, humanizeDuration(ms)),
  );
}

export async function cancelReminder(ticket: Ticket): Promise<void> {
  activeReminders.delete(ticket.channelId);
  if (ticket.reminderJobId) {
    await ticketQueue.remove(ticket.reminderJobId).catch(() => {});
  }
  await prisma.ticket
    .update({
      where: { id: ticket.id },
      data: { reminderJobId: null, reminderDeadline: null },
    })
    .catch(() => {});
}

export async function cancelReminderByChannel(channelId: string): Promise<void> {
  const entry = activeReminders.get(channelId);
  if (!entry) return;
  activeReminders.delete(channelId);
  await ticketQueue.remove(entry.jobId).catch(() => {});
  await prisma.ticket
    .update({
      where: { id: entry.ticketId },
      data: { reminderJobId: null, reminderDeadline: null },
    })
    .catch(() => {});
}

export async function loadActiveReminders(): Promise<void> {
  const tickets = await prisma.ticket.findMany({
    where: { status: 'OPEN', reminderJobId: { not: null } },
  });
  for (const t of tickets) {
    if (t.reminderJobId) {
      activeReminders.set(t.channelId, {
        ticketId: t.id,
        openerId: t.openerId,
        jobId: t.reminderJobId,
      });
    }
  }
}
