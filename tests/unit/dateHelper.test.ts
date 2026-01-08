/**
 * Testes do Date Helper
 * Valida a lógica de conversão de timestamps para dateStart/dateEnd
 */

// Mock do dotenv
process.env.GOOGLE_MAPS_API_KEY = 'test-key';
process.env.AUVO_API_KEY = 'test-key';
process.env.AUVO_API_TOKEN = 'test-token';

import {
    parseDateRange,
    generateCurrentTimestamp,
    formatAuvoDate,
    isValidAuvoDateFormat,
    createCurrentSyncInput
} from '../../src/auvo-sync/helpers/dateHelper';

describe('Date Helper', () => {

    describe('parseDateRange', () => {
        test('deve converter timestamp para dateStart (ontem) e dateEnd (hoje)', () => {
            const input = { timestamp: '2025-12-10T16:50:46.529-03:00' };
            const result = parseDateRange(input);

            expect(result.dateStart).toBe('2025-12-09'); // ontem
            expect(result.dateEnd).toBe('2025-12-10');   // hoje
        });

        test('deve funcionar com timestamp de meia-noite', () => {
            const input = { timestamp: '2025-12-10T00:00:00.000-03:00' };
            const result = parseDateRange(input);

            expect(result.dateStart).toBe('2025-12-09');
            expect(result.dateEnd).toBe('2025-12-10');
        });

        test('deve funcionar com timestamp de fim do dia', () => {
            const input = { timestamp: '2025-12-10T23:59:59.999-03:00' };
            const result = parseDateRange(input);

            expect(result.dateStart).toBe('2025-12-09');
            expect(result.dateEnd).toBe('2025-12-10');
        });

        test('deve lidar com virada de mês', () => {
            const input = { timestamp: '2025-12-01T10:00:00.000-03:00' };
            const result = parseDateRange(input);

            expect(result.dateStart).toBe('2025-11-30'); // ontem = novembro
            expect(result.dateEnd).toBe('2025-12-01');   // hoje = dezembro
        });

        test('deve lidar com virada de ano', () => {
            const input = { timestamp: '2026-01-01T10:00:00.000-03:00' };
            const result = parseDateRange(input);

            expect(result.dateStart).toBe('2025-12-31'); // ontem = ano passado
            expect(result.dateEnd).toBe('2026-01-01');   // hoje = ano novo
        });

        test('deve lançar erro para timestamp inválido', () => {
            const input = { timestamp: 'invalid-timestamp' };

            expect(() => parseDateRange(input)).toThrow('Invalid timestamp');
        });
    });

    describe('generateCurrentTimestamp', () => {
        test('deve gerar timestamp no formato ISO', () => {
            const timestamp = generateCurrentTimestamp();

            // Verifica se é uma string ISO válida
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        test('deve incluir timezone', () => {
            const timestamp = generateCurrentTimestamp();

            // Deve ter offset de timezone
            expect(timestamp).toMatch(/[-+]\d{2}:\d{2}$/);
        });
    });

    describe('formatAuvoDate', () => {
        test('deve formatar Date para yyyy-MM-dd', () => {
            const date = new Date('2025-12-10T10:00:00Z');
            const result = formatAuvoDate(date);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('isValidAuvoDateFormat', () => {
        test('deve validar formato correto', () => {
            expect(isValidAuvoDateFormat('2025-12-10')).toBe(true);
            expect(isValidAuvoDateFormat('2025-01-01')).toBe(true);
        });

        test('deve rejeitar formatos inválidos', () => {
            expect(isValidAuvoDateFormat('10-12-2025')).toBe(false);
            expect(isValidAuvoDateFormat('2025/12/10')).toBe(false);
            expect(isValidAuvoDateFormat('invalid')).toBe(false);
        });
    });

    describe('createCurrentSyncInput', () => {
        test('deve criar input com timestamp atual', () => {
            const input = createCurrentSyncInput();

            expect(input).toHaveProperty('timestamp');
            expect(typeof input.timestamp).toBe('string');
            expect(input.timestamp.length).toBeGreaterThan(0);
        });
    });
});
