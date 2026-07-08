import { fileURLToPath } from 'node:url';
import { LogLevel, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { welcomeQueue } from './lib/queue/welcome.queue.js';
import { ticketQueue } from './lib/queue/ticket.queue.js';

const client = new SapphireClient({

  baseUserDirectory: fileURLToPath(new URL('.', import.meta.url)),
  intents: [
    GatewayIntentBits.Guilds,

    GatewayIntentBits.GuildMembers,

    GatewayIntentBits.GuildInvites,

    GatewayIntentBits.GuildMessages,
  ],

  partials: [Partials.GuildMember, Partials.User],
  logger: {
    level: env.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Info,
  },
});

async function main(): Promise<void> {
  logger.info('Arrancando Nion Studio…');
  await client.login(env.DISCORD_TOKEN);
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Apagando Nion Studio…');
  try {
    await client.destroy();
    await welcomeQueue.close();
    await ticketQueue.close();
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err }, 'Error durante el apagado');
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((err) => {
  logger.fatal({ err }, 'Fallo fatal al arrancar');
  process.exit(1);
});
