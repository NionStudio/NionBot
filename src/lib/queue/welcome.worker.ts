import type { Client } from 'discord.js';
import { Worker } from 'bullmq';
import { getGuildConfig, renderTemplate } from '../config.js';
import { logger } from '../logger.js';
import { redisConnection } from '../redis.js';
import { ACCENT, buildSimpleCard } from '../components/welcome-card.js';
import { renderWelcomeCard } from '../welcome.js';
import {
  WELCOME_QUEUE_NAME,
  type GoodbyeJob,
  type MemberJob,
  type MemberJobName,
  type WelcomeJob,
} from './welcome.queue.js';

export function startWelcomeWorker(
  client: Client,
): Worker<MemberJob, void, MemberJobName> {
  const worker = new Worker<MemberJob, void, MemberJobName>(
    WELCOME_QUEUE_NAME,
    async (job) => {
      switch (job.data.type) {
        case 'welcome':
          return handleWelcome(client, job.data);
        case 'goodbye':
          return handleGoodbye(client, job.data);
      }
    },
    { connection: redisConnection },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, type: job?.data.type, err },
      'Job fallido tras agotar reintentos',
    );
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, type: job.data.type }, 'Job completado');
  });

  logger.info('Worker de bienvenidas iniciado');
  return worker;
}

async function handleWelcome(client: Client, data: WelcomeJob): Promise<void> {
  const config = await getGuildConfig(data.guildId);
  if (!config.welcomeEnabled) return;

  const guild = await client.guilds.fetch(data.guildId);
  const member = await guild.members.fetch(data.userId);

  const avatarUrl = member.displayAvatarURL({ size: 256 });

  if (config.welcomeChannelId) {
    const channel = await guild.channels.fetch(config.welcomeChannelId);
    if (channel?.isTextBased() && channel.isSendable()) {
      await channel.send(
        renderWelcomeCard(config, {
          memberId: member.id,
          username: member.user.username,
          avatarUrl,
          createdTimestampSec: Math.floor(member.user.createdTimestamp / 1000),
          guildName: guild.name,
          memberCount: guild.memberCount,
          inviterId: data.inviterId,
        }),
      );
    } else {
      logger.warn(
        { guildId: guild.id, channelId: config.welcomeChannelId },
        'Canal de bienvenida no válido o sin permisos de envío',
      );
    }
  }

  if (config.autoRoleIds.length > 0) {
    try {
      await member.roles.add(config.autoRoleIds, 'Auto-rol de bienvenida');
    } catch (err) {
      logger.warn(
        { guildId: guild.id, userId: member.id, err },
        'No se pudieron asignar los auto-roles (¿jerarquía/permisos?)',
      );
    }
  }

  if (config.dmEnabled) {
    try {
      await member.send(
        buildSimpleCard({
          title: `¡Hola, ${member.user.username}!`,
          body: renderTemplate(config.dmMessage, {
            user: `<@${member.id}>`,
            username: member.user.username,
            server: guild.name,
            count: guild.memberCount,
          }),
          avatarUrl,
          accentColor: ACCENT.welcome,
        }),
      );
    } catch {
      logger.info(
        { guildId: guild.id, userId: member.id },
        'No se pudo enviar el DM (probablemente DMs cerrados)',
      );
    }
  }
}

async function handleGoodbye(client: Client, data: GoodbyeJob): Promise<void> {
  const config = await getGuildConfig(data.guildId);
  if (!config.goodbyeEnabled || !config.goodbyeChannelId) return;

  const guild = await client.guilds.fetch(data.guildId);
  const channel = await guild.channels.fetch(config.goodbyeChannelId);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  const vars = {
    user: `<@${data.userId}>`,
    username: data.username,
    server: guild.name,
    count: guild.memberCount,
  };

  await channel.send(
    buildSimpleCard({
      title: `Hasta pronto, ${data.username}`,
      body: renderTemplate(config.goodbyeMessage, vars),
      avatarUrl: data.avatarUrl,
      accentColor: ACCENT.goodbye,
    }),
  );
}
