/**
 * ============================================================================
 * TESTES AUTOMATIZADOS DO SISTEMA QFD
 * ============================================================================
 *
 * Executados por testes.html. Os dados do projeto real (localStorage) são
 * guardados antes dos testes e restaurados ao final.
 *
 * Para adicionar um teste: test('nome', () => { ... }) dentro de uma suite(),
 * usando assert(condição, 'mensagem') ou assertEqual(obtido, esperado).
 */

const suites = [];
let suiteAtual = null;

function suite(nome, fn) {
    suiteAtual = { nome, testes: [] };
    suites.push(suiteAtual);
    fn();
}

function test(nome, fn) {
    suiteAtual.testes.push({ nome, fn });
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'condição falsa');
}

function assertEqual(obtido, esperado, msg) {
    const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
    if (a !== b) throw new Error(`${msg ? msg + ': ' : ''}esperado ${b}, obtido ${a}`);
}

/** Troca window.alert por uma função que só registra as mensagens */
function capturarAlerts() {
    const mensagens = [];
    const original = window.alert;
    window.alert = m => mensagens.push(String(m));
    return { mensagens, restaurar: () => { window.alert = original; } };
}

/** Projeto de exemplo, com textos que exercitam aspas e < > */
function criarProjetoExemplo() {
    qfdDB.clearAllData();
    const rc = [
        qfdDB.addRequisitoCliente('Fácil de usar por idosos', 'Obs RC1 com "aspas" e <b>tag</b>'),
        qfdDB.addRequisitoCliente('Leve e "portátil"', 'Obs RC2'),
        qfdDB.addRequisitoCliente('Preço menor que R$ 100')
    ];
    const rp = [
        qfdDB.addRequisitoProjeto('Peso total (kg)', 'down', 3, 'Obs RP1 "pesagem"'),
        qfdDB.addRequisitoProjeto('Custo de produção', 'down', 2),
        qfdDB.addRequisitoProjeto('Número de botões', 'none', 1, 'Obs RP3')
    ];
    qfdDB.setComparacaoCliente(rc[0].id, rc[1].id, 3);
    qfdDB.setComparacaoCliente(rc[0].id, rc[2].id, 5);
    qfdDB.setComparacaoCliente(rc[1].id, rc[2].id, 1);
    qfdDB.setCorrelacaoProjeto(rp[0].id, rp[1].id, '--');
    qfdDB.setCorrelacaoProjeto(rp[1].id, rp[2].id, '+');
    rc.forEach((c, i) => rp.forEach((p, j) => qfdDB.setMatrizQFD(c.id, p.id, [1, 3, 5][(i + j) % 3])));
    qfdDB.getEspecificacoesProjeto();
    qfdDB.updateEspecificacao(rp[0].id, { unidadeMedida: 'kg', valorUnitario: '1,2', observacao: 'Spec "pesagem" a 25 °C' });
    return { rc, rp };
}

// ============================================================================
// UTILITÁRIOS (utils.js)
// ============================================================================

suite('Utilitários', () => {
    test('roteiro do telhado segue o Apêndice B (Spagnolo, 2011)', () => {
        const q = (a, b) => roteiroTelhado(a, b, 'Rpn', 'Rpn+1').map(p => p.texto);
        assertEqual(q('down', 'up'), [
            'A diminuição de Rpn aumenta Rpn+1?', 'O aumento de Rpn+1 diminui Rpn?',
            'A diminuição de Rpn diminui Rpn+1?', 'O aumento de Rpn+1 aumenta Rpn?']);
        assertEqual(q('none', 'none'), [
            'A manutenção de Rpn mantém Rpn+1?', 'A manutenção de Rpn+1 mantém Rpn?',
            'A manutenção de Rpn aumenta ou diminui Rpn+1?', 'O aumento ou diminuição de Rpn+1 mantém Rpn?']);
        assertEqual(q('up', 'none'), [
            'O aumento de Rpn mantém Rpn+1?', 'A manutenção de Rpn+1 aumenta Rpn?',
            'O aumento de Rpn aumenta ou diminui Rpn+1?', 'O aumento ou diminuição de Rpn+1 diminui Rpn?']);
        assertEqual(roteiroTelhado('up', 'up', 'a', 'b').map(p => p.sinal), ['+', '+', '-', '-']);
    });
    test('célula anterior: matriz triangular e grade (ordem inversa do Enter)', () => {
        // triangular n=4: (0,1) (0,2) (0,3) (1,2) (1,3) (2,3)
        assertEqual(getPrevTriangularCell(1, 2, 4), { i: 0, j: 3 });
        assertEqual(getPrevTriangularCell(1, 3, 4), { i: 1, j: 2 });
        assertEqual(getPrevTriangularCell(0, 1, 4), null);
        assertEqual(getPrevGridCell(1, 0, 3), { i: 0, j: 2 });
        assertEqual(getPrevGridCell(2, 2, 3), { i: 2, j: 1 });
        assertEqual(getPrevGridCell(0, 0, 3), null);
    });
    test('escapeHtml escapa < > & e aceita null', () => {
        assertEqual(escapeHtml('<b>"a" & b</b>'), '&lt;b&gt;"a" &amp; b&lt;/b&gt;');
        assertEqual(escapeHtml(null), '');
    });
    test('escapeAttr escapa aspas e preserva quebras de linha', () => {
        assertEqual(escapeAttr('a "b"\n<c>'), 'a &quot;b&quot;&#10;&lt;c&gt;');
    });
    test('truncateText', () => {
        assertEqual(truncateText('abcdef', 3), 'abc...');
        assertEqual(truncateText('abc', 3), 'abc');
        assertEqual(truncateText(null, 3), '');
    });
    test('getSentidoSymbol aceita valores novos e antigos', () => {
        assertEqual(['up', 'down', 'none', 'Crescente', 'xx'].map(getSentidoSymbol), ['↑', '↓', '*', '↑', '?']);
    });
    test('csvCell duplica aspas internas', () => {
        assertEqual(csvCell('diz "oi"'), '"diz ""oi"""');
    });
    test('parseCSV: aspas, vírgulas, BOM, CRLF, quebra de linha no campo e linhas vazias', () => {
        const rows = parseCSV('﻿a,"b, c","d ""e"""\r\n\r\n1,"multi\nlinha",3\n');
        assertEqual(rows, [['a', 'b, c', 'd "e"'], ['1', 'multi\nlinha', '3']]);
    });
    test('parseCSV detecta ponto e vírgula (Excel pt-BR)', () => {
        assertEqual(parseCSV('Descrição;Peso\nLeve, barato;1'), [['Descrição', 'Peso'], ['Leve, barato', '1']]);
    });
    test('parseNumero: vírgula decimal, milhar, unidade e texto sem número', () => {
        assertEqual(['1,2', '1.234,5 kg', '1,234.5', '1.500', '0.25', '≤ 20 kW', '-3', 'aprox. 7,5', 'abc', '', null].map(parseNumero),
            [1.2, 1234.5, 1234.5, 1500, 0.25, 20, -3, 7.5, null, null, null]);
    });
});

// ============================================================================
// BANCO DE DADOS (database.js)
// ============================================================================

suite('Banco de dados', () => {
    test('adicionar, editar e remover requisito de cliente', () => {
        qfdDB.clearAllData();
        const r = qfdDB.addRequisitoCliente('  Requisito de teste  ', ' obs ');
        assertEqual([r.descricao, r.observacao], ['Requisito de teste', 'obs']);
        qfdDB.updateRequisitoCliente(r.id, { descricao: 'Outro texto' });
        assertEqual(qfdDB.getRequisitosCliente()[0].descricao, 'Outro texto');
        qfdDB.removeRequisitoCliente(r.id);
        assertEqual(qfdDB.getRequisitosCliente().length, 0);
    });
    test('remover requisito de projeto remove correlações e relações ligadas a ele', () => {
        const { rp } = criarProjetoExemplo();
        qfdDB.removeRequisitoProjeto(rp[0].id);
        const d = qfdDB.loadData();
        assert(!d.correlacaoProjeto.some(c => c.requisito1 === rp[0].id || c.requisito2 === rp[0].id), 'correlação órfã');
        assert(!d.matrizQFD.some(m => m.requisitoProjeto === rp[0].id), 'relação QFD órfã');
        assert(qfdDB.validateData().isValid, qfdDB.validateData().errors.join('; '));
    });
    test('pesos dos requisitos de cliente somam 100%', () => {
        criarProjetoExemplo();
        qfdDB.calculateImportanciaCliente();
        const soma = qfdDB.getRequisitosCliente().reduce((s, r) => s + r.peso, 0);
        assert(Math.abs(soma - 1) < 1e-9, `soma = ${soma}`);
    });
    test('pesos relativos dos requisitos de projeto somam 100%', () => {
        criarProjetoExemplo();
        qfdDB.calculateImportanciaCliente();
        qfdDB.calculateImportanciaProjeto();
        const soma = qfdDB.getRequisitosProjeto().reduce((s, r) => s + (r.pesoRelativo || 0), 0);
        assert(Math.abs(soma - 1) < 1e-9, `soma = ${soma}`);
    });
    test('requisito fora do QFD: sai da comparação, dos pesos, da matriz e das especificações; volta ao desmarcar', () => {
        const { rc, rp } = criarProjetoExemplo();
        qfdDB.updateRequisitoCliente(rc[0].id, { classificacao: 'funcao', justificativaClassificacao: 'Define a função' });
        qfdDB.updateRequisitoProjeto(rp[2].id, { classificacao: 'boa-pratica', justificativaClassificacao: 'Boa prática' });
        qfdDB.calculateImportanciaCliente();
        qfdDB.calculateImportanciaProjeto();

        assertEqual(qfdDB.getRequisitosCliente().map(r => r.id), [rc[1].id, rc[2].id], 'RC no QFD');
        assertEqual(qfdDB.getRequisitosCliente({ todos: true }).length, 3, 'cadastro mantém todos');
        assertEqual(qfdDB.getComparacoesCliente().length, 1, 'só a comparação RC2 × RC3');
        const pesos = qfdDB.getRequisitosCliente({ todos: true }).map(r => r.peso);
        assertEqual(pesos[0], 0, 'peso do RC fora do QFD');
        assert(Math.abs(pesos[1] + pesos[2] - 1) < 1e-9, 'pesos dos demais somam 100%');
        assert(qfdDB.getMatrizQFDCompleta().every(m => m.requisitoCliente !== rc[0].id && m.requisitoProjeto !== rp[2].id), 'relações fora do QFD');
        const rp3 = qfdDB.getRequisitosProjeto({ todos: true })[2];
        assertEqual([rp3.importanciaAbsoluta, rp3.pesoRelativo], [0, 0]);
        assertEqual(qfdDB.getEspecificacoesOrdenadas().length, 2, 'especificações só dos RP no QFD');
        assertEqual(qfdDB.getEspecificacoesStats().total, 2);
        assertEqual(qfdDB.getAnaliseAtendimento().projetos.length, 2);

        // os dados guardados voltam a valer ao desmarcar
        assertEqual(qfdDB.loadData().comparacaoCliente.length, 3, 'comparações guardadas');
        qfdDB.updateRequisitoCliente(rc[0].id, { classificacao: '', justificativaClassificacao: '' });
        qfdDB.calculateImportanciaCliente();
        assertEqual([qfdDB.getRequisitosCliente().length, qfdDB.getComparacoesCliente().length], [3, 3]);
        assert(qfdDB.getRequisitosCliente()[0].peso > 0, 'peso voltou');
    });
    test('soma de cada RP = Σ relação × importância do RC', () => {
        const { rc, rp } = criarProjetoExemplo();
        qfdDB.calculateImportanciaProjeto();
        const clientes = qfdDB.getRequisitosCliente();
        qfdDB.getRequisitosProjeto().forEach((p, j) => {
            const esperado = rc.reduce((s, c) => {
                const imp = clientes.find(x => x.id === c.id).importancia;
                return s + qfdDB.getMatrizQFD(c.id, rp[j].id) * imp;
            }, 0);
            assert(Math.abs(p.importanciaAbsoluta - esperado) < 1e-9, `RP${j + 1}: ${p.importanciaAbsoluta} ≠ ${esperado}`);
        });
    });
    test('ranking de RP: empates na mesma posição (1, 1, 3)', () => {
        const { rc, rp } = criarProjetoExemplo();
        rc.forEach(c => rp.forEach(p => qfdDB.setMatrizQFD(c.id, p.id, 0)));
        qfdDB.setMatrizQFD(rc[0].id, rp[0].id, 9);
        qfdDB.setMatrizQFD(rc[0].id, rp[1].id, 9);
        qfdDB.setMatrizQFD(rc[0].id, rp[2].id, 3);
        assertEqual(qfdDB.getRequisitosProjeto().map(p => p.importanciaRelativa), [1, 1, 3]);
    });
    test('sem relações na matriz, o percentual dos RP volta a zero', () => {
        const { rc, rp } = criarProjetoExemplo();
        rc.forEach(c => rp.forEach(p => qfdDB.setMatrizQFD(c.id, p.id, 0)));
        assertEqual(qfdDB.getRequisitosProjeto().map(p => p.pesoRelativo), [0, 0, 0]);
    });
    test('especificações: ordem pelo QFD, texto explicativo e aspectos do telhado (--)', () => {
        const { rp } = criarProjetoExemplo();
        const lista = qfdDB.getEspecificacoesOrdenadas();
        assertEqual(lista.length, 3);
        assertEqual(lista.map(l => l.rank), [1, 2, 3]);
        const peso = lista.find(l => l.requisito.id === rp[0].id);
        assertEqual(peso.observacao, 'Spec "pesagem" a 25 °C');
        assert(/Custo de produção/.test(peso.aspectosIndesejaveis), 'conflito -- não listado: ' + peso.aspectosIndesejaveis);
    });
    test('aspectos editados manualmente não são sobrescritos pelo telhado', () => {
        const { rp } = criarProjetoExemplo();
        qfdDB.updateEspecificacao(rp[0].id, { aspectosIndesejaveis: 'Texto meu' });
        const peso = qfdDB.getEspecificacoesOrdenadas().find(l => l.requisito.id === rp[0].id);
        assertEqual(peso.aspectosIndesejaveis, 'Texto meu');
    });
    test('detecção de duplicados ignora maiúsculas e espaços, e o próprio requisito', () => {
        qfdDB.clearAllData();
        const r = qfdDB.addRequisitoCliente('Fácil de usar pelo idoso');
        assert(qfdDB.findRequisitoDuplicado('cliente', '  fácil de   USAR pelo idoso '), 'não detectou');
        assertEqual(qfdDB.findRequisitoDuplicado('cliente', 'Fácil de usar pelo idoso', r.id), null);
        assertEqual(qfdDB.findRequisitoDuplicado('projeto', 'Fácil de usar pelo idoso'), null);
    });
});

// ============================================================================
// VERSIONAMENTO E MIGRAÇÃO
// ============================================================================

suite('Versionamento dos dados', () => {
    const dadosV1 = () => ({
        requisitosCliente: [{ id: 'c1', descricao: 'Leve' }],
        requisitosProjeto: [
            { id: 'p1', descricao: 'Peso', sentidoMelhoria: 'Decrescente' },
            { id: 'p2', descricao: 'Custo', sentidoMelhoria: 'crescente', dificuldadeTecnica: '3' },
            { id: 'p3', descricao: 'X', sentidoMelhoria: '???' }
        ],
        comparacaoCliente: [], matrizQFD: [],
        correlacaoProjeto: [{ requisito1: 'p1', requisito2: 'p2', correlacao: '--' }],
        metadata: { created: '2025-01-01', lastModified: '2025-01-01', version: '1.0' }
    });

    test('dados v1 no navegador são migrados ao carregar', () => {
        localStorage.setItem('qfd_data', JSON.stringify(dadosV1()));
        qfdDB.loadData();
        const d = JSON.parse(localStorage.getItem('qfd_data'));
        assertEqual(d.metadata.schemaVersion, SCHEMA_VERSION);
        assertEqual(d.metadata.version, undefined, 'campo version antigo');
        assertEqual(d.metadata.created, '2025-01-01');
        assertEqual(d.requisitosProjeto.map(r => r.sentidoMelhoria), ['down', 'up', 'none']);
        assertEqual(d.requisitosProjeto.map(r => r.dificuldadeTecnica), [1, 3, 1]);
        assertEqual([d.requisitosCliente[0].observacao, d.requisitosCliente[0].peso], ['', 0]);
        assert(Array.isArray(d.especificacoesProjeto), 'especificacoesProjeto ausente');
        assertEqual(d.correlacaoProjeto.length, 1, 'dados perdidos');
        assertEqual(d.avaliacaoCompetitiva.produtos.map(p => p.id), [PRODUTO_NOSSO_ID]);
    });
    test('dados v2 ganham a avaliação competitiva vazia (v3) sem perder nada', () => {
        const d = {
            requisitosCliente: [{ id: 'c1', descricao: 'Leve', observacao: '', importancia: 0, peso: 0 }],
            requisitosProjeto: [], comparacaoCliente: [], correlacaoProjeto: [], matrizQFD: [], especificacoesProjeto: [],
            metadata: { created: '2026-01-01', schemaVersion: 2 }
        };
        assert(qfdDB.importData(d), qfdDB.lastImportError);
        const r = qfdDB.loadData();
        assertEqual(r.metadata.schemaVersion, SCHEMA_VERSION);
        assertEqual(r.requisitosCliente[0].descricao, 'Leve');
        assertEqual([r.avaliacaoCompetitiva.produtos.length, r.avaliacaoCompetitiva.notasCliente.length], [1, 0]);
    });
    test('v3 → v4: "valor unitário" vira meta tipada; texto não numérico fica para revisar', () => {
        const d = {
            requisitosCliente: [],
            requisitosProjeto: [
                { id: 'p1', descricao: 'Peso', sentidoMelhoria: 'down' },
                { id: 'p2', descricao: 'Potência', sentidoMelhoria: 'up' },
                { id: 'p3', descricao: 'Pressão', sentidoMelhoria: 'none' },
                { id: 'p4', descricao: 'Diâmetro', sentidoMelhoria: 'none' }
            ],
            comparacaoCliente: [], correlacaoProjeto: [], matrizQFD: [],
            especificacoesProjeto: [
                { requisitoProjetoId: 'p1', unidadeMedida: 'kg', valorUnitario: '1,2', observacao: '' },
                { requisitoProjetoId: 'p2', unidadeMedida: 'kW', valorUnitario: 'aprox. 3', observacao: '' },
                { requisitoProjetoId: 'p3', unidadeMedida: 'bar', valorUnitario: '80 ± 5', observacao: '' },
                { requisitoProjetoId: 'p4', unidadeMedida: 'mm', valorUnitario: '10 a 12', observacao: '' }
            ],
            metadata: { created: '2026-01-01', schemaVersion: 3 }
        };
        assert(qfdDB.importData(d), qfdDB.lastImportError);
        const esp = qfdDB.loadData().especificacoesProjeto;
        const de = id => esp.find(e => e.requisitoProjetoId === id);
        assertEqual([de('p1').tipoMeta, de('p1').valorMeta, de('p1').valorUnitario], ['<=', 1.2, undefined], 'p1');
        assertEqual([de('p2').tipoMeta, de('p2').valorMeta, de('p2').revisarMeta, de('p2').metaTexto], ['', null, true, 'aprox. 3'], 'p2');
        assertEqual([formatarMeta(de('p3')), formatarMeta(de('p4'))], ['80 ± 5', '10 a 12']);
        const stats = qfdDB.getEspecificacoesStats();
        assertEqual([stats.completed, stats.total], [3, 4], 'completude exige meta válida');
    });
    test('interpretarMetaTexto e atingeMeta: tipos, intervalo e tolerância', () => {
        const tipo = t => { const m = interpretarMetaTexto(t, 'up'); return [m.tipoMeta, m.valorMeta, m.valorMax, m.tolerancia]; };
        assertEqual(tipo('≥ 20 kW'), ['>=', 20, null, null]);
        assertEqual(tipo('<= 5'), ['<=', 5, null, null]);
        assertEqual(tipo('= 7,5'), ['=', 7.5, null, null]);
        assertEqual(tipo('80 +/- 5'), ['=', 80, null, 5]);
        assertEqual(tipo('10-12'), ['faixa', 10, 12, null]);
        assertEqual(interpretarMetaTexto('12 a 10', 'up').revisarMeta, true, 'intervalo invertido');
        const faixa = { tipoMeta: 'faixa', valorMeta: 10, valorMax: 12 };
        const nominal = { tipoMeta: '=', valorMeta: 80, tolerancia: 5 };
        assertEqual([atingeMeta(faixa, 11), atingeMeta(faixa, 12.5), atingeMeta(nominal, 85), atingeMeta(nominal, 85.1)],
            [true, false, true, false]);
        assertEqual(metaDefinida({ tipoMeta: 'faixa', valorMeta: 10, valorMax: 10 }), false, 'faixa vazia');
    });
    test('v4 → v5: requisitos ganham classificação vazia (todos continuam no QFD)', () => {
        const d = {
            requisitosCliente: [{ id: 'c1', descricao: 'Leve', observacao: '', importancia: 0, peso: 0 }],
            requisitosProjeto: [{ id: 'p1', descricao: 'Peso', sentidoMelhoria: 'down', dificuldadeTecnica: 1, observacao: '' }],
            comparacaoCliente: [], correlacaoProjeto: [], matrizQFD: [], especificacoesProjeto: [],
            metadata: { created: '2026-01-01', schemaVersion: 4 }
        };
        assert(qfdDB.importData(d), qfdDB.lastImportError);
        const r = qfdDB.loadData();
        assertEqual([r.requisitosCliente[0].classificacao, r.requisitosProjeto[0].justificativaClassificacao], ['', '']);
        assertEqual([qfdDB.getRequisitosCliente().length, qfdDB.getRequisitosProjeto().length], [1, 1]);
    });
    test('v5 → v6: projeto ganha nome e e-mails vazios', () => {
        const d = {
            requisitosCliente: [], requisitosProjeto: [], comparacaoCliente: [], correlacaoProjeto: [],
            matrizQFD: [], especificacoesProjeto: [], metadata: { created: '2026-01-01', schemaVersion: 5 }
        };
        assert(qfdDB.importData(d), qfdDB.lastImportError);
        assertEqual(qfdDB.loadData().projeto, { nome: '', emails: [] });
    });
    test('banco novo já nasce na versão atual', () => {
        qfdDB.clearAllData();
        assertEqual(qfdDB.loadData().metadata.schemaVersion, SCHEMA_VERSION);
    });
    test('importar backup antigo migra os dados', () => {
        const d = dadosV1(); delete d.metadata;
        assert(qfdDB.importData(d), qfdDB.lastImportError);
        const r = qfdDB.loadData();
        assertEqual(r.metadata.schemaVersion, SCHEMA_VERSION);
        assertEqual(r.especificacoesProjeto.length, 3);
    });
    test('importar backup de versão mais nova é recusado sem alterar os dados', () => {
        qfdDB.clearAllData();
        qfdDB.addRequisitoCliente('Existente');
        const ok = qfdDB.importData({ requisitosCliente: [], requisitosProjeto: [], metadata: { schemaVersion: SCHEMA_VERSION + 1 } });
        assertEqual(ok, false);
        assert(/versão/.test(qfdDB.lastImportError), qfdDB.lastImportError);
        assertEqual(qfdDB.getRequisitosCliente().length, 1);
    });
    test('importar arquivo que não é projeto QFD ou JSON inválido é recusado', () => {
        assertEqual(qfdDB.importData('{"foo":1}'), false);
        assertEqual(qfdDB.importData('{xx'), false);
        assertEqual(qfdDB.importData('[1,2]'), false);
    });
});

// ============================================================================
// TRATAMENTO DE ERROS
// ============================================================================

suite('Caderno de ideias', () => {
    test('ideias: ligadas a requisitos, contador, status e fora das tabelas de requisitos', () => {
        const { rc, rp } = criarProjetoExemplo();
        const ideia = qfdDB.addIdeia({ titulo: 'Chassi de alumínio', descricao: 'Perfil extrudado', autor: 'Ana',
            requisitos: [{ tipo: 'cliente', id: rc[1].id }, { tipo: 'projeto', id: rp[0].id }, { tipo: 'projeto', id: 'nao-existe' }] });
        assertEqual(ideia.requisitos.length, 2, 'ligação a requisito inexistente');
        assertEqual([qfdDB.contarIdeias('cliente', rc[1].id), qfdDB.contarIdeias('cliente', rc[0].id)], [1, 0]);
        assertEqual([qfdDB.getRequisitosCliente().length, qfdDB.getRequisitosProjeto().length], [3, 3], 'ideia não vira requisito');
        let erro = '';
        try { qfdDB.addIdeia({ titulo: '  ' }); } catch (e) { erro = e.message; }
        assert(/título/.test(erro), 'aceitou ideia sem título');
        qfdDB.updateIdeia(ideia.id, { status: 'promissora' });
        qfdDB.removeRequisitoProjeto(rp[0].id);
        const salva = qfdDB.getIdeias()[0];
        assertEqual([salva.status, salva.requisitos.map(r => r.tipo)], ['promissora', ['cliente']], 'requisito excluído sai da ideia');
    });
    test('falhas: criar requisito neutro a partir da falha', () => {
        criarProjetoExemplo();
        const falha = qfdDB.addFalha({ falha: 'Cabo do acelerador rompe', causa: 'Fadiga por flexão', produto: 'Modelo 2019' });
        let erro = '';
        try { qfdDB.criarRequisitoDeFalha(falha.id, 'projeto', 'curto'); } catch (e) { erro = e.message; }
        assert(/10 caracteres/.test(erro), 'aceitou descrição curta');
        const req = qfdDB.criarRequisitoDeFalha(falha.id, 'projeto', 'Resistir a 100 mil ciclos de flexão do comando');
        assert(req.observacao.includes('Cabo do acelerador rompe'), 'origem não registrada no requisito');
        assertEqual(qfdDB.getFalhas()[0].requisitoGerado, { tipo: 'projeto', id: req.id });
        assertEqual(qfdDB.getRequisitosProjeto().length, 4);
    });
    test('v6 → v7: caderno de ideias vazio', () => {
        const d = {
            requisitosCliente: [], requisitosProjeto: [], comparacaoCliente: [], correlacaoProjeto: [],
            matrizQFD: [], especificacoesProjeto: [], metadata: { created: '2026-01-01', schemaVersion: 6 }
        };
        assert(qfdDB.importData(d), qfdDB.lastImportError);
        assertEqual(qfdDB.loadData().cadernoIdeias, { ideias: [], falhas: [] });
    });
});

suite('Projeto e envio por e-mail', () => {
    test('e-mails: separa por vírgula/linha, tira repetidos e recusa inválidos', () => {
        qfdDB.clearAllData();
        const p = qfdDB.setProjeto({ nome: '  Semeadora Ágil  ', emails: 'a@x.com; b@y.com.br\nA@X.com, ' });
        assertEqual([p.nome, p.emails], ['Semeadora Ágil', ['a@x.com', 'b@y.com.br']]);
        let erro = '';
        try { qfdDB.setProjeto({ emails: 'ok@x.com, sem-arroba, c@d' }); } catch (e) { erro = e.message; }
        assert(/sem-arroba, c@d/.test(erro), 'não listou os inválidos: ' + erro);
        assertEqual(qfdDB.getProjeto().emails, ['a@x.com', 'b@y.com.br'], 'inválido não pode sobrescrever');
    });
    test('enviar por e-mail: baixa o backup e abre mailto com envolvidos e assunto "qfd - nome"', () => {
        qfdDB.clearAllData();
        qfdDB.setProjeto({ nome: 'Semeadora Ágil', emails: 'a@x.com, b@y.com' });
        const baixados = [], links = [];
        const downloadOriginal = window.downloadFile, clickOriginal = HTMLAnchorElement.prototype.click;
        window.downloadFile = (conteudo, nome) => baixados.push({ conteudo, nome });
        HTMLAnchorElement.prototype.click = function() { links.push(this.href); };
        try {
            exportarEEnviarEmail();
        } finally {
            window.downloadFile = downloadOriginal;
            HTMLAnchorElement.prototype.click = clickOriginal;
        }
        assertEqual(baixados.length, 1, 'backup não baixado');
        assert(/^qfd-semeadora-agil-\d{4}-\d{2}-\d{2}\.json$/.test(baixados[0].nome), 'nome do arquivo: ' + baixados[0].nome);
        assertEqual(JSON.parse(baixados[0].conteudo).projeto.nome, 'Semeadora Ágil');
        assert(links[0].startsWith('mailto:a@x.com,b@y.com?subject=' + encodeURIComponent('qfd - Semeadora Ágil')), links[0]);
        assert(decodeURIComponent(links[0]).includes(baixados[0].nome), 'texto não cita o arquivo a anexar');
    });
});

suite('Tratamento de erros', () => {
    test('dados corrompidos são restaurados do backup automático', () => {
        const alerts = capturarAlerts();
        try {
            localStorage.setItem('qfd_backup', JSON.stringify({
                requisitosCliente: [{ id: 'b1', descricao: 'Do backup' }], requisitosProjeto: [],
                comparacaoCliente: [], correlacaoProjeto: [], matrizQFD: [],
                metadata: { schemaVersion: SCHEMA_VERSION }, backup: { type: 'auto' }
            }));
            localStorage.setItem('qfd_data', '{"requisitosCliente": [ quebrado');
            assertEqual(qfdDB.getRequisitosCliente().map(r => r.descricao), ['Do backup']);
            assert(localStorage.getItem('qfd_data_corrompido').includes('quebrado'), 'cópia não guardada');
            assert(/backup/.test(alerts.mensagens[0]), 'usuário não avisado');
        } finally {
            alerts.restaurar();
        }
    });
    test('dados corrompidos sem backup iniciam projeto vazio', () => {
        const alerts = capturarAlerts();
        try {
            localStorage.removeItem('qfd_backup');
            localStorage.setItem('qfd_data', 'nada');
            assertEqual(qfdDB.getRequisitosCliente().length, 0);
            assert(/vazio/.test(alerts.mensagens[0]), 'usuário não avisado');
        } finally {
            alerts.restaurar();
        }
    });
    test('armazenamento cheio: avisa, propaga o erro e não grava nada', () => {
        qfdDB.clearAllData();
        const alerts = capturarAlerts();
        const setItem = Storage.prototype.setItem;
        let erro = null;
        try {
            Storage.prototype.setItem = function() { throw new DOMException('cheio', 'QuotaExceededError'); };
            try { qfdDB.addRequisitoCliente('Não cabe'); } catch (e) { erro = e; }
        } finally {
            Storage.prototype.setItem = setItem;
            alerts.restaurar();
        }
        assertEqual(erro && erro.name, 'QuotaExceededError');
        assert(/cheio/.test(alerts.mensagens[0] || ''), 'usuário não avisado');
        assertEqual(qfdDB.getRequisitosCliente().length, 0);
    });
});

// ============================================================================
// IMPORTAÇÃO DE CSV
// ============================================================================

suite('Importação de CSV', () => {
    test('CSV exportado pela página (cabeçalho "Número,Descrição")', () => {
        qfdDB.clearAllData();
        const r = importRequisitosCSV('Número,Descrição,Importância\n1,"Barato, leve",0\n2,"Diz ""oi""",0\n', 'cliente');
        assertEqual(r.importados, 2);
        assertEqual(qfdDB.getRequisitosCliente().map(x => x.descricao), ['Barato, leve', 'Diz "oi"']);
    });
    test('CSV do menu Backup & Export, ignorando duplicados', () => {
        const r = importRequisitosCSV('id,descricao,importancia,peso\nabc,"Barato, leve",0,0\nxyz,"Novo item",0,0\n', 'cliente');
        assertEqual([r.importados, r.duplicados], [1, 1]);
    });
    test('lista simples, com duplicado dentro do próprio arquivo', () => {
        const r = importRequisitosCSV('Primeiro item\nSegundo item\nsegundo ITEM\n\n', 'cliente');
        assertEqual([r.importados, r.duplicados], [2, 1]);
    });
    test('requisitos de projeto com sentido e dificuldade (número ou nome)', () => {
        const r = importRequisitosCSV('Número,Descrição,Sentido Melhoria,Dificuldade Técnica\n1,Peso,Decrescente,Moderada\n2,Custo,Crescente,5\n3,Cor,xx,\n', 'projeto');
        assertEqual(r.importados, 3);
        assertEqual(qfdDB.getRequisitosProjeto().map(x => x.sentidoMelhoria + x.dificuldadeTecnica), ['down3', 'up5', 'none1']);
    });
    test('arquivo vazio é recusado', () => {
        let msg = '';
        try { importRequisitosCSV('\n\n', 'cliente'); } catch (e) { msg = e.message; }
        assert(/vazio/.test(msg), 'não recusou');
    });
});

// ============================================================================
// AVALIAÇÃO COMPETITIVA
// ============================================================================

/**
 * Projeto de exemplo + 2 concorrentes com notas e valores técnicos.
 * RP1 "Peso total (kg)" é ↓ e RP2 "Custo de produção" é ↓.
 */
function criarAvaliacaoExemplo() {
    const ex = criarProjetoExemplo();
    const { rc, rp } = ex;
    const a = qfdDB.addConcorrente('Marca A');
    const b = qfdDB.addConcorrente('Marca "B" <x>');
    // RC1: nós 3, A 4, B 2 → atrás; RC2: nós 5, A 4 → à frente; RC3: nós 3, A 3 → empate
    [[rc[0], PRODUTO_NOSSO_ID, 3], [rc[0], a.id, 4], [rc[0], b.id, 2],
     [rc[1], PRODUTO_NOSSO_ID, 5], [rc[1], a.id, 4],
     [rc[2], PRODUTO_NOSSO_ID, 3], [rc[2], a.id, 3]].forEach(([r, p, n]) => qfdDB.setNotaCliente(r.id, p, n));
    qfdDB.setMetaCliente(rc[0].id, 5);
    qfdDB.setValorTecnico(rp[0].id, a.id, '1,5 kg');
    qfdDB.setValorTecnico(rp[0].id, b.id, '0,9');
    qfdDB.setValorTecnico(rp[0].id, PRODUTO_NOSSO_ID, '1,4');
    qfdDB.setValorTecnico(rp[2].id, a.id, '4');
    return { ...ex, a, b };
}

suite('Avaliação competitiva', () => {
    test('índices: fórmula com RPn, precedência, divisão por zero e erros de sintaxe', () => {
        const arv = t => parseFormula(t);
        const v = (t, valores = {}) => avaliarFormula(arv(t), id => (id in valores ? valores[id] : null));
        assertEqual([v('2 + 3 * 4'), v('(2 + 3) * 4'), v('-2 * -3'), v('1,5 * 2'), v('1 / 0')], [14, 20, 6, 3, null]);
        assertEqual(v('{rp:a} / {rp:b}', { a: 10, b: 4 }), 2.5);
        assertEqual(v('{rp:a} + 1', {}), null, 'valor faltando');
        ['2 +', '(2', '2 ^ 3', 'RP1 RP2', ''].forEach(t => {
            let erro = '';
            try { parseFormula(t.replace(/RP\d/g, '{rp:x}')); } catch (e) { erro = e.message; }
            assert(erro, `aceitou "${t}"`);
        });
    });
    test('índices: valores por produto, melhor concorrente e numeração que muda', () => {
        const { rp, a, b } = criarAvaliacaoExemplo(); // RP1: nós 1,4 | A 1,5 kg | B 0,9 ; RP3: A 4
        qfdDB.setValorTecnico(rp[2].id, PRODUTO_NOSSO_ID, '2');
        qfdDB.setValorTecnico(rp[2].id, b.id, '3');
        const indice = qfdDB.addIndice({ nome: 'Botões por kg', formula: 'RP3 / RP1', unidade: '1/kg', sentido: 'up' });
        let x = qfdDB.getAnaliseCompetitiva().indices[0];
        assertEqual(x.formula, 'RP3 / RP1');
        assert(Math.abs(x.valores[a.id] - 4 / 1.5) < 1e-9 && Math.abs(x.valores[b.id] - 3 / 0.9) < 1e-9, 'valores');
        assertEqual([x.melhor.produtos, x.situacao], [['Marca "B" <x>'], 'atras']);

        let erro = '';
        try { qfdDB.addIndice({ nome: 'X', formula: 'RP9 * 2' }); } catch (e) { erro = e.message; }
        assert(/RP9 não existe/.test(erro), 'aceitou RP inexistente');

        // RP2 sai do QFD: RP3 vira RP2 e a fórmula acompanha
        qfdDB.updateRequisitoProjeto(rp[1].id, { classificacao: 'funcao', justificativaClassificacao: 'teste' });
        x = qfdDB.getAnaliseCompetitiva().indices[0];
        assertEqual(x.formula, 'RP2 / RP1');
        qfdDB.removeIndice(indice.id);
        assertEqual(qfdDB.getAnaliseCompetitiva().indices.length, 0);
    });
    test('concorrentes: adicionar, nome repetido, renomear, limite e o nosso produto não sai', () => {
        qfdDB.clearAllData();
        const a = qfdDB.addConcorrente('  Marca   A ');
        assertEqual(a.nome, 'Marca A');
        let msg = '';
        try { qfdDB.addConcorrente('marca a'); } catch (e) { msg = e.message; }
        assert(/Já existe/.test(msg), 'aceitou nome repetido');
        qfdDB.renameProdutoAvaliado(PRODUTO_NOSSO_ID, 'Protótipo v2');
        assertEqual(qfdDB.getAvaliacaoCompetitiva().produtos.map(p => p.nome), ['Protótipo v2', 'Marca A']);
        for (let i = 2; i <= MAX_CONCORRENTES; i++) qfdDB.addConcorrente('C' + i);
        msg = '';
        try { qfdDB.addConcorrente('Um a mais'); } catch (e) { msg = e.message; }
        assert(/Limite/.test(msg), 'passou do limite');
        assertEqual(qfdDB.removeConcorrente(PRODUTO_NOSSO_ID), false);
    });
    test('notas: situação, índice de melhoria e prioridade', () => {
        const { rc } = criarAvaliacaoExemplo();
        const an = qfdDB.getAnaliseCompetitiva();
        const c = id => an.clientes.find(x => x.requisito.id === id);
        assertEqual([c(rc[0].id).situacao, c(rc[1].id).situacao, c(rc[2].id).situacao], ['atras', 'frente', 'empate']);
        assertEqual(c(rc[0].id).melhor, { valor: 4, produtos: ['Marca A'] });
        assert(Math.abs(c(rc[0].id).indiceMelhoria - 5 / 3) < 1e-9, 'índice de melhoria');
        const soma = an.clientes.reduce((s, x) => s + x.prioridade, 0);
        assert(Math.abs(soma - 1) < 1e-9, `prioridades somam ${soma}`);
        assertEqual(an.stats, { notasTotal: 9, notasPreenchidas: 7, percent: 78 });
    });
    test('notas fora de 1 a 5 apagam a nota', () => {
        const { rc } = criarAvaliacaoExemplo();
        qfdDB.setNotaCliente(rc[1].id, PRODUTO_NOSSO_ID, '');
        qfdDB.setNotaCliente(rc[2].id, PRODUTO_NOSSO_ID, 7);
        const an = qfdDB.getAnaliseCompetitiva();
        assertEqual(an.clientes.filter(x => x.nossa).length, 1);
    });
    test('técnico: melhor concorrente pelo sentido de melhoria e meta da especificação', () => {
        const { rp } = criarAvaliacaoExemplo();
        const an = qfdDB.getAnaliseCompetitiva();
        const t = id => an.tecnicos.find(x => x.requisito.id === id);
        // RP1 ↓: melhor é 0,9 (Marca "B"); meta 1,2 kg > 0,9 → atrás
        assertEqual(t(rp[0].id).melhor, { valor: 0.9, produtos: ['Marca "B" <x>'] });
        assertEqual(t(rp[0].id).situacao, 'atras');
        // RP3 é nominal: não há melhor
        assertEqual([t(rp[2].id).melhor, t(rp[2].id).situacao], [null, 'sem-dados']);
        qfdDB.updateEspecificacao(rp[0].id, { valorUnitario: '0,8' });
        assertEqual(qfdDB.getAnaliseCompetitiva().tecnicos.find(x => x.requisito.id === rp[0].id).situacao, 'frente');
    });
    test('inconsistência: clientes preferem um produto, mas os valores técnicos fortes favorecem o outro', () => {
        const { rc, rp, a } = criarAvaliacaoExemplo();
        assertEqual(qfdDB.getAnaliseCompetitiva().inconsistencias.length, 0);
        // RC1 × RP1 forte (9). Clientes: A (4) > nós (3), mas no peso (↓) nós 1,4 < A 1,5
        qfdDB.setMatrizQFD(rc[0].id, rp[0].id, 9);
        const inc = qfdDB.getAnaliseCompetitiva().inconsistencias;
        assert(inc.some(i => i.numero === 1 && i.preferido === 'Marca A' && i.outro === 'Nosso produto' && i.requisitosProjeto.join() === '1'),
            JSON.stringify(inc));
        // Com o valor corrigido, a inconsistência some
        qfdDB.setValorTecnico(rp[0].id, a.id, '1,3');
        assert(!qfdDB.getAnaliseCompetitiva().inconsistencias.some(i => i.preferido === 'Marca A' && i.outro === 'Nosso produto'), 'não sumiu');
    });
    test('remover requisito ou concorrente apaga notas e valores ligados', () => {
        const { rc, rp, a } = criarAvaliacaoExemplo();
        qfdDB.removeRequisitoCliente(rc[0].id);
        qfdDB.removeRequisitoProjeto(rp[0].id);
        qfdDB.removeConcorrente(a.id);
        const av = qfdDB.getAvaliacaoCompetitiva();
        assert(!av.notasCliente.some(n => n.requisitoClienteId === rc[0].id || n.produtoId === a.id), 'nota órfã');
        assert(!av.metasCliente.some(m => m.requisitoClienteId === rc[0].id), 'meta órfã');
        assert(!av.valoresTecnicos.some(v => v.requisitoProjetoId === rp[0].id || v.produtoId === a.id), 'valor órfão');
        assert(qfdDB.validateData().isValid, qfdDB.validateData().errors.join('; '));
    });
    test('backup exportado e importado mantém a avaliação', () => {
        criarAvaliacaoExemplo();
        const backup = JSON.stringify(qfdDB.exportData());
        qfdDB.clearAllData();
        assert(qfdDB.importData(backup), qfdDB.lastImportError);
        assertEqual(qfdDB.getAvaliacaoCompetitiva().produtos.length, 3);
        assertEqual(qfdDB.getAnaliseCompetitiva().stats.notasPreenchidas, 7);
    });
    test('gráfico: SVG com os produtos e nomes escapados', () => {
        criarAvaliacaoExemplo();
        const html = buildGraficoCompetitivo(qfdDB.getAnaliseCompetitiva());
        assert(html.includes('<svg') && html.includes('<circle'), 'sem SVG');
        assert(html.includes('Marca "B" &lt;x&gt;') && !html.includes('<x>'), 'nome não escapado');
        qfdDB.clearAllData();
        assertEqual(buildGraficoCompetitivo(qfdDB.getAnaliseCompetitiva()), '');
    });
});

// ============================================================================
// ATENDIMENTO AOS REQUISITOS DE CLIENTE
// ============================================================================
// No projeto de exemplo a matriz é RC(i) × RP(j) = [1, 3, 5][(i + j) % 3]:
//   RC1: RP1 1, RP2 3, RP3 5 | RC2: RP1 3, RP2 5, RP3 1 | RC3: RP1 5, RP2 1, RP3 3
// Pesos (Mudge): RC1 8/9, RC2 1/9, RC3 0. RP1 ↓ meta 1,2 kg; RP2 ↓ e RP3 * sem meta.

suite('Atendimento aos requisitos', () => {
    test('metaAtingida por sentido de melhoria (nominal com ±5%)', () => {
        assertEqual([qfdDB.metaAtingida('up', 10, 10), qfdDB.metaAtingida('up', 9.9, 10),
            qfdDB.metaAtingida('down', 1.1, 1.2), qfdDB.metaAtingida('down', 1.3, 1.2),
            qfdDB.metaAtingida('none', 10.5, 10), qfdDB.metaAtingida('none', 10.6, 10),
            qfdDB.metaAtingida('none', 0, 0)], [true, false, true, false, true, false, true]);
    });
    test('estados das metas: não atingida, sem medição e sem meta', () => {
        const { rp } = criarAvaliacaoExemplo(); // nosso RP1 medido 1,4 > meta 1,2
        const an = qfdDB.getAnaliseAtendimento();
        const estado = id => an.projetos.find(p => p.requisito.id === id).estado;
        assertEqual([estado(rp[0].id), estado(rp[1].id), estado(rp[2].id)], ['nao-atingida', 'sem-meta', 'sem-meta']);
        qfdDB.updateEspecificacao(rp[1].id, { valorUnitario: '50' });
        assertEqual(qfdDB.getAnaliseAtendimento().projetos.find(p => p.requisito.id === rp[1].id).estado, 'sem-medicao');
    });
    test('atendimento por requisito de cliente ponderado pela influência, e geral pelo peso', () => {
        const { rc, rp } = criarAvaliacaoExemplo();
        assertEqual(qfdDB.getAnaliseAtendimento().atendimentoGeral, 0);
        qfdDB.setValorTecnico(rp[0].id, PRODUTO_NOSSO_ID, '1,1');           // RP1 atingida
        assertEqual(qfdDB.getAnaliseAtendimento().atendimentoGeral, 1);
        qfdDB.updateEspecificacao(rp[1].id, { valorUnitario: '50' });
        qfdDB.setValorTecnico(rp[1].id, PRODUTO_NOSSO_ID, '60');            // RP2 não atingida
        const an = qfdDB.getAnaliseAtendimento();
        const at = id => an.clientes.find(c => c.requisito.id === id).atendimento;
        assertEqual([at(rc[0].id), at(rc[1].id), at(rc[2].id)], [1 / 4, 3 / 8, 5 / 6]);
        const esperado = (8 / 9) * (1 / 4) + (1 / 9) * (3 / 8);
        assert(Math.abs(an.atendimentoGeral - esperado) < 1e-9, `geral ${an.atendimentoGeral} ≠ ${esperado}`);
        // RC2: nota dos clientes 5, mas atendimento 37,5% → divergência
        assert(an.diagnostico.divergencias.some(c => c.requisito.id === rc[1].id), 'divergência não detectada');
    });
    test('cobertura, requisitos sem relação e requisito de projeto órfão', () => {
        const { rc, rp } = criarProjetoExemplo();
        qfdDB.setMatrizQFD(rc[0].id, rp[0].id, 9);
        rp.forEach(p => qfdDB.setMatrizQFD(rc[2].id, p.id, 0));
        qfdDB.setMatrizQFD(rc[1].id, rp[1].id, 1);
        qfdDB.setMatrizQFD(rc[1].id, rp[0].id, 1);
        qfdDB.setMatrizQFD(rc[1].id, rp[2].id, 1);
        const novo = qfdDB.addRequisitoProjeto('Cor da carcaça', 'none', 1);
        const an = qfdDB.getAnaliseAtendimento();
        assertEqual(an.clientes.map(c => c.cobertura), ['forte', 'fraca', 'nenhuma']);
        assertEqual(an.diagnostico.semRelacao.map(c => c.numero), [3]);
        assertEqual(an.diagnostico.soFracas.map(c => c.numero), [2]);
        assertEqual(an.diagnostico.rpSemRelacao.map(p => p.requisito.id), [novo.id]);
        assertEqual(an.atendimentoGeral, null, 'sem medições o atendimento geral é null');
    });
    test('tabela e diagnóstico escapam os textos', () => {
        criarAvaliacaoExemplo();
        const an = qfdDB.getAnaliseAtendimento();
        const html = buildTabelaAtendimentoClientes(an) + buildDiagnosticoAtendimentoHtml(an);
        assert(html.includes('Leve e "portátil"') || html.includes('Leve e &quot;portátil&quot;'), 'descrição ausente');
        assert(!/<b>tag<\/b>/.test(html), 'HTML do usuário não escapado');
    });
});

// ============================================================================
// PÁGINAS (abertas em iframe; só no modo headless — ver rodar-testes.ps1)
// ============================================================================

const PAGINAS = [
    { arquivo: '../index.html', funcao: 'updateDashboard', seletores: ['#projeto-nome', '#projeto-emails'] },
    { arquivo: '../pages/requisitos-cliente.html', funcao: 'loadRequisitos', texto: 'Fácil de usar por idosos' },
    { arquivo: '../pages/comparacao-cliente.html', funcao: 'generateComparisonMatrix', balao: 'Obs RC1' },
    { arquivo: '../pages/requisitos-projeto.html', funcao: 'loadRequisitos', texto: 'Peso total (kg)' },
    { arquivo: '../pages/correlacao-projeto.html', funcao: 'generateRoofMatrix', balao: 'Obs RP1' },
    {
        arquivo: '../pages/matriz-qfd.html', funcao: 'setupMatrix', balao: 'Especificação: Spec "pesagem"',
        texto: 'Soma (Σ relação × importância)', seletores: ['.qfd-sum-total td[data-j="0"]', '.qfd-sum-rank td[data-j="2"]']
    },
    { arquivo: '../pages/especificacoes.html', funcao: 'renderTable', texto: 'Custo de produção' },
    {
        arquivo: '../pages/ideias.html', funcao: 'renderIdeias',
        preparar: () => { const { rc } = criarProjetoExemplo(); qfdDB.addIdeia({ titulo: 'Ideia <b>teste</b>', requisitos: [{ tipo: 'cliente', id: rc[0].id }] }); qfdDB.addFalha({ falha: 'Falha X' }); },
        texto: 'Ideia <b>teste</b>', seletores: ['#lista-ideias .ideia-chip', '#lista-falhas .falha-neutro', '#ideia-requisitos input[type=checkbox]']
    },
    {
        arquivo: '../pages/avaliacao-competitiva.html', funcao: 'updateComputed', preparar: criarAvaliacaoExemplo,
        texto: 'Marca "B" <x>', seletores: ['#grafico-clientes svg circle', '#clientes-tbody .sit-atras', '#tecnicos-tbody .valor-input', '#form-indice #indice-formula']
    },
    {
        arquivo: '../pages/atendimento-requisitos.html', funcao: 'updateComputed', preparar: criarAvaliacaoExemplo,
        texto: 'Não atingida', seletores: ['#clientes-tabela .atend-rel', '#diagnostico .resultado-bloco', '#projetos-tbody .valor-input']
    },
    {
        arquivo: '../pages/relatorio.html', funcao: 'generatePreview', preparar: criarAvaliacaoExemplo,
        texto: 'Resultado da comparação',
        seletores: ['#report-content .grafico-competitivo', '#report-content .resultado-atras li', '#report-content .resultado-metas li',
            '#report-content .report-atendimento .atend-rel', '#report-content .qfd-matrix-report .qfd-sum-percent',
            '#report-content .competitiva-glossario', '#report-content .competitiva-table th.produto-col[title]']
    }
];

function carregarPagina(arquivo) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.className = 'pagina-teste';
        const timer = setTimeout(() => reject(new Error('tempo esgotado ao carregar')), 10000);
        iframe.onload = () => { clearTimeout(timer); setTimeout(() => resolve(iframe), 300); };
        iframe.src = arquivo;
        document.body.appendChild(iframe);
    });
}

function testarPagina(pagina) {
    return async () => {
        if (pagina.preparar) pagina.preparar();
        const iframe = await carregarPagina(pagina.arquivo);
        try {
            const win = iframe.contentWindow, doc = iframe.contentDocument;
            assert(win.eval('typeof qfdDB') === 'object', 'database.js não carregou'); // const: não é window.qfdDB
            assert(typeof win.setupDropdownMenu === 'function', 'utils.js não carregou');
            assert(typeof win[pagina.funcao] === 'function', `script da página não carregou (${pagina.funcao} ausente)`);

            if (pagina.texto) {
                assert(doc.body.textContent.includes(pagina.texto), `"${pagina.texto}" não aparece na página`);
            }
            (pagina.seletores || []).forEach(sel => {
                assert(doc.querySelector(sel), `elemento "${sel}" não encontrado`);
            });

            // barra lateral com as 9 etapas + Dashboard + Caderno de Ideias, página atual destacada
            assertEqual(doc.querySelectorAll('.sidebar .sidebar-link').length, 11, 'links da barra lateral');
            const ativo = doc.querySelector('.sidebar .sidebar-link.ativo');
            assert(ativo && pagina.arquivo.endsWith(ativo.getAttribute('href').split('/').pop()), 'página atual não destacada na barra lateral');
            assert(doc.getElementById('topbar-projeto-nome').textContent.trim(), 'nome do projeto na barra superior');

            const toggles = [...doc.querySelectorAll('.nav-dropdown .dropdown-toggle')];
            assertEqual(toggles.length, 1, 'quantidade de menus (Backup & Export)');
            toggles.forEach((t, i) => {
                t.click();
                assert(t.nextElementSibling.classList.contains('show'), `menu ${i + 1} não abriu`);
            });
            doc.body.click();
            assertEqual(doc.querySelectorAll('.dropdown-menu.show').length, 0, 'menus abertos após clicar fora');

            if (pagina.balao) {
                const alvo = [...doc.querySelectorAll('[data-tooltip]')]
                    .find(el => el.getAttribute('data-tooltip').includes(pagina.balao));
                assert(alvo, `nenhum elemento com balão contendo "${pagina.balao}"`);
                alvo.dispatchEvent(new win.MouseEvent('mouseover', { clientX: 50, clientY: 50, bubbles: true }));
                const balao = doc.querySelector('.app-tooltip');
                assert(balao && balao.style.display === 'block', 'balão não apareceu');
                assert(balao && balao.textContent.includes(pagina.balao), 'balão não exibiu o texto explicativo');
                assert(!/<em|<br|&quot;/.test(balao.textContent), 'balão mostra HTML cru: ' + balao.textContent);
            }
        } finally {
            iframe.remove();
        }
    };
}

suite('Páginas', () => {
    PAGINAS.forEach(p => test(p.arquivo.replace('../', ''), testarPagina(p)));
    test('Requisitos de cliente: marcar como fora do QFD exige justificativa; relatório lista à parte', async () => {
        const { rc } = criarProjetoExemplo();
        let iframe = await carregarPagina('../pages/requisitos-cliente.html');
        try {
            const win = iframe.contentWindow, doc = iframe.contentDocument;
            win.editRequisito(rc[1].id);
            doc.getElementById(`edit-class-${rc[1].id}`).value = 'boa-pratica';
            win.saveEdit(rc[1].id);
            assertEqual(qfdDB.getRequisitosCliente({ todos: true })[1].classificacao, '', 'salvou sem justificativa');
            doc.getElementById(`edit-just-${rc[1].id}`).value = 'Prática consagrada de ergonomia';
            win.saveEdit(rc[1].id);
            assertEqual(qfdDB.getRequisitosCliente({ todos: true })[1].classificacao, 'boa-pratica');
            const item = doc.querySelector(`.requisito-item[data-id="${rc[1].id}"]`);
            assert(item.querySelector('.classificacao-selo'), 'selo "fora do QFD" ausente');
            assert(item.querySelector('.requisito-number.fora-qfd'), 'número deveria indicar fora do QFD');
            assertEqual(doc.querySelector(`.requisito-item[data-id="${rc[2].id}"] .number`).textContent.trim(), '2', 'numeração do QFD (RC3 vira RC2)');
        } finally {
            iframe.remove();
        }
        iframe = await carregarPagina('../pages/relatorio.html');
        try {
            const doc = iframe.contentDocument;
            const secao = doc.querySelector('#report-content .report-fora-qfd');
            assert(secao && secao.textContent.includes('Prática consagrada de ergonomia'), 'seção "Requisitos fora do QFD" ausente');
            assert(!doc.querySelector('#report-content .qfd-matrix-report').textContent.includes('RC3'), 'matriz do relatório ainda tem 3 RC');
        } finally {
            iframe.remove();
        }
    });
    test('Requisitos de projeto: registro rápido de ideia (💡) com contador; anexo no relatório', async () => {
        const { rp } = criarProjetoExemplo();
        let iframe = await carregarPagina('../pages/requisitos-projeto.html');
        try {
            const win = iframe.contentWindow, doc = iframe.contentDocument;
            const item = () => doc.querySelector(`.requisito-item[data-id="${rp[0].id}"]`);
            item().querySelector('.btn-ideia').click();
            const janela = doc.querySelector('.ideia-rapida-overlay');
            assert(janela && janela.textContent.includes('Peso total (kg)'), 'janela não mostra o requisito');
            janela.querySelector('#ideia-rapida-titulo').value = 'Usar plástico reforçado';
            janela.querySelector('[data-acao="salvar"]').click();
            assert(!doc.querySelector('.ideia-rapida-overlay'), 'janela não fechou');
            assertEqual(item().querySelector('.ideia-contador').textContent, '1', 'contador de ideias');
            assertEqual(qfdDB.getIdeias()[0].requisitos, [{ tipo: 'projeto', id: rp[0].id }]);
        } finally {
            iframe.remove();
        }
        iframe = await carregarPagina('../pages/relatorio.html');
        try {
            const anexo = iframe.contentDocument.querySelector('#report-content .report-ideias');
            assert(anexo && anexo.textContent.includes('Usar plástico reforçado') && anexo.textContent.includes('RP1'), 'anexo de ideias');
        } finally {
            iframe.remove();
        }
    });
    test('Especificações: editor da meta sugere o tipo, valida intervalo e salva', async () => {
        const { rp } = criarProjetoExemplo();
        const iframe = await carregarPagina('../pages/especificacoes.html');
        try {
            const win = iframe.contentWindow, doc = iframe.contentDocument;
            const linha = doc.querySelector(`tr[data-req-id="${rp[1].id}"]`); // Custo de produção (↓)
            const campo = f => linha.querySelector(`[data-field="${f}"]`);
            assertEqual(campo('tipoMeta').value, '<=', 'tipo sugerido para ↓');
            const mudar = (f, v) => { campo(f).value = v; campo(f).dispatchEvent(new win.Event('change')); };
            mudar('tipoMeta', 'faixa');
            mudar('valorMeta', '10');
            mudar('valorMax', '8');
            assert(/maior que o início/.test(linha.querySelector('.spec-meta-aviso').textContent), 'não avisou intervalo invertido');
            const esp = () => qfdDB.getEspecificacoesProjeto().find(e => e.requisitoProjetoId === rp[1].id);
            assert(!metaDefinida(esp()), 'salvou intervalo inválido');
            mudar('valorMax', '12,5');
            assertEqual([esp().tipoMeta, esp().valorMeta, esp().valorMax], ['faixa', 10, 12.5]);
            mudar('valorMeta', 'abc');
            assert(campo('valorMeta').classList.contains('spec-input-erro'), 'texto não numérico sem destaque de erro');
            assertEqual(esp().valorMeta, 10, 'valor inválido não deve ser salvo');
        } finally {
            iframe.remove();
        }
    });
    test('Relatório: versão de apresentação sem comentários internos', async () => {
        criarAvaliacaoExemplo();
        const iframe = await carregarPagina('../pages/relatorio.html');
        try {
            const win = iframe.contentWindow, doc = iframe.contentDocument;
            const conteudo = () => doc.getElementById('report-content');
            const tem = () => {
                const html = conteudo().innerHTML;
                return {
                    obs: html.includes('Obs RC2') && html.includes('Spec'),
                    inconsistencias: !!conteudo().querySelector('.resultado-inconsistencias'),
                    analises: html.includes('Especificações preenchidas'),
                    diagnostico: /<h4>Diagnóstico<\/h4>/.test(html)
                };
            };
            assertEqual(tem(), { obs: true, inconsistencias: true, analises: true, diagnostico: true }, 'versão da equipe');

            const radio = doc.querySelector('input[name="report-version"][value="apresentacao"]');
            radio.checked = true;
            radio.dispatchEvent(new win.Event('change'));
            assertEqual(tem(), { obs: false, inconsistencias: false, analises: false, diagnostico: false }, 'versão de apresentação');
            assert(conteudo().textContent.includes('Versão para apresentação'), 'cabeçalho não indica a versão');
            assert(conteudo().querySelector('.qfd-matrix-report'), 'a matriz deve continuar na apresentação');
        } finally {
            iframe.remove();
        }
    });
    test('Mudge: salvar com Enter não recarrega e abre a próxima célula; remover recalcula', async () => {
        const { rc } = criarProjetoExemplo();
        qfdDB.setComparacaoCliente(rc[0].id, rc[1].id, 0);
        qfdDB.setComparacaoCliente(rc[0].id, rc[2].id, 0);
        const iframe = await carregarPagina('../pages/comparacao-cliente.html');
        try {
            const win = iframe.contentWindow, doc = iframe.contentDocument;
            win.__semReload = true; // some se a página recarregar
            doc.querySelector('.matrix-comparison[data-i="0"][data-j="1"]').click();
            doc.querySelector(`.requirement-option[data-req="${rc[0].id}"]`).click();
            doc.querySelector('.level-btn[data-value="5"]').click();
            doc.querySelector('.comparison-modal').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            assert(win.__semReload, 'a página recarregou');
            assert(doc.querySelector('.matrix-comparison[data-i="0"][data-j="1"]').classList.contains('completed'), 'célula salva não aparece preenchida');
            assertEqual(doc.querySelectorAll('.modal-overlay .comparison-modal').length, 1, 'modais abertos');
            assert(doc.querySelector('.requirement-option[data-index="2"]'), 'não abriu a próxima célula (1 × 3)');
            assertEqual(doc.getElementById('comparacoes-feitas').textContent, '2 / 3', 'status');

            // Shift+Enter volta para 1 × 2 sem salvar a 1 × 3
            doc.querySelector('.comparison-modal').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
            assert(doc.querySelector('.requirement-option[data-index="1"]'), 'Shift+Enter não voltou para 1 × 2');
            assert(doc.getElementById('prev-comparison').disabled, '"Anterior" deveria estar desabilitado na primeira célula');
            assertEqual(qfdDB.getComparacoesCliente().length, 2, 'voltar não deve salvar');

            win.closeModal();
            doc.querySelector('.matrix-comparison[data-i="0"][data-j="1"]').click();
            doc.querySelector('.modal-footer .btn-danger').click();
            assert(win.__semReload, 'a página recarregou ao remover');
            assertEqual(qfdDB.getComparacoesCliente().length, 1, 'comparações após remover');
            assertEqual(qfdDB.getRequisitosCliente()[0].importancia, 0, 'importância do RC1 não recalculada');
        } finally {
            iframe.remove();
        }
    });
    test('Matriz QFD e telhado: balões e janelas com o roteiro de preenchimento', async () => {
        criarProjetoExemplo();
        let iframe = await carregarPagina('../pages/matriz-qfd.html');
        try {
            const doc = iframe.contentDocument;
            const celula = doc.querySelector('.influence-cell[data-i="0"][data-j="1"]');
            assert(/Pode RP2 "Custo de produção" influenciar RC1/.test(celula.getAttribute('data-tooltip')), 'balão da matriz sem o roteiro');
            celula.click();
            assert(doc.querySelector('#modal-comparison-info .roteiro-box li'), 'janela da matriz sem o roteiro');
        } finally {
            iframe.remove();
        }
        iframe = await carregarPagina('../pages/correlacao-projeto.html');
        try {
            const doc = iframe.contentDocument;
            const celula = doc.querySelector('.roof-cell[data-i="0"][data-j="1"]'); // RP1 ↓ x RP2 ↓
            assert(celula.getAttribute('data-tooltip').includes('A diminuição de RP1 diminui RP2?'), 'balão do telhado sem o roteiro');
            celula.click();
            const itens = doc.querySelectorAll('.correlation-popup .roteiro-box li');
            assertEqual(itens.length, 4, 'perguntas na janela do telhado');
            assert(itens[0].textContent.includes('Peso total'), 'perguntas sem o nome do requisito');
        } finally {
            iframe.remove();
        }
    });
    test('Matriz QFD e telhado: botão Anterior e Shift+Enter voltam uma célula', async () => {
        criarProjetoExemplo();
        let iframe = await carregarPagina('../pages/matriz-qfd.html');
        try {
            const win = iframe.contentWindow, doc = iframe.contentDocument;
            doc.querySelector('.influence-cell[data-i="1"][data-j="0"]').click();
            assert(!doc.getElementById('prev-influence').disabled, '"Anterior" desabilitado fora da primeira célula');
            doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
            assert(doc.querySelector('.influence-cell[data-i="0"][data-j="2"]').matches('.active-a, .active-b'), 'não voltou para RC1 × RP3');
            doc.getElementById('prev-influence').click();
            assert(doc.querySelector('.influence-cell[data-i="0"][data-j="1"]').matches('.active-a, .active-b'), 'botão não voltou para RC1 × RP2');
        } finally {
            iframe.remove();
        }
        iframe = await carregarPagina('../pages/correlacao-projeto.html');
        try {
            const win = iframe.contentWindow, doc = iframe.contentDocument;
            doc.querySelector('.roof-cell[data-i="1"][data-j="2"]').click();
            doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
            assert(/Req 1 ↔ Req 3/.test(doc.querySelector('.correlation-popup h4').textContent), 'telhado: Shift+Enter não voltou para 1 ↔ 3');
            assertEqual(doc.querySelectorAll('.correlation-popup-overlay').length, 1, 'popups abertos');
        } finally {
            iframe.remove();
        }
    });
});

// ============================================================================
// EXECUÇÃO
// ============================================================================

function podeAbrirIframes() {
    try {
        const f = document.createElement('iframe');
        f.src = '../index.html';
        return new Promise(resolve => {
            f.onload = () => {
                let ok = false;
                try { ok = !!f.contentDocument && !!f.contentDocument.body; } catch (e) { ok = false; }
                f.remove();
                resolve(ok);
            };
            f.style.display = 'none';
            document.body.appendChild(f);
        });
    } catch (e) {
        return Promise.resolve(false);
    }
}

async function executarTestes() {
    // Guarda os dados reais do navegador para restaurar no final
    const snapshot = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        snapshot[k] = localStorage.getItem(k);
    }

    const linhas = [];
    let passou = 0, falhou = 0, pulou = 0;
    const iframesOk = await podeAbrirIframes();

    try {
        for (const s of suites) {
            linhas.push(`\n## ${s.nome}`);
            for (const t of s.testes) {
                if (s.nome === 'Páginas') {
                    if (!iframesOk) {
                        linhas.push(`PULOU  ${t.nome} (rode tests/rodar-testes.ps1)`);
                        pulou++;
                        continue;
                    }
                    criarProjetoExemplo();
                }
                try {
                    await t.fn();
                    linhas.push(`OK     ${t.nome}`);
                    passou++;
                } catch (e) {
                    linhas.push(`FALHA  ${t.nome} — ${e.message}`);
                    falhou++;
                }
            }
        }
    } finally {
        localStorage.clear();
        Object.entries(snapshot).forEach(([k, v]) => localStorage.setItem(k, v));
    }

    linhas.push(`\nRESUMO: ${passou} ok, ${falhou} falha(s), ${pulou} pulado(s)`);
    const pre = document.getElementById('resultado');
    pre.textContent = linhas.join('\n').trim();
    pre.className = falhou ? 'falhou' : 'passou';
    document.title = (falhou ? '✗ ' : '✓ ') + document.title;
}

window.addEventListener('load', executarTestes);
