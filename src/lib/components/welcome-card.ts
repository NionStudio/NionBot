import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AttachmentBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';

export const ACCENT = {
  welcome: 0x5865f2,
  goodbye: 0xed4245,
} as const;

const BANNER_PATH = resolve(process.cwd(), 'assets', 'banner.png');
const BANNER_NAME = 'banner.png';

const SPACER = '⠀'.repeat(8);

function getBanner(): AttachmentBuilder | null {
  if (!existsSync(BANNER_PATH)) return null;
  return new AttachmentBuilder(BANNER_PATH, { name: BANNER_NAME });
}

export interface WelcomeCardOptions {

  greeting: string;

  thumbnailUrl: string | null;

  accentColor: number | null;

  creationLine: string;

  invitedLine: string;
}

export function buildWelcomeCard(options: WelcomeCardOptions) {
  const banner = getBanner();
  const container = new ContainerBuilder();

  if (options.accentColor !== null) {
    container.setAccentColor(options.accentColor);
  }

  if (options.thumbnailUrl) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(options.greeting),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(options.thumbnailUrl)
            .setDescription('Avatar'),
        ),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(options.greeting),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  if (banner) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(`attachment://${BANNER_NAME}`),
      ),
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
    );
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${options.creationLine}${SPACER}${options.invitedLine}`,
    ),
  );

  return {
    components: [container],
    files: banner ? [banner] : [],
    flags: MessageFlags.IsComponentsV2,
  } as const;
}

export interface SimpleCardOptions {
  title: string;
  body: string;
  avatarUrl: string;
  accentColor: number;
}

export function buildSimpleCard(options: SimpleCardOptions) {
  const container = new ContainerBuilder()
    .setAccentColor(options.accentColor)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${options.title}`),
          new TextDisplayBuilder().setContent(options.body),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(options.avatarUrl).setDescription('Avatar'),
        ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  } as const;
}
