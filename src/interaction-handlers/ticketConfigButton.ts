import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { ChannelType, MessageFlags, type ButtonInteraction } from 'discord.js';
import { getTicketConfig, updateTicketConfig } from '../lib/ticket-config.js';
import { createOption, getOptions, MAX_OPTIONS } from '../lib/ticket-options.js';
import { publishTicketPanel } from '../lib/tickets.js';
import {
  buildDefaultOpenModal,
  buildNameModal,
  buildOptionEditor,
  buildPanelMsgModal,
  buildResponseTimeModal,
  buildTicketConfigPanel,
  TCFG,
  TCFG_UPDATE_FLAGS,
} from '../lib/components/ticket-config.js';

export class TicketConfigButton extends InteractionHandler {
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
    if (!interaction.customId.startsWith(TCFG)) return this.none();
    if (!interaction.inGuild()) return this.none();
    return this.some(interaction.customId.slice(TCFG.length));
  }

  public override async run(
    interaction: ButtonInteraction,
    action: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    const config = await getTicketConfig(interaction.guildId!);

    switch (action) {
      case 'msg':
        return interaction.showModal(buildPanelMsgModal(config));
      case 'name':
        return interaction.showModal(buildNameModal(config));
      case 'openmsg':
        return interaction.showModal(buildDefaultOpenModal(config));
      case 'resptime':
        return interaction.showModal(buildResponseTimeModal(config));
      case 'addopt':
        return this.handleAddOption(interaction);
      case 'publish':
        return this.handlePublish(interaction);
      case 'newchannel':
        return this.handleNewChannel(interaction);
      default:
        return;
    }
  }

  private async handleAddOption(interaction: ButtonInteraction): Promise<void> {
    const options = await getOptions(interaction.guildId!);
    if (options.length >= MAX_OPTIONS) {
      await interaction.reply({
        content: `❌ Límite alcanzado: máximo ${MAX_OPTIONS} opciones.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const option = await createOption(interaction.guildId!);
    await interaction.update({
      ...buildOptionEditor(option),
      flags: TCFG_UPDATE_FLAGS,
    });
  }

  private async handlePublish(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const guild = interaction.guild!;
    const config = await getTicketConfig(guild.id);
    const result = await publishTicketPanel(guild, config);

    const fresh = await getTicketConfig(guild.id);
    const options = await getOptions(guild.id);
    await interaction.editReply({
      ...buildTicketConfigPanel(fresh, options),
      flags: TCFG_UPDATE_FLAGS,
    });
    await interaction.followUp({
      content: result.ok
        ? `✅ Panel publicado en <#${result.channelId}>.`
        : `❌ ${result.error}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleNewChannel(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const guild = interaction.guild!;
    const config = await getTicketConfig(guild.id);

    const channel = await guild.channels
      .create({
        name: 'abrir-ticket',
        type: ChannelType.GuildText,
        parent: config.categoryId ?? undefined,
      })
      .catch(() => null);

    if (!channel) {
      await interaction.followUp({
        content: '❌ No pude crear el canal. ¿Tengo permiso para gestionar canales?',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateTicketConfig(guild.id, {
      panelChannelId: channel.id,
      panelMessageId: null,
    });
    const withChannel = await getTicketConfig(guild.id);
    const result = await publishTicketPanel(guild, withChannel);

    const fresh = await getTicketConfig(guild.id);
    const options = await getOptions(guild.id);
    await interaction.editReply({
      ...buildTicketConfigPanel(fresh, options),
      flags: TCFG_UPDATE_FLAGS,
    });
    await interaction.followUp({
      content: result.ok
        ? `✅ Canal <#${channel.id}> creado y panel publicado.`
        : `⚠️ Canal creado, pero no pude publicar: ${result.error}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
