/**
 * Testes das Configurações
 * Valida parsing de variáveis de ambiente e configurações
 */

describe('Configuration Helpers', () => {

    // Salva valores originais
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Reset para valores de teste
        process.env.GOOGLE_MAPS_API_KEY = 'test-google-key';
        process.env.AUVO_API_KEY = 'test-auvo-key';
        process.env.AUVO_API_TOKEN = 'test-auvo-token';
        process.env.AUVO_API_URL = 'https://api.auvo.com.br/v2';
        process.env.ENABLE_PILOT_FILTER = 'true';
        process.env.PILOT_USER_IDS = '213670,123456';
        process.env.ENABLE_GEOCODING_FILTER = 'true';
        process.env.GEOCODING_USER_IDS = '213670';
    });

    afterEach(() => {
        // Restaura valores originais
        process.env = { ...originalEnv };
    });

    // Importa dinamicamente para pegar as variáveis atualizadas
    const getConfigModule = async () => {
        // Limpa cache para recarregar com novas variáveis
        jest.resetModules();
        return await import('../../src/auvo-sync/types');
    };

    describe('getPilotFilterConfig', () => {
        test('deve parsear PILOT_USER_IDS corretamente', async () => {
            const { getPilotFilterConfig } = await getConfigModule();
            const config = getPilotFilterConfig();

            expect(config.enabled).toBe(true);
            expect(config.pilotUserIds).toEqual([213670, 123456]);
        });

        test('deve retornar array vazio se PILOT_USER_IDS não definido', async () => {
            delete process.env.PILOT_USER_IDS;
            const { getPilotFilterConfig } = await getConfigModule();
            const config = getPilotFilterConfig();

            expect(config.pilotUserIds).toEqual([]);
        });

        test('deve interpretar ENABLE_PILOT_FILTER=false', async () => {
            process.env.ENABLE_PILOT_FILTER = 'false';
            const { getPilotFilterConfig } = await getConfigModule();
            const config = getPilotFilterConfig();

            expect(config.enabled).toBe(false);
        });
    });

    describe('getGeocodingFilterConfig', () => {
        test('deve parsear configuração de geocoding', async () => {
            const { getGeocodingFilterConfig } = await getConfigModule();
            const config = getGeocodingFilterConfig();

            expect(config.enabled).toBe(true);
            expect(config.geocodingUserIds).toEqual([213670]);
        });
    });

    describe('isUserAllowed', () => {
        test('deve permitir usuário na lista quando filtro habilitado', async () => {
            const { isUserAllowed, getPilotFilterConfig } = await getConfigModule();
            const config = getPilotFilterConfig();

            expect(isUserAllowed(213670, config)).toBe(true);
            expect(isUserAllowed(123456, config)).toBe(true);
        });

        test('deve bloquear usuário fora da lista quando filtro habilitado', async () => {
            const { isUserAllowed, getPilotFilterConfig } = await getConfigModule();
            const config = getPilotFilterConfig();

            expect(isUserAllowed(999999, config)).toBe(false);
        });

        test('deve permitir qualquer usuário quando filtro desabilitado', async () => {
            process.env.ENABLE_PILOT_FILTER = 'false';
            const { isUserAllowed, getPilotFilterConfig } = await getConfigModule();
            const config = getPilotFilterConfig();

            expect(isUserAllowed(999999, config)).toBe(true);
            expect(isUserAllowed(1, config)).toBe(true);
        });
    });

    describe('shouldApplyGeocoding', () => {
        test('deve aplicar geocoding para usuário na lista', async () => {
            const { shouldApplyGeocoding, getGeocodingFilterConfig } = await getConfigModule();
            const config = getGeocodingFilterConfig();

            expect(shouldApplyGeocoding(213670, config)).toBe(true);
        });

        test('não deve aplicar geocoding para usuário fora da lista', async () => {
            const { shouldApplyGeocoding, getGeocodingFilterConfig } = await getConfigModule();
            const config = getGeocodingFilterConfig();

            expect(shouldApplyGeocoding(999999, config)).toBe(false);
        });

        test('deve aplicar geocoding para todos quando filtro desabilitado', async () => {
            process.env.ENABLE_GEOCODING_FILTER = 'false';
            const { shouldApplyGeocoding, getGeocodingFilterConfig } = await getConfigModule();
            const config = getGeocodingFilterConfig();

            expect(shouldApplyGeocoding(999999, config)).toBe(true);
        });
    });
});
