/**
 * ============================================================================
 * ESTADO DA TÉCNICA E REFERÊNCIAS
 * ============================================================================
 *
 * Pahl & Beitz, Seções 3.1.4 e 5.2.3: produtos, tecnologias, patentes,
 * normas, diretrizes e regulamentos consultados, ligados aos requisitos
 * (muitos-para-muitos). Dados em qfdDB (addReferencia, updateReferencia...).
 * Os links são só mostrados; nada é buscado na internet.
 */

document.addEventListener('DOMContentLoaded', function() {
    const tipo = document.getElementById('ref-tipo');
    Object.entries(TIPOS_REFERENCIA).forEach(([v, t]) => tipo.add(new Option(t, v)));
    tipo.value = 'norma';
    document.getElementById('form-referencia').addEventListener('submit', handleAddReferencia);
    loadPage();
});

function loadPage() {
    renderEscolhaRequisitos(document.getElementById('ref-requisitos'), []);
    renderReferencias();
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

/** Caixas de seleção dos requisitos; marcados = ligações atuais */
function renderEscolhaRequisitos(box, marcados, aoMudar) {
    const reqs = todosRequisitos();
    box.innerHTML = reqs.length ? '' : '<small class="competitiva-hint">Nenhum requisito cadastrado.</small>';
    reqs.forEach(r => {
        const label = document.createElement('label');
        label.className = 'ideias-chip-escolha';
        label.innerHTML = `<input type="checkbox" value="${escapeAttr(r.id)}" data-tipo="${r.tipo}"> <strong>${r.rotulo}</strong> <span></span>`;
        label.querySelector('span').textContent = truncateText(r.descricao, 40);
        const cb = label.querySelector('input');
        cb.checked = marcados.some(m => m.tipo === r.tipo && m.id === r.id);
        if (aoMudar) cb.addEventListener('change', aoMudar);
        box.appendChild(label);
    });
}

const lerMarcados = box => [...box.querySelectorAll('input:checked')].map(cb => ({ tipo: cb.dataset.tipo, id: cb.value }));

function handleAddReferencia(event) {
    event.preventDefault();
    const campo = id => document.getElementById(id).value;
    try {
        qfdDB.addReferencia({
            tipo: campo('ref-tipo'), titulo: campo('ref-titulo'), identificacao: campo('ref-identificacao'),
            link: campo('ref-link'), dataConsulta: campo('ref-data'), resumo: campo('ref-resumo'),
            requisitos: lerMarcados(document.getElementById('ref-requisitos'))
        });
        const tipo = campo('ref-tipo');
        event.target.reset();
        document.getElementById('ref-tipo').value = tipo;
        renderReferencias();
        showAlert('Referência registrada.', 'success');
    } catch (err) {
        showAlert(escapeHtml(err.message), 'warning');
    }
}

function renderReferencias() {
    const refs = qfdDB.getReferencias();
    document.getElementById('total-referencias').textContent = `(${refs.length})`;
    const lista = document.getElementById('lista-referencias');
    lista.innerHTML = refs.length ? '' : '<p class="competitiva-hint">Nenhuma referência registrada.</p>';
    const reqs = todosRequisitos();
    [...refs].reverse().forEach(ref => {
        const item = document.createElement('div');
        item.className = `ideia-item referencia-item referencia-${ref.tipo}`;
        item.dataset.id = ref.id;
        item.innerHTML = `
            <div class="ideia-topo">
                <span class="referencia-tipo"></span>
                <strong class="ideia-titulo"></strong>
                <button type="button" class="btn-icon btn-delete" title="Remover referência"><i class="fas fa-trash"></i></button>
            </div>
            <div class="referencia-link"></div>
            <div class="ideia-descricao"></div>
            <div class="ideia-requisitos"></div>
            <details class="referencia-ligacoes"><summary>Ligar a requisitos</summary><div class="ideias-requisitos-escolha"></div></details>
            <small class="text-muted ideia-meta"></small>`;
        item.querySelector('.referencia-tipo').textContent = TIPOS_REFERENCIA[ref.tipo] || '';
        item.querySelector('.ideia-titulo').textContent = rotuloReferencia(ref);
        item.querySelector('.ideia-descricao').textContent = ref.resumo;
        item.querySelector('.ideia-meta').textContent = ref.dataConsulta ? `Consultado em ${dataBR(ref.dataConsulta)}` : '';
        if (ref.link) {
            // o endereço aparece como texto; só vira link se for http(s)
            const area = item.querySelector('.referencia-link');
            const seguro = linkSeguro(ref.link);
            if (seguro) {
                const a = document.createElement('a');
                a.href = seguro; a.target = '_blank'; a.rel = 'noopener noreferrer';
                a.textContent = seguro;
                area.appendChild(a);
            } else {
                area.textContent = ref.link;
            }
        }
        const chips = item.querySelector('.ideia-requisitos');
        ref.requisitos.forEach(l => {
            const r = reqs.find(x => x.tipo === l.tipo && x.id === l.id);
            if (!r) return;
            const chip = document.createElement('span');
            chip.className = 'ideia-chip';
            chip.textContent = `${r.rotulo} — ${truncateText(r.descricao, 40)}`;
            chips.appendChild(chip);
        });
        const escolha = item.querySelector('.referencia-ligacoes .ideias-requisitos-escolha');
        renderEscolhaRequisitos(escolha, ref.requisitos, () => {
            qfdDB.updateReferencia(ref.id, { requisitos: lerMarcados(escolha) });
            renderReferencias();
            const aberto = document.querySelector(`.referencia-item[data-id="${ref.id}"] .referencia-ligacoes`);
            if (aberto) aberto.open = true;
        });
        item.querySelector('.btn-delete').addEventListener('click', () => {
            if (!confirm(`Remover a referência "${ref.titulo}"?`)) return;
            qfdDB.removeReferencia(ref.id);
            renderReferencias();
        });
        lista.appendChild(item);
    });
}

/** aaaa-mm-dd -> dd/mm/aaaa */
function dataBR(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
