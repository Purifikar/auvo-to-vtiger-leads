"use strict";
/**
 * Auvo API Client
 * Cliente HTTP para comunicação com a API da Auvo
 *
 * Baseado na biblioteca n8n-nodes-auvoapi do repositório Purifikar/n8n-auvo
 * https://github.com/Purifikar/n8n-auvo
 *
 * Entidades suportadas:
 * - Customers (Clientes)
 * - Tasks (Tarefas)
 * - Users (Usuários)
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
exports.AuvoApiClient = void 0;
exports.createAuvoClient = createAuvoClient;
const logger_1 = require("../../lib/logger");
/**
 * Cliente para a API da Auvo
 */
class AuvoApiClient {
    constructor(config) {
        this.authToken = null;
        this.config = config;
    }
    /**
     * Obtém ou renova o token de autenticação
     */
    getAuthToken() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Se temos um token válido, retorna
            if (this.authToken && Date.now() < this.authToken.expiresAt) {
                return this.authToken.accessToken;
            }
            logger_1.logger.info('Obtaining new Auvo API token');
            const loginUrl = `${this.config.apiUrl}/login`;
            try {
                const response = yield fetch(loginUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        apiKey: this.config.apiKey,
                        apiToken: this.config.apiToken,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`Auvo login failed: ${response.status} ${response.statusText}`);
                }
                const data = yield response.json();
                if (!((_a = data.result) === null || _a === void 0 ? void 0 : _a.accessToken)) {
                    throw new Error('Auvo login response missing accessToken');
                }
                // Token válido por 1 hora (menos 5 minutos de margem)
                this.authToken = {
                    accessToken: data.result.accessToken,
                    expiresAt: Date.now() + (55 * 60 * 1000), // 55 minutos
                };
                logger_1.logger.info('Auvo API token obtained successfully');
                return this.authToken.accessToken;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger_1.logger.error('Failed to obtain Auvo API token', { error: errorMessage });
                throw error;
            }
        });
    }
    /**
     * Faz uma requisição GET à API Auvo
     */
    get(entity_1, params_1) {
        return __awaiter(this, arguments, void 0, function* (entity, params, page = 1, pageSize = 100) {
            var _a, _b;
            const token = yield this.getAuthToken();
            const url = new URL(`${this.config.apiUrl}/${entity}`);
            // Adiciona parâmetros de filtro como JSON encoded
            if (params && Object.keys(params).length > 0) {
                url.searchParams.append('ParamFilter', JSON.stringify(params));
            }
            url.searchParams.append('Page', String(page));
            url.searchParams.append('PageSize', String(pageSize));
            url.searchParams.append('Order', 'Asc');
            logger_1.logger.info(`Auvo API GET ${entity}`, { params, page, pageSize });
            try {
                const response = yield fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                if (!response.ok) {
                    throw new Error(`Auvo API error: ${response.status} ${response.statusText}`);
                }
                const data = yield response.json();
                // Normaliza a resposta para o formato esperado
                const result = {
                    success: true,
                    status: response.status,
                    data: {
                        result: data.result || { entityList: [], pagedSearchReturnData: { order: 0, pageSize, page, totalItems: 0 }, links: [] },
                    },
                };
                logger_1.logger.info(`Auvo API ${entity} response`, {
                    totalItems: ((_a = result.data.result.pagedSearchReturnData) === null || _a === void 0 ? void 0 : _a.totalItems) || 0,
                    entityCount: ((_b = result.data.result.entityList) === null || _b === void 0 ? void 0 : _b.length) || 0,
                });
                return result;
            }
            catch (error) {
                // Extrai mensagem do erro para logging correto
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;
                logger_1.logger.error(`Auvo API ${entity} request failed`, {
                    error: errorMessage,
                    stack: errorStack,
                    params,
                    url: url.toString()
                });
                // Retorna resposta de erro formatada
                return {
                    success: false,
                    status: 500,
                    data: {
                        result: {
                            entityList: [],
                            pagedSearchReturnData: { order: 0, pageSize, page, totalItems: 0 },
                            links: [],
                        },
                    },
                };
            }
        });
    }
    // =========================================================================
    // CUSTOMERS (Clientes/Leads)
    // =========================================================================
    /**
     * Busca clientes da Auvo
     *
     * @param filter - Filtros para a busca (creationDate, active, name)
     * @param pageSize - Tamanho da página (máx 1000)
     * @returns Lista de clientes
     */
    getCustomers(filter_1) {
        return __awaiter(this, arguments, void 0, function* (filter, pageSize = 1000) {
            return this.get('customers', filter, 1, pageSize);
        });
    }
    /**
     * Busca um cliente específico pelo ID
     *
     * @param customerId - ID do cliente
     * @returns Cliente ou null se não encontrado
     */
    getCustomerById(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.get('customers', { id: customerId }, 1, 1);
            if (response.success && response.data.result.entityList.length > 0) {
                return response.data.result.entityList[0];
            }
            return null;
        });
    }
    // =========================================================================
    // TASKS (Tarefas)
    // =========================================================================
    /**
     * Busca tarefas da Auvo para um cliente específico
     *
     * @param filter - Filtros obrigatórios: customerId, startDate, endDate
     * @returns Lista de tarefas
     */
    getTasks(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get('tasks', filter);
        });
    }
    /**
     * Busca tarefas por cliente no período especificado
     * Método de conveniência com parâmetros nomeados
     */
    getTasksByCustomer(customerId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getTasks({ customerId, startDate, endDate });
        });
    }
    // =========================================================================
    // USERS (Usuários)
    // =========================================================================
    /**
     * Busca usuários da Auvo
     *
     * @param filter - Filtros para a busca (name, userID)
     * @returns Lista de usuários
     */
    getUsers(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get('users', filter);
        });
    }
    /**
     * Busca um usuário pelo nome
     *
     * @param name - Nome do usuário (busca exata)
     * @returns Usuário ou null se não encontrado
     */
    getUserByName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.getUsers({ name });
            if (response.success && response.data.result.entityList.length > 0) {
                return response.data.result.entityList[0];
            }
            return null;
        });
    }
    /**
     * Busca um usuário pelo ID
     *
     * @param userId - ID do usuário
     * @returns Usuário ou null se não encontrado
     */
    getUserById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.getUsers({ userID: userId });
            if (response.success && response.data.result.entityList.length > 0) {
                return response.data.result.entityList[0];
            }
            return null;
        });
    }
}
exports.AuvoApiClient = AuvoApiClient;
/**
 * Cria uma instância do cliente Auvo usando as variáveis de ambiente
 */
function createAuvoClient() {
    const apiKey = process.env.AUVO_API_KEY;
    const apiToken = process.env.AUVO_API_TOKEN;
    const apiUrl = process.env.AUVO_API_URL || 'https://api.auvo.com.br/v2';
    if (!apiKey || !apiToken) {
        throw new Error('AUVO_API_KEY e AUVO_API_TOKEN devem estar configurados');
    }
    return new AuvoApiClient({ apiKey, apiToken, apiUrl });
}
