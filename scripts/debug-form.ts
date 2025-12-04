import { chromium } from '@playwright/test';
import { LoginPage } from '../src/pages/login.page';
import { LeadPage } from '../src/pages/lead.page';
import dotenv from 'dotenv';

dotenv.config();

async function debugForm() {
    console.log('Starting Form Debug...');
    const browser = await chromium.launch({ headless: false, slowMo: 100 }); // SlowMo helps to see what's happening
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

        // Sample Data
        const sampleLead = {
            company: 'Debug Company',
            lastname: 'Debug User',
            mobile: '11999999999',
            email: 'debug@example.com',
            street: 'Rua Teste',
            number: '123',
            neighborhood: 'Bairro Teste',
            cep: '37550-000',
            description: 'Debug Description',
            cf_977: 'MG', // UF
            city: 'Pouso Alegre',
            userFromName: 'Carlos Rodrigo dos Santos B. Teodoro - PSA / Pouso Alegre - MG'
        };

        console.log('Filling Form...');
        await leadPage.fillLeadForm(sampleLead);

        console.log('Form Filled. Waiting 10 seconds before closing...');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error('❌ Debug Failed:', error);
        await page.screenshot({ path: 'debug-failure.png' });
    } finally {
        await browser.close();
    }
}

debugForm();
