import { Queue } from 'bullmq';
import { redisConnection } from '../redis.js';

export const TICKET_QUEUE_NAME = 'ticket';

export interface ReminderJob {
  type: 'reminder';
  ticketId: number;
  channelId: string;
  guildId: string;
}

export const ticketQueue = new Queue<ReminderJob, void, 'reminder'>(
  TICKET_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
  },
);
