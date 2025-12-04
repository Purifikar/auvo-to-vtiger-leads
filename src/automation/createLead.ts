import { chromium } from 'playwright';
import { LoginPage } from '../pages/login.page';
import { LeadPage } from '../pages/lead.page';
import { logger } from '../lib/logger';

export async function createLeadAutomation(leadData: any) {
    const browser = await chromium.launch({ headless: false }); // Set to false for debugging
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        logger.info('Starting automation for lead', { company: leadData.company });

        const loginPage = new LoginPage(page);
        const leadPage = new LeadPage(page);

        // Login
        await loginPage.goto();
        await loginPage.login(
            process.env.CRM_USERNAME || 'flavio.eduardo',
            process.env.CRM_PASSWORD || '@PFK2023FE'
        );

        // Navigate to Add Lead
        await leadPage.navigateToAddLead();

        // Fill Form
        // Map incoming JSON to LeadPage expected format
        const mappedData = {
            company: leadData.vtiger.company,
            lastname: leadData.vtiger.lastname,
            mobile: leadData.vtiger.phone,
            email: leadData.vtiger.email,
            street: leadData.vtiger.cf_995,
            complement: leadData.vtiger.cf_765,
            number: leadData.vtiger.cf_763,
            neighborhood: leadData.vtiger.cf_767,
            cep: leadData.vtiger.code,
            description: leadData.vtiger.description,
            city: leadData.vtiger.city,
            cf_977: leadData.vtiger.cf_977, // UF
            userFromName: leadData.others.Task.userFromName // For City Polo
        };

        await leadPage.fillLeadForm(mappedData);

        await leadPage.saveLead();

        // Wait for redirection to Detail view to confirm success
        await page.waitForURL(/module=Leads&view=Detail&record=\d+/, { timeout: 30000 });

        const currentURL = page.url();
        const recordMatch = currentURL.match(/record=(\d+)/);
        const recordId = recordMatch ? recordMatch[1] : null;

        if (!recordId) {
            throw new Error('Failed to retrieve Lead ID after save');
        }

        logger.info('Lead created successfully', { recordId });
        return recordId;

    } catch (error) {
        logger.error('Automation failed', { error });
        // Take screenshot on failure
        await page.screenshot({ path: `error-${Date.now()}.png` });
        throw error;
    } finally {
        await browser.close();
    }
}
