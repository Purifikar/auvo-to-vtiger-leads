/**
 * Auvo Sync Module
 * Módulo principal para sincronização de leads da Auvo para o Vtiger
 * 
 * Este módulo replica a lógica do workflow n8n para:
 * 1. Buscar clientes novos na Auvo
 * 2. Buscar tarefas associadas
 * 3. Filtrar por consultores
 * 4. Obter endereço via Google Maps (quando aplicável)
 * 5. Enviar para o webhook do Vtiger
 */

// Types
export * from './types';

// Helpers
export * from './helpers';

// Services
export * from './services';

