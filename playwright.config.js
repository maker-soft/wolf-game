import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.WOLF_PORT || 4173);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "android-chromium", use: { ...devices["Pixel 7"],
      launchOptions: process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {} } },
    { name: "iphone-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: { command: "npm run preview", url: `http://localhost:${port}/wolf-game/`, reuseExistingServer: false },
});
