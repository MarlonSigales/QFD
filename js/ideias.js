/**
 * ============================================================================
 * CADERNO DE IDEIAS - IDEIAS DE SOLUÇÃO E FALHAS ANALISADAS
 * ============================================================================
 *
 * Pahl & Beitz, Seção 5.4: ideias de solução são registradas para a busca
 * sistemática de soluções, mas ficam fora da lista de requisitos. Falhas de
 * produtos existentes geram requisitos formulados de forma neutra.
 * Dados em qfdDB (addIdeia, addFalha, criarRequisitoDeFalha...).
 */

document.addEventListener('DOMContentLoaded', function() {
    const status = document.getElementById('ideia-status');
    Object.entries(STATUS_IDEIA).forEach(([v, t]) => status.add(new Option(t, v)));
    document.getElementById('form-ideia').addEventListener('submit', handleAddIdeia);
    document.getElementById('form-falha').addEventListener('submit', handleAddFalha);
    document.getElementById('ideia-autor').value = ultimoAutorIdeia();
    loadPage();
});

function loadPage() {
    renderEscolhaRequisitos();
    renderIdeias();
    renderFalhas();
}

/** Lista de todos os requisitos (no QFD ou não), com rótulo RCn/RPn */
function todosRequisitos() {
    const rotular = (lista, tipo, sigla) => {
        const numeros = numerosNoQFD(lista);
        return lista.map((r, i) => ({ tipo, id: r.id, rotulo: numeros[i] ? `${sigla}${numeros[i]}` : `${sigla} (fora do QFD)`, descricao: r.descricao }));
    };
    return [
        ...rotular(qfdDB.getRequisitosCliente({ todos: true }), 'cliente', 'RC'),
        ...rotular(qfdDB.getRequisitosProjeto({ todos: true }), 'projeto', 'RP')
    ];
}

function renderEscolhaRequisitos() {
    const box = document.getElementById('ideia-requisitos');
    const reqs = todosRequisitos();
    box.innerHTML = reqs.length ? '' : '<small class="competitiva-hint">Nenhum requisito cadastrado.</small>';
    reqs.forEach(r => {
        const label = document.createElement('label');
        label.className = 'ideias-chip-escolha';
        label.innerHTML = `<input type="checkbox" value="${escapeAttr(r.id)}" data-tipo="${r.tipo}"> <strong>${r.rotulo}</strong> <span></span>`;
        label.querySelector('span').textContent = truncateText(r.descricao, 40);
        box.appendChild(label);
    });
}

function handleAddIdeia(event) {
    event.preventDefault();
    const campo = id => document.getElementById(id);
    const requisitos = [...document.querySelectorAll('#ideia-requisitos input:checked')]
        .map(cb => ({ tipo: cb.dataset.tipo, id: cb.value }));
    try {
        const autor = campo('ideia-autor').value;
        validarAutorIdeia(autor);
        qfdDB.addIdeia({
            titulo: campo('ideia-titulo').value, descricao: campo('ideia-descricao').value,
            autor, status: campo('ideia-status').value, requisitos
        });
        lembrarAutorIdeia(autor);
        event.target.reset();
        campo('ideia-autor').value = normalizarAutores(autor);
        renderIdeias();
        showAlert('Ideia registrada.', 'success');
    } catch (err) {
        showAlert(escapeHtml(err.message), 'warning');
    }
}

function rotuloRequisito(ref) {
    const r = todosRequisitos().find(x => x.tipo === ref.tipo && x.id === ref.id);
    return r ? r : null;
}

function renderIdeias() {
    const ideias = qfdDB.getIdeias();
    document.getElementById('total-ideias').textContent = `(${ideias.length})`;
    const lista = document.getElementById('lista-ideias');
    lista.innerHTML = ideias.length ? '' : '<p class="competitiva-hint">Nenhuma ideia registrada.</p>';
    [...ideias].reverse().forEach(ideia => {
        const item = document.createElement('div');
        item.className = `ideia-item ideia-${ideia.status}`;
        item.dataset.id = ideia.id;
        item.innerHTML = `
            <div class="ideia-topo">
                <strong class="ideia-titulo"></strong>
                <select class="form-control ideia-status-select"></select>
                <button type="button" class="btn-icon btn-delete" title="Remover ideia"><i class="fas fa-trash"></i></button>
            </div>
            <div class="ideia-autor">
                <i class="fas fa-user"></i> Ideia de:
                <input type="text" class="form-control ideia-autor-input" maxlength="300" placeholder="informe quem deu a ideia" title="Obrigatório. Vários nomes: separe por vírgula (editável)">
                <small class="text-muted ideia-meta"></small>
            </div>
            <div class="ideia-descricao"></div>
            <div class="ideia-requisitos"></div>`;
        item.querySelector('.ideia-titulo').textContent = ideia.titulo;
        item.querySelector('.ideia-descricao').textContent = ideia.descricao;
        item.querySelector('.ideia-meta').textContent = formatDate(ideia.data);
        const autor = item.querySelector('.ideia-autor-input');
        autor.value = ideia.autor || '';
        autor.addEventListener('change', () => {
            try {
                validarAutorIdeia(autor.value);
                ideia.autor = autor.value = qfdDB.updateIdeia(ideia.id, { autor: autor.value }).autor;
            } catch (err) {
                autor.value = ideia.autor || '';
                showAlert(escapeHtml(err.message), 'warning');
            }
        });
        const select = item.querySelector('select');
        Object.entries(STATUS_IDEIA).forEach(([v, t]) => select.add(new Option(t, v)));
        select.value = ideia.status;
        select.addEventListener('change', () => { qfdDB.updateIdeia(ideia.id, { status: select.value }); renderIdeias(); });
        const reqs = item.querySelector('.ideia-requisitos');
        ideia.requisitos.forEach(ref => {
            const r = rotuloRequisito(ref);
            if (!r) return;
            const chip = document.createElement('span');
            chip.className = 'ideia-chip';
            chip.textContent = `${r.rotulo} — ${truncateText(r.descricao, 40)}`;
            reqs.appendChild(chip);
        });
        item.querySelector('.btn-delete').addEventListener('click', () => {
            if (!confirm(`Remover a ideia "${ideia.titulo}"?`)) return;
            qfdDB.removeIdeia(ideia.id);
            renderIdeias();
        });
        lista.appendChild(item);
    });
}

function handleAddFalha(event) {
    event.preventDefault();
    const campo = id => document.getElementById(id).value;
    try {
        qfdDB.addFalha({ falha: campo('falha-texto'), causa: campo('falha-causa'), produto: campo('falha-produto') });
        event.target.reset();
        renderFalhas();
        showAlert('Falha registrada. Use "Criar requisito neutro" para gerar o requisito.', 'success');
    } catch (err) {
        showAlert(escapeHtml(err.message), 'warning');
    }
}

function renderFalhas() {
    const falhas = qfdDB.getFalhas();
    document.getElementById('total-falhas').textContent = `(${falhas.length})`;
    const lista = document.getElementById('lista-falhas');
    lista.innerHTML = falhas.length ? '' : '<p class="competitiva-hint">Nenhuma falha registrada.</p>';
    [...falhas].reverse().forEach(f => {
        const item = document.createElement('div');
        item.className = 'ideia-item falha-item';
        item.dataset.id = f.id;
        item.innerHTML = `
            <div class="ideia-topo">
                <strong class="ideia-titulo"></strong>
                <button type="button" class="btn-icon btn-delete" title="Remover falha"><i class="fas fa-trash"></i></button>
            </div>
            <div class="ideia-descricao"></div>
            <div class="falha-requisito"></div>`;
        item.querySelector('.ideia-titulo').textContent = f.falha + (f.produto ? ` (${f.produto})` : '');
        item.querySelector('.ideia-descricao').textContent = f.causa ? `Causa: ${f.causa}` : '';
        const area = item.querySelector('.falha-requisito');
        const gerado = f.requisitoGerado && rotuloRequisito(f.requisitoGerado);
        if (gerado) {
            area.innerHTML = '<span class="ideia-chip falha-gerado"><i class="fas fa-check"></i> Requisito criado: <strong></strong></span>';
            area.querySelector('strong').textContent = `${gerado.rotulo} — ${gerado.descricao}`;
        } else {
            area.innerHTML = `
                <div class="falha-neutro">
                    <select class="form-control falha-tipo">
                        <option value="projeto">Requisito de projeto</option>
                        <option value="cliente">Requisito de cliente</option>
                    </select>
                    <input type="text" class="form-control falha-descricao" maxlength="300"
                           placeholder="Formulação neutra (o que o produto deve garantir, sem citar a solução)">
                    <button type="button" class="btn btn-sm btn-success"><i class="fas fa-magic"></i> Criar requisito neutro</button>
                </div>`;
            area.querySelector('button').addEventListener('click', () => {
                try {
                    qfdDB.criarRequisitoDeFalha(f.id, area.querySelector('.falha-tipo').value, area.querySelector('.falha-descricao').value);
                    loadPage();
                    showAlert('Requisito criado a partir da falha.', 'success');
                } catch (err) {
                    showAlert(escapeHtml(err.message), 'warning');
                }
            });
        }
        item.querySelector('.btn-delete').addEventListener('click', () => {
            if (!confirm('Remover esta falha? O requisito criado a partir dela continua cadastrado.')) return;
            qfdDB.removeFalha(f.id);
            renderFalhas();
        });
        lista.appendChild(item);
    });
}
