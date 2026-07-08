import { Listener } from '@sapphire/framework';
import { Events, type Invite } from 'discord.js';
import { trackInviteCreate } from '../lib/invites.js';

export class InviteCreateListener extends Listener<typeof Events.InviteCreate> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, event: Events.InviteCreate });
  }

  public override run(invite: Invite): void {
    trackInviteCreate(invite);
  }
}
