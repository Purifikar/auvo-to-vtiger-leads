"use strict";
/**
 * Google Maps Helper
 * Geocoding Reverso + Parser de endereço
 * Baseado nos nós "Google Geocoding Reverse" e "parse Google address" do n8n
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseGeocode = reverseGeocode;
exports.parseGoogleAddress = parseGoogleAddress;
exports.getAddressFromCoordinates = getAddressFromCoordinates;
exports.areCoordinatesValid = areCoordinatesValid;
const logger_1 = require("../../lib/logger");
/**
 * URL base da API do Google Geocoding
 */
const GOOGLE_GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
/**
 * Idioma padrão para as respostas do Google
 */
const DEFAULT_LANGUAGE = 'pt-BR';
/**
 * Configuração padrão do Google Maps
 * A API Key deve ser configurada via variável de ambiente
 */
function getGoogleMapsConfig() {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_MAPS_API_KEY não está configurada nas variáveis de ambiente');
    }
    return { apiKey };
}
/**
 * Realiza o Geocoding Reverso usando latitude e longitude.
 *
 * @param latitude - Latitude do endereço
 * @param longitude - Longitude do endereço
 * @returns Resposta da API Google Geocoding
 *
 * @throws Error se a chamada à API falhar
 */
function reverseGeocode(latitude, longitude) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = getGoogleMapsConfig();
        const url = new URL(GOOGLE_GEOCODING_API_URL);
        url.searchParams.append('latlng', `${latitude},${longitude}`);
        url.searchParams.append('key', config.apiKey);
        url.searchParams.append('language', DEFAULT_LANGUAGE);
        logger_1.logger.info('Calling Google Geocoding API', { latitude, longitude });
        try {
            const response = yield fetch(url.toString());
            if (!response.ok) {
                throw new Error(`Google Geocoding API error: ${response.status} ${response.statusText}`);
            }
            const data = yield response.json();
            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                throw new Error(`Google Geocoding API returned status: ${data.status}`);
            }
            logger_1.logger.info('Google Geocoding API response received', {
                status: data.status,
                resultsCount: data.results.length
            });
            return data;
        }
        catch (error) {
            logger_1.logger.error('Google Geocoding API call failed', { error, latitude, longitude });
            throw error;
        }
    });
}
/**
 * Parseia a resposta do Google Geocoding para extrair os componentes do endereço.
 *
 * Lógica baseada no nó "parse Google address" do n8n:
 * - Itera sobre os 3 primeiros resultados
 * - Para cada componente de endereço, mapeia para os campos do Vtiger
 * - Usa o primeiro valor encontrado para cada tipo
 *
 * @param geocodingResponse - Resposta da API Google Geocoding
 * @returns Endereço parseado no formato do Vtiger
 */
function parseGoogleAddress(geocodingResponse) {
    const result = {
        cf_995: '', // Logradouro
        cf_763: '', // Número
        cf_767: '', // Bairro
        city: '', // Cidade (Google Maps)
        cf_993: '', // Cidade Real
        state: '', // Estado (nome completo)
        cf_977: '', // UF (sigla)
        code: '', // CEP
        country: '', // País
    };
    const results = geocodingResponse.results || [];
    // Processa apenas os 3 primeiros resultados (como no n8n)
    for (const googleResult of results.slice(0, 3)) {
        for (const component of googleResult.address_components) {
            for (const type of component.types) {
                const typeLower = type.toLowerCase();
                switch (typeLower) {
                    case 'route':
                        // Logradouro - usa short_name
                        if (!result.cf_995) {
                            result.cf_995 = component.short_name;
                        }
                        break;
                    case 'street_number':
                        // Número - usa short_name
                        if (!result.cf_763) {
                            result.cf_763 = component.short_name;
                        }
                        break;
                    case 'sublocality_level_1':
                        // Bairro - usa short_name
                        if (!result.cf_767) {
                            result.cf_767 = component.short_name;
                        }
                        break;
                    case 'administrative_area_level_2':
                        // Cidade - usa long_name para nome completo (evita abreviações como "Cel." em vez de "Coronel")
                        if (!result.city) {
                            result.city = component.long_name;
                        }
                        if (!result.cf_993) {
                            result.cf_993 = component.long_name;
                        }
                        break;
                    case 'administrative_area_level_1':
                        // Estado - long_name para nome completo, short_name para UF
                        if (!result.state) {
                            result.state = component.long_name;
                        }
                        if (!result.cf_977) {
                            result.cf_977 = component.short_name;
                        }
                        break;
                    case 'postal_code':
                        // CEP - usa long_name
                        if (!result.code) {
                            result.code = component.long_name;
                        }
                        break;
                    case 'country':
                        // País - usa long_name
                        if (!result.country) {
                            result.country = component.long_name;
                        }
                        break;
                }
            }
        }
    }
    logger_1.logger.info('Address parsed from Google Geocoding', { result });
    return result;
}
/**
 * Função combinada que realiza o geocoding reverso e parseia o endereço.
 *
 * @param latitude - Latitude do endereço
 * @param longitude - Longitude do endereço
 * @returns Endereço parseado no formato do Vtiger
 *
 * @example
 * ```typescript
 * const address = await getAddressFromCoordinates(-19.4617, -42.55914);
 * // {
 * //   cf_995: 'Av. Carlos Chagas',
 * //   cf_763: '886',
 * //   cf_767: 'Cidade Nobre',
 * //   city: 'Ipatinga',
 * //   cf_993: 'Ipatinga',
 * //   state: 'Minas Gerais',
 * //   cf_977: 'MG',
 * //   code: '35162-359',
 * //   country: 'Brasil'
 * // }
 * ```
 */
function getAddressFromCoordinates(latitude, longitude) {
    return __awaiter(this, void 0, void 0, function* () {
        const geocodingResponse = yield reverseGeocode(latitude, longitude);
        return parseGoogleAddress(geocodingResponse);
    });
}
/**
 * Verifica se as coordenadas são válidas para geocoding.
 *
 * @param latitude - Latitude a ser validada
 * @param longitude - Longitude a ser validada
 * @returns true se as coordenadas são válidas
 */
function areCoordinatesValid(latitude, longitude) {
    // Verifica se são números válidos e não são zero (coordenadas inválidas)
    return (typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !isNaN(latitude) &&
        !isNaN(longitude) &&
        latitude !== 0 &&
        longitude !== 0 &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180);
}
