"use strict";
/**
 * Auvo Sync Types
 * Interfaces TypeScript baseadas no workflow n8n para a integração Auvo -> Vtiger
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSULTOR_JOB_POSITION = void 0;
exports.getPilotFilterConfig = getPilotFilterConfig;
exports.getGeocodingFilterConfig = getGeocodingFilterConfig;
exports.getAuvoConfig = getAuvoConfig;
exports.getSyncServiceConfig = getSyncServiceConfig;
exports.isUserAllowed = isUserAllowed;
exports.shouldApplyGeocoding = shouldApplyGeocoding;
// =============================================================================
// CONFIGURATION HELPERS
// =============================================================================
/**
 * Parseia uma string de IDs separados por vírgula em um array de números
 * @param idsString - String com IDs separados por vírgula (ex: "213670,123456")
 * @returns Array de números
 */
function parseIdsList(idsString) {
    if (!idsString)
        return [];
    return idsString
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));
}
/**
 * Parseia string para boolean
 */
function parseBoolean(value, defaultValue = false) {
    if (!value)
        return defaultValue;
    return value.toLowerCase() === 'true';
}
/**
 * Obtém a configuração do filtro piloto das variáveis de ambiente
 */
function getPilotFilterConfig() {
    return {
        enabled: parseBoolean(process.env.ENABLE_PILOT_FILTER, true),
        pilotUserIds: parseIdsList(process.env.PILOT_USER_IDS),
    };
}
/**
 * Obtém a configuração do filtro de geocoding das variáveis de ambiente
 */
function getGeocodingFilterConfig() {
    return {
        enabled: parseBoolean(process.env.ENABLE_GEOCODING_FILTER, true),
        geocodingUserIds: parseIdsList(process.env.GEOCODING_USER_IDS),
    };
}
/**
 * Obtém a configuração completa do Auvo das variáveis de ambiente
 */
function getAuvoConfig() {
    const apiKey = process.env.AUVO_API_KEY;
    const apiToken = process.env.AUVO_API_TOKEN;
    const apiUrl = process.env.AUVO_API_URL || 'https://api.auvo.com.br/v2';
    if (!apiKey || !apiToken) {
        throw new Error('AUVO_API_KEY e AUVO_API_TOKEN devem estar configurados nas variáveis de ambiente');
    }
    return { apiKey, apiToken, apiUrl };
}
/**
 * Obtém a configuração completa do serviço de sincronização
 */
function getSyncServiceConfig() {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsApiKey) {
        throw new Error('GOOGLE_MAPS_API_KEY deve estar configurada nas variáveis de ambiente');
    }
    return {
        auvo: getAuvoConfig(),
        googleMaps: { apiKey: googleMapsApiKey },
        pilotFilter: getPilotFilterConfig(),
        geocodingFilter: getGeocodingFilterConfig(),
    };
}
/**
 * Verifica se um usuário está na lista de pilotos
 * @param userId - ID do usuário a verificar
 * @param config - Configuração do filtro piloto
 * @returns true se o filtro está desabilitado OU se o usuário está na lista
 */
function isUserAllowed(userId, config) {
    // Se filtro desabilitado, todos os usuários são permitidos
    if (!config.enabled)
        return true;
    // Se habilitado, verifica se está na lista
    return config.pilotUserIds.includes(userId);
}
/**
 * Verifica se geocoding deve ser aplicado para um usuário
 * @param userId - ID do usuário a verificar
 * @param config - Configuração do filtro de geocoding
 * @returns true se o filtro está desabilitado OU se o usuário está na lista
 */
function shouldApplyGeocoding(userId, config) {
    // Se filtro desabilitado, aplica geocoding para todos
    if (!config.enabled)
        return true;
    // Se habilitado, verifica se está na lista
    return config.geocodingUserIds.includes(userId);
}
/**
 * Cargo que filtramos para processamento
 */
exports.CONSULTOR_JOB_POSITION = 'Consultor';
