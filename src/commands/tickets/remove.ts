import { Command } from '@sapphire/framework';
import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { runAccessCommand } from '../../lib/ticket-access.js';

export class RemoveCommand extends Command {
  public constructor(
    context: Command.LoaderContext,
    options: Command.Options,
  ) {
    super(context, {
      ...options,
      name: 'remove',
      description: 'Quita el acceso de un usuario o rol al ticket.',
    });
  }

  public override async messageRun(message: Message, args: Args): Promise<void> {
    await runAccessCommand(message, args, 'remove');
  }
}
