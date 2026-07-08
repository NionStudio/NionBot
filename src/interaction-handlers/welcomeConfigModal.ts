import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import { updateGuildConfig } from '../lib/config.js';
import {
  buildWelcomeConfigPanel,
  MODAL,
  parseColor,
  PANEL_UPDATE_FLAGS,
  sampleFromInteraction,
} from '../lib/components/welcome-config.js';

export class WelcomeConfigModal extends InteractionHandler {
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
    if (!interaction.customId.startsWith(MODAL)) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some(interaction.customId.slice(MODAL.length));
  }

  public override async run(
    interaction: ModalSubmitInteraction,
    field: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    let data: Parameters<typeof updateGuildConfig>[1];

    switch (field) {
      case 'desc':
        data = { welcomeMessage: interaction.fields.getTextInputValue('value') };
        break;
      case 'thumb':
        data = { welcomeThumbnail: interaction.fields.getTextInputValue('value').trim() };
        break;
      case 'fields':
        data = {
          welcomeCreationField: interaction.fields.getTextInputValue('creation'),
          welcomeInvitedField: interaction.fields.getTextInputValue('invited'),
        };
        break;
      case 'color': {
        const parsed = parseColor(interaction.fields.getTextInputValue('value'));
        if (parsed === undefined) {
          await interaction.reply({
            content: '❌ Color inválido. Usa formato hex como `#5865F2` (o déjalo vacío).',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        data = { welcomeAccentColor: parsed };
        break;
      }
      default:
        return;
    }

    const updated = await updateGuildConfig(interaction.guildId!, data);

    if (interaction.isFromMessage()) {
      await interaction.update({
        ...buildWelcomeConfigPanel(updated, sampleFromInteraction(interaction)),
        flags: PANEL_UPDATE_FLAGS,
      });
    } else {
      await interaction.reply({
        content: '✅ Guardado.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
