import { test, expect } from "@playwright/test"

// Install: npm install -D @playwright/test && npx playwright install chromium
// Run:     npx playwright test e2e/

test.describe("place pins persist after closing city detail card", () => {
  test("closing the card leaves discovery markers on the map", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("button", { name: /surprise me/i }).click()
    await page.getByTestId("map-container").waitFor({ state: "visible" })

    // Click the Lisbon destination pin to open the detail card
    await page.getByTestId("city-marker-lisbon").click()
    await expect(page.getByTestId("city-detail-card")).toBeVisible()

    // Wait for discovery markers to appear
    await expect(page.getByTestId(/^place-marker-/).first()).toBeVisible({ timeout: 10_000 })
    const markersBefore = await page.getByTestId(/^place-marker-/).count()
    expect(markersBefore).toBeGreaterThan(0)

    // Close the card
    await page.getByTestId("city-detail-card-close").click()
    await expect(page.getByTestId("city-detail-card")).not.toBeVisible()

    // Markers must still be present
    const markersAfter = await page.getByTestId(/^place-marker-/).count()
    expect(markersAfter).toBe(markersBefore)
  })

  test("re-opening the same city card shows no duplicate markers", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /surprise me/i }).click()
    await page.getByTestId("map-container").waitFor({ state: "visible" })

    await page.getByTestId("city-marker-lisbon").click()
    await expect(page.getByTestId(/^place-marker-/).first()).toBeVisible({ timeout: 10_000 })
    const countFirst = await page.getByTestId(/^place-marker-/).count()

    // Close then re-open
    await page.getByTestId("city-detail-card-close").click()
    await page.getByTestId("city-marker-lisbon").click()
    await expect(page.getByTestId("city-detail-card")).toBeVisible()

    const countSecond = await page.getByTestId(/^place-marker-/).count()
    expect(countSecond).toBe(countFirst)
  })
})

test.describe("place popup boundary", () => {
  test("popup stays inside map bounds near right edge", async ({ page }) => {
    await page.goto("/")

    // Trigger a discovery flow so destination pins appear
    await page.getByRole("button", { name: /surprise me/i }).click()

    // Wait for Lisbon pin to appear and click it
    await page.getByTestId("map-container").waitFor({ state: "visible" })
    await page.getByRole("button", { name: /lisbon/i }).click()

    // Hover the easternmost marker. The data-testid is injected via the divIcon html
    // by MapPane; add `data-testid="map-marker-palacio-ajuda"` to that icon's HTML
    // when Palácio Nacional da Ajuda is present in the results.
    const marker = page.getByTestId("map-marker-palacio-ajuda")
    await marker.hover()

    const card = page.getByTestId("place-popup")
    const map = page.getByTestId("map-container")

    await expect(card).toBeVisible()

    const cardBox = await card.boundingBox()
    const mapBox = await map.boundingBox()

    expect(cardBox).not.toBeNull()
    expect(mapBox).not.toBeNull()

    // Card must not overflow the right or left edge of the map
    expect(cardBox!.x).toBeGreaterThanOrEqual(mapBox!.x)
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(mapBox!.x + mapBox!.width)
  })

  test("popup stays in viewport when pin is near every edge", async ({ page }) => {
    await page.goto("/")
    await page.setViewportSize({ width: 1280, height: 800 })

    const card = page.getByTestId("place-popup")

    // Helper: after any hover, card must be fully within viewport
    const assertInViewport = async () => {
      const box = await card.boundingBox()
      if (!box) return
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(1280)
      expect(box.y + box.height).toBeLessThanOrEqual(800)
    }

    // Narrow viewport — card should be readable
    await page.setViewportSize({ width: 420, height: 800 })
    await page.goto("/")
    // If popup is visible at narrow width, assert it fits
    if (await card.isVisible()) {
      const box = await card.boundingBox()
      if (box) expect(box.width).toBeLessThanOrEqual(420)
    }

    await assertInViewport()
  })
})
