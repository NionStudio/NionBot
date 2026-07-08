import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { getTicketConfig } from '../lib/ticket-config.js';
import {
  deleteOption,
  getOption,
  getOptions,
  MAX_FIELDS,
} from '../lib/ticket-options.js';
import {
  buildFieldModal,
  buildOptionEditor,
  buildOptionTextModal,
  buildTicketConfigPanel,
  TOPT,
  TCFG_UPDATE_FLAGS,
} from '../lib/components/ticket-config.js';

export class TicketOptionButton extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options,
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(TOPT)) return this.none();
    if (!interaction.inGuild()) return this.none();
    const [action, id] = interaction.customId.slice(TOPT.length).split(':');
    return this.some({ action, optionId: id ? Number(id) : null });
  }

  public override async run(
    interaction: ButtonInteraction,
    { action, optionId }: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    if (action === 'back') return this.renderMain(interaction);

    if (optionId === null) return;

    switch (action) {
      case 'edit': {
        const option = await getOption(optionId);
        if (!option) return this.renderMain(interaction);
        return interaction.showModal(buildOptionTextModal(option));
      }
      case 'addfield': {
        const option = await getOption(optionId);
        if (!option) return this.renderMain(interaction);
        if (option.fields.length >= MAX_FIELDS) {
          await interaction.reply({
            content: `❌ Límite alcanzado: máximo ${MAX_FIELDS} campos por opción.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        return interaction.showModal(buildFieldModal(optionId, null));
      }
      case 'delopt': {
        await deleteOption(optionId);
        return this.renderMain(interaction);
      }
      default:
        return;
    }
  }

  private async renderMain(interaction: ButtonInteraction): Promise<void> {
    const config = await getTicketConfig(interaction.guildId!);
    const options = await getOptions(interaction.guildId!);
    await interaction.update({
      ...buildTicketConfigPanel(config, options),
      flags: TCFG_UPDATE_FLAGS,
    });
  }
}
