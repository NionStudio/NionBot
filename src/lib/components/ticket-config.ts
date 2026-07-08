import type { TicketConfig } from '@prisma/client';
import { TicketFieldStyle } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { OptionWithFields } from '../ticket-options.js';
import { styleLabel } from '../ticket-options.js';
import { buildTicketPanel } from './ticket-panel.js';

export const TCFG = 'tcfg:';
export const TCFG_MODAL = 'tcfgm:';
export const TOPT = 'topt:';
export const TOPT_MODAL = 'toptm:';

export const TCFG_REPLY_FLAGS =
  MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
export const TCFG_UPDATE_FLAGS = MessageFlags.IsComponentsV2;

export function buildTicketConfigPanel(
  config: TicketConfig,
  options: OptionWithFields[],
) {
  const preview = buildTicketPanel(config, options, { preview: true });

  const status = new TextDisplayBuilder().setContent(
    '### ⚙️ Configuración de tickets\n' +
      `Rol de staff (por defecto): ${config.staffRoleId ? `<@&${config.staffRoleId}>` : '`sin definir`'}\n` +
      `Categoría (por defecto): ${config.categoryId ? `<#${config.categoryId}>` : '`sin definir`'}\n` +
      `Transcripciones: ${config.transcriptChannelId ? `<#${config.transcriptChannelId}>` : '`sin definir`'}\n` +
      `Canal del panel: ${config.panelChannelId ? `<#${config.panelChannelId}>${config.panelMessageId ? ' · ✅ publicado' : ' · ⏳ sin publicar'}` : '`sin definir`'}\n` +
      `Opciones del desplegable: **${options.length}**\n` +
      '_Vista previa del panel:_',
  );

  const contentRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TCFG}msg`)
      .setLabel('Mensaje del panel')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${TCFG}name`)
      .setLabel('Nombre del desplegable')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${TCFG}openmsg`)
      .setLabel('Mensaje de apertura (por defecto)')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${TCFG}resptime`)
      .setLabel('Tiempo de respuesta')
      .setStyle(ButtonStyle.Secondary),
  );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TCFG}addopt`)
      .setLabel('Añadir opción')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${TCFG}publish`)
      .setLabel(config.panelMessageId ? 'Republicar' : 'Publicar')
      .setEmoji('📤')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${TCFG}newchannel`)
      .setLabel('Crear canal nuevo')
      .setEmoji('🆕')
      .setStyle(ButtonStyle.Secondary),
  );

  const editRows =
    options.length > 0
      ? [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`${TCFG}editopt`)
              .setPlaceholder('✏️ Editar una opción')
              .addOptions(
                options.map((o) => {
                  const opt: {
                    label: string;
                    value: string;
                    description?: string;
                    emoji?: string;
                  } = {
                    label: o.label.slice(0, 100),
                    value: String(o.id),
                    description: `${o.fields.length} campo(s)`,
                  };
                  if (o.emoji) opt.emoji = o.emoji;
                  return opt;
                }),
              ),
          ),
        ]
      : [];

  const staffRow = selectRow(
    new RoleSelectMenuBuilder()
      .setCustomId(`${TCFG}staff`)
      .setPlaceholder('Rol de staff por defecto')
      .setMinValues(1)
      .setMaxValues(1),
    config.staffRoleId,
    'role',
  );
  const categoryRow = selectRow(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${TCFG}category`)
      .addChannelTypes(ChannelType.GuildCategory)
      .setPlaceholder('Categoría por defecto de los tickets')
      .setMinValues(1)
      .setMaxValues(1),
    config.categoryId,
    'channel',
  );
  const transcriptRow = selectRow(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${TCFG}transcript`)
      .addChannelTypes(ChannelType.GuildText)
      .setPlaceholder('Canal para guardar transcripciones')
      .setMinValues(1)
      .setMaxValues(1),
    config.transcriptChannelId,
    'channel',
  );
  const panelRow = selectRow(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${TCFG}panelch`)
      .addChannelTypes(ChannelType.GuildText)
      .setPlaceholder('Canal donde publicar el panel')
      .setMinValues(1)
      .setMaxValues(1),
    config.panelChannelId,
    'channel',
  );

  return {
    components: [
      status,
      ...preview.components,
      contentRow,
      actionRow,
      ...editRows,
      staffRow,
      categoryRow,
      transcriptRow,
      panelRow,
    ],
  };
}

export function buildOptionEditor(option: OptionWithFields) {
  const fieldLines =
    option.fields.length > 0
      ? option.fields
          .map(
            (f, i) =>
              `${i + 1}. ${f.label} · _${styleLabel(f.style)}_ · ${f.required ? 'obligatorio' : 'opcional'}`,
          )
          .join('\n')
      : '_Sin campos. Añade al menos uno._';

  const summary = new TextDisplayBuilder().setContent(
    `### ✏️ Opción: ${option.emoji ? `${option.emoji} ` : ''}${option.label}\n` +
      `Descripción: ${option.description ? option.description : '`sin definir`'}\n` +
      `Categoría propia: ${option.categoryId ? `<#${option.categoryId}>` : '_(usa la por defecto)_'}\n` +
      `Staff propio: ${option.staffRoleId ? `<@&${option.staffRoleId}>` : '_(usa el por defecto)_'}\n` +
      `Mensaje de apertura propio: ${option.openMessage ? '✅' : '_(usa el por defecto)_'}\n` +
      `Tiempo de respuesta propio: ${option.responseTime ? option.responseTime : '_(usa el por defecto)_'}\n\n` +
      `**Campos del formulario (${option.fields.length}/5):**\n${fieldLines}`,
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TOPT}edit:${option.id}`)
      .setLabel('Editar textos')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${TOPT}addfield:${option.id}`)
      .setLabel('Añadir campo')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(option.fields.length >= 5),
    new ButtonBuilder()
      .setCustomId(`${TOPT}delopt:${option.id}`)
      .setLabel('Eliminar opción')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${TOPT}back`)
      .setLabel('Volver')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary),
  );

  const catRow = selectRow(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${TOPT}cat:${option.id}`)
      .addChannelTypes(ChannelType.GuildCategory)
      .setPlaceholder('Categoría propia (vacío = por defecto)')
      .setMinValues(0)
      .setMaxValues(1),
    option.categoryId,
    'channel',
  );
  const staffRow = selectRow(
    new RoleSelectMenuBuilder()
      .setCustomId(`${TOPT}staff:${option.id}`)
      .setPlaceholder('Rol de staff propio (vacío = por defecto)')
      .setMinValues(0)
      .setMaxValues(1),
    option.staffRoleId,
    'role',
  );

  const fieldRows =
    option.fields.length > 0
      ? [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`${TOPT}editfield:${option.id}`)
              .setPlaceholder('✏️ Editar un campo')
              .addOptions(
                option.fields.map((f) => ({
                  label: f.label.slice(0, 100),
                  value: String(f.id),
                  description: `${styleLabel(f.style)} · ${f.required ? 'obligatorio' : 'opcional'}`,
                })),
              ),
          ),
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`${TOPT}delfield:${option.id}`)
              .setPlaceholder('🗑️ Eliminar un campo')
              .addOptions(
                option.fields.map((f) => ({
                  label: f.label.slice(0, 100),
                  value: String(f.id),
                })),
              ),
          ),
        ]
      : [];

  return { components: [summary, buttons, catRow, staffRow, ...fieldRows] };
}

export function buildPanelMsgModal(config: TicketConfig): ModalBuilder {
  return oneInputModal(
    `${TCFG_MODAL}msg`,
    'Mensaje del panel',
    'value',
    'Texto del panel (Markdown)',
    TextInputStyle.Paragraph,
    config.panelMessage,
    'Variables: {server}',
    2000,
    true,
  );
}

export function buildNameModal(config: TicketConfig): ModalBuilder {
  return oneInputModal(
    `${TCFG_MODAL}name`,
    'Nombre del desplegable',
    'value',
    'Texto que se ve en el desplegable',
    TextInputStyle.Short,
    config.dropdownPlaceholder,
    'Elige un motivo para abrir un ticket',
    100,
    true,
  );
}

export function buildDefaultOpenModal(config: TicketConfig): ModalBuilder {
  return oneInputModal(
    `${TCFG_MODAL}openmsg`,
    'Mensaje de apertura por defecto',
    'value',
    'Mensaje dentro del ticket',
    TextInputStyle.Paragraph,
    config.openMessage,
    'Variables: {user} (mención) · {server}',
    2000,
    true,
  );
}

export function buildResponseTimeModal(config: TicketConfig): ModalBuilder {
  return oneInputModal(
    `${TCFG_MODAL}resptime`,
    'Tiempo de respuesta (por defecto)',
    'value',
    'Texto de la línea de tiempo',
    TextInputStyle.Short,
    config.responseTime,
    'Ej: 15 minutos',
    100,
    true,
  );
}

export function buildOptionTextModal(option: OptionWithFields): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${TOPT_MODAL}text:${option.id}`)
    .setTitle('Textos de la opción')
    .addComponents(
      inputRow('label', 'Nombre de la opción', TextInputStyle.Short, option.label, 'Soporte General', 100, true),
      inputRow('emoji', 'Emoji (vacío = ninguno)', TextInputStyle.Short, option.emoji ?? '', '🛠️ o <:nombre:id>', 64, false),
      inputRow('description', 'Descripción (vacío = ninguna)', TextInputStyle.Short, option.description ?? '', 'Se muestra bajo la opción', 100, false),
      inputRow('openmsg', 'Apertura propia (vacío = por defecto)', TextInputStyle.Paragraph, option.openMessage ?? '', '{user}, {server}', 2000, false),
      inputRow('resptime', 'Tiempo de resp. (vacío = por defecto)', TextInputStyle.Short, option.responseTime ?? '', 'Ej: 15 minutos', 100, false),
    );
}

export function buildFieldModal(
  optionId: number,
  field: { id: number; label: string; style: TicketFieldStyle; required: boolean } | null,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${TOPT_MODAL}field:${optionId}:${field ? field.id : 'new'}`)
    .setTitle(field ? 'Editar campo' : 'Nuevo campo')
    .addComponents(
      inputRow('label', 'Pregunta (etiqueta del campo)', TextInputStyle.Short, field?.label ?? '', '¿Cuál es tu duda?', 45, true),
      inputRow(
        'type',
        'Tipo: corto o parrafo',
        TextInputStyle.Short,
        field ? styleLabel(field.style) : 'corto',
        'corto / parrafo',
        20,
        false,
      ),
      inputRow(
        'required',
        'Obligatorio: si o no',
        TextInputStyle.Short,
        field ? (field.required ? 'si' : 'no') : 'si',
        'si / no',
        10,
        false,
      ),
    );
}

function selectRow(
  menu: RoleSelectMenuBuilder | ChannelSelectMenuBuilder,
  currentId: string | null,
  kind: 'role' | 'channel',
): ActionRowBuilder<RoleSelectMenuBuilder | ChannelSelectMenuBuilder> {
  if (currentId) {
    if (kind === 'role') (menu as RoleSelectMenuBuilder).setDefaultRoles(currentId);
    else (menu as ChannelSelectMenuBuilder).setDefaultChannels(currentId);
  }
  return new ActionRowBuilder<RoleSelectMenuBuilder | ChannelSelectMenuBuilder>().addComponents(
    menu,
  );
}

function inputRow(
  customId: string,
  label: string,
  style: TextInputStyle,
  value: string,
  placeholder: string,
  maxLength: number,
  required: boolean,
): ActionRowBuilder<TextInputBuilder> {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label.slice(0, 45))
    .setStyle(style)
    .setMaxLength(maxLength)
    .setRequired(required)
    .setPlaceholder(placeholder);
  if (value) input.setValue(value);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

function oneInputModal(
  customId: string,
  title: string,
  inputId: string,
  label: string,
  style: TextInputStyle,
  value: string,
  placeholder: string,
  maxLength: number,
  required: boolean,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(inputRow(inputId, label, style, value, placeholder, maxLength, required));
}
