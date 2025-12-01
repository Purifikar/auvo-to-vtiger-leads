// pages/lead.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class LeadPage {
    readonly page: Page;
    // Adicione outros localizadores aqui conforme necessário
    readonly companyInput: Locator;
    readonly lastnameInput: Locator;
    readonly mobileInput: Locator;
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
        this.streetInput = page.locator('#Leads_editView_fieldName_cf_995');
        this.complementInput = page.locator('#Leads_editView_fieldName_cf_765');
        this.numberInput = page.locator('#Leads_editView_fieldName_cf_763');
        this.neighborhoodInput = page.locator('#Leads_editView_fieldName_cf_767');
        this.cepInput = page.locator('#Leads_editView_fieldName_code');
        this.descriptionInput = page.locator('#Leads_editView_fieldName_description');
        this.saveButton = page.getByRole('button', { name: 'Salvar' } ).nth(1);
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



    async fillLeadForm(leadData: any) {
        // Preenchendo campos de texto
        await this.companyInput.fill(leadData.company);
        await this.lastnameInput.fill(leadData.lastname);
        await this.mobileInput.fill(leadData.mobile);
        await this.streetInput.fill(leadData.street);
        await this.complementInput.fill(leadData.complement);
        await this.numberInput.fill(leadData.number);
        await this.neighborhoodInput.fill(leadData.neighborhood);
        await this.cepInput.fill(leadData.cep);
        await this.page.waitForLoadState('networkidle');
        await this.descriptionInput.fill(leadData.description);
        
        // Exemplo para preencher campos de seleção (dropdowns)
        await this.page.getByRole('cell', { name: 'Selecionar uma Opção' }).first().getByRole('link').click();
        await this.page.waitForTimeout(500); // Adicionado espera
        await this.page.getByRole('listitem').filter({ hasText: /^Treinamento$/ }).click();
        await this.page.waitForTimeout(500); // Adicionado espera
        await this.page.getByRole('cell', { name: 'Selecionar uma Opção Selecionar uma Opção Cadastrado Contato em Andamento' }).getByRole('link').click();
        await this.page.waitForTimeout(500); // Adicionado espera
        await this.page.getByRole('listitem').filter({ hasText: 'Cadastrado' }).click();
        await this.page.waitForTimeout(500); // Adicionado espera
        // Adicione aqui a lógica para os outros dropdowns se necessário
        await expect(this.saveButton).toBeVisible({ timeout: 40000 });
    }
    
    async saveLead() {
        await this.saveButton.click();
    } 
    
}