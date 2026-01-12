/**
 * Script para verificar dados no banco integration (entity_mapping)
 * Este banco NÃO foi afetado pela migração do Prisma
 */

import { prismaIntegration } from '../src/lib/prismaIntegration';

async function checkIntegrationData() {
    console.log('🔍 Verificando dados no banco integration...\n');

    try {
        const leads = await prismaIntegration.$queryRaw<{ total: bigint }[]>`
            SELECT COUNT(*) as total FROM entity_mapping WHERE entity_type = 'lead'
        `;

        console.log(`✅ Total de leads no entity_mapping: ${leads[0].total}`);

        // Mostrar alguns registros
        const samples = await prismaIntegration.$queryRaw<any[]>`
            SELECT * FROM entity_mapping WHERE entity_type = 'lead' ORDER BY created_at DESC LIMIT 10
        `;

        if (samples.length > 0) {
            console.log('\n📋 Últimos 10 registros:');
            samples.forEach((s, i) => {
                console.log(`  ${i + 1}. auvo_id: ${s.auvo_id}, crm_id: ${s.crm_id}, created: ${s.created_at}`);
            });
        }

    } catch (error) {
        console.error('❌ Erro ao consultar entity_mapping:', error);
    } finally {
        await prismaIntegration.$disconnect();
    }
}

checkIntegrationData();
