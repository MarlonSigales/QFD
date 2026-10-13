/**
 * ============================================================================
 * CORRELAÇÃO DE REQUISITOS DE PROJETO - TELHADO QFD
 * ============================================================================
 * 
 * Este módulo gerencia o "telhado" da Casa da Qualidade, que representa as
 * correlações entre requisitos técnicos de projeto.
 * 
 * Tipos de correlação:
 * - '++': Positiva muito forte (sinergia forte)
 * - '+': Positiva (sinergia moderada)
 * - '0': Neutra (independentes)
 * - '-': Negativa (competem entre si)
 * - '--': Negativa muito forte (conflitantes)
 * 
 * Funcionalidades:
 * - Matriz triangular de correlações
 * - Popup interativo para definição
 * - Análise de conflitos e sinergias
 * - Exportação de análises
 */

// ========================================================================
// SEÇÃO 1: VARIÁVEIS GLOBAIS E INICIALIZAÇÃO
// ========================================================================

let requisitos = [];
let totalCorrelacoes = 0;
let correlacoesFeitas = 0;

/**
 * Inicializa a página quando o DOM está pronto
 */
document.addEventListener('DOMContentLoaded', function() {
    loadRequisitos();
    setupCorrelation();
    updateStatus();
});

function loadRequisitos() {
    requisitos = qfdDB.getRequisitosProjeto();
    totalCorrelacoes = calculateTotalCorrelations(requisitos.length);
    
    const correlacoes = qfdDB.getCorrelacoesProjeto();
    correlacoesFeitas = correlacoes.length;
}

function calculateTotalCorrelations(count) {
    return count > 1 ? (count * (count - 1)) / 2 : 0;
}

function setupCorrelation() {
    const insufficientDiv = document.getElementById('insufficient-requirements');
    const correlationSection = document.getElementById('correlation-section');
    const legendSection = document.getElementById('correlation-legend');
    const analysisSection = document.getElementById('analysis-section');
    
    if (requisitos.length < 2) {
        insufficientDiv.style.display = 'block';
        correlationSection.style.display = 'none';
        legendSection.style.display = 'none';
        analysisSection.style.display = 'none';
        return;
    }
    
    insufficientDiv.style.display = 'none';
    correlationSection.style.display = 'block';
    legendSection.style.display = 'block';
    
    generateRoofMatrix();
    
    if (correlacoesFeitas > 0) {
        showAnalysis();
    }
}

function generateRoofMatrix() {
    const roofContainer = document.getElementById('roof-matrix');
    if (!roofContainer) return;
    
    let roofHTML = '<div class="roof-table">';
    
    // Cabeçalho com números dos requisitos e sentido de melhoria
    roofHTML += '<div class="roof-header">';
    for (let i = 0; i < requisitos.length; i++) {
        const req = requisitos[i];
        const obsHdr = req.observacao ? `\n${req.observacao}` : '';
        roofHTML += `<div class="roof-header-cell"
            data-tooltip="${escapeAttr(`Requisito ${i + 1}: ${req.descricao}${obsHdr}\nSentido: ${getSentidoLabel(req.sentidoMelhoria)} ${getSentidoSymbol(req.sentidoMelhoria)}\nDificuldade: ${req.dificuldadeTecnica}`)}">
            <span class="req-number">${i + 1}</span>
            <span class="req-direction">${getSentidoSymbol(req.sentidoMelhoria)}</span>
        </div>`;
    }
    roofHTML += '</div>';
    
    // Matriz triangular superior
    for (let i = 0; i < requisitos.length - 1; i++) {
        roofHTML += '<div class="roof-row">';
        
        // Espaços vazios à esquerda
        for (let k = 0; k <= i; k++) {
            roofHTML += '<div class="roof-empty"></div>';
        }
        
        // Células de correlação
        for (let j = i + 1; j < requisitos.length; j++) {
            const correlation = qfdDB.getCorrelacaoProjeto(requisitos[i].id, requisitos[j].id);
            const isCompleted = correlation !== '0';
            
            const req1 = requisitos[i];
            const req2 = requisitos[j];
            
            const cellObs1 = req1.observacao ? `\n${truncateText(req1.observacao, 80)}` : '';
            const cellObs2 = req2.observacao ? `\n${truncateText(req2.observacao, 80)}` : '';
            const tooltipText = `Correlação entre:\nReq ${i + 1}: ${truncateText(req1.descricao, 50)} ${getSentidoSymbol(req1.sentidoMelhoria)}${cellObs1}\n`
                + `Req ${j + 1}: ${truncateText(req2.descricao, 50)} ${getSentidoSymbol(req2.sentidoMelhoria)}${cellObs2}\n\n`
                + textoRoteiroTelhado(req1.sentidoMelhoria, req2.sentidoMelhoria, `RP${i + 1}`, `RP${j + 1}`)
                + '\n\nClique para definir correlação';
            
            roofHTML += `<div class="roof-cell ${isCompleted ? 'completed' : ''}" 
                data-req1="${requisitos[i].id}" 
                data-req2="${requisitos[j].id}"
                data-i="${i}" 
                data-j="${j}"
                data-tooltip="${escapeAttr(tooltipText)}">
                ${getCorrelationDisplay(correlation)}
            </div>`;
        }
        
        roofHTML += '</div>';
    }
    
    roofHTML += '</div>';
    
    // Legenda dos requisitos com sentido de melhoria
    roofHTML += '<div class="roof-legend">';
    roofHTML += '<h4>Requisitos de Projeto:</h4>';
    roofHTML += '<div class="legend-items">';
    
    for (let i = 0; i < requisitos.length; i++) {
        const req = requisitos[i];
        roofHTML += `<div class="legend-item">
            <span class="legend-number">${i + 1}</span>
            <div class="legend-content">
                <span class="legend-text">${escapeHtml(req.descricao)}</span>
                <div class="legend-meta">
                    <span class="sentido-badge ${req.sentidoMelhoria}">
                        ${getSentidoSymbol(req.sentidoMelhoria)} ${getSentidoLabel(req.sentidoMelhoria)}
                    </span>
                    <span class="dificuldade-badge level-${req.dificuldadeTecnica}">
                        Dif: ${req.dificuldadeTecnica}
                    </span>
                </div>
            </div>
        </div>`;
    }
    
    roofHTML += '</div></div>';
    
    roofContainer.innerHTML = roofHTML;

    // Adiciona event listeners para as células
    const roofCells = roofContainer.querySelectorAll('.roof-cell');
    roofCells.forEach(cell => {
        cell.addEventListener('click', () => openCorrelationPopup(cell));
    });
}

function getCorrelationDisplay(correlation) {
    const symbols = {
        '++': '<span class="corr-symbol strong-positive">++</span>',
        '+': '<span class="corr-symbol positive">+</span>',
        '0': '<span class="corr-symbol neutral">0</span>',
        '-': '<span class="corr-symbol negative">-</span>',
        '--': '<span class="corr-symbol strong-negative">--</span>'
    };
    
    return symbols[correlation] || '<span class="corr-placeholder">?</span>';
}

function openCorrelationPopup(cell) {
    const req1Id = cell.dataset.req1;
    const req2Id = cell.dataset.req2;
    const i = parseInt(cell.dataset.i);
    const j = parseInt(cell.dataset.j);
    
    const req1 = requisitos[i];
    const req2 = requisitos[j];
    
    const currentCorrelation = qfdDB.getCorrelacaoProjeto(req1Id, req2Id);
    
    // Cria popup modal compacto
    const popup = document.createElement('div');
    popup.className = 'correlation-popup-overlay';
    popup.innerHTML = `
        <div class="correlation-popup">
            <div class="popup-header">
                <h4>Correlação: Req ${i + 1} ↔ Req ${j + 1}</h4>
                <button class="popup-close" onclick="closeCorrelationPopup()">&times;</button>
            </div>
            <div class="popup-body">
                <div class="requirements-compact">
                    <div class="req-compact">
                        <div class="req-info">
                            <span class="req-num">${i + 1}</span>
                            <span class="req-desc">${escapeHtml(req1.descricao.substring(0, 60))}${req1.descricao.length > 60 ? '...' : ''}</span>
                            <span class="req-direction-badge ${req1.sentidoMelhoria}">
                                ${getSentidoSymbol(req1.sentidoMelhoria)}
                            </span>
                        </div>
                        ${req1.observacao ? `<div class="req-obs-modal"><i class="fas fa-comment-dots"></i> ${escapeHtml(req1.observacao)}</div>` : ''}
                    </div>
                    <div class="correlation-vs">↔</div>
                    <div class="req-compact">
                        <div class="req-info">
                            <span class="req-num">${j + 1}</span>
                            <span class="req-desc">${escapeHtml(req2.descricao.substring(0, 60))}${req2.descricao.length > 60 ? '...' : ''}</span>
                            <span class="req-direction-badge ${req2.sentidoMelhoria}">
                                ${getSentidoSymbol(req2.sentidoMelhoria)}
                            </span>
                        </div>
                        ${req2.observacao ? `<div class="req-obs-modal"><i class="fas fa-comment-dots"></i> ${escapeHtml(req2.observacao)}</div>` : ''}
                    </div>
                </div>
                
                <div class="correlation-quick-select">
                    <button class="corr-quick-btn ${currentCorrelation === '++' ? 'selected' : ''}" data-value="++">
                        <span class="corr-symbol strong-positive">++</span>
                    </button>
                    <button class="corr-quick-btn ${currentCorrelation === '+' ? 'selected' : ''}" data-value="+">
                        <span class="corr-symbol positive">+</span>
                    </button>
                    <button class="corr-quick-btn ${currentCorrelation === '0' ? 'selected' : ''}" data-value="0">
                        <span class="corr-symbol neutral">0</span>
                    </button>
                    <button class="corr-quick-btn ${currentCorrelation === '-' ? 'selected' : ''}" data-value="-">
                        <span class="corr-symbol negative">-</span>
                    </button>
                    <button class="corr-quick-btn ${currentCorrelation === '--' ? 'selected' : ''}" data-value="--">
                        <span class="corr-symbol strong-negative">--</span>
                    </button>
                </div>
                
                ${htmlRoteiroTelhado(req1.sentidoMelhoria, req2.sentidoMelhoria, rotuloRequisito(`RP${i + 1}`, req1), rotuloRequisito(`RP${j + 1}`, req2))}
                <div class="correlation-description" id="correlation-description">
                    ${getCorrelationDescription(currentCorrelation)}
                </div>
            </div>
            <div class="popup-footer">
                <button class="btn btn-sm btn-secondary" id="prev-correlation-popup" onclick="goToPrevCorrelation()" ${getPrevTriangularCell(i, j, requisitos.length) ? '' : 'disabled'} title="Voltar para a correlação anterior (Shift+Enter), sem salvar esta">
                    <i class="fas fa-arrow-left"></i> Anterior
                </button>
                <button class="btn btn-sm btn-secondary" onclick="closeCorrelationPopup()">Cancelar</button>
                <button class="btn btn-sm btn-primary" id="save-correlation-popup" onclick="saveCorrelationFromPopup(false)">
                    Salvar <small>(Enter = salvar e próximo)</small>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    
    // Configura event listeners
    setupPopupEventListeners(req1Id, req2Id, currentCorrelation, i, j);
}

// OBS: popup centralizado via CSS (overlay com flex).

function setupPopupEventListeners(req1Id, req2Id, currentCorrelation, i, j) {
    window.currentPopupCorrelationData = {
        req1Id, req2Id, selectedCorrelation: currentCorrelation, i, j
    };

    const selectCorrelation = (value) => {
        window.currentPopupCorrelationData.selectedCorrelation = value;
        document.querySelectorAll('.corr-quick-btn').forEach(b => {
            b.classList.toggle('selected', b.dataset.value === value);
        });
        const descriptionDiv = document.getElementById('correlation-description');
        if (descriptionDiv) {
            descriptionDiv.innerHTML = getCorrelationDescription(value);
        }
    };

    document.querySelectorAll('.corr-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => selectCorrelation(btn.dataset.value));
    });

    if (window._correlationPopupKeyHandler) {
        document.removeEventListener('keydown', window._correlationPopupKeyHandler);
    }

    window._correlationPopupKeyHandler = function(e) {
        if (!document.querySelector('.correlation-popup-overlay')) return;

        if (e.key === 'Escape') {
            closeCorrelationPopup();
            return;
        }

        let value = null;
        if (e.key === '*' || (e.shiftKey && e.key === '8')) value = '++';
        else if (e.key === '+' || (e.shiftKey && e.key === '=')) value = '+';
        else if (e.key === '0') value = '0';
        else if (e.key === '-') value = '-';
        else if (e.key === '/' || e.key === '?') value = '--';

        if (value) {
            e.preventDefault();
            selectCorrelation(value);
            return;
        }

        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            goToPrevCorrelation();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            saveCorrelationFromPopup(true);
        }
    };

    document.addEventListener('keydown', window._correlationPopupKeyHandler);
}

function getCorrelationDescription(correlation) {
    const descriptions = {
        '++': '<i class="fas fa-arrow-up text-success"></i> <strong>Positiva Muito Forte:</strong> Os requisitos se reforçam significativamente',
        '+': '<i class="fas fa-plus text-success"></i> <strong>Positiva:</strong> Os requisitos se complementam',
        '0': '<i class="fas fa-circle text-muted"></i> <strong>Neutra:</strong> Os requisitos são independentes',
        '-': '<i class="fas fa-minus text-warning"></i> <strong>Negativa:</strong> Os requisitos competem entre si',
        '--': '<i class="fas fa-arrow-down text-danger"></i> <strong>Negativa Muito Forte:</strong> Os requisitos são conflitantes'
    };
    
    return descriptions[correlation] || '<i class="fas fa-question text-muted"></i> <strong>Indefinida:</strong> Selecione uma correlação';
}

function getNextCorrelationCell(i, j) {
    const n = requisitos.length;
    for (let x = i; x < n - 1; x++) {
        const startY = x === i ? j + 1 : x + 1;
        for (let y = startY; y < n; y++) {
            return { i: x, j: y };
        }
    }
    return null;
}

function updateRoofCell(req1Id, req2Id, correlation) {
    const cell = document.querySelector(
        `.roof-cell[data-req1="${req1Id}"][data-req2="${req2Id}"]`
    );
    if (!cell) return;
    cell.innerHTML = getCorrelationDisplay(correlation);
    cell.classList.toggle('completed', correlation !== '0');
}

/** Volta para a correlação anterior na ordem do Enter, sem salvar a atual */
function goToPrevCorrelation() {
    const data = window.currentPopupCorrelationData;
    if (!data) return;
    const prev = getPrevTriangularCell(data.i, data.j, requisitos.length);
    if (!prev) return;
    closeCorrelationPopup();
    openCorrelationPopupByIndices(prev.i, prev.j);
}

function openCorrelationPopupByIndices(i, j) {
    const cell = document.querySelector(`.roof-cell[data-i="${i}"][data-j="${j}"]`);
    if (cell) openCorrelationPopup(cell);
}

function saveCorrelationFromPopup(openNext = false) {
    const data = window.currentPopupCorrelationData;
    if (!data) return;

    const correlation = data.selectedCorrelation;
    const savedI = data.i;
    const savedJ = data.j;

    try {
        qfdDB.setCorrelacaoProjeto(data.req1Id, data.req2Id, correlation);
        closeCorrelationPopup();
        loadRequisitos();
        updateRoofCell(data.req1Id, data.req2Id, correlation);
        updateStatus();
        showAnalysis();

        if (openNext && savedI != null && savedJ != null) {
            const next = getNextCorrelationCell(savedI, savedJ);
            if (next) {
                setTimeout(() => openCorrelationPopupByIndices(next.i, next.j), 80);
            }
        }
    } catch (error) {
        console.error('Erro ao salvar correlação:', error);
        showAlert('Erro ao salvar correlação.', 'danger');
    }
}

function closeCorrelationPopup() {
    const popup = document.querySelector('.correlation-popup-overlay');
    if (popup) popup.remove();
    if (window._correlationPopupKeyHandler) {
        document.removeEventListener('keydown', window._correlationPopupKeyHandler);
        delete window._correlationPopupKeyHandler;
    }
    delete window.currentPopupCorrelationData;
}

function updateStatus() {
    const totalReqElement = document.getElementById('total-requisitos');
    const correlacoesElement = document.getElementById('correlacoes-feitas');
    const progressoElement = document.getElementById('progresso-percentual');
    const progressFill = document.getElementById('progress-fill');
    
    if (totalReqElement) {
        totalReqElement.textContent = `${requisitos.length} Requisitos`;
    }
    
    if (correlacoesElement) {
        correlacoesElement.textContent = `${correlacoesFeitas} / ${totalCorrelacoes}`;
    }
    
    const progresso = totalCorrelacoes > 0 ? Math.round((correlacoesFeitas / totalCorrelacoes) * 100) : 0;
    
    if (progressoElement) {
        progressoElement.textContent = `${progresso}%`;
    }
    
    if (progressFill) {
        progressFill.style.width = `${progresso}%`;
    }
}

function showAnalysis() {
    const analysisSection = document.getElementById('analysis-section');
    if (!analysisSection) return;
    
    analysisSection.style.display = 'block';
    
    generateCorrelationSummary();
    generateConflictAnalysis();
    generateSynergyAnalysis();
    generateNeutralRequirementsAnalysis();
}

function generateCorrelationSummary() {
    const summaryContainer = document.getElementById('correlation-summary');
    if (!summaryContainer) return;
    
    const correlacoes = qfdDB.getCorrelacoesProjeto();
    
    // Conta tipos de correlação
    const counts = {
        '++': 0, '+': 0, '0': 0, '-': 0, '--': 0
    };
    
    correlacoes.forEach(corr => {
        counts[corr.correlacao]++;
    });
    
    // Adiciona correlações neutras não definidas
    counts['0'] += totalCorrelacoes - correlacoesFeitas;
    
    const summaryHTML = `
        <h4>Resumo das Correlações</h4>
        <div class="summary-grid">
            <div class="summary-item strong-positive analysis-item visible" data-correlation-type="strong-positive">
                <div class="summary-icon">++</div>
                <div class="summary-content">
                    <span class="summary-count">${counts['++']}</span>
                    <span class="summary-label">Positivas Muito Fortes</span>
                </div>
            </div>
            <div class="summary-item positive analysis-item visible" data-correlation-type="positive">
                <div class="summary-icon">+</div>
                <div class="summary-content">
                    <span class="summary-count">${counts['+']}</span>
                    <span class="summary-label">Positivas</span>
                </div>
            </div>
            <div class="summary-item neutral analysis-item visible" data-correlation-type="neutral">
                <div class="summary-icon">0</div>
                <div class="summary-content">
                    <span class="summary-count">${counts['0']}</span>
                    <span class="summary-label">Neutras</span>
                </div>
            </div>
            <div class="summary-item negative analysis-item visible" data-correlation-type="negative">
                <div class="summary-icon">-</div>
                <div class="summary-content">
                    <span class="summary-count">${counts['-']}</span>
                    <span class="summary-label">Negativas</span>
                </div>
            </div>
            <div class="summary-item strong-negative analysis-item visible" data-correlation-type="strong-negative">
                <div class="summary-icon">--</div>
                <div class="summary-content">
                    <span class="summary-count">${counts['--']}</span>
                    <span class="summary-label">Negativas Muito Fortes</span>
                </div>
            </div>
        </div>
    `;
    
    summaryContainer.innerHTML = summaryHTML;
}

function generateNeutralRequirementsAnalysis() {
    const container = document.getElementById('neutral-requirements-analysis');
    if (!container) return;

    const correlacoes = qfdDB.getCorrelacoesProjeto();
    const semCorrelacao = requisitos.filter(req =>
        !correlacoes.some(c => c.requisito1 === req.id || c.requisito2 === req.id)
    );

    let html = '<h4><i class="fas fa-circle"></i> Requisitos sem correlação com outros</h4>';
    html += '<p class="neutral-analysis-hint">Requisitos que ainda não possuem nenhuma correlação não-neutra registrada.</p>';

    if (semCorrelacao.length === 0) {
        html += '<div class="no-neutral-reqs"><i class="fas fa-check-circle"></i> Todos os requisitos já possuem ao menos uma correlação definida.</div>';
    } else {
        html += '<ul class="neutral-req-list">';
        semCorrelacao.forEach(req => {
            const idx = requisitos.indexOf(req) + 1;
            html += `<li class="neutral-req-item analysis-item visible" data-correlation-type="neutral">
                <span class="legend-number">${idx}</span>
                <span>${escapeHtml(req.descricao)}</span>
            </li>`;
        });
        html += '</ul>';
    }

    container.innerHTML = html;
}

function generateConflictAnalysis() {
    const conflictContainer = document.getElementById('conflict-analysis');
    if (!conflictContainer) return;
    
    const correlacoes = qfdDB.getCorrelacoesProjeto();
    const conflicts = correlacoes.filter(corr => corr.correlacao === '-' || corr.correlacao === '--');
    
    let conflictHTML = '<h4><i class="fas fa-exclamation-triangle"></i> Análise de Conflitos</h4>';
    
    if (conflicts.length === 0) {
        conflictHTML += `
            <div class="no-conflicts">
                <i class="fas fa-check-circle"></i>
                <p>Nenhum conflito identificado entre os requisitos!</p>
                <small>Isso indica que os requisitos são bem alinhados ou independentes.</small>
            </div>
        `;
    } else {
        conflictHTML += '<div class="conflict-list">';
        
        conflicts.forEach(conflict => {
            const req1 = requisitos.find(r => r.id === conflict.requisito1);
            const req2 = requisitos.find(r => r.id === conflict.requisito2);
            
            if (req1 && req2) {
                const req1Index = requisitos.indexOf(req1) + 1;
                const req2Index = requisitos.indexOf(req2) + 1;
                
                const itemType = conflict.correlacao === '--' ? 'strong-negative' : 'negative';
                conflictHTML += `
                    <div class="conflict-item analysis-item visible" data-correlation-type="${itemType}">
                        <div class="conflict-header">
                            <span class="corr-symbol ${conflict.correlacao === '--' ? 'strong-negative' : 'negative'}">
                                ${conflict.correlacao}
                            </span>
                            <span class="conflict-title">
                                Requisito ${req1Index} vs Requisito ${req2Index}
                            </span>
                        </div>
                        <div class="conflict-details">
                            <div class="req-detail">
                                <strong>${req1Index}:</strong> ${escapeHtml(req1.descricao)}
                            </div>
                            <div class="req-detail">
                                <strong>${req2Index}:</strong> ${escapeHtml(req2.descricao)}
                            </div>
                        </div>
                        <div class="conflict-impact">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>
                                ${conflict.correlacao === '--' ? 
                                    'Conflito forte: melhorar um prejudica significativamente o outro.' :
                                    'Conflito moderado: estes requisitos competem por recursos ou prioridades.'
                                }
                            </span>
                        </div>
                    </div>
                `;
            }
        });
        
        conflictHTML += '</div>';
    }
    
    conflictContainer.innerHTML = conflictHTML;
}

function generateSynergyAnalysis() {
    const synergyContainer = document.getElementById('synergy-analysis');
    if (!synergyContainer) return;
    
    const correlacoes = qfdDB.getCorrelacoesProjeto();
    const synergies = correlacoes.filter(corr => corr.correlacao === '+' || corr.correlacao === '++');
    
    let synergyHTML = '<h4><i class="fas fa-handshake"></i> Análise de Sinergias</h4>';
    
    if (synergies.length === 0) {
        synergyHTML += `
            <div class="no-synergies">
                <i class="fas fa-info-circle"></i>
                <p>Nenhuma sinergia identificada entre os requisitos.</p>
                <small>Considere revisar se alguns requisitos podem se beneficiar mutuamente.</small>
            </div>
        `;
    } else {
        synergyHTML += '<div class="synergy-list">';
        
        synergies.forEach(synergy => {
            const req1 = requisitos.find(r => r.id === synergy.requisito1);
            const req2 = requisitos.find(r => r.id === synergy.requisito2);
            
            if (req1 && req2) {
                const req1Index = requisitos.indexOf(req1) + 1;
                const req2Index = requisitos.indexOf(req2) + 1;
                
                const itemType = synergy.correlacao === '++' ? 'strong-positive' : 'positive';
                synergyHTML += `
                    <div class="synergy-item analysis-item visible" data-correlation-type="${itemType}">
                        <div class="synergy-header">
                            <span class="corr-symbol ${synergy.correlacao === '++' ? 'strong-positive' : 'positive'}">
                                ${synergy.correlacao}
                            </span>
                            <span class="synergy-title">
                                Requisito ${req1Index} + Requisito ${req2Index}
                            </span>
                        </div>
                        <div class="synergy-details">
                            <div class="req-detail">
                                <strong>${req1Index}:</strong> ${escapeHtml(req1.descricao)}
                            </div>
                            <div class="req-detail">
                                <strong>${req2Index}:</strong> ${escapeHtml(req2.descricao)}
                            </div>
                        </div>
                        <div class="synergy-benefit">
                            <i class="fas fa-arrow-up"></i>
                            <span>
                                ${synergy.correlacao === '++' ? 
                                    'Sinergia forte: melhorar um beneficia significativamente o outro.' :
                                    'Sinergia moderada: estes requisitos se complementam.'
                                }
                            </span>
                        </div>
                    </div>
                `;
            }
        });
        
        synergyHTML += '</div>';
    }
    
    synergyContainer.innerHTML = synergyHTML;
}

function resetCorrelations() {
    if (confirm('Tem certeza que deseja resetar todas as correlações? Esta ação não pode ser desfeita.')) {
        try {
            const correlacoes = qfdDB.getCorrelacoesProjeto();
            correlacoes.forEach(corr => {
                qfdDB.setCorrelacaoProjeto(corr.requisito1, corr.requisito2, '0');
            });
            
            loadRequisitos();
            generateRoofMatrix();
            updateStatus();
            
            const analysisSection = document.getElementById('analysis-section');
            if (analysisSection) {
                analysisSection.style.display = 'none';
            }
            
            showAlert('Todas as correlações foram resetadas!', 'success');
        } catch (error) {
            console.error('Erro ao resetar correlações:', error);
            showAlert('Erro ao resetar correlações.', 'danger');
        }
    }
}

function exportAnalysis() {
    const correlacoes = qfdDB.getCorrelacoesProjeto();
    
    if (correlacoes.length === 0) {
        showAlert('Não há correlações para exportar.', 'info');
        return;
    }
    
    const csvContent = generateAnalysisCSV(correlacoes);
    downloadFile(csvContent, `correlacao-requisitos-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    
    showAlert('Análise exportada com sucesso!', 'success');
}

function generateAnalysisCSV(correlacoes) {
    const headers = ['Requisito 1', 'Requisito 2', 'Correlação', 'Tipo', 'Descrição 1', 'Descrição 2', 'Sentido 1', 'Sentido 2'];
    const rows = correlacoes.map(corr => {
        const req1 = requisitos.find(r => r.id === corr.requisito1);
        const req2 = requisitos.find(r => r.id === corr.requisito2);
        
        const correlationTypes = {
            '++': 'Positiva Muito Forte',
            '+': 'Positiva',
            '0': 'Neutra',
            '-': 'Negativa',
            '--': 'Negativa Muito Forte'
        };
        
        return [
            req1 ? requisitos.indexOf(req1) + 1 : 'N/A',
            req2 ? requisitos.indexOf(req2) + 1 : 'N/A',
            corr.correlacao,
            correlationTypes[corr.correlacao] || 'Indefinida',
            req1 ? `"${req1.descricao.replace(/"/g, '""')}"` : 'N/A',
            req2 ? `"${req2.descricao.replace(/"/g, '""')}"` : 'N/A',
            req1 ? getSentidoLabel(req1.sentidoMelhoria) : 'N/A',
            req2 ? getSentidoLabel(req2.sentidoMelhoria) : 'N/A'
        ];
    });
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}


// ============================================
// NOVAS FUNCIONALIDADES - MODAL E FILTROS
// ============================================

let currentFilterType = 'all';

// Funcao para filtrar analise por tipo de correlacao
function filterAnalysis(type) {
    currentFilterType = type;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        const filter = btn.getAttribute('data-filter');
        if (filter === type) btn.classList.add('active');
    });

    const neutralSection = document.getElementById('neutral-requirements-analysis');
    const conflictSection = document.getElementById('conflict-analysis');
    const synergySection = document.getElementById('synergy-analysis');
    const summarySection = document.getElementById('correlation-summary');

    if (type === 'neutral') {
        if (summarySection) summarySection.style.display = 'none';
        if (conflictSection) conflictSection.style.display = 'none';
        if (synergySection) synergySection.style.display = 'none';
        if (neutralSection) neutralSection.style.display = 'block';
        return;
    }

    if (summarySection) summarySection.style.display = '';
    if (conflictSection) conflictSection.style.display = '';
    if (synergySection) synergySection.style.display = '';
    if (neutralSection) neutralSection.style.display = type === 'all' ? 'block' : 'none';

    document.querySelectorAll('.analysis-item').forEach(item => {
        const itemType = item.getAttribute('data-correlation-type');
        const show = type === 'all' || itemType === type;
        item.classList.toggle('hidden', !show);
        item.classList.toggle('visible', show);
    });
}

// Funcao para exportar correlacoes em CSV
function exportCorrelacoes(format) {
    if (format === 'csv') {
        const correlacoes = qfdDB.getCorrelacoesProjeto();
        
        let csv = 'Requisito 1,Requisito 2,Correlacao,Descricao\n';
        
        correlacoes.forEach(corr => {
            const req1 = requisitos.find(r => r.id === corr.req1);
            const req2 = requisitos.find(r => r.id === corr.req2);
            
            if (req1 && req2) {
                const descricao = getCorrelationExportLabel(corr.correlacao || corr.value);
                csv += `"${req1.descricao}","${req2.descricao}","${corr.value}","${descricao}"\n`;
            }
        });
        
        downloadCSV(csv, 'correlacoes-projeto.csv');
    }
}

// Funcao para importar correlacoes em CSV
function importCorrelacoes() {
    document.getElementById('import-csv-correlacoes').click();
}

// Funcao para processar importacao de correlacoes CSV
function importCorrelacoesCsv(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const csv = e.target.result;
        const lines = csv.split('\n');
        
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const parts = lines[i].split(',');
            if (parts.length >= 3) {
                const descricao1 = parts[0].replace(/"/g, '').trim();
                const descricao2 = parts[1].replace(/"/g, '').trim();
                const valor = parts[2].replace(/"/g, '').trim();
                
                const req1 = requisitos.find(r => r.descricao === descricao1);
                const req2 = requisitos.find(r => r.descricao === descricao2);
                
                if (req1 && req2) {
                    qfdDB.setCorrelacaoProjeto(req1.id, req2.id, valor);
                    imported++;
                }
            }
        }
        
        loadRequisitos();
        setupCorrelation();
        updateStatus();
        
        alert(`${imported} correlacoes importadas com sucesso!`);
    };
    reader.readAsText(file);
    
    // Limpar input
    event.target.value = '';
}

// Funcao auxiliar para descarregar CSV
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Texto curto para exportação CSV (não sobrescreve getCorrelationDescription do popup)
function getCorrelationExportLabel(value) {
    const descriptions = {
        '++': 'Correlacao Positiva Muito Forte',
        '+': 'Correlacao Positiva',
        '0': 'Sem Correlacao',
        '-': 'Correlacao Negativa',
        '--': 'Correlacao Negativa Muito Forte'
    };
    return descriptions[value] || 'Nao definida';
}

