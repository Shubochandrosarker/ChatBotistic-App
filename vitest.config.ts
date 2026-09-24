import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit-test runner config. Tests target pure logic modules (no DOM,
// no network beyond deliberately-pinned localhost sockets in the
// URL-guard tests), so the lightweight Node environment is enough.
// The `@/*` alias mirrors tsconfig.json so source modules that import
// via the alias resolve the same way under test as under Next.js.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
