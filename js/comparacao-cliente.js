/**
 * ============================================================================
 * COMPARAÇÃO DE REQUISITOS DE CLIENTE - DIAGRAMA DE MUDGE
 * ============================================================================
 * 
 * Este módulo implementa o Diagrama de Mudge para hierarquização de
 * requisitos de cliente através de comparações pareadas.
 * 
 * O Diagrama de Mudge permite determinar a importância relativa de cada
 * requisito comparando-os dois a dois. Cada comparação indica qual requisito
 * é mais importante e em que grau:
 * - Valor 1: Pouco mais importante
 * - Valor 3: Moderadamente mais importante  
 * - Valor 5: Muito mais importante
 * 
 * Funcionalidades:
 * - Matriz triangular de comparações
 * - Modal interativo para comparações
 * - Cálculo automático de importância e pesos
 * - Visualização de resultados
 */

// ========================================================================
// SEÇÃO 1: VARIÁVEIS GLOBAIS E INICIALIZAÇÃO
// ========================================================================

let requisitos = [];
let totalComparacoes = 0;
let comparacoesFeitas = 0;

/**
 * Inicializa a página quando o DOM está pronto
 */
document.addEventListener('DOMContentLoaded', function() {
    loadRequisitos();
    setupComparison();
    updateStatus();
});

function loadRequisitos() {
    requisitos = qfdDB.getRequisitosCliente();
    totalComparacoes = calculateTotalComparisons(requisitos.length);
    
    const comparacoes = qfdDB.getComparacoesCliente();
    comparacoesFeitas = comparacoes.length;
}

function calculateTotalComparisons(count) {
    return count > 1 ? (count * (count - 1)) / 2 : 0;
}

function setupComparison() {
    const insufficientDiv = document.getElementById('insufficient-requirements');
    const instructionsSection = document.getElementById('instructions-section');
    const comparisonSection = document.getElementById('comparison-section');
    const legendSection = document.getElementById('legend-section');
    const resultsSection = document.getElementById('results-section');
    
    if (requisitos.length < 2) {
        insufficientDiv.style.display = 'block';
        if (instructionsSection) instructionsSection.style.display = 'none';
        comparisonSection.style.display = 'none';
        if (legendSection) legendSection.style.display = 'none';
        resultsSection.style.display = 'none';
        return;
    }
    
    insufficientDiv.style.display = 'none';
    if (instructionsSection) instructionsSection.style.display = 'block';
    comparisonSection.style.display = 'block';
    if (legendSection) legendSection.style.display = 'block';
    
    generateComparisonMatrix();
    generateLegend();
    updateStatus();
    
    if (comparacoesFeitas === totalComparacoes) {
        showResults();
    } else if (resultsSection) {
        resultsSection.style.display = 'none';
    }
}

function generateComparisonMatrix() {
    const matrixContainer = document.getElementById('comparison-matrix');
    if (!matrixContainer) return;
    
    const somatorios = calculateSummaries();
    
    let matrixHTML = '<div class="matrix-table-wrapper">';
    matrixHTML += '<div class="matrix-table">';
    
    // Cabeçalho
    matrixHTML += '<div class="matrix-row matrix-header">';
    matrixHTML += '<div class="matrix-cell matrix-corner">Req.</div>';
    
    for (let i = 0; i < requisitos.length; i++) {
        const obsText = requisitos[i].observacao ? `\n${requisitos[i].observacao}` : '';
        const tooltipText = `Requisito ${i + 1}: ${requisitos[i].descricao}${obsText}`;
        matrixHTML += `<div class="matrix-cell matrix-header-cell" data-tooltip="${escapeAttr(tooltipText)}">
            <div class="header-content">
                <span class="req-number">${i + 1}</span>
                <div class="req-desc-mini">${truncateText(requisitos[i].descricao, 15)}</div>
                <span class="req-summary">${somatorios.colunas[i] || 0}</span>
            </div>
        </div>`;
    }
    
    matrixHTML += `<div class="matrix-cell matrix-total-header">
        <div class="total-content"><span class="total-label">Total</span></div>
    </div></div>`;
    
    // Linhas
    for (let i = 0; i < requisitos.length; i++) {
        matrixHTML += '<div class="matrix-row">';
        const rowObsText = requisitos[i].observacao ? `\n${requisitos[i].observacao}` : '';
        const tooltipText = `Requisito ${i + 1}: ${requisitos[i].descricao}${rowObsText}`;
        matrixHTML += `<div class="matrix-cell matrix-row-header" data-tooltip="${escapeAttr(tooltipText)}">
            <div class="row-header-content">
                <span class="req-number">${i + 1}</span>
                <span class="req-text">${truncateText(requisitos[i].descricao, 25)}</span>
            </div>
        </div>`;
        
        for (let j = 0; j < requisitos.length; j++) {
            const req1 = requisitos[i];
            const req2 = requisitos[j];
            const obs1 = req1.observacao ? `\n${truncateText(req1.observacao, 80)}` : '';
            const obs2 = req2.observacao ? `\n${truncateText(req2.observacao, 80)}` : '';
            const cellTooltip = `Comparação entre:\nReq ${i + 1}: ${truncateText(req1.descricao, 50)}${obs1}\nReq ${j + 1}: ${truncateText(req2.descricao, 50)}${obs2}`;

            if (i === j) {
                matrixHTML += `<div class="matrix-cell matrix-diagonal" data-tooltip="${escapeAttr(cellTooltip)}">-</div>`;
            } else if (i < j) {
                const req1Id = requisitos[i].id;
                const req2Id = requisitos[j].id;
                const storedComparison = qfdDB.getComparacoesCliente().find(
                    c => (c.requisito1 === req1Id && c.requisito2 === req2Id) ||
                         (c.requisito1 === req2Id && c.requisito2 === req1Id)
                );
                const isCompleted = !!storedComparison;
                
                matrixHTML += `<div class="matrix-cell matrix-comparison ${isCompleted ? 'completed' : ''}" 
                    data-req1="${req1Id}" data-req2="${req2Id}" data-i="${i}" data-j="${j}"
                    data-tooltip="${escapeAttr(cellTooltip + '\nClique para comparar')}">
                    ${isCompleted ? getComparisonDisplay(storedComparison, i, j) : '<span class="comparison-placeholder">?</span>'}
                </div>`;
            } else {
                matrixHTML += `<div class="matrix-cell matrix-mirror" data-tooltip="${escapeAttr(cellTooltip)}"></div>`;
            }
        }
        
        matrixHTML += `<div class="matrix-cell matrix-row-total"><div class="row-total-content"><span class="total-value">${somatorios.linhas[i] || 0}</span></div></div></div>`;
    }
    
    // Rodapé Totais de coluna (retorno geométrico da matriz superior)
    matrixHTML += '<div class="matrix-row matrix-column-totals"><div class="matrix-cell matrix-total-label">Retorno Coluna</div>';
    for (let j = 0; j < requisitos.length; j++) {
        matrixHTML += `<div class="matrix-cell matrix-column-total"><span class="total-value">${somatorios.colunas[j] || 0}</span></div>`;
    }
    matrixHTML += `<div class="matrix-cell matrix-grand-total"><span class="grand-total-value">${somatorios.total}</span></div></div>`;
    matrixHTML += '</div></div>';
    
    matrixContainer.innerHTML = matrixHTML;
    addMatrixEventListeners();
}

function calculateSummaries() {
    const linhas = new Array(requisitos.length).fill(0);
    const colunas = new Array(requisitos.length).fill(0);
    let total = 0;
    
    const comparacoes = qfdDB.getComparacoesCliente();
    comparacoes.forEach(c => {
        const winnerIndex = requisitos.findIndex(r => r.id === c.requisito1);
        const loserIndex = requisitos.findIndex(r => r.id === c.requisito2);
        if (winnerIndex !== -1 && loserIndex !== -1) {
            // Pontuação do requisito (linha) = soma dos valores em que venceu
            linhas[winnerIndex] += c.valor;

            // Retorno de coluna = soma dos valores pela posição geométrica da célula i<j
            // (independente de quem venceu)
            const upperCol = Math.max(winnerIndex, loserIndex);
            colunas[upperCol] += c.valor;

            total += c.valor;
        }
    });
    
    return { linhas, colunas, total };
}

function generateLegend() {
    const legendContainer = document.getElementById('matrix-legend-container');
    if (!legendContainer) return;

    const legendHTML = `
        <div class="matrix-legend">
            <div class="legend-items">
                ${requisitos.map((req, index) => `
                    <div class="legend-item">
                        <span class="legend-number">${index + 1}</span>
                        <span class="legend-text">${escapeHtml(req.descricao)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    legendContainer.innerHTML = legendHTML;
}

function getComparisonDisplay(storedComparison, i, j) {
    const req1Id = requisitos[i].id;
    let winnerIndex, value;
    if (storedComparison.requisito1 === req1Id) {
        winnerIndex = i;
        value = storedComparison.valor;
    } else {
        winnerIndex = j;
        value = storedComparison.valor;
    }
    return `
        <div class="comparison-result">
            <div class="comparison-winner">
                <span class="winner-indicator">${winnerIndex + 1}</span>
            </div>
            <div class="comparison-importance importance-${value}">
                <span class="value-indicator">${value}</span>
            </div>
        </div>
    `;
}

function addMatrixEventListeners() {
    document.querySelectorAll('#comparison-matrix .matrix-comparison').forEach(cell => {
        cell.addEventListener('click', () => openComparisonModal(cell));
    });
}

/**
 * Redesenha matriz, status e resultados após salvar/remover, sem recarregar
 * a página (mantém a rolagem). Se `next` for informado, abre essa célula.
 * @param {{ i: number, j: number } | null} [next]
 */
function refreshComparison(next) {
    hideAppTooltip();
    loadRequisitos();
    setupComparison();
    if (!next) return;
    const nextCell = document.querySelector(
        `.matrix-comparison[data-i="${next.i}"][data-j="${next.j}"]`
    );
    if (nextCell) openComparisonModal(nextCell);
}

/**
 * Retorna as coordenadas da próxima célula de comparação na ordem:
 * da esquerda para a direita, e ao fim da linha passa para a próxima.
 * Matriz triangular superior: (0,1), (0,2), ... (0,n-1), (1,2), ... (n-2, n-1).
 * @param {number} i - Índice da linha da célula atual
 * @param {number} j - Índice da coluna da célula atual
 * @returns {{ i: number, j: number } | null} Próxima célula ou null se for a última
 */
function getNextComparisonCell(i, j) {
    const n = requisitos.length;
    if (n < 2) return null;
    if (j < n - 1) return { i, j: j + 1 };
    if (i < n - 2) return { i: i + 1, j: i + 2 };
    return null;
}

function openComparisonModal(cell) {
    const req1Id = cell.dataset.req1;
    const req2Id = cell.dataset.req2;
    const i = parseInt(cell.dataset.i);
    const j = parseInt(cell.dataset.j);
    
    const req1 = requisitos[i];
    const req2 = requisitos[j];
    
    const storedComparison = qfdDB.getComparacoesCliente().find(
        c => (c.requisito1 === req1Id && c.requisito2 === req2Id) ||
             (c.requisito1 === req2Id && c.requisito2 === req1Id)
    );
    
    // Remove qualquer modal existente antes de criar um novo
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex'; // Garante que o modal seja exibido como flex
    modal.innerHTML = `
        <div class="modal-content comparison-modal">
            <div class="modal-header">
                <h3>Comparar Requisitos</h3>
                <button class="modal-close" onclick="closeModal()" title="Fechar">&times;</button>
            </div>
            <div class="modal-body">
                <div class="comparison-question">
                    <h4>Qual requisito é mais importante?</h4>
                </div>
                <div class="requirements-comparison">
                    <div class="requirement-option ${storedComparison && storedComparison.requisito1 === req1Id ? 'selected' : ''}" data-req="${req1Id}" data-index="${i}">
                        <div class="req-header">
                            <span class="req-number">${i + 1}</span>
                            <span class="req-label">Requisito A</span>
                        </div>
                        <div class="req-description">${escapeHtml(req1.descricao)}</div>
                        ${req1.observacao ? `<div class="req-obs-modal"><i class="fas fa-comment-dots"></i> ${escapeHtml(req1.observacao)}</div>` : ''}
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="requirement-option ${storedComparison && storedComparison.requisito1 === req2Id ? 'selected' : ''}" data-req="${req2Id}" data-index="${j}">
                        <div class="req-header">
                            <span class="req-number">${j + 1}</span>
                            <span class="req-label">Requisito B</span>
                        </div>
                        <div class="req-description">${escapeHtml(req2.descricao)}</div>
                        ${req2.observacao ? `<div class="req-obs-modal"><i class="fas fa-comment-dots"></i> ${escapeHtml(req2.observacao)}</div>` : ''}
                    </div>
                </div>
                <div class="importance-levels" id="importance-levels" style="${storedComparison ? 'display:block' : 'display:none'}">
                    <h4>Quanto mais importante?</h4>
                    <div class="level-options">
                        ${[1, 3, 5].map(v => `
                            <button class="level-btn ${storedComparison && storedComparison.valor === v ? 'selected' : ''}" data-value="${v}">
                                <span class="level-number">${v}</span>
                                <small>${v === 1 ? 'Pouco' : v === 3 ? 'Moderado' : 'Muito'}</small>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <small class="modal-footer-hint" style="margin-right: auto; align-self: center; color: #6c757d;"><kbd>Enter</kbd> salva e abre a próxima · <kbd>Shift</kbd>+<kbd>Enter</kbd> volta</small>
                <button class="btn btn-secondary" id="prev-comparison" onclick="goToPrevComparison()" ${getPrevTriangularCell(i, j, requisitos.length) ? '' : 'disabled'} title="Voltar para a comparação anterior (Shift+Enter), sem salvar esta">
                    <i class="fas fa-arrow-left"></i> Anterior
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-primary" id="save-comparison" ${storedComparison ? '' : 'disabled'} onclick="saveComparison(false)">Salvar</button>
                ${storedComparison ? `<button class="btn btn-danger" onclick="removeComparison('${req1Id}', '${req2Id}')">Remover</button>` : ''}
            </div>
        </div>
    `;
    
    // Fecha o modal ao clicar no overlay (fora do conteúdo)
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Fecha o modal ao pressionar ESC
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Previne scroll do body quando o modal estiver aberto
    document.body.style.overflow = 'hidden';
    
    document.body.appendChild(modal);
    
    const modalBox = modal.querySelector('.comparison-modal');
    if (modalBox) {
        modalBox.setAttribute('tabindex', '0');
        modalBox.focus();
    }
    
    setupModalLogic(req1Id, req2Id, i, j);
}

function setupModalLogic(req1Id, req2Id, cellI, cellJ) {
    let selectedReq = document.querySelector('.requirement-option.selected')?.dataset.req || null;
    let selectedValue = document.querySelector('.level-btn.selected')?.dataset.value || null;

    document.querySelectorAll('.requirement-option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('.requirement-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedReq = opt.dataset.req;
            document.getElementById('importance-levels').style.display = 'block';
        };
    });

    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedValue = btn.dataset.value;
            document.getElementById('save-comparison').disabled = false;
        };
    });

    /**
     * Salva a comparação e, se desejado, abre a próxima célula.
     * @param {boolean} openNextCell - Se true, abre a próxima célula na ordem (usado pelo Enter)
     */
    window.saveComparison = (openNextCell) => {
        if (selectedReq && selectedValue) {
            const otherReq = selectedReq === req1Id ? req2Id : req1Id;
            qfdDB.setComparacaoCliente(selectedReq, otherReq, parseInt(selectedValue));
            const next = openNextCell ? getNextComparisonCell(cellI, cellJ) : null;
            closeModal();
            refreshComparison(next);
        }
    };
    
    /** Volta para a comparação anterior na ordem do Enter, sem salvar a atual */
    window.goToPrevComparison = () => {
        const prev = getPrevTriangularCell(cellI, cellJ, requisitos.length);
        if (!prev) return;
        const prevCell = document.querySelector(`.matrix-comparison[data-i="${prev.i}"][data-j="${prev.j}"]`);
        if (prevCell) openComparisonModal(prevCell);
    };

    // Enter no modal: salva e abre a próxima célula; Shift+Enter volta
    const modalContent = document.querySelector('.comparison-modal');
    if (modalContent) {
        modalContent.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                goToPrevComparison();
                return;
            }
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                const saveBtn = document.getElementById('save-comparison');
                if (saveBtn && !saveBtn.disabled) {
                    saveComparison(true);
                }
            }
        });
    }

    window.removeComparison = (r1, r2) => {
        // valor 0 remove o par e recalcula a importância dos requisitos
        qfdDB.setComparacaoCliente(r1, r2, 0);
        closeModal();
        refreshComparison(null);
    };
}

window.closeModal = () => {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        // Restaura scroll do body
        document.body.style.overflow = '';
        
        // Animação de fechamento
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
};

function updateStatus() {
    const totalPossible = calculateTotalComparisons(requisitos.length);
    const feitas = qfdDB.getComparacoesCliente().length;

    const totalReqEl = document.getElementById('total-requisitos');
    if (totalReqEl) totalReqEl.textContent = `${requisitos.length} Requisitos`;

    const statusEl = document.getElementById('comparacoes-feitas');
    if (statusEl) statusEl.textContent = `${feitas} / ${totalPossible}`;

    const progresso = totalPossible > 0 ? Math.round((feitas / totalPossible) * 100) : 0;
    const progressoEl = document.getElementById('progresso-percentual');
    if (progressoEl) progressoEl.textContent = `${progresso}%`;

    const fillEl = document.getElementById('progress-fill');
    if (fillEl) fillEl.style.width = `${progresso}%`;
}

function getTercioClass(rankIndex, total) {
    const t1 = Math.ceil(total / 3);
    const t2 = Math.ceil((2 * total) / 3);
    if (rankIndex < t1) return 'tercio-superior';
    if (rankIndex < t2) return 'tercio-medio';
    return 'tercio-inferior';
}

function showResults() {
    const resultsSection = document.getElementById('results-section');
    const rankingList = document.getElementById('ranking-list');
    if (!resultsSection || !rankingList) return;

    const atualizados = qfdDB.getRequisitosCliente();
    const totalImportancia = atualizados.reduce((sum, r) => sum + (r.importancia || 0), 0);
    const ordenados = [...atualizados].sort((a, b) => (b.importancia || 0) - (a.importancia || 0));

    rankingList.innerHTML = ordenados.map((req, index) => {
        const peso = totalImportancia > 0 ? ((req.importancia || 0) / totalImportancia) * 100 : 0;
        const tercio = getTercioClass(index, ordenados.length);
        const numOriginal = requisitos.findIndex(r => r.id === req.id) + 1;
        return `
            <div class="ranking-item ${tercio}">
                <span class="legend-number">${index + 1}</span>
                <span class="legend-text"><strong>Req ${numOriginal}:</strong> ${escapeHtml(req.descricao)}</span>
                <span class="legend-score">Pts: ${req.importancia || 0} | ${peso.toFixed(2)}%</span>
            </div>
        `;
    }).join('');

    generateImportanceDistribution(ordenados, totalImportancia);
    resultsSection.style.display = 'block';
}

function generateImportanceDistribution(ordenados, totalImportancia) {
    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer || ordenados.length === 0) return;

    const maxPts = Math.max(...ordenados.map(r => r.importancia || 0), 1);

    chartContainer.innerHTML = `
        <div class="importance-bars" role="img" aria-label="Distribuição de importância dos requisitos">
            ${ordenados.map((req, index) => {
                const pts = req.importancia || 0;
                const pct = totalImportancia > 0 ? (pts / totalImportancia) * 100 : 0;
                const barHeight = Math.max(4, (pts / maxPts) * 100);
                const numOriginal = requisitos.findIndex(r => r.id === req.id) + 1;
                const tercio = getTercioClass(index, ordenados.length);
                return `
                    <div class="importance-bar-item" title="${escapeHtml(req.descricao)} — ${pct.toFixed(1)}%">
                        <div class="bar-track">
                            <div class="bar-fill ${tercio}" style="height: ${barHeight}%"></div>
                        </div>
                        <span class="bar-label">R${numOriginal}</span>
                        <span class="bar-value">${pct.toFixed(1)}%</span>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="tercios-legend comparacao-tercios-legend">
            <span class="tercio-item tercio-superior">Terço superior (maior importância)</span>
            <span class="tercio-item tercio-medio">Terço médio</span>
            <span class="tercio-item tercio-inferior">Terço inferior</span>
        </div>
    `;
}
