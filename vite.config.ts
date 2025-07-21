import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/high-word/",
  plugins: [tsconfigPaths(), tailwindcss()],
});
