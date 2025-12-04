// pages/lead.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class LeadPage {
    readonly page: Page;
    // Adicione outros localizadores aqui conforme necessário
    readonly companyInput: Locator;
    readonly lastnameInput: Locator;
    readonly mobileInput: Locator;
    readonly emailInput: Locator;
    readonly streetInput: Locator;
    readonly numberInput: Locator;
    readonly complementInput: Locator;
    readonly neighborhoodInput: Locator;
    readonly cepInput: Locator;
    readonly descriptionInput: Locator;
    readonly saveButton: Locator;

    constructor(page: Page) {
        this.page = page;
        // Mapeando os localizadores para facilitar a manutenção
        this.companyInput = page.locator('#Leads_editView_fieldName_company');
        this.lastnameInput = page.locator('#Leads_editView_fieldName_lastname');
        this.mobileInput = page.locator('#Leads_editView_fieldName_mobile');
        this.emailInput = page.locator('#Leads_editView_fieldName_email');
        this.streetInput = page.locator('#Leads_editView_fieldName_cf_995');
        this.complementInput = page.locator('#Leads_editView_fieldName_cf_765');
        this.numberInput = page.locator('#Leads_editView_fieldName_cf_763');
        this.neighborhoodInput = page.locator('#Leads_editView_fieldName_cf_767');
        this.cepInput = page.locator('#Leads_editView_fieldName_code');
        this.descriptionInput = page.locator('#Leads_editView_fieldName_description');
        this.saveButton = page.getByRole('button', { name: 'Salvar' }).nth(1);
    }

    // Métodos de ação
    async navigateToAddLead() {
        // Clica no menu "Leads" e aguarda o carregamento da nova página
        await Promise.all([
            this.page.waitForURL('**/index.php?module=Leads&view=List', { timeout: 20000 }),
            this.page.getByRole('link', { name: 'Leads' }).click(),
        ]);

        // Agora aguarda o botão aparecer
        const addButton = this.page.getByRole('button', { name: 'Adicionar Lead' });
        await addButton.waitFor({ state: 'visible', timeout: 20000 });

        // E clica nele
        await addButton.click();

        // Aguarda o formulário de novo lead abrir
        await this.page.locator('#Leads_editView_fieldName_company').waitFor({
            state: 'visible',
            timeout: 20000,
        });
    }

    async selectCityPolo(userFromName: string) {
        // Extract City Polo from userFromName
        // Format: "Name - PSA / City Polo - State"
        // Example: "Carlos Rodrigo dos Santos B. Teodoro - PSA / Pouso Alegre - MG"
        const parts = userFromName.split('/');
        if (parts.length < 2) {
            throw new Error(`Invalid userFromName format: ${userFromName}`);
        }
        const cityPoloPart = parts[1].trim(); // "Pouso Alegre - MG"

        // User confirmed "Cidade Polo: Pouso Alegre - MG"
        // We try to select the full string first.
        console.log(`Selecting City Polo: ${cityPoloPart}`);

        // Click the dropdown
        await this.page.getByRole('cell', { name: 'Selecionar uma Opção' }).first().getByRole('link').click();
        await this.page.waitForTimeout(500);

        // Try to select full string "Pouso Alegre - MG"
        // Using regex to match start of string to be safe against extra spaces
        await this.page.getByRole('listitem').filter({ hasText: new RegExp(`^${cityPoloPart}`, 'i') }).first().click();
        await this.page.waitForTimeout(1000); // Wait for dependent fields to reload
    }

    async selectCity(city: string) {
        console.log(`Selecting City: ${city}`);
        await this.page.getByRole('cell', { name: 'Select an Option Selecionar' }).getByRole('link').click();
        await this.page.waitForTimeout(500);
        await this.page.getByRole('listitem').filter({ hasText: new RegExp(`^${city}$`, 'i') }).click();
    }

    async selectAssignedUser(userName: string) {
        console.log(`Selecting Assigned User: ${userName}`);
        // Attempt 1: Try ID selector for the chosen container (standard in Vtiger)
        const assignedUserContainer = this.page.locator('#Leads_editView_fieldName_assigned_user_id_chosen');

        if (await assignedUserContainer.isVisible()) {
            await assignedUserContainer.click();
        } else {
            // Fallback: Try to find by label "Responsável"
            // This is risky if language changes, but user seems to use PT-BR
            await this.page.locator('td').filter({ hasText: 'Responsável' }).locator('+ td').click();
        }

        await this.page.waitForTimeout(500);
        // Select the user from the dropdown
        await this.page.getByRole('listitem').filter({ hasText: new RegExp(`^${userName}`, 'i') }).first().click();
    }

    async fillLeadForm(leadData: any) {
        // Preenchendo campos de texto
        await this.companyInput.fill(leadData.company);
        await this.lastnameInput.fill(leadData.lastname);
        await this.mobileInput.fill(leadData.mobile);
        await this.emailInput.fill(leadData.email);
        await this.streetInput.fill(leadData.street);
        await this.complementInput.fill(leadData.complement);
        await this.numberInput.fill(leadData.number);
        await this.neighborhoodInput.fill(leadData.neighborhood);
        await this.cepInput.fill(leadData.cep);
        await this.page.waitForLoadState('networkidle');
        await this.descriptionInput.fill(leadData.description);

        // Preenche UF
        const uf = leadData.cf_977 || 'MG'; // Default to MG if missing
        await this.page.locator('#Leads_editView_fieldName_cf_977_chosen').click();
        await this.page.waitForTimeout(500);
        await this.page.getByRole('listitem').filter({ hasText: new RegExp(`^${uf}$`, 'i') }).click();


        // Preenche City Polo and Assigned User
        if (leadData.userFromName) {
            // Parse userFromName
            const parts = leadData.userFromName.split('/');
            if (parts.length >= 2) {
                const assignedUserName = parts[0].trim(); // "Carlos Rodrigo dos Santos B. Teodoro - PSA"

                // Select Assigned User
                await this.selectAssignedUser(assignedUserName);

                // Select City Polo
                await this.selectCityPolo(leadData.userFromName);
            }
        }

        // Preenche Lead Status
        await this.page.locator('#Leads_editView_fieldName_leadstatus_chosen').click();
        await this.page.waitForTimeout(500);
        await this.page.getByRole('listitem').filter({ hasText: 'Cadastrado' }).click();

        await this.page.waitForTimeout(500);

        // Preenche Lead Source
        await this.page.locator('#Leads_editView_fieldName_leadsource_chosen').click();
        await this.page.waitForTimeout(500);
        await this.page.getByRole('listitem').filter({ hasText: /^Prospeccao Consultor$/ }).click();

        await this.page.waitForTimeout(500);

        // Preenche Cidade do Lead
        if (leadData.city) {
            await this.selectCity(leadData.city);
        }

        await expect(this.saveButton).toBeVisible({ timeout: 40000 });
    }

    async saveLead() {
        await this.saveButton.click();
    }
}