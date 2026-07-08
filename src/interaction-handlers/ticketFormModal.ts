import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import { getTicketConfig } from '../lib/ticket-config.js';
import { getOption } from '../lib/ticket-options.js';
import { openTicket, type FormAnswer } from '../lib/tickets.js';
import { fieldInputId, TICKET_FORM } from '../lib/components/ticket-panel.js';

export class TicketFormModal extends InteractionHandler {
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
    if (!interaction.customId.startsWith(TICKET_FORM)) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some(interaction.customId.slice(TICKET_FORM.length));
  }

  public override async run(
    interaction: ModalSubmitInteraction,
    optionIdRaw: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const option = await getOption(Number(optionIdRaw));
    if (!option) {
      await interaction.editReply('❌ Esa opción ya no existe.');
      return;
    }

    const answers: FormAnswer[] = option.fields.map((f) => ({
      label: f.label,
      value: safeValue(interaction, fieldInputId(f.id)),
    }));

    const config = await getTicketConfig(interaction.guildId!);
    const result = await openTicket(
      interaction.guild!,
      interaction.user,
      config,
      option,
      answers,
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

function safeValue(interaction: ModalSubmitInteraction, customId: string): string {
  try {
    return interaction.fields.getTextInputValue(customId);
  } catch {
    return '';
  }
}
