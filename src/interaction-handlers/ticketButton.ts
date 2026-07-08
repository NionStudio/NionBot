import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ChannelType,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { getTicketConfig } from '../lib/ticket-config.js';
import {
  buildCloseConfirmMessage,
  buildDeleteCountdownMessage,
  buildNoticeMessage,
  buildReminderModal,
  buildTranscriptLog,
  parseTranscriptMessage,
  TICKET,
} from '../lib/components/ticket-panel.js';
import { EMOJI } from '../lib/emojis.js';
import { buildDirectLink } from '../lib/transcript-link.js';
import {
  claimTicket,
  closeTicket,
  deleteTicket,
  getTicketByChannel,
  isStaff,
  reopenTicket,
  saveTranscript,
} from '../lib/tickets.js';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class TicketButton extends InteractionHandler {
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
    if (!interaction.customId.startsWith(TICKET)) return this.none();
    if (!interaction.inGuild()) return this.none();
    const action = interaction.customId.slice(TICKET.length);

    if (action === 'open') return this.none();
    return this.some(action);
  }

  public override async run(
    interaction: ButtonInteraction,
    action: InteractionHandler.ParseResult<this>,
  ): Promise<void> {
    if (action === 'remind') return this.handleRemind(interaction);

    if (action === 'tlink') return this.handleGetLink(interaction);
    return this.handleTicketAction(interaction, action);
  }

  private async handleGetLink(interaction: ButtonInteraction): Promise<void> {
    const channel = interaction.channel;
    if (!channel?.isTextBased()) return;
    await interaction.deferUpdate();

    const fresh = await channel.messages
      .fetch({ message: interaction.message.id, force: true })
      .catch(() => null);
    const msg = fresh ?? interaction.message;

    const { text, fileName, fileUrl } = parseTranscriptMessage(msg.components);
    if (!fileUrl || !fileName) {
      await interaction.followUp({
        content: '❌ No pude leer el archivo de la transcripción.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const directUrl = buildDirectLink(fileUrl);
    if (!directUrl) {
      await interaction.followUp({
        content: '❌ El visor de transcripciones no está configurado.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.editReply(
      buildTranscriptLog(text, fileName, { getLinkButton: true, directUrl }),
    );
  }

  private async handleRemind(interaction: ButtonInteraction): Promise<void> {
    const ticket = await getTicketByChannel(interaction.channelId!);
    const config = await getTicketConfig(interaction.guildId!);
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    if (!isStaff(member, ticket?.staffRoleId ?? config.staffRoleId)) {
      await interaction.reply({
        content: '❌ Solo el staff puede usar esto.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.showModal(buildReminderModal());
  }

  private async handleTicketAction(
    interaction: ButtonInteraction,
    action: string,
  ): Promise<void> {
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const ticket = await getTicketByChannel(channel.id);
    if (!ticket) {
      await interaction.reply({
        content: '❌ Este canal no es un ticket.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getTicketConfig(interaction.guildId!);
    const staffRoleId = ticket.staffRoleId ?? config.staffRoleId;
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const staff = isStaff(member, staffRoleId);
    const isOpener = interaction.user.id === ticket.openerId;

    switch (action) {
      case 'close': {
        if (!staff && !isOpener) return this.deny(interaction);

        await interaction.reply(buildCloseConfirmMessage());
        return;
      }
      case 'closeno': {
        if (!staff && !isOpener) return this.deny(interaction);

        await interaction.deferUpdate();
        await interaction.message.delete().catch(() => {});
        return;
      }
      case 'closeyes': {
        if (!staff && !isOpener) return this.deny(interaction);

        await interaction.update(
          buildNoticeMessage(`${EMOJI.closed} Este ticket se ha cerrado.`),
        );
        await closeTicket(channel, ticket, interaction.user.id);

        await wait(1000);
        const savedIn = await saveTranscript(
          channel,
          ticket,
          config.transcriptChannelId,
        );
        if (savedIn) {
          await channel.send(
            buildNoticeMessage(
              `${EMOJI.transcript} La transcripción se ha guardado en <#${savedIn}>.`,
            ),
          );
        }
        return;
      }
      case 'claim': {
        if (!staff) return this.deny(interaction);
        if (ticket.claimedById) {
          await interaction.reply({
            content: `⚠️ Ya lo reclamó <@${ticket.claimedById}>.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferUpdate();
        await claimTicket(channel, ticket, member, staffRoleId);
        return;
      }
      case 'reopen': {
        if (!staff) return this.deny(interaction);
        await interaction.update(
          buildNoticeMessage(`${EMOJI.reopen} Este ticket se ha reabierto.`),
        );
        await reopenTicket(channel, ticket, staffRoleId);
        return;
      }
      case 'delete': {
        if (!staff) return this.deny(interaction);

        await interaction.reply(buildDeleteCountdownMessage(3));
        for (let s = 2; s >= 0; s--) {
          await wait(1000);
          await interaction
            .editReply(buildDeleteCountdownMessage(s))
            .catch(() => {});
        }
        await wait(1000);
        await deleteTicket(channel, ticket);
        return;
      }
      case 'transcript': {
        if (!staff) return this.deny(interaction);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!config.transcriptChannelId) {
          await interaction.editReply(
            '❌ No hay canal de transcripciones configurado (`/config ticket`).',
          );
          return;
        }
        const savedIn = await saveTranscript(
          channel,
          ticket,
          config.transcriptChannelId,
        );
        if (!savedIn) {
          await interaction.editReply(
            '❌ El canal de transcripciones no es válido o no puedo escribir en él.',
          );
          return;
        }
        await interaction.editReply(`✅ Transcripción enviada a <#${savedIn}>.`);
        return;
      }
      default:
        return;
    }
  }

  private async deny(interaction: ButtonInteraction): Promise<void> {
    await interaction.reply({
      content: '❌ No tienes permiso para esto.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
