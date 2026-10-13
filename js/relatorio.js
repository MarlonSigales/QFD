/**
 * ============================================================================
 * RELATÓRIO PDF - GERAÇÃO DE DOCUMENTAÇÃO
 * ============================================================================
 */

let requisitosCliente = [];
let requisitosProjeto = [];
let reportConfig = {
    title: 'Análise QFD - Casa da Qualidade',
    company: '',
    author: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    // 'equipe': completo; 'apresentacao': sem comentários internos
    versao: 'equipe'
};

/** Versão para apresentação: sem textos explicativos, inconsistências, diagnóstico e análises */
function isApresentacao() {
    return reportConfig.versao === 'apresentacao';
}

/** Texto explicativo (comentário interno); vazio na versão de apresentação */
function obsInterna(texto) {
    return isApresentacao() ? '' : (texto || '');
}

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupReport();

    const dateInput = document.getElementById('report-date');
    if (dateInput) dateInput.value = reportConfig.date;

    setupEventListeners();
});

function loadData() {
    requisitosCliente = qfdDB.getRequisitosCliente();
    requisitosProjeto = qfdDB.getRequisitosProjeto();
    if (typeof qfdDB.calculateImportanciaProjeto === 'function') {
        qfdDB.calculateImportanciaProjeto();
        requisitosProjeto = qfdDB.getRequisitosProjeto();
    }
}

function setupReport() {
    const hasData = requisitosCliente.length > 0 && requisitosProjeto.length > 0;
    const insufficient = document.getElementById('insufficient-data');
    const config = document.getElementById('report-config');
    const sections = document.getElementById('report-sections');
    const preview = document.getElementById('report-preview');

    if (insufficient) insufficient.style.display = hasData ? 'none' : 'block';
    if (config) config.style.display = hasData ? 'block' : 'none';
    if (sections) sections.style.display = hasData ? 'block' : 'none';
    if (preview) preview.style.display = hasData ? 'block' : 'none';

    updateReportStatusBar(hasData);
    updateSectionCount();

    if (hasData) generatePreview();
}

function updateReportStatusBar(hasData) {
    const elCliente = document.getElementById('total-req-cliente');
    const elProjeto = document.getElementById('total-req-projeto');
    if (elCliente) elCliente.textContent = requisitosCliente.length;
    if (elProjeto) elProjeto.textContent = requisitosProjeto.length;

    const stats = qfdDB.getProjectStats();
    const completude = document.getElementById('completude-sistema');
    if (completude && hasData) {
        const parts = [];
        if (stats.requisitosCliente >= 2) {
            const totalComp = (stats.requisitosCliente * (stats.requisitosCliente - 1)) / 2;
            const pComp = totalComp > 0 ? Math.round((stats.comparacoesCliente / totalComp) * 100) : 0;
            parts.push(pComp);
        }
        if (stats.requisitosProjeto >= 2) {
            const totalCorr = (stats.requisitosProjeto * (stats.requisitosProjeto - 1)) / 2;
            const pCorr = totalCorr > 0 ? Math.round((stats.correlacoesProjeto / totalCorr) * 100) : 0;
            parts.push(pCorr);
        }
        const totalQfd = stats.requisitosCliente * stats.requisitosProjeto;
        const pQfd = totalQfd > 0 ? Math.round((stats.relacoesQFD / totalQfd) * 100) : 0;
        parts.push(pQfd);
        parts.push(stats.especificacoesPercent || 0);
        const media = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
        completude.textContent = `${media}%`;
    }

    const statusRel = document.getElementById('status-relatorio');
    if (statusRel) {
        statusRel.textContent = hasData ? 'Pronto' : 'Pendente';
    }
}

function setupEventListeners() {
    ['project-title', 'company-name', 'author-name', 'report-date', 'project-description'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateConfig);
    });
    document.querySelectorAll('input[name="report-version"]').forEach(r => r.addEventListener('change', updateConfig));

    document.querySelectorAll('.section-checkbox input').forEach(cb => {
        cb.addEventListener('change', () => {
            updateSectionCount();
            generatePreview();
        });
    });
}

function updateConfig() {
    reportConfig.title = document.getElementById('project-title')?.value || 'Análise QFD';
    reportConfig.company = document.getElementById('company-name')?.value || '';
    reportConfig.author = document.getElementById('author-name')?.value || '';
    reportConfig.date = document.getElementById('report-date')?.value || reportConfig.date;
    reportConfig.description = document.getElementById('project-description')?.value || '';
    reportConfig.versao = document.querySelector('input[name="report-version"]:checked')?.value || 'equipe';
    generatePreview();
}

function updateSectionCount() {
    const el = document.getElementById('section-count');
    if (!el) return;
    const n = document.querySelectorAll('.section-checkbox input:checked').length;
    el.textContent = `${n} seção${n !== 1 ? 'ões' : ''} selecionada${n !== 1 ? 's' : ''}`;
}

function isSectionChecked(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
}

function generatePreview() {
    const content = document.getElementById('report-content');
    if (!content) return;

    try {
        let html = `<div class="report-page">
            <div class="report-header">
                <h1>${escapeHtml(reportConfig.title)}</h1>
                ${reportConfig.company ? `<h2>${escapeHtml(reportConfig.company)}</h2>` : ''}
                <p><strong>Data:</strong> ${escapeHtml(reportConfig.date)} | <strong>Autor:</strong> ${escapeHtml(reportConfig.author)}</p>
                <p class="report-versao">${isApresentacao() ? 'Versão para apresentação' : 'Versão da equipe de projeto (contém comentários internos)'}</p>
            </div>`;

        if (isSectionChecked('section-dictionary')) html += safeSection('Dicionário', generateDictionary);
        if (isSectionChecked('section-summary')) html += safeSection('Resumo', generateSummary);
        if (isSectionChecked('section-client-req')) html += safeSection('Req. Cliente', generateClientReqs);
        if (isSectionChecked('section-project-req')) html += safeSection('Req. Projeto', generateProjectReqs);
        if (isSectionChecked('section-roof')) html += safeSection('Telhado', generateRoof);
        if (isSectionChecked('section-correlations')) html += safeSection('Correlações', generateCorrelationsAnalysis);
        if (isSectionChecked('section-qfd-matrix')) html += safeSection('Matriz QFD', generateMatrix);
        if (isSectionChecked('section-especificacoes')) html += safeSection('Especificações', generateEspecificacoes);
        if (isSectionChecked('section-competitiva')) html += safeSection('Avaliação Competitiva', generateAvaliacaoCompetitiva);
        if (isSectionChecked('section-atendimento')) html += safeSection('Atendimento aos Requisitos', generateAtendimento);
        if (isSectionChecked('section-ranking')) html += safeSection('Ranking', generateRankingSection);
        if (isSectionChecked('section-analysis') && !isApresentacao()) html += safeSection('Análises', generateAnalysisSection);
        if (isSectionChecked('section-comparisons')) html += safeSection('Comparações', generateComparisonsSection);

        html += '</div>';
        content.innerHTML = html;
    } catch (err) {
        console.error('Erro ao gerar preview:', err);
        content.innerHTML = `<div class="report-section"><p class="alert alert-danger">Erro ao gerar relatório: ${escapeHtml(err.message)}</p></div>`;
    }
}

function safeSection(name, fn) {
    try {
        return fn();
    } catch (err) {
        console.error(`Erro na seção ${name}:`, err);
        return `<div class="report-section"><h3>${escapeHtml(name)}</h3><p>Não foi possível carregar esta seção.</p></div>`;
    }
}

function generateDictionary() {
    let html = '<div class="report-section"><h3>Dicionário de Requisitos</h3>';
    html += '<p class="report-hint"><em>Passe o mouse sobre RC, RP e células no preview para ver descrições completas.</em></p>';
    html += '<h4>Requisitos de Cliente (RC)</h4><ul class="report-dict-list">';
    requisitosCliente.forEach((r, i) => {
        const obs = obsInterna(r.observacao) ? ` <em class="report-obs">— ${escapeHtml(r.observacao)}</em>` : '';
        html += `<li><strong>RC${i + 1}</strong> — ${escapeHtml(r.descricao)}${obs}</li>`;
    });
    html += '</ul><h4>Requisitos de Projeto (RP)</h4><ul class="report-dict-list">';
    requisitosProjeto.forEach((r, i) => {
        const obs = obsInterna(r.observacao) ? ` <em class="report-obs">— ${escapeHtml(r.observacao)}</em>` : '';
        html += `<li><strong>RP${i + 1}</strong> ${getSentidoSymbol(r.sentidoMelhoria)} — ${escapeHtml(r.descricao)}${obs}</li>`;
    });
    return html + '</ul></div>';
}

function generateSummary() {
    return `<div class="report-section"><h3>Resumo Executivo</h3><p>${escapeHtml(reportConfig.description || 'Sem descrição.')}</p></div>`;
}

function generateClientReqs() {
    let html = '<div class="report-section"><h3>Requisitos do Cliente</h3><table class="report-table"><thead><tr><th>ID</th><th>Descrição</th><th>Peso</th></tr></thead><tbody>';
    requisitosCliente.forEach((r, i) => {
        html += `<tr class="report-has-tip" data-tooltip="${escapeAttr(reqTip(`RC${i + 1}`, r))}">
            <td>RC${i + 1}</td>
            <td>${escapeHtml(r.descricao)}</td>
            <td>${((r.peso || 0) * 100).toFixed(1)}%</td>
        </tr>`;
    });
    return html + '</tbody></table></div>';
}

/** Texto do balão de um requisito: "RC1: descrição" + texto explicativo na linha seguinte */
function reqTip(label, req) {
    const obs = req && obsInterna(req.observacao) ? `\n${req.observacao}` : '';
    return `${label}: ${req ? req.descricao : ''}${obs}`;
}

function generateProjectReqs() {
    const ordenados = [...requisitosProjeto].sort((a, b) => (b.importanciaAbsoluta || 0) - (a.importanciaAbsoluta || 0));
    const total = ordenados.length;
    const t1 = Math.ceil(total / 3);
    const t2 = Math.ceil((2 * total) / 3);

    let html = `<div class="report-section">
        <h3>Requisitos de Projeto</h3>
        <div class="tercios-legend">
            <div class="tercio-item tercio-superior"><strong>Terço Superior:</strong> maior importância relativa (verde).</div>
            <div class="tercio-item tercio-medio"><strong>Terço Médio:</strong> importância intermediária (vermelho).</div>
            <div class="tercio-item tercio-inferior"><strong>Terço Inferior:</strong> menor importância relativa (laranja).</div>
        </div>
        <table class="report-table"><thead><tr><th>ID</th><th>Descrição</th><th>Sentido</th><th>Imp. Rel.</th><th>Terço</th></tr></thead><tbody>`;

    ordenados.forEach((r, i) => {
        let tercio = 'Inferior';
        let tercioClass = 'tercio-inferior';
        if (i < t1) { tercio = 'Superior'; tercioClass = 'tercio-superior'; }
        else if (i < t2) { tercio = 'Médio'; tercioClass = 'tercio-medio'; }

        const rpNum = requisitosProjeto.findIndex(x => x.id === r.id) + 1;
        const impRel = r.pesoRelativo != null ? (r.pesoRelativo * 100).toFixed(1) + '%' : '-';

        html += `<tr class="${tercioClass} report-has-tip" data-tooltip="${escapeAttr(reqTip(`RP${rpNum}`, r))}">
            <td>RP${rpNum}</td>
            <td>${escapeHtml(r.descricao)}</td>
            <td>${getSentidoSymbol(r.sentidoMelhoria)}</td>
            <td>${impRel}</td>
            <td><strong>${tercio}</strong></td>
        </tr>`;
    });
    return html + '</tbody></table></div>';
}

function generateRoof() {
    const correlacoes = qfdDB.getCorrelacoesProjeto();
    let html = '<div class="report-section"><h3>Telhado de Correlações</h3><table class="report-table roof-table"><thead><tr><th></th>';
    requisitosProjeto.forEach((rp, i) => {
        html += `<th class="report-has-tip" data-tooltip="${escapeAttr(reqTip(`RP${i + 1}`, rp))}">RP${i + 1} ${getSentidoSymbol(rp.sentidoMelhoria)}</th>`;
    });
    html += '</tr></thead><tbody>';

    for (let i = 0; i < requisitosProjeto.length; i++) {
        html += `<tr><th class="report-has-tip" data-tooltip="${escapeAttr(reqTip(`RP${i + 1}`, requisitosProjeto[i]))}">${i + 1}</th>`;
        for (let j = 0; j < requisitosProjeto.length; j++) {
            if (i === j) {
                html += '<td class="diagonal">—</td>';
            } else if (j < i) {
                html += '<td class="empty"></td>';
            } else {
                const corr = correlacoes.find(c =>
                    (c.requisito1 === requisitosProjeto[i].id && c.requisito2 === requisitosProjeto[j].id) ||
                    (c.requisito1 === requisitosProjeto[j].id && c.requisito2 === requisitosProjeto[i].id)
                );
                const val = corr ? corr.correlacao : '';
                html += `<td class="corr-cell report-has-tip" data-tooltip="${escapeAttr(`RP${i + 1} ↔ RP${j + 1}: ${val || 'sem correlação'}`)}">${val}</td>`;
            }
        }
        html += '</tr>';
    }
    return html + '</tbody></table></div>';
}

function generateCorrelationsAnalysis() {
    const correlacoes = qfdDB.getCorrelacoesProjeto();
    const counts = { '++': 0, '+': 0, '-': 0, '--': 0 };
    correlacoes.forEach(c => { if (counts[c.correlacao] !== undefined) counts[c.correlacao]++; });

    let html = '<div class="report-section"><h3>Análise de Correlações</h3>';
    html += `<p><strong>++</strong> ${counts['++']} | <strong>+</strong> ${counts['+']} | <strong>-</strong> ${counts['-']} | <strong>--</strong> ${counts['--']}</p>`;
    // Os pares individuais estão no telhado (seção Telhado) e na Matriz QFD
    return html + '</div>';
}

function generateMatrix() {
    let html = '<div class="report-section"><h3>Matriz QFD</h3><div class="qfd-matrix-report-wrapper"><table class="report-table qfd-matrix-report"><thead><tr><th class="qfd-corner-cell">RC \\ RP</th>';
    requisitosProjeto.forEach((rp, i) => {
        html += `<th class="qfd-rp-header report-has-tip" data-tooltip="${escapeAttr(reqTip(`RP${i + 1}`, rp))}"><span>RP${i + 1}</span></th>`;
    });
    html += '<th>Peso</th></tr></thead><tbody>';

    requisitosCliente.forEach((rc, idx) => {
        html += `<tr><td class="qfd-rc-label report-has-tip" data-tooltip="${escapeAttr(reqTip(`RC${idx + 1}`, rc))}">RC${idx + 1}</td>`;
        requisitosProjeto.forEach((rp, j) => {
            const val = qfdDB.getMatrizQFD(rc.id, rp.id);
            html += `<td class="qfd-cell report-has-tip" data-tooltip="${escapeAttr(`RC${idx + 1} × RP${j + 1}: influência ${val || 'não definida'}`)}">${val || ''}</td>`;
        });
        html += `<td>${((rc.peso || 0) * 100).toFixed(1)}%</td></tr>`;
    });
    html += '</tbody><tfoot>';
    html += '<tr class="qfd-sum-row qfd-sum-total"><th>Soma</th>'
        + requisitosProjeto.map(rp => `<td>${(rp.importanciaAbsoluta || 0).toFixed(1)}</td>`).join('') + '<td></td></tr>';
    html += '<tr class="qfd-sum-row qfd-sum-percent"><th>%</th>'
        + requisitosProjeto.map(rp => `<td>${((rp.pesoRelativo || 0) * 100).toFixed(1)}%</td>`).join('') + '<td></td></tr>';
    html += '<tr class="qfd-sum-row qfd-sum-rank"><th>Ranking</th>'
        + requisitosProjeto.map(rp => `<td>${rp.importanciaAbsoluta > 0 ? `${rp.importanciaRelativa}º` : '-'}</td>`).join('') + '<td></td></tr>';
    return html + '</tfoot></table></div></div>';
}

function generateEspecificacoes() {
    let lista;
    try {
        lista = qfdDB.getEspecificacoesOrdenadas();
    } catch (e) {
        return '<div class="report-section"><h3>Especificações de Projeto</h3><p>Dados de especificações indisponíveis.</p></div>';
    }

    if (!lista.length) {
        return '<div class="report-section"><h3>Especificações de Projeto</h3><p>Nenhum requisito de projeto cadastrado.</p></div>';
    }

    const total = lista.length;
    const t1 = Math.ceil(total / 3);
    const t2 = Math.ceil((2 * total) / 3);

    let html = '<div class="report-section"><h3>Especificações dos Requisitos de Projeto</h3>';
    html += '<p class="report-hint">Ordenados pela hierarquia do QFD.</p>';
    html += '<table class="report-table especificacoes-report-table"><thead><tr>';
    html += '<th>#</th><th>Requisito</th><th>Unidade</th><th>Meta</th><th>Aspectos indesejáveis</th></tr></thead><tbody>';

    lista.forEach((row, index) => {
        let tercioClass = 'tercio-inferior';
        if (index < t1) tercioClass = 'tercio-superior';
        else if (index < t2) tercioClass = 'tercio-medio';

        const aspectos = row.aspectosIndesejaveis || '—';
        let tip = reqTip(`RP${row.numeroOriginal}`, row.requisito);
        if (obsInterna(row.observacao)) tip += `\nEspecificação: ${row.observacao}`;
        const specObs = obsInterna(row.observacao) ? `<br><em class="report-obs">${escapeHtml(row.observacao)}</em>` : '';

        html += `<tr class="${tercioClass} report-has-tip" data-tooltip="${escapeAttr(tip)}">
            <td>${row.rank}</td>
            <td><strong>RP${row.numeroOriginal}</strong> — ${escapeHtml(row.requisito.descricao)}${specObs}</td>
            <td>${escapeHtml(row.unidadeMedida || '—')}</td>
            <td>${row.metaFormatada ? escapeHtml(row.metaFormatada) : (row.revisarMeta ? `<em>revisar: ${escapeHtml(row.metaTexto)}</em>` : '—')}</td>
            <td class="spec-aspectos-cell">${escapeHtml(aspectos).replace(/\n/g, '<br>')}</td>
        </tr>`;
    });

    return html + '</tbody></table></div>';
}

function generateAvaliacaoCompetitiva() {
    const analise = qfdDB.getAnaliseCompetitiva();
    let html = '<div class="report-section report-competitiva"><h3>Avaliação Competitiva</h3>';
    if (!analise.concorrentes.length) {
        return html + '<p>Nenhum concorrente cadastrado na avaliação competitiva.</p></div>';
    }

    const corDe = i => CORES_PRODUTOS[i % CORES_PRODUTOS.length];
    // Códigos curtos nas colunas (Nosso, C1…Cn) para a tabela caber na página;
    // os nomes completos ficam no quadro "Produtos comparados"
    let nConc = 0;
    const codigos = analise.produtos.map(p => p.tipo === 'nosso' ? 'Nosso' : `C${++nConc}`);
    const codigoPorNome = nome => codigos[analise.produtos.findIndex(p => p.nome === nome)] || nome;
    const cabecalhoProdutos = analise.produtos
        .map((p, i) => `<th class="produto-col" title="${escapeAttr(p.nome)}"><span class="produto-cor" style="background:${corDe(i)}"></span> ${codigos[i]}</th>`).join('');
    const glossario = '<table class="report-table competitiva-glossario"><thead><tr><th>Código</th><th>Produto</th></tr></thead><tbody>'
        + analise.produtos.map((p, i) => `<tr><td><span class="produto-cor" style="background:${corDe(i)}"></span> <strong>${codigos[i]}</strong></td><td>${escapeHtml(p.nome)}</td></tr>`).join('')
        + '</tbody></table>';
    const situacao = s => {
        const info = getSituacaoCompetitiva(s);
        return `<span class="sit-badge ${info.classe}">${info.texto}</span>`;
    };

    html += `<p class="report-hint">Comparação do produto com ${analise.concorrentes.length} concorrente(s). `
        + `Notas dos clientes preenchidas: ${analise.stats.notasPreenchidas} de ${analise.stats.notasTotal} (${analise.stats.percent}%).</p>`;
    html += '<h4>Produtos comparados</h4>' + glossario;

    html += '<h4>Avaliação dos clientes (1 = pior, 5 = melhor)</h4>';
    html += '<p class="report-hint">Índice de melhoria = meta ÷ nossa nota. Prioridade = peso × índice de melhoria, normalizada.</p>';
    html += `<table class="report-table competitiva-table"><thead><tr><th>RC</th><th>Requisito de cliente</th><th>Peso</th>${cabecalhoProdutos}<th>Meta</th><th>Índice de melhoria</th><th>Prioridade</th><th>Situação</th></tr></thead><tbody>`;
    [...analise.clientes].sort((a, b) => (b.peso - a.peso) || (a.numero - b.numero)).forEach(c => {
        html += `<tr class="report-has-tip" data-tooltip="${escapeAttr(reqTip(`RC${c.numero}`, c.requisito))}">
            <td><strong>RC${c.numero}</strong></td>
            <td class="competitiva-desc">${escapeHtml(c.requisito.descricao)}</td>
            <td>${(c.peso * 100).toFixed(1)}%</td>
            ${analise.produtos.map(p => `<td>${c.notas[p.id] || '—'}</td>`).join('')}
            <td>${c.meta || '—'}</td>
            <td>${c.indiceMelhoria ? c.indiceMelhoria.toFixed(2) : '—'}</td>
            <td>${(c.prioridade * 100).toFixed(1)}%</td>
            <td>${situacao(c.situacao)}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    html += buildGraficoCompetitivo(analise);

    if (analise.tecnicos.length) {
        html += '<h4>Avaliação técnica</h4>';
        html += '<p class="report-hint">Requisitos de projeto na ordem do QFD. Melhor concorrente: maior valor para ↑, menor para ↓ (nominais * não são comparados).</p>';
        html += `<table class="report-table competitiva-table"><thead><tr><th>#</th><th>Requisito de projeto</th><th>Sentido</th><th>Meta</th>${cabecalhoProdutos}<th>Melhor concorrente</th><th>Meta × melhor concorrente</th></tr></thead><tbody>`;
        analise.tecnicos.forEach(t => {
            const melhor = t.melhor
                ? `${escapeHtml(`${formatarNumero(t.melhor.valor)} ${t.unidade}`.trim())}<small class="competitiva-quem">${escapeHtml(t.melhor.produtos.map(codigoPorNome).join(', '))}</small>`
                : (t.requisito.sentidoMelhoria === 'none' ? 'nominal' : '—');
            html += `<tr class="report-has-tip" data-tooltip="${escapeAttr(reqTip(`RP${t.numero}`, t.requisito))}">
                <td>${t.rank}</td>
                <td class="competitiva-desc"><strong>RP${t.numero}</strong> — ${escapeHtml(t.requisito.descricao)}</td>
                <td>${getSentidoSymbol(t.requisito.sentidoMelhoria)}</td>
                <td>${escapeHtml(t.meta ? `${t.meta} ${t.unidade}`.trim() : '—')}</td>
                ${analise.produtos.map(p => `<td>${escapeHtml(t.valores[p.id] || '—')}</td>`).join('')}
                <td>${melhor}</td>
                <td>${situacao(t.situacao)}</td>
            </tr>`;
        });
        html += '</tbody></table>';
    }

    html += '<h4>Resultado da comparação</h4>';
    html += `<div class="competitiva-resultado">${buildResultadoHtml(analise, { inconsistencias: !isApresentacao() })}</div>`;
    return html + '</div>';
}

function generateAtendimento() {
    const analise = qfdDB.getAnaliseAtendimento();
    const s = analise.stats;
    let html = '<div class="report-section report-atendimento"><h3>Atendimento aos Requisitos de Cliente</h3>';

    const geral = analise.atendimentoGeral === null
        ? 'não calculado (faltam metas nas Especificações ou valores medidos do nosso produto)'
        : `<strong>${Math.round(analise.atendimentoGeral * 100)}%</strong> (ponderado pelo peso dos requisitos de cliente)`;
    html += `<ul class="report-dict-list">
        <li>Atendimento geral: ${geral}.</li>
        <li>Requisitos de cliente com relação forte (9) na matriz: ${s.coberturaForte} de ${s.requisitosCliente}; sem nenhuma relação: ${analise.diagnostico.semRelacao.length}.</li>
        <li>Metas de projeto atingidas: ${s.metasAtingidas} de ${s.metasAvaliadas} medidas (${s.semMedicao} sem medição, ${s.semMeta} sem meta).</li>
    </ul>`;
    html += '<p class="report-hint">Atendimento de um requisito de cliente = parcela da influência (9, 3, 1) dos requisitos de projeto relacionados cujas metas foram atingidas. Meta atingida: ↑ medido ≥ meta; ↓ medido ≤ meta; * dentro de ±5%.</p>';

    html += '<h4>Metas de projeto × valor medido</h4>';
    html += '<table class="report-table atendimento-table"><thead><tr><th>#</th><th>Requisito de projeto</th><th>Sentido</th><th>Meta</th><th>Medido</th><th>Meta</th><th>Relações</th></tr></thead><tbody>';
    analise.projetos.forEach(p => {
        html += `<tr class="report-has-tip" data-tooltip="${escapeAttr(reqTip(`RP${p.numero}`, p.requisito))}">
            <td>${p.rank}</td>
            <td class="competitiva-desc"><strong>RP${p.numero}</strong> — ${escapeHtml(p.requisito.descricao)}</td>
            <td>${getSentidoSymbol(p.requisito.sentidoMelhoria)}</td>
            <td>${escapeHtml(p.meta ? `${p.meta} ${p.unidade}`.trim() : '—')}</td>
            <td>${escapeHtml(p.medido || '—')}</td>
            <td>${badgeHtml(getEstadoMeta(p.estado))}</td>
            <td>${p.relacoes}</td>
        </tr>`;
    });
    html += '</tbody></table>';

    html += '<h4>Atendimento por requisito de cliente</h4>';
    html += buildTabelaAtendimentoClientes(analise,
        (req, rotulo) => ` class="report-has-tip" data-tooltip="${escapeAttr(reqTip(rotulo, req))}"`);

    if (!isApresentacao()) {
        html += '<h4>Diagnóstico</h4>';
        html += `<div class="competitiva-resultado">${buildDiagnosticoAtendimentoHtml(analise)}</div>`;
    }
    return html + '</div>';
}

function generateRankingSection() {
    const clientes = [...requisitosCliente].sort((a, b) => (b.importancia || 0) - (a.importancia || 0));
    const projetos = [...requisitosProjeto].sort((a, b) => (b.importanciaAbsoluta || 0) - (a.importanciaAbsoluta || 0));

    let html = '<div class="report-section"><h3>Ranking de Prioridades</h3>';
    html += '<h4>Requisitos de Cliente</h4><ol>';
    clientes.forEach(r => {
        const i = requisitosCliente.findIndex(x => x.id === r.id) + 1;
        html += `<li>RC${i}: ${escapeHtml(r.descricao)} — ${r.importancia || 0} pts</li>`;
    });
    // Posição explícita (não <ol>) para que empates apareçam na mesma posição
    html += '</ol><h4>Requisitos de Projeto (QFD)</h4><ul class="report-rank-list">';
    projetos.forEach(r => {
        const i = requisitosProjeto.findIndex(x => x.id === r.id) + 1;
        const pct = r.pesoRelativo != null ? (r.pesoRelativo * 100).toFixed(1) + '%' : '-';
        const pos = r.importanciaAbsoluta > 0 ? `${r.importanciaRelativa}º` : '-';
        html += `<li><strong>${pos}</strong> RP${i}: ${escapeHtml(r.descricao)} — ${(r.importanciaAbsoluta || 0).toFixed(1)} (${pct})</li>`;
    });
    return html + '</ul></div>';
}

function generateAnalysisSection() {
    const stats = qfdDB.getProjectStats();
    return `<div class="report-section"><h3>Análises e Insights</h3>
        <ul class="report-dict-list">
            <li>${stats.requisitosCliente} requisitos de cliente; ${stats.requisitosProjeto} de projeto.</li>
            <li>Comparações cliente: ${stats.comparacoesCliente} realizadas.</li>
            <li>Correlações de projeto: ${stats.correlacoesProjeto} definidas.</li>
            <li>Relações na matriz QFD: ${stats.relacoesQFD}.</li>
            <li>Especificações preenchidas: ${stats.especificacoesCompletas || 0} de ${stats.especificacoesTotal || 0} (${stats.especificacoesPercent || 0}%).</li>
        </ul></div>`;
}

function generateComparisonsSection() {
    const comparacoes = qfdDB.getComparacoesCliente();
    if (!comparacoes.length) return '';

    let html = '<div class="report-section"><h3>Comparações de Requisitos de Cliente</h3>';
    html += '<table class="report-table"><thead><tr><th>Par</th><th>Vencedor</th><th>Importância</th><th>Detalhe</th></tr></thead><tbody>';

    comparacoes.forEach(c => {
        const req1 = requisitosCliente.find(r => r.id === c.requisito1);
        const req2 = requisitosCliente.find(r => r.id === c.requisito2);
        if (!req1 || !req2) return;

        const i1 = requisitosCliente.indexOf(req1) + 1;
        const i2 = requisitosCliente.indexOf(req2) + 1;

        html += `<tr class="report-has-tip" data-tooltip="${escapeAttr(`RC${i1} vs RC${i2}: importância ${c.valor}`)}">
            <td>RC${i1} vs RC${i2}</td>
            <td>RC${i1}</td>
            <td>${c.valor}</td>
            <td>${escapeHtml(truncateText(req1.descricao, 40))} / ${escapeHtml(truncateText(req2.descricao, 40))}</td>
        </tr>`;
    });

    return html + '</tbody></table></div>';
}

function printReport() {
    window.print();
}

function refreshPreview() {
    loadData();
    setupReport();
}

function clearHistory() {
    const list = document.getElementById('history-list');
    if (list) list.innerHTML = '<p>Nenhum histórico salvo.</p>';
}

async function generatePDF() {
    const reportElement = document.getElementById('report-content');
    if (!reportElement) return;

    if (!window.jspdf || !window.html2canvas) {
        alert('Bibliotecas de PDF não carregadas. Recarregue a página e tente novamente.');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const canvas = await window.html2canvas(reportElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20; // 2 cm em todos os lados
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;

        // Recorta o canvas em fatias da altura útil da página, para que o
        // conteúdo não invada as margens superior e inferior das páginas seguintes
        const sliceHeightPx = Math.floor(usableHeight * canvas.width / usableWidth);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        const ctx = slice.getContext('2d');

        for (let y = 0; y < canvas.height; y += sliceHeightPx) {
            const h = Math.min(sliceHeightPx, canvas.height - y);
            slice.height = h;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, slice.width, h);
            ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            if (y > 0) pdf.addPage();
            pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, usableWidth, (h * usableWidth) / canvas.width);
        }

        const safeTitle = (reportConfig.title || 'relatorio-qfd').replace(/[^\w\-]+/g, '_')
            + (isApresentacao() ? '-apresentacao' : '');
        pdf.save(`${safeTitle}.pdf`);
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
}
