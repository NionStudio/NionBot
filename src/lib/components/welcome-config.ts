import type { GuildConfig } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type User,
} from 'discord.js';
import { renderWelcomeCard, type WelcomeSample } from '../welcome.js';

export const BTN = 'cfgw:';
export const MODAL = 'cfgwm:';

export function colorToHex(color: number | null): string {
  if (color === null) return '';
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
}

export function parseColor(raw: string): number | null | undefined {
  const s = raw.trim().replace(/^#/, '');
  if (s === '') return null;
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return undefined;
  return Number.parseInt(s, 16);
}

export function sampleFromInteraction(interaction: {
  user: User;
  guild: Guild | null;
}): WelcomeSample {
  const { user, guild } = interaction;
  return {
    memberId: user.id,
    username: user.username,
    avatarUrl: user.displayAvatarURL({ size: 256 }),
    createdTimestampSec: Math.floor(user.createdTimestamp / 1000),
    guildName: guild?.name ?? 'Servidor',
    memberCount: guild?.memberCount ?? 1,

    inviterId: user.id,
  };
}

export function buildWelcomeConfigPanel(
  config: GuildConfig,
  sample: WelcomeSample,
) {
  const preview = renderWelcomeCard(config, sample);

  const header = new TextDisplayBuilder().setContent(
    '### ⚙️ Configuración de bienvenida\n' +
      `Estado: ${config.welcomeEnabled ? '✅ activada' : '❌ desactivada'} · ` +
      `Canal: ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '`sin definir`'}\n` +
      '_Vista previa (contigo como ejemplo):_',
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BTN}toggle`)
      .setLabel(config.welcomeEnabled ? 'Desactivar' : 'Activar')
      .setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${BTN}desc`)
      .setLabel('Descripción')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${BTN}color`)
      .setLabel('Color')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${BTN}thumb`)
      .setLabel('Thumbnail')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${BTN}fields`)
      .setLabel('Fecha / Invited by')
      .setStyle(ButtonStyle.Secondary),
  );

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`${BTN}channel`)
    .addChannelTypes(ChannelType.GuildText)
    .setPlaceholder('Elige el canal de bienvenida')
    .setMinValues(1)
    .setMaxValues(1);
  if (config.welcomeChannelId) {
    channelMenu.setDefaultChannels(config.welcomeChannelId);
  }
  const channelRow =
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu);

  return {
    components: [header, ...preview.components, buttons, channelRow],
    files: preview.files,
  };
}

export function buildDescModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${MODAL}desc`)
    .setTitle('Descripción de la bienvenida')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel('Descripción (Markdown)')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(2000)
          .setRequired(true)
          .setValue(config.welcomeMessage)
          .setPlaceholder('Variables: {user} {username} {server} {new_member_count} {e:icon} {e:user}'),
      ),
    );
}

export function buildColorModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${MODAL}color`)
    .setTitle('Color de acento')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel('Color hex (vacío = sin color)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(7)
          .setRequired(false)
          .setValue(colorToHex(config.welcomeAccentColor))
          .setPlaceholder('#5865F2'),
      ),
    );
}

export function buildThumbModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${MODAL}thumb`)
    .setTitle('Thumbnail')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel('{user}, una URL, o vacío')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(500)
          .setRequired(false)
          .setValue(config.welcomeThumbnail)
          .setPlaceholder('{user} = avatar del miembro'),
      ),
    );
}

export function buildFieldsModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${MODAL}fields`)
    .setTitle('Account creation / Invited by')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('creation')
          .setLabel('Account creation')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(true)
          .setValue(config.welcomeCreationField)
          .setPlaceholder('Usa {creation_date} para la fecha real'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('invited')
          .setLabel('Invited by')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(true)
          .setValue(config.welcomeInvitedField)
          .setPlaceholder('Usa {invited_by} para el invitador real'),
      ),
    );
}

export const PANEL_REPLY_FLAGS =
  MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

export const PANEL_UPDATE_FLAGS = MessageFlags.IsComponentsV2;
