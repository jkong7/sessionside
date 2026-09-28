import { defineConfig, devices } from "@playwright/test";

const PORT = 3401;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `rm -f data/e2e.db data/e2e.db-wal data/e2e.db-shm && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { SESSIONSIDE_DB: "data/e2e.db", SESSIONSIDE_ENGINE: "local", SESSIONSIDE_INSECURE_COOKIES: "1" },
  },
});
