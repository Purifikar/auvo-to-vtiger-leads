/**
 * Script para limpar duplicidades nas tabelas
 * 
 * Este script:
 * 1. Identifica duplicatas na tabela LeadRequest (por auvoId no payload)
 * 2. Identifica duplicatas na tabela entity_mapping (por auvo_id)
 * 3. Mantém apenas o registro mais antigo ou o que tem sucesso
 * 4. Remove os duplicados
 * 
 * Executar: npx ts-node scripts/cleanup-duplicates.ts
 */

import { PrismaClient } from '@prisma/client';
import { prismaIntegration } from '../src/lib/prismaIntegration';

const prisma = new PrismaClient();

interface LeadRequestRecord {
    id: number;
    auvoId: number | null;
    status: string;
    payload: string;
    createdAt: Date;
}

interface EntityMappingRecord {
    id: number;
    auvo_id: string | null;
    crm_id: string | null;
    created_at: Date;
}

async function extractAuvoIdFromPayload(payload: string): Promise<number | null> {
    try {
        const parsed = JSON.parse(payload);
        const data = Array.isArray(parsed) ? parsed[0] : parsed;
        return data?.others?.Lead?.id || null;
    } catch {
        return null;
    }
}

async function cleanupLeadRequests() {
    console.log('\n📋 Limpando duplicatas na tabela LeadRequest...\n');

    // Buscar todos os registros
    const allLeads = await prisma.leadRequest.findMany({
        orderBy: { createdAt: 'asc' }
    });

    console.log(`Total de registros: ${allLeads.length}`);

    // Agrupar por auvoId
    const groupedByAuvoId = new Map<number, LeadRequestRecord[]>();

    for (const lead of allLeads) {
        // Tentar pegar auvoId do campo ou do payload
        let auvoId = lead.auvoId;

        if (!auvoId) {
            auvoId = await extractAuvoIdFromPayload(lead.payload);
        }

        if (auvoId) {
            const existing = groupedByAuvoId.get(auvoId) || [];
            existing.push({
                id: lead.id,
                auvoId: auvoId,
                status: lead.status,
                payload: lead.payload,
                createdAt: lead.createdAt
            });
            groupedByAuvoId.set(auvoId, existing);
        }
    }

    // Identificar grupos com duplicatas
    let duplicateGroups = 0;
    let toDelete: number[] = [];

    for (const [auvoId, records] of groupedByAuvoId) {
        if (records.length > 1) {
            duplicateGroups++;
            console.log(`\n🔴 AuvoID ${auvoId}: ${records.length} registros duplicados`);

            // Ordenar: PROCESSED primeiro, depois por data mais antiga
            records.sort((a, b) => {
                if (a.status === 'PROCESSED' && b.status !== 'PROCESSED') return -1;
                if (b.status === 'PROCESSED' && a.status !== 'PROCESSED') return 1;
                return a.createdAt.getTime() - b.createdAt.getTime();
            });

            // Manter o primeiro (PROCESSED ou mais antigo), deletar o resto
            const toKeep = records[0];
            const duplicates = records.slice(1);

            console.log(`   ✅ Manter: #${toKeep.id} (${toKeep.status}, ${toKeep.createdAt.toISOString()})`);

            for (const dup of duplicates) {
                console.log(`   ❌ Deletar: #${dup.id} (${dup.status}, ${dup.createdAt.toISOString()})`);
                toDelete.push(dup.id);
            }
        }
    }

    console.log(`\n📊 Resumo LeadRequest:`);
    console.log(`   Grupos com duplicatas: ${duplicateGroups}`);
    console.log(`   Registros a deletar: ${toDelete.length}`);

    if (toDelete.length > 0) {
        console.log('\n🗑️  Deletando duplicatas...');

        const result = await prisma.leadRequest.deleteMany({
            where: { id: { in: toDelete } }
        });

        console.log(`   ✅ Deletados: ${result.count} registros`);
    } else {
        console.log('\n✅ Nenhuma duplicata encontrada na LeadRequest');
    }

    return { duplicateGroups, deleted: toDelete.length };
}

async function cleanupEntityMapping() {
    console.log('\n📋 Limpando duplicatas na tabela entity_mapping...\n');

    // Buscar todos os registros de lead
    const allMappings = await prismaIntegration.$queryRaw<EntityMappingRecord[]>`
        SELECT id, auvo_id, crm_id, created_at 
        FROM entity_mapping 
        WHERE entity_type = 'lead'
        ORDER BY created_at ASC
    `;

    console.log(`Total de registros: ${allMappings.length}`);

    // Agrupar por auvo_id
    const groupedByAuvoId = new Map<string, EntityMappingRecord[]>();

    for (const mapping of allMappings) {
        if (mapping.auvo_id) {
            const existing = groupedByAuvoId.get(mapping.auvo_id) || [];
            existing.push(mapping);
            groupedByAuvoId.set(mapping.auvo_id, existing);
        }
    }

    // Identificar grupos com duplicatas
    let duplicateGroups = 0;
    let toDelete: number[] = [];

    for (const [auvoId, records] of groupedByAuvoId) {
        if (records.length > 1) {
            duplicateGroups++;
            console.log(`\n🔴 AuvoID ${auvoId}: ${records.length} registros duplicados`);

            // Ordenar: crm_id real primeiro, depois PENDING, depois FAILED, depois por data
            records.sort((a, b) => {
                const isRealA = a.crm_id && a.crm_id !== 'PENDING' && a.crm_id !== 'FAILED';
                const isRealB = b.crm_id && b.crm_id !== 'PENDING' && b.crm_id !== 'FAILED';

                if (isRealA && !isRealB) return -1;
                if (isRealB && !isRealA) return 1;

                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            // Manter o primeiro (com crm_id real ou mais antigo), deletar o resto
            const toKeep = records[0];
            const duplicates = records.slice(1);

            console.log(`   ✅ Manter: #${toKeep.id} (crm_id=${toKeep.crm_id})`);

            for (const dup of duplicates) {
                console.log(`   ❌ Deletar: #${dup.id} (crm_id=${dup.crm_id})`);
                toDelete.push(dup.id);
            }
        }
    }

    console.log(`\n📊 Resumo entity_mapping:`);
    console.log(`   Grupos com duplicatas: ${duplicateGroups}`);
    console.log(`   Registros a deletar: ${toDelete.length}`);

    if (toDelete.length > 0) {
        console.log('\n🗑️  Deletando duplicatas...');

        for (const id of toDelete) {
            await prismaIntegration.$executeRaw`
                DELETE FROM entity_mapping WHERE id = ${id}
            `;
        }

        console.log(`   ✅ Deletados: ${toDelete.length} registros`);
    } else {
        console.log('\n✅ Nenhuma duplicata encontrada no entity_mapping');
    }

    return { duplicateGroups, deleted: toDelete.length };
}

async function updateAuvoIdField() {
    console.log('\n📋 Atualizando campo auvoId na tabela LeadRequest...\n');

    // Buscar registros sem auvoId preenchido
    const leadsWithoutAuvoId = await prisma.leadRequest.findMany({
        where: { auvoId: null }
    });

    console.log(`Registros sem auvoId: ${leadsWithoutAuvoId.length}`);

    let updated = 0;
    let skipped = 0;

    for (const lead of leadsWithoutAuvoId) {
        const auvoId = await extractAuvoIdFromPayload(lead.payload);

        if (auvoId) {
            // Verificar se já existe outro com este auvoId
            const existing = await prisma.leadRequest.findUnique({
                where: { auvoId: auvoId }
            });

            if (!existing) {
                await prisma.leadRequest.update({
                    where: { id: lead.id },
                    data: { auvoId: auvoId }
                });
                updated++;
                console.log(`   ✅ #${lead.id}: auvoId = ${auvoId}`);
            } else {
                skipped++;
                console.log(`   ⚠️ #${lead.id}: auvoId ${auvoId} já existe em #${existing.id}`);
            }
        }
    }

    console.log(`\n📊 Resumo atualização auvoId:`);
    console.log(`   Atualizados: ${updated}`);
    console.log(`   Skipped (duplicata): ${skipped}`);

    return { updated, skipped };
}

async function main() {
    console.log('🧹 INICIANDO LIMPEZA DE DUPLICIDADES\n');
    console.log('='.repeat(60));

    try {
        // 1. Atualizar campo auvoId
        const auvoIdResult = await updateAuvoIdField();

        // 2. Limpar duplicatas na LeadRequest
        const leadResult = await cleanupLeadRequests();

        // 3. Limpar duplicatas no entity_mapping
        const mappingResult = await cleanupEntityMapping();

        console.log('\n' + '='.repeat(60));
        console.log('📈 RESUMO FINAL\n');
        console.log('LeadRequest:');
        console.log(`   - Grupos duplicados: ${leadResult.duplicateGroups}`);
        console.log(`   - Registros deletados: ${leadResult.deleted}`);
        console.log(`   - AuvoIds atualizados: ${auvoIdResult.updated}`);
        console.log('\nEntity_mapping:');
        console.log(`   - Grupos duplicados: ${mappingResult.duplicateGroups}`);
        console.log(`   - Registros deletados: ${mappingResult.deleted}`);

    } catch (error) {
        console.error('\n❌ Erro durante limpeza:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await prismaIntegration.$disconnect();
    }
}

main();
