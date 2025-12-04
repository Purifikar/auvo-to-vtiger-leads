import { chromium } from '@playwright/test';
import { LoginPage } from '../src/pages/login.page';
import dotenv from 'dotenv';

dotenv.config();

async function captureFormLabels() {
    console.log('Capturing form labels...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        const loginPage = new LoginPage(page);

        // Login
        console.log('Logging in...');
        await loginPage.goto();
        await loginPage.login(
            process.env.CRM_USERNAME || '',
            process.env.CRM_PASSWORD || ''
        );

        // Navigate to Leads
        console.log('Navigating to Leads...');
        await page.getByRole('link', { name: 'Leads' }).click();
        await page.waitForURL('**/index.php?module=Leads&view=List', { timeout: 20000 });

        // Click Add Lead
        const addButton = page.getByRole('button', { name: 'Adicionar Lead' });
        await addButton.waitFor({ state: 'visible', timeout: 20000 });
        await addButton.click();

        // Wait for form
        await page.locator('#Leads_editView_fieldName_company').waitFor({
            state: 'visible',
            timeout: 20000,
        });

        // Take screenshot of the full page
        console.log('Taking screenshot...');
        await page.screenshot({ path: 'form-screenshot-full.png', fullPage: true });
        console.log('Screenshot saved: form-screenshot-full.png');

        // Scroll down to see more fields
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.screenshot({ path: 'form-screenshot-scrolled.png', fullPage: false });
        console.log('Screenshot saved: form-screenshot-scrolled.png');

        // Try to get the exact label texts
        console.log('\n=== FIELD LABELS FOUND ===');
        const labels = await page.locator('td').filter({ hasText: /lead|uf|cidade|status|fonte|responsavel|responsável/i }).allTextContents();
        labels.forEach((label, i) => {
            console.log(`${i + 1}. "${label.trim()}"`);
        });

        console.log('\nDone! Check the screenshots.');
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error('❌ Failed:', error);
        await page.screenshot({ path: 'error-screenshot.png' });
    } finally {
        await browser.close();
    }
}

captureFormLabels();
