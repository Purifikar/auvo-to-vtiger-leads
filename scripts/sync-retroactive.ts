/**
 * Script para executar sincronização retroativa
 * Permite especificar uma data específica para processar
 * 
 * Uso: npx ts-node scripts/sync-retroactive.ts 2025-12-10
 */

import dotenv from 'dotenv';
dotenv.config();

import { AuvoSyncService } from '../src/auvo-sync/services/auvoSyncService';
import { logger } from '../src/lib/logger';

async function main() {
    // Pega a data do argumento ou usa ontem
    const dateArg = process.argv[2];

    if (!dateArg) {
        console.log('Uso: npx ts-node scripts/sync-retroactive.ts YYYY-MM-DD');
        console.log('Exemplo: npx ts-node scripts/sync-retroactive.ts 2025-12-10');
        process.exit(1);
    }

    // Valida formato da data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
        console.error('❌ Formato de data inválido. Use YYYY-MM-DD');
        process.exit(1);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('🔄 SYNC RETROATIVO');
    console.log('='.repeat(60));
    console.log(`📅 Data a processar: ${dateArg}`);
    console.log(`🔍 Filtro Piloto: ${process.env.ENABLE_PILOT_FILTER === 'true' ? 'ATIVO' : 'DESATIVADO'}`);
    console.log('='.repeat(60));
    console.log('');

    try {
        const service = new AuvoSyncService();

        // Cria um timestamp que resulta na data especificada
        // O dateEnd será a data especificada
        const timestamp = `${dateArg}T12:00:00.000-03:00`;

        logger.info(`Starting retroactive sync for date: ${dateArg}`);

        const result = await service.sync({ timestamp });

        console.log('');
        console.log('='.repeat(60));
        console.log('📊 RESULTADO');
        console.log('='.repeat(60));
        console.log(`✅ Total de clientes encontrados: ${result.totalCustomers}`);
        console.log(`✅ Processados com sucesso: ${result.processed}`);
        console.log(`⏭️  Pulados: ${result.skipped}`);
        console.log(`❌ Erros: ${result.errors}`);
        console.log(`⏱️  Duração: ${(result.durationMs / 1000).toFixed(2)}s`);
        console.log('='.repeat(60));

        // Lista detalhes de cada resultado
        if (result.results.length > 0) {
            console.log('');
            console.log('📋 DETALHES:');
            for (const r of result.results) {
                if (r.success) {
                    console.log(`  ✅ ${r.auvoId} → Vtiger ${r.vtigerId}`);
                } else if (r.skipped) {
                    console.log(`  ⏭️  ${r.auvoId}: ${r.skipReason}`);
                } else {
                    console.log(`  ❌ ${r.auvoId}: ${r.error}`);
                }
            }
        }

        console.log('');
        process.exit(0);
    } catch (error) {
        console.error('');
        console.error('❌ ERRO:', error);
        process.exit(1);
    }
}

main();
