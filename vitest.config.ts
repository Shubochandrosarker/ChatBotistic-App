import { defineConfig } from "vitest/config";

// Unit-test runner config. Tests target pure logic modules (no DOM,
// no network), so the lightweight Node environment is enough.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
