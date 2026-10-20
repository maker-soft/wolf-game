import { test, expect } from "@playwright/test";
import http from "node:http";
import { readFile } from "node:fs/promises";

const ready = (page) => expect(page.locator("#offlineStatus")).toContainText(/готово к игре|Готово к игре/);
const lanePoints = { 1: [0.1, 0.25], 2: [0.9, 0.25], 3: [0.1, 0.65], 4: [0.9, 0.65] };
async function tapLane(page, lane) {
  const stage = await page.locator("#stage").boundingBox();
  const [x, y] = lanePoints[lane];
  await page.touchscreen.tap(stage.x + stage.width * x, stage.y + stage.height * y);
}
async function openOffline(page, context, path = "/wolf-game/") {
  await page.goto(path);
  await ready(page);
  await context.setOffline(true);
  // A new document must be served by the worker, including query-string URLs.
  await page.goto(`${path}?debug`);
  await ready(page);
}

test("cold offline launch, all four local frames, sound preferences", async ({ page, context, baseURL }) => {
  const errors = [];
  const external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  context.on("request", (request) => {
    if (new URL(request.url()).origin !== baseURL) external.push(request.url());
  });
  await openOffline(page, context);
  await expect(page.locator("#volume")).toHaveValue("55");
  for (const lane of [1, 2, 3, 4]) {
    await tapLane(page, lane);
    await expect(page.locator("#background")).toHaveAttribute("src", `./assets/wolf-pos-${lane}.webp`);
    await expect.poll(() => page.locator("#background").evaluate((img) => img.complete && img.naturalWidth)).toBe(960);
  }
  await page.locator("#soundToggle").click();
  await page.locator("#volume").fill("73");
  // Closing the tab removes the document and its memory. Reopen while offline.
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/wolf-game/");
  await ready(reopened);
  await expect(reopened.locator("#volume")).toHaveValue("73");
  await expect(reopened.locator("#soundToggle")).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("offline catching, level, pause, misses, game over and restart", async ({ page, context }) => {
  await page.addInitScript(() => { Math.random = () => 0.01; });
  await openOffline(page, context);
  await page.clock.install();
  await tapLane(page, 1);
  await page.clock.runFor(17000);
  expect(Number(await page.locator("#score").textContent())).toBeGreaterThanOrEqual(10);
  await expect(page.locator("#level")).toHaveText("2");
  await page.locator("#pauseToggle").click();
  const score = await page.locator("#score").textContent();
  const lives = await page.locator("#lives").textContent();
  await page.clock.runFor(10000);
  await expect(page.locator("#score")).toHaveText(score);
  await expect(page.locator("#lives")).toHaveText(lives);
  await expect(page.locator("#pauseToggle")).toHaveText("Продолжить");
  await tapLane(page, 4);
  await page.clock.runFor(12000);
  await expect(page.locator("#message")).toContainText("Игра окончена");
  await expect(page.locator("#lives")).toHaveText("—");
  await tapLane(page, 1);
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#lives")).toHaveText("🥚🥚🥚");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.locator("#pauseToggle")).toHaveText("Продолжить");
  await page.clock.runFor(10000);
  await expect(page.locator("#lives")).toHaveText("🥚🥚🥚");
});

test("root installation and mobile portrait/landscape layout", async ({ page, context }) => {
  await openOffline(page, context, "/");
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    const stage = await page.locator("#stage").boundingBox();
    expect(stage.x).toBeGreaterThanOrEqual(0);
    expect(stage.y + stage.height).toBeLessThanOrEqual(viewport.height);
    expect(stage.x + stage.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await tapLane(page, 3);
    await expect(page.locator("#background")).toHaveAttribute("src", "./assets/wolf-pos-3.webp");
  }
});

test("blocked storage does not break offline gameplay", async ({ page, context }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  });
  await openOffline(page, context);
  await tapLane(page, 2);
  await page.locator("#soundToggle").click();
  await expect(page.locator("#soundToggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#message")).toHaveClass(/hidden/);
});

async function fixtureServer(faults) {
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (faults.missingFrame && pathname.endsWith("wolf-pos-4.webp")) { response.writeHead(404).end(); return; }
    try {
      const file = pathname === "/" ? "index.html" : pathname.slice(1);
      const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".html") ? "text/html" : "application/octet-stream";
      let bytes = await readFile(new URL(`../dist/${file}`, import.meta.url));
      if (file === "sw.js" && faults.update) {
        bytes = bytes.toString().replace(/const VERSION = "[^"]+"/, 'const VERSION = "failed-update-test"');
      }
      response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      response.end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://localhost:${server.address().port}/`, close: () => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }) };
}

test("incomplete initial download never announces offline readiness", async ({ page }) => {
  // A real 404 also exercises worker downloads in WebKit (no route mocking).
  const server = await fixtureServer({ missingFrame: true });
  try {
    await page.goto(server.url);
    await expect(page.locator("#offlineStatus")).toContainText("Не удалось сохранить игру");
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(false);
  } finally {
    await server.close();
  }
});

test("failed update preserves the complete installed version", async ({ page, context }) => {
  const faults = { missingFrame: false, update: false };
  const server = await fixtureServer(faults);
  try {
    await page.goto(server.url);
    await ready(page);
    const oldController = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL);
    faults.missingFrame = true;
    faults.update = true;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
      const worker = registration.installing;
      if (worker && worker.state !== "redundant") {
        await new Promise((resolve) => worker.addEventListener("statechange", () => {
          if (worker.state === "redundant") resolve();
        }));
      }
    });
    expect(await page.evaluate(() => navigator.serviceWorker.controller.scriptURL)).toBe(oldController);
    await context.setOffline(true);
    await page.reload();
    await ready(page);
    await tapLane(page, 4);
    await expect.poll(() => page.locator("#background").evaluate((img) => img.complete && img.naturalWidth)).toBe(960);
  } finally { await server.close(); }
});

test("missing cached frame is reported offline and repaired online", async ({ page, context }) => {
  await page.goto("/wolf-game/");
  await ready(page);
  await page.evaluate(async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(`wolf-game:${location.origin}/wolf-game/:`)) {
        await (await caches.open(key)).delete(new URL("./assets/wolf-pos-4.webp", location.href).href);
      }
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#offlineStatus")).toContainText("Не удалось сохранить игру");
  await context.setOffline(false);
  await page.reload();
  await ready(page);
  await context.setOffline(true);
  await tapLane(page, 4);
  await expect.poll(() => page.locator("#background").evaluate((img) => img.complete && img.naturalWidth)).toBe(960);
});
