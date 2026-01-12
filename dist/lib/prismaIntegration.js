"use strict";
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
exports.prismaIntegration = exports.LEAD_STATUS = void 0;
exports.checkLeadExists = checkLeadExists;
exports.getLeadStatus = getLeadStatus;
exports.reserveLeadMapping = reserveLeadMapping;
exports.updateLeadMapping = updateLeadMapping;
exports.markLeadAsFailed = markLeadAsFailed;
exports.removeLeadReservation = removeLeadReservation;
exports.recordLeadMapping = recordLeadMapping;
exports.getLeadMapping = getLeadMapping;
exports.getPendingOrFailedLeads = getPendingOrFailedLeads;
exports.disconnectIntegrationDb = disconnectIntegrationDb;
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
// Status possíveis para o crm_id
exports.LEAD_STATUS = {
    PENDING: 'PENDING', // Lead reservado, aguardando criação no CRM
    FAILED: 'FAILED', // Falhou ao criar no CRM (pode ser reprocessado)
};
// Cliente Prisma configurado para o banco de integração
const prismaIntegration = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_INTEGRATION_URL || process.env.DATABASE_URL,
        },
    },
});
exports.prismaIntegration = prismaIntegration;
/**
 * Verifica se um lead da Auvo já existe no entity_mapping.
 * Retorna true se existe (qualquer status: PENDING, FAILED, ou com crm_id real).
 *
 * @param auvoId - ID do cliente na Auvo
 * @returns true se o lead já existe, false caso contrário
 */
function checkLeadExists(auvoId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield prismaIntegration.$queryRaw `
      SELECT * FROM entity_mapping 
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
      LIMIT 1
    `;
            const exists = result.length > 0;
            if (exists) {
                const record = result[0];
                logger_1.logger.info(`Lead ${auvoId} exists in entity_mapping`, {
                    crm_id: record.crm_id,
                    isPending: record.crm_id === exports.LEAD_STATUS.PENDING,
                    isFailed: record.crm_id === exports.LEAD_STATUS.FAILED,
                });
            }
            return exists;
        }
        catch (error) {
            logger_1.logger.error('Error checking lead existence', { auvoId, error });
            throw error;
        }
    });
}
/**
 * Verifica se um lead existe e retorna informações detalhadas.
 *
 * @param auvoId - ID do cliente na Auvo
 * @returns Objeto com exists, isPending, isFailed, crmId
 */
function getLeadStatus(auvoId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield prismaIntegration.$queryRaw `
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
            const isPending = record.crm_id === exports.LEAD_STATUS.PENDING;
            const isFailed = record.crm_id === exports.LEAD_STATUS.FAILED;
            const isCreated = !isPending && !isFailed && record.crm_id !== null;
            return {
                exists: true,
                isPending,
                isFailed,
                isCreated,
                crmId: record.crm_id,
                record,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting lead status', { auvoId, error });
            throw error;
        }
    });
}
/**
 * Reserva um lead no entity_mapping ANTES de tentar criar no CRM.
 * Isso previne duplicidade mesmo se o webhook for chamado múltiplas vezes.
 *
 * @param auvoId - ID do cliente na Auvo
 * @returns true se conseguiu reservar, false se já existe
 */
function reserveLeadMapping(auvoId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Primeiro verifica se já existe
            const status = yield getLeadStatus(auvoId);
            if (status.exists) {
                logger_1.logger.info(`Lead ${auvoId} already reserved/exists, skipping reservation`, {
                    crmId: status.crmId,
                    isPending: status.isPending,
                });
                return false;
            }
            // Registra como PENDING
            yield prismaIntegration.$executeRaw `
      INSERT INTO entity_mapping (entity_type, auvo_id, crm_id, created_at, updated_at)
      VALUES ('lead', ${String(auvoId)}, ${exports.LEAD_STATUS.PENDING}, NOW(), NOW())
    `;
            logger_1.logger.info(`Lead ${auvoId} reserved with status PENDING`);
            return true;
        }
        catch (error) {
            // Se for erro de duplicidade (unique constraint), considera como "já existe"
            if (error.code === '23505' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('duplicate')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('unique'))) {
                logger_1.logger.info(`Lead ${auvoId} already exists (caught duplicate error)`);
                return false;
            }
            logger_1.logger.error('Error reserving lead mapping', { auvoId, error });
            throw error;
        }
    });
}
/**
 * Atualiza o crm_id de um lead após criação bem-sucedida no CRM.
 *
 * @param auvoId - ID do cliente na Auvo
 * @param crmId - ID do lead criado no Vtiger CRM
 */
function updateLeadMapping(auvoId, crmId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prismaIntegration.$executeRaw `
      UPDATE entity_mapping 
      SET crm_id = ${crmId}, updated_at = NOW()
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
    `;
            logger_1.logger.info(`Lead mapping updated: auvo_id=${auvoId}, crm_id=${crmId}`);
        }
        catch (error) {
            logger_1.logger.error('Error updating lead mapping', { auvoId, crmId, error });
            throw error;
        }
    });
}
/**
 * Marca um lead como FAILED após erro na criação no CRM.
 *
 * @param auvoId - ID do cliente na Auvo
 */
function markLeadAsFailed(auvoId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prismaIntegration.$executeRaw `
      UPDATE entity_mapping 
      SET crm_id = ${exports.LEAD_STATUS.FAILED}, updated_at = NOW()
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
    `;
            logger_1.logger.info(`Lead ${auvoId} marked as FAILED`);
        }
        catch (error) {
            logger_1.logger.error('Error marking lead as failed', { auvoId, error });
            throw error;
        }
    });
}
/**
 * Remove a reserva de um lead (usado para permitir reprocessamento).
 *
 * @param auvoId - ID do cliente na Auvo
 */
function removeLeadReservation(auvoId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prismaIntegration.$executeRaw `
      DELETE FROM entity_mapping 
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead' 
      AND (crm_id = ${exports.LEAD_STATUS.PENDING} OR crm_id = ${exports.LEAD_STATUS.FAILED})
    `;
            logger_1.logger.info(`Lead ${auvoId} reservation removed (can be reprocessed)`);
        }
        catch (error) {
            logger_1.logger.error('Error removing lead reservation', { auvoId, error });
            throw error;
        }
    });
}
/**
 * Registra um lead processado com sucesso no banco de integração.
 * DEPRECATED: Use reserveLeadMapping + updateLeadMapping instead.
 * Mantido por compatibilidade.
 *
 * @param auvoId - ID do cliente na Auvo
 * @param crmId - ID do lead criado no Vtiger CRM
 */
function recordLeadMapping(auvoId, crmId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Verifica se já existe
            const status = yield getLeadStatus(auvoId);
            if (status.exists) {
                // Se existe, atualiza
                yield updateLeadMapping(auvoId, crmId);
            }
            else {
                // Se não existe, insere direto com crm_id
                yield prismaIntegration.$executeRaw `
          INSERT INTO entity_mapping (entity_type, auvo_id, crm_id, created_at, updated_at)
          VALUES ('lead', ${String(auvoId)}, ${crmId}, NOW(), NOW())
        `;
                logger_1.logger.info(`Lead mapping recorded: auvo_id=${auvoId}, crm_id=${crmId}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error recording lead mapping', { auvoId, crmId, error });
            throw error;
        }
    });
}
/**
 * Busca o mapeamento de um lead pelo ID da Auvo.
 *
 * @param auvoId - ID do cliente na Auvo
 * @returns O registro de mapeamento ou null se não existir
 */
function getLeadMapping(auvoId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield prismaIntegration.$queryRaw `
      SELECT * FROM entity_mapping 
      WHERE auvo_id = ${String(auvoId)} AND entity_type = 'lead'
      LIMIT 1
    `;
            return result.length > 0 ? result[0] : null;
        }
        catch (error) {
            logger_1.logger.error('Error getting lead mapping', { auvoId, error });
            throw error;
        }
    });
}
/**
 * Lista todos os leads com status PENDING ou FAILED (para reprocessamento).
 *
 * @returns Lista de registros pendentes/falhos
 */
function getPendingOrFailedLeads() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield prismaIntegration.$queryRaw `
      SELECT * FROM entity_mapping 
      WHERE entity_type = 'lead' 
      AND (crm_id = ${exports.LEAD_STATUS.PENDING} OR crm_id = ${exports.LEAD_STATUS.FAILED})
      ORDER BY created_at ASC
    `;
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error getting pending/failed leads', { error });
            throw error;
        }
    });
}
/**
 * Desconecta o cliente Prisma de integração.
 * Deve ser chamado ao finalizar a aplicação.
 */
function disconnectIntegrationDb() {
    return __awaiter(this, void 0, void 0, function* () {
        yield prismaIntegration.$disconnect();
    });
}
