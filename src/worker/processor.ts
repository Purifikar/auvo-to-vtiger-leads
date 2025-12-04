import { Worker } from 'bullmq';
import { redisOptions } from '../queue/connection';
import { createLeadAutomation } from '../automation/createLead';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const worker = new Worker('lead-queue', async job => {
    logger.info(`Processing job ${job.id}`, { requestId: job.data.requestId });

    try {
        // Update DB to PROCESSED (or PROCESSING)
        const vtigerId = await createLeadAutomation(job.data.data);

        await prisma.leadRequest.update({
            where: { id: job.data.requestId },
            data: {
                status: 'PROCESSED',
                vtigerId: vtigerId,
            },
        });

        logger.info(`Job ${job.id} completed`);
    } catch (error: any) {
        logger.error(`Job ${job.id} failed`, { error });

        await prisma.leadRequest.update({
            where: { id: job.data.requestId },
            data: {
                status: 'FAILED',
                errorMessage: error.message || 'Unknown error',
            },
        });

        // Send Error Email
        // Dynamic import to avoid circular dependencies if any, or just standard import
        try {
            const { sendErrorEmail } = await import('../lib/email');
            await sendErrorEmail(`Job ${job.id} Failed`, error, job.data);
        } catch (emailErr) {
            logger.error('Failed to import/send email', { error: emailErr });
        }

        throw error; // Let BullMQ handle retries if configured
    }
}, { connection: redisOptions });

worker.on('completed', job => {
    logger.info(`${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    logger.error(`${job?.id} has failed with ${err.message}`);
});

logger.info('Worker started');
