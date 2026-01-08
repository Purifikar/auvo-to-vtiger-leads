/**
 * Script para executar sincronização manual
 * Uso: npx ts-node scripts/sync-now.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { runManualSync } from '../src/scheduler';
import { logger } from '../src/lib/logger';

async function main() {
    logger.info('================================================================');
    logger.info('MANUAL SYNC EXECUTION');
    logger.info('================================================================');

    try {
        const result = await runManualSync();

        logger.info('================================================================');
        logger.info('SYNC COMPLETED SUCCESSFULLY');
        logger.info('================================================================');

        console.log('\nResult Summary:');
        console.log('  Timestamp:', result.timestamp);
        console.log('  Date Range:', result.dateRange.dateStart, 'to', result.dateRange.dateEnd);
        console.log('  Total Customers:', result.totalCustomers);
        console.log('  Processed:', result.processed);
        console.log('  Skipped:', result.skipped);
        console.log('  Errors:', result.errors);
        console.log('  Duration:', (result.durationMs / 1000).toFixed(2) + 's');

        // Detalhes dos resultados
        if (result.results.length > 0) {
            console.log('\nDetails:');
            for (const r of result.results) {
                const status = r.success ? 'SUCCESS' : (r.skipped ? 'SKIPPED' : 'ERROR');
                const detail = r.vtigerId || r.skipReason || r.error || '';
                console.log(`  [${status}] Auvo ID ${r.auvoId}: ${detail}`);
            }
        }

    } catch (error) {
        logger.error('SYNC FAILED', { error });
        console.error('\nError:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
