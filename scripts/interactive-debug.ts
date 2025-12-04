import { chromium } from '@playwright/test';
import { LoginPage } from '../src/pages/login.page';
import { LeadPage } from '../src/pages/lead.page';
import dotenv from 'dotenv';

dotenv.config();

async function interactiveDebug() {
    console.log('Starting Interactive Debug...');
    console.log('This will open a browser, log in, and navigate to the Add Lead form.');
    console.log('Then it will PAUSE so you can inspect the page.');
    console.log('Use the browser DevTools (F12) to find the correct selectors for the picklists.');
    console.log('');
    console.log('Press Ctrl+C in the terminal to close when done.');
    console.log('');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100,
        devtools: true // Open DevTools automatically
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        const loginPage = new LoginPage(page);
        const leadPage = new LeadPage(page);

        // Login
        console.log('Logging in...');
        await loginPage.goto();
        await loginPage.login(
            process.env.CRM_USERNAME || '',
            process.env.CRM_PASSWORD || ''
        );

        // Navigate to Add Lead
        console.log('Navigating to Add Lead...');
        await leadPage.navigateToAddLead();

        console.log('');
        console.log('=== PAGE IS NOW READY ===');
        console.log('');
        console.log('To find the correct selectors:');
        console.log('1. Right-click on the "UF" dropdown and select "Inspect"');
        console.log('2. Look for the ID or class of the dropdown container');
        console.log('3. Do the same for "Responsável pelo Lead" (Assigned User)');
        console.log('4. Do the same for "Status Lead", "Origem do Lead", etc.');
        console.log('');
        console.log('Pausing... Press Ctrl+C when done.');

        // Keep the browser open indefinitely
        await page.waitForTimeout(600000); // 10 minutes

    } catch (error) {
        console.error('❌ Debug Failed:', error);
    } finally {
        await browser.close();
    }
}

interactiveDebug();
