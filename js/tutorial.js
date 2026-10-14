/**
 * ============================================================================
 * TUTORIAL - PROJETO DE EXEMPLO: RODA DE BICICLETA
 * ============================================================================
 *
 * Carrega um projeto completo (todas as etapas preenchidas) para o usuário
 * percorrer o sistema vendo cada ferramenta em uso. O exemplo é montado pela
 * API do qfdDB, então segue a estrutura de dados atual.
 */

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.btn-carregar-exemplo').forEach(btn => btn.addEventListener('click', handleCarregarExemplo));
    atualizarAvisoProjetoAtual();
});

/** Mostra se já existe um projeto no navegador (que será substituído) */
function atualizarAvisoProjetoAtual() {
    const aviso = document.getElementById('tutorial-projeto-atual');
    if (!aviso) return;
    const temDados = qfdDB.getRequisitosCliente({ todos: true }).length || qfdDB.getRequisitosProjeto({ todos: true }).length;
    const nome = qfdDB.getProjeto().nome;
    aviso.textContent = temDados
        ? `Há um projeto neste navegador${nome ? ` ("${nome}")` : ''}. Carregar o exemplo substitui esse projeto; exporte um backup antes se quiser guardá-lo.`
        : 'Nenhum projeto neste navegador: o exemplo pode ser carregado sem perder nada.';
}

function handleCarregarExemplo() {
    const temDados = qfdDB.getRequisitosCliente({ todos: true }).length || qfdDB.getRequisitosProjeto({ todos: true }).length;
    if (temDados) {
        if (confirm('Baixar um backup do projeto atual antes de carregar o exemplo?')) exportProjectData();
        if (!confirm('Carregar o exemplo da roda de bicicleta? O projeto atual será substituído.')) return;
    }
    try {
        carregarExemploRodaBicicleta();
        atualizarAvisoProjetoAtual();
        const nome = document.getElementById('topbar-projeto-nome');
        if (nome) nome.textContent = qfdDB.getProjeto().nome;
        showAlert('Exemplo carregado. Siga as etapas abaixo, abrindo cada página.', 'success');
        document.getElementById('tutorial-etapas').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Erro ao carregar o exemplo:', err);
        showAlert('Erro ao carregar o exemplo: ' + escapeHtml(err.message), 'danger');
    }
}

/**
 * Monta o projeto de exemplo completo: requisitos, Mudge, telhado, matriz,
 * especificações, concorrentes, referências, ideias, verificação e fechamento.
 */
function carregarExemploRodaBicicleta() {
    qfdDB.clearAllData();

    qfdDB.setProjeto({
        nome: 'Roda de bicicleta urbana (exemplo)',
        cliente: 'Ciclistas urbanos',
        instituicao: 'Projeto de exemplo do tutorial',
        equipe: ['Equipe de projeto — exemplo'].join('\n'),
        justificativaHierarquia: 'Adotada a hierarquia da Matriz QFD: resistência e massa concentram as necessidades de maior peso (resistir a buracos e ser leve) e definem o conceito da roda.'
    });

    // ---------------------------------------------------- requisitos de cliente
    const rc = [
        qfdDB.addRequisitoCliente('Ser leve', 'Fácil de carregar no ombro e de pedalar em subidas.'),
        qfdDB.addRequisitoCliente('Ser resistente a buracos e meio-fio', 'Não entortar nem quebrar raios no uso urbano.'),
        qfdDB.addRequisitoCliente('Ter baixo custo'),
        qfdDB.addRequisitoCliente('Ter manutenção fácil', 'Trocar a câmara de ar sem ferramentas especiais.'),
        qfdDB.addRequisitoCliente('Ter rodagem suave e silenciosa')
    ];
    // descreve uma função (verbo de ação): fica fora do QFD
    const funcao = qfdDB.addRequisitoCliente('Transmitir o movimento dos pedais ao solo');
    qfdDB.updateRequisitoCliente(funcao.id, {
        classificacao: 'funcao',
        justificativaClassificacao: 'É a função da roda, não uma necessidade a ponderar; vai para a função global no Fechamento.'
    });

    // ------------------------------------------- Diagrama de Mudge (vencedor primeiro)
    [[1, 0, 3], [2, 0, 1], [0, 3, 3], [0, 4, 1], [1, 2, 3],
     [1, 3, 5], [1, 4, 5], [2, 3, 3], [2, 4, 3], [4, 3, 1]]
        .forEach(([a, b, v]) => qfdDB.setComparacaoCliente(rc[a].id, rc[b].id, v));

    // ---------------------------------------------------- requisitos de projeto
    const rp = [
        qfdDB.addRequisitoProjeto('Massa da roda (g)', 'down', 3, 'Roda completa, com aro, raios, cubo e fita, sem pneu.'),
        qfdDB.addRequisitoProjeto('Carga radial suportada (N)', 'up', 4, 'Carga sem deformação permanente do aro.'),
        qfdDB.addRequisitoProjeto('Custo de fabricação (R$)', 'down', 2),
        qfdDB.addRequisitoProjeto('Número de raios (un)', 'none', 1),
        qfdDB.addRequisitoProjeto('Tempo de troca da câmara (min)', 'down', 2),
        qfdDB.addRequisitoProjeto('Desvio lateral do aro (mm)', 'down', 4, 'Empeno medido girando a roda no cavalete.')
    ];

    // ------------------------------------------------------------------ telhado
    [[0, 1, '--'], [0, 2, '-'], [1, 2, '-'], [0, 3, '-'], [1, 3, '+'], [1, 5, '+'], [3, 5, '+']]
        .forEach(([a, b, c]) => qfdDB.setCorrelacaoProjeto(rp[a].id, rp[b].id, c));

    // ------------------------------------------------------------- Matriz QFD
    const matriz = [
        [9, 1, 0, 3, 0, 0],   // Ser leve
        [1, 9, 0, 3, 0, 3],   // Ser resistente
        [3, 0, 9, 1, 0, 0],   // Baixo custo
        [0, 0, 0, 0, 9, 1],   // Manutenção fácil
        [0, 0, 0, 3, 0, 9]    // Rodagem suave
    ];
    matriz.forEach((linha, i) => linha.forEach((v, j) => { if (v) qfdDB.setMatrizQFD(rc[i].id, rp[j].id, v); }));
    qfdDB.calculateImportanciaCliente();
    qfdDB.calculateImportanciaProjeto();

    // --------------------------------------------------------- especificações
    qfdDB.getEspecificacoesProjeto();
    const especificacoes = [
        { unidadeMedida: 'g', tipoMeta: '<=', valorMeta: 1800, formaAvaliacao: 'Pesagem em balança' },
        { unidadeMedida: 'N', tipoMeta: '>=', valorMeta: 1500, formaAvaliacao: 'Simulação em bancada de teste' },
        { unidadeMedida: 'R$', tipoMeta: '<=', valorMeta: 180, formaAvaliacao: 'Soma dos valores gastos com material, processos e mão de obra' },
        { unidadeMedida: 'un', tipoMeta: '=', valorMeta: 32, tolerancia: 0, formaAvaliacao: 'Contagem em laboratório' },
        { unidadeMedida: 'min', tipoMeta: '<=', valorMeta: 5, formaAvaliacao: 'Cronometragem em laboratório' },
        { unidadeMedida: 'mm', tipoMeta: '<=', valorMeta: 0.5, formaAvaliacao: 'Medição com relógio comparador', observacao: 'Medido a 10 mm da borda do aro.' }
    ];
    especificacoes.forEach((campos, j) => qfdDB.updateEspecificacao(rp[j].id, campos));
    qfdDB.refreshAspectosIndesejaveisFromRoof(true);

    // ---------------------------------------------------- avaliação competitiva
    const aco = qfdDB.addConcorrente('Roda de aço aro 26');
    const aluminio = qfdDB.addConcorrente('Roda de alumínio parede dupla');
    const notas = { [PRODUTO_NOSSO_ID]: [3, 3, 4, 3, 3], [aco.id]: [2, 4, 5, 3, 2], [aluminio.id]: [5, 3, 2, 4, 4] };
    Object.entries(notas).forEach(([produto, lista]) => lista.forEach((n, i) => qfdDB.setNotaCliente(rc[i].id, produto, n)));
    qfdDB.setMetaCliente(rc[0].id, 4);
    qfdDB.setMetaCliente(rc[1].id, 4);
    const valores = {
        [PRODUTO_NOSSO_ID]: ['1950', '1400', '170', '32', '6', '0,6'],
        [aco.id]: ['2600', '1800', '90', '36', '8', '1,2'],
        [aluminio.id]: ['1700', '1300', '260', '28', '4', '0,3']
    };
    Object.entries(valores).forEach(([produto, lista]) => lista.forEach((v, j) => qfdDB.setValorTecnico(rp[j].id, produto, v)));
    qfdDB.addIndice({ nome: 'Carga por massa', formula: 'RP2 / RP1', unidade: 'N/g', sentido: 'up' });

    // ------------------------------------------------------------ referências
    qfdDB.addReferencia({
        tipo: 'norma', identificacao: 'ISO 4210-7',
        titulo: 'Bicicletas — requisitos de segurança — métodos de ensaio de rodas e aros',
        resumo: 'Define os ensaios de resistência de rodas e aros; base para a meta de carga radial e para o desvio lateral.',
        requisitos: [{ tipo: 'cliente', id: rc[1].id }, { tipo: 'projeto', id: rp[1].id }, { tipo: 'projeto', id: rp[5].id }]
    });
    qfdDB.addReferencia({
        tipo: 'produto', titulo: 'Roda de alumínio parede dupla (concorrente)',
        resumo: 'Mais leve e com menor empeno, porém mais cara; referência para massa e desvio lateral.',
        requisitos: [{ tipo: 'projeto', id: rp[0].id }, { tipo: 'projeto', id: rp[5].id }]
    });

    // ------------------------------------------------------ caderno de ideias
    qfdDB.addIdeia({
        titulo: 'Aro de alumínio com parede dupla', autor: 'Equipe', status: 'promissora',
        descricao: 'Reduz a massa mantendo a rigidez; avaliar o custo no projeto conceitual.',
        requisitos: [{ tipo: 'projeto', id: rp[0].id }, { tipo: 'projeto', id: rp[1].id }]
    });
    qfdDB.addIdeia({
        titulo: 'Câmara com válvula de engate rápido', autor: 'Equipe',
        requisitos: [{ tipo: 'cliente', id: rc[3].id }]
    });
    qfdDB.addFalha({ falha: 'Raios rompem perto do cubo', produto: 'Roda de aço aro 26', causa: 'Fadiga por tensão desigual entre os raios.' });

    // ------------------------------------------------- verificação da lista
    const criterios = {};
    Object.keys(CRITERIOS_VERIFICACAO).forEach(c => { criterios[c] = true; });
    qfdDB.setVerificacao({ criterios });
    qfdDB.registrarDescarte('Cor do aro', 'Preferência estética, sem relação com a função: tratada no design.');
    qfdDB.confirmarVerificacao();

    // ------------------------------------------------------------- fechamento
    [
        'Requisitos de cliente: ser leve, resistente, de baixo custo, de manutenção fácil e de rodagem suave.\nRetirada a preferência pela cor do aro.',
        '- Carga radial suportada (≥ 1500 N)\n- Massa da roda (≤ 1800 g)\n- Número de raios (= 32 un)\n- Custo de fabricação (≤ R$ 180)',
        '- Carga radial suportada o maior possível\n- Massa da roda o menor possível\n- Número de raios adequado\n- Custo de fabricação o menor possível',
        '- Suportar cargas elevadas\n- Ter massa reduzida',
        'Sustentar e rolar a bicicleta, suportando cargas elevadas com massa reduzida.'
    ].forEach((texto, i) => qfdDB.setPassoAbstracao(i, texto));
    qfdDB.addFormulacao('Fazer uma roda de alumínio com 32 raios');
    qfdDB.addFormulacao('Fazer uma roda leve e resistente');
    const adotada = qfdDB.addFormulacao('Sustentar e rolar a bicicleta com segurança');
    qfdDB.escolherFormulacao(adotada.id);
    qfdDB.setFuncaoGlobal({
        nome: 'Sustentar e rolar a bicicleta',
        entradas: { energia: ['Torque dos pedais'], material: ['Peso do ciclista e da bicicleta'], sinal: ['Comando de freio'] },
        saidas: { energia: ['Movimento de rolagem', 'Calor por atrito'], material: ['Carga transmitida ao solo'], sinal: ['Ruído de rolagem'] }
    });
}
