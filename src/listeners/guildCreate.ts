import { Listener } from '@sapphire/framework';
import { Events, type Guild } from 'discord.js';
import { cacheGuildInvites } from '../lib/invites.js';

export class GuildCreateListener extends Listener<typeof Events.GuildCreate> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, event: Events.GuildCreate });
  }

  public override async run(guild: Guild): Promise<void> {

    await cacheGuildInvites(guild);
  }
}
