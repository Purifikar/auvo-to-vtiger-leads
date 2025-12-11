import express from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createLeadAutomation } from '../automation/createLead';
import { sendErrorEmail } from '../lib/email';

const app = express();
app.use(express.json());

const startTime = Date.now();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000)
    });
});

app.post('/webhook/lead', async (req, res) => {
    try {
        const payload = req.body;
        logger.info('Received webhook', { payload });

        // Validate payload (basic validation, can be improved with Zod)
        if (!payload || !Array.isArray(payload) || payload.length === 0) {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        // Save to DB as PROCESSING
        const leadRequest = await prisma.leadRequest.create({
            data: {
                payload: JSON.stringify(payload),
                status: 'PROCESSING',
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

// Retry endpoint for failed leads
app.post('/webhook/lead/:id/retry', async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const leadRequest = await prisma.leadRequest.findUnique({
            where: { id }
        });

        if (!leadRequest) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (leadRequest.status === 'PROCESSED') {
            return res.status(400).json({
                error: 'Lead already processed',
                vtigerId: leadRequest.vtigerId
            });
        }

        logger.info(`Retrying lead ${id}`);

        // Mark as PROCESSING
        await prisma.leadRequest.update({
            where: { id },
            data: { status: 'PROCESSING' }
        });

        try {
            const payload = JSON.parse(leadRequest.payload);
            const leadData = payload[0];
            const vtigerId = await createLeadAutomation(leadData);

            // Update DB with success
            await prisma.leadRequest.update({
                where: { id },
                data: {
                    status: 'PROCESSED',
                    vtigerId: vtigerId,
                    errorMessage: null,
                },
            });

            logger.info('Lead retry successful', { id, vtigerId });

            res.status(200).json({
                message: 'Lead created successfully',
                id: id,
                vtigerId: vtigerId
            });

        } catch (automationError: any) {
            logger.error('Retry failed', { error: automationError });

            await prisma.leadRequest.update({
                where: { id },
                data: {
                    status: 'FAILED',
                    errorMessage: automationError.message || 'Unknown error',
                },
            });

            res.status(500).json({
                error: 'Retry failed',
                id: id,
                message: automationError.message
            });
        }

    } catch (error) {
        logger.error('Error in retry endpoint', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
