/**
 * Payload Validator
 * Valida os campos obrigatórios do payload antes de enviar para o CRM
 */

import { VtigerLeadData } from '../auvo-sync/types';

/**
 * Campos obrigatórios do Vtiger com seus nomes amigáveis
 */
export const REQUIRED_FIELDS: { [key: string]: string } = {
    leadstatus: 'Status do Lead',
    company: 'Empresa',
    leadsource: 'Fonte do Lead',
    description: 'Descrição',
    lastname: 'Sobrenome',
    cf_995: 'Logradouro',
    cf_763: 'Número',
    cf_767: 'Bairro',
    city: 'Cidade',
    cf_993: 'Cidade Real',
    state: 'Estado',
    cf_977: 'UF',
    code: 'CEP',
    country: 'País',
};

/**
 * Campos opcionais (não geram erro se vazios)
 */
export const OPTIONAL_FIELDS: (keyof VtigerLeadData)[] = [
    'phone',
    'email',
    'cf_765', // Complemento
    'assigned_user_id',
];

/**
 * Resultado da validação
 */
export interface ValidationResult {
    isValid: boolean;
    missingFields: string[];
    missingFieldNames: string[];
    emptyFields: string[];
    emptyFieldNames: string[];
}

/**
 * Valida se todos os campos obrigatórios estão preenchidos no payload
 * 
 * @param vtigerData - Dados do lead para o Vtiger
 * @returns Resultado da validação com campos faltantes
 */
export function validatePayload(vtigerData: VtigerLeadData): ValidationResult {
    const missingFields: string[] = [];
    const missingFieldNames: string[] = [];
    const emptyFields: string[] = [];
    const emptyFieldNames: string[] = [];

    for (const [field, friendlyName] of Object.entries(REQUIRED_FIELDS)) {
        const value = vtigerData[field as keyof VtigerLeadData];

        if (value === undefined) {
            missingFields.push(field);
            missingFieldNames.push(friendlyName);
        } else if (value === null || value === '') {
            emptyFields.push(field);
            emptyFieldNames.push(friendlyName);
        }
    }

    const isValid = missingFields.length === 0 && emptyFields.length === 0;

    return {
        isValid,
        missingFields,
        missingFieldNames,
        emptyFields,
        emptyFieldNames,
    };
}

/**
 * Formata mensagem de erro com campos faltantes
 */
export function formatValidationError(result: ValidationResult): string {
    const parts: string[] = [];

    if (result.missingFields.length > 0) {
        parts.push(`Campos faltando: ${result.missingFieldNames.join(', ')}`);
    }

    if (result.emptyFields.length > 0) {
        parts.push(`Campos vazios: ${result.emptyFieldNames.join(', ')}`);
    }

    return parts.join('. ');
}

/**
 * Extrai endereço estruturado de uma string de endereço da Auvo
 * 
 * Formatos comuns da Auvo:
 * - "Rod. Fernão Dias, 381 - ZONA RURAL, São Sebastião da Bela Vista - MG, 37567-000, Brasil"
 * - "Rua das Flores, 123, Centro, Cidade - UF, CEP, Brasil"
 * - "Local, Bairro, Cidade - UF, Brasil"
 * 
 * @param auvoAddress - Endereço completo da Auvo
 * @returns Objeto com campos parseados
 */
export function parseAuvoAddress(auvoAddress: string): {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    uf: string;
    cep: string;
    pais: string;
} {
    const result = {
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        uf: '',
        cep: '',
        pais: 'Brasil',
    };

    if (!auvoAddress) return result;

    // Divide o endereço por vírgula
    const parts = auvoAddress.split(',').map(p => p.trim());

    // Padrão: "Rua X, 123 - Bairro, Cidade - UF, CEP, Brasil"
    // Ou: "Rua X, 123, Bairro, Cidade - UF, CEP, Brasil"

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // CEP (formato brasileiro: 00000-000 ou 00000000)
        const cepMatch = part.match(/(\d{5}-?\d{3})/);
        if (cepMatch) {
            result.cep = cepMatch[1];
            continue;
        }

        // Brasil/Brazil
        if (/^brasil$/i.test(part) || /^brazil$/i.test(part)) {
            result.pais = 'Brasil';
            continue;
        }

        // Cidade - UF (ex: "São Sebastião da Bela Vista - MG")
        const cidadeUfMatch = part.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
        if (cidadeUfMatch) {
            result.cidade = cidadeUfMatch[1].trim();
            result.uf = cidadeUfMatch[2];
            result.estado = getStateName(cidadeUfMatch[2]);
            continue;
        }

        // Primeira parte geralmente é logradouro com número
        if (i === 0) {
            // Pode ter "Rua X, 123 - Bairro" ou "Rua X"
            const logradouroNumBairro = part.match(/^(.+?),?\s*(\d+)?\s*-?\s*(.+)?$/);
            if (logradouroNumBairro) {
                result.logradouro = logradouroNumBairro[1]?.trim() || '';
                if (logradouroNumBairro[2]) {
                    result.numero = logradouroNumBairro[2];
                }
                if (logradouroNumBairro[3]) {
                    result.bairro = logradouroNumBairro[3].trim();
                }
            } else {
                result.logradouro = part;
            }
            continue;
        }

        // Segunda parte pode ser número ou bairro
        if (i === 1) {
            // Se for só número
            if (/^\d+$/.test(part)) {
                result.numero = part;
                continue;
            }

            // Se tiver "número - bairro" 
            const numBairroMatch = part.match(/^(\d+)\s*-\s*(.+)$/);
            if (numBairroMatch) {
                result.numero = numBairroMatch[1];
                result.bairro = numBairroMatch[2].trim();
                continue;
            }

            // Se não for cidade-UF e não for número, provavelmente é bairro
            if (!result.bairro && !part.includes(' - ')) {
                result.bairro = part;
            }
            continue;
        }

        // Terceira parte em diante - provavelmente bairro se ainda não identificado
        if (!result.bairro && !part.includes(' - ') && !/^\d+$/.test(part)) {
            result.bairro = part.toUpperCase();
        }
    }

    return result;
}

/**
 * Converte sigla do estado para nome completo
 */
export function getStateName(uf: string): string {
    const states: Record<string, string> = {
        'AC': 'Acre',
        'AL': 'Alagoas',
        'AP': 'Amapá',
        'AM': 'Amazonas',
        'BA': 'Bahia',
        'CE': 'Ceará',
        'DF': 'Distrito Federal',
        'ES': 'Espírito Santo',
        'GO': 'Goiás',
        'MA': 'Maranhão',
        'MT': 'Mato Grosso',
        'MS': 'Mato Grosso do Sul',
        'MG': 'Minas Gerais',
        'PA': 'Pará',
        'PB': 'Paraíba',
        'PR': 'Paraná',
        'PE': 'Pernambuco',
        'PI': 'Piauí',
        'RJ': 'Rio de Janeiro',
        'RN': 'Rio Grande do Norte',
        'RS': 'Rio Grande do Sul',
        'RO': 'Rondônia',
        'RR': 'Roraima',
        'SC': 'Santa Catarina',
        'SP': 'São Paulo',
        'SE': 'Sergipe',
        'TO': 'Tocantins',
    };

    return states[uf.toUpperCase()] || '';
}

/**
 * Formata log dos campos que serão preenchidos
 */
export function logPayloadFields(vtigerData: VtigerLeadData): void {
    console.log('\n📋 Campos do payload:');
    console.log('='.repeat(50));

    for (const [field, friendlyName] of Object.entries(REQUIRED_FIELDS)) {
        const value = vtigerData[field as keyof VtigerLeadData];
        const status = value ? '✅' : '❌';
        const displayValue = value ? `"${value}"` : '(vazio)';
        console.log(`${status} ${friendlyName} (${field}): ${displayValue}`);
    }

    console.log('='.repeat(50));
}
