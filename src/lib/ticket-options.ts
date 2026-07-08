import type { Prisma, TicketField, TicketOption } from '@prisma/client';
import { TicketFieldStyle } from '@prisma/client';
import { prisma } from './prisma.js';

export type OptionWithFields = TicketOption & { fields: TicketField[] };

export const MAX_OPTIONS = 25;
export const MAX_FIELDS = 5;

export function getOptions(guildId: string): Promise<OptionWithFields[]> {
  return prisma.ticketOption.findMany({
    where: { guildId },
    orderBy: { position: 'asc' },
    include: { fields: { orderBy: { position: 'asc' } } },
  });
}

export function getOption(id: number): Promise<OptionWithFields | null> {
  return prisma.ticketOption.findUnique({
    where: { id },
    include: { fields: { orderBy: { position: 'asc' } } },
  });
}

export async function createOption(guildId: string): Promise<OptionWithFields> {
  const count = await prisma.ticketOption.count({ where: { guildId } });
  return prisma.ticketOption.create({
    data: { guildId, position: count, label: 'Nueva opción' },
    include: { fields: true },
  });
}

export async function updateOption(
  id: number,
  data: Prisma.TicketOptionUpdateInput,
): Promise<void> {
  await prisma.ticketOption.update({ where: { id }, data });
}

export async function deleteOption(id: number): Promise<void> {
  await prisma.ticketOption.delete({ where: { id } }).catch(() => {});
}

export async function addField(optionId: number): Promise<TicketField> {
  const count = await prisma.ticketField.count({ where: { optionId } });
  return prisma.ticketField.create({
    data: { optionId, position: count, label: 'Nueva pregunta' },
  });
}

export async function updateField(
  id: number,
  data: Prisma.TicketFieldUpdateInput,
): Promise<void> {
  await prisma.ticketField.update({ where: { id }, data });
}

export async function deleteField(id: number): Promise<void> {
  await prisma.ticketField.delete({ where: { id } }).catch(() => {});
}

export function parseStyle(input: string): TicketFieldStyle {
  const s = input.trim().toLowerCase();
  if (s.startsWith('p') || s.startsWith('l')) return TicketFieldStyle.PARAGRAPH;
  return TicketFieldStyle.SHORT;
}

export function parseRequired(input: string): boolean {
  const s = input.trim().toLowerCase();
  return !(s.startsWith('n') || s.startsWith('o') || s === 'false' || s === '0');
}

export function styleLabel(style: TicketFieldStyle): string {
  return style === TicketFieldStyle.PARAGRAPH ? 'párrafo' : 'corto';
}

export function sanitizeEmoji(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^<a?:\w{2,32}:\d{17,20}>$/.test(s)) return s;
  if (/\p{Extended_Pictographic}/u.test(s)) return s;
  return null;
}

const DEFAULT_OPTIONS: {
  label: string;
  emoji: string;
  description: string;
  fields: { label: string; style: TicketFieldStyle; required: boolean }[];
}[] = [
  {
    label: 'Soporte General',
    emoji: '🛠️',
    description: 'Dudas y problemas generales',
    fields: [
      { label: '¿Cuál es tu duda?', style: TicketFieldStyle.PARAGRAPH, required: true },
    ],
  },
  {
    label: 'Reporte usuario',
    emoji: '📣',
    description: 'Reportar a un usuario',
    fields: [
      { label: 'ID o nombre del usuario a reportar', style: TicketFieldStyle.SHORT, required: true },
      { label: 'Breve explicación', style: TicketFieldStyle.PARAGRAPH, required: true },
      { label: '¿Tienes pruebas? (Sí/No)', style: TicketFieldStyle.SHORT, required: true },
    ],
  },
  {
    label: 'Postulación',
    emoji: '📝',
    description: 'Únete al staff',
    fields: [
      { label: '¿Por qué quieres ser staff?', style: TicketFieldStyle.PARAGRAPH, required: true },
    ],
  },
  {
    label: 'Eventos',
    emoji: '🎉',
    description: 'Para creadores que quieren organizar eventos',
    fields: [
      { label: 'Enlace a tu red social principal (o redes)', style: TicketFieldStyle.SHORT, required: true },
      { label: 'Explica el evento que quieres organizar', style: TicketFieldStyle.PARAGRAPH, required: true },
    ],
  },
  {
    label: 'Otro',
    emoji: '❓',
    description: 'Cualquier otra cosa',
    fields: [
      { label: '¿En qué te podemos ayudar?', style: TicketFieldStyle.PARAGRAPH, required: true },
    ],
  },
];

export async function seedDefaultOptions(guildId: string): Promise<void> {
  for (const [i, opt] of DEFAULT_OPTIONS.entries()) {
    await prisma.ticketOption.create({
      data: {
        guildId,
        position: i,
        label: opt.label,
        emoji: opt.emoji,
        description: opt.description,
        fields: {
          create: opt.fields.map((f, j) => ({
            position: j,
            label: f.label,
            style: f.style,
            required: f.required,
          })),
        },
      },
    });
  }
}
