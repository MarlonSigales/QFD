/**
 * ============================================================================
 * UTILITÁRIOS COMPARTILHADOS
 * ============================================================================
 *
 * Funções usadas por várias páginas. Deve ser carregado depois de database.js
 * e antes do script específico da página.
 *
 * O menu de navegação (dropdowns) é ativado automaticamente em todas as páginas.
 */

document.addEventListener('DOMContentLoaded', setupDropdownMenu);
document.addEventListener('DOMContentLoaded', setupLayout);

/** Nome do projeto na barra superior e botão ☰ da barra lateral (telas pequenas) */
function setupLayout() {
    const nome = document.getElementById('topbar-projeto-nome');
    if (nome && typeof qfdDB !== 'undefined') nome.textContent = qfdDB.getProjeto().nome || 'Projeto sem nome';
    if (document.querySelector('.sidebar')) {
        document.body.classList.add('layout-simples');
        montarArquivoProjeto();
        moverNavegacaoEtapas();
        recolherDicas();
        atualizarEtapasSidebar();
        // a situação das etapas acompanha o que é preenchido (os dados ficam no navegador a cada alteração)
        setInterval(() => { if (!document.hidden) atualizarEtapasSidebar(); }, 4000);
    }

    const botao = document.querySelector('.sidebar-toggle');
    if (!botao) return;
    botao.addEventListener('click', e => {
        e.stopPropagation();
        const aberta = document.body.classList.toggle('sidebar-aberta');
        botao.setAttribute('aria-expanded', String(aberta));
    });
    document.addEventListener('click', e => {
        if (document.body.classList.contains('sidebar-aberta') && !e.target.closest('.sidebar')) {
            document.body.classList.remove('sidebar-aberta');
            botao.setAttribute('aria-expanded', 'false');
        }
    });
}

// ============================================================================
// LAYOUT SIMPLES (padrão do Gestão de Projetos)
// ============================================================================

/** Etapas do QFD na ordem do menu: [página, nome curto]. As de 7 a 9 são complementares. */
const ETAPAS_QFD = [
    ['requisitos-cliente', 'Requisitos de Cliente'], ['comparacao-cliente', 'Comparação (Mudge)'],
    ['requisitos-projeto', 'Requisitos de Projeto'], ['correlacao-projeto', 'Correlação (telhado)'],
    ['matriz-qfd', 'Matriz QFD'], ['especificacoes', 'Especificações'],
    ['avaliacao-competitiva', 'Avaliação Competitiva'], ['atendimento-requisitos', 'Atendimento'],
    ['fechamento', 'Fechamento'], ['relatorio', 'Relatório']
];
const ETAPAS_ESSENCIAIS = 6; // 1 a 6 fazem a casa da qualidade e as especificações

/**
 * Situação de cada etapa: 'feito' | 'andamento' | 'vazio', com um resumo curto.
 * Mesmas contas dos cartões do Dashboard.
 */
function statusEtapasQFD(opcoes = {}) {
    const s = qfdDB.getProjectStats();
    const pares = n => n * (n - 1) / 2;
    const pct = (a, b) => (b > 0 ? Math.round(a / b * 100) : 0);
    const porPct = (v, txt) => ({ estado: v >= 100 ? 'feito' : v > 0 ? 'andamento' : 'vazio', resumo: txt });
    const out = {};
    out['requisitos-cliente'] = { estado: s.requisitosCliente >= 2 ? 'feito' : s.requisitosCliente ? 'andamento' : 'vazio', resumo: `${s.requisitosCliente} requisito(s)` };
    const pc = pct(s.comparacoesCliente, pares(s.requisitosCliente));
    out['comparacao-cliente'] = porPct(s.requisitosCliente >= 2 ? pc : 0, `${pc}% das comparações`);
    out['requisitos-projeto'] = { estado: s.requisitosProjeto >= 2 ? 'feito' : s.requisitosProjeto ? 'andamento' : 'vazio', resumo: `${s.requisitosProjeto} requisito(s)` };
    const pt = pct(s.correlacoesProjeto, pares(s.requisitosProjeto));
    out['correlacao-projeto'] = porPct(s.requisitosProjeto >= 2 ? pt : 0, `${pt}% do telhado`);
    const pm = pct(s.relacoesQFD, s.requisitosCliente * s.requisitosProjeto);
    out['matriz-qfd'] = { estado: s.relacoesQFD > 0 && pm >= 100 ? 'feito' : s.relacoesQFD > 0 ? 'andamento' : 'vazio', resumo: `${pm}% da matriz` };
    out['especificacoes'] = porPct(s.especificacoesPercent || 0, `${s.especificacoesPercent || 0}% preenchidas`);
    out['avaliacao-competitiva'] = porPct(s.concorrentes > 0 ? s.competitivaPercent : 0, s.concorrentes > 0 ? `${s.competitivaPercent}% das notas` : 'sem concorrentes');
    let at = null;
    try { at = qfdDB.getAnaliseAtendimento(false).atendimentoGeral; } catch (e) { at = null; }
    out['atendimento-requisitos'] = { estado: at === null ? 'vazio' : 'feito', resumo: at === null ? 'sem medições' : `${Math.round(at * 100)}% atendido` };
    let f = null;
    try { f = qfdDB.getFechamento(); } catch (e) { f = null; }
    const nPassos = f ? f.abstracao.filter(t => String(t || '').trim()).length : 0, temFuncao = !!(f && f.funcaoGlobal && f.funcaoGlobal.nome);
    out['fechamento'] = { estado: nPassos === 5 && temFuncao ? 'feito' : (nPassos || temFuncao) ? 'andamento' : 'vazio', resumo: `${nPassos}/5 passos` };
    const relatorioOk = s.requisitosCliente > 0 && s.requisitosProjeto > 0 && s.relacoesQFD > 0;
    out['relatorio'] = { estado: relatorioOk ? 'feito' : 'vazio', resumo: relatorioOk ? 'pronto para gerar' : 'falta a matriz' };
    // etapas que o usuário marcou como concluídas (nem toda etapa precisa ser preenchida 100%)
    if (!opcoes.semMarcadas) {
        qfdDB.getProjeto().etapasConcluidas.forEach(id => {
            if (out[id] && out[id].estado !== 'feito') out[id] = { estado: 'feito', resumo: out[id].resumo + ' · marcada como concluída', marcada: true };
        });
    }
    return out;
}

/** Página atual, se for uma etapa do QFD (menos o relatório, que não se conclui). */
function etapaDaPagina() {
    const id = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    return ETAPAS_QFD.some(([e]) => e === id) && id !== 'relatorio' ? id : null;
}

/**
 * Botão "Marcar etapa como concluída" no título da etapa: para quando a etapa não precisa ser preenchida 100%
 * (ex.: telhado só com as correlações que existem). Concluída pelo preenchimento, mostra só o selo.
 */
function atualizarBotaoConcluir() {
    const id = etapaDaPagina(), titulo = document.querySelector('.page-titulo');
    if (!id || !titulo || typeof qfdDB === 'undefined') return;
    let box = titulo.querySelector('.etapa-conclusao');
    if (!box) { box = document.createElement('div'); box.className = 'etapa-conclusao'; titulo.appendChild(box); }
    const auto = statusEtapasQFD({ semMarcadas: true })[id], marcada = qfdDB.isEtapaConcluida(id);
    const estado = auto.estado === 'feito' ? 'auto' : marcada ? 'marcada' : 'aberta';
    if (box.dataset.estado === estado) return;
    box.dataset.estado = estado;
    box.innerHTML = estado === 'auto'
        ? '<span class="etapa-selo-ok">✓ Etapa concluída</span>'
        : estado === 'marcada'
            ? `<span class="etapa-selo-ok" title="Marcada por você: o preenchimento atual é suficiente (${escapeAttr(auto.resumo)})">✓ Marcada como concluída</span>
               <button type="button" class="btn btn-secondary btn-concluir" data-concluir="0">Desmarcar</button>`
            : `<button type="button" class="btn btn-secondary btn-concluir" data-concluir="1" title="Use quando esta etapa não precisa ser preenchida 100% (agora: ${escapeAttr(auto.resumo)}). Ela passa a contar como concluída no menu, no Dashboard e no próximo passo.">✓ Marcar etapa como concluída</button>
               <span class="etapa-conclusao-dica">quando não precisar preencher tudo</span>`;
    const b = box.querySelector('.btn-concluir');
    if (b) b.addEventListener('click', () => {
        try {
            qfdDB.setEtapaConcluida(id, b.dataset.concluir === '1');
            atualizarEtapasSidebar();
        } catch (err) { showAlert('Não foi possível marcar a etapa: ' + escapeHtml(err.message), 'danger'); }
    });
}

/** Próxima etapa a fazer: a 1ª essencial não concluída; depois as complementares; por fim o relatório. */
function proximaEtapaQFD(st) {
    st = st || statusEtapasQFD();
    const ordem = ETAPAS_QFD.slice(0, ETAPAS_ESSENCIAIS).concat(ETAPAS_QFD.slice(ETAPAS_ESSENCIAIS, 9));
    const p = ordem.find(([id]) => st[id].estado !== 'feito');
    return p ? { id: p[0], nome: p[1], numero: ETAPAS_QFD.findIndex(([id]) => id === p[0]) + 1 } : { id: 'relatorio', nome: 'Relatório', numero: 10 };
}

/** Caminho de uma página do sistema a partir da página atual (raiz ou pages/). */
function caminhoPaginaQFD(id) {
    const naRaiz = !/\/pages\//.test(location.pathname);
    return (naRaiz ? 'pages/' : '') + id + '.html';
}

/** Marca na barra lateral as etapas feitas (✓), em andamento e a próxima a fazer. */
function atualizarEtapasSidebar() {
    if (typeof qfdDB === 'undefined') return;
    let st;
    try { st = statusEtapasQFD(); } catch (e) { return; }
    const prox = proximaEtapaQFD(st);
    ETAPAS_QFD.forEach(([id, nome], i) => {
        const link = document.querySelector(`.sidebar a.sidebar-link[href$="${id}.html"]`);
        if (!link) return;
        const info = st[id], num = link.querySelector('.sidebar-num');
        link.classList.remove('etapa-feito', 'etapa-andamento', 'etapa-vazio', 'etapa-proxima');
        link.classList.add('etapa-' + info.estado);
        if (id === prox.id && info.estado !== 'feito') link.classList.add('etapa-proxima');
        if (num) num.textContent = info.estado === 'feito' ? '✓' : String(i + 1);
        link.title = `${nome} — ${info.estado === 'feito' ? 'concluída' : info.estado === 'andamento' ? 'em andamento' : 'não iniciada'} (${info.resumo})${id === prox.id ? ' · próximo passo' : ''}`;
    });
    atualizarBotaoConcluir();
    const quando = document.getElementById('arquivo-salvo-em');
    if (quando) {
        let lm = '';
        try { lm = qfdDB.loadData().metadata.lastModified; } catch (e) { lm = ''; }
        quando.textContent = lm ? 'última alteração ' + new Date(lm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    }
}

/**
 * Bloco "Arquivo do projeto" fixo no pé da barra lateral, como no Gestão de Projetos: o salvamento é automático
 * (neste navegador); os botões levam o projeto a outro lugar. As opções de CSV ficam em "Mais opções".
 */
/** Próxima fase: o Sistema de Projeto Conceitual lê este QFD direto do navegador (mesmo endereço github.io). */
const URL_PROJETO_CONCEITUAL = 'https://marlonsigales.github.io/ProjetoConceitual/';

function montarArquivoProjeto() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.querySelector('.sidebar-arquivo')) return;
    const extras = Array.from(document.querySelectorAll('.topbar-backup .dropdown-menu a'))
        .filter(a => !/exportProjectData\(\)|exportarEEnviarEmail\(\)|getElementById\('import-file'\)/.test(a.getAttribute('onclick') || ''));
    const box = document.createElement('div');
    box.className = 'sidebar-arquivo';
    box.innerHTML = `<div class="sidebar-arquivo-rotulo">Arquivo do projeto</div>
        <div class="sidebar-arquivo-estado" title="Cada alteração é guardada sozinha neste navegador. Para levar a outro computador, baixe o backup.">✓ salvo automaticamente <span id="arquivo-salvo-em"></span></div>
        <button type="button" class="sidebar-arquivo-btn" onclick="exportProjectData()" title="Baixa o projeto inteiro num arquivo .json (backup)">💾 Baixar backup</button>
        <button type="button" class="sidebar-arquivo-btn" onclick="document.getElementById('import-file').click()" title="Abre um backup .json (substitui o projeto deste navegador)">📂 Abrir backup</button>
        <button type="button" class="sidebar-arquivo-btn" onclick="exportarEEnviarEmail()" title="Baixa o backup e abre o e-mail para os envolvidos">✉ Enviar por e-mail</button>
        <a class="sidebar-arquivo-btn sidebar-arquivo-seguir" href="${URL_PROJETO_CONCEITUAL}" target="_blank" rel="noopener" title="Abre o Sistema de Projeto Conceitual; lá, este QFD aparece em &quot;Usar este QFD&quot; (mesmo navegador), sem baixar arquivo">➜ Seguir para o projeto conceitual</a>
        ${extras.length ? '<details class="sidebar-arquivo-mais"><summary>Mais opções (CSV)</summary><div></div></details>' : ''}`;
    const destino = box.querySelector('.sidebar-arquivo-mais div');
    extras.forEach(a => { const c = a.cloneNode(true); c.classList.add('sidebar-arquivo-link'); destino.appendChild(c); });
    sidebar.appendChild(box);
}

/** Anterior / próxima etapa saem do topo e vão para o fim da página, onde a etapa termina. */
function moverNavegacaoEtapas() {
    const nav = document.querySelector('.topbar .nav-page-actions');
    const conteudo = document.querySelector('.app-conteudo');
    if (!nav || !conteudo) return;
    nav.classList.add('etapa-nav');
    nav.querySelectorAll('a.btn').forEach(a => {
        const proximo = a.id === 'btn-proximo' || a.classList.contains('btn-primary');
        a.classList.add(proximo ? 'etapa-nav-proxima' : 'etapa-nav-anterior');
        const destino = a.textContent.trim();
        const rot = document.createElement('small');
        rot.textContent = proximo ? 'Próxima etapa' : 'Voltar';
        a.textContent = '';
        a.append(rot, document.createTextNode(proximo ? destino + ' →' : '← ' + destino));
    });
    const rodape = conteudo.querySelector('.footer');
    conteudo.insertBefore(nav, rodape || null);
}

/** Cartões de dicas começam recolhidos: o que importa na tela é o formulário. */
function recolherDicas() {
    document.querySelectorAll('.card.info-card').forEach(card => {
        const titulo = card.querySelector('.card-title');
        if (!titulo || !/dica/i.test(titulo.textContent) || card.querySelector('details.dicas-recolhidas')) return;
        const det = document.createElement('details');
        det.className = 'dicas-recolhidas';
        const sum = document.createElement('summary');
        sum.textContent = '💡 ' + titulo.textContent.trim();
        det.appendChild(sum);
        Array.from(card.children).forEach(filho => { if (!filho.classList.contains('card-header')) det.appendChild(filho); });
        card.querySelector('.card-header').remove();
        card.appendChild(det);
    });
}

// ============================================================================
// MENU DE NAVEGAÇÃO
// ============================================================================

/**
 * Ativa todos os dropdowns do menu (.nav-dropdown). Abrir um fecha os demais;
 * clicar fora fecha todos.
 */
function setupDropdownMenu() {
    document.querySelectorAll('.nav-dropdown .dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const menu = this.nextElementSibling;
            if (!menu) return;

            document.querySelectorAll('.dropdown-menu.show, .dropdown-content.show').forEach(open => {
                if (open !== menu) open.classList.remove('show');
            });
            menu.classList.toggle('show');
        });
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.dropdown-menu.show, .dropdown-content.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
}

// ============================================================================
// TEXTO E HTML
// ============================================================================

/** Escapa texto para inserção segura como conteúdo HTML */
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/** Escapa texto para uso dentro de um atributo HTML (ex.: data-tooltip) */
function escapeAttr(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r?\n/g, '&#10;');
}

/** Corta o texto em `limit` caracteres, acrescentando "..." */
function truncateText(text, limit) {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
}

// ========================================================================
// BALÕES (tooltips) — um só para todas as páginas
// ========================================================================
// Qualquer elemento com data-tooltip="texto" mostra o balão ao passar o
// mouse. O texto é puro (sem HTML); quebras de linha (\n) são mantidas.
// Funciona também para elementos criados depois (delegação no document).

let appTooltipEl = null;
let appTooltipAlvo = null;

function showAppTooltip(alvo, e) {
    const text = alvo.getAttribute('data-tooltip');
    if (!text) return;
    if (!appTooltipEl) {
        appTooltipEl = document.createElement('div');
        appTooltipEl.className = 'app-tooltip';
        appTooltipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(appTooltipEl);
    }
    appTooltipEl.textContent = text;
    appTooltipEl.style.display = 'block';
    appTooltipAlvo = alvo;
    positionAppTooltip(e);
}

/** Posiciona perto do mouse, virando para o outro lado na borda da tela */
function positionAppTooltip(e) {
    if (!appTooltipEl || !appTooltipAlvo) return;
    const pad = 14;
    const w = appTooltipEl.offsetWidth;
    const h = appTooltipEl.offsetHeight;
    let left = e.clientX + pad;
    let top = e.clientY + pad;
    if (left + w > window.innerWidth - 8) left = Math.max(8, e.clientX - w - pad);
    if (top + h > window.innerHeight - 8) top = Math.max(8, e.clientY - h - pad);
    appTooltipEl.style.left = left + 'px';
    appTooltipEl.style.top = top + 'px';
}

function hideAppTooltip() {
    if (appTooltipEl) appTooltipEl.style.display = 'none';
    appTooltipAlvo = null;
}

document.addEventListener('mouseover', e => {
    const alvo = e.target.closest ? e.target.closest('[data-tooltip]') : null;
    if (alvo === appTooltipAlvo) return;
    if (alvo) showAppTooltip(alvo, e);
    else hideAppTooltip();
});
document.addEventListener('mousemove', positionAppTooltip);
document.addEventListener('mouseout', e => { if (!e.relatedTarget) hideAppTooltip(); });

/**
 * Célula anterior numa matriz triangular superior (Mudge, telhado), na ordem
 * do Enter: (0,1), (0,2) ... (0,n-1), (1,2) ... Retorna null na primeira.
 */
function getPrevTriangularCell(i, j, n) {
    if (j > i + 1) return { i, j: j - 1 };
    if (i > 0) return { i: i - 1, j: n - 1 };
    return null;
}

/** Célula anterior numa grade (Matriz QFD), linha a linha. Null na primeira. */
function getPrevGridCell(i, j, cols) {
    if (j > 0) return { i, j: j - 1 };
    if (i > 0) return { i: i - 1, j: cols - 1 };
    return null;
}

/** Formata uma data ISO como dd/mm/aaaa hh:mm */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}


/** Ajusta a altura de um textarea ao conteúdo (usar como handler de 'input') */
function autoResizeTextarea(event) {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// ============================================================================
// DIFICULDADE TÉCNICA (P16)
// ============================================================================

const ROTULOS_DIFICULDADE = { 1: 'Muito fácil', 2: 'Fácil', 3: 'Moderada', 4: 'Difícil', 5: 'Muito difícil' };

/** Nome da dificuldade técnica (1 a 5) */
function rotuloDificuldade(n) {
    return ROTULOS_DIFICULDADE[Number(n)] || 'Indefinida';
}

/** Selo com o nível da dificuldade técnica (cor de 1 = verde a 5 = vermelho) */
function seloDificuldade(n) {
    const v = Number(n) || 1;
    return `<span class="dif-nivel level-${v}" title="Dificuldade técnica: ${rotuloDificuldade(v)}">${v}</span>`;
}

/**
 * Requisito crítico: está no terço superior da hierarquia do QFD e tem
 * dificuldade técnica 4 ou 5 (importante e difícil). Não altera os pesos.
 * @param {number} indice - posição na lista ordenada pelo QFD (0 = mais importante)
 * @param {number} total - total de requisitos na lista
 */
function ehRequisitoCritico(indice, total, dificuldade) {
    return indice < Math.ceil(total / 3) && Number(dificuldade) >= 4;
}

// ============================================================================
// SENTIDO DE MELHORIA
// ============================================================================

/** Símbolo do sentido de melhoria: ↑ crescente, ↓ decrescente, * nominal */
function getSentidoSymbol(sentido) {
    const key = String(sentido || '').toLowerCase();
    const symbols = {
        up: '↑', down: '↓', none: '*',
        crescente: '↑', decrescente: '↓', nominal: '*'
    };
    return symbols[key] || '?';
}

/** Nome do sentido de melhoria */
function getSentidoLabel(sentido) {
    const labels = { up: 'Crescente', down: 'Decrescente', none: 'Nominal' };
    return labels[sentido] || 'Indefinido';
}

// ============================================================================
// AVALIAÇÃO COMPETITIVA
// ============================================================================

/** Cores dos produtos na avaliação competitiva (a primeira é a do nosso produto) */
const CORES_PRODUTOS = ['#085357', '#dc2626', '#16a34a', '#ea580c', '#0891b2', '#9333ea', '#ca8a04'];

/** Texto e classe CSS da situação de um requisito frente ao melhor concorrente */
function getSituacaoCompetitiva(situacao) {
    const map = {
        frente: { texto: 'À frente', classe: 'sit-frente' },
        empate: { texto: 'Empatado', classe: 'sit-empate' },
        atras: { texto: 'Atrás', classe: 'sit-atras' }
    };
    return map[situacao] || { texto: '—', classe: 'sit-sem-dados' };
}

/**
 * Gráfico da avaliação dos clientes (perfil de cada produto de 1 a 5 por
 * requisito de cliente, como na Casa da Qualidade), em SVG + legenda HTML.
 *
 * @param {Object} analise - Resultado de qfdDB.getAnaliseCompetitiva()
 * @returns {string} HTML, ou '' se não houver nenhuma nota
 */
/** Asterisco de 6 pontas (nosso produto no gráfico competitivo), com contorno branco para ler sobre as linhas. */
function svgAsterisco(cx, cy, r, cor, titulo) {
    const bracos = [0, 60, 120].map(g => {
        const a = g * Math.PI / 180, dx = (r * Math.sin(a)).toFixed(2), dy = (r * Math.cos(a)).toFixed(2);
        return `M${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)}L${(cx + +dx).toFixed(2)} ${(cy + +dy).toFixed(2)}`;
    }).join('');
    return `<g>${titulo}<path d="${bracos}" stroke="white" stroke-width="5" stroke-linecap="round"/><path d="${bracos}" stroke="${cor}" stroke-width="2.6" stroke-linecap="round"/></g>`;
}

function buildGraficoCompetitivo(analise) {
    const { produtos, clientes } = analise;
    if (!clientes.some(c => produtos.some(p => c.notas[p.id]) || c.meta)) return '';

    const labelW = 60, plotW = 320, rowH = 28, top = 28, pad = 16;
    const width = labelW + plotW + pad * 2;
    const height = top + clientes.length * rowH + 8;
    const x = n => labelW + pad + (n - 1) * (plotW / 4);
    const yRow = i => top + i * rowH + rowH / 2;
    const offset = k => (k - (produtos.length - 1) / 2) * 3;

    let svg = `<svg class="grafico-competitivo" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avaliação dos clientes por requisito">`;
    for (let n = 1; n <= 5; n++) {
        svg += `<line x1="${x(n)}" y1="${top - 6}" x2="${x(n)}" y2="${height - 4}" stroke="#d7dee8" stroke-width="1"/>`;
        svg += `<text x="${x(n)}" y="${top - 12}" text-anchor="middle" font-size="12" fill="#475569">${n}</text>`;
    }
    clientes.forEach((c, i) => {
        if (i % 2 === 0) svg += `<rect x="0" y="${top + i * rowH}" width="${width}" height="${rowH}" fill="#f1f5f9" opacity="0.6"/>`;
        svg += `<text x="8" y="${yRow(i) + 4}" font-size="12" font-weight="bold" fill="#0f172a"><title>${escapeHtml(c.requisito.descricao)}</title>RC${c.numero}</text>`;
    });

    produtos.forEach((p, k) => {
        const cor = CORES_PRODUTOS[k % CORES_PRODUTOS.length];
        const pontos = clientes.map((c, i) => c.notas[p.id] ? [x(c.notas[p.id]), yRow(i) + offset(k)] : null).filter(Boolean);
        if (pontos.length > 1) {
            svg += `<polyline points="${pontos.map(pt => pt.join(',')).join(' ')}" fill="none" stroke="${cor}" stroke-width="${k === 0 ? 2.5 : 1.5}"${k === 0 ? '' : ' stroke-dasharray="5,3"'} opacity="0.85"/>`;
        }
        clientes.forEach((c, i) => {
            const nota = c.notas[p.id];
            if (!nota) return;
            const titulo = `<title>${escapeHtml(p.nome)} — RC${c.numero}: nota ${nota}</title>`;
            svg += p.id === PRODUTO_NOSSO_ID
                ? svgAsterisco(x(nota), yRow(i) + offset(k), 7.5, cor, titulo) // nosso produto: asterisco, para não confundir com os concorrentes
                : `<circle cx="${x(nota)}" cy="${yRow(i) + offset(k)}" r="5" fill="${cor}" stroke="white" stroke-width="1.5">${titulo}</circle>`;
        });
    });

    clientes.forEach((c, i) => {
        if (!c.meta) return;
        svg += `<rect x="${x(c.meta) - 7}" y="${yRow(i) - 7}" width="14" height="14" fill="none" stroke="#0f172a" stroke-width="2"><title>Meta RC${c.numero}: ${c.meta}</title></rect>`;
    });
    svg += '</svg>';

    let legenda = '<div class="grafico-legenda">';
    produtos.forEach((p, k) => {
        const cor = CORES_PRODUTOS[k % CORES_PRODUTOS.length];
        legenda += p.id === PRODUTO_NOSSO_ID
            ? `<span><svg class="legenda-asterisco" viewBox="0 0 18 18" width="14" height="14" aria-hidden="true">${svgAsterisco(9, 9, 7, cor, '')}</svg>${escapeHtml(p.nome)}</span>`
            : `<span><i style="background:${cor}"></i>${escapeHtml(p.nome)}</span>`;
    });
    legenda += '<span><i class="legenda-meta"></i>Meta</span></div>';

    return `<div class="grafico-competitivo-wrapper">${svg}${legenda}<p class="grafico-escala">1 = pior avaliação &nbsp;·&nbsp; 5 = melhor avaliação</p></div>`;
}

/** Formata um número com vírgula decimal (até 3 casas) */
function formatarNumero(n) {
    return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/**
 * Resumo em listas: pontos fortes, a melhorar, metas técnicas e inconsistências
 * @param {Object} [opcoes] - { inconsistencias: false } omite o bloco de inconsistências
 */
function buildResultadoHtml(analise, opcoes = {}) {
    const nosso = escapeHtml(analise.produtos[0].nome);
    const porPeso = lista => [...lista].sort((a, b) => b.peso - a.peso);
    const frente = porPeso(analise.clientes.filter(c => c.situacao === 'frente'));
    const atras = porPeso(analise.clientes.filter(c => c.situacao === 'atras'));
    const metasAtras = analise.tecnicos.filter(t => t.situacao === 'atras');

    if (!analise.concorrentes.length) {
        return '<p class="competitiva-hint">Adicione pelo menos um concorrente e preencha as notas para ver a comparação.</p>';
    }

    const itemRc = c => `<li><strong>RC${c.numero}</strong> — ${escapeHtml(c.requisito.descricao)}
        <small>(${nosso}: ${c.nossa} × ${escapeHtml(c.melhor.produtos.join(', '))}: ${c.melhor.valor}; peso ${(c.peso * 100).toFixed(1)}%)</small></li>`;

    let html = '<div class="resultado-grid">';
    html += `<div class="resultado-bloco resultado-frente"><h4><i class="fas fa-thumbs-up"></i> Pontos fortes (${frente.length})</h4>`;
    html += frente.length ? `<ul>${frente.map(itemRc).join('')}</ul>` : '<p>Nenhum requisito em que o nosso produto supera todos os concorrentes.</p>';
    html += '</div>';

    html += `<div class="resultado-bloco resultado-atras"><h4><i class="fas fa-tools"></i> A melhorar (${atras.length})</h4>`;
    html += atras.length ? `<ul>${atras.map(itemRc).join('')}</ul>` : '<p>Nenhum requisito em que estamos atrás.</p>';
    html += '</div>';

    html += `<div class="resultado-bloco resultado-metas"><h4><i class="fas fa-bullseye"></i> Metas técnicas abaixo do melhor concorrente (${metasAtras.length})</h4>`;
    html += metasAtras.length
        ? `<ul>${metasAtras.map(t => `<li><strong>RP${t.numero}</strong> — ${escapeHtml(t.requisito.descricao)}
            <small>(meta ${escapeHtml(t.meta)} × ${escapeHtml(t.melhor.produtos.join(', '))}: ${formatarNumero(t.melhor.valor)} ${escapeHtml(t.unidade)})</small></li>`).join('')}</ul>
            <p class="competitiva-hint">Reveja essas metas nas Especificações, ou justifique por que ficar abaixo do concorrente é aceitável.</p>`
        : '<p>Nenhuma meta abaixo do melhor concorrente (ou faltam valores para comparar).</p>';
    html += '</div>';

    if (opcoes.inconsistencias === false) return html + '</div>';

    html += `<div class="resultado-bloco resultado-inconsistencias"><h4><i class="fas fa-exclamation-triangle"></i> Inconsistências (${analise.inconsistencias.length})</h4>`;
    html += analise.inconsistencias.length
        ? `<ul>${analise.inconsistencias.map(i => `<li><strong>RC${i.numero}</strong> — os clientes preferem <strong>${escapeHtml(i.preferido)}</strong> a <strong>${escapeHtml(i.outro)}</strong>,
            mas os valores técnicos de ${i.requisitosProjeto.map(n => 'RP' + n).join(', ')} (relação forte na matriz) favorecem ${escapeHtml(i.outro)}.</li>`).join('')}</ul>
            <p class="competitiva-hint">Verifique as medições e as notas, ou se falta algum requisito de projeto que explique a preferência dos clientes.</p>`
        : '<p>Nenhuma inconsistência entre as notas dos clientes e os valores técnicos.</p>';
    html += '</div></div>';
    return html;
}

// ============================================================================
// ATENDIMENTO AOS REQUISITOS DE CLIENTE
// ============================================================================

/** Texto e classe CSS do estado da meta de um requisito de projeto */
function getEstadoMeta(estado) {
    const map = {
        'atingida': { texto: 'Atingida', classe: 'sit-frente' },
        'nao-atingida': { texto: 'Não atingida', classe: 'sit-atras' },
        'sem-medicao': { texto: 'Sem medição', classe: 'sit-sem-dados' },
        'sem-meta': { texto: 'Sem meta', classe: 'sit-sem-dados' }
    };
    return map[estado] || map['sem-meta'];
}

/** Texto e classe CSS da cobertura de um requisito de cliente na matriz QFD */
function getCoberturaInfo(cobertura) {
    const map = {
        forte: { texto: 'Forte', classe: 'sit-frente' },
        moderada: { texto: 'Moderada', classe: 'sit-empate' },
        fraca: { texto: 'Fraca', classe: 'sit-fraca' },
        nenhuma: { texto: 'Nenhuma', classe: 'sit-atras' }
    };
    return map[cobertura] || map.nenhuma;
}

function badgeHtml(info) {
    return `<span class="sit-badge ${info.classe}">${info.texto}</span>`;
}

/** Barra de porcentagem (0 a 1), ou "—" se null */
function barraAtendimentoHtml(valor) {
    if (valor === null || valor === undefined) return '<span class="sit-sem-dados">—</span>';
    const pct = Math.round(valor * 100);
    const classe = pct >= 80 ? 'atend-alto' : pct >= 50 ? 'atend-medio' : 'atend-baixo';
    return `<div class="atend-barra ${classe}"><span style="width:${pct}%"></span></div><strong>${pct}%</strong>`;
}

/**
 * Tabela do atendimento por requisito de cliente (ordem de peso)
 *
 * @param {Object} analise - Resultado de qfdDB.getAnaliseAtendimento()
 * @param {Function} [tipAttr] - Recebe o requisito e o rótulo e devolve atributos extras da linha (ex.: balão do relatório)
 */
function buildTabelaAtendimentoClientes(analise, tipAttr) {
    const temNotas = analise.clientes.some(c => c.notaClientes);
    let html = `<table class="report-table atendimento-table"><thead><tr><th>RC</th><th>Requisito de cliente</th><th>Peso</th>
        <th>Requisitos de projeto relacionados (influência e meta)</th><th>Cobertura</th><th>Atendimento</th>${temNotas ? '<th>Nota dos clientes</th>' : ''}</tr></thead><tbody>`;

    [...analise.clientes].sort((a, b) => (b.peso - a.peso) || (a.numero - b.numero)).forEach(c => {
        const relacoes = c.relacoes.length
            ? c.relacoes.map(r => {
                const estado = getEstadoMeta(r.projeto.estado);
                const icone = { atingida: '✓', 'nao-atingida': '✗' }[r.projeto.estado] || '?';
                return `<span class="atend-rel ${estado.classe}" title="${escapeAttr(`RP${r.projeto.numero}: ${r.projeto.requisito.descricao} — influência ${r.influencia}, meta ${estado.texto.toLowerCase()}`)}">RP${r.projeto.numero} (${r.influencia}) ${icone}</span>`;
            }).join(' ')
            : '<span class="sit-sem-dados">nenhum</span>';
        const extra = tipAttr ? tipAttr(c.requisito, `RC${c.numero}`) : '';
        html += `<tr${extra}>
            <td><strong>RC${c.numero}</strong></td>
            <td class="competitiva-desc">${escapeHtml(c.requisito.descricao)}</td>
            <td>${(c.peso * 100).toFixed(1)}%</td>
            <td class="atend-rels">${relacoes}</td>
            <td>${badgeHtml(getCoberturaInfo(c.cobertura))}</td>
            <td class="atend-cell">${barraAtendimentoHtml(c.atendimento)}</td>
            ${temNotas ? `<td>${c.notaClientes ? c.notaClientes + ' / 5' : '—'}</td>` : ''}
        </tr>`;
    });
    return html + '</tbody></table>';
}

/** Diagnóstico do atendimento em blocos (mesmo visual do resultado competitivo) */
function buildDiagnosticoAtendimentoHtml(analise) {
    const d = analise.diagnostico;
    const rc = c => `<strong>RC${c.numero}</strong> — ${escapeHtml(c.requisito.descricao)} <small>(peso ${(c.peso * 100).toFixed(1)}%)</small>`;
    const rp = p => `<strong>RP${p.numero}</strong> — ${escapeHtml(p.requisito.descricao)}`;
    const bloco = (classe, icone, titulo, itens, formatar, vazio, dica) => {
        let html = `<div class="resultado-bloco ${classe}"><h4><i class="fas fa-${icone}"></i> ${titulo} (${itens.length})</h4>`;
        html += itens.length ? `<ul>${itens.map(i => `<li>${formatar(i)}</li>`).join('')}</ul>${dica ? `<p class="competitiva-hint">${dica}</p>` : ''}` : `<p>${vazio}</p>`;
        return html + '</div>';
    };

    let html = '<div class="resultado-grid">';
    html += bloco('resultado-atras', 'unlink', 'Requisitos de cliente sem nenhum requisito de projeto', d.semRelacao, rc,
        'Todos os requisitos de cliente têm ao menos uma relação na matriz.',
        'O projeto não tem como atender a esses requisitos: acrescente requisitos de projeto ou relações na Matriz QFD.');
    html += bloco('resultado-metas', 'link', 'Atendidos só por relações fracas (1)', d.soFracas, rc,
        'Nenhum requisito depende só de relações fracas.',
        'Considere um requisito de projeto que atue diretamente sobre eles.');
    html += bloco('resultado-atras', 'chart-line', 'Atendimento abaixo de 50%', d.baixoAtendimento,
        c => `${rc(c)} — ${Math.round(c.atendimento * 100)}%`,
        'Nenhum requisito de cliente com atendimento abaixo de 50% (entre os que têm medição).');
    html += bloco('resultado-metas', 'bullseye', 'Metas de projeto não atingidas', d.metasNaoAtingidas,
        p => `${rp(p)} <small>(meta ${escapeHtml(p.meta)} × medido ${escapeHtml(p.medido)} ${escapeHtml(p.unidade)})</small>`,
        'Nenhuma meta medida ficou sem ser atingida.');
    html += bloco('resultado-inconsistencias', 'unlink', 'Requisitos de projeto sem relação com o cliente', d.rpSemRelacao, rp,
        'Todos os requisitos de projeto atendem a pelo menos um requisito de cliente.',
        'Não contribuem para nenhuma necessidade do cliente: reveja a matriz ou se são mesmo necessários (podem ser restrições, normas etc.).');
    html += bloco('resultado-inconsistencias', 'exclamation-triangle', 'Divergência entre atendimento técnico e nota dos clientes', d.divergencias,
        c => `${rc(c)} — atendimento ${Math.round(c.atendimento * 100)}%, nota dos clientes ${c.notaClientes}/5`,
        'Nenhuma divergência (ou faltam notas dos clientes na Avaliação Competitiva).',
        'Atendimento alto com nota baixa sugere que falta algum requisito de projeto; atendimento baixo com nota alta sugere metas mais exigentes que o necessário.');
    return html + '</div>';
}

// ============================================================================
// ALERTAS E ARQUIVOS
// ============================================================================

/**
 * Mostra um alerta no topo do conteúdo, que some após 5 segundos
 *
 * @param {string} message - Mensagem (aceita HTML)
 * @param {string} [type='info'] - 'success', 'warning', 'danger' ou 'info'
 */
function showAlert(message, type = 'info') {
    document.querySelectorAll('.alert').forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible`;
    alert.innerHTML = `
        <i class="fas fa-${getAlertIcon(type)}"></i>
        ${message}
        <button class="alert-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;


    const mainContent = document.querySelector('.main-content .container');
    if (mainContent) {
        mainContent.insertBefore(alert, mainContent.firstChild);
    }

    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

/** Ícone Font Awesome correspondente ao tipo de alerta */
function getAlertIcon(type) {
    const icons = {
        success: 'check-circle',
        warning: 'exclamation-triangle',
        danger: 'exclamation-circle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// ============================================================================
// CSV
// ============================================================================

/** Formata um valor como célula CSV entre aspas (aspas internas duplicadas) */
function csvCell(value) {
    return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
}

/**
 * Lê um texto CSV e devolve as linhas como arrays de células. Suporta campos
 * entre aspas (com vírgulas, quebras de linha e "" dentro), fim de linha
 * Windows/Unix e separador ',' ou ';' (detectado pela primeira linha).
 * Linhas totalmente vazias são descartadas.
 *
 * @param {string} text - Conteúdo do arquivo
 * @returns {string[][]}
 */
function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, ''); // remove BOM do Excel
    const firstLine = text.split(/\r?\n/, 1)[0];
    const sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

    const rows = [];
    let row = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else cell += c;
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === sep) {
            row.push(cell); cell = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row);
            row = []; cell = '';
        } else {
            cell += c;
        }
    }
    row.push(cell); rows.push(row);

    return rows.filter(r => r.some(c => c.trim() !== ''));
}

/** Faz o download de um conteúdo de texto como arquivo */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// CLASSIFICAÇÃO DO REQUISITO (formador de função / boa prática → fora do QFD)
// ============================================================================

/** Campo "Tipo de requisito" + justificativa (obrigatória se fora do QFD) */
function htmlCampoClassificacao(idTipo, idJust, req = {}) {
    const atual = CLASSIFICACOES_REQUISITO[req.classificacao] ? req.classificacao : '';
    const opcoes = Object.entries(CLASSIFICACOES_REQUISITO)
        .map(([valor, texto]) => `<option value="${valor}" ${atual === valor ? 'selected' : ''}>${texto} (fora do QFD)</option>`)
        .join('');
    return `
        <div class="form-group classificacao-requisito">
            <label for="${idTipo}"><i class="fas fa-tag"></i> Tipo de requisito</label>
            <select class="form-control" id="${idTipo}" onchange="toggleJustificativaClassificacao('${idTipo}', '${idJust}')">
                <option value="">Normal (entra no QFD)</option>
                ${opcoes}
            </select>
            <div class="justificativa-classificacao" id="${idJust}-box" style="${atual ? '' : 'display: none;'}">
                <label for="${idJust}">Justificativa (obrigatória)</label>
                <textarea class="form-control" id="${idJust}" rows="2" maxlength="1000"
                    placeholder="Por que este requisito forma uma função ou é uma boa prática de projeto?">${escapeHtml(req.justificativaClassificacao || '')}</textarea>
            </div>
            <small class="form-text">Requisitos formadores de função ou de boa prática ficam fora da comparação, do telhado, da matriz e das especificações, e aparecem numa seção própria do relatório.</small>
        </div>`;
}

// ============================================================================
// REDAÇÃO DO REQUISITO DE CLIENTE (Fonseca, 2000)
// ============================================================================

/** Palavras do início que não mudam a análise ("O produto deve ...") */
const INICIO_NEUTRO = ['o', 'a', 'os', 'as', 'produto', 'equipamento', 'maquina', 'sistema', 'que',
    'deve', 'devera', 'devem', 'deverao', 'precisa', 'precisam', 'tem', 'de'];
/** Verbos aceitos pela regra "ser/ter/estar + substantivo" (e equivalentes) */
const VERBOS_REQUISITO = ['ser', 'ter', 'estar', 'possuir', 'apresentar', 'poder'];
/** Palavras terminadas em -ar/-er/-ir que não são verbos */
const NAO_VERBOS = ['lugar', 'familiar', 'solar', 'popular', 'regular', 'similar', 'particular', 'mulher',
    'colher', 'prazer', 'auxiliar', 'escolar', 'militar', 'nuclear', 'linear', 'modular', 'celular', 'par', 'mar', 'bar'];

/**
 * Requisito de cliente deve ser "ser/ter/estar + substantivo". Se começar por
 * outro verbo no infinitivo ("eliminar plantas"), provavelmente descreve uma
 * função. Retorna o verbo encontrado ou null.
 */
function verboDeFuncao(texto) {
    const palavras = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
    while (palavras.length && INICIO_NEUTRO.includes(palavras[0])) palavras.shift();
    const p = palavras[0];
    if (!p || VERBOS_REQUISITO.includes(p) || NAO_VERBOS.includes(p)) return null;
    return /^[a-z]{2,}(ar|er|ir)(-se)?$/.test(p) ? p : null;
}

/**
 * Mostra, abaixo do campo de descrição, o aviso de redação e o botão que marca
 * o requisito como formador de função. Só aviso: não impede salvar.
 */
function ligarAvisoRedacao(campo, idClassificacao, idJust) {
    if (!campo) return;
    let aviso = campo.parentElement.querySelector('.aviso-redacao');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.className = 'aviso-redacao';
        aviso.style.display = 'none';
        campo.insertAdjacentElement('afterend', aviso);
    }
    const atualizar = () => {
        const verbo = verboDeFuncao(campo.value);
        const tipo = document.getElementById(idClassificacao);
        if (!verbo || (tipo && tipo.value)) { aviso.style.display = 'none'; return; }
        aviso.style.display = '';
        aviso.innerHTML = `<i class="fas fa-spell-check"></i> Requisito de cliente deve ser "ser/ter/estar + substantivo".
            Começando por "<strong></strong>", ele provavelmente descreve uma função.
            <button type="button" class="aviso-redacao-btn">Marcar como formador de função</button>`;
        aviso.querySelector('strong').textContent = verbo;
        aviso.querySelector('button').addEventListener('click', () => {
            if (!tipo) return;
            tipo.value = 'funcao';
            toggleJustificativaClassificacao(idClassificacao, idJust);
            aviso.style.display = 'none';
            const just = document.getElementById(idJust);
            if (just) just.focus();
        });
    };
    campo.addEventListener('input', atualizar);
    const tipo = document.getElementById(idClassificacao);
    if (tipo) tipo.addEventListener('change', atualizar);
    atualizar();
}

function toggleJustificativaClassificacao(idTipo, idJust) {
    const tipo = document.getElementById(idTipo);
    const box = document.getElementById(`${idJust}-box`);
    if (tipo && box) box.style.display = tipo.value ? '' : 'none';
}

/**
 * Lê o campo de classificação
 * @returns {{classificacao: string, justificativaClassificacao: string, erro?: string}}
 */
function lerClassificacao(idTipo, idJust) {
    const classificacao = document.getElementById(idTipo)?.value || '';
    const justificativa = (document.getElementById(idJust)?.value || '').trim();
    if (classificacao && !justificativa) {
        return { classificacao, justificativaClassificacao: '', erro: 'Informe a justificativa para deixar o requisito fora do QFD.' };
    }
    return { classificacao, justificativaClassificacao: classificacao ? justificativa : '' };
}

/** Selo e justificativa de um requisito fora do QFD ('' se está no QFD) */
function htmlSeloClassificacao(req) {
    if (estaNoQFD(req)) return '';
    return `<div class="classificacao-selo classificacao-${req.classificacao}">
        <i class="fas fa-tag"></i> <strong>${CLASSIFICACOES_REQUISITO[req.classificacao]}</strong> — fora do QFD
        <div class="classificacao-justificativa">${escapeHtml(req.justificativaClassificacao || '')}</div>
    </div>`;
}

/** Número do requisito no QFD (RC/RPn) ou null se está fora; mesma numeração das matrizes */
function numerosNoQFD(lista) {
    let n = 0;
    return lista.map(r => (estaNoQFD(r) ? ++n : null));
}

// ============================================================================
// REGISTRO RÁPIDO DE IDEIA (páginas de requisitos)
// ============================================================================

/** Quebra um texto em linhas de até n caracteres (para o SVG) */
function quebrarLinhas(texto, n) {
    const linhas = [];
    let atual = '';
    String(texto || '').split(/\s+/).filter(Boolean).forEach(p => {
        if (atual && (atual + ' ' + p).length > n) { linhas.push(atual); atual = p; }
        else atual = atual ? `${atual} ${p}` : p;
    });
    if (atual) linhas.push(atual);
    return linhas;
}

/**
 * Caixa-preta da função global (Pahl & Beitz, Figs. 2.2 e 2.4): entradas à
 * esquerda e saídas à direita; energia em seta contínua, material em seta
 * dupla e sinal em seta tracejada. Retorna o SVG como texto.
 */
function svgCaixaPreta(funcao) {
    const lista = lado => Object.keys(TIPOS_FLUXO).flatMap(t => ((funcao[lado] || {})[t] || []).map(texto => ({ tipo: t, texto })));
    const entradas = lista('entradas'), saidas = lista('saidas');
    const W = 680, passo = 46, topo = 30;
    const H = Math.max(entradas.length, saidas.length, 2) * passo + topo * 2;
    const caixa = { x: 250, y: 18, w: 180, h: H - 36 };
    const seta = (x1, x2, y, tipo) => {
        const corpo = tipo === 'material'
            ? `<line x1="${x1}" y1="${y - 3}" x2="${x2 - 10}" y2="${y - 3}" stroke="#085357" stroke-width="2"/><line x1="${x1}" y1="${y + 3}" x2="${x2 - 10}" y2="${y + 3}" stroke="#085357" stroke-width="2"/>`
            : `<line x1="${x1}" y1="${y}" x2="${x2 - 10}" y2="${y}" stroke="#085357" stroke-width="2"${tipo === 'sinal' ? ' stroke-dasharray="7 5"' : ''}/>`;
        return corpo + `<polygon points="${x2},${y} ${x2 - 12},${y - 6} ${x2 - 12},${y + 6}" fill="#085357"/>`;
    };
    const fluxos = (itens, x1, x2, xTexto) => itens.map((f, i) => {
        const y = topo + passo * i + passo / 2 + (H - topo * 2 - passo * itens.length) / 2;
        return seta(x1, x2, y, f.tipo) +
            `<text x="${xTexto}" y="${y - 9}" font-size="12" fill="#1f2d2c">${escapeHtml(truncateText(f.texto, 30))}</text>`;
    }).join('');
    const nome = quebrarLinhas(funcao.nome || 'Função global', 20).slice(0, 5);
    const yNome = caixa.y + caixa.h / 2 - (nome.length - 1) * 9;
    return `<svg class="caixa-preta" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Função global">
        <rect x="${caixa.x}" y="${caixa.y}" width="${caixa.w}" height="${caixa.h}" rx="6" fill="#e9f5ef" stroke="#085357" stroke-width="2"/>
        ${nome.map((l, i) => `<text x="${caixa.x + caixa.w / 2}" y="${yNome + i * 18}" text-anchor="middle" font-size="14" font-weight="700" fill="#085357">${escapeHtml(l)}</text>`).join('')}
        ${fluxos(entradas, 10, caixa.x, 10)}
        ${fluxos(saidas, caixa.x + caixa.w, W - 10, caixa.x + caixa.w + 10)}
    </svg>`;
}

/** Legenda dos tipos de fluxo da caixa-preta */
function htmlLegendaFluxos() {
    return `<div class="caixa-preta-legenda">
        <span><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#085357" stroke-width="2"/></svg> Energia</span>
        <span><svg width="40" height="10"><line x1="0" y1="2" x2="40" y2="2" stroke="#085357" stroke-width="2"/><line x1="0" y1="8" x2="40" y2="8" stroke="#085357" stroke-width="2"/></svg> Material</span>
        <span><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#085357" stroke-width="2" stroke-dasharray="7 5"/></svg> Sinal</span>
    </div>`;
}

/** Só deixa virar link um endereço http(s); o resto aparece apenas como texto */
function linkSeguro(url) {
    const u = String(url || '').trim();
    return /^https?:\/\/[^\s]+$/i.test(u) ? u : '';
}

/** Nome curto de uma referência: "NBR 5410 — Instalações elétricas" */
function rotuloReferencia(ref) {
    return ref.identificacao ? `${ref.identificacao} — ${ref.titulo}` : ref.titulo;
}

/** Linha "Referências: ..." no cartão do requisito (estado da técnica, P13) */
function htmlReferenciasRequisito(tipo, id) {
    const refs = qfdDB.getReferenciasDoRequisito(tipo, id);
    if (!refs.length) return '';
    const chips = refs.map(r => `<span class="ideia-chip" title="${escapeAttr(TIPOS_REFERENCIA[r.tipo] || '')}">${escapeHtml(truncateText(rotuloReferencia(r), 60))}</span>`).join(' ');
    return `<div class="requisito-referencias"><i class="fas fa-book"></i> Referências: ${chips}</div>`;
}

/** Botão 💡 com o número de ideias ligadas ao requisito */
function htmlBotaoIdeia(tipo, id) {
    const n = qfdDB.contarIdeias(tipo, id);
    return `<button class="btn-icon btn-ideia" onclick="abrirRegistroIdeia('${tipo}', '${escapeAttr(id)}')" title="Registrar ideia de solução ligada a este requisito (fica fora da lista de requisitos)">
        <i class="fas fa-lightbulb"></i>${n ? `<span class="ideia-contador">${n}</span>` : ''}
    </button>`;
}

/** Último nome informado em "Quem deu a ideia" (conveniência deste navegador; não vai no backup) */
function ultimoAutorIdeia() {
    try { return localStorage.getItem('qfd_ultimo_autor_ideia') || ''; } catch (e) { return ''; }
}

function lembrarAutorIdeia(nome) {
    try { localStorage.setItem('qfd_ultimo_autor_ideia', normalizarAutores(nome)); } catch (e) { /* armazenamento indisponível */ }
}

/** Ao menos um nome em "Quem deu a ideia" é obrigatório na interface (ideias antigas sem nome continuam válidas) */
function validarAutorIdeia(nome) {
    if (!normalizarAutores(nome)) throw new Error('Informe quem deu a ideia (vários nomes: separe por vírgula).');
}

/** Janela de cadastro rápido de ideia já ligada ao requisito; ao salvar, chama loadRequisitos() se existir */
function abrirRegistroIdeia(tipo, id) {
    const req = (tipo === 'cliente' ? qfdDB.getRequisitosCliente({ todos: true }) : qfdDB.getRequisitosProjeto({ todos: true }))
        .find(r => r.id === id);
    if (!req) return;
    document.querySelector('.ideia-rapida-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'ideia-rapida-overlay';
    overlay.innerHTML = `
        <div class="ideia-rapida">
            <h3><i class="fas fa-lightbulb"></i> Registrar ideia de solução</h3>
            <p class="ideia-rapida-req"></p>
            <input type="text" class="form-control" id="ideia-rapida-titulo" maxlength="120" placeholder="Título da ideia">
            <textarea class="form-control" id="ideia-rapida-descricao" rows="3" maxlength="2000" placeholder="Descrição"></textarea>
            <input type="text" class="form-control" id="ideia-rapida-autor" maxlength="300" placeholder="Quem deu a ideia (vários: Ana, Bruno, Carla)" title="Obrigatório. Vários nomes: separe por vírgula">
            <small class="form-text">A ideia vai para o Caderno de Ideias, ligada a este requisito. Ela não entra na lista de requisitos.</small>
            <div class="ideia-rapida-acoes">
                <button type="button" class="btn btn-secondary" data-acao="cancelar">Cancelar</button>
                <button type="button" class="btn btn-primary" data-acao="salvar"><i class="fas fa-save"></i> Registrar</button>
            </div>
        </div>`;
    overlay.querySelector('.ideia-rapida-req').textContent = `Requisito: ${req.descricao}`;
    const fechar = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target.dataset.acao === 'cancelar') fechar(); });
    overlay.querySelector('[data-acao="salvar"]').addEventListener('click', () => {
        try {
            const autor = overlay.querySelector('#ideia-rapida-autor').value;
            validarAutorIdeia(autor);
            qfdDB.addIdeia({
                titulo: overlay.querySelector('#ideia-rapida-titulo').value,
                descricao: overlay.querySelector('#ideia-rapida-descricao').value,
                autor,
                requisitos: [{ tipo, id }]
            });
            lembrarAutorIdeia(autor);
            fechar();
            showAlert('Ideia registrada no Caderno de Ideias.', 'success');
            if (typeof loadRequisitos === 'function') loadRequisitos();
        } catch (err) {
            showAlert(escapeHtml(err.message), 'warning');
        }
    });
    overlay.querySelector('#ideia-rapida-autor').value = ultimoAutorIdeia();
    document.body.appendChild(overlay);
    overlay.querySelector('#ideia-rapida-titulo').focus();
}

// ============================================================================
// ROTEIROS DE PREENCHIMENTO (Spagnolo, 2011 — tese, seção 4.1.5 e Apêndice B)
// ============================================================================


/** Nome curto de um requisito para as perguntas: 'RP2 "Custo de produção"' */
function rotuloRequisito(sigla, req) {
    return `${sigla} "${truncateText(req ? req.descricao : '', 40)}"`;
}

/**
 * Perguntas para a relação Rc x Rp da Matriz QFD: "Pode esse Rp influenciar
 * esse Rc? Esse Rc afeta esse Rp?" — se sim, a relação é fraca, média ou forte.
 * @returns {string[]} linhas de texto
 */
function roteiroRelacaoQFD(rotuloRc, rotuloRp) {
    return [
        `Pode ${rotuloRp} influenciar ${rotuloRc}?`,
        `${rotuloRc} afeta ${rotuloRp}?`,
        'Se sim para alguma: a relação é fraca (1), moderada (3) ou forte (9)? Se não: deixe em branco.'
    ];
}

/**
 * Perguntas do telhado (Rp x Rp) conforme a seta de cada requisito
 * (Apêndice B). As duas primeiras, se "sim", indicam correlação positiva
 * (+ ou ++); as duas últimas, negativa (- ou --). Todas "não": sem correlação.
 *
 * @param {string} sentidoA - 'up' | 'down' | 'none' do requisito da linha (Rpn)
 * @param {string} sentidoB - idem do requisito da coluna (Rpn+1)
 * @returns {{ texto: string, sinal: '+'|'-' }[]}
 */
function roteiroTelhado(sentidoA, sentidoB, a, b) {
    const sub = { up: 'O aumento', down: 'A diminuição', none: 'A manutenção' };
    const ver = { up: 'aumenta', down: 'diminui', none: 'mantém' };
    const oposto = { up: 'diminui', down: 'aumenta', none: 'aumenta ou diminui' };
    const sA = sentidoA in sub ? sentidoA : 'none';
    const sB = sentidoB in sub ? sentidoB : 'none';
    // Perguntas 1 a 3 seguem uma regra única nas 9 combinações da tabela:
    // 1) A no sentido desejado leva B ao sentido desejado? (+)
    // 2) B no sentido desejado leva A ao sentido desejado? (+)
    // 3) A no sentido desejado leva B ao sentido contrário? (-)
    // A 4ª (-) varia na tabela; o texto vem dela, combinação a combinação.
    const quarta = {
        'down|up': ['O aumento', 'aumenta'], 'down|down': ['O aumento', 'diminui'],
        'down|none': ['O aumento ou diminuição', 'aumenta'], 'none|down': ['O aumento', 'aumenta ou diminui'],
        'none|none': ['O aumento ou diminuição', 'mantém'], 'up|down': ['A diminuição', 'diminui'],
        'up|up': ['A diminuição', 'aumenta'], 'up|none': ['O aumento ou diminuição', 'diminui'],
        'none|up': ['A diminuição', 'aumenta ou diminui']
    }[`${sA}|${sB}`];
    return [
        { texto: `${sub[sA]} de ${a} ${ver[sB]} ${b}?`, sinal: '+' },
        { texto: `${sub[sB]} de ${b} ${ver[sA]} ${a}?`, sinal: '+' },
        { texto: `${sub[sA]} de ${a} ${oposto[sB]} ${b}?`, sinal: '-' },
        { texto: `${quarta[0]} de ${b} ${quarta[1]} ${a}?`, sinal: '-' }
    ];
}

/** Roteiro do telhado em texto (balão) */
function textoRoteiroTelhado(sentidoA, sentidoB, a, b) {
    const linhas = roteiroTelhado(sentidoA, sentidoB, a, b).map((p, k) =>
        `${k + 1}. ${p.texto} Sim → ${p.sinal === '+' ? 'positiva (+ ou ++)' : 'negativa (- ou --)'}`);
    return `Como avaliar:\n${linhas.join('\n')}\nTodas "não": sem correlação (0).`;
}

/** Roteiro do telhado em HTML (janela de preenchimento) */
function htmlRoteiroTelhado(sentidoA, sentidoB, a, b) {
    const itens = roteiroTelhado(sentidoA, sentidoB, a, b).map(p =>
        `<li><span></span> <em class="roteiro-sinal ${p.sinal === '+' ? 'positivo' : 'negativo'}">sim → ${p.sinal === '+' ? '+ ou ++' : '- ou --'}</em></li>`);
    const box = document.createElement('div');
    box.className = 'roteiro-box';
    box.innerHTML = `<strong><i class="fas fa-question-circle"></i> Como avaliar</strong>
        <ol>${itens.join('')}</ol><small>Se todas forem "não", não há correlação (0).</small>`;
    roteiroTelhado(sentidoA, sentidoB, a, b).forEach((p, k) => {
        box.querySelectorAll('li > span')[k].textContent = p.texto;
    });
    return box.outerHTML;
}
