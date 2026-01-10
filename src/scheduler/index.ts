/**
 * Auvo Sync Scheduler
 * Agendador de sincronização usando node-cron
 * 
 * Baseado no Schedule Trigger do n8n que roda a cada 10 minutos
 * 
 * Este arquivo pode ser executado de duas formas:
 * 1. Como scheduler standalone: npm run start:scheduler
 * 2. Como parte do servidor: importado e chamado manualmente
 */

import cron from 'node-cron';
import dotenv from 'dotenv';
import { logger } from '../lib/logger';
import { createAuvoSyncService, generateCurrentTimestamp } from '../auvo-sync';
import { reprocessAllFailed } from '../lib/dlqService';
import type { SyncResult } from '../auvo-sync';

// Carrega variáveis de ambiente
dotenv.config();

/**
 * Expressão cron para rodar a cada 10 minutos
 * Formato: minuto hora dia-do-mes mes dia-da-semana
 */
const CRON_EXPRESSION = process.env.SYNC_CRON_EXPRESSION || '*/10 * * * *';

/**
 * Expressão cron para reprocessamento automático (padrão: 23:00)
 */
const REPROCESS_CRON_EXPRESSION = process.env.REPROCESS_CRON_EXPRESSION || '0 23 * * *';

/**
 * Máximo de tentativas de reprocessamento por lead
 */
const MAX_RETRY_COUNT = parseInt(process.env.MAX_RETRY_COUNT || '3', 10);

/**
 * Flag para controle de execução em andamento
 * Evita execuções sobrepostas
 */
let isRunning = false;
let isReprocessing = false;

/**
 * Estatísticas do scheduler
 */
interface SchedulerStats {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastRunAt: Date | null;
    lastResult: SyncResult | null;
    reprocessStats: {
        totalRuns: number;
        lastRunAt: Date | null;
        lastResult: {
            total: number;
            success: number;
            failed: number;
        } | null;
    };
    startedAt: Date;
}

const stats: SchedulerStats = {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    lastRunAt: null,
    lastResult: null,
    reprocessStats: {
        totalRuns: 0,
        lastRunAt: null,
        lastResult: null,
    },
    startedAt: new Date(),
};

/**
 * Executa a sincronização
 */
async function runSync(): Promise<void> {
    // Evita execuções sobrepostas
    if (isRunning) {
        logger.warn('Sync already in progress, skipping this run');
        return;
    }

    isRunning = true;
    stats.totalRuns++;
    stats.lastRunAt = new Date();

    logger.info('================================================================');
    logger.info('SCHEDULED SYNC STARTED');
    logger.info('Run #' + stats.totalRuns + ' at ' + stats.lastRunAt.toISOString());
    logger.info('================================================================');

    try {
        // Gera o timestamp atual
        const timestamp = generateCurrentTimestamp();
        logger.info('Generated timestamp: ' + timestamp);

        // Cria o serviço e executa a sincronização
        const syncService = createAuvoSyncService();
        const result = await syncService.sync({ timestamp });

        stats.lastResult = result;
        stats.successfulRuns++;

        // Log do resultado
        logger.info('================================================================');
        logger.info('SCHEDULED SYNC COMPLETED');
        logger.info('Results:');
        logger.info('  Total customers found: ' + result.totalCustomers);
        logger.info('  Successfully processed: ' + result.processed);
        logger.info('  Skipped: ' + result.skipped);
        logger.info('  Errors: ' + result.errors);
        logger.info('  Duration: ' + (result.durationMs / 1000).toFixed(2) + 's');
        logger.info('================================================================');

    } catch (error) {
        stats.failedRuns++;
        logger.error('================================================================');
        logger.error('SCHEDULED SYNC FAILED');
        logger.error('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
        logger.error('================================================================');
    } finally {
        isRunning = false;
    }
}

/**
 * Executa o reprocessamento automático de leads falhos
 */
async function runAutoReprocess(): Promise<void> {
    // Evita execuções sobrepostas
    if (isReprocessing) {
        logger.warn('[DLQ] Reprocess already in progress, skipping');
        return;
    }

    isReprocessing = true;
    stats.reprocessStats.totalRuns++;
    stats.reprocessStats.lastRunAt = new Date();

    logger.info('================================================================');
    logger.info('[DLQ] AUTOMATIC REPROCESS STARTED');
    logger.info('Run at ' + stats.reprocessStats.lastRunAt.toISOString());
    logger.info('Max retry count: ' + MAX_RETRY_COUNT);
    logger.info('================================================================');

    try {
        const result = await reprocessAllFailed(MAX_RETRY_COUNT);

        stats.reprocessStats.lastResult = {
            total: result.total,
            success: result.success,
            failed: result.failed,
        };

        logger.info('================================================================');
        logger.info('[DLQ] AUTOMATIC REPROCESS COMPLETED');
        logger.info('Results:');
        logger.info('  Total attempted: ' + result.total);
        logger.info('  Success: ' + result.success);
        logger.info('  Failed: ' + result.failed);
        logger.info('  Skipped: ' + result.skipped);
        logger.info('================================================================');

    } catch (error) {
        logger.error('================================================================');
        logger.error('[DLQ] AUTOMATIC REPROCESS FAILED');
        logger.error('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
        logger.error('================================================================');
    } finally {
        isReprocessing = false;
    }
}

/**
 * Tipo retornado pelo cron.schedule
 */
type ScheduledTask = ReturnType<typeof cron.schedule>;

/**
 * Inicia o scheduler
 */
export function startScheduler(): { syncTask: ScheduledTask; reprocessTask: ScheduledTask } {
    logger.info('================================================================');
    logger.info('AUVO SYNC SCHEDULER STARTING');
    logger.info('Sync cron expression: ' + CRON_EXPRESSION);
    logger.info('Reprocess cron expression: ' + REPROCESS_CRON_EXPRESSION);
    logger.info('Max retry count: ' + MAX_RETRY_COUNT);
    logger.info('================================================================');

    // Valida as expressões cron
    if (!cron.validate(CRON_EXPRESSION)) {
        throw new Error('Invalid sync cron expression: ' + CRON_EXPRESSION);
    }
    if (!cron.validate(REPROCESS_CRON_EXPRESSION)) {
        throw new Error('Invalid reprocess cron expression: ' + REPROCESS_CRON_EXPRESSION);
    }

    // Agenda a tarefa de sync
    const syncTask = cron.schedule(CRON_EXPRESSION, runSync, {
        timezone: 'America/Sao_Paulo',
    });

    // Agenda a tarefa de reprocessamento automático
    const reprocessTask = cron.schedule(REPROCESS_CRON_EXPRESSION, runAutoReprocess, {
        timezone: 'America/Sao_Paulo',
    });

    logger.info('Scheduler started successfully');
    logger.info('The sync will run automatically based on the cron schedule');
    logger.info('Failed leads will be automatically reprocessed at 23:00');

    return { syncTask, reprocessTask };
}

/**
 * Para o scheduler
 */
export function stopScheduler(tasks: { syncTask: ScheduledTask; reprocessTask: ScheduledTask }): void {
    tasks.syncTask.stop();
    tasks.reprocessTask.stop();
    logger.info('Scheduler stopped');
}

/**
 * Obtém as estatísticas do scheduler
 */
export function getSchedulerStats(): SchedulerStats {
    return { ...stats };
}

/**
 * Executa uma sincronização manual (fora do cron)
 */
export async function runManualSync(): Promise<SyncResult> {
    logger.info('Manual sync triggered');

    const timestamp = generateCurrentTimestamp();
    const syncService = createAuvoSyncService();

    return syncService.sync({ timestamp });
}

/**
 * Executa um reprocessamento manual (fora do cron)
 */
export async function runManualReprocess(maxRetries?: number) {
    logger.info('Manual reprocess triggered');
    return reprocessAllFailed(maxRetries ?? MAX_RETRY_COUNT);
}

/**
 * Execução standalone do scheduler
 * Quando executado diretamente: node dist/scheduler/index.js
 */
if (require.main === module) {
    logger.info('================================================================');
    logger.info('AUVO TO VTIGER SYNC - SCHEDULER MODE');
    logger.info('================================================================');

    const tasks = startScheduler();

    // Executa imediatamente na primeira vez (opcional)
    const runImmediately = process.env.SYNC_RUN_IMMEDIATELY === 'true';
    if (runImmediately) {
        logger.info('Running initial sync immediately...');
        runSync().catch(err => {
            logger.error('Initial sync failed', { error: err });
        });
    }

    // Graceful shutdown
    process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        stopScheduler(tasks);
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        stopScheduler(tasks);
        process.exit(0);
    });

    // Mantém o processo rodando
    logger.info('Scheduler is running. Press Ctrl+C to stop.');
}

