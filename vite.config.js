import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

/* base: "./" — чтобы сайт работал и в корне домена, и в подпапке
   (нужно для GitHub Pages вида username.github.io/pro-crm/) */
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      /* при сборке автоматически создаём 404.html (копию index.html)
         для корректной работы SPA на GitHub Pages при обновлении страницы */
      name: "copy-404",
      closeBundle() {
        const from = resolve(__dirname, "dist/index.html");
        const to = resolve(__dirname, "dist/404.html");
        if (existsSync(from)) copyFileSync(from, to);
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
