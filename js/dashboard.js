/**
 * ============================================================================
 * DASHBOARD - VISUALIZAÇÃO DO PROGRESSO DO PROJETO QFD
 * ============================================================================
 * 
 * Este módulo gerencia a página principal (dashboard) do sistema QFD,
 * exibindo o progresso de cada etapa do projeto em tempo real através
 * de cards visuais e atualizações automáticas.
 * 
 * Funcionalidades:
 * - Atualização automática do progresso a cada 5 segundos
 * - Cards de progresso para cada etapa do QFD
 * - Sistema de dropdown para navegação
 * - Validação de dados e exibição de estatísticas
 * - Sistema de backup automático
 */

// ========================================================================
// SEÇÃO 1: INICIALIZAÇÃO E CONFIGURAÇÃO
// ========================================================================

/**
 * Inicializa o dashboard quando a página é carregada
 * Configura atualização automática e menu dropdown
 */
document.addEventListener('DOMContentLoaded', function() {
    updateDashboard();
    
    // Atualiza dashboard a cada 5 segundos se a página estiver ativa
    // Evita atualizações desnecessárias quando a aba está oculta
    setInterval(() => {
        if (!document.hidden) {
            updateDashboard();
        }
    }, 5000);
});

// ========================================================================
// SEÇÃO 2: ATUALIZAÇÃO DO DASHBOARD E PROGRESSO
// ========================================================================

/**
 * Atualiza todas as informações do dashboard
 * Calcula progresso de cada etapa e atualiza os cards visuais
 */
function updateDashboard() {
    const stats = qfdDB.getProjectStats();
    
    // Atualiza cards de progresso
    updateProgressCard('cliente', stats.requisitosCliente, 'requisitos');
    updateProgressCard('projeto', stats.requisitosProjeto, 'requisitos');
    
    // Calcula progresso das comparações
    const totalComparacoesCliente = calculateTotalComparisons(stats.requisitosCliente);
    const progressComparacao = totalComparacoesCliente > 0 ? 
        Math.round((stats.comparacoesCliente / totalComparacoesCliente) * 100) : 0;
    updateProgressCard('comparacao', progressComparacao, '% completo');
    
    // Calcula progresso das correlações
    const totalCorrelacoesProjeto = calculateTotalComparisons(stats.requisitosProjeto);
    const progressCorrelacao = totalCorrelacoesProjeto > 0 ? 
        Math.round((stats.correlacoesProjeto / totalCorrelacoesProjeto) * 100) : 0;
    updateProgressCard('correlacao', progressCorrelacao, '% completo');
    
    // Calcula progresso da matriz QFD
    const totalRelacoesQFD = stats.requisitosCliente * stats.requisitosProjeto;
    const progressQFD = totalRelacoesQFD > 0 ? 
        Math.round((stats.relacoesQFD / totalRelacoesQFD) * 100) : 0;
    updateProgressCard('qfd', progressQFD, '% completo');

    updateProgressCard('especificacoes', stats.especificacoesPercent || 0, '% completo');

    // Avaliação competitiva: só conta como iniciada com pelo menos um concorrente
    updateProgressCard('competitiva', stats.concorrentes > 0 ? stats.competitivaPercent : 0, '% completo');

    // Atendimento: % ponderado dos requisitos de cliente com metas medidas
    const atendimento = qfdDB.getAnaliseAtendimento(false).atendimentoGeral;
    updateProgressCard('atendimento', atendimento === null ? 0 : Math.round(atendimento * 100), '% atendido');
    
    // Atualiza status do relatório
    const canGenerateReport = stats.requisitosCliente > 0 && stats.requisitosProjeto > 0 && 
                             stats.relacoesQFD > 0;
    updateReportStatus(canGenerateReport);
    
    // Atualiza última modificação
    updateLastModified(stats.lastModified);
}

/**
 * Atualiza um card de progresso específico no dashboard
 * 
 * @param {string} type - Tipo do card: 'cliente', 'projeto', 'comparacao', 'correlacao', 'qfd'
 * @param {number} value - Valor numérico do progresso
 * @param {string} unit - Unidade de medida ('requisitos', '% completo', etc.)
 */
function updateProgressCard(type, value, unit) {
    const statusElement = document.getElementById(`status-${type}`);
    const countElement = document.getElementById(`count-${type}`);
    const cardElement = document.getElementById(`progress-${type}`);
    
    if (!statusElement || !countElement || !cardElement) return;
    
    // Determina status baseado no valor
    let status, statusClass;
    if (value === 0) {
        status = 'Não iniciado';
        statusClass = 'not-started';
    } else if (type === 'cliente' || type === 'projeto') {
        status = 'Concluído';
        statusClass = 'completed';
    } else if (value < 50) {
        status = 'Em andamento';
        statusClass = 'in-progress';
    } else if (value < 100) {
        status = 'Quase completo';
        statusClass = 'in-progress';
    } else {
        status = 'Concluído';
        statusClass = 'completed';
    }
    
    // Atualiza elementos
    statusElement.textContent = status;
    statusElement.className = `status ${statusClass}`;
    countElement.textContent = `${value} ${unit}`;
    
    // Atualiza cor do card baseado no progresso
    cardElement.style.borderLeftColor = getProgressColor(value, type);
}

/**
 * Atualiza o status do card de relatório PDF
 * Indica se o relatório pode ser gerado ou não
 * 
 * @param {boolean} canGenerate - true se há dados suficientes para gerar relatório
 */
function updateReportStatus(canGenerate) {
    const statusElement = document.getElementById('status-relatorio');
    const countElement = document.getElementById('count-relatorio');
    
    if (!statusElement || !countElement) return;
    
    if (canGenerate) {
        statusElement.textContent = 'Disponível';
        statusElement.className = 'status completed';
        countElement.textContent = 'Pronto para gerar';
    } else {
        statusElement.textContent = 'Não disponível';
        statusElement.className = 'status not-started';
        countElement.textContent = 'Aguardando dados';
    }
}

/**
 * Atualiza a exibição da data/hora da última modificação do projeto
 * Cria o elemento se não existir
 * 
 * @param {string} lastModified - Data da última modificação em formato ISO
 */
function updateLastModified(lastModified) {
    const date = new Date(lastModified);
    const formattedDate = date.toLocaleString('pt-BR');
    
    // Adiciona informação de última modificação se não existir
    let lastModifiedElement = document.getElementById('last-modified');
    if (!lastModifiedElement) {
        lastModifiedElement = document.createElement('div');
        lastModifiedElement.id = 'last-modified';
        lastModifiedElement.className = 'last-modified-info';
        lastModifiedElement.innerHTML = `
            <small><i class="fas fa-clock"></i> Última modificação: <span id="last-modified-date">${formattedDate}</span></small>
        `;
        
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) {
            dashboard.appendChild(lastModifiedElement);
        }
    } else {
        const dateSpan = document.getElementById('last-modified-date');
        if (dateSpan) {
            dateSpan.textContent = formattedDate;
        }
    }
}

// ========================================================================
// SEÇÃO 3: FUNÇÕES AUXILIARES DE CÁLCULO
// ========================================================================

/**
 * Calcula o total de comparações possíveis entre n itens
 * Usa a fórmula de combinações: n * (n-1) / 2
 * 
 * @param {number} count - Número de itens
 * @returns {number} Total de comparações possíveis
 */
function calculateTotalComparisons(count) {
    // Fórmula para combinações: n * (n-1) / 2
    return count > 1 ? (count * (count - 1)) / 2 : 0;
}

/**
 * Retorna a cor da borda do card baseado no progresso
 * 
 * @param {number} value - Valor do progresso (0-100)
 * @param {string} type - Tipo do card
 * @returns {string} Cor em formato hexadecimal
 */
function getProgressColor(value, type) {
    if (type === 'cliente' || type === 'projeto') {
        return value > 0 ? '#28a745' : '#6c757d';
    }
    
    if (value === 0) return '#6c757d';
    if (value < 50) return '#ffc107';
    if (value < 100) return '#17a2b8';
    return '#28a745';
}

// ========================================================================
// SEÇÃO 4: MODAL DE DETALHES E VALIDAÇÃO
// ========================================================================

/**
 * Exibe um modal com detalhes completos do progresso do projeto
 * Inclui estatísticas detalhadas e erros de validação se houver
 */
function showProgressDetails() {
    const stats = qfdDB.getProjectStats();
    const validation = qfdDB.validateData();
    
    let detailsHTML = `
        <div class="progress-details">
            <h3>Detalhes do Progresso</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <strong>Requisitos de Cliente:</strong> ${stats.requisitosCliente}
                </div>
                <div class="stat-item">
                    <strong>Requisitos de Projeto:</strong> ${stats.requisitosProjeto}
                </div>
                <div class="stat-item">
                    <strong>Comparações Cliente:</strong> ${stats.comparacoesCliente}
                </div>
                <div class="stat-item">
                    <strong>Correlações Projeto:</strong> ${stats.correlacoesProjeto}
                </div>
                <div class="stat-item">
                    <strong>Relações QFD:</strong> ${stats.relacoesQFD}
                </div>
            </div>
    `;
    
    if (!validation.isValid) {
        detailsHTML += `
            <div class="validation-errors">
                <h4>Problemas Encontrados:</h4>
                <ul>
                    ${validation.errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    detailsHTML += '</div>';
    
    // Cria modal simples
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            ${detailsHTML}
            <button class="btn btn-primary" onclick="closeModal()">Fechar</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
}

/**
 * Fecha o modal de detalhes do progresso
 */
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Adiciona botão de detalhes se não existir
document.addEventListener('DOMContentLoaded', function() {
    const quickActions = document.querySelector('.action-buttons');
    if (quickActions && !document.getElementById('details-btn')) {
        const detailsBtn = document.createElement('button');
        detailsBtn.id = 'details-btn';
        detailsBtn.className = 'btn btn-secondary';
        detailsBtn.innerHTML = '<i class="fas fa-info-circle"></i> Ver Detalhes';
        detailsBtn.onclick = showProgressDetails;
        quickActions.appendChild(detailsBtn);
    }
});

// ========================================================================
// SEÇÃO 5: SISTEMA DE BACKUP AUTOMÁTICO
// ========================================================================

/**
 * Cria um backup automático dos dados do projeto
 * Armazena no LocalStorage com prefixo 'qfd_backup'
 */
function createAutoBackup() {
    // loadData (e não exportData): exportData chama saveData, que dispararia
    // este backup de novo em loop infinito
    const data = qfdDB.loadData();
    const backup = {
        ...data,
        backup: {
            created: new Date().toISOString(),
            type: 'auto'
        }
    };
    
    try {
        localStorage.setItem('qfd_backup', JSON.stringify(backup));
    } catch (error) {
        // Sem espaço para a cópia: os dados principais já foram salvos
        console.warn('Backup automático não salvo:', error);
    }
}

/**
 * Configura o sistema de backup automático
 * Intercepta chamadas de saveData para criar backup automaticamente
 */
function setupAutoBackup() {
    const originalSaveData = qfdDB.saveData;
    qfdDB.saveData = function(data) {
        originalSaveData.call(this, data);
        createAutoBackup();
    };
}

/**
 * Inicializa o sistema de backup automático quando a página carrega
 */
document.addEventListener('DOMContentLoaded', function() {
    setupAutoBackup();
});

/**
 * Restaura dados de um backup anterior
 * Solicita confirmação antes de restaurar
 */
function restoreBackup() {
    const backup = localStorage.getItem('qfd_backup');
    if (!backup) {
        alert('Nenhum backup encontrado.');
        return;
    }
    
    if (confirm('Tem certeza que deseja restaurar o backup? Os dados atuais serão perdidos.')) {
        try {
            const backupData = JSON.parse(backup);
            delete backupData.backup; // Remove metadados do backup
            qfdDB.importData(backupData);
            alert('Backup restaurado com sucesso!');
            location.reload();
        } catch (error) {
            alert('Erro ao restaurar backup: ' + error.message);
        }
    }
}

/**
 * Adiciona botões de backup e restore ao dashboard se não existirem
 * Cria elementos dinamicamente para facilitar a gestão de dados
 */
document.addEventListener('DOMContentLoaded', function() {
    const quickActions = document.querySelector('.action-buttons');
    if (quickActions && !document.getElementById('backup-btn')) {
        const backupBtn = document.createElement('button');
        backupBtn.id = 'backup-btn';
        backupBtn.className = 'btn btn-secondary';
        backupBtn.innerHTML = '<i class="fas fa-download"></i> Backup';
        backupBtn.onclick = exportProjectData;
        quickActions.appendChild(backupBtn);
        
        const restoreBtn = document.createElement('button');
        restoreBtn.id = 'restore-btn';
        restoreBtn.className = 'btn btn-secondary';
        restoreBtn.innerHTML = '<i class="fas fa-upload"></i> Restaurar';
        restoreBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = importProjectData;
            input.click();
        };
        quickActions.appendChild(restoreBtn);
    }
});

