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

    // Helper method to select from a picklist by finding the label first
    async selectPicklistByLabel(labelText: string | RegExp, optionText: string) {
        // Ajuste no log para exibir corretamente mesmo se for Regex
        console.log(`Selecting "${optionText}" for field "${labelText.toString()}"`);

        // LÓGICA CORRIGIDA:
        // Se labelText já for Regex, usa ele. Se for string, cria o Regex.
        const textFilter = (labelText instanceof RegExp)
            ? labelText
            : new RegExp(labelText, 'i');

        // Find the row that contains the label
        const labelCell = this.page.locator('td').filter({ hasText: textFilter }).first();

        // Find the dropdown in the same row (next cell)
        const dropdownCell = labelCell.locator('xpath=following-sibling::td[1]');

        // Click on the dropdown to open it
        await dropdownCell.locator('a').first().click();
        await this.page.waitForTimeout(500);

        // Select the option from the active dropdown
        const activeDropdown = this.page.locator('.chzn-drop:visible .chzn-results');
        await activeDropdown.getByRole('listitem').filter({ hasText: new RegExp(`^${optionText}`, 'i') }).first().click();
        await this.page.waitForTimeout(500);
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

    async selectCityPolo(cityPolo: string) {
        console.log(`Selecting City Polo: ${cityPolo}`);
        await this.selectPicklistByLabel('Cidade Polo', cityPolo);
        await this.page.waitForTimeout(1000); // Wait for dependent fields to reload
    }

    async selectCity(city: string) {
        console.log(`Selecting City: ${city}`);
        // Cidade uses a different selector pattern - find by label "Cidade"
        await this.page.getByRole('cell', { name: 'Select an Option Selecionar' }).click();
        await this.page.waitForTimeout(500);

        // Use the specific active dropdown container to avoid matching items from other dropdowns
        const activeDropdown = this.page.locator('.chzn-drop:visible .chzn-results');

        // Dynamic regex to match both patterns:
        // - Just city name: "Lavras", "Pouso Alegre"
        // - City with UF: "Lavras - MG", "Camanducaia - MG"
        // Regex explanation:
        // ^           -> Start of string
        // ${city}     -> Exact city name (e.g., "Lavras")
        // (\\s-\\s.*)? -> Optionally followed by " - " and any text (like "MG")
        // $           -> End of string (prevents matching "Lavras Novas" when searching for "Lavras")
        const cityRegex = new RegExp(`^${city}(\\s-\\s.*)?$`, 'i');

        await activeDropdown.getByRole('listitem').filter({ hasText: cityRegex }).last().click();
        await this.page.waitForTimeout(500);
    }

    async selectAssignedUser(userName: string) {
        console.log(`Selecting Assigned User: ${userName}`);
        // Try with the correct Portuguese label - "Responsável pelo Lead" with accent
        await this.selectPicklistByLabel('Responsavel pelo Lead', userName);
    }

    async selectUF(uf: string) {
        console.log(`Selecting UF: ${uf}`);
        await this.selectPicklistByLabel('UF', uf);
        await this.page.waitForTimeout(1000); // Wait for dependent Cidade Polo to load
    }

    async selectLeadStatus(status: string) {
        console.log(`Selecting Lead Status: ${status}`);
        await this.selectPicklistByLabel('Status Lead', status);
    }

    async selectLeadSource(source: string) {
        console.log(`Selecting Lead Source: ${source}`);
        // Try "Fonte do Lead" or "Origem do Lead"
        await this.selectPicklistByLabel('Fonte Lead', source);
    }

    async fillLeadForm(leadData: any) {
        // Preenchendo campos de texto
        console.log('Filling text fields...');
        if (leadData.company) await this.companyInput.fill(leadData.company);
        if (leadData.lastname) await this.lastnameInput.fill(leadData.lastname);
        if (leadData.mobile) await this.mobileInput.fill(leadData.mobile);
        if (leadData.email) await this.emailInput.fill(leadData.email);
        if (leadData.street) await this.streetInput.fill(leadData.street);
        if (leadData.complement) await this.complementInput.fill(leadData.complement);
        if (leadData.number) await this.numberInput.fill(leadData.number);
        if (leadData.neighborhood) await this.neighborhoodInput.fill(leadData.neighborhood);
        if (leadData.cep) await this.cepInput.fill(leadData.cep);

        await this.page.waitForLoadState('networkidle');
        console.log('Filling Description...');
        if (leadData.description) await this.descriptionInput.fill(leadData.description);

        // IMPORTANT ORDER: UF first, then Cidade Polo, then the rest

        // 1. Preenche UF
        const uf = leadData.cf_977;
        await this.selectUF(uf);

        // 2. Preenche Cidade Polo (depends on UF)
        if (leadData.userFromName) {
            const parts = leadData.userFromName.split('/');
            if (parts.length >= 2) {
                const cityPoloPart = parts[1].trim(); // "Pouso Alegre - MG"
                await this.selectCityPolo(cityPoloPart);
            }
        }

        // 3. Preenche Responsável pelo Lead
        if (leadData.userFromName) {
            const parts = leadData.userFromName.split('/');
            if (parts.length >= 2) {
                const assignedUserName = parts[0].trim();
                await this.selectAssignedUser(assignedUserName);
            }
        }

        // 4. Preenche Lead Status
        await this.selectLeadStatus('Cadastrado');

        // 5. Preenche Lead Source
        await this.selectLeadSource('Prospeccao Consultor');

        // 6. Preenche Cidade do Lead
        if (leadData.city) {
            await this.selectCity(leadData.city);
        }

        await expect(this.saveButton).toBeVisible({ timeout: 40000 });
    }

    async saveLead() {
        await this.saveButton.click();
        console.log('Saving lead...');
    }
}