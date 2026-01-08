/**
 * Auvo Sync Service
 * Serviço principal para sincronização de leads da Auvo para o Vtiger
 * 
 * Este serviço replica a lógica completa do workflow n8n:
 * 1. Recebe um timestamp
 * 2. Calcula dateStart (ontem) e dateEnd (hoje)
 * 3. Busca clientes criados em dateEnd na Auvo
 * 4. Para cada cliente, busca as tarefas no período
 * 5. Filtra por usuário "Consultor"
 * 6. Verifica duplicidade no banco integration (entity_mapping)
 * 7. Aplica geocoding se necessário (baseado em configuração)
 * 8. Chama a automação Playwright para criar o lead no Vtiger
 * 9. Registra o sucesso no banco entity_mapping
 * 10. Envia notificação de erro por email se falhar
 */

import { logger } from '../../lib/logger';
import { checkLeadExists, recordLeadMapping } from '../../lib/prismaIntegration';
import { prisma } from '../../lib/prisma';
import { sendErrorEmail } from '../../lib/email';
import { createLeadAutomation } from '../../automation/createLead';
import { AuvoApiClient, createAuvoClient } from './auvoApiClient';
import { parseDateRange, getAddressFromCoordinates, areCoordinatesValid } from '../helpers';
import type {
    SyncInput,
    DateRange,
    AuvoCustomer,
    AuvoTask,
    AuvoUser,
    VtigerLeadData,
    VtigerAddress,
    VtigerWebhookPayload,
    SyncServiceConfig,
    PilotFilterConfig,
    GeocodingFilterConfig,
} from '../types';
import {
    getSyncServiceConfig,
    isUserAllowed,
    shouldApplyGeocoding,
    CONSULTOR_JOB_POSITION,
} from '../types';

/**
 * Resultado do processamento de um lead
 */
export interface LeadProcessingResult {
    auvoId: number;
    success: boolean;
    skipped: boolean;
    skipReason?: string;
    vtigerId?: string;
    payload?: VtigerWebhookPayload;
    error?: string;
    dbRequestId?: number;
}

/**
 * Resultado da sincronização completa
 */
export interface SyncResult {
    timestamp: string;
    dateRange: DateRange;
    totalCustomers: number;
    processed: number;
    skipped: number;
    errors: number;
    results: LeadProcessingResult[];
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
}

/**
 * Representação de um item durante o processamento
 */
interface ProcessingItem {
    Lead: AuvoCustomer;
    Task: AuvoTask;
    User: AuvoUser;
    dateStart: string;
    dateEnd: string;
}

/**
 * Serviço de sincronização Auvo -> Vtiger
 */
export class AuvoSyncService {
    private auvoClient: AuvoApiClient;
    private config: SyncServiceConfig;

    constructor(config?: SyncServiceConfig) {
        this.config = config || getSyncServiceConfig();
        this.auvoClient = createAuvoClient();
    }

    /**
     * Executa a sincronização completa
     * 
     * @param input - Input com timestamp ISO
     * @returns Resultado da sincronização
     */
    async sync(input: SyncInput): Promise<SyncResult> {
        const startedAt = new Date();
        logger.info('=== AUVO SYNC STARTED ===', {
            timestamp: input.timestamp,
            pilotFilterEnabled: this.config.pilotFilter.enabled,
            pilotUserIds: this.config.pilotFilter.pilotUserIds,
        });

        // 1. Calcular range de datas
        const dateRange = parseDateRange(input);
        logger.info('Date range calculated', { dateRange });

        const result: SyncResult = {
            timestamp: input.timestamp,
            dateRange,
            totalCustomers: 0,
            processed: 0,
            skipped: 0,
            errors: 0,
            results: [],
            startedAt,
            completedAt: startedAt,
            durationMs: 0,
        };

        try {
            // 2. Buscar clientes criados em dateEnd
            const customersResponse = await this.auvoClient.getCustomers({
                creationDate: dateRange.dateEnd,
            });

            if (!customersResponse.success) {
                logger.error('Failed to fetch customers from Auvo');
                result.completedAt = new Date();
                result.durationMs = result.completedAt.getTime() - startedAt.getTime();
                return result;
            }

            const customers = customersResponse.data.result.entityList;
            result.totalCustomers = customers.length;

            logger.info(`Found ${customers.length} customers created on ${dateRange.dateEnd}`);

            // 3. Processar cada cliente SEQUENCIALMENTE
            for (const customer of customers) {
                const leadResult = await this.processCustomerFull(customer, dateRange);
                result.results.push(leadResult);

                if (leadResult.success) {
                    result.processed++;
                } else if (leadResult.skipped) {
                    result.skipped++;
                } else {
                    result.errors++;
                }

                // Pequeno delay entre processamentos para não sobrecarregar
                await this.delay(1000);
            }

            result.completedAt = new Date();
            result.durationMs = result.completedAt.getTime() - startedAt.getTime();

            logger.info('=== AUVO SYNC COMPLETED ===', {
                totalCustomers: result.totalCustomers,
                processed: result.processed,
                skipped: result.skipped,
                errors: result.errors,
                durationMs: result.durationMs,
            });

            return result;
        } catch (error) {
            logger.error('=== AUVO SYNC FAILED ===', { error });
            result.completedAt = new Date();
            result.durationMs = result.completedAt.getTime() - startedAt.getTime();
            throw error;
        }
    }

    /**
     * Processa um cliente individual de forma completa:
     * - Valida
     * - Prepara payload
     * - Cria no Vtiger (automação)
     * - Registra no banco
     */
    private async processCustomerFull(
        customer: AuvoCustomer,
        dateRange: DateRange
    ): Promise<LeadProcessingResult> {
        const auvoId = customer.id;

        try {
            logger.info(`\n--- Processing customer ${auvoId}: ${customer.description} ---`);

            // ========================================
            // FASE 1: Validações e Preparação
            // ========================================

            // 1.1 Verificar duplicidade no banco integration
            const alreadyExists = await checkLeadExists(auvoId);
            if (alreadyExists) {
                logger.info(`Customer ${auvoId} already processed, skipping`);
                return {
                    auvoId,
                    success: false,
                    skipped: true,
                    skipReason: 'Already exists in entity_mapping',
                };
            }

            // 1.2 Buscar tarefas do cliente no período
            const tasksResponse = await this.auvoClient.getTasksByCustomer(
                auvoId,
                dateRange.dateStart,
                dateRange.dateEnd
            );

            if (!tasksResponse.success || tasksResponse.data.result.entityList.length === 0) {
                logger.info(`No tasks found for customer ${auvoId}`);
                return {
                    auvoId,
                    success: false,
                    skipped: true,
                    skipReason: 'No tasks found',
                };
            }

            // Pegar a primeira tarefa (como no n8n)
            const task = tasksResponse.data.result.entityList[0];

            // 1.3 Buscar usuário pelo nome da tarefa
            const user = await this.auvoClient.getUserByName(task.userFromName);

            if (!user) {
                logger.info(`User not found for task: ${task.userFromName}`);
                return {
                    auvoId,
                    success: false,
                    skipped: true,
                    skipReason: `User not found: ${task.userFromName}`,
                };
            }

            // 1.4 Verificar se é Consultor
            if (user.jobPosition !== CONSULTOR_JOB_POSITION) {
                logger.info(`User ${user.name} is not a Consultor (${user.jobPosition}), skipping`);
                return {
                    auvoId,
                    success: false,
                    skipped: true,
                    skipReason: `User job position is ${user.jobPosition}, not ${CONSULTOR_JOB_POSITION}`,
                };
            }

            // 1.5 Verificar filtro piloto
            if (!isUserAllowed(user.userID, this.config.pilotFilter)) {
                logger.info(`User ${user.userID} not in pilot list, skipping (pilot filter enabled)`);
                return {
                    auvoId,
                    success: false,
                    skipped: true,
                    skipReason: `User ${user.userID} not in pilot list`,
                };
            }

            // ========================================
            // FASE 2: Preparar Payload
            // ========================================

            const item: ProcessingItem = {
                Lead: customer,
                Task: task,
                User: user,
                dateStart: dateRange.dateStart,
                dateEnd: dateRange.dateEnd,
            };

            const payload = await this.prepareVtigerPayload(item);

            // ========================================
            // FASE 3: Salvar no banco local (PROCESSING)
            // ========================================

            const leadRequest = await prisma.leadRequest.create({
                data: {
                    payload: JSON.stringify([payload]),
                    status: 'PROCESSING',
                },
            });

            logger.info(`LeadRequest created with ID ${leadRequest.id}`);

            // ========================================
            // FASE 4: Executar automação Playwright
            // ========================================

            try {
                logger.info(`Starting Playwright automation for lead ${auvoId}`);

                const vtigerId = await createLeadAutomation(payload);

                // ========================================
                // FASE 5: Sucesso - Registrar nos bancos
                // ========================================

                // 5.1 Atualizar LeadRequest como PROCESSED
                await prisma.leadRequest.update({
                    where: { id: leadRequest.id },
                    data: {
                        status: 'PROCESSED',
                        vtigerId: vtigerId,
                    },
                });

                // 5.2 Registrar no banco integration (entity_mapping)
                await recordLeadMapping(auvoId, vtigerId);

                logger.info(`✅ Lead ${auvoId} created successfully in Vtiger`, {
                    vtigerId,
                    dbRequestId: leadRequest.id,
                });

                return {
                    auvoId,
                    success: true,
                    skipped: false,
                    vtigerId,
                    payload,
                    dbRequestId: leadRequest.id,
                };

            } catch (automationError) {
                // ========================================
                // FASE 5b: Erro - Tratar falha
                // ========================================

                const errorMessage = automationError instanceof Error
                    ? automationError.message
                    : 'Unknown automation error';

                logger.error(`❌ Automation failed for lead ${auvoId}`, {
                    error: errorMessage,
                    dbRequestId: leadRequest.id,
                });

                // Atualizar LeadRequest como FAILED
                await prisma.leadRequest.update({
                    where: { id: leadRequest.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: errorMessage,
                    },
                });

                // Enviar email de erro
                await this.sendErrorNotification(leadRequest.id, automationError, payload);

                return {
                    auvoId,
                    success: false,
                    skipped: false,
                    error: errorMessage,
                    payload,
                    dbRequestId: leadRequest.id,
                };
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`❌ Error processing customer ${auvoId}`, { error: errorMessage });

            return {
                auvoId,
                success: false,
                skipped: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Prepara o payload para o Vtiger
     * Baseado no nó "Prepare Fields" do n8n
     */
    private async prepareVtigerPayload(item: ProcessingItem): Promise<VtigerWebhookPayload> {
        const { Lead, Task, User } = item;

        // Extrair dados do contato
        const contact = Lead.contacts?.[0];
        const name = contact?.name || '';
        const phone = contact?.phone || '';
        const email = contact?.email || '';
        const jobPosition = contact?.jobPosition || '';
        const lastname = name + (jobPosition ? ` (${jobPosition.trim()})` : 'não preenchido');

        // Preparar dados base do Vtiger
        const vtigerData: VtigerLeadData = {
            leadstatus: 'Cadastrado',
            company: Lead.description,
            phone: phone,
            email: email,
            leadsource: 'Prospeccao Consultor',
            description: `Importado da Auvo id${Lead.id}\n ${Task.orientation}`,
            lastname: lastname,
            cf_765: Lead.adressComplement || '', // Complemento
        };

        // Verificar se deve aplicar geocoding
        if (shouldApplyGeocoding(User.userID, this.config.geocodingFilter)) {
            if (areCoordinatesValid(Lead.latitude, Lead.longitude)) {
                logger.info(`Applying geocoding for user ${User.userID}`, {
                    latitude: Lead.latitude,
                    longitude: Lead.longitude,
                });

                try {
                    const address = await getAddressFromCoordinates(Lead.latitude, Lead.longitude);
                    this.applyAddressToVtiger(vtigerData, address);
                } catch (geocodeError) {
                    logger.warn('Geocoding failed, continuing without address', { error: geocodeError });
                }
            } else {
                logger.info(`Invalid coordinates for customer ${Lead.id}, skipping geocoding`);
            }
        } else {
            logger.info(`Geocoding not enabled for user ${User.userID}`);
        }

        // Montar o payload completo
        const payload: VtigerWebhookPayload = {
            vtiger: vtigerData,
            others: {
                AlreadyExists: false,
                success: true,
                status: 200,
                data: {
                    result: {
                        entityList: [User],
                        pagedSearchReturnData: {
                            order: 0,
                            pageSize: 10,
                            page: 1,
                            totalItems: 1,
                        },
                        links: [],
                    },
                },
                Lead: Lead,
                Task: Task,
            },
        };

        return payload;
    }

    /**
     * Aplica os dados de endereço do Google ao objeto Vtiger
     */
    private applyAddressToVtiger(vtiger: VtigerLeadData, address: VtigerAddress): void {
        vtiger.cf_995 = address.cf_995;  // Logradouro
        vtiger.cf_763 = address.cf_763;  // Número
        vtiger.cf_767 = address.cf_767;  // Bairro
        vtiger.city = address.city;       // Cidade
        vtiger.cf_993 = address.cf_993;  // Cidade Real
        vtiger.state = address.state;     // Estado
        vtiger.cf_977 = address.cf_977;  // UF
        vtiger.code = address.code;       // CEP
        vtiger.country = address.country; // País
    }

    /**
     * Envia notificação de erro por email
     */
    private async sendErrorNotification(
        requestId: number,
        error: unknown,
        payload: VtigerWebhookPayload
    ): Promise<void> {
        try {
            const errorObj = error instanceof Error ? error : new Error(String(error));

            await sendErrorEmail(
                `Lead Auvo ${payload.others.Lead.id} Failed`,
                errorObj,
                {
                    requestId,
                    payload,
                }
            );

            logger.info(`Error notification email sent for request ${requestId}`);
        } catch (emailError) {
            logger.error('Failed to send error notification email', { error: emailError });
        }
    }

    /**
     * Delay helper para evitar sobrecarga
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtém a configuração atual do serviço
     */
    getConfig(): SyncServiceConfig {
        return this.config;
    }

    /**
     * Atualiza a configuração do filtro piloto
     */
    updatePilotFilter(config: PilotFilterConfig): void {
        this.config.pilotFilter = config;
        logger.info('Pilot filter updated', { config });
    }

    /**
     * Atualiza a configuração do filtro de geocoding
     */
    updateGeocodingFilter(config: GeocodingFilterConfig): void {
        this.config.geocodingFilter = config;
        logger.info('Geocoding filter updated', { config });
    }

    /**
     * Processa manualmente um payload específico
     * Útil para reprocessar leads falhos
     */
    async processPayloadDirectly(payload: VtigerWebhookPayload): Promise<{
        success: boolean;
        vtigerId?: string;
        error?: string;
    }> {
        const auvoId = payload.others.Lead.id;

        logger.info(`Direct processing for Auvo lead ${auvoId}`);

        try {
            const vtigerId = await createLeadAutomation(payload);

            // Registrar no entity_mapping
            await recordLeadMapping(auvoId, vtigerId);

            logger.info(`Direct processing successful for ${auvoId}`, { vtigerId });

            return { success: true, vtigerId };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Direct processing failed for ${auvoId}`, { error: errorMessage });

            return { success: false, error: errorMessage };
        }
    }
}

/**
 * Cria uma instância do serviço de sincronização
 */
export function createAuvoSyncService(): AuvoSyncService {
    return new AuvoSyncService();
}
