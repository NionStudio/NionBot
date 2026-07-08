import { Queue } from 'bullmq';
import { redisConnection } from '../redis.js';

export const WELCOME_QUEUE_NAME = 'welcome';

export interface WelcomeJob {
  type: 'welcome';
  guildId: string;
  userId: string;

  inviterId: string | null;
}

export interface GoodbyeJob {
  type: 'goodbye';
  guildId: string;
  userId: string;

  username: string;

  avatarUrl: string;
}

export type MemberJob = WelcomeJob | GoodbyeJob;

export type MemberJobName = MemberJob['type'];

export const welcomeQueue = new Queue<MemberJob, void, MemberJobName>(WELCOME_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
