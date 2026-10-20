import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "android-chromium", use: { ...devices["Pixel 7"],
      launchOptions: process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {} } },
    { name: "iphone-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: { command: "npm run preview", url: "http://localhost:4173/wolf-game/", reuseExistingServer: !process.env.CI },
});
