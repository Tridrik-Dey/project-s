import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0"
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("node_modules") === -1) return undefined;
          if (id.indexOf("react-router") !== -1) return "router-vendor";
          if (id.indexOf("react-dom") !== -1 || id.indexOf("/react/") !== -1) return "react-vendor";
          if (id.indexOf("lucide-react") !== -1) return "icons-vendor";
          return undefined;
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["tests/**", "node_modules/**", "dist/**"]
  }
});
