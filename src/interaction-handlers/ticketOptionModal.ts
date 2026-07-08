import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import {
  addField,
  getOption,
  MAX_FIELDS,
  parseRequired,
  parseStyle,
  sanitizeEmoji,
  updateField,
  updateOption,
} from '../lib/ticket-options.js';
import {
  buildOptionEditor,
  TOPT_MODAL,
  TCFG_UPDATE_FLAGS,
} from '../lib/components/ticket-config.js';

export class TicketOptionModal extends InteractionHandler {
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
    if (!interaction.customId.startsWith(TOPT_MODAL)) return this.none();
    if (!interaction.inGuild()) return this.none();
    const [kind, id, fieldRef] = interaction.customId
      .slice(TOPT_MODAL.length)
      .split(':');
    return this.some({ kind, optionId: Number(id), fieldRef });
  }

  public override async run(
    interaction: ModalSubmitInteraction,
    { kind, optionId, fieldRef }: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    if (kind === 'text') {
      await this.saveText(interaction, optionId);
    } else if (kind === 'field') {
      await this.saveField(interaction, optionId, fieldRef);
    } else {
      return;
    }

    const option = await getOption(optionId);
    if (!option) {
      await this.replyGone(interaction);
      return;
    }
    if (interaction.isFromMessage()) {
      await interaction.update({
        ...buildOptionEditor(option),
        flags: TCFG_UPDATE_FLAGS,
      });
    } else {
      await interaction.reply({
        content: '✅ Guardado.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async saveText(
    interaction: ModalSubmitInteraction,
    optionId: number,
  ): Promise<void> {
    const label = interaction.fields.getTextInputValue('label').trim();
    const emoji = interaction.fields.getTextInputValue('emoji');
    const description = interaction.fields.getTextInputValue('description').trim();
    const openmsg = interaction.fields.getTextInputValue('openmsg').trim();
    const resptime = interaction.fields.getTextInputValue('resptime').trim();

    await updateOption(optionId, {
      label: label || 'Opción',
      emoji: sanitizeEmoji(emoji),
      description: description || null,
      openMessage: openmsg || null,
      responseTime: resptime || null,
    });
  }

  private async saveField(
    interaction: ModalSubmitInteraction,
    optionId: number,
    fieldRef: string | undefined,
  ): Promise<void> {
    const label = interaction.fields.getTextInputValue('label').trim() || 'Pregunta';
    const style = parseStyle(interaction.fields.getTextInputValue('type'));
    const required = parseRequired(interaction.fields.getTextInputValue('required'));

    if (fieldRef === 'new') {
      const option = await getOption(optionId);
      if (option && option.fields.length >= MAX_FIELDS) return;
      const field = await addField(optionId);
      await updateField(field.id, { label, style, required });
    } else if (fieldRef) {
      await updateField(Number(fieldRef), { label, style, required });
    }
  }

  private async replyGone(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.reply({
      content: '❌ Esa opción ya no existe.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
