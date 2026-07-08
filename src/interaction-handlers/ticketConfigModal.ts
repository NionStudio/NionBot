import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import { getTicketConfig, updateTicketConfig } from '../lib/ticket-config.js';
import { getOptions } from '../lib/ticket-options.js';
import {
  buildTicketConfigPanel,
  TCFG_MODAL,
  TCFG_UPDATE_FLAGS,
} from '../lib/components/ticket-config.js';

export class TicketConfigModal extends InteractionHandler {
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
    if (!interaction.customId.startsWith(TCFG_MODAL)) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some(interaction.customId.slice(TCFG_MODAL.length));
  }

  public override async run(
    interaction: ModalSubmitInteraction,
    field: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    const value = interaction.fields.getTextInputValue('value');

    let data: Parameters<typeof updateTicketConfig>[1];
    switch (field) {
      case 'msg':
        data = { panelMessage: value };
        break;
      case 'name':
        data = { dropdownPlaceholder: value.trim() || 'Elige un motivo' };
        break;
      case 'openmsg':
        data = { openMessage: value };
        break;
      case 'resptime':
        data = { responseTime: value.trim() || '15 minutos' };
        break;
      default:
        return;
    }

    await updateTicketConfig(interaction.guildId!, data);
    const fresh = await getTicketConfig(interaction.guildId!);
    const options = await getOptions(interaction.guildId!);

    if (interaction.isFromMessage()) {
      await interaction.update({
        ...buildTicketConfigPanel(fresh, options),
        flags: TCFG_UPDATE_FLAGS,
      });
    } else {
      await interaction.reply({
        content: '✅ Guardado.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
