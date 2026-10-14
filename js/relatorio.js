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
    const nomeProjeto = qfdDB.getProjeto().nome;
    if (nomeProjeto) {
        reportConfig.title = nomeProjeto;
        const titulo = document.getElementById('project-title');
        if (titulo) titulo.value = nomeProjeto;
    }
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
        const comCapa = isSectionChecked('section-capa');
        let html = '<div class="report-page">' + (comCapa ? generateCapa() : `
            <div class="report-header">
                <h1>${escapeHtml(reportConfig.title)}</h1>
                ${reportConfig.company ? `<h2>${escapeHtml(reportConfig.company)}</h2>` : ''}
                <p><strong>Data:</strong> ${escapeHtml(reportConfig.date)} | <strong>Autor:</strong> ${escapeHtml(reportConfig.author)}</p>
                <p class="report-versao">${isApresentacao() ? 'Versão para apresentação' : 'Versão da equipe de projeto (contém comentários internos)'}</p>
            </div>`);
        if (comCapa) html += '<div class="report-section report-sumario"><h3>Sumário</h3><ol id="report-sumario-lista"></ol></div>';

        if (isSectionChecked('section-dictionary')) html += safeSection('Dicionário', generateDictionary);
        if (isSectionChecked('section-summary')) html += safeSection('Resumo', generateSummary);
        if (isSectionChecked('section-referencias')) html += safeSection('Estado da técnica', generateReferencias);
        if (isSectionChecked('section-client-req')) html += safeSection('Req. Cliente', generateClientReqs);
        if (isSectionChecked('section-project-req')) html += safeSection('Req. Projeto', generateProjectReqs);
        if (isSectionChecked('section-fora-qfd')) html += safeSection('Fora do QFD', generateForaQFD);
        if (isSectionChecked('section-project-req')) html += safeSection('Verificação da lista', generateVerificacao);
        if (isSectionChecked('section-roof')) html += safeSection('Telhado', generateRoof);
        if (isSectionChecked('section-correlations')) html += safeSection('Correlações', generateCorrelationsAnalysis);
        if (isSectionChecked('section-qfd-matrix')) html += safeSection('Matriz QFD', generateMatrix);
        if (isSectionChecked('section-especificacoes')) html += safeSection('Especificações', generateEspecificacoes);
        if (isSectionChecked('section-competitiva')) html += safeSection('Avaliação Competitiva', generateAvaliacaoCompetitiva);
        if (isSectionChecked('section-atendimento')) html += safeSection('Atendimento aos Requisitos', generateAtendimento);
        if (isSectionChecked('section-ranking')) html += safeSection('Ranking', generateRankingSection);
        if (isSectionChecked('section-analysis') && !isApresentacao()) html += safeSection('Análises', generateAnalysisSection);
        if (isSectionChecked('section-comparisons')) html += safeSection('Comparações', generateComparisonsSection);
        if (isSectionChecked('section-fechamento')) html += safeSection('Fechamento', generateFechamento);
        if (isSectionChecked('section-ideias')) html += safeSection('Anexo: ideias e falhas', generateAnexoIdeias);

        html += '</div>';
        content.innerHTML = html;
        if (comCapa) montarCapaESumario(content);
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

/**
 * Requisitos marcados como formadores de função ou de boa prática de
 * projeto: ficam fora do QFD e aparecem aqui, com a justificativa
 */
function generateForaQFD() {
    const fora = [
        ...qfdDB.getRequisitosCliente({ todos: true }).filter(r => !estaNoQFD(r)).map(r => ({ ...r, origem: 'Cliente' })),
        ...qfdDB.getRequisitosProjeto({ todos: true }).filter(r => !estaNoQFD(r)).map(r => ({ ...r, origem: 'Projeto' }))
    ];
    if (!fora.length) return '';

    let html = '<div class="report-section report-fora-qfd"><h3>Requisitos fora do QFD</h3>';
    html += '<p class="report-hint">Requisitos que formam uma função do produto ou registram uma boa prática de projeto (intenção). Não entram na comparação, no telhado, na matriz nem nas especificações.</p>';
    Object.entries(CLASSIFICACOES_REQUISITO).forEach(([tipo, titulo]) => {
        const lista = fora.filter(r => r.classificacao === tipo);
        if (!lista.length) return;
        html += `<h4>${titulo} (${lista.length})</h4>`;
        html += '<table class="report-table"><thead><tr><th>Origem</th><th>Requisito</th><th>Justificativa</th></tr></thead><tbody>';
        lista.forEach(r => {
            html += `<tr><td>${r.origem}</td><td>${escapeHtml(r.descricao)}</td><td>${escapeHtml(r.justificativaClassificacao || '—')}</td></tr>`;
        });
        html += '</tbody></table>';
    });
    return html + '</div>';
}

/** Verificação da lista de requisitos de projeto (Roozenburg & Eekels, 1995) e descartados */
function generateVerificacao() {
    const v = qfdDB.getVerificacao();
    const marcados = Object.keys(CRITERIOS_VERIFICACAO).filter(c => v.criterios[c]);
    if (!marcados.length && !v.descartados.length) return '';
    let html = '<div class="report-section report-verificacao"><h3>Verificação da lista de requisitos de projeto</h3>';
    html += `<p class="report-hint">Critérios de Roozenburg &amp; Eekels (1995). ${v.atualizada
        ? `Verificação confirmada em ${escapeHtml(formatDate(v.confirmadoEm))}.`
        : (v.confirmada ? 'A lista foi alterada depois da verificação.' : 'Verificação não confirmada.')}</p>`;
    html += '<ul class="report-verificacao-criterios">' + Object.entries(CRITERIOS_VERIFICACAO)
        .map(([k, c]) => `<li>${v.criterios[k] ? '✓' : '✗'} <strong>${c.nome}</strong> — ${c.dica}</li>`).join('') + '</ul>';
    if (v.descartados.length) {
        html += `<h4>Requisitos descartados (${v.descartados.length})</h4><table class="report-table"><thead><tr><th>Requisito</th><th>Motivo</th></tr></thead><tbody>`;
        v.descartados.forEach(d => { html += `<tr><td>${escapeHtml(d.descricao)}</td><td>${escapeHtml(d.motivo)}</td></tr>`; });
        html += '</tbody></table>';
    }
    return html + '</div>';
}

/** Formulação do problema e função global (P15): abstração, formulações e caixa-preta */
function generateFechamento() {
    const f = qfdDB.getFechamento();
    const final = qfdDB.getFormulacaoFinal();
    const fg = f.funcaoGlobal;
    const temFluxos = ['entradas', 'saidas'].some(l => Object.values(fg[l]).some(x => x.length));
    if (!final && !f.abstracao.some(Boolean) && !f.formulacoes.length && !fg.nome && !temFluxos) return '';

    const passos = ['Eliminar as preferências pessoais', 'Omitir o que não tem relação direta com a função e as restrições essenciais',
        'Transformar dados quantitativos em qualitativos', 'Generalizar', 'Formular o problema de forma neutra'];
    let html = '<div class="report-section report-fechamento"><h3>Formulação do problema e função global</h3>';
    if (final) html += `<div class="report-formulacao-final"><strong>Formulação do problema:</strong> ${escapeHtml(final)}</div>`;
    if (f.abstracao.some(Boolean)) {
        html += '<h4>Abstração da lista de requisitos</h4><table class="report-table"><thead><tr><th>Passo</th><th>Resultado</th></tr></thead><tbody>';
        f.abstracao.forEach((t, i) => {
            if (t) html += `<tr><td>${i + 1}. ${passos[i]}</td><td>${escapeHtml(t).replace(/\n/g, '<br>')}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    if (f.formulacoes.length) {
        html += '<h4>Ampliação da formulação do problema</h4><ol class="report-formulacoes">';
        f.formulacoes.forEach(x => {
            html += x.id === f.formulacaoEscolhida
                ? `<li><strong>${escapeHtml(x.texto)}</strong> <small>(adotada)</small></li>`
                : `<li>${escapeHtml(x.texto)}</li>`;
        });
        html += '</ol>';
    }
    if (fg.nome || temFluxos) {
        html += `<h4>Função global</h4><div class="report-caixa-preta">${svgCaixaPreta(fg)}${htmlLegendaFluxos()}</div>`;
    }
    return html + '</div>';
}

/** Rótulo RCn/RPn de uma ligação { tipo, id } com requisito */
function rotuloLigacao(ref) {
    const lista = ref.tipo === 'cliente' ? requisitosCliente : requisitosProjeto;
    const i = lista.findIndex(r => r.id === ref.id);
    return i === -1 ? (ref.tipo === 'cliente' ? 'RC (fora do QFD)' : 'RP (fora do QFD)') : `${ref.tipo === 'cliente' ? 'RC' : 'RP'}${i + 1}`;
}

/** Estado da técnica e referências (P13), com os requisitos que cada uma originou */
function generateReferencias() {
    const refs = qfdDB.getReferencias();
    if (!refs.length) return '';
    let html = '<div class="report-section report-referencias"><h3>Estado da técnica e referências</h3>';
    html += '<table class="report-table"><thead><tr><th>Tipo</th><th>Referência</th><th>Consulta</th><th>Requisitos ligados</th></tr></thead><tbody>';
    refs.forEach(r => {
        const link = r.link ? `<br><small class="report-link">${escapeHtml(r.link)}</small>` : '';
        html += `<tr>
            <td>${TIPOS_REFERENCIA[r.tipo] || ''}</td>
            <td><strong>${escapeHtml(rotuloReferencia(r))}</strong>${r.resumo ? `<br><small>${escapeHtml(r.resumo)}</small>` : ''}${link}</td>
            <td>${r.dataConsulta ? escapeHtml(dataPorExtenso(r.dataConsulta)) : '—'}</td>
            <td>${r.requisitos.map(rotuloLigacao).join(', ') || '—'}</td>
        </tr>`;
    });
    return html + '</tbody></table></div>';
}

/** Anexo com o Caderno de Ideias: ideias de solução e falhas analisadas */
function generateAnexoIdeias() {
    const ideias = qfdDB.getIdeias(), falhas = qfdDB.getFalhas();
    if (!ideias.length && !falhas.length) return '';
    const rotulo = rotuloLigacao;
    let html = '<div class="report-section report-ideias"><h3>Anexo: Caderno de Ideias</h3>';
    if (ideias.length) {
        html += '<h4>Ideias de solução registradas</h4>';
        html += '<table class="report-table"><thead><tr><th>Ideia</th><th>Status</th><th>Requisitos</th><th>Autor / data</th></tr></thead><tbody>';
        ideias.forEach(i => {
            html += `<tr>
                <td><strong>${escapeHtml(i.titulo)}</strong>${i.descricao ? `<br><small>${escapeHtml(i.descricao)}</small>` : ''}</td>
                <td>${STATUS_IDEIA[i.status] || ''}</td>
                <td>${i.requisitos.map(rotulo).join(', ') || '—'}</td>
                <td>${escapeHtml(i.autor || '—')}<br><small>${formatDate(i.data)}</small></td>
            </tr>`;
        });
        html += '</tbody></table>';
    }
    if (falhas.length) {
        html += '<h4>Falhas analisadas</h4>';
        html += '<table class="report-table"><thead><tr><th>Falha</th><th>Produto</th><th>Causa</th><th>Requisito gerado</th></tr></thead><tbody>';
        falhas.forEach(f => {
            html += `<tr>
                <td>${escapeHtml(f.falha)}</td>
                <td>${escapeHtml(f.produto || '—')}</td>
                <td>${escapeHtml(f.causa || '—')}</td>
                <td>${f.requisitoGerado ? rotulo(f.requisitoGerado) : '—'}</td>
            </tr>`;
        });
        html += '</tbody></table>';
    }
    return html + '</div>';
}

/** Data do relatório (aaaa-mm-dd) no formato dd/mm/aaaa */
function dataPorExtenso(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

/** Capa de página inteira: logos, título, cliente, instituição, equipe, data e versão */
function generateCapa() {
    const p = qfdDB.getProjeto();
    const instituicao = p.instituicao || reportConfig.company;
    const linha = (rotulo, valor) => valor ? `<p><span>${rotulo}</span> ${escapeHtml(valor)}</p>` : '';
    return `<div class="report-capa">
        <div class="capa-logos">
            <img src="../img/logo-inovaagro.png" alt="EMBRAPII - Inova Agro">
            <img src="../img/logo-nimeq.png" alt="NIMEq">
            <img src="../img/logo-instagri.png" alt="Lab InstAgri">
        </div>
        <div class="capa-centro">
            <p class="capa-tipo">Relatório de QFD — Casa da Qualidade</p>
            <h1>${escapeHtml(reportConfig.title)}</h1>
            ${linha('Cliente:', p.cliente)}
            ${linha('Instituição:', instituicao)}
            ${linha('Responsável:', reportConfig.author)}
        </div>
        ${p.equipe.length ? `<div class="capa-equipe"><p class="capa-rotulo">Equipe</p><ul>${p.equipe.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>` : ''}
        <div class="capa-rodape">
            <p>${escapeHtml(dataPorExtenso(reportConfig.date))}</p>
            <p class="report-versao">${isApresentacao() ? 'Versão para apresentação' : 'Versão da equipe de projeto (contém comentários internos)'}</p>
        </div>
    </div>`;
}

/**
 * Numera as seções (1., 2., ...) e preenche o sumário. A capa recebe a altura
 * de uma página útil A4 (170 x 257 mm) na largura da prévia, para ocupar
 * exatamente a 1ª página do PDF.
 */
function montarCapaESumario(content) {
    const lista = content.querySelector('#report-sumario-lista');
    let n = 0;
    content.querySelectorAll('.report-section:not(.report-sumario) > h3').forEach(h3 => {
        n++;
        const titulo = h3.textContent.trim();
        h3.insertAdjacentHTML('afterbegin', `<span class="secao-num">${n}.</span> `);
        if (lista) lista.insertAdjacentHTML('beforeend', `<li><span></span></li>`);
        if (lista) lista.lastElementChild.firstElementChild.textContent = titulo;
    });
    const capa = content.querySelector('.report-capa');
    if (capa && capa.offsetWidth > 0) capa.style.minHeight = `${Math.floor(capa.offsetWidth * 257 / 170)}px`;
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

    // Hierarquização em terços em quadros separados (Fonseca, 2000; Quadros 5 a 7
    // de Spagnolo, 2011). A posição "com telhado" entra quando a fórmula for definida.
    const tercos = [
        { nome: 'Superior', classe: 'tercio-superior', desc: 'maior importância relativa', itens: [] },
        { nome: 'Médio', classe: 'tercio-medio', desc: 'importância intermediária', itens: [] },
        { nome: 'Inferior', classe: 'tercio-inferior', desc: 'menor importância relativa', itens: [] }
    ];
    let html = `<div class="report-section report-tercos">
        <h3>Requisitos de Projeto</h3>
        <p class="report-hint">Hierarquização pela Matriz QFD (sem telhado), dividida em terços.</p>`;
    const criticos = [];

    ordenados.forEach((r, i) => {
        const terco = tercos[i < t1 ? 0 : (i < t2 ? 1 : 2)];
        const rpNum = requisitosProjeto.findIndex(x => x.id === r.id) + 1;
        const impRel = r.pesoRelativo != null ? (r.pesoRelativo * 100).toFixed(1) + '%' : '-';

        terco.itens.push(`<tr class="${terco.classe} report-has-tip" data-tooltip="${escapeAttr(reqTip(`RP${rpNum}`, r))}">
            <td>${i + 1}º</td>
            <td>RP${rpNum}</td>
            <td>${escapeHtml(r.descricao)}</td>
            <td>${getSentidoSymbol(r.sentidoMelhoria)}</td>
            <td>${impRel}</td>
            <td>${seloDificuldade(r.dificuldadeTecnica)}</td>
        </tr>`);
        if (ehRequisitoCritico(i, total, r.dificuldadeTecnica)) criticos.push({ r, rpNum, impRel });
    });

    tercos.filter(t => t.itens.length).forEach(t => {
        html += `<div class="report-terco ${t.classe}"><h4>Terço ${t.nome.toLowerCase()} <small>— ${t.desc}</small></h4>
            <table class="report-table"><thead><tr><th>Posição</th><th>ID</th><th>Requisito</th><th>Sentido</th><th>Imp. Rel.</th><th title="Dificuldade técnica (1 = muito fácil, 5 = muito difícil)">Dif.</th></tr></thead>
            <tbody>${t.itens.join('')}</tbody></table></div>`;
    });

    const justificativa = qfdDB.getProjeto().justificativaHierarquia;
    if (justificativa) {
        html += `<div class="report-justificativa"><h4>Justificativa da hierarquização</h4><p>${escapeHtml(justificativa).replace(/\n/g, '<br>')}</p></div>`;
    }

    // Requisitos críticos (P16): terço superior + dificuldade técnica >= 4
    html += '<div class="report-criticos"><h4><i class="fas fa-triangle-exclamation"></i> Requisitos críticos (importantes e difíceis)</h4>';
    html += criticos.length
        ? '<ul>' + criticos.map(c => `<li><strong>RP${c.rpNum}</strong> — ${escapeHtml(c.r.descricao)} <small>(imp. rel. ${c.impRel}; dificuldade ${c.r.dificuldadeTecnica} — ${rotuloDificuldade(c.r.dificuldadeTecnica).toLowerCase()})</small></li>`).join('') + '</ul>'
        : '<p>Nenhum requisito do terço superior tem dificuldade técnica 4 ou 5.</p>';
    return html + '</div></div>';
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
    const classes = qfdDB.getProjeto().escalaValorCliente === 'classes';
    html += `<th>${classes ? 'Valor (1–10)' : 'Pontuação'}</th><th>Peso</th></tr></thead><tbody>`;

    requisitosCliente.forEach((rc, idx) => {
        html += `<tr><td class="qfd-rc-label report-has-tip" data-tooltip="${escapeAttr(reqTip(`RC${idx + 1}`, rc))}">RC${idx + 1}</td>`;
        requisitosProjeto.forEach((rp, j) => {
            const val = qfdDB.getMatrizQFD(rc.id, rp.id);
            html += `<td class="qfd-cell report-has-tip" data-tooltip="${escapeAttr(`RC${idx + 1} × RP${j + 1}: influência ${val || 'não definida'}`)}">${val || ''}</td>`;
        });
        html += `<td>${classes ? (rc.classe || 0) : (rc.importancia || 0)}</td><td>${((rc.peso || 0) * 100).toFixed(1)}%</td></tr>`;
    });
    html += '</tbody><tfoot>';
    html += '<tr class="qfd-sum-row qfd-sum-total"><th>Soma</th>'
        + requisitosProjeto.map(rp => `<td>${(rp.importanciaAbsoluta || 0).toFixed(1)}</td>`).join('') + '<td></td><td></td></tr>';
    html += '<tr class="qfd-sum-row qfd-sum-percent"><th>%</th>'
        + requisitosProjeto.map(rp => `<td>${((rp.pesoRelativo || 0) * 100).toFixed(1)}%</td>`).join('') + '<td></td><td></td></tr>';
    html += '<tr class="qfd-sum-row qfd-sum-rank"><th>Ranking</th>'
        + requisitosProjeto.map(rp => `<td>${rp.importanciaAbsoluta > 0 ? `${rp.importanciaRelativa}º` : '-'}</td>`).join('') + '<td></td><td></td></tr>';
    html += '<tr class="qfd-sum-row qfd-sum-dif"><th>Dificuldade</th>'
        + requisitosProjeto.map(rp => `<td>${seloDificuldade(rp.dificuldadeTecnica)}</td>`).join('') + '<td></td><td></td></tr>';
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

    // Quadro de especificações no formato do Quadro 8 de Spagnolo (2011);
    // sai em folha deitada no PDF e na impressão
    let html = '<div class="report-section pagina-paisagem"><h3>Especificações dos Requisitos de Projeto</h3>';
    html += '<p class="report-hint">Especificação do projeto em ordem de importância obtida através do QFD.</p>';
    html += '<table class="report-table especificacoes-report-table"><thead><tr>';
    html += '<th>Requisito</th><th>Valor meta</th><th>Forma de avaliação</th><th>Aspectos indesejados</th></tr></thead><tbody>';

    lista.forEach((row, index) => {
        let tercioClass = 'tercio-inferior';
        if (index < t1) tercioClass = 'tercio-superior';
        else if (index < t2) tercioClass = 'tercio-medio';

        const aspectos = row.aspectosIndesejaveis || '—';
        let tip = reqTip(`RP${row.numeroOriginal}`, row.requisito);
        if (obsInterna(row.observacao)) tip += `\nEspecificação: ${row.observacao}`;
        const specObs = obsInterna(row.observacao) ? `<br><em class="report-obs">${escapeHtml(row.observacao)}</em>` : '';

        const meta = row.metaFormatada
            ? escapeHtml(`${row.metaFormatada} ${row.unidadeMedida || ''}`.trim())
            : (row.revisarMeta ? `<em>revisar: ${escapeHtml(row.metaTexto)}</em>` : '—');
        html += `<tr class="${tercioClass} report-has-tip" data-tooltip="${escapeAttr(tip)}">
            <td>${row.rank}. ${escapeHtml(row.requisito.descricao)} <small>(RP${row.numeroOriginal})</small>${specObs}</td>
            <td>${meta}</td>
            <td>${escapeHtml(row.formaAvaliacao || '—')}</td>
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

    if (analise.indices.length) {
        const fmt = v => (v === null || v === undefined ? '—' : formatarNumero(Math.round(v * 1000) / 1000));
        html += '<h4>Índices</h4>';
        html += `<table class="report-table competitiva-table"><thead><tr><th>Índice</th><th>Fórmula</th>${cabecalhoProdutos}<th>Melhor concor&shy;rente</th><th>Nosso × melhor</th></tr></thead><tbody>`;
        analise.indices.forEach(x => {
            const un = x.indice.unidade ? ` ${escapeHtml(x.indice.unidade)}` : '';
            const melhor = x.melhor
                ? `${fmt(x.melhor.valor)}${un}<small class="competitiva-quem">${escapeHtml(x.melhor.produtos.map(codigoPorNome).join(', '))}</small>`
                : (x.indice.sentido === 'none' ? 'só comparar' : '—');
            html += `<tr>
                <td class="competitiva-desc"><strong>${escapeHtml(x.indice.nome)}</strong> ${getSentidoSymbol(x.indice.sentido)}</td>
                <td>${escapeHtml(x.formula)}${un ? ` <small>(${un.trim()})</small>` : ''}</td>
                ${analise.produtos.map(p => `<td>${fmt(x.valores[p.id])}</td>`).join('')}
                <td>${melhor}</td>
                <td>${situacao(x.situacao)}</td>
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

/**
 * Diagrama de Mudge completo (como a Fig. 35 de Spagnolo, 2011): matriz
 * triangular RC x RC em que cada célula mostra o requisito mais importante e
 * o valor (1 pouco, 3 médio, 5 muito mais importante), com a soma (S) e o %
 */
function generateComparisonsSection() {
    const rcs = requisitosCliente;
    if (rcs.length < 2) return '';
    const comparacoes = qfdDB.getComparacoesCliente();
    const numero = id => rcs.findIndex(r => r.id === id) + 1;
    const total = rcs.reduce((soma, r) => soma + (r.importancia || 0), 0);

    let html = '<div class="report-section report-mudge"><h3>Diagrama de Mudge</h3>';
    html += '<p class="report-hint">Cada célula compara o requisito da linha com o da coluna: '
        + 'mostra o requisito mais importante e quanto (1 = pouco, 3 = médio, 5 = muito mais importante). '
        + 'S = soma dos pontos de cada requisito; % = peso usado na Matriz QFD.</p>';
    html += '<div class="mudge-report-wrapper"><table class="report-table mudge-report"><thead><tr><th></th>';
    rcs.forEach((r, j) => { if (j > 0) html += `<th data-tooltip="${escapeAttr(`RC${j + 1}: ${r.descricao}`)}">${j + 1}</th>`; });
    html += '<th>S</th><th>%</th></tr></thead><tbody>';

    rcs.forEach((linha, i) => {
        html += `<tr><th data-tooltip="${escapeAttr(`RC${i + 1}: ${linha.descricao}`)}">${i + 1}</th>`;
        rcs.forEach((coluna, j) => {
            if (j === 0) return;
            if (j < i) { html += '<td class="mudge-vazio"></td>'; return; }
            if (j === i) { html += '<td class="mudge-diagonal"></td>'; return; }
            const c = comparacoes.find(x =>
                (x.requisito1 === linha.id && x.requisito2 === coluna.id) ||
                (x.requisito1 === coluna.id && x.requisito2 === linha.id));
            html += c
                ? `<td data-tooltip="${escapeAttr(`RC${i + 1} × RC${j + 1}: RC${numero(c.requisito1)} é mais importante (${c.valor})`)}">${numero(c.requisito1)}<sub>${c.valor}</sub></td>`
                : '<td class="mudge-pendente" data-tooltip="Comparação não feita">—</td>';
        });
        const pts = linha.importancia || 0;
        html += `<td><strong>${pts}</strong></td><td>${total > 0 ? ((pts / total) * 100).toFixed(2) : '0.00'}</td></tr>`;
    });
    html += `<tr class="mudge-total"><th colspan="${rcs.length}">Total</th><td><strong>${total}</strong></td><td>100</td></tr>`;
    html += '</tbody></table></div>';

    const pendentes = (rcs.length * (rcs.length - 1)) / 2 - comparacoes.length;
    if (pendentes > 0) html += `<p class="report-hint">${pendentes} comparação(ões) ainda não feita(s) (—).</p>`;
    return html + '</div>';
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

/** Medidas úteis (mm) de uma página A4 com margens de 2 cm */
const PDF_MARGEM = 20;
const PDF_UTIL = { p: { w: 170, h: 257 }, l: { w: 257, h: 170 } };

/**
 * Monta o PDF seção a seção: cada bloco da prévia (capa, sumário, seções) vira
 * uma imagem e é posto na página; um bloco que não cabe no espaço restante
 * começa numa página nova (assim as seções não são cortadas no meio), e só
 * blocos maiores que uma página inteira são fatiados. Seções com a classe
 * .pagina-paisagem saem em folha deitada, renderizadas mais largas para manter
 * o tamanho da letra.
 */
async function montarPDF(jsPDF, reportElement) {
    const pagina = reportElement.querySelector('.report-page') || reportElement;
    const blocos = [...pagina.children].filter(el => el.offsetHeight > 0);
    const larguraBase = pagina.clientWidth;
    const pdf = new jsPDF('p', 'mm', 'a4');
    let orientacao = 'p', usado = 0, primeira = true;

    const novaPagina = (o) => {
        if (primeira) {
            if (o !== 'p') { pdf.deletePage(1); pdf.addPage('a4', o); }
            primeira = false;
        } else {
            pdf.addPage('a4', o);
        }
        orientacao = o;
        usado = 0;
    };

    for (const bloco of blocos) {
        const o = bloco.classList.contains('pagina-paisagem') ? 'l' : 'p';
        // folha deitada: alarga o bloco só durante a captura (mesmo tamanho de letra)
        const estiloAntes = [bloco.style.width, pagina.style.maxWidth];
        if (o === 'l') {
            pagina.style.maxWidth = 'none';
            bloco.style.width = `${Math.round(larguraBase * PDF_UTIL.l.w / PDF_UTIL.p.w)}px`;
        }
        let canvas;
        try {
            canvas = await window.html2canvas(bloco, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        } finally {
            [bloco.style.width, pagina.style.maxWidth] = estiloAntes;
        }
        const util = PDF_UTIL[o];
        const alturaMm = canvas.height * util.w / canvas.width;
        const capa = bloco.classList.contains('report-capa');

        if (primeira || o !== orientacao || capa || usado + alturaMm > util.h + 0.5) novaPagina(o);

        if (capa) {
            // a capa ocupa só a 1ª página: se passar da altura útil, é reduzida e centralizada
            const h = Math.min(alturaMm, util.h), w = h * canvas.width / canvas.height;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', PDF_MARGEM + (util.w - w) / 2, PDF_MARGEM, w, h);
            usado = util.h; // conteúdo depois da capa começa na página seguinte
            continue;
        }

        if (alturaMm <= util.h + 0.5) {
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', PDF_MARGEM, PDF_MARGEM + usado, util.w, alturaMm);
            usado += alturaMm;
            continue;
        }

        // bloco maior que uma página: fatia na altura útil
        const fatiaPx = Math.floor(util.h * canvas.width / util.w);
        const fatia = document.createElement('canvas');
        fatia.width = canvas.width;
        const ctx = fatia.getContext('2d');
        for (let y = 0; y < canvas.height; y += fatiaPx) {
            const h = Math.min(fatiaPx, canvas.height - y);
            if (y > 0) novaPagina(o);
            fatia.height = h;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, fatia.width, h);
            ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            pdf.addImage(fatia.toDataURL('image/png'), 'PNG', PDF_MARGEM, PDF_MARGEM, util.w, h * util.w / canvas.width);
            usado = h * util.w / canvas.width;
        }
    }
    return pdf;
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
        const pdf = await montarPDF(jsPDF, reportElement);

        const safeTitle = (reportConfig.title || 'relatorio-qfd').replace(/[^\w\-]+/g, '_')
            + (isApresentacao() ? '-apresentacao' : '');
        pdf.save(`${safeTitle}.pdf`);
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
}
