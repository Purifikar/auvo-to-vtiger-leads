import express from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const app = express();
app.use(express.json());

app.post('/webhook/lead', async (req, res) => {
    try {
        const payload = req.body;
        logger.info('Received webhook', { payload });

        // Validate payload (basic validation, can be improved with Zod)
        if (!payload || !Array.isArray(payload) || payload.length === 0) {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        // Save to DB
        const leadRequest = await prisma.leadRequest.create({
            data: {
                payload: JSON.stringify(payload),
                status: 'PENDING',
            },
        });

        logger.info(`Lead request received and saved`, { id: leadRequest.id });

        res.status(200).json({ message: 'Lead received and queued', id: leadRequest.id });
    } catch (error) {
        logger.error('Error processing webhook', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
