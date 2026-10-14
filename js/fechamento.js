/**
 * ============================================================================
 * FECHAMENTO - ABSTRAÇÃO, FORMULAÇÃO DO PROBLEMA E FUNÇÃO GLOBAL
 * ============================================================================
 *
 * Pahl & Beitz: abstração da lista de requisitos em 5 passos (6.2.3),
 * ampliação passo a passo da formulação do problema (6.2.2) e função global
 * como caixa-preta (6.3.1, Figs. 2.2 e 2.4). Dados em qfdDB (getFechamento...).
 */

const PASSOS_ABSTRACAO = [
    { titulo: 'Eliminar as preferências pessoais', dica: 'Retire da lista os desejos de quem participa do projeto que não são necessidades do cliente.' },
    { titulo: 'Omitir o que não tem relação direta com a função e as restrições essenciais', dica: 'Fique só com os requisitos que dizem respeito à função do produto e às restrições que não podem ser violadas.' },
    { titulo: 'Transformar dados quantitativos em qualitativos e reduzir a declarações essenciais', dica: 'Ex.: "tanque de 20 a 160 L" vira "tanque de volume variável".' },
    { titulo: 'Generalizar', dica: 'Amplie o resultado do passo anterior até onde fizer sentido.' },
    { titulo: 'Formular o problema de forma neutra em relação à solução', dica: 'Descreva o que deve ser feito, sem citar como (sem nomear componentes ou princípios).' }
];

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('form-formulacao').addEventListener('submit', handleAddFormulacao);
    loadPage();
});

function loadPage() {
    renderListaRequisitos();
    renderPassos();
    renderFormulacoes();
    renderFuncaoGlobal();
}

/** Requisitos de cliente e de projeto (com a meta) para consulta durante a abstração */
function renderListaRequisitos() {
    const box = document.getElementById('fechamento-lista-requisitos');
    const rcs = qfdDB.getRequisitosCliente();
    let esp = [];
    try { esp = qfdDB.getEspecificacoesOrdenadas(); } catch (e) { esp = []; }
    if (!rcs.length && !esp.length) {
        box.innerHTML = '<p class="competitiva-hint">Nenhum requisito cadastrado.</p>';
        return;
    }
    let html = '<div class="fechamento-req-colunas"><div><h4>Requisitos de cliente</h4><ol>';
    rcs.forEach(r => { html += `<li>${escapeHtml(r.descricao)}</li>`; });
    html += '</ol></div><div><h4>Requisitos de projeto (ordem do QFD)</h4><ol>';
    esp.forEach(e => {
        const meta = e.metaFormatada ? ` <small>(${escapeHtml(`${e.metaFormatada} ${e.unidadeMedida || ''}`.trim())})</small>` : '';
        html += `<li>${escapeHtml(e.requisito.descricao)}${meta}</li>`;
    });
    box.innerHTML = html + '</ol></div></div>';
}

function renderPassos() {
    const f = qfdDB.getFechamento();
    const box = document.getElementById('passos-abstracao');
    box.innerHTML = '';
    PASSOS_ABSTRACAO.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'fechamento-passo';
        item.innerHTML = `
            <div class="fechamento-passo-topo">
                <label for="passo-${i}"><span class="fechamento-passo-num">${i + 1}</span> ${escapeHtml(p.titulo)}</label>
                <button type="button" class="fechamento-sugerir" title="Preenche um rascunho a partir dos requisitos, do QFD e da função global; revise e edite"><i class="fas fa-magic"></i> Sugerir</button>
            </div>
            <small class="form-text">${escapeHtml(p.dica)}</small>
            <textarea id="passo-${i}" class="form-control" rows="4" maxlength="3000" data-passo="${i}"></textarea>`;
        const campo = item.querySelector('textarea');
        campo.value = f.abstracao[i];
        campo.addEventListener('change', () => {
            qfdDB.setPassoAbstracao(i, campo.value);
            atualizarContagemPassos();
        });
        item.querySelector('.fechamento-sugerir').addEventListener('click', () => {
            const sugestao = sugerirPassoAbstracao(i);
            if (!sugestao) { showAlert('Cadastre requisitos (e a função global, no 5º passo) para gerar a sugestão.', 'warning'); return; }
            if (campo.value.trim() && campo.value.trim() !== sugestao && !confirm('Substituir o texto deste passo pela sugestão?')) return;
            campo.value = sugestao;
            qfdDB.setPassoAbstracao(i, sugestao);
            atualizarContagemPassos();
        });
        box.appendChild(item);
    });
    atualizarContagemPassos();
}

/**
 * Rascunho automático de cada passo da abstração, a partir dos dados:
 * 1) requisitos no QFD; 2) sem o terço inferior; 3) metas trocadas por
 * expressões qualitativas pelo sentido de melhoria; 4) só o terço superior;
 * 5) frase com a função global. É ponto de partida: o usuário revisa.
 */
function sugerirPassoAbstracao(indice) {
    let esp = [];
    try { esp = qfdDB.getEspecificacoesOrdenadas(); } catch (e) { esp = []; }
    const rcs = qfdDB.getRequisitosCliente();
    const total = esp.length;
    const t1 = Math.ceil(total / 3), t2 = Math.ceil((2 * total) / 3);
    const lista = itens => itens.map(t => `- ${t}`).join('\n');
    // "Peso total (kg)" -> "Peso total"
    const semUnidade = d => String(d).replace(/\s*\([^)]*\)\s*$/, '').trim();
    const qualitativo = e => {
        const nome = semUnidade(e.requisito.descricao);
        if (e.requisito.sentidoMelhoria === 'down') return `${nome} o menor possível`;
        if (e.requisito.sentidoMelhoria === 'up') return `${nome} o maior possível`;
        return `${nome} adequado(a)`;
    };
    const metaTexto = e => (e.metaFormatada ? ` (${`${e.metaFormatada} ${e.unidadeMedida || ''}`.trim()})` : '');

    switch (indice) {
        case 0:
            if (!rcs.length && !esp.length) return '';
            return [
                rcs.length ? `Requisitos de cliente:\n${lista(rcs.map(r => r.descricao))}` : '',
                esp.length ? `Requisitos de projeto:\n${lista(esp.map(e => e.requisito.descricao + metaTexto(e)))}` : ''
            ].filter(Boolean).join('\n\n');
        case 1:
            if (!esp.length) return '';
            return lista(esp.slice(0, t2).map(e => e.requisito.descricao + metaTexto(e)));
        case 2:
            if (!esp.length) return '';
            return lista(esp.slice(0, t2).map(qualitativo));
        case 3:
            if (!esp.length) return '';
            return lista(esp.slice(0, t1).map(qualitativo));
        case 4: {
            const nome = qfdDB.getFechamento().funcaoGlobal.nome;
            if (!nome && !esp.length) return '';
            const essenciais = esp.slice(0, t1).map(qualitativo).map(t => t.charAt(0).toLowerCase() + t.slice(1));
            const juntar = l => l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l.join('');
            return `${nome || 'Cumprir a função global do produto'}${essenciais.length ? `, com ${juntar(essenciais)}` : ''}.`;
        }
        default:
            return '';
    }
}

function atualizarContagemPassos() {
    const n = qfdDB.getFechamento().abstracao.filter(t => t.trim()).length;
    document.getElementById('total-passos').textContent = `${n}/5`;
}

function handleAddFormulacao(event) {
    event.preventDefault();
    const campo = document.getElementById('formulacao-texto');
    try {
        qfdDB.addFormulacao(campo.value);
        campo.value = '';
        renderFormulacoes();
    } catch (err) {
        showAlert(escapeHtml(err.message), 'warning');
    }
}

function renderFormulacoes() {
    const f = qfdDB.getFechamento();
    const lista = document.getElementById('lista-formulacoes');
    lista.innerHTML = f.formulacoes.length ? '' : '<li class="competitiva-hint">Nenhuma formulação registrada.</li>';
    f.formulacoes.forEach(x => {
        const li = document.createElement('li');
        li.className = x.id === f.formulacaoEscolhida ? 'formulacao-escolhida' : '';
        li.dataset.id = x.id;
        li.innerHTML = `
            <label><input type="radio" name="formulacao-escolhida"> <span></span></label>
            <button type="button" class="btn-icon btn-delete" title="Remover formulação"><i class="fas fa-trash"></i></button>`;
        li.querySelector('span').textContent = x.texto;
        const radio = li.querySelector('input');
        radio.checked = x.id === f.formulacaoEscolhida;
        radio.title = 'Adotar esta formulação';
        radio.addEventListener('change', () => { qfdDB.escolherFormulacao(x.id); renderFormulacoes(); });
        li.querySelector('.btn-delete').addEventListener('click', () => {
            qfdDB.removeFormulacao(x.id);
            renderFormulacoes();
        });
        lista.appendChild(li);
    });
}

function renderFuncaoGlobal() {
    const fg = qfdDB.getFechamento().funcaoGlobal;
    const nome = document.getElementById('funcao-nome');
    nome.value = fg.nome;
    nome.onchange = () => { qfdDB.setFuncaoGlobal({ nome: nome.value }); desenharCaixaPreta(); };
    ['entradas', 'saidas'].forEach(lado => {
        const box = document.getElementById(`fluxos-${lado}`);
        box.innerHTML = '';
        Object.entries(TIPOS_FLUXO).forEach(([tipo, rotulo]) => {
            const grupo = document.createElement('div');
            grupo.className = 'form-group';
            grupo.innerHTML = `<label>${rotulo}</label><textarea class="form-control" rows="2" data-lado="${lado}" data-tipo="${tipo}" placeholder="Um item por linha"></textarea>`;
            const campo = grupo.querySelector('textarea');
            campo.value = fg[lado][tipo].join('\n');
            campo.addEventListener('change', () => {
                qfdDB.setFuncaoGlobal({ [lado]: { [tipo]: campo.value } });
                desenharCaixaPreta();
            });
            box.appendChild(grupo);
        });
    });
    document.getElementById('caixa-preta-legenda').innerHTML = htmlLegendaFluxos();
    desenharCaixaPreta();
}

function desenharCaixaPreta() {
    document.getElementById('caixa-preta').innerHTML = svgCaixaPreta(qfdDB.getFechamento().funcaoGlobal);
}
