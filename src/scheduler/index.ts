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
import type { SyncResult } from '../auvo-sync';

// Carrega variáveis de ambiente
dotenv.config();

/**
 * Expressão cron para rodar a cada 10 minutos
 * Formato: minuto hora dia-do-mes mes dia-da-semana
 */
const CRON_EXPRESSION = process.env.SYNC_CRON_EXPRESSION || '*/10 * * * *';

/**
 * Flag para controle de execução em andamento
 * Evita execuções sobrepostas
 */
let isRunning = false;

/**
 * Estatísticas do scheduler
 */
interface SchedulerStats {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastRunAt: Date | null;
    lastResult: SyncResult | null;
    startedAt: Date;
}

const stats: SchedulerStats = {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    lastRunAt: null,
    lastResult: null,
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
 * Tipo retornado pelo cron.schedule
 */
type ScheduledTask = ReturnType<typeof cron.schedule>;

/**
 * Inicia o scheduler
 */
export function startScheduler(): ScheduledTask {
    logger.info('================================================================');
    logger.info('AUVO SYNC SCHEDULER STARTING');
    logger.info('Cron expression: ' + CRON_EXPRESSION);
    logger.info('================================================================');

    // Valida a expressão cron
    if (!cron.validate(CRON_EXPRESSION)) {
        throw new Error('Invalid cron expression: ' + CRON_EXPRESSION);
    }

    // Agenda a tarefa
    const task = cron.schedule(CRON_EXPRESSION, runSync, {
        timezone: 'America/Sao_Paulo',
    });

    logger.info('Scheduler started successfully');
    logger.info('The sync will run automatically based on the cron schedule');

    return task;
}

/**
 * Para o scheduler
 */
export function stopScheduler(task: ScheduledTask): void {
    task.stop();
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
 * Execução standalone do scheduler
 * Quando executado diretamente: node dist/scheduler/index.js
 */
if (require.main === module) {
    logger.info('================================================================');
    logger.info('AUVO TO VTIGER SYNC - SCHEDULER MODE');
    logger.info('================================================================');

    const task = startScheduler();

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
        stopScheduler(task);
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        stopScheduler(task);
        process.exit(0);
    });

    // Mantém o processo rodando
    logger.info('Scheduler is running. Press Ctrl+C to stop.');
}
