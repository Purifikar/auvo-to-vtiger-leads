/**
 * Testes de Duplicidade
 * Valida que o sistema não processa o mesmo lead duas vezes
 */

// Setup das variáveis de ambiente
process.env.GOOGLE_MAPS_API_KEY = 'test-key';
process.env.AUVO_API_KEY = 'test-key';
process.env.AUVO_API_TOKEN = 'test-token';
process.env.DATABASE_INTEGRATION_URL = process.env.DATABASE_INTEGRATION_URL || 'postgresql://test:test@localhost:5432/test';

import {
    checkLeadExists,
    recordLeadMapping,
    getLeadMapping,
    prismaIntegration
} from '../../src/lib/prismaIntegration';

describe('Duplicidade de Leads', () => {

    // ID único para testes (usando timestamp para evitar conflitos)
    const testAuvoId = `TEST_${Date.now()}`;
    const testCrmId = `CRM_${Date.now()}`;

    afterAll(async () => {
        // Limpa os dados de teste
        try {
            await prismaIntegration.$executeRaw`
        DELETE FROM entity_mapping WHERE auvo_id LIKE 'TEST_%'
      `;
            await prismaIntegration.$disconnect();
        } catch (error) {
            console.log('Cleanup error (pode ser ignorado em ambiente de teste):', error);
        }
    });

    describe('checkLeadExists', () => {
        test('deve retornar false para lead que não existe', async () => {
            const exists = await checkLeadExists('NONEXISTENT_ID_12345');
            expect(exists).toBe(false);
        });

        test('deve retornar true após registrar o lead', async () => {
            // Primeiro verifica que não existe
            const existsBefore = await checkLeadExists(testAuvoId);
            expect(existsBefore).toBe(false);

            // Registra o lead
            await recordLeadMapping(testAuvoId, testCrmId);

            // Agora deve existir
            const existsAfter = await checkLeadExists(testAuvoId);
            expect(existsAfter).toBe(true);
        });
    });

    describe('recordLeadMapping', () => {
        test('deve registrar mapeamento corretamente', async () => {
            const auvoId = `TEST_RECORD_${Date.now()}`;
            const crmId = `CRM_RECORD_${Date.now()}`;

            await recordLeadMapping(auvoId, crmId);

            const mapping = await getLeadMapping(auvoId);
            expect(mapping).not.toBeNull();
            expect(mapping?.auvo_id).toBe(auvoId);
            expect(mapping?.crm_id).toBe(crmId);
            expect(mapping?.entity_type).toBe('lead');
        });
    });

    describe('getLeadMapping', () => {
        test('deve retornar null para lead que não existe', async () => {
            const mapping = await getLeadMapping('NONEXISTENT_ID_99999');
            expect(mapping).toBeNull();
        });

        test('deve retornar mapeamento completo', async () => {
            const auvoId = `TEST_GET_${Date.now()}`;
            const crmId = `CRM_GET_${Date.now()}`;

            await recordLeadMapping(auvoId, crmId);
            const mapping = await getLeadMapping(auvoId);

            expect(mapping).not.toBeNull();
            expect(mapping).toHaveProperty('id');
            expect(mapping).toHaveProperty('entity_type');
            expect(mapping).toHaveProperty('auvo_id');
            expect(mapping).toHaveProperty('crm_id');
            expect(mapping).toHaveProperty('created_at');
        });
    });

    describe('Cenários de Duplicidade', () => {
        test('não deve permitir processar mesmo lead duas vezes', async () => {
            const auvoId = `TEST_DUP_${Date.now()}`;

            // Primeira verificação - não existe
            const check1 = await checkLeadExists(auvoId);
            expect(check1).toBe(false);

            // Simula processamento do lead
            await recordLeadMapping(auvoId, 'CRM_FIRST');

            // Segunda verificação - deve existir
            const check2 = await checkLeadExists(auvoId);
            expect(check2).toBe(true);

            // O sistema não deve processar novamente
            // (essa verificação simula o que acontece no AuvoSyncService)
        });

        test('leads diferentes devem ser processados independentemente', async () => {
            const auvoId1 = `TEST_MULTI_1_${Date.now()}`;
            const auvoId2 = `TEST_MULTI_2_${Date.now()}`;

            // Ambos não existem inicialmente
            expect(await checkLeadExists(auvoId1)).toBe(false);
            expect(await checkLeadExists(auvoId2)).toBe(false);

            // Processa primeiro lead
            await recordLeadMapping(auvoId1, 'CRM_1');

            // Primeiro existe, segundo não
            expect(await checkLeadExists(auvoId1)).toBe(true);
            expect(await checkLeadExists(auvoId2)).toBe(false);

            // Processa segundo lead
            await recordLeadMapping(auvoId2, 'CRM_2');

            // Ambos existem
            expect(await checkLeadExists(auvoId1)).toBe(true);
            expect(await checkLeadExists(auvoId2)).toBe(true);
        });
    });
});
