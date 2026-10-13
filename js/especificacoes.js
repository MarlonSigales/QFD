/**
 * ============================================================================
 * ESPECIFICAÇÕES - QUADRO DE REQUISITOS DE PROJETO
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {
    loadPage();
});

function loadPage() {
    try {
        qfdDB.getEspecificacoesProjeto();
        const lista = qfdDB.getEspecificacoesOrdenadas();
        const stats = qfdDB.getEspecificacoesStats();
        updateStatus(stats, lista.length);
        renderTable(lista);
    } catch (err) {
        console.error('Erro ao carregar especificações:', err);
        const tbody = document.getElementById('especificacoes-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5">Erro ao carregar dados. Recarregue a página.</td></tr>';
        }
        showToast('Erro ao carregar especificações.', 'danger');
    }
}

function updateStatus(stats, totalReq) {
    const totalEl = document.getElementById('total-requisitos');
    if (totalEl) totalEl.textContent = `${totalReq} Requisitos`;

    const preenchidasEl = document.getElementById('especificacoes-preenchidas');
    if (preenchidasEl) preenchidasEl.textContent = `${stats.completed} / ${stats.total}`;

    const progressoEl = document.getElementById('progresso-percentual');
    if (progressoEl) progressoEl.textContent = `${stats.percent}%`;

    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = `${stats.percent}%`;

    const insufficient = document.getElementById('insufficient-data');
    const section = document.getElementById('especificacoes-section');
    if (totalReq === 0) {
        if (insufficient) insufficient.style.display = 'block';
        if (section) section.style.display = 'none';
    } else {
        if (insufficient) insufficient.style.display = 'none';
        if (section) section.style.display = 'block';
    }
}

function renderTable(lista) {
    const tbody = document.getElementById('especificacoes-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!lista.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="5">Cadastre requisitos de projeto para preencher as especificações.</td>';
        tbody.appendChild(tr);
        return;
    }

    const total = lista.length;
    const t1 = Math.ceil(total / 3);
    const t2 = Math.ceil((2 * total) / 3);

    lista.forEach((row, index) => {
        const req = row.requisito;
        let tercioClass = 'tercio-inferior';
        if (index < t1) tercioClass = 'tercio-superior';
        else if (index < t2) tercioClass = 'tercio-medio';

        const impPct = req.pesoRelativo != null ? (req.pesoRelativo * 100).toFixed(1) + '%' : '-';
        const completo = String(row.unidadeMedida || '').trim() && metaDefinida(row);

        const tr = document.createElement('tr');
        tr.className = `${tercioClass}${completo ? ' spec-row-complete' : ''}`;
        tr.dataset.reqId = req.id;

        const reqObs = req.observacao || '';
        const tdReq = document.createElement('td');
        tdReq.className = 'spec-req-cell';
        tdReq.innerHTML = `
            <span class="spec-rank">#${row.rank}</span>
            <strong>RP${row.numeroOriginal}</strong>
            <span class="spec-desc"></span>
            ${reqObs ? `<div class="spec-obs-preview"><i class="fas fa-comment-dots"></i> <span></span></div>` : ''}
            <small class="spec-meta">Imp. rel.: ${impPct}</small>`;
        tdReq.querySelector('.spec-desc').textContent = req.descricao;
        if (reqObs) tdReq.querySelector('.spec-obs-preview span').textContent = reqObs;

        const tdUnidade = document.createElement('td');
        const inputUnidade = document.createElement('input');
        inputUnidade.type = 'text';
        inputUnidade.maxLength = 50;
        inputUnidade.className = 'form-control spec-input';
        inputUnidade.dataset.field = 'unidadeMedida';
        inputUnidade.placeholder = 'Ex.: mm, kg, %';
        inputUnidade.value = row.unidadeMedida || '';
        inputUnidade.addEventListener('change', () => saveField(req.id, 'unidadeMedida', inputUnidade.value));
        inputUnidade.addEventListener('blur', () => saveField(req.id, 'unidadeMedida', inputUnidade.value));
        tdUnidade.appendChild(inputUnidade);

        const tdValor = document.createElement('td');
        tdValor.appendChild(criarEditorMeta(req, row));

        const tdObs = document.createElement('td');
        const textareaObs = document.createElement('textarea');
        textareaObs.className = 'form-control spec-textarea';
        textareaObs.dataset.field = 'observacao';
        textareaObs.rows = 3;
        textareaObs.maxLength = 1000;
        textareaObs.placeholder = 'Ex.: Medido conforme norma ABNT, a 25 °C...';
        textareaObs.title = 'Aparece como balão flutuante no relatório ao passar o mouse sobre esta especificação';
        textareaObs.value = row.observacao || '';
        textareaObs.addEventListener('change', () => saveField(req.id, 'observacao', textareaObs.value.trim()));
        textareaObs.addEventListener('blur', () => saveField(req.id, 'observacao', textareaObs.value.trim()));
        tdObs.appendChild(textareaObs);

        const tdAspectos = document.createElement('td');
        const textarea = document.createElement('textarea');
        textarea.className = 'form-control spec-textarea';
        textarea.dataset.field = 'aspectosIndesejaveis';
        textarea.rows = 3;
        textarea.maxLength = 2000;
        textarea.placeholder = 'Conflitos do telhado QFD (--) aparecem aqui';
        textarea.value = row.aspectosIndesejaveis || '';
        textarea.addEventListener('change', () => saveField(req.id, 'aspectosIndesejaveis', textarea.value));
        textarea.addEventListener('blur', () => saveField(req.id, 'aspectosIndesejaveis', textarea.value));
        tdAspectos.appendChild(textarea);

        tr.appendChild(tdReq);
        tr.appendChild(tdUnidade);
        tr.appendChild(tdValor);
        tr.appendChild(tdObs);
        tr.appendChild(tdAspectos);
        tbody.appendChild(tr);
    });
}

const ROTULOS_TIPO_META = {
    '>=': '≥ mínimo',
    '<=': '≤ máximo',
    '=': '= nominal',
    'faixa': 'intervalo'
};

/**
 * Editor da meta: tipo (≥, ≤, =, intervalo), valor e, conforme o tipo, o
 * valor máximo do intervalo ou a tolerância (±). O tipo vem sugerido pelo
 * sentido de melhoria do requisito, mas pode ser trocado.
 */
function criarEditorMeta(req, row) {
    const sugerido = sugerirTipoMeta(req.sentidoMelhoria);
    const box = document.createElement('div');
    box.className = 'spec-meta-editor';

    const select = document.createElement('select');
    select.className = 'form-control spec-input spec-meta-tipo';
    select.dataset.field = 'tipoMeta';
    Object.entries(ROTULOS_TIPO_META).forEach(([valor, rotulo]) => {
        const opt = document.createElement('option');
        opt.value = valor;
        opt.textContent = rotulo + (valor === sugerido ? ' (sugerido)' : '');
        select.appendChild(opt);
    });
    select.value = row.tipoMeta || sugerido;

    const numero = (campo, placeholder, valor) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.maxLength = 20;
        input.className = 'form-control spec-input spec-meta-num';
        input.dataset.field = campo;
        input.placeholder = placeholder;
        input.value = Number.isFinite(valor) ? formatarNumero(valor) : '';
        return input;
    };
    const inputValor = numero('valorMeta', 'Ex.: 10,5', row.valorMeta);
    const inputMax = numero('valorMax', 'até', row.valorMax);
    const inputTol = numero('tolerancia', '± (opcional)', row.tolerancia);
    const sepMax = document.createElement('span');
    sepMax.className = 'spec-meta-sep';
    sepMax.textContent = 'a';

    const linha = document.createElement('div');
    linha.className = 'spec-meta-linha';
    linha.append(inputValor, sepMax, inputMax, inputTol);

    const aviso = document.createElement('small');
    aviso.className = 'spec-meta-aviso';

    box.append(select, linha, aviso);
    if (row.revisarMeta && row.metaTexto) {
        const revisar = document.createElement('small');
        revisar.className = 'spec-meta-revisar';
        revisar.textContent = `Revisar meta — valor antigo: "${row.metaTexto}"`;
        box.appendChild(revisar);
    }

    const mostrarCampos = () => {
        const faixa = select.value === 'faixa';
        sepMax.style.display = inputMax.style.display = faixa ? '' : 'none';
        inputTol.style.display = select.value === '=' ? '' : 'none';
    };
    mostrarCampos();

    const salvar = () => {
        mostrarCampos();
        const ler = input => {
            const t = input.value.trim();
            const n = t === '' ? null : parseNumeroEstrito(t);
            input.classList.toggle('spec-input-erro', t !== '' && n === null);
            return { vazio: t === '', n };
        };
        const v = ler(inputValor);
        const max = ler(inputMax);
        const tol = ler(inputTol);

        let erro = '';
        if ([v, select.value === 'faixa' ? max : null, select.value === '=' ? tol : null]
            .some(x => x && !x.vazio && x.n === null)) {
            erro = 'Use só números (vírgula decimal).';
        } else if (select.value === 'faixa' && v.n !== null && max.n !== null && max.n <= v.n) {
            erro = 'O fim do intervalo deve ser maior que o início.';
            inputMax.classList.add('spec-input-erro');
        }
        aviso.textContent = erro;
        if (erro) return;

        const campos = {
            tipoMeta: v.n === null ? '' : select.value,
            valorMeta: v.n,
            valorMax: select.value === 'faixa' ? max.n : null,
            tolerancia: select.value === '=' && tol.n !== null ? Math.abs(tol.n) : null
        };
        // meta válida informada: o texto antigo deixa de valer
        if (v.n !== null) Object.assign(campos, { metaTexto: '', revisarMeta: false });
        qfdDB.updateEspecificacao(req.id, campos);
        if (v.n !== null) box.querySelector('.spec-meta-revisar')?.remove();
        atualizarLinha(req.id);
    };
    select.addEventListener('change', salvar);
    [inputValor, inputMax, inputTol].forEach(input => input.addEventListener('change', salvar));
    return box;
}

function saveField(requisitoProjetoId, field, value) {
    qfdDB.updateEspecificacao(requisitoProjetoId, { [field]: value });
    atualizarLinha(requisitoProjetoId);
}

/** Atualiza o status geral e o destaque de linha completa (unidade + meta válida) */
function atualizarLinha(requisitoProjetoId) {
    const stats = qfdDB.getEspecificacoesStats();
    updateStatus(stats, stats.total);

    const row = document.querySelector(`tr[data-req-id="${requisitoProjetoId}"]`);
    const esp = qfdDB.getEspecificacoesProjeto().find(e => e.requisitoProjetoId === requisitoProjetoId);
    if (row && esp) {
        row.classList.toggle('spec-row-complete', String(esp.unidadeMedida || '').trim() !== '' && metaDefinida(esp));
    }
}

function refreshAspectosFromRoof() {
    if (!confirm('Atualizar aspectos indesejáveis a partir do telhado QFD? Linhas editadas manualmente serão mantidas.')) {
        return;
    }
    qfdDB.refreshAspectosIndesejaveisFromRoof(true);
    loadPage();
    showToast('Aspectos indesejáveis atualizados a partir das correlações --.', 'success');
}

function exportEspecificacoesJson() {
    exportPageData('especificacoes');
}

function importEspecificacoesJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const ok = qfdDB.importEspecificacoesJson(e.target.result);
        if (ok) {
            showToast('Especificações importadas com sucesso!', 'success');
            loadPage();
        } else {
            showToast('Erro ao importar. Verifique o formato JSON.', 'danger');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function showToast(message, type) {
    let toast = document.getElementById('spec-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'spec-toast';
        document.body.appendChild(toast);
    }
    toast.className = `spec-toast spec-toast-${type || 'info'}`;
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2800);
}
