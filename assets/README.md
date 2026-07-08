# assets/

Coloca aquí el banner de bienvenida:

- **`banner.png`** — imagen ~1500×500. Se adjunta como `attachment://banner.png`
  en la tarjeta de bienvenida (Components V2, media gallery).

Si el archivo no existe, el bot **omite** el banner y el resto de la tarjeta se
envía igualmente (así el bot arranca sin fallar antes de que subas la imagen).

La ruta se resuelve como `<raíz-del-proyecto>/assets/banner.png`, así que
arranca siempre desde la raíz del repo (`pnpm dev` / `pnpm start`).
