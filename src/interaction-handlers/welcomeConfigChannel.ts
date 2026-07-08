import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import type { ChannelSelectMenuInteraction } from 'discord.js';
import { updateGuildConfig } from '../lib/config.js';
import {
  BTN,
  buildWelcomeConfigPanel,
  PANEL_UPDATE_FLAGS,
  sampleFromInteraction,
} from '../lib/components/welcome-config.js';

export class WelcomeConfigChannel extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options,
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.SelectMenu,
    });
  }

  public override parse(interaction: ChannelSelectMenuInteraction) {
    if (interaction.customId !== `${BTN}channel`) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some();
  }

  public override async run(
    interaction: ChannelSelectMenuInteraction,
  ): Promise<void> {
    const channelId = interaction.values[0];
    const updated = await updateGuildConfig(interaction.guildId!, {
      welcomeChannelId: channelId ?? null,
    });
    await interaction.update({
      ...buildWelcomeConfigPanel(updated, sampleFromInteraction(interaction)),
      flags: PANEL_UPDATE_FLAGS,
    });
  }
}
