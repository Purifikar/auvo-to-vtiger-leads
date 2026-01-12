"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeadAutomation = createLeadAutomation;
const playwright_1 = require("playwright");
const login_page_1 = require("../pages/login.page");
const lead_page_1 = require("../pages/lead.page");
const logger_1 = require("../lib/logger");
function createLeadAutomation(leadData) {
    return __awaiter(this, void 0, void 0, function* () {
        // Headless true para Docker/produção, false apenas para debug local
        const isHeadless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
        const browser = yield playwright_1.chromium.launch({
            headless: isHeadless,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Necessário para Docker
        });
        const context = yield browser.newContext();
        const page = yield context.newPage();
        try {
            logger_1.logger.info('Starting automation for lead', { company: leadData.company });
            const loginPage = new login_page_1.LoginPage(page);
            const leadPage = new lead_page_1.LeadPage(page);
            // Login
            yield loginPage.goto();
            yield loginPage.login(process.env.CRM_USERNAME || 'flavio.eduardo', process.env.CRM_PASSWORD || '@PFK2023FE');
            // Navigate to Add Lead
            yield leadPage.navigateToAddLead();
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
            yield leadPage.fillLeadForm(mappedData);
            yield leadPage.saveLead();
            // Wait for redirection to Detail view to confirm success
            yield page.waitForURL(/module=Leads&view=Detail&record=\d+/, { timeout: 30000 });
            const currentURL = page.url();
            const recordMatch = currentURL.match(/record=(\d+)/);
            const recordId = recordMatch ? recordMatch[1] : null;
            if (!recordId) {
                throw new Error('Failed to retrieve Lead ID after save');
            }
            logger_1.logger.info('Lead created successfully', { recordId });
            return recordId;
        }
        catch (error) {
            logger_1.logger.error('Automation failed', { error });
            // Take screenshot on failure
            yield page.screenshot({ path: `error-${Date.now()}.png` });
            throw error;
        }
        finally {
            yield browser.close();
        }
    });
}
