/**
 * Script para corrigir o payload de um lead (remover "undefined" dos campos)
 * e permitir reprocessamento
 */

import { prisma } from '../src/lib/prisma';
import { removeLeadReservation } from '../src/lib/prismaIntegration';

async function main() {
    const leadId = parseInt(process.argv[2] || '28');

    console.log(`\n🔧 Corrigindo payload do Lead #${leadId}...\n`);

    try {
        const lead = await prisma.leadRequest.findUnique({
            where: { id: leadId }
        });

        if (!lead) {
            console.log(`❌ Lead #${leadId} não encontrado`);
            return;
        }

        // Parsear payload
        const payloadArray = JSON.parse(lead.payload);
        const payload = payloadArray[0];

        console.log('Payload vtiger ANTES:');
        console.log(`  cf_767 (Bairro): "${payload.vtiger?.cf_767}"`);

        // Corrigir campos com "undefined"
        if (payload.vtiger) {
            for (const key of Object.keys(payload.vtiger)) {
                if (payload.vtiger[key] === 'undefined' || payload.vtiger[key] === undefined) {
                    console.log(`  Corrigindo ${key}: "undefined" -> ""`);
                    payload.vtiger[key] = '';
                }
            }
        }

        // Definir bairro: usar cidade como fallback se vazio
        if (!payload.vtiger.cf_767 || payload.vtiger.cf_767 === 'NÃO INFORMADO') {
            const cidade = payload.vtiger.city || payload.vtiger.cf_993 || '';
            if (cidade) {
                payload.vtiger.cf_767 = cidade;
                console.log(`  Definindo cf_767 (Bairro) = "${cidade}" (usando cidade como fallback)`);
            }
        }

        console.log('\nPayload vtiger DEPOIS:');
        console.log(`  cf_767 (Bairro): "${payload.vtiger?.cf_767}"`);

        // Salvar payload corrigido
        const newPayloadStr = JSON.stringify([payload]);

        await prisma.leadRequest.update({
            where: { id: leadId },
            data: {
                payload: newPayloadStr,
                status: 'PENDING',
                errorMessage: null,
            }
        });

        // Remover reserva do entity_mapping
        if (lead.auvoId) {
            console.log(`\n🗑️  Removendo reserva do entity_mapping para auvoId ${lead.auvoId}...`);
            await removeLeadReservation(lead.auvoId);
        }

        console.log(`\n✅ Lead #${leadId} corrigido e pronto para reprocessar!`);
        console.log(`\n📎 Reprocessar via:`);
        console.log(`   POST http://localhost:3000/api/lead/${leadId}/reprocess`);

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
