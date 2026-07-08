# NionBot

Discord bot for a single community server: member welcomes/goodbyes and a full ticket system.

- Welcome and goodbye cards built with Discord Components V2 (containers, sections, media, separators), auto-roles, an optional welcome DM, and invite tracking ("invited by").
- Ticket system with a dropdown panel, per-option forms, staff claiming, inactivity auto-close reminders, and self-contained HTML transcripts.
- Transcripts open on demand through a small Vercel viewer (`web-transcript/`) using short-lived signed links.

Built with Sapphire on discord.js, TypeScript, Postgres (Prisma), Redis (BullMQ) and Pino.
