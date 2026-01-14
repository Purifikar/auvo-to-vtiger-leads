/**
 * Script para testar o resultado do Google Maps para um lead específico
 * Mostra a resposta bruta da API do Google
 */

import { prisma } from '../src/lib/prisma';
import { reverseGeocode, parseGoogleAddress } from '../src/auvo-sync/helpers/googleMapsHelper';

async function main() {
    const leadId = parseInt(process.argv[2] || '57');

    console.log(`\n🔍 Testando Google Maps para Lead #${leadId}...\n`);

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

        const latitude = payload.others?.Lead?.latitude;
        const longitude = payload.others?.Lead?.longitude;
        const auvoAddress = payload.others?.Lead?.address;

        console.log('📍 Dados do Lead:');
        console.log(`   Endereço Auvo: "${auvoAddress}"`);
        console.log(`   Latitude: ${latitude}`);
        console.log(`   Longitude: ${longitude}`);

        if (!latitude || !longitude) {
            console.log('\n❌ Lead não possui coordenadas válidas');
            return;
        }

        console.log('\n📡 Chamando Google Maps API...\n');

        // Chamar a API do Google
        const googleResponse = await reverseGeocode(latitude, longitude);

        console.log('='.repeat(60));
        console.log('📦 RESPOSTA BRUTA DO GOOGLE');
        console.log('='.repeat(60));

        // Mostrar os componentes de endereço
        for (let i = 0; i < Math.min(3, googleResponse.results.length); i++) {
            const result = googleResponse.results[i];
            console.log(`\n--- Resultado ${i + 1} ---`);
            console.log(`Endereço formatado: "${result.formatted_address}"`);
            console.log('\nComponentes:');

            for (const component of result.address_components) {
                console.log(`  ${component.types.join(', ')}:`);
                console.log(`    long_name:  "${component.long_name}"`);
                console.log(`    short_name: "${component.short_name}"`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📋 RESULTADO PARSEADO PARA VTIGER');
        console.log('='.repeat(60));

        const parsedAddress = parseGoogleAddress(googleResponse);
        console.log('\nCampos:');
        console.log(`  cf_995 (Logradouro): "${parsedAddress.cf_995}"`);
        console.log(`  cf_763 (Número): "${parsedAddress.cf_763}"`);
        console.log(`  cf_767 (Bairro): "${parsedAddress.cf_767}"`);
        console.log(`  city: "${parsedAddress.city}"`);
        console.log(`  cf_993 (Cidade Real): "${parsedAddress.cf_993}"`);
        console.log(`  state: "${parsedAddress.state}"`);
        console.log(`  cf_977 (UF): "${parsedAddress.cf_977}"`);
        console.log(`  code (CEP): "${parsedAddress.code}"`);
        console.log(`  country: "${parsedAddress.country}"`);

        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPARAÇÃO: Payload Atual vs Google');
        console.log('='.repeat(60));
        console.log(`\n  city no payload: "${payload.vtiger?.city}"`);
        console.log(`  city do Google:  "${parsedAddress.city}"`);
        console.log(`\n  cf_993 no payload: "${payload.vtiger?.cf_993}"`);
        console.log(`  cf_993 do Google:  "${parsedAddress.cf_993}"`);

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
