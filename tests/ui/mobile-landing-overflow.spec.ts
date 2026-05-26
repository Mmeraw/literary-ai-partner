import { expect, test } from "@playwright/test";

const landingRoutes = [
  "/",
  "/pricing",
  "/revise",
  "/agent-readiness",
  "/storygate-studio",
  "/resources",
  "/black-box-problem",
  "/methodology",
  "/reliability",
  "/privacy-research-controls",
  "/security",
  "/genre-classification-faq",
  "/storygate-studio/faq",
  "/agent-readiness/faq",
];

test.describe("mobile landing page overflow guard", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of landingRoutes) {
    test(`${route} does not create page-level horizontal scroll`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const metrics = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));

      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    });
  }
});
