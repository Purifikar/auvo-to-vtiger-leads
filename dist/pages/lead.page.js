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
exports.LeadPage = void 0;
// pages/lead.page.ts
const test_1 = require("@playwright/test");
class LeadPage {
    constructor(page) {
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
    selectPicklistByLabel(labelText, optionText) {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield dropdownCell.locator('a').first().click();
            yield this.page.waitForTimeout(500);
            // Select the option from the active dropdown
            const activeDropdown = this.page.locator('.chzn-drop:visible .chzn-results');
            yield activeDropdown.getByRole('listitem').filter({ hasText: new RegExp(`^${optionText}`, 'i') }).first().click();
            yield this.page.waitForTimeout(500);
        });
    }
    // Métodos de ação
    navigateToAddLead() {
        return __awaiter(this, void 0, void 0, function* () {
            // Clica no menu "Leads" e aguarda o carregamento da nova página
            yield Promise.all([
                this.page.waitForURL('**/index.php?module=Leads&view=List', { timeout: 20000 }),
                this.page.getByRole('link', { name: 'Leads' }).click(),
            ]);
            // Agora aguarda o botão aparecer
            const addButton = this.page.getByRole('button', { name: 'Adicionar Lead' });
            yield addButton.waitFor({ state: 'visible', timeout: 20000 });
            // E clica nele
            yield addButton.click();
            // Aguarda o formulário de novo lead abrir
            yield this.page.locator('#Leads_editView_fieldName_company').waitFor({
                state: 'visible',
                timeout: 20000,
            });
        });
    }
    selectCityPolo(cityPolo) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Selecting City Polo: ${cityPolo}`);
            yield this.selectPicklistByLabel('Cidade Polo', cityPolo);
            yield this.page.waitForTimeout(1000); // Wait for dependent fields to reload
        });
    }
    selectCity(city) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Selecting City: ${city}`);
            // Encontra a row da Cidade especificamente
            const cityRow = this.page.getByRole('row', { name: /\* Cidade/i });
            try {
                yield cityRow.waitFor({ state: 'visible', timeout: 10000 });
            }
            catch (_a) {
                console.log('City row not found, skipping city selection');
                return;
            }
            // Clica no dropdown dentro dessa row
            const dropdownTrigger = cityRow.locator('a.chzn-single, .chzn-container a').first();
            yield dropdownTrigger.click();
            yield this.page.waitForTimeout(1000);
            // Agora busca o dropdown DENTRO da row da cidade
            const cityDropdown = cityRow.locator('.chzn-drop .chzn-results');
            try {
                yield cityDropdown.waitFor({ state: 'visible', timeout: 10000 });
            }
            catch (_b) {
                console.log('City dropdown did not open, skipping');
                return;
            }
            // Função para remover acentos (Cuiabá → Cuiaba, Gravataí → Gravatai)
            const removeAccents = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            };
            // Normaliza a cidade removendo acentos
            const cityNormalized = removeAccents(city);
            console.log(`Searching for city: "${city}" (normalized: "${cityNormalized}")`);
            // Busca todas as opções e compara sem acentos
            const allOptions = yield cityDropdown.getByRole('listitem').all();
            let foundOption = null;
            for (const option of allOptions) {
                const text = yield option.textContent();
                if (!text)
                    continue;
                const textNormalized = removeAccents(text);
                // Compara ignorando acentos e case
                if (textNormalized.toLowerCase().startsWith(cityNormalized.toLowerCase())) {
                    foundOption = option;
                    console.log(`Found match: "${text}" for "${city}"`);
                    break;
                }
            }
            if (foundOption) {
                yield foundOption.scrollIntoViewIfNeeded();
                yield foundOption.click();
                console.log(`City "${city}" selected successfully`);
            }
            else {
                // Lista as opções disponíveis para debug
                const options = yield cityDropdown.getByRole('listitem').allTextContents();
                const availablePreview = options.slice(0, 5).join(', ');
                // LANÇA ERRO - cidade não encontrada no CRM
                throw new Error(`Cidade "${city}" não encontrada no CRM. Opções similares: ${availablePreview}...`);
            }
            yield this.page.waitForTimeout(500);
        });
    }
    selectAssignedUser(userName) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Selecting Assigned User: ${userName}`);
            // Try with the correct Portuguese label - "Responsável pelo Lead" with accent
            yield this.selectPicklistByLabel('Responsavel pelo Lead', userName);
        });
    }
    selectUF(uf) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Selecting UF: ${uf}`);
            yield this.selectPicklistByLabel('UF', uf);
            yield this.page.waitForTimeout(1000); // Wait for dependent Cidade Polo to load
        });
    }
    selectLeadStatus(status) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Selecting Lead Status: ${status}`);
            yield this.selectPicklistByLabel('Status Lead', status);
        });
    }
    selectLeadSource(source) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Selecting Lead Source: ${source}`);
            // Try "Fonte do Lead" or "Origem do Lead"
            yield this.selectPicklistByLabel('Fonte Lead', source);
        });
    }
    fillLeadForm(leadData) {
        return __awaiter(this, void 0, void 0, function* () {
            // Preenchendo campos de texto
            console.log('Filling text fields...');
            if (leadData.company)
                yield this.companyInput.fill(leadData.company);
            if (leadData.lastname)
                yield this.lastnameInput.fill(leadData.lastname);
            if (leadData.mobile)
                yield this.mobileInput.fill(leadData.mobile);
            if (leadData.email)
                yield this.emailInput.fill(leadData.email);
            if (leadData.street)
                yield this.streetInput.fill(leadData.street);
            if (leadData.complement)
                yield this.complementInput.fill(leadData.complement);
            if (leadData.number)
                yield this.numberInput.fill(leadData.number);
            if (leadData.neighborhood)
                yield this.neighborhoodInput.fill(leadData.neighborhood);
            if (leadData.cep)
                yield this.cepInput.fill(leadData.cep);
            yield this.page.waitForLoadState('networkidle');
            console.log('Filling Description...');
            if (leadData.description)
                yield this.descriptionInput.fill(leadData.description);
            // IMPORTANT ORDER: UF first, then Cidade Polo, then the rest
            // 1. Preenche UF
            const uf = leadData.cf_977;
            yield this.selectUF(uf);
            // 2. Preenche Cidade Polo (depends on UF)
            if (leadData.userFromName) {
                const parts = leadData.userFromName.split('/');
                if (parts.length >= 2) {
                    const cityPoloPart = parts[1].trim(); // "Pouso Alegre - MG"
                    yield this.selectCityPolo(cityPoloPart);
                }
            }
            // 3. Preenche Responsável pelo Lead
            if (leadData.userFromName) {
                const parts = leadData.userFromName.split('/');
                if (parts.length >= 2) {
                    const assignedUserName = parts[0].trim();
                    yield this.selectAssignedUser(assignedUserName);
                }
            }
            // 4. Preenche Lead Status
            yield this.selectLeadStatus('Cadastrado');
            // 5. Preenche Lead Source
            yield this.selectLeadSource('Prospeccao Consultor');
            // 6. Preenche Cidade do Lead
            if (leadData.city) {
                yield this.selectCity(leadData.city);
            }
            yield (0, test_1.expect)(this.saveButton).toBeVisible({ timeout: 40000 });
        });
    }
    saveLead() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveButton.click();
            console.log('Saving lead...');
        });
    }
}
exports.LeadPage = LeadPage;
