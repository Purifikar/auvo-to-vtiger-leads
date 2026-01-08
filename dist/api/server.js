"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../lib/logger");
const createLead_1 = require("../automation/createLead");
const email_1 = require("../lib/email");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const startTime = Date.now();
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000)
    });
});
app.post('/webhook/lead', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = req.body;
        logger_1.logger.info('Received webhook', { payload });
        // Validate payload (basic validation, can be improved with Zod)
        if (!payload || !Array.isArray(payload) || payload.length === 0) {
            return res.status(400).json({ error: 'Invalid payload' });
        }
        // Save to DB as PROCESSING
        const leadRequest = yield prisma_1.prisma.leadRequest.create({
            data: {
                payload: JSON.stringify(payload),
                status: 'PROCESSING',
            },
        });
        logger_1.logger.info(`Lead request received and saved`, { id: leadRequest.id });
        try {
            // Process lead synchronously
            const leadData = payload[0];
            const vtigerId = yield (0, createLead_1.createLeadAutomation)(leadData);
            // Update DB with success
            yield prisma_1.prisma.leadRequest.update({
                where: { id: leadRequest.id },
                data: {
                    status: 'PROCESSED',
                    vtigerId: vtigerId,
                },
            });
            logger_1.logger.info('Lead created successfully', { id: leadRequest.id, vtigerId });
            res.status(200).json({
                message: 'Lead created successfully',
                id: leadRequest.id,
                vtigerId: vtigerId
            });
        }
        catch (automationError) {
            logger_1.logger.error('Automation failed', { error: automationError });
            // Update DB with failure
            yield prisma_1.prisma.leadRequest.update({
                where: { id: leadRequest.id },
                data: {
                    status: 'FAILED',
                    errorMessage: automationError.message || 'Unknown error',
                },
            });
            // Send error email
            try {
                yield (0, email_1.sendErrorEmail)(`Lead ${leadRequest.id} Failed`, automationError, {
                    requestId: leadRequest.id,
                    payload: payload[0]
                });
            }
            catch (emailErr) {
                logger_1.logger.error('Failed to send error email', { error: emailErr });
            }
            res.status(500).json({
                error: 'Failed to create lead',
                id: leadRequest.id,
                message: automationError.message
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Error processing webhook', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// Retry endpoint for failed leads
app.post('/webhook/lead/:id/retry', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = parseInt(req.params.id);
        const leadRequest = yield prisma_1.prisma.leadRequest.findUnique({
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
        logger_1.logger.info(`Retrying lead ${id}`);
        // Mark as PROCESSING
        yield prisma_1.prisma.leadRequest.update({
            where: { id },
            data: { status: 'PROCESSING' }
        });
        try {
            const payload = JSON.parse(leadRequest.payload);
            const leadData = payload[0];
            const vtigerId = yield (0, createLead_1.createLeadAutomation)(leadData);
            // Update DB with success
            yield prisma_1.prisma.leadRequest.update({
                where: { id },
                data: {
                    status: 'PROCESSED',
                    vtigerId: vtigerId,
                    errorMessage: null,
                },
            });
            logger_1.logger.info('Lead retry successful', { id, vtigerId });
            res.status(200).json({
                message: 'Lead created successfully',
                id: id,
                vtigerId: vtigerId
            });
        }
        catch (automationError) {
            logger_1.logger.error('Retry failed', { error: automationError });
            yield prisma_1.prisma.leadRequest.update({
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
    }
    catch (error) {
        logger_1.logger.error('Error in retry endpoint', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger_1.logger.info(`Server running on port ${PORT}`);
});
