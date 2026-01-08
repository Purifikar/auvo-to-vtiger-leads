"use strict";
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
exports.prismaIntegration = void 0;
exports.checkLeadExists = checkLeadExists;
exports.recordLeadMapping = recordLeadMapping;
exports.getLeadMapping = getLeadMapping;
exports.disconnectIntegrationDb = disconnectIntegrationDb;
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
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
 * Verifica se um lead da Auvo já foi processado anteriormente.
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
            logger_1.logger.info(`Checking if lead ${auvoId} exists: ${exists}`);
            return exists;
        }
        catch (error) {
            logger_1.logger.error('Error checking lead existence', { auvoId, error });
            throw error;
        }
    });
}
/**
 * Registra um lead processado com sucesso no banco de integração.
 *
 * @param auvoId - ID do cliente na Auvo
 * @param crmId - ID do lead criado no Vtiger CRM
 */
function recordLeadMapping(auvoId, crmId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prismaIntegration.$executeRaw `
      INSERT INTO entity_mapping (entity_type, auvo_id, crm_id, created_at, updated_at)
      VALUES ('lead', ${String(auvoId)}, ${crmId}, NOW(), NOW())
    `;
            logger_1.logger.info(`Lead mapping recorded: auvo_id=${auvoId}, crm_id=${crmId}`);
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
 * Desconecta o cliente Prisma de integração.
 * Deve ser chamado ao finalizar a aplicação.
 */
function disconnectIntegrationDb() {
    return __awaiter(this, void 0, void 0, function* () {
        yield prismaIntegration.$disconnect();
    });
}
