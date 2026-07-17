import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const erpOutDir = "dist/erp";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["pdfjs-dist"],
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
  build: {
    outDir: erpOutDir,
    commonjsOptions: {
      include: [/pdfjs-dist/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
}));
