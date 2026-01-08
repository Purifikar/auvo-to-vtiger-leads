/**
 * Setup global para testes
 */

import dotenv from 'dotenv';

// Carrega variáveis de ambiente do .env
dotenv.config();

// Define variáveis de teste padrão se não existirem
process.env.NODE_ENV = 'test';
process.env.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'test-key';
process.env.AUVO_API_KEY = process.env.AUVO_API_KEY || 'test-key';
process.env.AUVO_API_TOKEN = process.env.AUVO_API_TOKEN || 'test-token';
process.env.AUVO_API_URL = process.env.AUVO_API_URL || 'https://api.auvo.com.br/v2';
process.env.ENABLE_PILOT_FILTER = process.env.ENABLE_PILOT_FILTER || 'true';
process.env.PILOT_USER_IDS = process.env.PILOT_USER_IDS || '213670';
