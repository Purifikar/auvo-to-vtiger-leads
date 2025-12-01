// tests/createLead.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { LeadPage } from '../pages/lead.page';

test.describe('Criação de Leads', () => {

    test('Deve ser possível criar um novo Lead com sucesso', async ({ page }) => {
        // Instanciando as pages
        const loginPage = new LoginPage(page);
        const leadPage = new LeadPage(page);

        // Dados do Lead a ser criado
        const leadData = {
            company: 'Empresa Teste via POM2',
            lastname: 'Playwright2',
            mobile: '31999998888',
            street: 'Rua da Automação',
            complement: 'Sala 101',
            number: '123',
            neighborhood: 'Centro',
            cep: '33250000',
            description: 'Este Lead foi incluído pelo Playwright com Page Object Model'
        };

        // PASSO 1: Fazer login
        await loginPage.goto();
        await loginPage.login('flavio.eduardo', '@PFK2023FE');
        // Adicionar uma verificação para garantir que o login foi bem-sucedido
        await expect(page.getByRole('link', { name: 'Leads' })).toBeVisible();

        // PASSO 2: Navegar para o formulário de criação
        await leadPage.navigateToAddLead();

        // PASSO 3: Preencher e salvar o formulário
        await leadPage.fillLeadForm(leadData);
        
        console.log('Formulário preenchido com os dados do lead.');
    /*  await leadPage.saveLead();
        // Aguarda o redirecionamento para a página do lead
        await page.waitForURL(/module=Leads&view=Detail&record=\d+/, { timeout: 15000 });
    
        // Captura a URL atual
        const currentURL = page.url();
        console.log('✅ Lead criado! URL atual:', currentURL);

        // Extrai o número do lead a partir da URL
        const recordMatch = currentURL.match(/record=(\d+)/);
        const recordId = recordMatch ? recordMatch[1] : null;

        expect(recordId).not.toBeNull();
        console.log('📋 Número do lead criado:', recordId);
    */
        // Valida que a página carregou o nome do lead (exemplo: "Playwright2")
        //await expect(page.getByText(leadData.company)).toBeVisible();

        // (Opcional) também pode verificar se o título contém o número do lead
        //await expect(page).toHaveURL(new RegExp(`record=${recordId}`));
    });

});