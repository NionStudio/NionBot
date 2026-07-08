import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../lib/config.js';
import {
  BTN,
  buildColorModal,
  buildDescModal,
  buildFieldsModal,
  buildThumbModal,
  buildWelcomeConfigPanel,
  PANEL_UPDATE_FLAGS,
  sampleFromInteraction,
} from '../lib/components/welcome-config.js';

export class WelcomeConfigButton extends InteractionHandler {
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
    if (!interaction.customId.startsWith(BTN)) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some(interaction.customId.slice(BTN.length));
  }

  public override async run(
    interaction: ButtonInteraction,
    action: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    const config = await getGuildConfig(interaction.guildId!);

    switch (action) {
      case 'desc':
        return interaction.showModal(buildDescModal(config));
      case 'color':
        return interaction.showModal(buildColorModal(config));
      case 'thumb':
        return interaction.showModal(buildThumbModal(config));
      case 'fields':
        return interaction.showModal(buildFieldsModal(config));
      case 'toggle': {
        const updated = await updateGuildConfig(interaction.guildId!, {
          welcomeEnabled: !config.welcomeEnabled,
        });
        await interaction.update({
          ...buildWelcomeConfigPanel(updated, sampleFromInteraction(interaction)),
          flags: PANEL_UPDATE_FLAGS,
        });
        return;
      }
      default:
        return;
    }
  }
}
