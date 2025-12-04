import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

export const redisOptions: ConnectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
};
