import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // Plain string templates below need the runtime+compiler build, not
    // Vite's default runtime-only "vue" resolution (which assumes .vue SFC
    // files pre-compiled by @vitejs/plugin-vue).
    alias: { vue: "vue/dist/vue.esm-bundler.js" },
  },
});
