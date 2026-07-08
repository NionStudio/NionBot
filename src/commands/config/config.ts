import { Command } from '@sapphire/framework';
import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../../lib/config.js';
import {
  buildWelcomeConfigPanel,
  PANEL_REPLY_FLAGS,
  sampleFromInteraction,
} from '../../lib/components/welcome-config.js';
import { getTicketConfig } from '../../lib/ticket-config.js';
import { getOptions } from '../../lib/ticket-options.js';
import {
  buildTicketConfigPanel,
  TCFG_REPLY_FLAGS,
} from '../../lib/components/ticket-config.js';

export class ConfigCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, description: 'Configura las bienvenidas de Nion Studio' });
  }

  public override registerApplicationCommands(
    registry: Command.Registry,
  ): void {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('config')
        .setDescription('Configura las bienvenidas de Nion Studio')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((sub) =>
          sub.setName('show').setDescription('Muestra la configuración actual'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('welcome')
            .setDescription('Abre el panel de configuración de la bienvenida'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('ticket')
            .setDescription('Abre el panel de configuración del sistema de tickets'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('dm')
            .setDescription('Configura el DM de bienvenida')
            .addBooleanOption((o) =>
              o.setName('enabled').setDescription('Activar/desactivar DM'),
            )
            .addStringOption((o) =>
              o
                .setName('message')
                .setDescription('Plantilla del DM. Placeholders: {user} {username} {server}')
                .setMaxLength(2000),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('goodbye')
            .setDescription('Configura la despedida')
            .addBooleanOption((o) =>
              o.setName('enabled').setDescription('Activar/desactivar despedidas'),
            )
            .addChannelOption((o) =>
              o
                .setName('channel')
                .setDescription('Canal donde publicar la despedida')
                .addChannelTypes(ChannelType.GuildText),
            )
            .addStringOption((o) =>
              o
                .setName('message')
                .setDescription('Plantilla. Placeholders: {username} {server} {count}')
                .setMaxLength(2000),
            ),
        )
        .addSubcommandGroup((group) =>
          group
            .setName('autorole')
            .setDescription('Roles asignados automáticamente al entrar')
            .addSubcommand((sub) =>
              sub
                .setName('add')
                .setDescription('Añade un auto-rol')
                .addRoleOption((o) =>
                  o.setName('role').setDescription('Rol a añadir').setRequired(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName('remove')
                .setDescription('Quita un auto-rol')
                .addRoleOption((o) =>
                  o.setName('role').setDescription('Rol a quitar').setRequired(true),
                ),
            ),
        ),
    );
  }

  public override async chatInputRun(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Este comando solo funciona dentro de un servidor.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand(true);
    const guildId = interaction.guildId;

    if (group === 'autorole') {
      await this.handleAutorole(interaction, guildId, sub);
      return;
    }

    switch (sub) {
      case 'show':
        return this.handleShow(interaction, guildId);
      case 'welcome':
        return this.handleWelcome(interaction, guildId);
      case 'ticket':
        return this.handleTicket(interaction, guildId);
      case 'dm':
        return this.handleDm(interaction, guildId);
      case 'goodbye':
        return this.handleGoodbye(interaction, guildId);
      default:
        await interaction.reply({
          content: 'Subcomando desconocido.',
          flags: MessageFlags.Ephemeral,
        });
    }
  }

  private async handleShow(
    interaction: ChatInputCommandInteraction,
    guildId: string,
  ): Promise<void> {
    const c = await getGuildConfig(guildId);
    const roles = c.autoRoleIds.map((id) => `<@&${id}>`).join(', ') || '_ninguno_';
    const lines = [
      '**Configuración de Nion Studio**',
      '',
      `**Bienvenida:** ${c.welcomeEnabled ? '✅' : '❌'} · canal: ${c.welcomeChannelId ? `<#${c.welcomeChannelId}>` : '_sin definir_'}`,
      `> ${c.welcomeMessage}`,
      `**DM:** ${c.dmEnabled ? '✅' : '❌'}`,
      `> ${c.dmMessage}`,
      `**Despedida:** ${c.goodbyeEnabled ? '✅' : '❌'} · canal: ${c.goodbyeChannelId ? `<#${c.goodbyeChannelId}>` : '_sin definir_'}`,
      `> ${c.goodbyeMessage}`,
      `**Auto-roles:** ${roles}`,
    ];
    await interaction.reply({
      content: lines.join('\n'),
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleWelcome(
    interaction: ChatInputCommandInteraction,
    guildId: string,
  ): Promise<void> {
    const config = await getGuildConfig(guildId);
    await interaction.reply({
      ...buildWelcomeConfigPanel(config, sampleFromInteraction(interaction)),
      flags: PANEL_REPLY_FLAGS,
    });
  }

  private async handleTicket(
    interaction: ChatInputCommandInteraction,
    guildId: string,
  ): Promise<void> {
    const config = await getTicketConfig(guildId);
    const options = await getOptions(guildId);
    await interaction.reply({
      ...buildTicketConfigPanel(config, options),
      flags: TCFG_REPLY_FLAGS,
    });
  }

  private async handleDm(
    interaction: ChatInputCommandInteraction,
    guildId: string,
  ): Promise<void> {
    const enabled = interaction.options.getBoolean('enabled');
    const message = interaction.options.getString('message');

    await updateGuildConfig(guildId, {
      ...(enabled !== null ? { dmEnabled: enabled } : {}),
      ...(message ? { dmMessage: message } : {}),
    });

    await interaction.reply({
      content: '✅ DM de bienvenida actualizado.',
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleGoodbye(
    interaction: ChatInputCommandInteraction,
    guildId: string,
  ): Promise<void> {
    const enabled = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    await updateGuildConfig(guildId, {
      ...(enabled !== null ? { goodbyeEnabled: enabled } : {}),
      ...(channel ? { goodbyeChannelId: channel.id } : {}),
      ...(message ? { goodbyeMessage: message } : {}),
    });

    await interaction.reply({
      content: '✅ Despedida actualizada.',
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleAutorole(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    action: string,
  ): Promise<void> {
    const role = interaction.options.getRole('role', true);
    const current = (await getGuildConfig(guildId)).autoRoleIds;

    let next: string[];
    if (action === 'add') {
      next = current.includes(role.id) ? current : [...current, role.id];
    } else {
      next = current.filter((id) => id !== role.id);
    }

    await updateGuildConfig(guildId, { autoRoleIds: next });
    await interaction.reply({
      content:
        action === 'add'
          ? `✅ Añadido auto-rol <@&${role.id}>.`
          : `✅ Quitado auto-rol <@&${role.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
