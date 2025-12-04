import { createLeadAutomation } from '../automation/createLead';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const POLLING_INTERVAL = 5000; // 5 seconds

async function processNextLead() {
    try {
        // Find the oldest PENDING request
        // We use a transaction or just simple update for now since we have one worker
        // For multiple workers, we'd need 'SELECT FOR UPDATE SKIP LOCKED' which Prisma supports via raw query or optimistic locking
        // Given the scale, simple findFirst is likely okay if we only run one worker container.

        const pendingRequest = await prisma.leadRequest.findFirst({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
        });

        if (!pendingRequest) {
            return; // No work to do
        }

        logger.info(`Processing request ${pendingRequest.id}`);

        // Mark as PROCESSING
        await prisma.leadRequest.update({
            where: { id: pendingRequest.id },
            data: { status: 'PROCESSING' },
        });

        try {
            const payload = JSON.parse(pendingRequest.payload);
            // Assuming payload is an array and we take the first item, similar to before
            const leadData = payload[0];

            const vtigerId = await createLeadAutomation(leadData);

            await prisma.leadRequest.update({
                where: { id: pendingRequest.id },
                data: {
                    status: 'PROCESSED',
                    vtigerId: vtigerId,
                },
            });

            logger.info(`Request ${pendingRequest.id} completed successfully`);

        } catch (error: any) {
            logger.error(`Request ${pendingRequest.id} failed`, { error });

            await prisma.leadRequest.update({
                where: { id: pendingRequest.id },
                data: {
                    status: 'FAILED',
                    errorMessage: error.message || 'Unknown error',
                },
            });

            // Send Error Email
            try {
                const { sendErrorEmail } = await import('../lib/email');
                await sendErrorEmail(`Request ${pendingRequest.id} Failed`, error, { requestId: pendingRequest.id });
            } catch (emailErr) {
                logger.error('Failed to send email', { error: emailErr });
            }
        }

    } catch (error) {
        logger.error('Error in polling loop', { error });
    }
}

async function startWorker() {
    logger.info('Worker started (Polling Mode)');

    // Initial run
    await processNextLead();

    // Loop
    setInterval(async () => {
        await processNextLead();
    }, POLLING_INTERVAL);
}

startWorker();
