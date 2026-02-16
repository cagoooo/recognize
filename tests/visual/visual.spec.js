import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        // Assume dev server is running on localhost:5173
        await page.goto('http://localhost:5173');
        // Wait for basic element to confirm load
        await page.waitForSelector('.aurora-bg', { timeout: 10000 });
    });

    test('Landing Page Snapshot', async ({ page }) => {
        // Build confidence with title check
        await expect(page).toHaveTitle(/識生學坊/);

        // Wait for brand logo which should be present
        await page.waitForSelector('.brand-logo-clay', { timeout: 10000 });

        await expect(page).toHaveScreenshot('landing-page.png', {
            maxDiffPixels: 300,
            fullPage: true
        });
    });
});
