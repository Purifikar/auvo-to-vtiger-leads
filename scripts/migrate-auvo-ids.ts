/**
 * Migration Script: Populate auvoId field for existing LeadRequests
 * 
 * Este script extrai o auvoId do JSON payload e popula o novo campo auvoId
 * para registros existentes que não têm o campo preenchido.
 * 
 * IMPORTANTE: Se houver duplicatas, apenas o registro mais antigo será mantido.
 * Os duplicados serão marcados com auvoId = null para não violar a constraint unique.
 * 
 * Executar: npx ts-node scripts/migrate-auvo-ids.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PayloadData {
    others?: {
        Lead?: {
            id?: number;
        };
    };
}

async function migrateAuvoIds() {
    console.log('🔄 Starting auvoId migration...\n');

    // Buscar todos os LeadRequests sem auvoId
    const leadsWithoutAuvoId = await prisma.leadRequest.findMany({
        where: {
            auvoId: null
        },
        orderBy: {
            createdAt: 'asc'  // Manter os mais antigos
        }
    });

    console.log(`📊 Found ${leadsWithoutAuvoId.length} leads without auvoId\n`);

    // Map para rastrear auvoIds já vistos (para detectar duplicatas)
    const seenAuvoIds = new Map<number, number>();  // auvoId -> leadRequestId

    let updated = 0;
    let duplicates = 0;
    let noAuvoId = 0;

    for (const lead of leadsWithoutAuvoId) {
        try {
            // Parse o payload para extrair o auvoId
            const payloadArray = JSON.parse(lead.payload) as PayloadData[];
            const auvoId = payloadArray[0]?.others?.Lead?.id;

            if (!auvoId) {
                console.log(`⚠️  Lead #${lead.id}: No auvoId found in payload`);
                noAuvoId++;
                continue;
            }

            // Verificar se já existe outro registro com este auvoId
            if (seenAuvoIds.has(auvoId)) {
                console.log(`🔴 Lead #${lead.id}: Duplicate of auvoId ${auvoId} (first seen in #${seenAuvoIds.get(auvoId)})`);
                duplicates++;
                // Não atualiza para manter o campo null (não viola unique constraint)
                continue;
            }

            // Verificar se já existe no banco com este auvoId
            const existingWithAuvoId = await prisma.leadRequest.findUnique({
                where: { auvoId: auvoId }
            });

            if (existingWithAuvoId) {
                console.log(`🔴 Lead #${lead.id}: auvoId ${auvoId} already exists in #${existingWithAuvoId.id}`);
                duplicates++;
                continue;
            }

            // Atualizar o registro
            await prisma.leadRequest.update({
                where: { id: lead.id },
                data: { auvoId: auvoId }
            });

            seenAuvoIds.set(auvoId, lead.id);
            updated++;
            console.log(`✅ Lead #${lead.id}: Updated with auvoId ${auvoId}`);

        } catch (error) {
            console.error(`❌ Lead #${lead.id}: Error parsing payload`, error);
        }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   🔴 Duplicates (skipped): ${duplicates}`);
    console.log(`   ⚠️  No auvoId in payload: ${noAuvoId}`);
    console.log(`   📊 Total processed: ${leadsWithoutAuvoId.length}`);

    if (duplicates > 0) {
        console.log('\n⚠️  ATENÇÃO: Existem leads duplicados que foram deixados com auvoId = null.');
        console.log('   Revise esses registros manualmente no Admin Panel.');
        console.log('   Os duplicados podem ser identificados buscando por leads sem auvoId.');
    }
}

async function main() {
    try {
        await migrateAuvoIds();
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
