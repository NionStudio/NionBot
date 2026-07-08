import { Listener } from '@sapphire/framework';
import { Events, type Client } from 'discord.js';
import { cacheAllGuilds } from '../lib/invites.js';
import { logger } from '../lib/logger.js';
import { startWelcomeWorker } from '../lib/queue/welcome.worker.js';
import { startTicketWorker } from '../lib/queue/ticket.worker.js';
import { loadActiveReminders } from '../lib/tickets.js';

export class ReadyListener extends Listener<typeof Events.ClientReady> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, once: true, event: Events.ClientReady });
  }

  public override async run(client: Client<true>): Promise<void> {
    logger.info(
      { user: client.user.tag, guilds: client.guilds.cache.size },
      'Nion Studio conectado',
    );

    startWelcomeWorker(client);
    startTicketWorker(client);

    await loadActiveReminders();

    await cacheAllGuilds(client.guilds.cache.values());
  }
}
