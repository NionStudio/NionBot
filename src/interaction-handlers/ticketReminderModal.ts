import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ChannelType,
  MessageFlags,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import { parseDuration } from '../lib/duration.js';
import { getTicketConfig } from '../lib/ticket-config.js';
import {
  getTicketByChannel,
  isStaff,
  setReminder,
} from '../lib/tickets.js';
import { TICKET_MODAL } from '../lib/components/ticket-panel.js';

export class TicketReminderModal extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options,
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    });
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== `${TICKET_MODAL}remind`) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some();
  }

  public override async run(interaction: ModalSubmitInteraction): Promise<void> {
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const ticket = await getTicketByChannel(channel.id);
    if (!ticket || ticket.status !== 'OPEN') {
      await interaction.reply({
        content: '❌ Este canal no es un ticket abierto.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getTicketConfig(interaction.guildId!);
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    if (!isStaff(member, ticket.staffRoleId ?? config.staffRoleId)) {
      await interaction.reply({
        content: '❌ Solo el staff puede usar esto.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ms = parseDuration(interaction.fields.getTextInputValue('time'));
    if (ms === null) {
      await interaction.reply({
        content: '❌ Tiempo inválido. Usa formatos como `30m`, `2h`, `1d` o `1h30m`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    await setReminder(channel as TextChannel, ticket, ms);
  }
}
