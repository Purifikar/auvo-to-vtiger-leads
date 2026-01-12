"use strict";
/**
 * Dead Letter Queue (DLQ) Service
 *
 * Gerencia o reprocessamento de leads que falharam.
 * Funcionalidades:
 * - Listar leads com erro
 * - Reprocessar leads individuais ou em lote
 * - Editar payload de leads falhos
 * - Reprocessamento automático no final do dia
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
exports.getFailedLeads = getFailedLeads;
exports.getLeadStats = getLeadStats;
exports.reprocessLead = reprocessLead;
exports.batchReprocessLeads = batchReprocessLeads;
exports.reprocessAllFailed = reprocessAllFailed;
exports.updateLeadPayload = updateLeadPayload;
exports.getPayloadDiff = getPayloadDiff;
const prisma_1 = require("./prisma");
const logger_1 = require("./logger");
const createLead_1 = require("../automation/createLead");
/**
 * Busca todos os leads com status FAILED
 */
function getFailedLeads(filters) {
    return __awaiter(this, void 0, void 0, function* () {
        const where = { status: 'FAILED' };
        if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
            where.createdAt = {};
            if (filters.startDate)
                where.createdAt.gte = filters.startDate;
            if (filters.endDate)
                where.createdAt.lte = filters.endDate;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.source) {
            where.source = filters.source;
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.minRetryCount) !== undefined) {
            where.retryCount = Object.assign(Object.assign({}, where.retryCount), { gte: filters.minRetryCount });
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.maxRetryCount) !== undefined) {
            where.retryCount = Object.assign(Object.assign({}, where.retryCount), { lte: filters.maxRetryCount });
        }
        const leads = yield prisma_1.prisma.leadRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return leads.map(lead => (Object.assign(Object.assign({}, lead), { payload: JSON.parse(lead.payload), originalPayload: lead.originalPayload ? JSON.parse(lead.originalPayload) : null })));
    });
}
/**
 * Conta leads por status
 */
function getLeadStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const [failed, processed, processing, total] = yield Promise.all([
            prisma_1.prisma.leadRequest.count({ where: { status: 'FAILED' } }),
            prisma_1.prisma.leadRequest.count({ where: { status: 'PROCESSED' } }),
            prisma_1.prisma.leadRequest.count({ where: { status: 'PROCESSING' } }),
            prisma_1.prisma.leadRequest.count(),
        ]);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [todayFailed, todayProcessed] = yield Promise.all([
            prisma_1.prisma.leadRequest.count({
                where: { status: 'FAILED', createdAt: { gte: todayStart } }
            }),
            prisma_1.prisma.leadRequest.count({
                where: { status: 'PROCESSED', createdAt: { gte: todayStart } }
            }),
        ]);
        return {
            total,
            failed,
            processed,
            processing,
            today: {
                failed: todayFailed,
                processed: todayProcessed,
            },
            successRate: total > 0 ? ((processed / total) * 100).toFixed(2) + '%' : '0%',
        };
    });
}
/**
 * Reprocessa um único lead pelo ID
 */
function reprocessLead(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const leadRequest = yield prisma_1.prisma.leadRequest.findUnique({
            where: { id }
        });
        if (!leadRequest) {
            return { success: false, error: 'Lead not found' };
        }
        if (leadRequest.status === 'PROCESSED') {
            return { success: false, error: 'Lead already processed', vtigerId: leadRequest.vtigerId || undefined };
        }
        if (leadRequest.status === 'PROCESSING') {
            return { success: false, error: 'Lead is currently being processed' };
        }
        logger_1.logger.info(`[DLQ] Reprocessing lead ${id} (attempt ${leadRequest.retryCount + 1})`);
        // Marca como PROCESSING
        yield prisma_1.prisma.leadRequest.update({
            where: { id },
            data: {
                status: 'PROCESSING',
                lastRetryAt: new Date(),
            }
        });
        try {
            const payload = JSON.parse(leadRequest.payload);
            const leadData = Array.isArray(payload) ? payload[0] : payload;
            const vtigerId = yield (0, createLead_1.createLeadAutomation)(leadData);
            // Sucesso!
            yield prisma_1.prisma.leadRequest.update({
                where: { id },
                data: {
                    status: 'PROCESSED',
                    vtigerId: vtigerId,
                    errorMessage: null,
                    retryCount: leadRequest.retryCount + 1,
                },
            });
            logger_1.logger.info(`[DLQ] Lead ${id} reprocessed successfully`, { vtigerId });
            return { success: true, vtigerId };
        }
        catch (error) {
            // Falha
            yield prisma_1.prisma.leadRequest.update({
                where: { id },
                data: {
                    status: 'FAILED',
                    errorMessage: error.message || 'Unknown error',
                    retryCount: leadRequest.retryCount + 1,
                },
            });
            logger_1.logger.error(`[DLQ] Lead ${id} reprocessing failed`, { error: error.message });
            return { success: false, error: error.message };
        }
    });
}
/**
 * Reprocessa múltiplos leads em lote
 */
function batchReprocessLeads(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const stats = {
            total: ids.length,
            success: 0,
            failed: 0,
            skipped: 0,
            details: [],
        };
        logger_1.logger.info(`[DLQ] Starting batch reprocess of ${ids.length} leads`);
        for (const id of ids) {
            try {
                const result = yield reprocessLead(id);
                if (result.success) {
                    stats.success++;
                    stats.details.push({ id, status: 'success', vtigerId: result.vtigerId });
                }
                else if (((_a = result.error) === null || _a === void 0 ? void 0 : _a.includes('already processed')) || ((_b = result.error) === null || _b === void 0 ? void 0 : _b.includes('currently being'))) {
                    stats.skipped++;
                    stats.details.push({ id, status: 'skipped', error: result.error });
                }
                else {
                    stats.failed++;
                    stats.details.push({ id, status: 'failed', error: result.error });
                }
            }
            catch (error) {
                stats.failed++;
                stats.details.push({ id, status: 'failed', error: error.message });
            }
            // Pequeno delay entre processamentos para não sobrecarregar
            yield new Promise(resolve => setTimeout(resolve, 500));
        }
        logger_1.logger.info(`[DLQ] Batch reprocess completed`, {
            total: stats.total,
            success: stats.success,
            failed: stats.failed,
            skipped: stats.skipped,
        });
        return stats;
    });
}
/**
 * Reprocessa TODOS os leads com status FAILED
 * Usado pelo job automático do final do dia
 */
function reprocessAllFailed() {
    return __awaiter(this, arguments, void 0, function* (maxRetries = 3) {
        // Busca apenas leads que não excederam o limite de retentativas
        const failedLeads = yield prisma_1.prisma.leadRequest.findMany({
            where: {
                status: 'FAILED',
                retryCount: { lt: maxRetries },
            },
            select: { id: true },
        });
        if (failedLeads.length === 0) {
            logger_1.logger.info('[DLQ] No failed leads to reprocess');
            return {
                total: 0,
                success: 0,
                failed: 0,
                skipped: 0,
                details: [],
            };
        }
        logger_1.logger.info(`[DLQ] Found ${failedLeads.length} failed leads to reprocess (max retries: ${maxRetries})`);
        const ids = failedLeads.map(l => l.id);
        return batchReprocessLeads(ids);
    });
}
/**
 * Atualiza o payload de um lead (para correção manual antes de reprocessar)
 * Faz merge dos campos fornecidos com o payload existente
 */
function updateLeadPayload(id, newPayload) {
    return __awaiter(this, void 0, void 0, function* () {
        const leadRequest = yield prisma_1.prisma.leadRequest.findUnique({
            where: { id }
        });
        if (!leadRequest) {
            return { success: false, error: 'Lead not found' };
        }
        // Salva o payload original se ainda não foi salvo
        const originalPayload = leadRequest.originalPayload || leadRequest.payload;
        // Parse o payload existente
        const existingPayload = JSON.parse(leadRequest.payload);
        // Se o payload existente é um array, trabalhamos com o primeiro elemento
        const isArray = Array.isArray(existingPayload);
        const existingData = isArray ? existingPayload[0] : existingPayload;
        // Fazer merge inteligente
        // Se newPayload tem a estrutura completa (vtiger, others), usar ela
        // Senão, assumir que são campos para serem mesclados no vtiger
        let mergedData;
        if (newPayload.vtiger || newPayload.others) {
            // Payload completo, fazer merge profundo
            mergedData = Object.assign(Object.assign({}, existingData), { vtiger: Object.assign(Object.assign({}, existingData.vtiger), (newPayload.vtiger || {})), others: newPayload.others ? Object.assign(Object.assign({}, existingData.others), newPayload.others) : existingData.others });
        }
        else {
            // Apenas campos vtiger, fazer merge no vtiger
            mergedData = Object.assign(Object.assign({}, existingData), { vtiger: Object.assign(Object.assign({}, existingData.vtiger), newPayload) });
        }
        // Manter o formato original (array ou objeto)
        const finalPayload = isArray ? [mergedData] : mergedData;
        logger_1.logger.info(`[DLQ] Merging payload for lead ${id}`, {
            fieldsUpdated: Object.keys(newPayload),
        });
        yield prisma_1.prisma.leadRequest.update({
            where: { id },
            data: {
                payload: JSON.stringify(finalPayload),
                originalPayload: originalPayload,
            },
        });
        logger_1.logger.info(`[DLQ] Lead ${id} payload updated`);
        return { success: true };
    });
}
/**
 * Busca o diff entre payload original e atual
 */
function getPayloadDiff(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const leadRequest = yield prisma_1.prisma.leadRequest.findUnique({
            where: { id }
        });
        if (!leadRequest) {
            return null;
        }
        return {
            current: JSON.parse(leadRequest.payload),
            original: leadRequest.originalPayload ? JSON.parse(leadRequest.originalPayload) : null,
            hasChanges: leadRequest.originalPayload !== null && leadRequest.originalPayload !== leadRequest.payload,
        };
    });
}
