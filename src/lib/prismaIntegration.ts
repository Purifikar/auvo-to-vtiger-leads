/**
 * Prisma Client para o banco de integração (entity_mapping)
 * Banco: integration
 * 
 * Este cliente é usado para:
 * - Verificar duplicidade de leads (SELECT FROM entity_mapping)
 * - Registrar novos leads como PENDING antes de processar
 * - Atualizar o crm_id após sucesso no CRM
 * 
 * NOTA: Usamos raw queries pois o banco de integração tem schema diferente
 * e não precisa de um Prisma Client separado para queries simples.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Status possíveis para o crm_id
export const LEAD_STATUS = {
    PENDING: 'PENDING',      // Lead reservado, aguardando criação no CRM
    FAILED: 'FAILED',        // Falhou ao criar no CRM (pode ser reprocessado)
} as const;

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
export interface EntityMappingRecord {
    id: number;
    entity_type: string;
    crm_id: string | null;
    auvo_id: string | null;
    omie_id: string | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Verifica se um lead da Auvo já existe no entity_mapping.
 * Retorna true se existe (qualquer status: PENDING, FAILED, ou com crm_id real).
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
        if (exists) {
            const record = result[0];
            logger.info(`Lead ${auvoId} exists in entity_mapping`, {
                crm_id: record.crm_id,
                isPending: record.crm_id === LEAD_STATUS.PENDING,
                isFailed: record.crm_id === LEAD_STATUS.FAILED,
            });
        }
        return exists;
    } catch (error) {
        logger.error('Error checking lead existence', { auvoId, error });
        throw error;
    }
}

/**
 * Verifica se um lead existe e retorna informações detalhadas.
 * 
 * @param auvoId - ID do cliente na Auvo
 * @returns Objeto com exists, isPending, isFailed, crmId
 */
export async function getLeadStatus(auvoId: number | string): Promise<{
    exists: boolean;
    isPending: boolean;
    isFailed: boolean;
    isCreated: boolean;
    crmId: string | null;
    record: EntityMappingRecord | null;
}> {
    try {
        const result = await prismaIntegration.$queryRaw<EntityMappingRecord[]>`
      SELECT * FROM entity_mapping 
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
      LIMIT 1
    `;

        if (result.length === 0) {
            return {
                exists: false,
                isPending: false,
                isFailed: false,
                isCreated: false,
                crmId: null,
                record: null,
            };
        }

        const record = result[0];
        const isPending = record.crm_id === LEAD_STATUS.PENDING;
        const isFailed = record.crm_id === LEAD_STATUS.FAILED;
        const isCreated = !isPending && !isFailed && record.crm_id !== null;

        return {
            exists: true,
            isPending,
            isFailed,
            isCreated,
            crmId: record.crm_id,
            record,
        };
    } catch (error) {
        logger.error('Error getting lead status', { auvoId, error });
        throw error;
    }
}

/**
 * Reserva um lead no entity_mapping ANTES de tentar criar no CRM.
 * Isso previne duplicidade mesmo se o webhook for chamado múltiplas vezes.
 * 
 * @param auvoId - ID do cliente na Auvo
 * @returns true se conseguiu reservar, false se já existe
 */
export async function reserveLeadMapping(auvoId: number | string): Promise<boolean> {
    try {
        // Primeiro verifica se já existe
        const status = await getLeadStatus(auvoId);

        if (status.exists) {
            logger.info(`Lead ${auvoId} already reserved/exists, skipping reservation`, {
                crmId: status.crmId,
                isPending: status.isPending,
            });
            return false;
        }

        // Registra como PENDING
        await prismaIntegration.$executeRaw`
      INSERT INTO entity_mapping (entity_type, auvo_id, crm_id, created_at, updated_at)
      VALUES ('lead', ${String(auvoId)}, ${LEAD_STATUS.PENDING}, NOW(), NOW())
    `;

        logger.info(`Lead ${auvoId} reserved with status PENDING`);
        return true;
    } catch (error: any) {
        // Se for erro de duplicidade (unique constraint), considera como "já existe"
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
            logger.info(`Lead ${auvoId} already exists (caught duplicate error)`);
            return false;
        }
        logger.error('Error reserving lead mapping', { auvoId, error });
        throw error;
    }
}

/**
 * Atualiza o crm_id de um lead após criação bem-sucedida no CRM.
 * 
 * @param auvoId - ID do cliente na Auvo
 * @param crmId - ID do lead criado no Vtiger CRM
 */
export async function updateLeadMapping(
    auvoId: number | string,
    crmId: string
): Promise<void> {
    try {
        await prismaIntegration.$executeRaw`
      UPDATE entity_mapping 
      SET crm_id = ${crmId}, updated_at = NOW()
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
    `;
        logger.info(`Lead mapping updated: auvo_id=${auvoId}, crm_id=${crmId}`);
    } catch (error) {
        logger.error('Error updating lead mapping', { auvoId, crmId, error });
        throw error;
    }
}

/**
 * Marca um lead como FAILED após erro na criação no CRM.
 * 
 * @param auvoId - ID do cliente na Auvo
 */
export async function markLeadAsFailed(auvoId: number | string): Promise<void> {
    try {
        await prismaIntegration.$executeRaw`
      UPDATE entity_mapping 
      SET crm_id = ${LEAD_STATUS.FAILED}, updated_at = NOW()
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
    `;
        logger.info(`Lead ${auvoId} marked as FAILED`);
    } catch (error) {
        logger.error('Error marking lead as failed', { auvoId, error });
        throw error;
    }
}

/**
 * Remove a reserva de um lead (usado para permitir reprocessamento).
 * 
 * @param auvoId - ID do cliente na Auvo
 */
export async function removeLeadReservation(auvoId: number | string): Promise<void> {
    try {
        await prismaIntegration.$executeRaw`
      DELETE FROM entity_mapping 
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead' 
      AND (crm_id = ${LEAD_STATUS.PENDING} OR crm_id = ${LEAD_STATUS.FAILED})
    `;
        logger.info(`Lead ${auvoId} reservation removed (can be reprocessed)`);
    } catch (error) {
        logger.error('Error removing lead reservation', { auvoId, error });
        throw error;
    }
}

/**
 * Registra um lead processado com sucesso no banco de integração.
 * DEPRECATED: Use reserveLeadMapping + updateLeadMapping instead.
 * Mantido por compatibilidade.
 * 
 * @param auvoId - ID do cliente na Auvo
 * @param crmId - ID do lead criado no Vtiger CRM
 */
export async function recordLeadMapping(
    auvoId: number | string,
    crmId: string
): Promise<void> {
    try {
        // Verifica se já existe
        const status = await getLeadStatus(auvoId);

        if (status.exists) {
            // Se existe, atualiza
            await updateLeadMapping(auvoId, crmId);
        } else {
            // Se não existe, insere direto com crm_id
            await prismaIntegration.$executeRaw`
          INSERT INTO entity_mapping (entity_type, auvo_id, crm_id, created_at, updated_at)
          VALUES ('lead', ${String(auvoId)}, ${crmId}, NOW(), NOW())
        `;
            logger.info(`Lead mapping recorded: auvo_id=${auvoId}, crm_id=${crmId}`);
        }
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
 * Lista todos os leads com status PENDING ou FAILED (para reprocessamento).
 * 
 * @returns Lista de registros pendentes/falhos
 */
export async function getPendingOrFailedLeads(): Promise<EntityMappingRecord[]> {
    try {
        const result = await prismaIntegration.$queryRaw<EntityMappingRecord[]>`
      SELECT * FROM entity_mapping 
      WHERE entity_type = 'lead' 
      AND (crm_id = ${LEAD_STATUS.PENDING} OR crm_id = ${LEAD_STATUS.FAILED})
      ORDER BY created_at ASC
    `;
        return result;
    } catch (error) {
        logger.error('Error getting pending/failed leads', { error });
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
