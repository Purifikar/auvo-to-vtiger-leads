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

import { logger } from '../../lib/logger';
import type {
    AuvoConfig,
    AuvoApiResponse,
    AuvoCustomer,
    AuvoTask,
    AuvoUser,
    AuvoCustomerFilter,
    AuvoTaskFilter,
    AuvoUserFilter,
} from '../types';

/**
 * Entidades disponíveis na API Auvo
 */
type AuvoEntity = 'customers' | 'tasks' | 'users' | 'taskTypes' | 'teams' | 'products';

/**
 * Token de autenticação cacheado
 */
interface AuthToken {
    accessToken: string;
    expiresAt: number; // timestamp em ms
}

/**
 * Cliente para a API da Auvo
 */
export class AuvoApiClient {
    private config: AuvoConfig;
    private authToken: AuthToken | null = null;

    constructor(config: AuvoConfig) {
        this.config = config;
    }

    /**
     * Obtém ou renova o token de autenticação
     */
    private async getAuthToken(): Promise<string> {
        // Se temos um token válido, retorna
        if (this.authToken && Date.now() < this.authToken.expiresAt) {
            return this.authToken.accessToken;
        }

        logger.info('Obtaining new Auvo API token');

        const loginUrl = `${this.config.apiUrl}/login`;

        try {
            const response = await fetch(loginUrl, {
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

            const data = await response.json();

            if (!data.result?.accessToken) {
                throw new Error('Auvo login response missing accessToken');
            }

            // Token válido por 1 hora (menos 5 minutos de margem)
            this.authToken = {
                accessToken: data.result.accessToken,
                expiresAt: Date.now() + (55 * 60 * 1000), // 55 minutos
            };

            logger.info('Auvo API token obtained successfully');
            return this.authToken.accessToken;
        } catch (error) {
            logger.error('Failed to obtain Auvo API token', { error });
            throw error;
        }
    }

    /**
     * Faz uma requisição GET à API Auvo
     */
    private async get<T>(
        entity: AuvoEntity,
        params?: Record<string, unknown>,
        page: number = 1,
        pageSize: number = 100
    ): Promise<AuvoApiResponse<T>> {
        const token = await this.getAuthToken();

        const url = new URL(`${this.config.apiUrl}/${entity}`);

        // Adiciona parâmetros de filtro como JSON encoded
        if (params && Object.keys(params).length > 0) {
            url.searchParams.append('ParamFilter', JSON.stringify(params));
        }

        url.searchParams.append('Page', String(page));
        url.searchParams.append('PageSize', String(pageSize));
        url.searchParams.append('Order', 'Asc');

        logger.info(`Auvo API GET ${entity}`, { params, page, pageSize });

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Auvo API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Normaliza a resposta para o formato esperado
            const result: AuvoApiResponse<T> = {
                success: true,
                status: response.status,
                data: {
                    result: data.result || { entityList: [], pagedSearchReturnData: { order: 0, pageSize, page, totalItems: 0 }, links: [] },
                },
            };

            logger.info(`Auvo API ${entity} response`, {
                totalItems: result.data.result.pagedSearchReturnData?.totalItems || 0,
                entityCount: result.data.result.entityList?.length || 0,
            });

            return result;
        } catch (error) {
            logger.error(`Auvo API ${entity} request failed`, { error, params });

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
    async getCustomers(
        filter?: AuvoCustomerFilter,
        pageSize: number = 1000
    ): Promise<AuvoApiResponse<AuvoCustomer>> {
        return this.get<AuvoCustomer>('customers', filter as Record<string, unknown>, 1, pageSize);
    }

    /**
     * Busca um cliente específico pelo ID
     * 
     * @param customerId - ID do cliente
     * @returns Cliente ou null se não encontrado
     */
    async getCustomerById(customerId: number): Promise<AuvoCustomer | null> {
        const response = await this.get<AuvoCustomer>('customers', { id: customerId }, 1, 1);

        if (response.success && response.data.result.entityList.length > 0) {
            return response.data.result.entityList[0];
        }

        return null;
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
    async getTasks(filter: AuvoTaskFilter): Promise<AuvoApiResponse<AuvoTask>> {
        return this.get<AuvoTask>('tasks', filter as unknown as Record<string, unknown>);
    }

    /**
     * Busca tarefas por cliente no período especificado
     * Método de conveniência com parâmetros nomeados
     */
    async getTasksByCustomer(
        customerId: number,
        startDate: string,
        endDate: string
    ): Promise<AuvoApiResponse<AuvoTask>> {
        return this.getTasks({ customerId, startDate, endDate });
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
    async getUsers(filter?: AuvoUserFilter): Promise<AuvoApiResponse<AuvoUser>> {
        return this.get<AuvoUser>('users', filter as Record<string, unknown>);
    }

    /**
     * Busca um usuário pelo nome
     * 
     * @param name - Nome do usuário (busca exata)
     * @returns Usuário ou null se não encontrado
     */
    async getUserByName(name: string): Promise<AuvoUser | null> {
        const response = await this.getUsers({ name });

        if (response.success && response.data.result.entityList.length > 0) {
            return response.data.result.entityList[0];
        }

        return null;
    }

    /**
     * Busca um usuário pelo ID
     * 
     * @param userId - ID do usuário
     * @returns Usuário ou null se não encontrado
     */
    async getUserById(userId: number): Promise<AuvoUser | null> {
        const response = await this.getUsers({ userID: userId });

        if (response.success && response.data.result.entityList.length > 0) {
            return response.data.result.entityList[0];
        }

        return null;
    }
}

/**
 * Cria uma instância do cliente Auvo usando as variáveis de ambiente
 */
export function createAuvoClient(): AuvoApiClient {
    const apiKey = process.env.AUVO_API_KEY;
    const apiToken = process.env.AUVO_API_TOKEN;
    const apiUrl = process.env.AUVO_API_URL || 'https://api.auvo.com.br/v2';

    if (!apiKey || !apiToken) {
        throw new Error('AUVO_API_KEY e AUVO_API_TOKEN devem estar configurados');
    }

    return new AuvoApiClient({ apiKey, apiToken, apiUrl });
}
