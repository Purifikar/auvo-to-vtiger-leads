"use strict";
/**
 * Date Helper
 * Converte o timestamp de entrada para dateStart (ontem) e dateEnd (hoje)
 * Baseado no nó "Code" do n8n: "from interval (minutes, days, hours) before"
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDateRange = parseDateRange;
exports.generateCurrentTimestamp = generateCurrentTimestamp;
exports.formatAuvoDate = formatAuvoDate;
exports.isValidAuvoDateFormat = isValidAuvoDateFormat;
exports.createCurrentSyncInput = createCurrentSyncInput;
const luxon_1 = require("luxon");
/**
 * Timezone padrão para São Paulo
 */
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
/**
 * Formato de data da Auvo API
 */
const AUVO_DATE_FORMAT = 'yyyy-MM-dd';
/**
 * Converte o timestamp ISO de entrada em um range de datas para a Auvo API.
 *
 * Lógica baseada no n8n:
 * - dateStart: dia anterior ao timestamp (ontem)
 * - dateEnd: dia do timestamp (hoje)
 *
 * @param input - Input contendo o timestamp ISO
 * @returns DateRange com dateStart e dateEnd no formato yyyy-MM-dd
 *
 * @example
 * ```typescript
 * const range = parseDateRange({ timestamp: '2025-12-10T16:50:46.529-03:00' });
 * // { dateStart: '2025-12-09', dateEnd: '2025-12-10' }
 * ```
 */
function parseDateRange(input) {
    // Parse do timestamp no timezone de São Paulo
    const original = luxon_1.DateTime.fromISO(input.timestamp, { zone: DEFAULT_TIMEZONE });
    if (!original.isValid) {
        throw new Error(`Invalid timestamp: ${input.timestamp}. Error: ${original.invalidReason}`);
    }
    // dateStart = ontem
    const dateStart = original.minus({ days: 1 }).toFormat(AUVO_DATE_FORMAT);
    // dateEnd = hoje
    const dateEnd = original.toFormat(AUVO_DATE_FORMAT);
    return {
        dateStart,
        dateEnd,
    };
}
/**
 * Gera um timestamp ISO no timezone de São Paulo.
 * Útil para o scheduler/cron job.
 *
 * @returns Timestamp ISO no formato completo com timezone
 *
 * @example
 * ```typescript
 * const timestamp = generateCurrentTimestamp();
 * // "2025-12-10T16:50:46.529-03:00"
 * ```
 */
function generateCurrentTimestamp() {
    return luxon_1.DateTime.now().setZone(DEFAULT_TIMEZONE).toISO() || '';
}
/**
 * Formata uma data no padrão da Auvo API (yyyy-MM-dd)
 *
 * @param date - Data a ser formatada
 * @returns Data formatada no padrão yyyy-MM-dd
 */
function formatAuvoDate(date) {
    if (date instanceof Date) {
        return luxon_1.DateTime.fromJSDate(date).toFormat(AUVO_DATE_FORMAT);
    }
    return date.toFormat(AUVO_DATE_FORMAT);
}
/**
 * Valida se uma string está no formato de data da Auvo (yyyy-MM-dd)
 *
 * @param dateString - String a ser validada
 * @returns true se a string está no formato correto
 */
function isValidAuvoDateFormat(dateString) {
    const parsed = luxon_1.DateTime.fromFormat(dateString, AUVO_DATE_FORMAT);
    return parsed.isValid;
}
/**
 * Cria um SyncInput a partir do timestamp atual.
 * Útil para testes e para o scheduler.
 *
 * @returns SyncInput com timestamp atual
 */
function createCurrentSyncInput() {
    return {
        timestamp: generateCurrentTimestamp(),
    };
}
