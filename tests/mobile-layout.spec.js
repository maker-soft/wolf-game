import { test, expect } from "@playwright/test";

const sizes = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 932, height: 430 },
  { width: 390, height: 844 },
];

async function tapChickens(page) {
  const canvas = await page.locator("#gameCanvas").boundingBox();
  // Include points near the outer edges of the original chicken hit zones.
  for (const [lane, x, y] of [[1, 3, 110], [2, 1445, 110], [3, 3, 870], [4, 1445, 870]]) {
    await page.touchscreen.tap(canvas.x + canvas.width * x / 1448, canvas.y + canvas.height * y / 1086);
    await expect(page.locator("#background")).toHaveAttribute("src", `./assets/wolf-pos-${lane}.webp`);
    await expect.poll(() => page.locator("#background").evaluate((img) => img.complete && img.naturalWidth)).toBe(960);
  }
}

async function checkLayout(page, viewport, safe = { top: 0, right: 0, bottom: 0, left: 0 }) {
  const stage = await page.locator("#stage").boundingBox();
  const canvas = await page.locator("#gameCanvas").boundingBox();
  expect(stage.x).toBeGreaterThanOrEqual(safe.left);
  expect(stage.y).toBeGreaterThanOrEqual(safe.top);
  expect(stage.x + stage.width).toBeLessThanOrEqual(viewport.width - safe.right + 1);
  expect(stage.y + stage.height).toBeLessThanOrEqual(viewport.height - safe.bottom + 1);
  expect(Math.abs(canvas.width / canvas.height - 4 / 3)).toBeLessThan(0.01);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  if (viewport.width > viewport.height) {
    await expect(page.locator(".sound-panel")).toBeHidden();
    await expect(page.locator(".offline-panel")).toBeHidden();
    const hud = await page.locator("#hud").boundingBox();
    expect(hud.height).toBeLessThanOrEqual(30);
    const blocks = await page.locator(".hud-block").evaluateAll((nodes) => nodes.map((node) => {
      const r = node.getBoundingClientRect();
      const label = node.querySelector(".hud-label").getBoundingClientRect();
      const value = node.querySelector("strong").getBoundingClientRect();
      return { y: r.y, labelY: label.y, valueY: value.y, valueHeight: value.height,
        left: r.left, right: r.right, labelLeft: label.left, valueRight: value.right };
    }));
    expect(new Set(blocks.map((b) => b.y)).size).toBe(1);
    for (const block of blocks) {
      expect(Math.abs(block.labelY - block.valueY)).toBeLessThan(8);
      expect(block.valueHeight).toBeLessThanOrEqual(22);
      expect(block.labelLeft).toBeGreaterThanOrEqual(block.left);
      expect(block.valueRight).toBeLessThanOrEqual(block.right);
    }
    const availableHeight = viewport.height - safe.top - safe.bottom - hud.height - 4;
    const largestHeight = Math.min(availableHeight, (viewport.width - safe.left - safe.right) * 3 / 4);
    expect(stage.height).toBeGreaterThanOrEqual(largestHeight - 2);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height);
  } else {
    await expect(page.locator(".sound-panel")).toBeVisible();
    await expect(page.locator(".offline-panel")).toBeVisible();
  }
}

for (const viewport of sizes) {
  test(`mobile layout and offline touch ${viewport.width}x${viewport.height}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/wolf-game/");
    await expect(page.locator("#offlineStatus")).toContainText("Готово к игре");
    await checkLayout(page, viewport);
    await tapChickens(page);
    await page.screenshot({ path: testInfo.outputPath("playing.png") });
    await context.setOffline(true);
    await page.close();
    const reopened = await context.newPage();
    await reopened.setViewportSize(viewport);
    await reopened.goto("/wolf-game/");
    await checkLayout(reopened, viewport);
    await tapChickens(reopened);
    expect(errors).toEqual([]);
  });
}

test("safe areas, dynamic height and rotation preserve touch and score", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.01; });
  await page.setViewportSize(sizes[0]);
  await page.goto("/wolf-game/");
  await expect(page.locator("#offlineStatus")).toContainText("Готово к игре");
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  // Model notch/home-indicator insets; desktop engines do not expose a real iPhone notch.
  const safe = { top: 0, right: 47, bottom: 21, left: 47 };
  await page.evaluate((insets) => {
    for (const [edge, px] of Object.entries(insets)) {
      document.documentElement.style.setProperty(`--safe-${edge}`, `${px}px`);
    }
  }, safe);
  await checkLayout(page, sizes[0], safe);
  // Select the upper left chicken and earn a real score before rotating.
  const canvas = await page.locator("#gameCanvas").boundingBox();
  await page.touchscreen.tap(canvas.x + canvas.width * 0.1, canvas.y + canvas.height * 0.25);
  await page.clock.runFor(7000);
  const score = await page.locator("#score").textContent();
  expect(Number(score)).toBeGreaterThanOrEqual(2);
  await tapChickens(page);
  for (const viewport of [sizes[3], { width: 844, height: 320 }, sizes[2]]) {
    await page.setViewportSize(viewport);
    await checkLayout(page, viewport, viewport.width > viewport.height ? safe : undefined);
    await expect(page.locator("#score")).toHaveText(score);
    await tapChickens(page);
  }
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.locator("#message")).toContainText("Пауза");
  await tapChickens(page);
  await expect(page.locator("#message")).toHaveClass(/hidden/);
});
