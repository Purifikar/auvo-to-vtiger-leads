/**
 * Script para reprocessar um lead específico do zero
 * Remove a reserva no entity_mapping e reprocessa
 * 
 * Uso: npx ts-node scripts/reprocess-lead.ts <leadRequestId>
 */

import { prisma } from '../src/lib/prisma';
import { removeLeadReservation } from '../src/lib/prismaIntegration';
import { createLeadAutomation } from '../src/automation/createLead';
import { logger } from '../src/lib/logger';

async function main() {
    const leadId = parseInt(process.argv[2] || '28');

    console.log(`\n🔄 Reprocessando Lead #${leadId} do zero...\n`);

    try {
        // 1. Buscar o lead
        const lead = await prisma.leadRequest.findUnique({
            where: { id: leadId }
        });

        if (!lead) {
            console.log(`❌ Lead #${leadId} não encontrado`);
            return;
        }

        console.log(`📋 Lead encontrado:`);
        console.log(`   Status: ${lead.status}`);
        console.log(`   AuvoId: ${lead.auvoId}`);
        console.log(`   Source: ${lead.source}`);

        // 2. Parsear o payload
        const payloadArray = JSON.parse(lead.payload);
        const payload = payloadArray[0];

        console.log(`\n📍 Endereço da Auvo (others.Lead.address):`);
        console.log(`   "${payload.others?.Lead?.address}"`);

        console.log(`\n📋 Campos vtiger atuais:`);
        console.log(`   cf_995 (Logradouro): "${payload.vtiger?.cf_995 || '(vazio)'}"`);
        console.log(`   cf_763 (Número): "${payload.vtiger?.cf_763 || '(vazio)'}"`);
        console.log(`   cf_767 (Bairro): "${payload.vtiger?.cf_767 || '(vazio)'}"`);
        console.log(`   city: "${payload.vtiger?.city || '(vazio)'}"`);
        console.log(`   cf_977 (UF): "${payload.vtiger?.cf_977 || '(vazio)'}"`);
        console.log(`   code (CEP): "${payload.vtiger?.code || '(vazio)'}"`);

        // 3. Remover reserva do entity_mapping se existir
        if (lead.auvoId) {
            console.log(`\n🗑️  Removendo reserva do entity_mapping para auvoId ${lead.auvoId}...`);
            await removeLeadReservation(lead.auvoId);
        }

        // 4. Resetar status do lead
        console.log(`\n🔄 Resetando status do lead para PENDING...`);
        await prisma.leadRequest.update({
            where: { id: leadId },
            data: {
                status: 'PENDING',
                errorMessage: null,
                retryCount: 0,
            }
        });

        console.log(`\n✅ Lead #${leadId} pronto para reprocessamento!`);
        console.log(`\n📎 Agora você pode reprocessar via Admin Panel ou API:`);
        console.log(`   POST http://localhost:3000/api/lead/${leadId}/reprocess`);

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
