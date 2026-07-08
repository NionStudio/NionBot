import { ChannelType, type Client, type TextChannel } from 'discord.js';
import { Worker } from 'bullmq';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { redisConnection } from '../redis.js';
import { closeTicket } from '../tickets.js';
import { TICKET_QUEUE_NAME, type ReminderJob } from './ticket.queue.js';

export function startTicketWorker(
  client: Client,
): Worker<ReminderJob, void, 'reminder'> {
  const worker = new Worker<ReminderJob, void, 'reminder'>(
    TICKET_QUEUE_NAME,
    async (job) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: job.data.ticketId },
      });

      if (!ticket || ticket.status !== 'OPEN' || !ticket.reminderDeadline) return;

      const guild = await client.guilds.fetch(job.data.guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels
        .fetch(job.data.channelId)
        .catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) return;

      await closeTicket(
        channel as TextChannel,
        ticket,
        client.user!.id,
        'Cerrado por inactividad',
      );
      logger.info(
        { ticketId: ticket.id, channelId: ticket.channelId },
        'Ticket cerrado por inactividad',
      );
    },
    { connection: redisConnection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job de ticket fallido');
  });

  logger.info('Worker de tickets iniciado');
  return worker;
}
