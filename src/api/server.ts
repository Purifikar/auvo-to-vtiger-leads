import express from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createLeadAutomation } from '../automation/createLead';
import { sendErrorEmail } from '../lib/email';
import {
    getFailedLeads,
    getLeadStats,
    reprocessLead,
    batchReprocessLeads,
    updateLeadPayload,
    getPayloadDiff,
} from '../lib/dlqService';

const app = express();
app.use(express.json());

// Serve static files for admin panel
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Redirect /admin to /admin/index.html
app.get('/admin', (req, res) => {
    res.redirect('/admin/index.html');
});

const startTime = Date.now();

// =============================================================================
// HEALTH & STATUS ENDPOINTS
// =============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000)
    });
});

// Estatísticas gerais
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await getLeadStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error getting stats', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================================================
// WEBHOOK ENDPOINTS (existentes)
// =============================================================================

app.post('/webhook/lead', async (req, res) => {
    try {
        const payload = req.body;
        logger.info('Received webhook', { payload });

        // Validate payload (basic validation, can be improved with Zod)
        if (!payload || !Array.isArray(payload) || payload.length === 0) {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        // Extract AuvoID from payload to check for duplicates
        const leadData = payload[0];
        const auvoId = leadData?.others?.Lead?.id;

        if (auvoId) {
            // Check if a LeadRequest already exists for this AuvoID
            const existingRequest = await prisma.leadRequest.findFirst({
                where: {
                    payload: {
                        contains: `"id":${auvoId}`,
                    },
                },
                select: { id: true, status: true, vtigerId: true },
            });

            if (existingRequest) {
                logger.info(`Duplicate webhook received for AuvoID ${auvoId}, existing request: #${existingRequest.id}`);

                // If already processed successfully, return the existing vtigerId
                if (existingRequest.status === 'PROCESSED' && existingRequest.vtigerId) {
                    return res.status(200).json({
                        message: 'Lead already processed',
                        id: existingRequest.id,
                        vtigerId: existingRequest.vtigerId,
                        duplicate: true
                    });
                }

                // If failed or processing, return info about existing request
                return res.status(409).json({
                    error: 'Lead already exists',
                    message: `A request for this lead already exists (ID: ${existingRequest.id}, Status: ${existingRequest.status})`,
                    existingId: existingRequest.id,
                    status: existingRequest.status
                });
            }
        }

        // Save to DB as PROCESSING
        const leadRequest = await prisma.leadRequest.create({
            data: {
                payload: JSON.stringify(payload),
                status: 'PROCESSING',
                source: 'WEBHOOK',
            },
        });

        logger.info(`Lead request received and saved`, { id: leadRequest.id });

        try {
            // Process lead synchronously
            const leadData = payload[0];
            const vtigerId = await createLeadAutomation(leadData);

            // Update DB with success
            await prisma.leadRequest.update({
                where: { id: leadRequest.id },
                data: {
                    status: 'PROCESSED',
                    vtigerId: vtigerId,
                },
            });

            logger.info('Lead created successfully', { id: leadRequest.id, vtigerId });

            res.status(200).json({
                message: 'Lead created successfully',
                id: leadRequest.id,
                vtigerId: vtigerId
            });

        } catch (automationError: any) {
            logger.error('Automation failed', { error: automationError });

            // Update DB with failure
            await prisma.leadRequest.update({
                where: { id: leadRequest.id },
                data: {
                    status: 'FAILED',
                    errorMessage: automationError.message || 'Unknown error',
                },
            });

            // Send error email
            try {
                await sendErrorEmail(`Lead ${leadRequest.id} Failed`, automationError, {
                    requestId: leadRequest.id,
                    payload: payload[0]
                });
            } catch (emailErr) {
                logger.error('Failed to send error email', { error: emailErr });
            }

            res.status(500).json({
                error: 'Failed to create lead',
                id: leadRequest.id,
                message: automationError.message
            });
        }

    } catch (error) {
        logger.error('Error processing webhook', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Retry endpoint for failed leads (mantido por compatibilidade)
app.post('/webhook/lead/:id/retry', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await reprocessLead(id);

        if (result.success) {
            res.status(200).json({
                message: 'Lead created successfully',
                id: id,
                vtigerId: result.vtigerId
            });
        } else {
            const statusCode = result.error?.includes('not found') ? 404 : 400;
            res.status(statusCode).json({
                error: result.error,
                id: id
            });
        }
    } catch (error) {
        logger.error('Error in retry endpoint', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================================================
// DLQ (Dead Letter Queue) ENDPOINTS
// =============================================================================

/**
 * GET /api/leads/failed
 * Lista todos os leads com erro
 * Query params opcionais: startDate, endDate, source, minRetryCount, maxRetryCount
 */
app.get('/api/leads/failed', async (req, res) => {
    try {
        const filters: any = {};

        if (req.query.startDate) {
            filters.startDate = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
            filters.endDate = new Date(req.query.endDate as string);
        }
        if (req.query.source) {
            filters.source = req.query.source;
        }
        if (req.query.minRetryCount) {
            filters.minRetryCount = parseInt(req.query.minRetryCount as string);
        }
        if (req.query.maxRetryCount) {
            filters.maxRetryCount = parseInt(req.query.maxRetryCount as string);
        }

        const leads = await getFailedLeads(filters);
        res.json({
            total: leads.length,
            leads: leads,
        });
    } catch (error) {
        logger.error('Error getting failed leads', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/lead/:id
 * Busca um lead específico pelo ID
 */
app.get('/api/lead/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const lead = await prisma.leadRequest.findUnique({
            where: { id }
        });

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json({
            ...lead,
            payload: JSON.parse(lead.payload),
            originalPayload: lead.originalPayload ? JSON.parse(lead.originalPayload) : null,
        });
    } catch (error) {
        logger.error('Error getting lead', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/leads/batch-retry
 * Reprocessa múltiplos leads em lote
 * Body: { ids: number[] }
 */
app.post('/api/leads/batch-retry', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid request: ids array is required' });
        }

        // Limite de segurança
        if (ids.length > 50) {
            return res.status(400).json({ error: 'Maximum 50 leads per batch' });
        }

        const stats = await batchReprocessLeads(ids);
        res.json(stats);
    } catch (error) {
        logger.error('Error in batch retry', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/lead/:id/payload
 * Atualiza o payload de um lead (para correção antes de reprocessar)
 * Body: novo payload
 */
app.put('/api/lead/:id/payload', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const newPayload = req.body;

        if (!newPayload) {
            return res.status(400).json({ error: 'Payload is required' });
        }

        const result = await updateLeadPayload(id, newPayload);

        if (result.success) {
            res.json({ message: 'Payload updated successfully', id });
        } else {
            res.status(404).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error updating payload', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/lead/:id/diff
 * Retorna o diff entre payload original e atual
 */
app.get('/api/lead/:id/diff', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const diff = await getPayloadDiff(id);

        if (!diff) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(diff);
    } catch (error) {
        logger.error('Error getting diff', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/lead/:id/reprocess
 * Alias para reprocessar um lead (mais semântico que /retry)
 */
app.post('/api/lead/:id/reprocess', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await reprocessLead(id);

        if (result.success) {
            res.json({
                success: true,
                message: 'Lead reprocessed successfully',
                id,
                vtigerId: result.vtigerId
            });
        } else {
            const statusCode = result.error?.includes('not found') ? 404 : 400;
            res.status(statusCode).json({
                success: false,
                error: result.error,
                id
            });
        }
    } catch (error) {
        logger.error('Error reprocessing lead', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================================================
// ALL LEADS ENDPOINT
// =============================================================================

/**
 * GET /api/leads/all
 * Lista todos os leads (para o admin panel)
 */
app.get('/api/leads/all', async (req, res) => {
    try {
        const leads = await prisma.leadRequest.findMany({
            orderBy: { updatedAt: 'desc' }, // Order by last update so reprocessed leads appear first
            take: 500 // Limit to prevent memory issues
        });

        res.json({
            total: leads.length,
            leads: leads.map(lead => ({
                ...lead,
                payload: JSON.parse(lead.payload),
                originalPayload: lead.originalPayload ? JSON.parse(lead.originalPayload) : null,
            })),
        });
    } catch (error) {
        logger.error('Error getting all leads', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/leads/fix-stuck
 * Corrige leads que ficaram presos no status PROCESSING por mais de 10 minutos
 * Esses leads provavelmente falharam durante o processamento sem atualizar o status
 */
app.post('/api/leads/fix-stuck', async (req, res) => {
    try {
        // Leads presos = PROCESSING há mais de 10 minutos
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const stuckLeads = await prisma.leadRequest.findMany({
            where: {
                status: 'PROCESSING',
                updatedAt: { lt: tenMinutesAgo }
            },
            select: { id: true, updatedAt: true }
        });

        if (stuckLeads.length === 0) {
            return res.json({
                message: 'No stuck leads found',
                fixed: 0
            });
        }

        // Marca como FAILED
        const result = await prisma.leadRequest.updateMany({
            where: {
                id: { in: stuckLeads.map(l => l.id) }
            },
            data: {
                status: 'FAILED',
                errorMessage: 'Lead stuck in PROCESSING - auto-recovered'
            }
        });

        logger.info(`[FIX-STUCK] Fixed ${result.count} stuck leads`, {
            ids: stuckLeads.map(l => l.id)
        });

        res.json({
            message: `Fixed ${result.count} stuck leads`,
            fixed: result.count,
            ids: stuckLeads.map(l => l.id)
        });
    } catch (error) {
        logger.error('Error fixing stuck leads', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================================================
// CONFIG ENDPOINTS
// =============================================================================

/**
 * GET /api/configs
 * Lista todas as configurações do sistema
 */
app.get('/api/configs', async (req, res) => {
    try {
        const configs = await prisma.systemConfig.findMany({
            orderBy: { key: 'asc' }
        });
        res.json(configs);
    } catch (error) {
        logger.error('Error getting configs', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/configs
 * Atualiza múltiplas configurações
 */
app.put('/api/configs', async (req, res) => {
    try {
        const { configs } = req.body;

        if (!Array.isArray(configs)) {
            return res.status(400).json({ error: 'configs must be an array' });
        }

        const results = [];

        for (const cfg of configs) {
            const existing = await prisma.systemConfig.findUnique({
                where: { key: cfg.key }
            });

            if (existing) {
                // Record history
                await prisma.configHistory.create({
                    data: {
                        configKey: cfg.key,
                        oldValue: existing.value,
                        newValue: cfg.value,
                        changedBy: 'admin'
                    }
                });

                // Update config
                await prisma.systemConfig.update({
                    where: { key: cfg.key },
                    data: { value: cfg.value, updatedAt: new Date() }
                });
            } else {
                // Create new config
                await prisma.systemConfig.create({
                    data: {
                        key: cfg.key,
                        value: cfg.value,
                        type: typeof cfg.value === 'boolean' ? 'boolean' : 'string',
                        description: ''
                    }
                });
            }

            results.push({ key: cfg.key, success: true });
        }

        res.json({ success: true, results });
    } catch (error) {
        logger.error('Error updating configs', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/configs/history
 * Lista histórico de alterações de configuração
 */
app.get('/api/configs/history', async (req, res) => {
    try {
        const history = await prisma.configHistory.findMany({
            orderBy: { changedAt: 'desc' },
            take: 50
        });
        res.json(history);
    } catch (error) {
        logger.error('Error getting config history', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================================================
// LOGS ENDPOINTS
// =============================================================================

/**
 * GET /api/logs
 * Lista logs do sistema (lê diretamente dos arquivos Winston)
 */
app.get('/api/logs', async (req, res) => {
    try {
        const level = req.query.level as string;
        const search = req.query.search as string;
        const limit = parseInt(req.query.limit as string) || 100;

        // Determinar qual arquivo ler baseado no filtro de level
        const logFile = level === 'ERROR' ? 'error.log' : 'combined.log';
        const logPath = path.join(process.cwd(), logFile);

        // Verificar se o arquivo existe
        if (!fs.existsSync(logPath)) {
            return res.json([]);
        }

        // Ler o arquivo de log
        const content = fs.readFileSync(logPath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());

        // Parsear as linhas JSON do Winston (da mais recente para mais antiga)
        let logs = lines
            .reverse()
            .slice(0, limit * 2) // Pegar mais para filtrar depois
            .map(line => {
                try {
                    const parsed = JSON.parse(line);
                    return {
                        id: parsed.timestamp,
                        level: (parsed.level || 'info').toUpperCase(),
                        message: parsed.message || '',
                        meta: parsed,
                        createdAt: parsed.timestamp
                    };
                } catch {
                    return null;
                }
            })
            .filter(log => log !== null);

        // Aplicar filtro de level se especificado
        if (level && level !== 'ALL') {
            logs = logs.filter(log => log!.level === level.toUpperCase());
        }

        // Aplicar filtro de busca se especificado
        if (search) {
            const searchLower = search.toLowerCase();
            logs = logs.filter(log =>
                log!.message.toLowerCase().includes(searchLower) ||
                JSON.stringify(log!.meta).toLowerCase().includes(searchLower)
            );
        }

        // Limitar resultado
        logs = logs.slice(0, limit);

        res.json(logs);
    } catch (error) {
        logger.error('Error getting logs', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============================================================================
// SERVER START
// =============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info('Available endpoints:');
    logger.info('  GET  /health              - Health check');
    logger.info('  GET  /api/stats           - Get lead statistics');
    logger.info('  POST /webhook/lead        - Create new lead');
    logger.info('  POST /webhook/lead/:id/retry - Retry failed lead');
    logger.info('  GET  /api/leads/all       - List all leads');
    logger.info('  GET  /api/leads/failed    - List failed leads');
    logger.info('  GET  /api/lead/:id        - Get lead by ID');
    logger.info('  POST /api/lead/:id/reprocess - Reprocess lead');
    logger.info('  PUT  /api/lead/:id/payload - Update lead payload');
    logger.info('  GET  /api/lead/:id/diff   - Get payload diff');
    logger.info('  POST /api/leads/batch-retry - Batch retry leads');
    logger.info('  GET  /api/configs         - Get system configs');
    logger.info('  PUT  /api/configs         - Update configs');
    logger.info('  GET  /api/configs/history - Config change history');
    logger.info('  GET  /api/logs            - Get system logs');
    logger.info('  GET  /admin               - Admin Panel');
});
