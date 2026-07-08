# Nion Studio

Bot de Discord de **bienvenidas y despedidas** para un servidor. Da la bienvenida a los nuevos
miembros con **Components V2** (los nuevos componentes de Discord: `Container`, `Section`,
`TextDisplay`, `Thumbnail`, `MediaGallery`, `Separator`), asigna auto-roles, envía un DM opcional y
publica un mensaje de despedida cuando alguien se va.

La tarjeta de bienvenida incluye: saludo + avatar (thumbnail), **banner** (`assets/banner.png`),
y una línea con la **fecha de creación de la cuenta** (`<t:…:R>`) y **quién invitó** al miembro
(rastreo de invitaciones). El saludo es editable por plantilla; el resto de la estructura es fija.

Es un proceso persistente conectado al **gateway** de Discord (no serverless).

## Stack

| Área          | Tecnología                                                    |
| ------------- | ------------------------------------------------------------- |
| Framework bot | [Sapphire](https://sapphirejs.dev) sobre **discord.js v14.16+** |
| Lenguaje      | **TypeScript strict** (ESM, `NodeNext`)                       |
| Base de datos | **Postgres 16** vía **Prisma**                                |
| Cola / cache  | **Redis 7** + **BullMQ** (envíos con reintentos)              |
| Logging       | **Pino** (`pino-pretty` en dev)                               |
| Validación    | **Zod** (variables de entorno)                                |
| Infra local   | **Docker Compose** (solo Postgres + Redis)                    |
| Gestor        | **pnpm** · dev con **tsx**                                    |

## Arranque rápido

```bash
pnpm install
cp .env.example .env          # rellena DISCORD_TOKEN y DISCORD_APP_ID
docker compose up -d          # levanta Postgres + Redis
pnpm db:push                  # crea el schema en Postgres
pnpm dev                      # arranca el bot (tsx watch)
```

Requisitos previos: **Node 20+**, **pnpm**, y **Docker Desktop en marcha**.

### Configuración de la app de Discord
En el [Developer Portal](https://discord.com/developers/applications):
1. Crea la aplicación y un bot; copia el **token** → `DISCORD_TOKEN` y el **Application ID** → `DISCORD_APP_ID`.
2. Activa el **Server Members Intent** (privilegiado) en *Bot → Privileged Gateway Intents*.
   Es imprescindible: sin él no llegan los eventos de entrada/salida de miembros.
3. Invita el bot con los scopes `bot applications.commands` y permisos para gestionar roles y enviar mensajes.

## Scripts

| Script              | Acción                                        |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Arranca en modo watch con tsx                 |
| `pnpm build`        | Compila a `dist/` con `tsc`                   |
| `pnpm start`        | Ejecuta el build (`node dist/index.js`)       |
| `pnpm typecheck`    | `tsc --noEmit`                                |
| `pnpm db:generate`  | Genera el cliente Prisma                       |
| `pnpm db:push`      | Aplica el schema a Postgres                    |
| `pnpm db:studio`    | Abre Prisma Studio                             |
| `pnpm infra:up`     | `docker compose up -d`                         |
| `pnpm infra:down`   | `docker compose down`                          |

## Estructura

```
src/
├── index.ts                     # Bootstrap del SapphireClient + apagado ordenado
├── lib/
│   ├── env.ts                   # Validación zod de process.env (falla rápido)
│   ├── logger.ts                # Instancia Pino
│   ├── prisma.ts                # Singleton PrismaClient
│   ├── redis.ts                 # Conexión ioredis (compartida con BullMQ)
│   ├── config.ts                # get/updateGuildConfig (cacheado) + renderTemplate
│   ├── emojis.ts                # IDs de emojis personalizados (cambiar aquí al migrarlos)
│   ├── invites.ts               # Rastreo de invitaciones ("Invited by")
│   ├── duration.ts              # parseDuration/humanizeDuration (recordatorio)
│   ├── ticket-config.ts         # get/updateTicketConfig (cacheado) + siembra opciones al crear
│   ├── ticket-options.ts        # CRUD de TicketOption/TicketField + siembra + parseStyle/Required
│   ├── tickets.ts               # open/close/claim/reopen/delete/setReminder + publishTicketPanel
│   ├── transcript.ts            # buildTranscript (HTML autocontenido del ticket)
│   ├── components/welcome-card.ts  # buildWelcomeCard (diseño rico) + buildSimpleCard
│   ├── components/ticket-panel.ts  # buildTicketPanel (dropdown) + buildFormModal + controles + modal recordatorio
│   └── queue/
│       ├── welcome.queue.ts     # Cola BullMQ + tipos de job
│       ├── welcome.worker.ts    # Worker: mensaje, auto-rol, DM, despedida
│       ├── ticket.queue.ts      # Cola BullMQ del auto-cierre por inactividad
│       └── ticket.worker.ts     # Worker: cierra tickets cuyo recordatorio expiró
├── listeners/                   # Auto-cargados por Sapphire
│   ├── ready.ts                 # Log + arranca workers + cachea invites + recarga recordatorios
│   ├── guildMemberAdd.ts        # Resuelve invitador + encola job 'welcome'
│   ├── guildMemberRemove.ts     # Encola job 'goodbye'
│   ├── guildCreate.ts           # Cachea invites de un guild nuevo
│   ├── inviteCreate.ts          # Actualiza cache de invites
│   ├── inviteDelete.ts          # Actualiza cache de invites
│   └── messageCreate.ts         # Cancela el auto-cierre si el abridor responde
├── interaction-handlers/        # Auto-cargados por Sapphire
│   ├── welcomeConfigButton.ts   # Botones del panel (abren modales / toggle)
│   ├── welcomeConfigChannel.ts  # Select de canal del panel
│   ├── welcomeConfigModal.ts    # Modales del panel (descripción, color, …)
│   ├── ticketButton.ts          # Botones runtime del ticket (close/claim/remind/reopen/…)
│   ├── ticketOpenSelect.ts      # Desplegable público → muestra el formulario de la opción
│   ├── ticketFormModal.ts       # Envío del formulario → abre el ticket con respuestas
│   ├── ticketReminderModal.ts   # Modal del recordatorio → setReminder
│   ├── ticketConfigButton.ts    # Botones vista principal de config (modales/publicar/crear/añadir opción)
│   ├── ticketConfigSelect.ts    # Selects vista principal (staff, categoría, transcript, panel, editar opción)
│   ├── ticketConfigModal.ts     # Modales vista principal (mensaje panel, nombre dropdown, apertura)
│   ├── ticketOptionButton.ts    # Botones del editor de opción (editar/añadir campo/eliminar/volver)
│   ├── ticketOptionSelect.ts    # Selects del editor de opción (categoría, staff, editar/eliminar campo)
│   └── ticketOptionModal.ts     # Modales del editor de opción (textos de la opción, campo)
└── commands/config/config.ts    # Slash command /config (auto-cargado)

Panel de bienvenida: `src/lib/components/welcome-config.ts` (preview + botones + select + modales).
Panel de tickets: `src/lib/components/ticket-config.ts` (vista principal + editor de opción + modales).

Assets: `assets/banner.png` (imagen ~1500×500 del banner de bienvenida; si falta, se omite).
```

## Convenciones

- **ESM estricto:** los imports relativos llevan extensión `.js` (aunque el fichero sea `.ts`),
  requisito de `moduleResolution: NodeNext`.
- **TypeScript strict** + `noUncheckedIndexedAccess`. Nada de `any` implícito.
- **Sapphire auto-carga** todo lo que haya en `src/commands`, `src/listeners` (y demás stores).
  Para añadir un comando o listener, crea un archivo que exporte una clase que extienda
  `Command` / `Listener`; no hay que registrarlo a mano.
- **`baseUserDirectory` (importante):** bajo ESM/tsx no existe `require.main`, así que Sapphire
  detectaría la raíz como el cwd y **no encontraría las piezas** de `src/`. En `src/index.ts` se
  fija `baseUserDirectory: fileURLToPath(new URL('.', import.meta.url))`. No lo quites.
- **Carga de `.env`:** el runtime no lee `.env` por su cuenta; los scripts `dev`/`start` usan
  `node --env-file=.env`. Si arrancas a mano, pásalo tú.
- Los **slash commands se registran globalmente**; pueden tardar hasta ~1 h en aparecer en el
  cliente de Discord. Para iterar rápido, registra por guild (idHints / guildIds).
- **Nada de trabajo pesado en los listeners.** Los eventos solo **encolan** un job en BullMQ; el
  envío real (que puede fallar por rate-limit o DMs cerrados) lo hace el worker con
  `attempts: 3` + backoff exponencial.
- **Components V2:** todo mensaje construido con `buildCard()` se envía con
  `flags: MessageFlags.IsComponentsV2` (ya incluido en el payload que devuelve).
- **Config por servidor** en la tabla `guild_config` (modelo `GuildConfig`), editable con
  `/config`. Se cachea en memoria y la cache se invalida al escribir.
- **Placeholders** de las plantillas: texto `{user}` (mención) · `{username}` · `{server}` ·
  `{count}` / `{new_member_count}` (nº de miembro, con separador de miles) · `{creation_date}` ·
  `{invited_by}`; emojis `{e:icon}` `{e:user}` `{e:creation}` `{e:invited}`.
- **`/config welcome` es un panel interactivo** (efímero): muestra una vista previa de la tarjeta
  (con quien ejecuta como ejemplo) y botones para editar cada parte —Descripción, Color (vacío = sin
  acento), Thumbnail (`{user}`, URL o vacío), y "Fecha / Invited by" (modal con dos campos:
  `{creation_date}` y `{invited_by}` insertan los datos reales)— más Activar/Desactivar y un select
  de canal. Los cambios se guardan en `GuildConfig` y el panel se re-renderiza en el acto. El resto
  de subcomandos (`dm`, `goodbye`, `autorole`, `show`) siguen con opciones.
- **Emojis personalizados:** definidos en `src/lib/emojis.ts`. Los IDs apuntan al servidor de
  pruebas; al mover los emojis al bot, actualiza **solo ese archivo**.
- **Rastreo de invitaciones ("Invited by"):** `src/lib/invites.ts` cachea los usos de cada invite
  (al arrancar, en `inviteCreate`/`inviteDelete` y al entrar el bot en un guild) y en
  `guildMemberAdd` compara para deducir el invitador. Requiere el intent **`GuildInvites`** y que el
  bot tenga el permiso **"Gestionar servidor" (ManageGuild)** en el guild; sin él, "Invited by"
  muestra `desconocido`.

## Sistema de tickets

- **Panel público = desplegable, no botón.** El mensaje publicado (`buildTicketPanel`) muestra
  `panelMessage` + un **StringSelect** cuyo placeholder es `dropdownPlaceholder` y cuyas opciones son
  las filas `TicketOption`. Al elegir una opción se abre **su formulario** (modal construido en caliente
  desde sus `TicketField`); al enviarlo se abre el ticket y se publican las respuestas dentro del canal.
- **Modelo de datos:** `TicketConfig` (tabla `ticket_config`, cacheada) guarda los **valores por
  defecto** (staff, categoría, `openMessage`, transcripciones, canal del panel, `dropdownPlaceholder`,
  `panelMessage`, `counter`). Cada `TicketOption` (`ticket_option`) tiene `label`, `emoji?`,
  `description?` y overrides opcionales `categoryId?`/`staffRoleId?`/`openMessage?`. Cada `TicketField`
  (`ticket_field`) tiene `label`, `style` (`SHORT|PARAGRAPH`) y `required`. CRUD + siembra en
  `src/lib/ticket-options.ts`.
- **Fallback:** al abrir, cada ajuste usa `option.campo ?? config.campo`. El rol de staff efectivo se
  guarda en `Ticket.staffRoleId` y es el que usan claim/reopen/permisos (`isStaff(member, roleId)`).
- **Siembra:** la primera vez que se crea la config de un guild (`getTicketConfig`) se siembran 5
  opciones de ejemplo (Soporte General, Reporte usuario, Postulación, Eventos, Otro) con sus campos.
  No se regeneran si el admin las borra.
- **`/config ticket` = un solo mensaje efímero con dos vistas** (`src/lib/components/ticket-config.ts`):
  - *Principal:* preview + botones (Mensaje del panel · Nombre del desplegable · Mensaje de apertura por
    defecto · ➕ Añadir opción · Publicar/Republicar · Crear canal) + select "✏️ Editar opción" + selects
    por defecto (staff, categoría, transcripciones, canal del panel).
  - *Editor de opción:* resumen + campos · botones (Editar textos · ➕ Añadir campo · 🗑️ Eliminar opción ·
    ⬅️ Volver) · selects override (categoría, staff) · selects "✏️/🗑️ campo". **Editar un campo = un
    modal** con `Etiqueta`, `Tipo` (`corto`/`parrafo`) y `Obligatorio` (`si`/`no`), parseados con
    tolerancia (`parseStyle`/`parseRequired`). El emoji se sanea con `sanitizeEmoji`.
  - Límites de Discord: **25 opciones** y **5 campos** por opción.
- **Publicar el panel:** `publishTicketPanel` (en `src/lib/tickets.ts`) edita el mensaje anterior si
  sigue existiendo (guarda `panelMessageId`) o envía uno nuevo. "Crear canal nuevo" crea un
  `#abrir-ticket` bajo la categoría por defecto y publica ahí.
- **Un ticket abierto por usuario.** `openTicket(guild, opener, config, option, answers)` crea el canal
  (`ticket-NNNN`, contador atómico), fija permisos (everyone denegado; abridor y staff efectivo con
  acceso), registra la fila `Ticket` y publica el **mensaje de apertura** (`buildTicketOpenMessage`).
- **Mensaje de apertura = Components V2** (`flags: IsComponentsV2`): un `Container` con el saludo
  (`openMessage` con `{user}`/`{server}`), un separador, la línea `{compass} **Tiempo de respuesta**・
  {responseTime}` y, si hay, el bloque de respuestas del formulario; y un segundo `Container` con los
  botones **Cerrar ticket / Atender / Recordatorio** (emojis `cross`/`claim`/`compass` de `emojis.ts`).
  El **tiempo de respuesta** es configurable: `TicketConfig.responseTime` (por defecto) + override
  `TicketOption.responseTime`. Reabrir usa `buildReopenMessage` (mismo estilo en contenedor).
- **Reclamar** (`claimTicket`) quita `SendMessages` al rol de staff efectivo y se lo deja a quien reclama.
- **Recordatorio:** el botón abre un modal (tiempo tipo `30m`/`2h`/`1d`/`1h30m`, `src/lib/duration.ts`);
  `setReminder` encola un job de auto-cierre en BullMQ (cola `ticket`) y avisa al abridor. Si el abridor
  responde, el listener `messageCreate` cancela el job (mapa en memoria `activeReminders`). Requiere el
  intent **`GuildMessages`**.
- **Cerrar** no borra el canal: muestra controles **Reabrir/Transcribir/Borrar**. "Transcribir" genera
  un HTML autocontenido (`src/lib/transcript.ts`) y lo envía al canal de transcripciones.
- **customIds:** `tkt:open` (desplegable público) · `tktf:<optId>` (formulario) · `tkt:*` (runtime del
  ticket) · `tktm:remind` (modal recordatorio) · `tcfg:*`/`tcfgm:*` (vista principal de config) ·
  `topt:*`/`toptm:*` (editor de opción). Handlers en `src/interaction-handlers/ticket*.ts`.

## Variables de entorno

Ver `.env.example`. Claves: `DISCORD_TOKEN`, `DISCORD_APP_ID`, `DATABASE_URL`,
`REDIS_HOST`/`REDIS_PORT`, `POSTGRES_*`, `NODE_ENV`, `LOG_LEVEL`.
