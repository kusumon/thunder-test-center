import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit test (Vitest). Jalankan: `npm test`.
 * - Alias `@/` sama dengan tsconfig.
 * - `server-only` diganti stub kosong: di luar Next.js paket itu sengaja
 *   melempar error, padahal yang diuji di sini logika murninya.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
