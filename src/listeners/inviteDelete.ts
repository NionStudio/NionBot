import { Listener } from '@sapphire/framework';
import { Events, type Invite } from 'discord.js';
import { trackInviteDelete } from '../lib/invites.js';

export class InviteDeleteListener extends Listener<typeof Events.InviteDelete> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, event: Events.InviteDelete });
  }

  public override run(invite: Invite): void {
    trackInviteDelete(invite);
  }
}
