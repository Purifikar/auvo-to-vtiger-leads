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

import { prisma } from './prisma';
import { logger } from './logger';
import { createLeadAutomation } from '../automation/createLead';
import { sendErrorEmail } from './email';

/**
 * Interface para estatísticas de reprocessamento
 */
export interface ReprocessStats {
    total: number;
    success: number;
    failed: number;
    skipped: number;
    details: {
        id: number;
        status: 'success' | 'failed' | 'skipped';
        vtigerId?: string;
        error?: string;
    }[];
}

/**
 * Interface para filtros de busca de leads
 */
export interface FailedLeadFilters {
    startDate?: Date;
    endDate?: Date;
    source?: string;
    minRetryCount?: number;
    maxRetryCount?: number;
}

/**
 * Busca todos os leads com status FAILED
 */
export async function getFailedLeads(filters?: FailedLeadFilters) {
    const where: any = { status: 'FAILED' };

    if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters?.source) {
        where.source = filters.source;
    }

    if (filters?.minRetryCount !== undefined) {
        where.retryCount = { ...where.retryCount, gte: filters.minRetryCount };
    }

    if (filters?.maxRetryCount !== undefined) {
        where.retryCount = { ...where.retryCount, lte: filters.maxRetryCount };
    }

    const leads = await prisma.leadRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });

    return leads.map(lead => ({
        ...lead,
        payload: JSON.parse(lead.payload),
        originalPayload: lead.originalPayload ? JSON.parse(lead.originalPayload) : null,
    }));
}

/**
 * Conta leads por status
 */
export async function getLeadStats() {
    const [failed, processed, processing, total] = await Promise.all([
        prisma.leadRequest.count({ where: { status: 'FAILED' } }),
        prisma.leadRequest.count({ where: { status: 'PROCESSED' } }),
        prisma.leadRequest.count({ where: { status: 'PROCESSING' } }),
        prisma.leadRequest.count(),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayFailed, todayProcessed] = await Promise.all([
        prisma.leadRequest.count({
            where: { status: 'FAILED', createdAt: { gte: todayStart } }
        }),
        prisma.leadRequest.count({
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
}

/**
 * Reprocessa um único lead pelo ID
 */
export async function reprocessLead(id: number): Promise<{
    success: boolean;
    vtigerId?: string;
    error?: string;
}> {
    const leadRequest = await prisma.leadRequest.findUnique({
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

    logger.info(`[DLQ] Reprocessing lead ${id} (attempt ${leadRequest.retryCount + 1})`);

    // Marca como PROCESSING
    await prisma.leadRequest.update({
        where: { id },
        data: {
            status: 'PROCESSING',
            lastRetryAt: new Date(),
        }
    });

    try {
        const payload = JSON.parse(leadRequest.payload);
        const leadData = Array.isArray(payload) ? payload[0] : payload;
        const vtigerId = await createLeadAutomation(leadData);

        // Sucesso!
        await prisma.leadRequest.update({
            where: { id },
            data: {
                status: 'PROCESSED',
                vtigerId: vtigerId,
                errorMessage: null,
                retryCount: leadRequest.retryCount + 1,
            },
        });

        logger.info(`[DLQ] Lead ${id} reprocessed successfully`, { vtigerId });
        return { success: true, vtigerId };

    } catch (error: any) {
        // Falha
        await prisma.leadRequest.update({
            where: { id },
            data: {
                status: 'FAILED',
                errorMessage: error.message || 'Unknown error',
                retryCount: leadRequest.retryCount + 1,
            },
        });

        logger.error(`[DLQ] Lead ${id} reprocessing failed`, { error: error.message });
        return { success: false, error: error.message };
    }
}

/**
 * Reprocessa múltiplos leads em lote
 */
export async function batchReprocessLeads(ids: number[]): Promise<ReprocessStats> {
    const stats: ReprocessStats = {
        total: ids.length,
        success: 0,
        failed: 0,
        skipped: 0,
        details: [],
    };

    logger.info(`[DLQ] Starting batch reprocess of ${ids.length} leads`);

    for (const id of ids) {
        try {
            const result = await reprocessLead(id);

            if (result.success) {
                stats.success++;
                stats.details.push({ id, status: 'success', vtigerId: result.vtigerId });
            } else if (result.error?.includes('already processed') || result.error?.includes('currently being')) {
                stats.skipped++;
                stats.details.push({ id, status: 'skipped', error: result.error });
            } else {
                stats.failed++;
                stats.details.push({ id, status: 'failed', error: result.error });
            }
        } catch (error: any) {
            stats.failed++;
            stats.details.push({ id, status: 'failed', error: error.message });
        }

        // Pequeno delay entre processamentos para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.info(`[DLQ] Batch reprocess completed`, {
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        skipped: stats.skipped,
    });

    return stats;
}

/**
 * Reprocessa TODOS os leads com status FAILED
 * Usado pelo job automático do final do dia
 */
export async function reprocessAllFailed(maxRetries: number = 3): Promise<ReprocessStats> {
    // Busca apenas leads que não excederam o limite de retentativas
    const failedLeads = await prisma.leadRequest.findMany({
        where: {
            status: 'FAILED',
            retryCount: { lt: maxRetries },
        },
        select: { id: true },
    });

    if (failedLeads.length === 0) {
        logger.info('[DLQ] No failed leads to reprocess');
        return {
            total: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            details: [],
        };
    }

    logger.info(`[DLQ] Found ${failedLeads.length} failed leads to reprocess (max retries: ${maxRetries})`);

    const ids = failedLeads.map(l => l.id);
    return batchReprocessLeads(ids);
}

/**
 * Atualiza o payload de um lead (para correção manual antes de reprocessar)
 * Faz merge dos campos fornecidos com o payload existente
 */
export async function updateLeadPayload(id: number, newPayload: any): Promise<{ success: boolean; error?: string }> {
    const leadRequest = await prisma.leadRequest.findUnique({
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
        mergedData = {
            ...existingData,
            vtiger: { ...existingData.vtiger, ...(newPayload.vtiger || {}) },
            others: newPayload.others ? { ...existingData.others, ...newPayload.others } : existingData.others,
        };
    } else {
        // Apenas campos vtiger, fazer merge no vtiger
        mergedData = {
            ...existingData,
            vtiger: { ...existingData.vtiger, ...newPayload },
        };
    }

    // Manter o formato original (array ou objeto)
    const finalPayload = isArray ? [mergedData] : mergedData;

    logger.info(`[DLQ] Merging payload for lead ${id}`, {
        fieldsUpdated: Object.keys(newPayload),
    });

    await prisma.leadRequest.update({
        where: { id },
        data: {
            payload: JSON.stringify(finalPayload),
            originalPayload: originalPayload,
        },
    });

    logger.info(`[DLQ] Lead ${id} payload updated`);
    return { success: true };
}

/**
 * Busca o diff entre payload original e atual
 */
export async function getPayloadDiff(id: number) {
    const leadRequest = await prisma.leadRequest.findUnique({
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
}
