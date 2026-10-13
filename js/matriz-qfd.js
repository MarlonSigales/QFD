/**
 * ============================================================================
 * MATRIZ QFD - CASA DA QUALIDADE
 * ============================================================================
 */

let requisitosCliente = [];
let requisitosProjeto = [];
let relacoesFeitas = 0;
let currentInfluenceCell = null;
let currentInfluenceI = null;
let currentInfluenceJ = null;
let activeCellHighlightGreen = false;

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupMatrix();
    setupGlobalEvents();
    const influenceModal = document.getElementById('influence-modal');
    if (influenceModal) influenceModal.style.display = 'none';
});

function loadData() {
    requisitosCliente = qfdDB.getRequisitosCliente();
    // Recalcula: a importância dos RC pode ter mudado na Comparação depois da matriz
    qfdDB.calculateImportanciaProjeto();
    requisitosProjeto = qfdDB.getRequisitosProjeto();
    relacoesFeitas = qfdDB.getMatrizQFDCompleta().length;
}

function setupMatrix() {
    const hasData = requisitosCliente.length > 0 && requisitosProjeto.length > 0;
    document.getElementById('insufficient-data').style.display = hasData ? 'none' : 'block';
    document.getElementById('qfd-section').style.display = hasData ? 'block' : 'none';

    const roofContainer = document.getElementById('qfd-roof-container');
    if (roofContainer) roofContainer.style.display = 'none';

    if (hasData) {
        generateQFDMatrix();
        updateStatus();
    }
}

/** Telhado + matriz em uma única tabela para alinhamento perfeito das colunas RP */
function generateQFDMatrix() {
    const matrixContainer = document.getElementById('qfd-matrix');
    if (!matrixContainer) return;

    const n = requisitosProjeto.length;
    let html = '<table class="qfd-table qfd-unified">';

    html += '<thead>';

    // Telhado triangular (somente leitura, sem clique)
    if (n >= 2) {
        for (let i = 0; i < n - 1; i++) {
            html += '<tr class="qfd-roof-row">';
            if (i === 0) {
                html += `<th class="qfd-roof-label" rowspan="${n - 1}" title="Correlações entre requisitos de projeto (definidas na etapa Correlação)">Correlações</th>`;
            }
            for (let k = 0; k <= i; k++) {
                html += '<td class="qfd-roof-empty"></td>';
            }
            for (let j = i + 1; j < n; j++) {
                const rp1 = requisitosProjeto[i];
                const rp2 = requisitosProjeto[j];
                const correlation = qfdDB.getCorrelacaoProjeto(rp1.id, rp2.id);
                const tip = `RP${i + 1} ↔ RP${j + 1}: ${getCorrelationLabel(correlation)}`;
                html += `<td class="qfd-roof-cell-readonly" title="${escapeHtml(tip)}">
                    <span class="symbol">${getCorrelationSymbol(correlation)}</span>
                </td>`;
            }
            html += '<td class="qfd-roof-side-empty"></td><td class="qfd-roof-side-empty"></td>';
            html += '</tr>';
        }
    }

    // Cabeçalho: RP vertical + sentido
    html += '<tr><th class="row-header">Requisitos</th>';
    const especificacoes = qfdDB.getEspecificacoesProjeto();
    requisitosProjeto.forEach((rp, i) => {
        const rpObs = rp.observacao ? `\n${rp.observacao}` : '';
        const esp = especificacoes.find(e => e.requisitoProjetoId === rp.id);
        const espObs = esp && esp.observacao ? `\nEspecificação: ${esp.observacao}` : '';
        const tip = `RP${i + 1}: ${rp.descricao}${rpObs}${espObs}`;
        html += `<th class="req-number-cell" data-tooltip="${escapeAttr(tip)}">
            <span class="rp-id">RP${i + 1}</span>
            <span class="rp-sentido">${getSentidoSymbol(rp.sentidoMelhoria)}</span>
        </th>`;
    });
    html += '<th class="importance-header">Pontuação</th><th class="importance-header">Percentual (%)</th></tr>';
    html += '</thead><tbody>';

    requisitosCliente.forEach((rc, i) => {
        const rcObs = rc.observacao ? `\n${rc.observacao}` : '';
        const rcTip = `RC${i + 1}: ${rc.descricao}${rcObs}`;
        html += `<tr><td class="row-header" data-tooltip="${escapeAttr(rcTip)}">${i + 1}. ${truncateText(rc.descricao, 30)}</td>`;
        requisitosProjeto.forEach((rp, j) => {
            const val = qfdDB.getMatrizQFD(rc.id, rp.id);
            const cellTip = `RC${i + 1} × RP${j + 1}: influência ${val || 'não definida'}`;
            html += `<td class="influence-cell" data-cliente="${rc.id}" data-projeto="${rp.id}" data-i="${i}" data-j="${j}" title="${escapeHtml(cellTip)}" onclick="openInfluenceModal(this)">${val || ''}</td>`;
        });
        html += `<td class="importance-value-cell">${(rc.importancia || 0).toFixed(1)}</td>`;
        html += `<td class="importance-percent-cell">${((rc.peso || 0) * 100).toFixed(1)}%</td></tr>`;
    });

    html += '</tbody>';
    html += buildTotaisProjetoHTML();
    html += '</table>';
    matrixContainer.innerHTML = html;
}

function openInfluenceModal(cell) {
    const modal = document.getElementById('influence-modal');
    const info = document.getElementById('modal-comparison-info');
    if (!modal || !info) return;

    currentInfluenceCell = cell;
    currentInfluenceI = parseInt(cell.dataset.i, 10);
    currentInfluenceJ = parseInt(cell.dataset.j, 10);

    document.querySelectorAll('.influence-cell.active-a, .influence-cell.active-b').forEach(c => {
        c.classList.remove('active-a', 'active-b');
    });
    currentInfluenceCell.classList.add(activeCellHighlightGreen ? 'active-b' : 'active-a');
    activeCellHighlightGreen = !activeCellHighlightGreen;

    const clienteId = cell.dataset.cliente;
    const projetoId = cell.dataset.projeto;
    const rc = requisitosCliente[currentInfluenceI];
    const rp = requisitosProjeto[currentInfluenceJ];
    const cellValue = parseInt((cell.textContent || '').trim(), 10);
    const currentVal = Number.isFinite(cellValue) ? cellValue : (qfdDB.getMatrizQFD(clienteId, projetoId) || 0);

    const rcObsHtml = rc?.observacao ? `<div class="req-obs-modal"><i class="fas fa-comment-dots"></i> ${escapeHtml(rc.observacao)}</div>` : '';
    const rpObsHtml = rp?.observacao ? `<div class="req-obs-modal"><i class="fas fa-comment-dots"></i> ${escapeHtml(rp.observacao)}</div>` : '';
    info.innerHTML = `
        <strong>RC${currentInfluenceI + 1}:</strong> ${escapeHtml(rc?.descricao || '')}${rcObsHtml}
        <strong>RP${currentInfluenceJ + 1}:</strong> ${escapeHtml(rp?.descricao || '')}${rpObsHtml}
        <small>Valor atual: <strong>${currentVal}</strong> (pressione <kbd>Enter</kbd> para salvar e ir para a próxima célula, <kbd>Shift</kbd>+<kbd>Enter</kbd> para voltar)</small>
    `;

    const prevBtn = document.getElementById('prev-influence');
    if (prevBtn) prevBtn.disabled = !getPrevGridCell(currentInfluenceI, currentInfluenceJ, requisitosProjeto.length);

    modal.style.display = 'flex';

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeInfluenceModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/** Volta para a célula anterior na ordem do Enter, sem salvar a atual */
function goToPrevInfluenceCell() {
    if (currentInfluenceCell == null) return;
    const prev = getPrevGridCell(currentInfluenceI, currentInfluenceJ, requisitosProjeto.length);
    if (!prev) return;
    const prevCell = document.querySelector(`.influence-cell[data-i="${prev.i}"][data-j="${prev.j}"]`);
    if (prevCell) openInfluenceModal(prevCell);
}

function closeInfluenceModal() {
    const modal = document.getElementById('influence-modal');
    if (modal) modal.style.display = 'none';
    currentInfluenceCell = null;
    currentInfluenceI = null;
    currentInfluenceJ = null;
}

function getNextInfluenceCell(i, j) {
    const rows = requisitosCliente.length;
    const cols = requisitosProjeto.length;
    if (rows === 0 || cols === 0) return null;
    if (j < cols - 1) return { i, j: j + 1 };
    if (i < rows - 1) return { i: i + 1, j: 0 };
    return null;
}

/**
 * Rodapé da matriz: soma (Σ relação × importância do RC), percentual
 * normalizado e posição no ranking de cada requisito de projeto
 */
function buildTotaisProjetoHTML() {
    const linhas = [
        { classe: 'qfd-sum-total', rotulo: 'Soma (Σ relação × importância)', tip: 'Soma das relações da coluna multiplicadas pela importância de cada requisito de cliente' },
        { classe: 'qfd-sum-percent', rotulo: 'Percentual (%)', tip: 'Soma da coluna dividida pela soma de todas as colunas' },
        { classe: 'qfd-sum-rank', rotulo: 'Ranking', tip: 'Posição pela soma; empates ficam na mesma posição' }
    ];
    let html = '<tfoot>';
    linhas.forEach(l => {
        html += `<tr class="qfd-sum-row ${l.classe}"><th class="row-header" data-tooltip="${escapeAttr(l.tip)}">${l.rotulo}</th>`;
        requisitosProjeto.forEach((rp, j) => {
            html += `<td data-j="${j}">${formatTotalProjeto(l.classe, rp)}</td>`;
        });
        html += '<td></td><td></td></tr>';
    });
    return html + '</tfoot>';
}

function formatTotalProjeto(classe, rp) {
    if (classe === 'qfd-sum-total') return (rp.importanciaAbsoluta || 0).toFixed(1);
    if (classe === 'qfd-sum-percent') return ((rp.pesoRelativo || 0) * 100).toFixed(1) + '%';
    return rp.importanciaAbsoluta > 0 ? `${rp.importanciaRelativa}º` : '-';
}

/** Atualiza o rodapé de somas sem redesenhar a matriz (mantém o modal aberto) */
function updateTotaisProjeto() {
    requisitosProjeto = qfdDB.getRequisitosProjeto();
    document.querySelectorAll('.qfd-sum-row').forEach(tr => {
        const classe = ['qfd-sum-total', 'qfd-sum-percent', 'qfd-sum-rank'].find(c => tr.classList.contains(c));
        tr.querySelectorAll('td[data-j]').forEach(td => {
            const rp = requisitosProjeto[parseInt(td.dataset.j, 10)];
            if (rp) td.textContent = formatTotalProjeto(classe, rp);
        });
    });
}

function setInfluence(value) {
    if (!currentInfluenceCell) return;
    const clienteId = currentInfluenceCell.dataset.cliente;
    const projetoId = currentInfluenceCell.dataset.projeto;

    qfdDB.setMatrizQFD(clienteId, projetoId, value);
    currentInfluenceCell.textContent = value === 0 ? '' : String(value);

    relacoesFeitas = qfdDB.getMatrizQFDCompleta().length;
    updateStatus();
    updateTotaisProjeto();

    const next = getNextInfluenceCell(currentInfluenceI, currentInfluenceJ);
    if (!next) {
        closeInfluenceModal();
        return;
    }

    const nextCell = document.querySelector(`.influence-cell[data-i="${next.i}"][data-j="${next.j}"]`);
    if (!nextCell) {
        closeInfluenceModal();
        return;
    }
    openInfluenceModal(nextCell);
}

function updateStatus() {
    const total = requisitosCliente.length * requisitosProjeto.length;
    const progresso = total > 0 ? Math.round((relacoesFeitas / total) * 100) : 0;
    const totalClienteEl = document.getElementById('total-req-cliente');
    if (totalClienteEl) totalClienteEl.textContent = requisitosCliente.length;
    const totalProjetoEl = document.getElementById('total-req-projeto');
    if (totalProjetoEl) totalProjetoEl.textContent = requisitosProjeto.length;
    const relacoesEl = document.getElementById('relacoes-feitas');
    if (relacoesEl) relacoesEl.textContent = `${relacoesFeitas} / ${total}`;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = progresso + '%';
    const text = document.getElementById('progresso-percentual');
    if (text) text.textContent = progresso + '%';
}

function getCorrelationSymbol(corr) {
    const symbols = { '++': '++', '+': '+', '-': '-', '--': '--', '0': '0' };
    return symbols[corr] || '';
}

function getCorrelationLabel(corr) {
    const labels = { '++': 'Forte Positiva', '+': 'Positiva', '-': 'Negativa', '--': 'Forte Negativa', '0': 'Neutra' };
    return labels[corr] || 'Neutra';
}

function setupGlobalEvents() {
    const btnToggleRoof = document.getElementById('btn-toggle-roof');
    if (btnToggleRoof) {
        btnToggleRoof.onclick = () => toggleRoof();
    }

    const influenceModal = document.getElementById('influence-modal');
    if (influenceModal) {
        influenceModal.addEventListener('click', (e) => {
            if (e.target === influenceModal) closeInfluenceModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        const modalOpen = influenceModal && influenceModal.style.display === 'flex';
        if (!modalOpen) return;

        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            goToPrevInfluenceCell();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (!currentInfluenceCell) return;
            const clienteId = currentInfluenceCell.dataset.cliente;
            const projetoId = currentInfluenceCell.dataset.projeto;
            const currentVal = qfdDB.getMatrizQFD(clienteId, projetoId) || 0;
            setInfluence(currentVal);
            return;
        }

        if (e.key === '0') { e.preventDefault(); setInfluence(0); }
        if (e.key === '1') { e.preventDefault(); setInfluence(1); }
        if (e.key === '3') { e.preventDefault(); setInfluence(3); }
        if (e.key === '9') { e.preventDefault(); setInfluence(9); }
    });
}

function toggleRoof() {
    const rows = document.querySelectorAll('.qfd-roof-row');
    const btn = document.getElementById('btn-toggle-roof');
    if (!rows.length) return;
    const hidden = rows[0].style.display === 'none';
    rows.forEach(r => { r.style.display = hidden ? '' : 'none'; });
    if (btn) {
        btn.innerHTML = hidden
            ? '<i class="fas fa-compress-alt"></i> Recolher Telhado'
            : '<i class="fas fa-expand-alt"></i> Mostrar Telhado';
    }
}

function toggleDirections() {
    const sentidos = document.querySelectorAll('.rp-sentido');
    const btn = document.getElementById('btn-toggle-directions');
    if (!sentidos.length || !btn) return;
    const showing = btn.dataset.showing !== 'false';
    sentidos.forEach(el => { el.style.visibility = showing ? 'hidden' : 'visible'; });
    btn.dataset.showing = showing ? 'false' : 'true';
    btn.innerHTML = showing
        ? '<i class="fas fa-eye"></i> Mostrar Sentidos'
        : '<i class="fas fa-eye-slash"></i> Ocultar Sentidos';
}
