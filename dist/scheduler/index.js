"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
exports.stopScheduler = stopScheduler;
exports.getSchedulerStats = getSchedulerStats;
exports.runManualSync = runManualSync;
const node_cron_1 = __importDefault(require("node-cron"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../lib/logger");
const auvo_sync_1 = require("../auvo-sync");
// Carrega variáveis de ambiente
dotenv_1.default.config();
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
const stats = {
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
function runSync() {
    return __awaiter(this, void 0, void 0, function* () {
        // Evita execuções sobrepostas
        if (isRunning) {
            logger_1.logger.warn('Sync already in progress, skipping this run');
            return;
        }
        isRunning = true;
        stats.totalRuns++;
        stats.lastRunAt = new Date();
        logger_1.logger.info('================================================================');
        logger_1.logger.info('SCHEDULED SYNC STARTED');
        logger_1.logger.info('Run #' + stats.totalRuns + ' at ' + stats.lastRunAt.toISOString());
        logger_1.logger.info('================================================================');
        try {
            // Gera o timestamp atual
            const timestamp = (0, auvo_sync_1.generateCurrentTimestamp)();
            logger_1.logger.info('Generated timestamp: ' + timestamp);
            // Cria o serviço e executa a sincronização
            const syncService = (0, auvo_sync_1.createAuvoSyncService)();
            const result = yield syncService.sync({ timestamp });
            stats.lastResult = result;
            stats.successfulRuns++;
            // Log do resultado
            logger_1.logger.info('================================================================');
            logger_1.logger.info('SCHEDULED SYNC COMPLETED');
            logger_1.logger.info('Results:');
            logger_1.logger.info('  Total customers found: ' + result.totalCustomers);
            logger_1.logger.info('  Successfully processed: ' + result.processed);
            logger_1.logger.info('  Skipped: ' + result.skipped);
            logger_1.logger.info('  Errors: ' + result.errors);
            logger_1.logger.info('  Duration: ' + (result.durationMs / 1000).toFixed(2) + 's');
            logger_1.logger.info('================================================================');
        }
        catch (error) {
            stats.failedRuns++;
            logger_1.logger.error('================================================================');
            logger_1.logger.error('SCHEDULED SYNC FAILED');
            logger_1.logger.error('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
            logger_1.logger.error('================================================================');
        }
        finally {
            isRunning = false;
        }
    });
}
/**
 * Inicia o scheduler
 */
function startScheduler() {
    logger_1.logger.info('================================================================');
    logger_1.logger.info('AUVO SYNC SCHEDULER STARTING');
    logger_1.logger.info('Cron expression: ' + CRON_EXPRESSION);
    logger_1.logger.info('================================================================');
    // Valida a expressão cron
    if (!node_cron_1.default.validate(CRON_EXPRESSION)) {
        throw new Error('Invalid cron expression: ' + CRON_EXPRESSION);
    }
    // Agenda a tarefa
    const task = node_cron_1.default.schedule(CRON_EXPRESSION, runSync, {
        timezone: 'America/Sao_Paulo',
    });
    logger_1.logger.info('Scheduler started successfully');
    logger_1.logger.info('The sync will run automatically based on the cron schedule');
    return task;
}
/**
 * Para o scheduler
 */
function stopScheduler(task) {
    task.stop();
    logger_1.logger.info('Scheduler stopped');
}
/**
 * Obtém as estatísticas do scheduler
 */
function getSchedulerStats() {
    return Object.assign({}, stats);
}
/**
 * Executa uma sincronização manual (fora do cron)
 */
function runManualSync() {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Manual sync triggered');
        const timestamp = (0, auvo_sync_1.generateCurrentTimestamp)();
        const syncService = (0, auvo_sync_1.createAuvoSyncService)();
        return syncService.sync({ timestamp });
    });
}
/**
 * Execução standalone do scheduler
 * Quando executado diretamente: node dist/scheduler/index.js
 */
if (require.main === module) {
    logger_1.logger.info('================================================================');
    logger_1.logger.info('AUVO TO VTIGER SYNC - SCHEDULER MODE');
    logger_1.logger.info('================================================================');
    const task = startScheduler();
    // Executa imediatamente na primeira vez (opcional)
    const runImmediately = process.env.SYNC_RUN_IMMEDIATELY === 'true';
    if (runImmediately) {
        logger_1.logger.info('Running initial sync immediately...');
        runSync().catch(err => {
            logger_1.logger.error('Initial sync failed', { error: err });
        });
    }
    // Graceful shutdown
    process.on('SIGINT', () => {
        logger_1.logger.info('Received SIGINT, shutting down gracefully...');
        stopScheduler(task);
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        logger_1.logger.info('Received SIGTERM, shutting down gracefully...');
        stopScheduler(task);
        process.exit(0);
    });
    // Mantém o processo rodando
    logger_1.logger.info('Scheduler is running. Press Ctrl+C to stop.');
}
