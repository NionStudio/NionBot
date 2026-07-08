import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type StringSelectMenuInteraction } from 'discord.js';
import { getTicketConfig } from '../lib/ticket-config.js';
import { getOption } from '../lib/ticket-options.js';
import { findLiveOpenTicket, openTicket } from '../lib/tickets.js';
import { buildFormModal, TICKET } from '../lib/components/ticket-panel.js';

export class TicketOpenSelect extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options,
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.SelectMenu,
    });
  }

  public override parse(interaction: StringSelectMenuInteraction) {
    if (interaction.customId !== `${TICKET}open`) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some();
  }

  public override async run(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    const value = interaction.values[0];
    const option = value ? await getOption(Number(value)) : null;
    if (!option) {
      await interaction.reply({
        content: '❌ Esa opción ya no está disponible.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existing = await findLiveOpenTicket(interaction.guild!, interaction.user.id);
    if (existing) {
      await interaction.reply({
        content: `⚠️ Ya tienes un ticket abierto: <#${existing.channelId}>`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (option.fields.length > 0) {
      await interaction.showModal(buildFormModal(option));
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const config = await getTicketConfig(interaction.guildId!);
    const result = await openTicket(
      interaction.guild!,
      interaction.user,
      config,
      option,
    );
    await interaction.editReply(
      result.ok
        ? `✅ Ticket creado: <#${result.channel.id}>`
        : result.existingChannelId
          ? `⚠️ Ya tienes un ticket abierto: <#${result.existingChannelId}>`
          : '❌ No se pudo crear el ticket. ¿Tengo permiso para gestionar canales?',
    );
  }
}
