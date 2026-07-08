import { Listener } from '@sapphire/framework';
import {
  Events,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js';
import { getGuildConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { welcomeQueue } from '../lib/queue/welcome.queue.js';

export class GuildMemberRemoveListener extends Listener<
  typeof Events.GuildMemberRemove
> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, event: Events.GuildMemberRemove });
  }

  public override async run(
    member: GuildMember | PartialGuildMember,
  ): Promise<void> {
    if (member.user.bot) return;

    const config = await getGuildConfig(member.guild.id);
    if (!config.goodbyeEnabled || !config.goodbyeChannelId) return;

    await welcomeQueue.add('goodbye', {
      type: 'goodbye',
      guildId: member.guild.id,
      userId: member.id,
      username: member.user.username,
      avatarUrl: member.user.displayAvatarURL({ size: 256 }),
    });

    logger.debug(
      { guildId: member.guild.id, userId: member.id },
      'Encolado job de despedida',
    );
  }
}
