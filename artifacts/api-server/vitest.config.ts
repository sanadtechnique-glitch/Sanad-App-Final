import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbRoot    = path.resolve(__dirname, "../../lib/db/src");

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**"],
    },
    pool: "forks",
  },
  resolve: {
    alias: [
      // Must come before the bare `@workspace/db` alias
      { find: /^@workspace\/db\/(.+)$/, replacement: `${dbRoot}/$1/index.ts` },
      { find: "@workspace/db",          replacement: `${dbRoot}/index.ts`     },
    ],
  },
});
