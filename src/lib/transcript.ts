import {
  AttachmentBuilder,
  ComponentType,
  MessageFlags,
  type GuildTextBasedChannel,
} from 'discord.js';

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

interface V2Node {
  type: ComponentType;
  content?: string;
  components?: readonly V2Node[];
  accentColor?: number | null;
  divider?: boolean;
  label?: string | null;
  style?: number;
  url?: string | null;
  placeholder?: string | null;
  accessory?: V2Node | null;
  emoji?: { id?: string | null; name?: string | null; animated?: boolean } | null;
  media?: { url: string } | null;
  file?: { url: string } | null;
  items?: readonly { media: { url: string } }[];
}

function renderEmoji(e: NonNullable<V2Node['emoji']>): string {
  if (e.id) {
    const ext = e.animated ? 'gif' : 'png';
    return `<img class="emoji" src="https://cdn.discordapp.com/emojis/${e.id}.${ext}" alt="">`;
  }
  return e.name ? esc(e.name) : '';
}

function fmtText(raw: string): string {
  const stash: string[] = [];
  const keep = (html: string): string => {
    stash.push(html);
    return `@@${stash.length - 1}@@`;
  };

  let s = raw
    .replace(/<(a)?:(\w+):(\d+)>/g, (_m, animated, name, id) =>
      keep(
        `<img class="emoji" src="https://cdn.discordapp.com/emojis/${id}.${
          animated ? 'gif' : 'png'
        }" alt=":${name}:">`,
      ),
    )
    .replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (_m, ts) =>
      keep(
        `<span class="ts">${esc(
          new Date(Number(ts) * 1000).toLocaleString('es-ES'),
        )}</span>`,
      ),
    )
    .replace(/<@!?(\d+)>/g, () => keep('<span class="mention">@usuario</span>'))
    .replace(/<@&(\d+)>/g, () => keep('<span class="mention">@rol</span>'))
    .replace(/<#(\d+)>/g, () => keep('<span class="mention">#canal</span>'));

  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replaceAll('\n', '<br>');
  s = s.replace(/@@(\d+)@@/g, (_m, i) => stash[Number(i)] ?? '');
  return s;
}

const BUTTON_CLASS: Record<number, string> = {
  1: 'btn-primary',
  2: 'btn-secondary',
  3: 'btn-success',
  4: 'btn-danger',
  5: 'btn-link',
};

function renderNode(n: V2Node): string {
  switch (n.type) {
    case ComponentType.Container: {
      const accent =
        typeof n.accentColor === 'number'
          ? ` style="border-left:4px solid #${n.accentColor
              .toString(16)
              .padStart(6, '0')}"`
          : '';
      return `<div class="v2-container"${accent}>${(n.components ?? [])
        .map(renderNode)
        .join('')}</div>`;
    }
    case ComponentType.TextDisplay:
      return `<div class="v2-text">${fmtText(n.content ?? '')}</div>`;
    case ComponentType.Separator:
      return n.divider === false
        ? '<div class="v2-space"></div>'
        : '<hr class="v2-sep">';
    case ComponentType.Section: {
      const text = (n.components ?? []).map(renderNode).join('');
      const acc = n.accessory
        ? `<div class="v2-acc">${renderNode(n.accessory)}</div>`
        : '';
      return `<div class="v2-section"><div class="v2-section-text">${text}</div>${acc}</div>`;
    }
    case ComponentType.ActionRow:
      return `<div class="v2-row">${(n.components ?? [])
        .map(renderNode)
        .join('')}</div>`;
    case ComponentType.Button: {
      const cls = BUTTON_CLASS[n.style ?? 2] ?? 'btn-secondary';
      const emoji = n.emoji ? renderEmoji(n.emoji) : '';
      const label = n.label ? esc(n.label) : '';
      return `<span class="v2-btn ${cls}">${emoji}${label}</span>`;
    }
    case ComponentType.StringSelect:
    case ComponentType.UserSelect:
    case ComponentType.RoleSelect:
    case ComponentType.MentionableSelect:
    case ComponentType.ChannelSelect:
      return `<div class="v2-select">${esc(n.placeholder ?? 'Menú')} ▾</div>`;
    case ComponentType.Thumbnail:
      return n.media
        ? `<img class="v2-thumb" src="${esc(n.media.url)}" alt="">`
        : '';
    case ComponentType.MediaGallery:
      return `<div class="v2-gallery">${(n.items ?? [])
        .map((it) => `<img src="${esc(it.media.url)}" alt="">`)
        .join('')}</div>`;
    case ComponentType.File: {
      const f = n.file ?? n.media;
      return f ? `<div class="att"><a href="${esc(f.url)}">📎 archivo</a></div>` : '';
    }
    default:
      return '';
  }
}

function renderComponents(components: readonly V2Node[]): string {
  return components.map(renderNode).join('');
}

export async function buildTranscript(
  channel: GuildTextBasedChannel,
): Promise<AttachmentBuilder> {
  const messages: {
    author: string;
    avatar: string;
    time: number;
    bodyHtml: string;
    isV2: boolean;
    attachments: { name: string; url: string }[];
  }[] = [];

  let before: string | undefined;
  for (let page = 0; page < 5; page++) {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });
    if (batch.size === 0) break;
    for (const m of batch.values()) {

      const isV2 = m.flags.has(MessageFlags.IsComponentsV2);
      const bodyHtml = isV2
        ? renderComponents(m.components as unknown as readonly V2Node[])
        : m.content
          ? fmtText(m.content)
          : '<i>(sin texto)</i>';
      messages.push({
        author: m.author.tag,
        avatar: m.author.displayAvatarURL({ size: 64, extension: 'png' }),
        time: m.createdTimestamp,
        bodyHtml,
        isV2,
        attachments: [...m.attachments.values()].map((a) => ({
          name: a.name ?? 'archivo',
          url: a.url,
        })),
      });
    }
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }

  messages.reverse();

  const rows = messages
    .map((m) => {
      const time = new Date(m.time).toLocaleString('es-ES');
      const atts = m.attachments.length
        ? `<div class="att">${m.attachments
            .map((a) => `<a href="${esc(a.url)}">📎 ${esc(a.name)}</a>`)
            .join(' · ')}</div>`
        : '';
      const inner = m.isV2 ? m.bodyHtml : `<div class="content">${m.bodyHtml}</div>`;
      return `<div class="msg"><img class="av" src="${esc(m.avatar)}" alt=""><div class="body"><div class="head"><span class="name">${esc(m.author)}</span><span class="time">${esc(time)}</span></div>${inner}${atts}</div></div>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcripción · #${esc(channel.name)}</title>
<style>
  body{margin:0;background:#1e1f22;color:#dbdee1;font:15px/1.4 -apple-system,Segoe UI,Roboto,sans-serif}
  header{padding:16px 24px;background:#2b2d31;border-bottom:1px solid #1e1f22}
  header h1{margin:0;font-size:18px}
  header p{margin:4px 0 0;color:#949ba4;font-size:13px}
  .msgs{padding:16px 24px;max-width:900px}
  .msg{display:flex;gap:12px;padding:8px 0}
  .av{width:40px;height:40px;border-radius:50%;flex:0 0 auto}
  .body{flex:1;min-width:0}
  .head{display:flex;gap:8px;align-items:baseline;margin-bottom:4px}
  .name{font-weight:600;color:#f2f3f5}
  .time{color:#949ba4;font-size:12px}
  .content{white-space:normal;word-wrap:break-word}
  .emoji{width:1.25em;height:1.25em;vertical-align:-0.2em;margin:0 1px}
  .mention{color:#c9cdfb;background:rgba(88,101,242,.3);border-radius:3px;padding:0 2px}
  .ts{color:#c9cdfb;background:rgba(88,101,242,.15);border-radius:3px;padding:0 3px}

  .v2-container{background:#2b2d31;border:1px solid #232428;border-left:4px solid #4e5058;border-radius:8px;padding:12px 16px;max-width:560px;margin:2px 0}
  .v2-text{white-space:normal;word-wrap:break-word;margin:2px 0}
  .v2-sep{border:none;border-top:1px solid #3f4147;margin:10px 0}
  .v2-space{height:8px}
  .v2-section{display:flex;gap:12px;align-items:flex-start}
  .v2-section-text{flex:1;min-width:0}
  .v2-acc{flex:0 0 auto}
  .v2-thumb{max-width:80px;border-radius:6px}
  .v2-gallery{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}
  .v2-gallery img{max-width:100%;border-radius:6px}
  .v2-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .v2-select{border:1px solid #3f4147;border-radius:4px;padding:6px 10px;color:#949ba4;max-width:280px}
  .v2-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:4px;font-size:14px;font-weight:500;color:#fff}
  .btn-primary{background:#5865f2}
  .btn-secondary{background:#4e5058}
  .btn-success{background:#248046}
  .btn-danger{background:#da373c}
  .btn-link{background:#4e5058;text-decoration:underline}
  .att{margin-top:6px}
  .att a{color:#00a8fc;text-decoration:none;font-size:13px}
</style></head><body>
<header><h1>#${esc(channel.name)}</h1><p>${messages.length} mensajes · generado ${esc(new Date().toLocaleString('es-ES'))}</p></header>
<div class="msgs">${rows}</div>
</body></html>`;

  return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
    name: `transcript-${channel.name}.html`,
  });
}
