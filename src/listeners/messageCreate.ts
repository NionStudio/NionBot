import { Listener } from '@sapphire/framework';
import { Events, type Message } from 'discord.js';
import { activeReminders, cancelReminderByChannel } from '../lib/tickets.js';

export class TicketMessageListener extends Listener<typeof Events.MessageCreate> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public override async run(message: Message): Promise<void> {
    if (message.author.bot || !message.inGuild()) return;

    const reminder = activeReminders.get(message.channelId);
    if (!reminder || reminder.openerId !== message.author.id) return;

    await cancelReminderByChannel(message.channelId);
    await message.channel
      .send('✅ Respuesta recibida; el auto-cierre se ha cancelado.')
      .catch(() => {});
  }
}
