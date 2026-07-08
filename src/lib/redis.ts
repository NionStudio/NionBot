import type { RedisOptions } from 'ioredis';
import { env } from './env.js';

export const redisConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
} satisfies RedisOptions;
