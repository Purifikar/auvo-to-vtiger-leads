/**
 * Auvo Sync Types
 * Interfaces TypeScript baseadas no workflow n8n para a integração Auvo -> Vtiger
 */

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input do serviço de sincronização
 * Vem do trigger/scheduler
 */
export interface SyncInput {
    timestamp: string; // ISO 8601 format: "2025-12-10T16:50:46.529-03:00"
}

/**
 * Parâmetros processados para busca na Auvo
 */
export interface DateRange {
    dateStart: string; // formato "yyyy-MM-dd" (ontem)
    dateEnd: string;   // formato "yyyy-MM-dd" (hoje)
}

// =============================================================================
// AUVO API TYPES - Customer (Lead)
// =============================================================================

/**
 * Contato de um cliente Auvo
 */
export interface AuvoContact {
    id: number;
    name: string;
    jobPosition: string;
    email: string;
    phone: string;
}

/**
 * Cliente da Auvo (usado como Lead no Vtiger)
 */
export interface AuvoCustomer {
    id: number;
    description: string;
    cpfCnpj: string;
    externalId: string;
    phoneNumber: string[];
    email: string[];
    manager: string;
    note: string;
    address: string;
    adressComplement: string;
    latitude: number;
    longitude: number;
    maximumVisitTime: number;
    unitMaximumTime: number;
    groupsId: number[];
    managerTeamsId: number[];
    managersId: number[];
    uriAttachments: string[];
    segmentId: number;
    active: boolean;
    dateLastUpdate: string;
    creationDate: string;
    contacts: AuvoContact[];
}

// =============================================================================
// AUVO API TYPES - Task
// =============================================================================

/**
 * Anexo de tarefa
 */
export interface AuvoTaskAttachment {
    id: number;
    url: string;
    attachmentType: number;
    subtitle: string;
    extension: string;
    description: string;
}

/**
 * Resumo financeiro da tarefa
 */
export interface AuvoTaskSummary {
    totalProducts: number;
    totalServices: number;
    totalAdditionalCosts: number;
    totalValue: number;
    discount: {
        value: number;
        type: string;
    };
}

/**
 * Tarefa da Auvo
 */
export interface AuvoTask {
    taskID: number;
    externalId: string;
    idUserFrom: number;
    userFromName: string;
    idUserTo: number;
    userToName: string;
    customerId: number;
    customerExternalId: string;
    customerDescription: string;
    taskType: number;
    taskTypeDescription: string;
    creationDate: string;
    taskDate: string;
    latitude: number;
    longitude: number;
    address: string;
    orientation: string;
    priority: number;
    deliveredOnSmarthPhone: boolean;
    deliveredDate: string;
    finished: boolean;
    report: string;
    visualized: boolean;
    visualizedDate: string;
    checkIn: boolean;
    checkInDate: string;
    checkOut: boolean;
    checkOutDate: string;
    checkinType: number;
    keyWords: string[];
    keyWordsDescriptions: string[];
    inputedKm: number;
    adoptedKm: number;
    attachments: AuvoTaskAttachment[];
    questionnaires: unknown[];
    signatureUrl: string;
    checkInDistance: number;
    checkOutDistance: number;
    sendSatisfactionSurvey: boolean;
    sendDigitalOs: boolean;
    survey: string;
    taskUrl: string;
    pendency: string;
    equipmentsId: number[];
    dateLastUpdate: string;
    ticketId: number;
    ticketTitle: string;
    signatureName: string;
    signatureDocument: string;
    expense: string;
    duration: string;
    durationDecimal: string;
    displacementStart: string;
    products: unknown[];
    services: unknown[];
    additionalCosts: unknown[];
    summary: AuvoTaskSummary;
    estimatedDuration: string;
    financialCategory: string;
    openedOnLocation: boolean;
    timeControl: unknown[];
    taskStatus: number;
    reasonForPause: string;
}

// =============================================================================
// AUVO API TYPES - User
// =============================================================================

/**
 * Tipo de usuário Auvo
 */
export interface AuvoUserType {
    userTypeId: number;
    description: string;
}

/**
 * Ponto base do usuário
 */
export interface AuvoBasePoint {
    address: string;
    latitude: number;
    longitude: number;
}

/**
 * Notificações de monitoramento
 */
export interface AuvoMonitoringNotification {
    gpsActivation: number;
    gpsDisabling: number;
    appLogin: number;
    appLogout: number;
}

/**
 * Notificações de colaborador
 */
export interface AuvoEmployeeNotification {
    basePointChange: number;
}

/**
 * Notificações de cliente
 */
export interface AuvoClientNotification {
    adressChange: number;
}

/**
 * Notificações de tarefa
 */
export interface AuvoTaskNotification {
    checkIn: number;
    checkout: number;
    rescheduling: number;
    travelStart: number;
    researchAnswer: number;
    delay: number;
    taskDelete: number;
}

/**
 * Usuário da Auvo
 */
export interface AuvoUser {
    userID: number;
    externalId: string;
    name: string;
    smartPhoneNumber: string;
    login: string;
    email: string;
    culture: string;
    jobPosition: string;
    userType: AuvoUserType;
    address: string;
    latitude: number;
    longitude: number;
    workSchedule: unknown[];
    hourValue: number;
    pictureUrl: string;
    basePoint: AuvoBasePoint;
    openTaskInPlace: boolean;
    grabGalleryPhotos: boolean;
    gpsFrequency: number;
    checkInManual: boolean;
    unavailableForTasks: boolean;
    editTaskAfterCheckout: boolean;
    informStartTravel: boolean;
    changeBasePoint: boolean;
    registrationDate: string;
    valueKMTraveled: number;
    monitoringNotification: AuvoMonitoringNotification;
    employeeNotification: AuvoEmployeeNotification;
    clientNotification: AuvoClientNotification;
    taskNotification: AuvoTaskNotification;
}

// =============================================================================
// AUVO API RESPONSE TYPES
// =============================================================================

/**
 * Metadados de paginação da API Auvo
 */
export interface AuvoPagedSearchReturnData {
    order: number;
    pageSize: number;
    page: number;
    totalItems: number;
}

/**
 * Link HATEOAS da API Auvo
 */
export interface AuvoLink {
    href: string;
    rel: string;
    method: string;
}

/**
 * Estrutura genérica de resultado da API Auvo
 */
export interface AuvoResult<T> {
    entityList: T[];
    pagedSearchReturnData: AuvoPagedSearchReturnData;
    links: AuvoLink[];
}

/**
 * Resposta da API Auvo
 */
export interface AuvoApiResponse<T> {
    success: boolean;
    status: number;
    data: {
        result: AuvoResult<T>;
    };
}

// =============================================================================
// GOOGLE MAPS TYPES
// =============================================================================

/**
 * Componente de endereço do Google Geocoding
 */
export interface GoogleAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
}

/**
 * Resultado do Google Geocoding
 */
export interface GoogleGeocodingResult {
    address_components: GoogleAddressComponent[];
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
    place_id: string;
    types: string[];
}

/**
 * Resposta da API Google Geocoding
 */
export interface GoogleGeocodingResponse {
    results: GoogleGeocodingResult[];
    status: string;
}

/**
 * Endereço parseado do Google para o Vtiger
 */
export interface VtigerAddress {
    cf_995: string;  // Logradouro
    cf_763: string;  // Número
    cf_767: string;  // Bairro
    city: string;    // Cidade (Google Maps)
    cf_993: string;  // Cidade Real
    state: string;   // Estado (nome completo)
    cf_977: string;  // UF (sigla)
    code: string;    // CEP
    country: string; // País
}

// =============================================================================
// VTIGER TYPES
// =============================================================================

/**
 * Dados do Lead para o Vtiger
 */
export interface VtigerLeadData {
    leadstatus: string;
    assigned_user_id?: string;
    company: string;
    phone: string;
    email: string;
    leadsource: string;
    description: string;
    lastname: string;
    cf_765: string;       // Complemento
    cf_995?: string;      // Logradouro
    cf_763?: string;      // Número
    cf_767?: string;      // Bairro
    city?: string;        // Cidade
    cf_993?: string;      // Cidade Real
    state?: string;       // Estado
    cf_977?: string;      // UF
    code?: string;        // CEP
    country?: string;     // País
}

/**
 * Dados adicionais para processamento
 */
export interface ProcessingOthers {
    AlreadyExists: boolean;
    success: boolean;
    status: number;
    data: AuvoApiResponse<AuvoUser>['data'];
    Lead: AuvoCustomer;
    Task: AuvoTask;
}

/**
 * Payload final para envio ao webhook Vtiger
 */
export interface VtigerWebhookPayload {
    vtiger: VtigerLeadData;
    others: ProcessingOthers;
}

// =============================================================================
// DATABASE TYPES
// =============================================================================

/**
 * Registro de mapeamento de entidades (para verificar duplicidade)
 */
export interface EntityMapping {
    id: number;
    entity_type: string;
    crm_id: string | null;
    auvo_id: string | null;
    omie_id: string | null;
    created_at: Date;
    updated_at: Date;
}

// =============================================================================
// AUVO API FILTER TYPES
// =============================================================================

/**
 * Filtros para buscar clientes na Auvo
 */
export interface AuvoCustomerFilter {
    creationDate?: string;
    active?: boolean;
    name?: string;
}

/**
 * Filtros para buscar tarefas na Auvo
 */
export interface AuvoTaskFilter {
    customerId: number;
    startDate: string;
    endDate: string;
}

/**
 * Filtros para buscar usuários na Auvo
 */
export interface AuvoUserFilter {
    name?: string;
    userID?: number;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Configuração do serviço Auvo
 */
export interface AuvoConfig {
    apiKey: string;
    apiToken: string;
    apiUrl: string;
}

/**
 * Configuração do Google Maps
 */
export interface GoogleMapsConfig {
    apiKey: string;
}

/**
 * Configuração do filtro piloto
 * Permite filtrar processamento apenas para usuários específicos em dev/test
 */
export interface PilotFilterConfig {
    /** Se true, filtra apenas os usuários listados em pilotUserIds */
    enabled: boolean;
    /** Lista de IDs de usuários piloto */
    pilotUserIds: number[];
}

/**
 * Configuração do geocoding
 * Permite aplicar geocoding apenas para usuários específicos
 */
export interface GeocodingFilterConfig {
    /** Se true, aplica geocoding apenas para usuários listados */
    enabled: boolean;
    /** Lista de IDs de usuários que receberão geocoding */
    geocodingUserIds: number[];
}

/**
 * Configuração completa do serviço de sincronização
 */
export interface SyncServiceConfig {
    auvo: AuvoConfig;
    googleMaps: GoogleMapsConfig;
    pilotFilter: PilotFilterConfig;
    geocodingFilter: GeocodingFilterConfig;
}

// =============================================================================
// CONFIGURATION HELPERS
// =============================================================================

/**
 * Parseia uma string de IDs separados por vírgula em um array de números
 * @param idsString - String com IDs separados por vírgula (ex: "213670,123456")
 * @returns Array de números
 */
function parseIdsList(idsString: string | undefined): number[] {
    if (!idsString) return [];
    return idsString
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));
}

/**
 * Parseia string para boolean
 */
function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
}

/**
 * Obtém a configuração do filtro piloto das variáveis de ambiente
 */
export function getPilotFilterConfig(): PilotFilterConfig {
    return {
        enabled: parseBoolean(process.env.ENABLE_PILOT_FILTER, true),
        pilotUserIds: parseIdsList(process.env.PILOT_USER_IDS),
    };
}

/**
 * Obtém a configuração do filtro de geocoding das variáveis de ambiente
 */
export function getGeocodingFilterConfig(): GeocodingFilterConfig {
    return {
        enabled: parseBoolean(process.env.ENABLE_GEOCODING_FILTER, true),
        geocodingUserIds: parseIdsList(process.env.GEOCODING_USER_IDS),
    };
}

/**
 * Obtém a configuração completa do Auvo das variáveis de ambiente
 */
export function getAuvoConfig(): AuvoConfig {
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
export function getSyncServiceConfig(): SyncServiceConfig {
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
export function isUserAllowed(userId: number, config: PilotFilterConfig): boolean {
    // Se filtro desabilitado, todos os usuários são permitidos
    if (!config.enabled) return true;
    // Se habilitado, verifica se está na lista
    return config.pilotUserIds.includes(userId);
}

/**
 * Verifica se geocoding deve ser aplicado para um usuário
 * @param userId - ID do usuário a verificar
 * @param config - Configuração do filtro de geocoding
 * @returns true se o filtro está desabilitado OU se o usuário está na lista
 */
export function shouldApplyGeocoding(userId: number, config: GeocodingFilterConfig): boolean {
    // Se filtro desabilitado, aplica geocoding para todos
    if (!config.enabled) return true;
    // Se habilitado, verifica se está na lista
    return config.geocodingUserIds.includes(userId);
}

/**
 * Cargo que filtramos para processamento
 */
export const CONSULTOR_JOB_POSITION = 'Consultor';

