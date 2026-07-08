import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type AnySelectMenuInteraction } from 'discord.js';
import {
  deleteField,
  getOption,
  updateOption,
} from '../lib/ticket-options.js';
import {
  buildFieldModal,
  buildOptionEditor,
  TOPT,
  TCFG_UPDATE_FLAGS,
} from '../lib/components/ticket-config.js';

export class TicketOptionSelect extends InteractionHandler {
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
    if (!interaction.customId.startsWith(TOPT)) return this.none();
    if (!interaction.inGuild()) return this.none();
    const [action, id] = interaction.customId.slice(TOPT.length).split(':');
    if (!id) return this.none();
    return this.some({ action, optionId: Number(id) });
  }

  public override async run(
    interaction: AnySelectMenuInteraction,
    { action, optionId }: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    const value = interaction.values[0];

    switch (action) {
      case 'cat':
        await updateOption(optionId, { categoryId: value ?? null });
        return this.renderEditor(interaction, optionId);
      case 'staff':
        await updateOption(optionId, { staffRoleId: value ?? null });
        return this.renderEditor(interaction, optionId);
      case 'delfield':
        if (value) await deleteField(Number(value));
        return this.renderEditor(interaction, optionId);
      case 'editfield': {
        const option = await getOption(optionId);
        const fieldItem = option?.fields.find((f) => f.id === Number(value));
        if (!fieldItem) return this.renderEditor(interaction, optionId);
        return interaction.showModal(buildFieldModal(optionId, fieldItem));
      }
      default:
        return;
    }
  }

  private async renderEditor(
    interaction: AnySelectMenuInteraction,
    optionId: number,
  ): Promise<void> {
    const option = await getOption(optionId);
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
  }
}
