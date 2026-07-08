import type { GuildConfig } from '@prisma/client';
import { renderTemplate } from './config.js';
import { buildWelcomeCard } from './components/welcome-card.js';

export interface WelcomeSample {
  memberId: string;
  username: string;
  avatarUrl: string;

  createdTimestampSec: number;
  guildName: string;
  memberCount: number;
  inviterId: string | null;
}

export function renderWelcomeCard(config: GuildConfig, sample: WelcomeSample) {
  const vars = {
    user: `<@${sample.memberId}>`,
    username: sample.username,
    server: sample.guildName,
    count: sample.memberCount,
    creationDate: `<t:${sample.createdTimestampSec}:R>`,
    invitedBy: sample.inviterId ? `<@${sample.inviterId}>` : 'desconocido',
  };

  const thumbnailUrl =
    config.welcomeThumbnail === '{user}'
      ? sample.avatarUrl
      : config.welcomeThumbnail.trim() || null;

  return buildWelcomeCard({
    greeting: renderTemplate(config.welcomeMessage, vars),
    thumbnailUrl,
    accentColor: config.welcomeAccentColor,
    creationLine: renderTemplate(config.welcomeCreationField, vars),
    invitedLine: renderTemplate(config.welcomeInvitedField, vars),
  });
}
