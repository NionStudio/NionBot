import { Listener } from '@sapphire/framework';
import { Events, type GuildMember } from 'discord.js';
import { getGuildConfig } from '../lib/config.js';
import { resolveInviter } from '../lib/invites.js';
import { logger } from '../lib/logger.js';
import { welcomeQueue } from '../lib/queue/welcome.queue.js';

export class GuildMemberAddListener extends Listener<
  typeof Events.GuildMemberAdd
> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, event: Events.GuildMemberAdd });
  }

  public override async run(member: GuildMember): Promise<void> {
    if (member.user.bot) return;

    const config = await getGuildConfig(member.guild.id);

    if (!config.welcomeEnabled && !config.dmEnabled && config.autoRoleIds.length === 0) {
      return;
    }

    const inviterId = await resolveInviter(member);

    await welcomeQueue.add('welcome', {
      type: 'welcome',
      guildId: member.guild.id,
      userId: member.id,
      inviterId,
    });

    logger.debug(
      { guildId: member.guild.id, userId: member.id },
      'Encolado job de bienvenida',
    );
  }
}
