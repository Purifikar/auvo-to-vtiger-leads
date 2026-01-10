/**
 * Purifikar Admin Panel - JavaScript
 * Gerenciamento de DLQ, Configurações e Logs
 * v2.0 - Melhorado com feedback visual, filtros por status e mais
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE = window.location.origin;
const CRM_URL = 'https://crm.purifikar.com.br'; // Para links do VTiger

// =============================================================================
// STATE
// =============================================================================

let state = {
    allLeads: [],
    filteredLeads: [],
    selectedLeads: new Set(),
    stats: null,
    configs: {},
    logs: [],
    currentTab: 'leads',
    currentStatusFilter: 'all',
    filters: {
        startDate: null,
        endDate: null,
        source: ''
    },
    isProcessing: false
};

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    loadStats();
    loadAllLeads();
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Refresh buttons
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        loadStats();
        loadAllLeads();
    });
    document.getElementById('btn-refresh-config')?.addEventListener('click', loadConfigs);
    document.getElementById('btn-refresh-logs')?.addEventListener('click', loadLogs);

    // Filters
    document.getElementById('btn-apply-filter')?.addEventListener('click', applyFilters);
    document.getElementById('btn-clear-filter')?.addEventListener('click', clearFilters);

    // Select all checkbox
    document.getElementById('select-all')?.addEventListener('change', toggleSelectAll);

    // Batch retry
    document.getElementById('btn-batch-retry')?.addEventListener('click', batchRetrySelected);

    // Edit Modal
    document.getElementById('btn-close-modal')?.addEventListener('click', closeEditModal);
    document.getElementById('btn-cancel-edit')?.addEventListener('click', closeEditModal);
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeEditModal();
    });
    document.getElementById('btn-save-payload')?.addEventListener('click', savePayload);
    document.getElementById('btn-save-and-reprocess')?.addEventListener('click', saveAndReprocess);

    // View Modal
    document.getElementById('btn-close-view-modal')?.addEventListener('click', closeViewModal);
    document.getElementById('btn-close-view')?.addEventListener('click', closeViewModal);
    document.getElementById('modal-view-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-view-overlay') closeViewModal();
    });

    // Config save
    document.getElementById('btn-save-config')?.addEventListener('click', saveConfigs);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
            closeViewModal();
        }
    });
}

// =============================================================================
// TAB MANAGEMENT
// =============================================================================

function switchTab(tabId) {
    state.currentTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });

    // Load data for specific tabs
    if (tabId === 'logs') loadLogs();
    if (tabId === 'config') loadConfigs();

    lucide.createIcons();
}

// =============================================================================
// API CALLS
// =============================================================================

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API Error');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// =============================================================================
// STATS
// =============================================================================

async function loadStats() {
    try {
        const stats = await apiCall('/api/stats');
        state.stats = stats;
        updateStatsDisplay(stats);
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível carregar estatísticas');
    }
}

function updateStatsDisplay(stats) {
    document.getElementById('stat-total').textContent = stats.total.toLocaleString('pt-BR');
    document.getElementById('stat-processed').textContent = stats.processed.toLocaleString('pt-BR');
    document.getElementById('stat-processing').textContent = stats.processing.toLocaleString('pt-BR');
    document.getElementById('stat-failed').textContent = stats.failed.toLocaleString('pt-BR');
    document.getElementById('stat-rate').textContent = stats.successRate;
}

// =============================================================================
// FILTER BY STATUS (CLICKABLE CARDS)
// =============================================================================

function filterByStatus(status) {
    state.currentStatusFilter = status;

    // Update card active state
    document.querySelectorAll('.stat-card.clickable').forEach(card => {
        card.classList.toggle('active', card.dataset.filter === status);
    });

    // Update title
    const titles = {
        'all': 'Todos os Leads',
        'PROCESSED': 'Leads Processados',
        'PROCESSING': 'Leads em Processamento',
        'FAILED': 'Leads com Erro'
    };
    document.getElementById('leads-title').textContent = titles[status] || 'Leads';

    // Show/hide batch retry button and checkbox column
    const showBatchRetry = status === 'FAILED';
    document.getElementById('btn-batch-retry').style.display = showBatchRetry ? 'flex' : 'none';
    document.getElementById('select-all-header').style.display = showBatchRetry ? 'table-cell' : 'none';

    // Apply filter
    applyStatusFilter();
}

function applyStatusFilter() {
    if (state.currentStatusFilter === 'all') {
        state.filteredLeads = [...state.allLeads];
    } else {
        state.filteredLeads = state.allLeads.filter(lead => lead.status === state.currentStatusFilter);
    }

    // Also apply date/source filters if set
    if (state.filters.startDate || state.filters.endDate || state.filters.source) {
        state.filteredLeads = state.filteredLeads.filter(lead => {
            const leadDate = new Date(lead.createdAt);

            if (state.filters.startDate) {
                const start = new Date(state.filters.startDate);
                start.setHours(0, 0, 0, 0);
                if (leadDate < start) return false;
            }

            if (state.filters.endDate) {
                const end = new Date(state.filters.endDate);
                end.setHours(23, 59, 59, 999);
                if (leadDate > end) return false;
            }

            if (state.filters.source && lead.source !== state.filters.source) {
                return false;
            }

            return true;
        });
    }

    // Sort by most recent update first (so reprocessed leads appear at top)
    state.filteredLeads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Clear selection
    state.selectedLeads.clear();
    updateSelectedCount();

    // Render table
    renderLeadsTable(state.filteredLeads);
}

// =============================================================================
// LEADS (ALL)
// =============================================================================

async function loadAllLeads() {
    const tbody = document.getElementById('leads-table-body');
    tbody.innerHTML = `
        <tr class="loading-row">
            <td colspan="10">
                <div class="loading-spinner"></div>
                Carregando leads...
            </td>
        </tr>
    `;

    try {
        // Fetch all leads (we'll need a new endpoint for this)
        const data = await apiCall('/api/leads/all');
        state.allLeads = data.leads || [];
        applyStatusFilter();

        // Update pagination info
        document.getElementById('total-count').textContent = state.allLeads.length;
        document.getElementById('showing-count').textContent = state.filteredLeads.length;
    } catch (error) {
        // Fallback to failed leads only
        try {
            const data = await apiCall('/api/leads/failed');
            state.allLeads = data.leads || [];
            applyStatusFilter();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: var(--accent-red);">
                        Erro ao carregar leads: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

function renderLeadsTable(leads) {
    const tbody = document.getElementById('leads-table-body');
    const showCheckbox = state.currentStatusFilter === 'FAILED';

    // Update counts
    document.getElementById('showing-count').textContent = leads.length;
    document.getElementById('total-count').textContent = state.allLeads.length;

    if (leads.length === 0) {
        const message = state.currentStatusFilter === 'all'
            ? 'Nenhum lead encontrado'
            : state.currentStatusFilter === 'FAILED'
                ? '🎉 Nenhum lead com erro!'
                : 'Nenhum lead nesta categoria';
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    ${message}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = leads.map(lead => {
        const payload = lead.payload;
        const vtiger = Array.isArray(payload) ? payload[0]?.vtiger : payload?.vtiger;
        const companyName = vtiger?.company || vtiger?.lastname || 'Sem nome';
        const errorMsg = lead.errorMessage || '';
        const truncatedError = errorMsg.length > 35 ? errorMsg.substring(0, 35) + '...' : errorMsg;
        const date = formatDate(lead.updatedAt); // Show last update time (reprocessed leads show new time)
        const statusLower = (lead.status || 'PENDING').toLowerCase();

        // Determine what to show in Error/Info column
        let infoContent = '';
        if (lead.status === 'FAILED') {
            infoContent = `<span class="error-badge" title="${errorMsg}">${truncatedError || 'Erro desconhecido'}</span>`;
        } else if (lead.status === 'PROCESSED') {
            infoContent = `<span class="success-info">Processado com sucesso</span>`;
        } else if (lead.status === 'PROCESSING') {
            infoContent = `<span class="status-badge processing">Em andamento...</span>`;
        } else {
            infoContent = '-';
        }

        // VTiger ID column
        const vtigerCell = lead.vtigerId
            ? `<a href="${CRM_URL}/index.php?module=Leads&view=Detail&record=${lead.vtigerId}" target="_blank" class="vtiger-link">${lead.vtigerId}</a>`
            : '-';

        // Actions based on status
        let actionsHtml = '';
        if (lead.status === 'FAILED') {
            actionsHtml = `
                <button class="btn-icon" title="Editar Payload" onclick="openEditModal(${lead.id})">
                    <i data-lucide="edit-2"></i>
                </button>
                <button class="btn-icon" title="Reprocessar" onclick="reprocessSingle(${lead.id}, this)">
                    <i data-lucide="play"></i>
                </button>
            `;
        } else {
            actionsHtml = `
                <button class="btn-icon" title="Ver Detalhes" onclick="openViewModal(${lead.id})">
                    <i data-lucide="eye"></i>
                </button>
            `;
        }

        return `
            <tr data-id="${lead.id}" class="row-${statusLower}">
                ${showCheckbox ? `
                    <td>
                        <input type="checkbox" class="checkbox lead-checkbox" data-id="${lead.id}" 
                               ${state.selectedLeads.has(lead.id) ? 'checked' : ''}>
                    </td>
                ` : ''}
                <td>
                    <span class="status-badge ${statusLower}">${getStatusLabel(lead.status)}</span>
                </td>
                <td>#${lead.id}</td>
                <td title="${companyName}">${truncateText(companyName, 22)}</td>
                <td>${vtigerCell}</td>
                <td>${infoContent}</td>
                <td>
                    <span class="retry-badge">${lead.retryCount || 0}</span>
                </td>
                <td>
                    <span class="source-badge">${lead.source || 'WEBHOOK'}</span>
                </td>
                <td>${date}</td>
                <td>
                    <div class="action-buttons">
                        ${actionsHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Re-init icons and event listeners
    lucide.createIcons();

    // Add checkbox listeners
    if (showCheckbox) {
        document.querySelectorAll('.lead-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) {
                    state.selectedLeads.add(id);
                } else {
                    state.selectedLeads.delete(id);
                }
                updateSelectedCount();
            });
        });
    }
}

function getStatusLabel(status) {
    const labels = {
        'PROCESSED': 'Sucesso',
        'PROCESSING': 'Processando',
        'FAILED': 'Erro',
        'PENDING': 'Pendente'
    };
    return labels[status] || status;
}

function applyFilters() {
    state.filters.startDate = document.getElementById('filter-start').value || null;
    state.filters.endDate = document.getElementById('filter-end').value || null;
    state.filters.source = document.getElementById('filter-source').value || '';
    applyStatusFilter();
    showToast('success', 'Filtros aplicados', `Mostrando ${state.filteredLeads.length} leads`);
}

function clearFilters() {
    document.getElementById('filter-start').value = '';
    document.getElementById('filter-end').value = '';
    document.getElementById('filter-source').value = '';
    state.filters = { startDate: null, endDate: null, source: '' };
    applyStatusFilter();
    showToast('success', 'Filtros limpos', 'Mostrando todos os leads');
}

function toggleSelectAll(e) {
    const checked = e.target.checked;
    state.selectedLeads.clear();

    if (checked) {
        state.filteredLeads.forEach(lead => {
            if (lead.status === 'FAILED') {
                state.selectedLeads.add(lead.id);
            }
        });
    }

    document.querySelectorAll('.lead-checkbox').forEach(cb => {
        cb.checked = checked;
    });

    updateSelectedCount();
}

function updateSelectedCount() {
    const count = state.selectedLeads.size;
    document.getElementById('selected-count').textContent = count;
    document.getElementById('btn-batch-retry').disabled = count === 0;
}

// =============================================================================
// REPROCESS
// =============================================================================

async function reprocessSingle(id, btnElement) {
    if (state.isProcessing) return;

    const btn = btnElement || event.target.closest('.btn-icon');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div>';
    btn.disabled = true;
    state.isProcessing = true;

    // Update row to show processing
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
        row.classList.remove('row-failed');
        row.classList.add('row-processing');
        const statusBadge = row.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = 'status-badge processing';
            statusBadge.textContent = 'Processando';
        }
    }

    try {
        const result = await apiCall(`/api/lead/${id}/reprocess`, { method: 'POST' });

        if (result.success) {
            showToast('success', 'Sucesso!', `Lead #${id} processado. VTiger ID: ${result.vtigerId}`);
            loadStats();
            loadAllLeads();
        } else {
            showToast('error', 'Erro', result.error || 'Falha no reprocessamento');
            // Revert row state
            if (row) {
                row.classList.remove('row-processing');
                row.classList.add('row-failed');
            }
        }
    } catch (error) {
        showToast('error', 'Erro', error.message);
        // Revert row state
        if (row) {
            row.classList.remove('row-processing');
            row.classList.add('row-failed');
        }
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        state.isProcessing = false;
        lucide.createIcons();
    }
}

async function batchRetrySelected() {
    if (state.selectedLeads.size === 0 || state.isProcessing) return;

    const ids = Array.from(state.selectedLeads);
    const btn = document.getElementById('btn-batch-retry');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div> Processando...';
    btn.disabled = true;
    state.isProcessing = true;

    // Mark all selected rows as processing
    ids.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            row.classList.remove('row-failed');
            row.classList.add('row-processing');
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = 'status-badge processing';
                statusBadge.textContent = 'Processando';
            }
        }
    });

    try {
        const result = await apiCall('/api/leads/batch-retry', {
            method: 'POST',
            body: JSON.stringify({ ids })
        });

        showToast('success', 'Batch Concluído',
            `✅ ${result.success} sucesso | ❌ ${result.failed} falha | ⏭️ ${result.skipped} pulados`);

        loadStats();
        loadAllLeads();
    } catch (error) {
        showToast('error', 'Erro', error.message);
        loadAllLeads();
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = state.selectedLeads.size === 0;
        state.isProcessing = false;
        lucide.createIcons();
    }
}

// =============================================================================
// EDIT MODAL
// =============================================================================

async function openEditModal(id) {
    const modal = document.getElementById('modal-overlay');
    const lead = state.allLeads.find(l => l.id === id);

    if (!lead) {
        showToast('error', 'Erro', 'Lead não encontrado');
        return;
    }

    if (lead.status !== 'FAILED') {
        showToast('warning', 'Atenção', 'Apenas leads com erro podem ser editados');
        return;
    }

    document.getElementById('modal-lead-id').textContent = id;
    document.getElementById('payload-editor').value = JSON.stringify(lead.payload, null, 2);
    document.getElementById('modal-error-message').textContent = lead.errorMessage || '-';
    document.getElementById('modal-retry-count').textContent = lead.retryCount || 0;

    modal.classList.add('active');
    modal.dataset.leadId = id;
}

function closeEditModal() {
    const modal = document.getElementById('modal-overlay');
    modal.classList.remove('active');
    delete modal.dataset.leadId;
}

async function savePayload() {
    const modal = document.getElementById('modal-overlay');
    const id = parseInt(modal.dataset.leadId);
    const payloadText = document.getElementById('payload-editor').value;
    const btn = document.getElementById('btn-save-payload');

    try {
        const payload = JSON.parse(payloadText);

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Salvando...';

        await apiCall(`/api/lead/${id}/payload`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        showToast('success', 'Salvo', 'Payload atualizado com sucesso');
        closeEditModal();
        loadAllLeads();
    } catch (error) {
        if (error instanceof SyntaxError) {
            showToast('error', 'JSON Inválido', 'Verifique a sintaxe do JSON');
        } else {
            showToast('error', 'Erro', error.message);
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save"></i> Salvar';
        lucide.createIcons();
    }
}

async function saveAndReprocess() {
    const modal = document.getElementById('modal-overlay');
    const id = parseInt(modal.dataset.leadId);
    const payloadText = document.getElementById('payload-editor').value;
    const btn = document.getElementById('btn-save-and-reprocess');

    try {
        const payload = JSON.parse(payloadText);

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Processando...';

        // Save first
        await apiCall(`/api/lead/${id}/payload`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        // Close modal and show processing state
        closeEditModal();

        // Update row to show processing
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            row.classList.remove('row-failed');
            row.classList.add('row-processing');
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = 'status-badge processing';
                statusBadge.textContent = 'Processando';
            }
        }

        showToast('success', 'Iniciado', `Lead #${id} está sendo reprocessado...`);

        // Then reprocess
        const result = await apiCall(`/api/lead/${id}/reprocess`, { method: 'POST' });

        if (result.success) {
            showToast('success', 'Sucesso!', `Lead #${id} processado. VTiger ID: ${result.vtigerId}`);
            loadStats();
            loadAllLeads();
        } else {
            showToast('error', 'Erro', result.error || 'Falha no reprocessamento');
            loadAllLeads();
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            showToast('error', 'JSON Inválido', 'Verifique a sintaxe do JSON');
        } else {
            showToast('error', 'Erro', error.message);
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="play"></i> Salvar e Reprocessar';
        lucide.createIcons();
    }
}

// =============================================================================
// VIEW MODAL (Read-only)
// =============================================================================

function openViewModal(id) {
    const modal = document.getElementById('modal-view-overlay');
    const lead = state.allLeads.find(l => l.id === id);

    if (!lead) {
        showToast('error', 'Erro', 'Lead não encontrado');
        return;
    }

    document.getElementById('view-lead-id').textContent = id;

    const statusBadge = document.getElementById('view-status');
    statusBadge.textContent = getStatusLabel(lead.status);
    statusBadge.className = `status-badge ${(lead.status || '').toLowerCase()}`;

    document.getElementById('view-vtiger-id').textContent = lead.vtigerId || '-';
    document.getElementById('view-created-at').textContent = formatDate(lead.createdAt);
    document.getElementById('view-updated-at').textContent = formatDate(lead.updatedAt);
    document.getElementById('view-payload').textContent = JSON.stringify(lead.payload, null, 2);

    modal.classList.add('active');
}

function closeViewModal() {
    document.getElementById('modal-view-overlay').classList.remove('active');
}

// =============================================================================
// CONFIGS
// =============================================================================

async function loadConfigs() {
    try {
        const configs = await apiCall('/api/configs');
        state.configs = configs.reduce((acc, cfg) => {
            acc[cfg.key] = cfg;
            return acc;
        }, {});

        // Update UI
        Object.entries(state.configs).forEach(([key, cfg]) => {
            const el = document.getElementById(`config-${key}`);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = cfg.value === 'true';
                } else {
                    el.value = cfg.value;
                }
            }
        });

        // Load history
        const history = await apiCall('/api/configs/history');
        renderConfigHistory(history);
    } catch (error) {
        console.log('Configs not available yet');
    }
}

function renderConfigHistory(history) {
    const tbody = document.getElementById('config-history-body');

    if (!history || history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted);">
                    Nenhuma alteração registrada
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = history.slice(0, 10).map(h => `
        <tr>
            <td>${h.configKey}</td>
            <td><code>${h.oldValue}</code></td>
            <td><code>${h.newValue}</code></td>
            <td>${formatDate(h.changedAt)}</td>
        </tr>
    `).join('');
}

async function saveConfigs() {
    const btn = document.getElementById('btn-save-config');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Salvando...';

    try {
        const configElements = document.querySelectorAll('[data-key]');
        const updates = [];

        configElements.forEach(el => {
            const key = el.dataset.key;
            let value;

            if (el.type === 'checkbox') {
                value = el.checked ? 'true' : 'false';
            } else {
                value = el.value;
            }

            updates.push({ key, value });
        });

        await apiCall('/api/configs', {
            method: 'PUT',
            body: JSON.stringify({ configs: updates })
        });

        showToast('success', 'Salvo', 'Configurações atualizadas com sucesso');
        loadConfigs();
    } catch (error) {
        showToast('error', 'Erro', error.message || 'Não foi possível salvar');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save"></i> Salvar Configurações';
        lucide.createIcons();
    }
}

// =============================================================================
// LOGS
// =============================================================================

async function loadLogs() {
    const container = document.getElementById('logs-container');
    container.innerHTML = `
        <div class="log-entry info">
            <span class="log-time">--:--:--</span>
            <span class="log-level">INFO</span>
            <span class="log-message">Carregando logs...</span>
        </div>
    `;

    try {
        const level = document.getElementById('log-level-filter')?.value || '';
        const search = document.getElementById('log-search')?.value || '';

        let endpoint = '/api/logs';
        const params = new URLSearchParams();
        if (level) params.append('level', level);
        if (search) params.append('search', search);
        if (params.toString()) endpoint += `?${params.toString()}`;

        const logs = await apiCall(endpoint);
        state.logs = logs;
        renderLogs(logs);
    } catch (error) {
        container.innerHTML = `
            <div class="log-entry error">
                <span class="log-time">--:--:--</span>
                <span class="log-level">ERROR</span>
                <span class="log-message">Logs não disponíveis: ${error.message}</span>
            </div>
        `;
    }
}

function renderLogs(logs) {
    const container = document.getElementById('logs-container');

    if (!logs || logs.length === 0) {
        container.innerHTML = `
            <div class="log-entry info">
                <span class="log-time">--:--:--</span>
                <span class="log-level">INFO</span>
                <span class="log-message">Nenhum log encontrado</span>
            </div>
        `;
        return;
    }

    container.innerHTML = logs.map(log => {
        const time = new Date(log.createdAt).toLocaleTimeString('pt-BR');
        const level = (log.level || 'info').toLowerCase();

        return `
            <div class="log-entry ${level}">
                <span class="log-time">${time}</span>
                <span class="log-level">${log.level}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `;
    }).join('');
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

function showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    const id = Date.now();

    const iconMap = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = `toast-${id}`;
    toast.innerHTML = `
        <i data-lucide="${iconMap[type]}" class="toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="btn-icon" onclick="removeToast(${id})">
            <i data-lucide="x"></i>
        </button>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    // Auto remove after 5 seconds
    setTimeout(() => removeToast(id), 5000);
}

function removeToast(id) {
    const toast = document.getElementById(`toast-${id}`);
    if (toast) {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }
}

// =============================================================================
// UTILITIES
// =============================================================================

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Add toastOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes toastOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
`;
document.head.appendChild(style);
