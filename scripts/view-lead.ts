/**
 * Script simples para ver o payload de um lead
 */

import { prisma } from '../src/lib/prisma';

async function main() {
    const leadId = parseInt(process.argv[2] || '28');

    const lead = await prisma.leadRequest.findUnique({
        where: { id: leadId }
    });

    if (!lead) {
        console.log(`Lead #${leadId} não encontrado`);
        return;
    }

    const payloadArray = JSON.parse(lead.payload);
    const payload = payloadArray[0];

    console.log('='.repeat(60));
    console.log(`LEAD #${leadId}`);
    console.log('='.repeat(60));
    console.log(`Status: ${lead.status}`);
    console.log(`AuvoId: ${lead.auvoId}`);
    console.log(`Source: ${lead.source}`);
    console.log('');
    console.log('--- ENDEREÇO DA AUVO ---');
    console.log(`Lead.address: "${payload.others?.Lead?.address}"`);
    console.log('');
    console.log('--- CAMPOS VTIGER ---');
    console.log(`leadstatus: "${payload.vtiger?.leadstatus}"`);
    console.log(`company: "${payload.vtiger?.company}"`);
    console.log(`lastname: "${payload.vtiger?.lastname}"`);
    console.log(`phone: "${payload.vtiger?.phone}"`);
    console.log(`email: "${payload.vtiger?.email}"`);
    console.log(`cf_995 (Logradouro): "${payload.vtiger?.cf_995}"`);
    console.log(`cf_763 (Número): "${payload.vtiger?.cf_763}"`);
    console.log(`cf_767 (Bairro): "${payload.vtiger?.cf_767}"`);
    console.log(`cf_765 (Complemento): "${payload.vtiger?.cf_765}"`);
    console.log(`city: "${payload.vtiger?.city}"`);
    console.log(`cf_993 (Cidade Real): "${payload.vtiger?.cf_993}"`);
    console.log(`state: "${payload.vtiger?.state}"`);
    console.log(`cf_977 (UF): "${payload.vtiger?.cf_977}"`);
    console.log(`code (CEP): "${payload.vtiger?.code}"`);
    console.log(`country: "${payload.vtiger?.country}"`);
    console.log('='.repeat(60));

    await prisma.$disconnect();
}

main();
