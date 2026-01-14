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
import {
    checkLeadExists,
    reserveLeadMapping,
    updateLeadMapping,
    markLeadAsFailed,
    getLeadStatus,
    LEAD_STATUS
} from '../../lib/prismaIntegration';
import { prisma } from '../../lib/prisma';
import { sendErrorEmail } from '../../lib/email';
import { createLeadAutomation } from '../../automation/createLead';
import { AuvoApiClient, createAuvoClient } from './auvoApiClient';
import { parseDateRange, getAddressFromCoordinates, areCoordinatesValid } from '../helpers';
import { parseAuvoAddress, validatePayload, formatValidationError, logPayloadFields } from '../../lib/payloadValidator';
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
            // 2. Buscar clientes (a API não filtra corretamente por creationDate)
            // Então buscamos todos e filtramos localmente
            const customersResponse = await this.auvoClient.getCustomers({
                creationDate: dateRange.dateEnd,
            });

            if (!customersResponse.success) {
                logger.error('Failed to fetch customers from Auvo');
                result.completedAt = new Date();
                result.durationMs = result.completedAt.getTime() - startedAt.getTime();
                return result;
            }

            const allCustomers = customersResponse.data.result.entityList;

            // FILTRO LOCAL: A API Auvo não filtra corretamente por creationDate
            // Então filtramos localmente comparando a data de criação do cliente
            const customers = allCustomers.filter(customer => {
                // creationDate vem no formato "YYYY-MM-DDTHH:MM:SS" ou "YYYY-MM-DD HH:MM:SS"
                const customerDate = customer.creationDate?.split('T')[0]?.split(' ')[0];
                return customerDate === dateRange.dateEnd;
            });

            logger.info(`Found ${allCustomers.length} total customers, ${customers.length} match date ${dateRange.dateEnd}`);
            result.totalCustomers = customers.length;

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

            // 1.1 Verificar duplicidade no banco integration (leads já processados com sucesso)
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

            // 1.1b Verificar se já existe uma requisição para este AuvoID no banco local
            // Isso evita criar múltiplas requisições para o mesmo lead (mesmo que falhou antes)
            // Usando campo auvoId dedicado em vez de busca por string no JSON
            const existingRequest = await prisma.leadRequest.findUnique({
                where: {
                    auvoId: auvoId,
                },
                select: { id: true, status: true },
            });

            if (existingRequest) {
                logger.info(`Customer ${auvoId} already has a LeadRequest (ID: ${existingRequest.id}, Status: ${existingRequest.status}), skipping`);
                return {
                    auvoId,
                    success: false,
                    skipped: true,
                    skipReason: `Already has LeadRequest #${existingRequest.id} (${existingRequest.status})`,
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

            // 1.4 Verificar se é Consultor (case-insensitive)
            const isConsultor = user.jobPosition?.toLowerCase() === CONSULTOR_JOB_POSITION.toLowerCase();
            if (!isConsultor) {
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
            // FASE 3: RESERVAR no entity_mapping ANTES de processar
            // Isso previne duplicidade mesmo se múltiplos webhooks chegarem simultaneamente
            // ========================================

            const reserved = await reserveLeadMapping(auvoId);
            if (!reserved) {
                logger.info(`Customer ${auvoId} could not be reserved (already exists in entity_mapping)`);
                return {
                    auvoId,
                    success: false,
                    skipped: true,
                    skipReason: 'Already reserved in entity_mapping',
                };
            }

            // ========================================
            // FASE 4: Salvar no banco local (PROCESSING)
            // ========================================

            const leadRequest = await prisma.leadRequest.create({
                data: {
                    auvoId: auvoId,  // Campo dedicado para evitar duplicatas
                    payload: JSON.stringify([payload]),
                    status: 'PROCESSING',
                    source: 'AUVO_SYNC',
                },
            });

            logger.info(`LeadRequest created with ID ${leadRequest.id}, entity_mapping reserved`);

            // ========================================
            // FASE 5: Executar automação Playwright
            // ========================================

            try {
                logger.info(`Starting Playwright automation for lead ${auvoId}`);

                const vtigerId = await createLeadAutomation(payload);

                // ========================================
                // FASE 6: Sucesso - Atualizar nos bancos
                // ========================================

                // 6.1 Atualizar LeadRequest como PROCESSED
                await prisma.leadRequest.update({
                    where: { id: leadRequest.id },
                    data: {
                        status: 'PROCESSED',
                        vtigerId: vtigerId,
                    },
                });

                // 6.2 Atualizar o entity_mapping com o crm_id real
                await updateLeadMapping(auvoId, vtigerId);

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
                // FASE 6b: Erro - Tratar falha
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

                // Marcar no entity_mapping como FAILED (mas mantém reservado)
                await markLeadAsFailed(auvoId);

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
            company: this.normalizeCompanyName(Lead.description),
            phone: phone,
            email: email,
            leadsource: 'Prospeccao Consultor',
            description: `Importado da Auvo id${Lead.id}\n ${Task.orientation}`,
            lastname: lastname,
            cf_765: Lead.adressComplement || '', // Complemento
        };

        // Flag para saber se geocoding foi aplicado com sucesso
        let geocodingApplied = false;

        // Verificar se deve aplicar geocoding
        if (shouldApplyGeocoding(User.userID, this.config.geocodingFilter)) {
            if (areCoordinatesValid(Lead.latitude, Lead.longitude)) {
                logger.info(`Applying geocoding for user ${User.userID}`, {
                    latitude: Lead.latitude,
                    longitude: Lead.longitude,
                });

                try {
                    const address = await getAddressFromCoordinates(Lead.latitude, Lead.longitude);
                    this.applyAddressToVtiger(vtigerData, address, Lead.address);
                    geocodingApplied = true;
                } catch (geocodeError) {
                    logger.warn('Geocoding failed, will use Auvo address', { error: geocodeError });
                }
            } else {
                logger.info(`Invalid coordinates for customer ${Lead.id}, will use Auvo address`);
            }
        } else {
            logger.info(`Geocoding not enabled for user ${User.userID}, using Auvo address`);
        }

        // Se geocoding não foi aplicado, usar o endereço da Auvo diretamente
        if (!geocodingApplied && Lead.address) {
            logger.info(`Parsing Auvo address: "${Lead.address}"`);

            const parsedAddress = parseAuvoAddress(Lead.address);

            logger.info('Parsed address from Auvo:', parsedAddress);

            // Aplicar campos do endereço parseado da Auvo
            vtigerData.cf_995 = parsedAddress.logradouro || vtigerData.cf_995 || '';
            vtigerData.cf_763 = parsedAddress.numero || vtigerData.cf_763 || '';
            vtigerData.cf_767 = parsedAddress.bairro || vtigerData.cf_767 || '';
            vtigerData.city = parsedAddress.cidade || vtigerData.city || '';
            vtigerData.cf_993 = parsedAddress.cidade || vtigerData.cf_993 || '';
            vtigerData.state = parsedAddress.estado || vtigerData.state || '';
            vtigerData.cf_977 = parsedAddress.uf || vtigerData.cf_977 || '';
            vtigerData.code = parsedAddress.cep || vtigerData.code || '';
            vtigerData.country = parsedAddress.pais || 'Brasil';
        }

        // Garantir que País está sempre preenchido
        if (!vtigerData.country) {
            vtigerData.country = 'Brasil';
        }

        // Validar payload e logar campos
        const validation = validatePayload(vtigerData);
        logPayloadFields(vtigerData);

        if (!validation.isValid) {
            logger.warn(`Payload has empty/missing fields: ${formatValidationError(validation)}`);
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
     * Com fallback para bairro usando o endereço da Auvo quando geocoding não retorna
     */
    private applyAddressToVtiger(vtiger: VtigerLeadData, address: VtigerAddress, auvoAddress?: string): void {
        // Helper para garantir que não salvamos "undefined" como string
        const safeValue = (val: string | undefined | null): string => {
            if (val === undefined || val === null || val === 'undefined' || val === 'null') {
                return '';
            }
            return val;
        };

        vtiger.cf_995 = safeValue(address.cf_995);  // Logradouro
        vtiger.cf_763 = safeValue(address.cf_763);  // Número
        vtiger.city = safeValue(address.city);       // Cidade
        vtiger.cf_993 = safeValue(address.cf_993);  // Cidade Real
        vtiger.state = safeValue(address.state);     // Estado
        vtiger.cf_977 = safeValue(address.cf_977);  // UF
        vtiger.code = safeValue(address.code);       // CEP
        vtiger.country = safeValue(address.country) || 'Brasil'; // País

        // Bairro: usar geocoding, mas se vazio/undefined, tentar extrair do endereço Auvo
        // Se ainda não conseguir, usar o nome da cidade como fallback
        const geocodeBairro = safeValue(address.cf_767);
        const cidadeFallback = safeValue(address.city) || safeValue(address.cf_993);

        if (geocodeBairro) {
            vtiger.cf_767 = geocodeBairro;
            logger.info('Bairro from geocoding:', { bairro: geocodeBairro });
        } else if (auvoAddress) {
            // Endereço Auvo vem no formato: "Local, Bairro, Cidade - UF, Brasil"
            // O bairro geralmente é o segundo elemento separado por vírgula
            const extractedNeighborhood = this.extractNeighborhoodFromAuvoAddress(auvoAddress);
            if (extractedNeighborhood) {
                vtiger.cf_767 = extractedNeighborhood;
                logger.info('Bairro extracted from Auvo address as fallback', {
                    auvoAddress,
                    extractedNeighborhood
                });
            } else if (cidadeFallback) {
                // Se não conseguiu extrair bairro, usar a cidade como fallback
                vtiger.cf_767 = cidadeFallback;
                logger.info('Using city as bairro fallback', {
                    auvoAddress,
                    bairro: cidadeFallback
                });
            }
        } else if (cidadeFallback) {
            // Sem geocoding bairro e sem endereço Auvo, usar cidade
            vtiger.cf_767 = cidadeFallback;
            logger.info('Using city as bairro (no other source)', {
                bairro: cidadeFallback
            });
        }
    }

    /**
     * Extrai o bairro do endereço da Auvo
     * Formato típico: "Nome do Local, Bairro, Cidade - UF, Brasil"
     * O bairro é geralmente o segundo elemento
     */
    private extractNeighborhoodFromAuvoAddress(auvoAddress: string): string {
        if (!auvoAddress) return '';

        // Divide por vírgula e limpa espaços
        const parts = auvoAddress.split(',').map(p => p.trim());

        // Se tiver pelo menos 3 partes: [Local, Bairro, Cidade - UF, ...]
        // O bairro é a segunda parte
        if (parts.length >= 3) {
            const potentialNeighborhood = parts[1];

            // Verifica se não é uma cidade (não contém " - " que indica "Cidade - UF")
            if (!potentialNeighborhood.includes(' - ')) {
                return potentialNeighborhood;
            }
        }

        // Se tiver apenas 2 partes: [Bairro, Cidade - UF, ...]
        // Às vezes o primeiro elemento é o bairro
        if (parts.length >= 2) {
            const firstPart = parts[0];
            // Se o primeiro elemento não parece ser um endereço completo
            // (não contém número ou palavras como "Rua", "Av", "Rod")
            if (!firstPart.match(/\d/) && !firstPart.match(/^(Rua|Av\.|Avenida|Rod\.|Rodovia|Estrada|Travessa|Alameda)/i)) {
                return firstPart;
            }
        }

        return '';
    }

    /**
     * Normaliza o nome da empresa removendo prefixos "Lead" e convertendo para maiúsculas.
     * 
     * Exemplos:
     * - "Lead - Barraca amarela" → "BARRACA AMARELA"
     * - "Lead/ Nobre Implante" → "NOBRE IMPLANTE"
     * - "Lead/Maycon" → "MAYCON"
     * - "LEAD KOOYOO SUSHI" → "KOOYOO SUSHI"
     * - "Dr Burguer" → "DR BURGUER"
     * 
     * @param name - Nome original da empresa vindo da Auvo
     * @returns Nome normalizado em maiúsculas e sem prefixo "Lead"
     */
    private normalizeCompanyName(name: string): string {
        if (!name) return '';

        let normalized = name.trim();

        // Remover variações do prefixo "Lead" (case-insensitive)
        // Padrões: "Lead - ", "Lead/ ", "Lead/", "Lead -", "LEAD ", etc.
        normalized = normalized.replace(/^lead\s*[-\/]\s*/i, '');

        // Se ainda começar com "LEAD " (sem separador), remover também
        normalized = normalized.replace(/^lead\s+/i, '');

        // Converter para maiúsculas
        normalized = normalized.toUpperCase();

        // Remover espaços extras
        normalized = normalized.replace(/\s+/g, ' ').trim();

        logger.info('Company name normalized', { original: name, normalized });

        return normalized;
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

            // Atualizar no entity_mapping (já deve existir com PENDING ou FAILED)
            await updateLeadMapping(auvoId, vtigerId);

            logger.info(`Direct processing successful for ${auvoId}`, { vtigerId });

            return { success: true, vtigerId };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Direct processing failed for ${auvoId}`, { error: errorMessage });

            // Marcar como FAILED no entity_mapping
            await markLeadAsFailed(auvoId);

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
