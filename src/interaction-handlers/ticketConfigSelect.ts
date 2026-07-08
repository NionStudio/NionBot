import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type AnySelectMenuInteraction } from 'discord.js';
import { getTicketConfig, updateTicketConfig } from '../lib/ticket-config.js';
import { getOption, getOptions } from '../lib/ticket-options.js';
import {
  buildOptionEditor,
  buildTicketConfigPanel,
  TCFG,
  TCFG_UPDATE_FLAGS,
} from '../lib/components/ticket-config.js';

export class TicketConfigSelect extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options,
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.SelectMenu,
    });
  }

  public override parse(interaction: AnySelectMenuInteraction) {
    if (!interaction.customId.startsWith(TCFG)) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some(interaction.customId.slice(TCFG.length));
  }

  public override async run(
    interaction: AnySelectMenuInteraction,
    field: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    const value = interaction.values[0];

    if (field === 'editopt') {
      const option = value ? await getOption(Number(value)) : null;
      if (!option) {
        await interaction.reply({
          content: '❌ Esa opción ya no existe.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.update({
        ...buildOptionEditor(option),
        flags: TCFG_UPDATE_FLAGS,
      });
      return;
    }

    let data: Parameters<typeof updateTicketConfig>[1] | null = null;
    switch (field) {
      case 'staff':
        data = { staffRoleId: value ?? null };
        break;
      case 'category':
        data = { categoryId: value ?? null };
        break;
      case 'transcript':
        data = { transcriptChannelId: value ?? null };
        break;
      case 'panelch':
        data = { panelChannelId: value ?? null, panelMessageId: null };
        break;
      default:
        return;
    }
    if (!data) return;

    await updateTicketConfig(interaction.guildId!, data);
    const fresh = await getTicketConfig(interaction.guildId!);
    const options = await getOptions(interaction.guildId!);
    await interaction.update({
      ...buildTicketConfigPanel(fresh, options),
      flags: TCFG_UPDATE_FLAGS,
    });
  }
}
