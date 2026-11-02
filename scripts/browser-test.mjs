import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";

const root = resolve("out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const artifacts = process.env.ARTIFACT_DIR || "test-results";
let server;
let browser;
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

async function localServer() {
  server = createServer(async (request, response) => {
    let path = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (basePath && !path.startsWith(`${basePath}/`)) {
      response.writeHead(404).end();
      return;
    }
    if (basePath) path = path.slice(basePath.length);
    if (path.endsWith("/")) path += "index.html";
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(`${root}/`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      response.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
      });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return `http://127.0.0.1:${server.address().port}${basePath}/`;
}

try {
  await mkdir(artifacts, { recursive: true });
  const url = process.env.BASE_URL || (await localServer());
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [],
    failures = [],
    external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin !== new URL(url).origin) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(page.locator(".loader")).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByTestId("age")).toHaveText("Today");
  await expect(
    page.getByRole("img", { name: /Interactive Earth globe/ }),
  ).toBeVisible();
  const before = await page.screenshot({ path: `${artifacts}/desktop.png` });
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await page.mouse.move(920, 450, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await page.screenshot();
  assert.ok(!before.equals(after), "Dragging must change the globe rendering");

  const timeline = page.getByRole("slider", { name: "Geological age" });
  await timeline.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("age")).not.toHaveText("Today");
  await page.keyboard.press("Home");
  await expect(page.getByTestId("age")).toHaveText("4.57 Ga");
  await page.keyboard.press("End");
  await expect(page.getByTestId("age")).toHaveText("Today");
  const bounds = await timeline.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + 27);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + 27, {
    steps: 8,
  });
  await page.mouse.up();
  assert.ok(
    Number(await timeline.getAttribute("aria-valuenow")) > 100,
    "Dragging the timeline changes age",
  );
  await page
    .getByRole("button", { name: "Chapter: One immense landmass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "One immense landmass" }),
  ).toBeVisible();
  await expect(page.getByTestId("age")).toHaveText("260 Ma");
  await expect(page.locator(".evidence-grid")).toContainText("°C");
  await page.screenshot({ path: `${artifacts}/chapter.png` });
  await page.getByRole("button", { name: "Next chapter", exact: true }).click();
  await expect(page.getByTestId("age")).toHaveText("252 Ma");
  await page
    .getByRole("button", { name: "Previous chapter", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close chapter", exact: true })
    .click();
  await expect(page.locator(".chapter-panel")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Where was my city?", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "Search a place" }).fill("London");
  await page
    .locator(".suggestions button")
    .filter({ hasText: "United Kingdom" })
    .first()
    .click();
  await expect(page.locator(".city-result")).toContainText("Plate");
  await page
    .locator(".city-milestones button")
    .filter({ hasText: "400 Ma" })
    .click();
  await expect(page.getByTestId("age")).toHaveText("400 Ma");
  await expect(page.locator(".selected-place")).toContainText("London");
  await page.screenshot({ path: `${artifacts}/city.png` });
  await page.getByRole("button", { name: "Close city search" }).click();

  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByLabel("Paleoclimate curves").check();
  await expect(page.locator(".climate-curves")).toBeVisible();
  await page.getByLabel("Fossil occurrences").check();
  await page.getByLabel("Modern coastlines").check();
  await page.getByLabel("Ice extent").uncheck();
  await page.screenshot({ path: `${artifacts}/layers.png` });
  await page.getByRole("button", { name: "Close layers" }).click();
  await page.getByRole("button", { name: "Play forward", exact: true }).click();
  const start = Number(await timeline.getAttribute("aria-valuenow"));
  await page.waitForTimeout(700);
  await page
    .getByRole("button", { name: "Pause playback", exact: true })
    .click();
  assert.ok(
    Number(await timeline.getAttribute("aria-valuenow")) < start,
    "Playback travels toward the present",
  );
  await page.getByRole("button", { name: "Enable ambient sound" }).click();
  await expect(
    page.getByRole("button", { name: "Mute sound" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mute sound" }).click();
  await page.getByRole("button", { name: "Sources and method" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("22,849");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Share this view" }).click();
  await expect(page.locator(".toast, .share-card")).toBeVisible();
  const sharedLink = (await page.locator(".share-card input").count())
    ? await page.locator(".share-card input").inputValue()
    : page.url();
  const shared = new URL(sharedLink);
  assert.ok(shared.searchParams.get("layers")?.includes("coastlines"));

  await page.goto(
    `${url}?age=700&chapter=snowball&city=London&country=United+Kingdom&layers=curves,ice`,
    { waitUntil: "networkidle" },
  );
  await expect(page.getByTestId("age")).toHaveText("700 Ma");
  await expect(
    page.getByRole("heading", { name: "An almost frozen planet" }),
  ).toBeVisible();
  await expect(page.locator(".climate-curves")).toBeVisible();
  await page.screenshot({ path: `${artifacts}/snowball.png` });
  await page.goto(`${url}?age=not-a-number`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("age")).toHaveText("Today");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("age")).toHaveText("Today");
  assert.deepEqual(external, [], "Every runtime asset must be same-origin");
  assert.deepEqual(failures, [], "No missing local assets");
  assert.deepEqual(errors, [], "No browser JavaScript errors");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${artifacts}/mobile.png` });
  await page
    .getByRole("button", {
      name: "Chapter: An explosion of animal worlds",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "An explosion of animal worlds" }),
  ).toBeVisible();
  await expect
    .poll(
      async () => {
        const panel = await page.locator(".chapter-panel").boundingBox();
        return panel !== null && panel.x >= 0 && panel.x + panel.width <= 391;
      },
      { message: "Mobile chapter fits viewport after its entrance animation" },
    )
    .toBe(true);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal page overflow",
  );
  await page.screenshot({ path: `${artifacts}/mobile-chapter.png` });
  await page.getByRole("button", { name: "Close chapter" }).click();
  await page
    .getByRole("button", { name: "Where was my city?", exact: true })
    .click();
  await expect(
    page.getByRole("searchbox", { name: "Search a place" }),
  ).toBeFocused();
  await page
    .getByRole("searchbox", { name: "Search a place" })
    .fill("no-such-city-zzzz");
  await expect(page.locator(".no-results")).toContainText("No matching city");
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log(
    `Browser checks passed: desktop/mobile, globe rotation, timelines, chapters, city reconstruction, layers, playback, audio, sources, share, deep links, and same-origin assets.\nTarget: ${url}`,
  );
} finally {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
}
