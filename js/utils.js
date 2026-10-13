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
            svg += `<circle cx="${x(nota)}" cy="${yRow(i) + offset(k)}" r="${k === 0 ? 6 : 5}" fill="${cor}" stroke="white" stroke-width="1.5"><title>${escapeHtml(p.nome)} — RC${c.numero}: nota ${nota}</title></circle>`;
        });
    });

    clientes.forEach((c, i) => {
        if (!c.meta) return;
        svg += `<rect x="${x(c.meta) - 7}" y="${yRow(i) - 7}" width="14" height="14" fill="none" stroke="#0f172a" stroke-width="2"><title>Meta RC${c.numero}: ${c.meta}</title></rect>`;
    });
    svg += '</svg>';

    let legenda = '<div class="grafico-legenda">';
    produtos.forEach((p, k) => {
        legenda += `<span><i style="background:${CORES_PRODUTOS[k % CORES_PRODUTOS.length]}"></i>${escapeHtml(p.nome)}</span>`;
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

/** Botão 💡 com o número de ideias ligadas ao requisito */
function htmlBotaoIdeia(tipo, id) {
    const n = qfdDB.contarIdeias(tipo, id);
    return `<button class="btn-icon btn-ideia" onclick="abrirRegistroIdeia('${tipo}', '${escapeAttr(id)}')" title="Registrar ideia de solução ligada a este requisito (fica fora da lista de requisitos)">
        <i class="fas fa-lightbulb"></i>${n ? `<span class="ideia-contador">${n}</span>` : ''}
    </button>`;
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
            <input type="text" class="form-control" id="ideia-rapida-autor" maxlength="60" placeholder="Autor (opcional)">
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
            qfdDB.addIdeia({
                titulo: overlay.querySelector('#ideia-rapida-titulo').value,
                descricao: overlay.querySelector('#ideia-rapida-descricao').value,
                autor: overlay.querySelector('#ideia-rapida-autor').value,
                requisitos: [{ tipo, id }]
            });
            fechar();
            showAlert('Ideia registrada no Caderno de Ideias.', 'success');
            if (typeof loadRequisitos === 'function') loadRequisitos();
        } catch (err) {
            showAlert(escapeHtml(err.message), 'warning');
        }
    });
    document.body.appendChild(overlay);
    overlay.querySelector('#ideia-rapida-titulo').focus();
}

// ============================================================================
// ROTEIROS DE PREENCHIMENTO (Spagnolo, 2011 — tese, seção 4.1.5 e Apêndice B)
// ============================================================================

const FONTE_ROTEIRO = 'Spagnolo (2011)';

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
    return `Como avaliar (${FONTE_ROTEIRO}):\n${linhas.join('\n')}\nTodas "não": sem correlação (0).`;
}

/** Roteiro do telhado em HTML (janela de preenchimento) */
function htmlRoteiroTelhado(sentidoA, sentidoB, a, b) {
    const itens = roteiroTelhado(sentidoA, sentidoB, a, b).map(p =>
        `<li><span></span> <em class="roteiro-sinal ${p.sinal === '+' ? 'positivo' : 'negativo'}">sim → ${p.sinal === '+' ? '+ ou ++' : '- ou --'}</em></li>`);
    const box = document.createElement('div');
    box.className = 'roteiro-box';
    box.innerHTML = `<strong><i class="fas fa-question-circle"></i> Como avaliar</strong> <small>(${FONTE_ROTEIRO}, Apêndice B)</small>
        <ol>${itens.join('')}</ol><small>Se todas forem "não", não há correlação (0).</small>`;
    roteiroTelhado(sentidoA, sentidoB, a, b).forEach((p, k) => {
        box.querySelectorAll('li > span')[k].textContent = p.texto;
    });
    return box.outerHTML;
}
