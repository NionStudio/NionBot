import { Command } from '@sapphire/framework';
import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { runAccessCommand } from '../../lib/ticket-access.js';

export class AddCommand extends Command {
  public constructor(
    context: Command.LoaderContext,
    options: Command.Options,
  ) {
    super(context, {
      ...options,
      name: 'add',
      description: 'Da acceso a un usuario o rol al ticket (leer y escribir).',
    });
  }

  public override async messageRun(message: Message, args: Args): Promise<void> {
    await runAccessCommand(message, args, 'add');
  }
}
