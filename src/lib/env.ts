import { z } from 'zod';

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN es obligatorio'),
  DISCORD_APP_ID: z.string().min(1, 'DISCORD_APP_ID es obligatorio'),

  DISCORD_CLIENT_SECRET: z.string().optional(),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  TRANSCRIPT_APP_URL: z.string().url().optional(),
  TRANSCRIPT_SECRET: z.string().min(1).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');

  console.error(`❌ Variables de entorno inválidas:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
