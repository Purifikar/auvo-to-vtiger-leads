/**
 * Prisma Client para o banco de integração (entity_mapping)
 * Banco: integration
 * 
 * Este cliente é usado para:
 * - Verificar duplicidade de leads (SELECT FROM entity_mapping)
 * - Registrar novos leads processados (INSERT INTO entity_mapping)
 * 
 * NOTA: Usamos raw queries pois o banco de integração tem schema diferente
 * e não precisa de um Prisma Client separado para queries simples.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Cliente Prisma configurado para o banco de integração
const prismaIntegration = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_INTEGRATION_URL || process.env.DATABASE_URL,
        },
    },
});

/**
 * Interface para o registro de entity_mapping
 */
interface EntityMappingRecord {
    id: number;
    entity_type: string;
    crm_id: string | null;
    auvo_id: string | null;
    omie_id: string | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Verifica se um lead da Auvo já foi processado anteriormente.
 * 
 * @param auvoId - ID do cliente na Auvo
 * @returns true se o lead já existe, false caso contrário
 */
export async function checkLeadExists(auvoId: number | string): Promise<boolean> {
    try {
        const result = await prismaIntegration.$queryRaw<EntityMappingRecord[]>`
      SELECT * FROM entity_mapping 
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
      LIMIT 1
    `;

        const exists = result.length > 0;
        logger.info(`Checking if lead ${auvoId} exists: ${exists}`);
        return exists;
    } catch (error) {
        logger.error('Error checking lead existence', { auvoId, error });
        throw error;
    }
}

/**
 * Registra um lead processado com sucesso no banco de integração.
 * 
 * @param auvoId - ID do cliente na Auvo
 * @param crmId - ID do lead criado no Vtiger CRM
 */
export async function recordLeadMapping(
    auvoId: number | string,
    crmId: string
): Promise<void> {
    try {
        await prismaIntegration.$executeRaw`
      INSERT INTO entity_mapping (entity_type, auvo_id, crm_id, created_at, updated_at)
      VALUES ('lead', ${String(auvoId)}, ${crmId}, NOW(), NOW())
    `;
        logger.info(`Lead mapping recorded: auvo_id=${auvoId}, crm_id=${crmId}`);
    } catch (error) {
        logger.error('Error recording lead mapping', { auvoId, crmId, error });
        throw error;
    }
}

/**
 * Busca o mapeamento de um lead pelo ID da Auvo.
 * 
 * @param auvoId - ID do cliente na Auvo
 * @returns O registro de mapeamento ou null se não existir
 */
export async function getLeadMapping(auvoId: number | string): Promise<EntityMappingRecord | null> {
    try {
        const result = await prismaIntegration.$queryRaw<EntityMappingRecord[]>`
      SELECT * FROM entity_mapping 
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
      LIMIT 1
    `;

        return result.length > 0 ? result[0] : null;
    } catch (error) {
        logger.error('Error getting lead mapping', { auvoId, error });
        throw error;
    }
}

/**
 * Desconecta o cliente Prisma de integração.
 * Deve ser chamado ao finalizar a aplicação.
 */
export async function disconnectIntegrationDb(): Promise<void> {
    await prismaIntegration.$disconnect();
}

export { prismaIntegration };
