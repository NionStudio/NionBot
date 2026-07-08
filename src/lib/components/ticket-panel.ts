import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileBuilder,
  MessageFlags,
  type MessageCreateOptions,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { TicketConfig, TicketField } from '@prisma/client';
import { TicketFieldStyle } from '@prisma/client';
import { EMOJI } from '../emojis.js';
import type { OptionWithFields } from '../ticket-options.js';

export const TICKET = 'tkt:';
export const TICKET_MODAL = 'tktm:';

export const TICKET_FORM = 'tktf:';

export const fieldInputId = (fieldId: number): string => `f${fieldId}`;

export function buildTicketPanel(
  config: TicketConfig,
  options: OptionWithFields[],
  opts: { preview?: boolean } = {},
) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${TICKET}open`)
    .setPlaceholder(config.dropdownPlaceholder || 'Elige un motivo')
    .setDisabled((opts.preview ?? false) || options.length === 0);

  if (options.length === 0) {
    select.addOptions({
      label: 'Sin opciones configuradas',
      value: 'none',
      description: 'Añade opciones desde /config ticket',
    });
  } else {
    select.addOptions(
      options.map((o) => {
        const opt: {
          label: string;
          value: string;
          description?: string;
          emoji?: string;
        } = { label: o.label.slice(0, 100), value: String(o.id) };
        if (o.description) opt.description = o.description.slice(0, 100);
        if (o.emoji) opt.emoji = o.emoji;
        return opt;
      }),
    );
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(config.panelMessage),
    )
    .addActionRowComponents((row) => row.addComponents(select));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
  } as const;
}

export function buildFormModal(option: OptionWithFields): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${TICKET_FORM}${option.id}`)
    .setTitle(option.label.slice(0, 45));

  for (const field of option.fields.slice(0, 5)) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(fieldInputId(field.id))
          .setLabel(field.label.slice(0, 45))
          .setStyle(inputStyle(field))
          .setRequired(field.required)
          .setMaxLength(field.style === TicketFieldStyle.PARAGRAPH ? 1000 : 300),
      ),
    );
  }
  return modal;
}

function inputStyle(field: TicketField): TextInputStyle {
  return field.style === TicketFieldStyle.PARAGRAPH
    ? TextInputStyle.Paragraph
    : TextInputStyle.Short;
}

export function buildTicketControls(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET}close`)
      .setLabel('Cerrar ticket')
      .setEmoji(EMOJI.cross)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${TICKET}claim`)
      .setLabel('Atender')
      .setEmoji(EMOJI.claim)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${TICKET}remind`)
      .setLabel('Recordatorio')
      .setEmoji(EMOJI.compass)
      .setStyle(ButtonStyle.Secondary),
  );
}

function controlsContainer(): ContainerBuilder {
  return new ContainerBuilder().addActionRowComponents((row) =>
    row.addComponents(...buildTicketControls().components),
  );
}

export function buildTicketOpenMessages(opts: {
  greeting: string;
  responseTime: string;
  openerId: string;
  answers?: { label: string; value: string }[];
}) {
  const greetingMsg: MessageCreateOptions = {
    components: [
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(opts.greeting.slice(0, 4000)),
        )
        .addSeparatorComponents((s) => s)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${EMOJI.compass} **Tiempo de respuesta**・${opts.responseTime}`,
          ),
        ),
    ],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { users: [opts.openerId] },
  };

  const answered = (opts.answers ?? []).filter((a) => a.value.trim().length > 0);
  let answersMsg: MessageCreateOptions | null = null;
  if (answered.length > 0) {
    const container = new ContainerBuilder();

    answered.forEach((a, i) => {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**${a.label}**\n${a.value}`.slice(0, 4000),
        ),
      );
      if (i < answered.length - 1) {
        container.addSeparatorComponents((s) => s);
      }
    });
    answersMsg = {
      components: [container],
      flags: MessageFlags.IsComponentsV2 as const,
      allowedMentions: { parse: [] },
    };
  }

  const controlsMsg: MessageCreateOptions = {
    components: [controlsContainer()],
    flags: MessageFlags.IsComponentsV2 as const,
  };

  return answersMsg
    ? [greetingMsg, answersMsg, controlsMsg]
    : [greetingMsg, controlsMsg];
}

export function buildCloseConfirmMessage() {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '¿Estás seguro que quieres cerrar el ticket?',
      ),
    )
    .addSeparatorComponents((s) => s)
    .addActionRowComponents((row) =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${TICKET}closeyes`)
          .setLabel('Cerrar')
          .setEmoji(EMOJI.check)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${TICKET}closeno`)
          .setLabel('Cancelar')
          .setEmoji(EMOJI.cross)
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
  };
}

export function buildDeleteCountdownMessage(seconds: number) {
  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${EMOJI.report} El ticket se borrará en ${seconds} segundo${
            seconds === 1 ? '' : 's'
          }...`,
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2 as const,
  };
}

export function buildNoticeMessage(text: string) {
  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(text),
      ),
    ],
    flags: MessageFlags.IsComponentsV2 as const,
  };
}

export function buildClosedMessage(byUserId: string, reason?: string) {
  const reasonText = reason ? `\n_${reason}_` : '';
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${EMOJI.cross} Ticket cerrado por <@${byUserId}>.${reasonText}`,
      ),
    )
    .addSeparatorComponents((s) => s)
    .addActionRowComponents((row) => row.addComponents(...closedControlsRow().components));
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] },
  };
}

export function buildClaimMessage(staffId: string) {
  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${EMOJI.claim} <@${staffId}> ha reclamado el ticket!`,
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] },
  };
}

export function buildReminderMessage(openerId: string, humanized: string) {
  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${EMOJI.compass} <@${openerId}>, Cuentas con ${humanized} para responder a este ticket, caso contrario se cerrará.`,
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { users: [openerId] },
  };
}

export function buildTranscriptLog(
  text: string,
  fileName: string,
  opts: { getLinkButton?: boolean; directUrl?: string } = {},
) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
    .addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`));

  if (opts.getLinkButton || opts.directUrl) {
    const buttons: ButtonBuilder[] = [];
    if (opts.getLinkButton) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${TICKET}tlink`)
          .setLabel('Obtener enlace directo')
          .setEmoji(EMOJI.transcript)
          .setStyle(ButtonStyle.Secondary),
      );
    }
    if (opts.directUrl) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('Enlace directo')
          .setEmoji('🔗')
          .setStyle(ButtonStyle.Link)
          .setURL(opts.directUrl),
      );
    }
    container.addActionRowComponents((row) => row.addComponents(...buttons));
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] },
  };
}

export function parseTranscriptMessage(components: readonly unknown[]): {
  text: string;
  fileName?: string;
  fileUrl?: string;
} {
  let text = '';
  let fileUrl: string | undefined;
  interface Node {
    type: number;
    content?: string;
    file?: { url?: string } | null;
    components?: readonly Node[];
  }
  const walk = (nodes: readonly Node[]): void => {
    for (const n of nodes) {
      if (n.type === 10 && !text && n.content) text = n.content;
      if (n.type === 13 && n.file?.url) fileUrl = n.file.url;
      if (n.components) walk(n.components);
    }
  };
  walk(components as readonly Node[]);
  const fileName = fileUrl
    ? decodeURIComponent(new URL(fileUrl).pathname.split('/').pop() ?? '')
    : undefined;
  return { text, fileName, fileUrl };
}

export function buildReopenMessage() {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${EMOJI.reopen} Ticket reabierto.`),
  );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
  } as const;
}

function closedControlsRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET}reopen`)
      .setLabel('Reabrir')
      .setEmoji(EMOJI.reopen)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${TICKET}transcript`)
      .setLabel('Transcribir')
      .setEmoji(EMOJI.transcript)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${TICKET}delete`)
      .setLabel('Borrar')
      .setEmoji(EMOJI.trash)
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildReminderModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${TICKET_MODAL}remind`)
    .setTitle('Recordatorio de auto-cierre')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('time')
          .setLabel('Tiempo para responder')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder('Ej: 30m, 2h, 1d, 1h30m'),
      ),
    );
}
