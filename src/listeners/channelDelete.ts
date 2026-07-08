import { Listener } from '@sapphire/framework';
import { Events, type DMChannel, type NonThreadGuildBasedChannel } from 'discord.js';
import { forgetTicket, getTicketByChannel } from '../lib/tickets.js';

export class ChannelDeleteListener extends Listener<typeof Events.ChannelDelete> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, event: Events.ChannelDelete });
  }

  public override async run(
    channel: DMChannel | NonThreadGuildBasedChannel,
  ): Promise<void> {
    const ticket = await getTicketByChannel(channel.id);
    if (ticket) await forgetTicket(ticket);
  }
}
