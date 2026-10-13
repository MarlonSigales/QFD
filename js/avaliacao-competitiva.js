/**
 * ============================================================================
 * AVALIAÇÃO COMPETITIVA - NOSSO PRODUTO x CONCORRENTES
 * ============================================================================
 *
 * Etapa posterior ao QFD: notas dos clientes (1 a 5) para o nosso produto e
 * para os concorrentes em cada requisito de cliente, e valores técnicos
 * medidos de cada produto em cada requisito de projeto. Os cálculos ficam em
 * qfdDB.getAnaliseCompetitiva(); aqui só a interface.
 *
 * As tabelas são montadas uma vez (loadPage) e, a cada alteração, só as
 * colunas calculadas, o gráfico e o resultado são atualizados, para não
 * perder o foco do campo que o usuário está preenchendo.
 */

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('form-concorrente').addEventListener('submit', handleAddConcorrente);
    document.getElementById('form-indice').addEventListener('submit', handleAddIndice);
    loadPage();
});

function loadPage() {
    try {
        const analise = qfdDB.getAnaliseCompetitiva();
        const temDados = analise.clientes.length > 0;
        document.getElementById('insufficient-data').style.display = temDados ? 'none' : 'block';
        document.getElementById('competitiva-content').style.display = temDados ? 'block' : 'none';
        if (!temDados) {
            updateStatus(analise);
            return;
        }
        renderProdutos(analise);
        renderClientes(analise);
        renderTecnicos(analise);
        renderIndices(analise);
        updateComputed(analise);
    } catch (err) {
        console.error('Erro ao carregar a avaliação competitiva:', err);
        showToast('Erro ao carregar a avaliação competitiva. Recarregue a página.', 'danger');
    }
}

// ============================================================================
// PRODUTOS
// ============================================================================

function corProduto(index) {
    return CORES_PRODUTOS[index % CORES_PRODUTOS.length];
}

function renderProdutos(analise) {
    const lista = document.getElementById('produtos-lista');
    lista.innerHTML = '';

    analise.produtos.forEach((produto, index) => {
        const item = document.createElement('div');
        item.className = 'produto-item';

        const cor = document.createElement('span');
        cor.className = 'produto-cor';
        cor.style.background = corProduto(index);

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 60;
        input.className = 'form-control';
        input.value = produto.nome;
        input.title = 'Clique para renomear';
        input.addEventListener('change', () => {
            try {
                qfdDB.renameProdutoAvaliado(produto.id, input.value);
                updateNomesProdutos();
                updateComputed();
            } catch (err) {
                showToast(err.message, 'danger');
                input.value = produto.nome;
            }
        });

        const tipo = document.createElement('span');
        tipo.className = `produto-tipo ${produto.tipo === 'nosso' ? 'produto-nosso' : ''}`;
        tipo.textContent = produto.tipo === 'nosso' ? 'Nosso' : 'Concorrente';

        item.append(cor, input, tipo);

        if (produto.tipo !== 'nosso') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-danger';
            btn.title = 'Remover concorrente';
            btn.innerHTML = '<i class="fas fa-trash"></i>';
            btn.addEventListener('click', () => {
                if (!confirm(`Remover "${produto.nome}" e todas as notas e valores dele?`)) return;
                qfdDB.removeConcorrente(produto.id);
                loadPage();
            });
            item.appendChild(btn);
        }
        lista.appendChild(item);
    });

    const podeAdicionar = analise.concorrentes.length < MAX_CONCORRENTES;
    document.querySelectorAll('#form-concorrente input, #form-concorrente button').forEach(el => {
        el.disabled = !podeAdicionar;
    });
}

function handleAddConcorrente(event) {
    event.preventDefault();
    const input = document.getElementById('novo-concorrente');
    try {
        qfdDB.addConcorrente(input.value);
        input.value = '';
        loadPage();
        showToast('Concorrente adicionado.', 'success');
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

/** Cabeçalho de coluna de um produto (bolinha de cor + nome) */
function produtoTh(produto, index) {
    const th = document.createElement('th');
    th.className = 'produto-col';
    th.innerHTML = `<span class="produto-cor" style="background:${corProduto(index)}"></span> <span data-produto-nome="${escapeAttr(produto.id)}"></span>`;
    th.querySelector('[data-produto-nome]').textContent = produto.nome;
    return th;
}

function updateNomesProdutos() {
    qfdDB.getAvaliacaoCompetitiva().produtos.forEach(p => {
        document.querySelectorAll(`[data-produto-nome="${CSS.escape(p.id)}"]`).forEach(el => { el.textContent = p.nome; });
    });
}

// ============================================================================
// AVALIAÇÃO DOS CLIENTES
// ============================================================================

function montarCabecalho(theadId, antes, produtos, depois) {
    const thead = document.getElementById(theadId);
    const tr = document.createElement('tr');
    antes.forEach(texto => {
        const th = document.createElement('th');
        th.textContent = texto;
        tr.appendChild(th);
    });
    produtos.forEach((p, i) => tr.appendChild(produtoTh(p, i)));
    depois.forEach(texto => {
        const th = document.createElement('th');
        th.textContent = texto;
        tr.appendChild(th);
    });
    thead.innerHTML = '';
    thead.appendChild(tr);
}

function criarSelectNota(valor, onChange, rotuloVazio) {
    const select = document.createElement('select');
    select.className = 'form-control nota-select';
    [['', rotuloVazio], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']].forEach(([v, t]) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = t;
        select.appendChild(opt);
    });
    select.value = valor ? String(valor) : '';
    select.addEventListener('change', () => {
        onChange(select.value);
        updateComputed();
    });
    return select;
}

function renderClientes(analise) {
    montarCabecalho('clientes-thead', ['RC', 'Requisito de cliente', 'Peso'], analise.produtos,
        ['Meta', 'Índice de melhoria', 'Prioridade', 'Situação']);

    const tbody = document.getElementById('clientes-tbody');
    tbody.innerHTML = '';

    const ordenados = [...analise.clientes].sort((a, b) => (b.peso - a.peso) || (a.numero - b.numero));
    ordenados.forEach(c => {
        const tr = document.createElement('tr');
        tr.dataset.rcId = c.requisito.id;

        const tdNum = document.createElement('td');
        tdNum.innerHTML = `<strong>RC${c.numero}</strong>`;

        const tdDesc = document.createElement('td');
        tdDesc.className = 'competitiva-desc';
        tdDesc.textContent = c.requisito.descricao;
        if (c.requisito.observacao) tdDesc.title = c.requisito.observacao;

        const tdPeso = document.createElement('td');
        tdPeso.textContent = `${(c.peso * 100).toFixed(1)}%`;

        tr.append(tdNum, tdDesc, tdPeso);

        analise.produtos.forEach(p => {
            const td = document.createElement('td');
            td.appendChild(criarSelectNota(c.notas[p.id], v => qfdDB.setNotaCliente(c.requisito.id, p.id, v), '—'));
            tr.appendChild(td);
        });

        const tdMeta = document.createElement('td');
        tdMeta.appendChild(criarSelectNota(c.meta, v => qfdDB.setMetaCliente(c.requisito.id, v), '—'));
        tr.appendChild(tdMeta);

        ['c-indice', 'c-prioridade', 'c-situacao'].forEach(cls => {
            const td = document.createElement('td');
            td.className = cls;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// ============================================================================
// AVALIAÇÃO TÉCNICA
// ============================================================================

function renderTecnicos(analise) {
    const vazio = analise.tecnicos.length === 0;
    document.getElementById('tecnicos-vazio').style.display = vazio ? 'block' : 'none';
    const tbody = document.getElementById('tecnicos-tbody');
    tbody.innerHTML = '';
    if (vazio) {
        document.getElementById('tecnicos-thead').innerHTML = '';
        return;
    }

    montarCabecalho('tecnicos-thead', ['#', 'Requisito de projeto', 'Sentido', 'Meta (especificação)'], analise.produtos,
        ['Melhor concorrente', 'Meta × melhor concorrente']);

    analise.tecnicos.forEach(t => {
        const tr = document.createElement('tr');
        tr.dataset.rpId = t.requisito.id;

        const tdNum = document.createElement('td');
        tdNum.innerHTML = `<span class="spec-rank">#${t.rank}</span> <strong>RP${t.numero}</strong>`;

        const tdDesc = document.createElement('td');
        tdDesc.className = 'competitiva-desc';
        tdDesc.textContent = t.requisito.descricao;
        if (t.requisito.observacao) tdDesc.title = t.requisito.observacao;

        const tdSentido = document.createElement('td');
        tdSentido.textContent = getSentidoSymbol(t.requisito.sentidoMelhoria);
        tdSentido.title = getSentidoLabel(t.requisito.sentidoMelhoria);

        const tdMeta = document.createElement('td');
        tdMeta.textContent = t.meta ? `${t.meta} ${t.unidade}`.trim() : '—';
        if (!t.meta) tdMeta.title = 'Defina a meta na página de Especificações';

        tr.append(tdNum, tdDesc, tdSentido, tdMeta);

        analise.produtos.forEach(p => {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 50;
            input.className = 'form-control valor-input';
            input.placeholder = t.unidade || 'valor';
            input.value = t.valores[p.id] || '';
            const salvar = () => {
                qfdDB.setValorTecnico(t.requisito.id, p.id, input.value);
                updateComputed();
            };
            input.addEventListener('change', salvar);
            td.appendChild(input);
            tr.appendChild(td);
        });

        ['t-melhor', 't-situacao'].forEach(cls => {
            const td = document.createElement('td');
            td.className = cls;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// ============================================================================
// ÍNDICES
// ============================================================================

const SENTIDOS_INDICE = [['up', '↑'], ['down', '↓'], ['none', '*']];

function handleAddIndice(event) {
    event.preventDefault();
    const campo = id => document.getElementById(id);
    try {
        qfdDB.addIndice({
            nome: campo('indice-nome').value, formula: campo('indice-formula').value,
            unidade: campo('indice-unidade').value, sentido: campo('indice-sentido').value
        });
        ['indice-nome', 'indice-formula', 'indice-unidade'].forEach(id => { campo(id).value = ''; });
        const analise = qfdDB.getAnaliseCompetitiva();
        renderIndices(analise);
        updateComputed(analise);
    } catch (err) {
        showToast(err.message, 'warning');
    }
}

function renderIndices(analise) {
    const tbody = document.getElementById('indices-tbody');
    const thead = document.getElementById('indices-thead');
    tbody.innerHTML = '';
    if (!analise.indices.length) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td class="competitiva-hint">Nenhum índice. Crie um abaixo.</td></tr>';
        return;
    }
    montarCabecalho('indices-thead', ['Índice', 'Fórmula', 'Unidade', 'Sentido'], analise.produtos,
        ['Melhor concorrente', 'Nosso × melhor', '']);

    analise.indices.forEach(x => {
        const tr = document.createElement('tr');
        tr.dataset.indiceId = x.indice.id;
        const salvar = (campo, input) => {
            try {
                qfdDB.updateIndice(x.indice.id, { [campo]: input.value });
                input.classList.remove('spec-input-erro');
                updateComputed();
            } catch (err) {
                input.classList.add('spec-input-erro');
                showToast(err.message, 'warning');
            }
        };
        const texto = (campo, valor, classe) => {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = `form-control ${classe}`;
            input.value = valor;
            input.addEventListener('change', () => salvar(campo, input));
            td.appendChild(input);
            return td;
        };
        tr.appendChild(texto('nome', x.indice.nome, 'indice-nome-input'));
        const tdFormula = texto('formula', x.formula, 'indice-formula-input');
        if (x.formula.includes('RP?')) tdFormula.title = 'Um requisito usado na fórmula foi excluído ou saiu do QFD';
        tr.appendChild(tdFormula);
        tr.appendChild(texto('unidade', x.indice.unidade, 'indice-unidade-input'));

        const tdSentido = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'form-control nota-select';
        SENTIDOS_INDICE.forEach(([v, t]) => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = t;
            select.appendChild(opt);
        });
        select.value = x.indice.sentido;
        select.addEventListener('change', () => salvar('sentido', select));
        tdSentido.appendChild(select);
        tr.appendChild(tdSentido);

        analise.produtos.forEach(p => {
            const td = document.createElement('td');
            td.className = 'i-valor';
            td.dataset.produtoId = p.id;
            tr.appendChild(td);
        });
        ['i-melhor', 'i-situacao'].forEach(cls => {
            const td = document.createElement('td');
            td.className = cls;
            tr.appendChild(td);
        });

        const tdRemover = document.createElement('td');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-icon btn-delete';
        btn.title = 'Remover índice';
        btn.innerHTML = '<i class="fas fa-trash"></i>';
        btn.addEventListener('click', () => {
            if (!confirm(`Remover o índice "${x.indice.nome}"?`)) return;
            qfdDB.removeIndice(x.indice.id);
            const analiseNova = qfdDB.getAnaliseCompetitiva();
            renderIndices(analiseNova);
            updateComputed(analiseNova);
        });
        tdRemover.appendChild(btn);
        tr.appendChild(tdRemover);
        tbody.appendChild(tr);
    });
}

/** Valor de índice formatado (até 3 casas) ou "—" */
function formatarIndice(valor) {
    return valor === null || valor === undefined ? '—' : formatarNumero(Math.round(valor * 1000) / 1000);
}

// ============================================================================
// COLUNAS CALCULADAS, GRÁFICO E RESULTADO
// ============================================================================

function situacaoHtml(situacao) {
    const s = getSituacaoCompetitiva(situacao);
    return `<span class="sit-badge ${s.classe}">${s.texto}</span>`;
}

function updateComputed(analise) {
    analise = analise || qfdDB.getAnaliseCompetitiva();

    analise.clientes.forEach(c => {
        const tr = document.querySelector(`#clientes-tbody tr[data-rc-id="${CSS.escape(c.requisito.id)}"]`);
        if (!tr) return;
        tr.querySelector('.c-indice').textContent = c.indiceMelhoria ? c.indiceMelhoria.toFixed(2) : '—';
        tr.querySelector('.c-prioridade').textContent = `${(c.prioridade * 100).toFixed(1)}%`;
        tr.querySelector('.c-situacao').innerHTML = situacaoHtml(c.situacao);
        if (c.melhor) {
            tr.querySelector('.c-situacao').title = `Melhor concorrente: ${c.melhor.produtos.join(', ')} (nota ${c.melhor.valor})`;
        }
    });

    analise.tecnicos.forEach(t => {
        const tr = document.querySelector(`#tecnicos-tbody tr[data-rp-id="${CSS.escape(t.requisito.id)}"]`);
        if (!tr) return;
        const melhor = tr.querySelector('.t-melhor');
        if (t.melhor) {
            melhor.textContent = `${formatarNumero(t.melhor.valor)} ${t.unidade}`.trim();
            const quem = document.createElement('small');
            quem.className = 'competitiva-quem';
            quem.textContent = t.melhor.produtos.join(', ');
            melhor.appendChild(quem);
        } else {
            melhor.textContent = t.requisito.sentidoMelhoria === 'none' ? 'nominal' : '—';
        }
        tr.querySelector('.t-situacao').innerHTML = situacaoHtml(t.situacao);
    });

    analise.indices.forEach(x => {
        const tr = document.querySelector(`#indices-tbody tr[data-indice-id="${CSS.escape(x.indice.id)}"]`);
        if (!tr) return;
        tr.querySelectorAll('.i-valor').forEach(td => { td.textContent = formatarIndice(x.valores[td.dataset.produtoId]); });
        const melhor = tr.querySelector('.i-melhor');
        if (x.melhor) {
            melhor.textContent = formatarIndice(x.melhor.valor);
            const quem = document.createElement('small');
            quem.className = 'competitiva-quem';
            quem.textContent = x.melhor.produtos.join(', ');
            melhor.appendChild(quem);
        } else {
            melhor.textContent = x.indice.sentido === 'none' ? 'só comparar' : '—';
        }
        tr.querySelector('.i-situacao').innerHTML = situacaoHtml(x.situacao);
    });

    document.getElementById('grafico-clientes').innerHTML = buildGraficoCompetitivo(analise) ||
        '<p class="competitiva-hint">O gráfico aparece quando houver notas.</p>';
    document.getElementById('resultado-competitiva').innerHTML = buildResultadoHtml(analise);
    updateStatus(analise);
}

function updateStatus(analise) {
    const atras = analise.clientes.filter(c => c.situacao === 'atras').length;
    document.getElementById('total-concorrentes').textContent = analise.concorrentes.length;
    document.getElementById('notas-preenchidas').textContent = `${analise.stats.percent}%`;
    document.getElementById('total-atras').textContent = atras;
    document.getElementById('total-inconsistencias').textContent = analise.inconsistencias.length;
    document.getElementById('progress-fill').style.width = `${analise.stats.percent}%`;
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

function exportAvaliacaoCSV() {
    const analise = qfdDB.getAnaliseCompetitiva();
    const nomes = analise.produtos.map(p => csvCell(p.nome)).join(',');
    let csv = `Avaliação dos clientes\nRC,Requisito,Peso,${nomes},Meta,Índice de melhoria,Prioridade,Situação\n`;
    analise.clientes.forEach(c => {
        csv += [
            `RC${c.numero}`, csvCell(c.requisito.descricao), (c.peso * 100).toFixed(1) + '%',
            ...analise.produtos.map(p => c.notas[p.id] || ''),
            c.meta || '', c.indiceMelhoria ? c.indiceMelhoria.toFixed(2) : '',
            (c.prioridade * 100).toFixed(1) + '%', getSituacaoCompetitiva(c.situacao).texto
        ].join(',') + '\n';
    });
    csv += `\nAvaliação técnica\nRP,Requisito,Sentido,Meta,Unidade,${nomes},Melhor concorrente,Situação da meta\n`;
    analise.tecnicos.forEach(t => {
        csv += [
            `RP${t.numero}`, csvCell(t.requisito.descricao), getSentidoLabel(t.requisito.sentidoMelhoria),
            csvCell(t.meta), csvCell(t.unidade),
            ...analise.produtos.map(p => csvCell(t.valores[p.id])),
            t.melhor ? csvCell(`${formatarNumero(t.melhor.valor)} (${t.melhor.produtos.join(', ')})`) : '',
            getSituacaoCompetitiva(t.situacao).texto
        ].join(',') + '\n';
    });
    if (analise.indices.length) {
        csv += `\nÍndices\nÍndice,Fórmula,Unidade,Sentido,${nomes},Melhor concorrente,Nosso × melhor\n`;
        analise.indices.forEach(x => {
            csv += [
                csvCell(x.indice.nome), csvCell(x.formula), csvCell(x.indice.unidade), getSentidoLabel(x.indice.sentido),
                ...analise.produtos.map(p => x.valores[p.id] === null ? '' : csvCell(formatarIndice(x.valores[p.id]))),
                x.melhor ? csvCell(`${formatarIndice(x.melhor.valor)} (${x.melhor.produtos.join(', ')})`) : '',
                getSituacaoCompetitiva(x.situacao).texto
            ].join(',') + '\n';
        });
    }
    downloadFile('﻿' + csv, 'avaliacao-competitiva.csv', 'text/csv;charset=utf-8');
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
