/**
 * ============================================================================
 * SISTEMA DE BANCO DE DADOS LOCAL PARA QFD
 * ============================================================================
 * 
 * Este módulo implementa uma camada de persistência de dados usando LocalStorage
 * do navegador. Gerencia todas as operações CRUD para requisitos de cliente,
 * requisitos de projeto, comparações, correlações e a matriz QFD.
 * 
 * Estrutura de Dados:
 * - requisitosCliente: Array de requisitos do cliente
 * - requisitosProjeto: Array de requisitos técnicos do projeto
 * - comparacaoCliente: Array de comparações pareadas entre requisitos cliente
 * - correlacaoProjeto: Array de correlações entre requisitos de projeto
 * - matrizQFD: Array de relações entre requisitos cliente e projeto
 * - especificacoesProjeto: Especificações (unidade, valor, texto explicativo) por requisito de projeto
 * - avaliacaoCompetitiva: Produtos avaliados (nosso e concorrentes), notas dos clientes e valores técnicos
 * - metadata: Informações sobre criação, modificação e versão da estrutura (schemaVersion)
 *
 * @class QFDDatabase
 */

/**
 * Versão atual da estrutura dos dados salvos.
 * Ao mudar a estrutura, incremente este número e adicione a migração
 * correspondente em SCHEMA_MIGRATIONS.
 */
const SCHEMA_VERSION = 4;

/** ID fixo do nosso produto na avaliação competitiva */
const PRODUTO_NOSSO_ID = 'nosso';

/** Limite de concorrentes na avaliação competitiva (a tabela fica ilegível com mais) */
const MAX_CONCORRENTES = 6;

/** Tolerância para considerar atingida a meta de um requisito nominal (*): ±5% */
const TOLERANCIA_NOMINAL = 0.05;

/**
 * Lê o primeiro número de um texto, aceitando vírgula decimal e separador de
 * milhar ("1,2" → 1.2; "1.234,5 kg" → 1234.5; "1.500" → 1500; "0.25" → 0.25;
 * "≤ 20 kW" → 20).
 *
 * @param {string} text
 * @returns {number|null} null se não houver número
 */
function parseNumero(text) {
    const match = String(text == null ? '' : text).match(/-?\d[\d.,]*/);
    if (!match) return null;
    let s = match[0].replace(/[.,]$/, '');
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
        // o último separador é o decimal; o outro é de milhar
        s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (lastComma !== -1) {
        s = (s.match(/,/g).length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (lastDot !== -1 && (s.match(/\./g).length > 1 || /^-?[1-9]\d{0,2}\.\d{3}$/.test(s))) {
        s = s.replace(/\./g, ''); // ponto de milhar, como se escreve em português
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

// ========================================================================
// METAS DAS ESPECIFICAÇÕES
// ========================================================================
// Cada especificação tem uma meta tipada (Pahl & Beitz, 5.2.1: "P > 20 kW",
// "80 bar ± 5 bar", "L < 400 mm"):
//   tipoMeta: '>=' (mínimo) | '<=' (máximo) | '=' (nominal, com tolerância
//   opcional) | 'faixa' (de valorMeta a valorMax) | '' (não definida)
//   valorMeta, valorMax, tolerancia: números ou null
//   metaTexto/revisarMeta: texto antigo que não pôde ser convertido

/** Tipo de meta sugerido pelo sentido de melhoria: ↑ ≥, ↓ ≤, * = */
function sugerirTipoMeta(sentido) {
    if (sentido === 'up') return '>=';
    if (sentido === 'down') return '<=';
    return '=';
}

/** Número de um texto que contém só o número (aceita vírgula decimal); senão null */
function parseNumeroEstrito(texto) {
    const t = String(texto == null ? '' : texto).trim();
    return /^-?\d[\d.,]*$/.test(t) ? parseNumero(t) : null;
}

/**
 * Converte um texto livre de meta ("1,2", "≥ 20 kW", "80 ± 5", "10 a 12 mm")
 * em meta tipada. Número sozinho usa o tipo sugerido pelo sentido de melhoria
 * (era assim que o sistema avaliava a meta antes). Texto que não dá para
 * converter fica em metaTexto, marcado para revisão.
 */
function interpretarMetaTexto(texto, sentido) {
    const meta = { tipoMeta: '', valorMeta: null, valorMax: null, tolerancia: null, metaTexto: '', revisarMeta: false };
    const t = String(texto == null ? '' : texto).trim()
        .replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/\+\/-/g, '±');
    if (!t) return meta;

    const NUM = '(-?\\d[\\d.,]*)';
    const UNID = '\\s*[^\\d\\s±≥≤<>=]*';
    const casa = padrao => t.match(new RegExp('^' + padrao + UNID + '$', 'i'));
    let m;
    if ((m = casa(`${NUM}\\s*±\\s*${NUM}`))) {
        return { ...meta, tipoMeta: '=', valorMeta: parseNumero(m[1]), tolerancia: Math.abs(parseNumero(m[2])) };
    }
    if ((m = casa(`${NUM}(?:\\s+(?:a|até)\\s+|\\s*[-–]\\s*)${NUM}`))) {
        const a = parseNumero(m[1]), b = parseNumero(m[2]);
        if (b > a) return { ...meta, tipoMeta: 'faixa', valorMeta: a, valorMax: b };
    }
    if ((m = casa(`[≥>]\\s*${NUM}`))) return { ...meta, tipoMeta: '>=', valorMeta: parseNumero(m[1]) };
    if ((m = casa(`[≤<]\\s*${NUM}`))) return { ...meta, tipoMeta: '<=', valorMeta: parseNumero(m[1]) };
    if ((m = casa(`=\\s*${NUM}`))) return { ...meta, tipoMeta: '=', valorMeta: parseNumero(m[1]) };
    if ((m = casa(`\\s*${NUM}`))) return { ...meta, tipoMeta: sugerirTipoMeta(sentido), valorMeta: parseNumero(m[1]) };
    return { ...meta, metaTexto: t, revisarMeta: true };
}

/** A meta está completa (tipo + valores válidos)? */
function metaDefinida(esp) {
    if (!esp || !['>=', '<=', '=', 'faixa'].includes(esp.tipoMeta) || !Number.isFinite(esp.valorMeta)) return false;
    return esp.tipoMeta !== 'faixa' || (Number.isFinite(esp.valorMax) && esp.valorMax > esp.valorMeta);
}

/** O valor medido atinge a meta? '=' sem tolerância usa ±TOLERANCIA_NOMINAL */
function atingeMeta(esp, medido) {
    const v = esp.valorMeta;
    if (esp.tipoMeta === '>=') return medido >= v;
    if (esp.tipoMeta === '<=') return medido <= v;
    if (esp.tipoMeta === 'faixa') return medido >= v && medido <= esp.valorMax;
    if (Number.isFinite(esp.tolerancia)) return Math.abs(medido - v) <= esp.tolerancia + 1e-9;
    return v === 0 ? medido === 0 : Math.abs(medido - v) <= Math.abs(v) * TOLERANCIA_NOMINAL;
}

/**
 * Valor da meta para comparar com o melhor concorrente: o limite menos
 * exigente aceito (numa faixa, o mínimo para ↑ e o máximo para ↓)
 */
function valorReferenciaMeta(esp, sentido) {
    if (esp.tipoMeta === 'faixa') return sentido === 'down' ? esp.valorMax : esp.valorMeta;
    return esp.valorMeta;
}

/** Meta formatada, sem unidade: "≥ 20", "≤ 1,2", "80 ± 5", "10 a 12" ('' se não definida) */
function formatarMeta(esp) {
    if (!metaDefinida(esp)) return '';
    const f = n => (typeof formatarNumero === 'function' ? formatarNumero(n) : String(n));
    if (esp.tipoMeta === '>=') return `≥ ${f(esp.valorMeta)}`;
    if (esp.tipoMeta === '<=') return `≤ ${f(esp.valorMeta)}`;
    if (esp.tipoMeta === 'faixa') return `${f(esp.valorMeta)} a ${f(esp.valorMax)}`;
    return Number.isFinite(esp.tolerancia) && esp.tolerancia > 0
        ? `${f(esp.valorMeta)} ± ${f(esp.tolerancia)}` : f(esp.valorMeta);
}

/** Só os campos de meta presentes em obj */
function pickMeta(obj) {
    const out = {};
    ['tipoMeta', 'valorMeta', 'valorMax', 'tolerancia', 'metaTexto', 'revisarMeta'].forEach(k => {
        if (obj && obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
}

/** Campos de meta vazios (especificação nova) */
function metaVazia() {
    return { tipoMeta: '', valorMeta: null, valorMax: null, tolerancia: null, metaTexto: '', revisarMeta: false };
}

/** Estrutura inicial da avaliação competitiva: só o nosso produto, sem notas */
function criarAvaliacaoCompetitivaVazia() {
    return {
        produtos: [{ id: PRODUTO_NOSSO_ID, nome: 'Nosso produto', tipo: 'nosso' }],
        notasCliente: [],     // { requisitoClienteId, produtoId, nota (1 a 5) }
        metasCliente: [],     // { requisitoClienteId, meta (1 a 5) }
        valoresTecnicos: []   // { requisitoProjetoId, produtoId, valor (texto) }
    };
}

/**
 * Migrações da estrutura dos dados. A chave é a versão de destino: a função
 * recebe dados na versão (chave - 1) e os altera para a versão (chave).
 * Dados sem schemaVersion são tratados como versão 1.
 */
const SCHEMA_MIGRATIONS = {
    // v2: texto explicativo (observacao), especificações de projeto e
    // sentido de melhoria padronizado em 'up' | 'down' | 'none'
    2(data) {
        const sentidos = { crescente: 'up', decrescente: 'down', nominal: 'none' };

        ['requisitosCliente', 'requisitosProjeto', 'comparacaoCliente',
         'correlacaoProjeto', 'matrizQFD', 'especificacoesProjeto'].forEach(key => {
            if (!Array.isArray(data[key])) data[key] = [];
        });

        data.requisitosCliente.forEach(req => {
            if (typeof req.observacao !== 'string') req.observacao = '';
            if (typeof req.importancia !== 'number') req.importancia = 0;
            if (typeof req.peso !== 'number') req.peso = 0;
        });

        data.requisitosProjeto.forEach(req => {
            if (typeof req.observacao !== 'string') req.observacao = '';
            const sentido = String(req.sentidoMelhoria || '').toLowerCase();
            req.sentidoMelhoria = sentidos[sentido] || (['up', 'down', 'none'].includes(sentido) ? sentido : 'none');
            req.dificuldadeTecnica = Number(req.dificuldadeTecnica) || 1;
        });

        data.especificacoesProjeto.forEach(esp => {
            if (typeof esp.observacao !== 'string') esp.observacao = '';
        });
    },

    // v3: avaliação competitiva (nosso produto x concorrentes)
    3(data) {
        if (!data.avaliacaoCompetitiva || typeof data.avaliacaoCompetitiva !== 'object') {
            data.avaliacaoCompetitiva = criarAvaliacaoCompetitivaVazia();
        }
    },

    // v4: "valor unitário" (texto livre) vira meta tipada (tipoMeta, valorMeta...)
    4(data) {
        (data.especificacoesProjeto || []).forEach(esp => {
            const rp = (data.requisitosProjeto || []).find(r => r.id === esp.requisitoProjetoId);
            Object.assign(esp, interpretarMetaTexto(esp.valorUnitario, rp && rp.sentidoMelhoria));
            delete esp.valorUnitario;
        });
    }
};

class QFDDatabase {
    /**
     * Construtor da classe QFDDatabase
     * Inicializa a chave de armazenamento e cria a estrutura inicial do banco
     */
    constructor() {
        this.storageKey = 'qfd_data';
        this.initializeDatabase();
    }

    // ========================================================================
    // SEÇÃO 1: INICIALIZAÇÃO E GERENCIAMENTO DE DADOS
    // ========================================================================

    /**
     * Inicializa a estrutura do banco de dados no LocalStorage
     * Cria a estrutura padrão se não existir
     */
    initializeDatabase() {
        const defaultData = {
            requisitosCliente: [],
            requisitosProjeto: [],
            comparacaoCliente: [],
            correlacaoProjeto: [],
            matrizQFD: [],
            especificacoesProjeto: [],
            avaliacaoCompetitiva: criarAvaliacaoCompetitivaVazia(),
            metadata: {
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                schemaVersion: SCHEMA_VERSION
            }
        };

        if (!localStorage.getItem(this.storageKey)) {
            this.saveData(defaultData);
        } else {
            this.loadData(); // aplica migrações pendentes já na abertura da página
        }
    }

    /**
     * Versão da estrutura de um conjunto de dados (1 se não houver schemaVersion)
     *
     * @param {Object} data - Dados do projeto
     * @returns {number}
     */
    getSchemaVersion(data) {
        const version = data && data.metadata && Number(data.metadata.schemaVersion);
        return version > 0 ? version : 1;
    }

    /**
     * Atualiza os dados para a versão atual da estrutura, aplicando as
     * migrações pendentes em ordem. Altera o objeto recebido.
     *
     * @param {Object} data - Dados do projeto em qualquer versão anterior
     * @returns {boolean} true se alguma migração foi aplicada
     * @throws {Error} Se os dados forem de uma versão mais nova que a do sistema
     */
    migrateData(data) {
        const from = this.getSchemaVersion(data);
        if (from > SCHEMA_VERSION) {
            throw new Error(`Dados na versão ${from}, mas o sistema suporta até a versão ${SCHEMA_VERSION}. Atualize o sistema.`);
        }
        if (from === SCHEMA_VERSION) return false;

        if (!data.metadata || typeof data.metadata !== 'object') {
            data.metadata = { created: new Date().toISOString() };
        }
        for (let version = from + 1; version <= SCHEMA_VERSION; version++) {
            SCHEMA_MIGRATIONS[version](data);
            data.metadata.schemaVersion = version;
        }
        delete data.metadata.version; // campo antigo ('1.0'), substituído por schemaVersion
        return true;
    }

    /**
     * Salva dados no LocalStorage
     * Atualiza automaticamente a data de última modificação
     * 
     * @param {Object} data - Objeto com todos os dados do projeto QFD
     */
    saveData(data) {
        data.metadata.lastModified = new Date().toISOString();
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            if (this.isQuotaError(error)) {
                alert('O espaço de armazenamento do navegador está cheio e a última alteração NÃO foi salva.\n\n' +
                      'Exporte um backup (Backup & Export → Exportar Backup) e libere espaço removendo dados de outros sites.');
            }
            throw error;
        }
    }

    /** Indica se o erro é de armazenamento cheio (o nome varia entre navegadores) */
    isQuotaError(error) {
        return error instanceof DOMException &&
            (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22);
    }

    /**
     * Carrega dados do LocalStorage, migrando-os para a versão atual da
     * estrutura se estiverem numa versão anterior
     *
     * @returns {Object|null} Dados do projeto ou null se não existir
     */
    loadData() {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return null;

        let data;
        try {
            data = JSON.parse(raw);
            if (!data || typeof data !== 'object' || !data.metadata) throw new Error('estrutura inválida');
        } catch (error) {
            return this.recoverCorruptedData(raw, error);
        }
        if (this.migrateData(data)) {
            this.saveData(data);
        }
        return data;
    }

    /**
     * Trata dados ilegíveis no LocalStorage: guarda uma cópia do conteúdo
     * original em 'qfd_data_corrompido', restaura o backup automático (se
     * houver um válido) ou recomeça um projeto vazio, e avisa o usuário.
     *
     * @param {string} raw - Conteúdo original ilegível
     * @param {Error} error - Erro encontrado ao ler
     * @returns {Object} Dados recuperados
     */
    recoverCorruptedData(raw, error) {
        console.error('Dados do projeto corrompidos:', error);
        try {
            localStorage.setItem('qfd_data_corrompido', raw);
        } catch (e) { /* sem espaço para a cópia; segue com a recuperação */ }

        let recovered = null;
        try {
            const backup = JSON.parse(localStorage.getItem('qfd_backup'));
            if (backup && Array.isArray(backup.requisitosCliente) && Array.isArray(backup.requisitosProjeto)) {
                delete backup.backup;
                if (!backup.metadata) backup.metadata = { created: new Date().toISOString() };
                this.migrateData(backup);
                recovered = backup;
            }
        } catch (e) { /* backup ausente ou também corrompido */ }

        localStorage.removeItem(this.storageKey);
        if (recovered) {
            this.saveData(recovered);
            alert('Os dados do projeto estavam corrompidos e foram restaurados a partir do último backup automático.\n\n' +
                  'Uma cópia do conteúdo original foi guardada no navegador como "qfd_data_corrompido".');
        } else {
            this.initializeDatabase();
            alert('Os dados do projeto estavam corrompidos e não havia backup válido; um projeto vazio foi iniciado.\n\n' +
                  'Se você tiver um arquivo de backup (.json), importe-o em Backup & Export → Importar Backup.');
        }
        return JSON.parse(localStorage.getItem(this.storageKey));
    }

    /**
     * Procura um requisito com a mesma descrição (ignora maiúsculas e espaços extras)
     *
     * @param {'cliente'|'projeto'} tipo - Tipo do requisito
     * @param {string} descricao - Descrição a verificar
     * @param {string} [ignoreId] - ID a ignorar (o próprio requisito, ao editar)
     * @returns {Object|null} O requisito duplicado, se existir
     */
    findRequisitoDuplicado(tipo, descricao, ignoreId = null) {
        const normalizar = texto => String(texto || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const alvo = normalizar(descricao);
        const lista = tipo === 'cliente' ? this.getRequisitosCliente() : this.getRequisitosProjeto();
        return lista.find(req => req.id !== ignoreId && normalizar(req.descricao) === alvo) || null;
    }

    /**
     * Gera um UUID (Identificador Único Universal) simples
     * Usado para identificar unicamente cada requisito
     * 
     * @returns {string} UUID no formato xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // ========================================================================
    // SEÇÃO 2: GERENCIAMENTO DE REQUISITOS DE CLIENTE
    // ========================================================================
    // 
    // Requisitos de Cliente são as necessidades e expectativas expressas
    // pelo cliente sobre o produto. Eles são hierarquizados através de
    // comparações pareadas (Diagrama de Mudge).
    
    /**
     * Adiciona um novo requisito de cliente
     * 
     * @param {string} descricao - Descrição do requisito do cliente
     * @param {string} [observacao=''] - Texto explicativo do requisito
     * @returns {Object} Objeto do requisito criado com ID, descrição, importância e peso
     */
    addRequisitoCliente(descricao, observacao = '') {
        const data = this.loadData();
        const novoRequisito = {
            id: this.generateUUID(),
            descricao: descricao.trim(),
            observacao: (observacao || '').trim(),
            importancia: 0,
            peso: 0,
            created: new Date().toISOString()
        };
        
        data.requisitosCliente.push(novoRequisito);
        this.saveData(data);
        return novoRequisito;
    }

    /**
     * Obtém todos os requisitos de cliente cadastrados
     * 
     * @returns {Array} Array com todos os requisitos de cliente
     */
    getRequisitosCliente() {
        const data = this.loadData();
        return data.requisitosCliente || [];
    }

    /**
     * Remove um requisito de cliente e todas suas relações
     * Remove também comparações e relações na matriz QFD associadas
     * 
     * @param {string} id - ID único do requisito a ser removido
     */
    removeRequisitoCliente(id) {
        const data = this.loadData();
        data.requisitosCliente = data.requisitosCliente.filter(req => req.id !== id);
        
        // Remove comparações relacionadas
        data.comparacaoCliente = data.comparacaoCliente.filter(
            comp => comp.requisito1 !== id && comp.requisito2 !== id
        );
        
        // Remove relações na matriz QFD
        data.matrizQFD = data.matrizQFD.filter(rel => rel.requisitoCliente !== id);

        // Remove notas e metas da avaliação competitiva
        const av = this._ensureAvaliacao(data);
        av.notasCliente = av.notasCliente.filter(n => n.requisitoClienteId !== id);
        av.metasCliente = av.metasCliente.filter(m => m.requisitoClienteId !== id);

        this.saveData(data);
    }

    /**
     * Atualiza propriedades de um requisito de cliente existente
     * 
     * @param {string} id - ID único do requisito
     * @param {Object} updates - Objeto com as propriedades a serem atualizadas
     * @returns {Object|null} Requisito atualizado ou null se não encontrado
     */
    updateRequisitoCliente(id, updates) {
        const data = this.loadData();
        const index = data.requisitosCliente.findIndex(req => req.id === id);
        if (index !== -1) {
            data.requisitosCliente[index] = { ...data.requisitosCliente[index], ...updates };
            this.saveData(data);
            return data.requisitosCliente[index];
        }
        return null;
    }

    // ========================================================================
    // SEÇÃO 3: GERENCIAMENTO DE REQUISITOS DE PROJETO
    // ========================================================================
    // 
    // Requisitos de Projeto são as características técnicas que devem ser
    // implementadas para atender aos requisitos do cliente. Cada requisito
    // possui um sentido de melhoria (crescente, decrescente ou nominal) e
    // uma dificuldade técnica (1-5).
    
    /**
     * Adiciona um novo requisito de projeto
     * 
     * @param {string} descricao - Descrição do requisito técnico
     * @param {string} sentidoMelhoria - Sentido da melhoria: 'up' (crescente), 'down' (decrescente) ou 'none' (nominal)
     * @param {number} dificuldadeTecnica - Nível de dificuldade técnica (1-5)
     * @param {string} [observacao=''] - Texto explicativo do requisito
     * @returns {Object} Objeto do requisito criado
     */
    addRequisitoProjeto(descricao, sentidoMelhoria = 'none', dificuldadeTecnica = 1, observacao = '') {
        const data = this.loadData();
        const novoRequisito = {
            id: this.generateUUID(),
            descricao: descricao.trim(),
            observacao: (observacao || '').trim(),
            sentidoMelhoria: sentidoMelhoria, // 'up', 'down', 'none'
            dificuldadeTecnica: dificuldadeTecnica,
            importanciaAbsoluta: 0,
            importanciaRelativa: 0,
            pesoRelativo: 0,
            created: new Date().toISOString()
        };
        
        data.requisitosProjeto.push(novoRequisito);
        this._ensureEspecificacoesArray(data);
        this._syncEspecificacoesEntries(data);
        this.saveData(data);
        return novoRequisito;
    }

    /**
     * Obtém todos os requisitos de projeto cadastrados
     * 
     * @returns {Array} Array com todos os requisitos de projeto
     */
    getRequisitosProjeto() {
        const data = this.loadData();
        return data.requisitosProjeto || [];
    }

    /**
     * Remove um requisito de projeto e todas suas relações
     * Remove também correlações e relações na matriz QFD associadas
     * 
     * @param {string} id - ID único do requisito a ser removido
     */
    removeRequisitoProjeto(id) {
        const data = this.loadData();
        data.requisitosProjeto = data.requisitosProjeto.filter(req => req.id !== id);
        
        // Remove correlações relacionadas
        data.correlacaoProjeto = data.correlacaoProjeto.filter(
            corr => corr.requisito1 !== id && corr.requisito2 !== id
        );
        
        // Remove relações na matriz QFD
        data.matrizQFD = data.matrizQFD.filter(rel => rel.requisitoProjeto !== id);

        this._ensureEspecificacoesArray(data);
        data.especificacoesProjeto = data.especificacoesProjeto.filter(
            esp => esp.requisitoProjetoId !== id
        );

        const av = this._ensureAvaliacao(data);
        av.valoresTecnicos = av.valoresTecnicos.filter(v => v.requisitoProjetoId !== id);

        this.saveData(data);
    }

    /**
     * Atualiza propriedades de um requisito de projeto existente
     * 
     * @param {string} id - ID único do requisito
     * @param {Object} updates - Objeto com as propriedades a serem atualizadas
     * @returns {Object|null} Requisito atualizado ou null se não encontrado
     */
    updateRequisitoProjeto(id, updates) {
        const data = this.loadData();
        const index = data.requisitosProjeto.findIndex(req => req.id === id);
        if (index !== -1) {
            data.requisitosProjeto[index] = { ...data.requisitosProjeto[index], ...updates };
            this.saveData(data);
            return data.requisitosProjeto[index];
        }
        return null;
    }

    // ========================================================================
    // SEÇÃO 4: GERENCIAMENTO DE COMPARAÇÕES DE CLIENTE (DIAGRAMA DE MUDGE)
    // ========================================================================
    // 
    // O Diagrama de Mudge é usado para hierarquizar requisitos através de
    // comparações pareadas. Cada comparação indica qual requisito é mais
    // importante e em que grau (1, 3 ou 5).
    // 
    // Valores possíveis:
    // - 1: Pouco mais importante
    // - 3: Moderadamente mais importante
    // - 5: Muito mais importante
    
    /**
     * Adiciona ou atualiza uma comparação entre dois requisitos de cliente
     * Remove comparação existente antes de adicionar nova (evita duplicatas)
     * Recalcula automaticamente a importância dos requisitos após salvar
     * 
     * @param {string} requisito1 - ID do requisito vencedor da comparação
     * @param {string} requisito2 - ID do requisito perdedor da comparação
     * @param {number} valor - Valor da importância (1, 3 ou 5)
     */
    setComparacaoCliente(requisito1, requisito2, valor) {
        const data = this.loadData();
        
        // Remove comparação existente
        data.comparacaoCliente = data.comparacaoCliente.filter(
            comp => !(
                (comp.requisito1 === requisito1 && comp.requisito2 === requisito2) ||
                (comp.requisito1 === requisito2 && comp.requisito2 === requisito1)
            )
        );
        
        // Adiciona nova comparação
        if (valor > 0) {
            data.comparacaoCliente.push({
                requisito1,
                requisito2,
                valor,
                created: new Date().toISOString()
            });
        }
        
        this.saveData(data);
        this.calculateImportanciaCliente();
    }

    /**
     * Obtém o valor de comparação entre dois requisitos de cliente
     * 
     * IMPORTANTE: Retorna o valor apenas se requisito1 foi o vencedor.
     * Se requisito2 venceu, retorna 0 (pois requisito1 não ganhou pontos).
     * 
     * @param {string} requisito1 - ID do primeiro requisito
     * @param {string} requisito2 - ID do segundo requisito
     * @returns {number} Valor da comparação (1, 3, 5) ou 0 se não existe ou se requisito1 perdeu
     */
    getComparacaoCliente(requisito1, requisito2) {
        const data = this.loadData();
        const comp = data.comparacaoCliente.find(
            c => (c.requisito1 === requisito1 && c.requisito2 === requisito2) ||
                 (c.requisito1 === requisito2 && c.requisito2 === requisito1)
        );
        
        if (!comp) return 0;
        
        // No Diagrama de Mudge:
        // Se requisito1 venceu (está salvo como requisito1), retorna o valor (1, 3 ou 5).
        // Se requisito2 venceu (está salvo como requisito1), requisito1 recebe 0 pontos.
        // Retornamos um objeto ou valor que indique quem venceu para a interface.
        // Para manter compatibilidade com a matriz que espera um valor para req1:
        if (comp.requisito1 === requisito1) {
            return comp.valor;
        } else {
            // Retornamos um valor negativo ou especial para indicar que o outro venceu?
            // Melhor retornar o valor mas com sinal de quem venceu para a lógica da matriz.
            // Mas a matriz triangular superior usa i < j.
            return 0; 
        }
    }

    /**
     * Obtém todas as comparações de cliente cadastradas
     * 
     * @returns {Array} Array com todas as comparações
     */
    getComparacoesCliente() {
        const data = this.loadData();
        return data.comparacaoCliente || [];
    }

    /**
     * Calcula a importância e o peso relativo de cada requisito de cliente
     * baseado nas comparações realizadas (Diagrama de Mudge)
     * 
     * Algoritmo:
     * 1. Soma os pontos de cada requisito (apenas quando ele é o vencedor)
     * 2. Normaliza os pesos dividindo pela soma total
     */
    calculateImportanciaCliente() {
        const data = this.loadData();
        const requisitos = data.requisitosCliente;
        const comparacoes = data.comparacaoCliente;
        
        // Calcula pontuação para cada requisito
        requisitos.forEach(req => {
            let pontuacao = 0;
            
            comparacoes.forEach(comp => {
                if (comp.requisito1 === req.id) {
                    pontuacao += comp.valor;
                }
                // No novo modelo, se ele é requisito2 e está salvo, ele perdeu (0 pontos)
                // A pontuação só é somada para o requisito1 (vencedor)
            });
            
            req.importancia = pontuacao;
        });
        
        // Normaliza os pesos
        const totalImportancia = requisitos.reduce((sum, req) => sum + req.importancia, 0);
        if (totalImportancia > 0) {
            requisitos.forEach(req => {
                req.peso = req.importancia / totalImportancia;
            });
        }
        
        this.saveData(data);
    }

    // ========================================================================
    // SEÇÃO 5: GERENCIAMENTO DE CORRELAÇÕES DE PROJETO (TELHADO QFD)
    // ========================================================================
    // 
    // Correlações indicam como os requisitos técnicos se relacionam entre si.
    // São representadas no "telhado" da Casa da Qualidade.
    // 
    // Valores possíveis:
    // - '++': Correlação positiva muito forte (sinergia forte)
    // - '+': Correlação positiva (sinergia moderada)
    // - '0': Sem correlação (independentes)
    // - '-': Correlação negativa (competem entre si)
    // - '--': Correlação negativa muito forte (conflitantes)
    
    /**
     * Adiciona ou atualiza uma correlação entre dois requisitos de projeto
     * Remove correlação existente antes de adicionar nova (evita duplicatas)
     * 
     * @param {string} requisito1 - ID do primeiro requisito
     * @param {string} requisito2 - ID do segundo requisito
     * @param {string} correlacao - Tipo de correlação ('++', '+', '0', '-', '--')
     */
    setCorrelacaoProjeto(requisito1, requisito2, correlacao) {
        const data = this.loadData();
        
        // Remove correlação existente
        data.correlacaoProjeto = data.correlacaoProjeto.filter(
            corr => !(
                (corr.requisito1 === requisito1 && corr.requisito2 === requisito2) ||
                (corr.requisito1 === requisito2 && corr.requisito2 === requisito1)
            )
        );
        
        // Adiciona nova correlação se não for neutra
        if (correlacao !== '0') {
            data.correlacaoProjeto.push({
                requisito1,
                requisito2,
                correlacao,
                created: new Date().toISOString()
            });
        }
        
        this.saveData(data);
    }

    /**
     * Obtém a correlação entre dois requisitos de projeto
     * 
     * @param {string} requisito1 - ID do primeiro requisito
     * @param {string} requisito2 - ID do segundo requisito
     * @returns {string} Tipo de correlação ou '0' (neutra) se não existe
     */
    getCorrelacaoProjeto(requisito1, requisito2) {
        const data = this.loadData();
        const corr = data.correlacaoProjeto.find(
            c => (c.requisito1 === requisito1 && c.requisito2 === requisito2) ||
                 (c.requisito1 === requisito2 && c.requisito2 === requisito1)
        );
        
        return corr ? corr.correlacao : '0';
    }

    // Obtém todas as correlações de projeto
    getCorrelacoesProjeto() {
        const data = this.loadData();
        return data.correlacaoProjeto || [];
    }

    // === MATRIZ QFD ===
    
    // Adiciona/atualiza relação na matriz QFD
    setMatrizQFD(requisitoCliente, requisitoProjeto, influencia) {
        const data = this.loadData();
        
        // Remove relação existente
        data.matrizQFD = data.matrizQFD.filter(
            rel => !(rel.requisitoCliente === requisitoCliente && rel.requisitoProjeto === requisitoProjeto)
        );
        
        // Adiciona nova relação se houver influência
        if (influencia > 0) {
            data.matrizQFD.push({
                requisitoCliente,
                requisitoProjeto,
                influencia,
                created: new Date().toISOString()
            });
        }
        
        this.saveData(data);
        this.calculateImportanciaProjeto();
    }

    /**
     * Obtém o valor de influência entre um requisito de cliente e um de projeto
     * 
     * @param {string} requisitoCliente - ID do requisito de cliente
     * @param {string} requisitoProjeto - ID do requisito de projeto
     * @returns {number} Valor da influência (0, 1, 3 ou 9) ou 0 se não existe
     */
    getMatrizQFD(requisitoCliente, requisitoProjeto) {
        const data = this.loadData();
        const rel = data.matrizQFD.find(
            r => r.requisitoCliente === requisitoCliente && r.requisitoProjeto === requisitoProjeto
        );
        
        return rel ? rel.influencia : 0;
    }

    /**
     * Obtém todas as relações da matriz QFD cadastradas
     * 
     * @returns {Array} Array com todas as relações da matriz
     */
    getMatrizQFDCompleta() {
        const data = this.loadData();
        return data.matrizQFD || [];
    }

    /**
     * Calcula a importância absoluta, relativa (ranking) e peso relativo
     * de cada requisito de projeto baseado na matriz QFD
     * 
     * Algoritmo:
     * 1. Importância Absoluta = Soma (influência × importância do requisito cliente)
     * 2. Importância Relativa = Ranking baseado na importância absoluta (1º, 2º, etc.)
     * 3. Peso Relativo = Importância absoluta normalizada (0 a 1)
     */
    calculateImportanciaProjeto() {
        const data = this.loadData();
        const requisitosProjeto = data.requisitosProjeto;
        const requisitosCliente = data.requisitosCliente;
        const matrizQFD = data.matrizQFD;
        
        // Calcula importância absoluta para cada requisito de projeto
        requisitosProjeto.forEach(reqProj => {
            let importanciaAbsoluta = 0;
            
            matrizQFD.forEach(rel => {
                if (rel.requisitoProjeto === reqProj.id) {
                    const reqCliente = requisitosCliente.find(rc => rc.id === rel.requisitoCliente);
                    if (reqCliente) {
                        importanciaAbsoluta += rel.influencia * reqCliente.importancia;
                    }
                }
            });
            
            reqProj.importanciaAbsoluta = importanciaAbsoluta;
        });
        
        // Calcula importância relativa (ranking); empates ficam na mesma posição (1, 1, 3)
        const sortedRequisitos = [...requisitosProjeto].sort((a, b) => b.importanciaAbsoluta - a.importanciaAbsoluta);
        sortedRequisitos.forEach((req, index) => {
            const anterior = sortedRequisitos[index - 1];
            req.importanciaRelativa = anterior && Math.abs(anterior.importanciaAbsoluta - req.importanciaAbsoluta) < 1e-9
                ? anterior.importanciaRelativa
                : index + 1;
        });

        // Calcula peso relativo (normalizado); sem relações, zera em vez de manter o valor antigo
        const totalImportancia = requisitosProjeto.reduce((sum, req) => sum + req.importanciaAbsoluta, 0);
        requisitosProjeto.forEach(req => {
            req.pesoRelativo = totalImportancia > 0 ? req.importanciaAbsoluta / totalImportancia : 0;
        });
        
        this.saveData(data);
    }

    // ========================================================================
    // SEÇÃO 7: FUNÇÕES UTILITÁRIAS E MANUTENÇÃO
    // ========================================================================
    
    /**
     * Limpa todos os dados do projeto e reinicializa o banco
     * ATENÇÃO: Esta ação não pode ser desfeita!
     */
    clearAllData() {
        localStorage.removeItem(this.storageKey);
        this.initializeDatabase();
    }

    // ========================================================================
    // SEÇÃO: ESPECIFICAÇÕES DE REQUISITOS DE PROJETO
    // ========================================================================

    _ensureEspecificacoesArray(data) {
        if (!data.especificacoesProjeto) {
            data.especificacoesProjeto = [];
        }
    }

    /**
     * Gera texto de aspectos indesejáveis a partir de correlações fortemente negativas (--)
     */
    buildAspectosIndesejaveisFromRoof(requisitoProjetoId) {
        const data = this.loadData();
        const requisitos = data.requisitosProjeto || [];
        const conflitos = [];

        (data.correlacaoProjeto || []).forEach(corr => {
            if (corr.correlacao !== '--') return;
            let otherId = null;
            if (corr.requisito1 === requisitoProjetoId) otherId = corr.requisito2;
            else if (corr.requisito2 === requisitoProjetoId) otherId = corr.requisito1;
            if (!otherId) return;

            const idx = requisitos.findIndex(r => r.id === otherId);
            const other = requisitos[idx];
            if (other) {
                conflitos.push(`RP${idx + 1}: ${other.descricao} (correlação --)`);
            }
        });

        return conflitos.join('\n');
    }

    _syncEspecificacoesEntries(data) {
        this._ensureEspecificacoesArray(data);
        const ids = (data.requisitosProjeto || []).map(r => r.id);

        data.especificacoesProjeto = data.especificacoesProjeto.filter(
            esp => ids.includes(esp.requisitoProjetoId)
        );

        ids.forEach(id => {
            let esp = data.especificacoesProjeto.find(e => e.requisitoProjetoId === id);
            if (!esp) {
                esp = {
                    requisitoProjetoId: id,
                    unidadeMedida: '',
                    ...metaVazia(),
                    observacao: '',
                    aspectosIndesejaveis: this.buildAspectosIndesejaveisFromRoof(id),
                    aspectosAutoGerado: true,
                    updated: new Date().toISOString()
                };
                data.especificacoesProjeto.push(esp);
            }
        });
    }

    getEspecificacoesProjeto() {
        const data = this.loadData();
        this._syncEspecificacoesEntries(data);
        this.saveData(data);
        return data.especificacoesProjeto;
    }

    /**
     * Requisitos de projeto ordenados por importância QFD, com dados de especificação
     */
    getEspecificacoesOrdenadas() {
        if (typeof this.calculateImportanciaProjeto === 'function') {
            this.calculateImportanciaProjeto();
        }
        // As correlações costumam ser definidas depois dos requisitos: recalcula
        // os aspectos indesejáveis que o usuário não editou manualmente
        this.refreshAspectosIndesejaveisFromRoof(true);
        const requisitos = this.getRequisitosProjeto();
        const especificacoes = this.getEspecificacoesProjeto();
        const ordenados = [...requisitos].sort(
            (a, b) => (b.importanciaAbsoluta || 0) - (a.importanciaAbsoluta || 0)
        );

        return ordenados.map((req, rank) => {
            const esp = especificacoes.find(e => e.requisitoProjetoId === req.id) || {};
            const numOriginal = requisitos.findIndex(r => r.id === req.id) + 1;
            return {
                requisito: req,
                rank: rank + 1,
                numeroOriginal: numOriginal,
                unidadeMedida: esp.unidadeMedida || '',
                ...metaVazia(),
                ...pickMeta(esp),
                metaFormatada: formatarMeta(esp),
                observacao: esp.observacao || '',
                aspectosIndesejaveis: esp.aspectosIndesejaveis || '',
                aspectosAutoGerado: esp.aspectosAutoGerado !== false
            };
        });
    }

    updateEspecificacao(requisitoProjetoId, fields) {
        const data = this.loadData();
        this._syncEspecificacoesEntries(data);
        const index = data.especificacoesProjeto.findIndex(
            e => e.requisitoProjetoId === requisitoProjetoId
        );
        if (index === -1) return null;

        const current = data.especificacoesProjeto[index];
        if (fields.valorUnitario !== undefined) {
            // formato antigo (texto livre): converte em meta tipada
            const rp = (data.requisitosProjeto || []).find(r => r.id === requisitoProjetoId);
            fields = { ...fields, ...interpretarMetaTexto(fields.valorUnitario, rp && rp.sentidoMelhoria) };
            delete fields.valorUnitario;
        }
        if (fields.aspectosIndesejaveis !== undefined &&
            fields.aspectosIndesejaveis !== current.aspectosIndesejaveis) {
            fields.aspectosAutoGerado = false;
        }

        data.especificacoesProjeto[index] = {
            ...current,
            ...fields,
            updated: new Date().toISOString()
        };
        this.saveData(data);
        return data.especificacoesProjeto[index];
    }

    refreshAspectosIndesejaveisFromRoof(onlyAuto = true) {
        const data = this.loadData();
        this._syncEspecificacoesEntries(data);
        data.especificacoesProjeto.forEach(esp => {
            if (!onlyAuto || esp.aspectosAutoGerado !== false) {
                esp.aspectosIndesejaveis = this.buildAspectosIndesejaveisFromRoof(esp.requisitoProjetoId);
                esp.aspectosAutoGerado = true;
                esp.updated = new Date().toISOString();
            }
        });
        this.saveData(data);
    }

    getEspecificacoesStats() {
        const data = this.loadData();
        this._syncEspecificacoesEntries(data);
        const total = (data.requisitosProjeto || []).length;
        if (total === 0) {
            return { total: 0, completed: 0, percent: 0 };
        }
        const completed = (data.especificacoesProjeto || []).filter(esp =>
            String(esp.unidadeMedida || '').trim() !== '' && metaDefinida(esp)
        ).length;
        return {
            total,
            completed,
            percent: Math.round((completed / total) * 100)
        };
    }

    importEspecificacoesJson(jsonData) {
        try {
            const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            const lista = parsed.especificacoesProjeto || parsed;
            if (!Array.isArray(lista)) return false;

            const data = this.loadData();
            this._syncEspecificacoesEntries(data);

            lista.forEach(item => {
                const id = item.requisitoProjetoId;
                if (!id) return;
                const index = data.especificacoesProjeto.findIndex(e => e.requisitoProjetoId === id);
                if (index === -1) return;
                let meta = pickMeta(item);
                if (item.tipoMeta === undefined && item.valorUnitario !== undefined) {
                    // arquivo exportado antes da meta tipada
                    const rp = (data.requisitosProjeto || []).find(r => r.id === id);
                    meta = interpretarMetaTexto(item.valorUnitario, rp && rp.sentidoMelhoria);
                }
                const atual = { ...data.especificacoesProjeto[index] };
                delete atual.valorUnitario;
                data.especificacoesProjeto[index] = {
                    ...atual,
                    ...meta,
                    unidadeMedida: item.unidadeMedida ?? data.especificacoesProjeto[index].unidadeMedida,
                    observacao: item.observacao ?? data.especificacoesProjeto[index].observacao ?? '',
                    aspectosIndesejaveis: item.aspectosIndesejaveis ?? data.especificacoesProjeto[index].aspectosIndesejaveis,
                    aspectosAutoGerado: item.aspectosAutoGerado ?? false,
                    updated: new Date().toISOString()
                };
            });

            this.saveData(data);
            return true;
        } catch (error) {
            console.error('Erro ao importar especificações:', error);
            return false;
        }
    }

    exportEspecificacoesJson() {
        const data = this.loadData();
        return {
            especificacoesProjeto: data.especificacoesProjeto || [],
            exportedAt: new Date().toISOString()
        };
    }

    // ========================================================================
    // SEÇÃO: AVALIAÇÃO COMPETITIVA (NOSSO PRODUTO x CONCORRENTES)
    // ========================================================================
    //
    // Avaliação competitiva da Casa da Qualidade (Pahl & Beitz, Fig. 3.4):
    // - avaliação dos clientes: nota de 1 (pior) a 5 (melhor) de cada produto
    //   em cada requisito de cliente, e a meta de nota do nosso produto;
    // - avaliação técnica: valor medido de cada produto em cada requisito de
    //   projeto, comparado com a meta das especificações.

    /** Garante a estrutura da avaliação competitiva em data e a retorna */
    _ensureAvaliacao(data) {
        let av = data.avaliacaoCompetitiva;
        if (!av || typeof av !== 'object' || Array.isArray(av)) {
            av = data.avaliacaoCompetitiva = criarAvaliacaoCompetitivaVazia();
        }
        ['produtos', 'notasCliente', 'metasCliente', 'valoresTecnicos'].forEach(key => {
            if (!Array.isArray(av[key])) av[key] = [];
        });
        if (!av.produtos.some(p => p.id === PRODUTO_NOSSO_ID)) {
            av.produtos.unshift(criarAvaliacaoCompetitivaVazia().produtos[0]);
        }
        return av;
    }

    getAvaliacaoCompetitiva() {
        return this._ensureAvaliacao(this.loadData());
    }

    /** Normaliza e valida o nome de um produto avaliado */
    _nomeProduto(av, nome, ignoreId = null) {
        const texto = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        if (!texto) throw new Error('Informe o nome do produto.');
        if (av.produtos.some(p => p.id !== ignoreId && p.nome.toLowerCase() === texto.toLowerCase())) {
            throw new Error(`Já existe um produto chamado "${texto}".`);
        }
        return texto;
    }

    /**
     * Adiciona um concorrente
     *
     * @param {string} nome - Nome do concorrente ou do produto dele
     * @returns {Object} Produto criado
     * @throws {Error} Nome vazio, repetido ou limite de concorrentes atingido
     */
    addConcorrente(nome) {
        const data = this.loadData();
        const av = this._ensureAvaliacao(data);
        if (av.produtos.filter(p => p.tipo !== 'nosso').length >= MAX_CONCORRENTES) {
            throw new Error(`Limite de ${MAX_CONCORRENTES} concorrentes atingido.`);
        }
        const produto = {
            id: this.generateUUID(),
            nome: this._nomeProduto(av, nome),
            tipo: 'concorrente',
            created: new Date().toISOString()
        };
        av.produtos.push(produto);
        this.saveData(data);
        return produto;
    }

    /** Renomeia um produto avaliado (inclusive o nosso) */
    renameProdutoAvaliado(id, nome) {
        const data = this.loadData();
        const av = this._ensureAvaliacao(data);
        const produto = av.produtos.find(p => p.id === id);
        if (!produto) return null;
        produto.nome = this._nomeProduto(av, nome, id);
        this.saveData(data);
        return produto;
    }

    /** Remove um concorrente e todas as notas e valores dele (o nosso produto não pode ser removido) */
    removeConcorrente(id) {
        if (id === PRODUTO_NOSSO_ID) return false;
        const data = this.loadData();
        const av = this._ensureAvaliacao(data);
        av.produtos = av.produtos.filter(p => p.id !== id);
        av.notasCliente = av.notasCliente.filter(n => n.produtoId !== id);
        av.valoresTecnicos = av.valoresTecnicos.filter(v => v.produtoId !== id);
        this.saveData(data);
        return true;
    }

    /**
     * Define a nota (1 a 5) dos clientes para um produto num requisito de
     * cliente. Qualquer outro valor apaga a nota.
     */
    setNotaCliente(requisitoClienteId, produtoId, nota) {
        const data = this.loadData();
        const av = this._ensureAvaliacao(data);
        av.notasCliente = av.notasCliente.filter(
            n => !(n.requisitoClienteId === requisitoClienteId && n.produtoId === produtoId)
        );
        const valor = Number(nota);
        if (Number.isInteger(valor) && valor >= 1 && valor <= 5) {
            av.notasCliente.push({ requisitoClienteId, produtoId, nota: valor });
        }
        this.saveData(data);
    }

    /** Define a meta de nota (1 a 5) do nosso produto num requisito de cliente */
    setMetaCliente(requisitoClienteId, meta) {
        const data = this.loadData();
        const av = this._ensureAvaliacao(data);
        av.metasCliente = av.metasCliente.filter(m => m.requisitoClienteId !== requisitoClienteId);
        const valor = Number(meta);
        if (Number.isInteger(valor) && valor >= 1 && valor <= 5) {
            av.metasCliente.push({ requisitoClienteId, meta: valor });
        }
        this.saveData(data);
    }

    /** Define o valor técnico medido de um produto num requisito de projeto (texto vazio apaga) */
    setValorTecnico(requisitoProjetoId, produtoId, valor) {
        const data = this.loadData();
        const av = this._ensureAvaliacao(data);
        av.valoresTecnicos = av.valoresTecnicos.filter(
            v => !(v.requisitoProjetoId === requisitoProjetoId && v.produtoId === produtoId)
        );
        const texto = String(valor ?? '').trim().slice(0, 50);
        if (texto) {
            av.valoresTecnicos.push({ requisitoProjetoId, produtoId, valor: texto });
        }
        this.saveData(data);
    }

    /**
     * Calcula a análise competitiva completa
     *
     * @returns {Object}
     *   - produtos, concorrentes
     *   - clientes: por requisito de cliente (ordem de cadastro): notas por
     *     produto, nossa nota, melhor concorrente, meta, índice de melhoria
     *     (meta / nossa nota), prioridade (peso × índice, normalizada) e
     *     situação ('frente' | 'empate' | 'atras' | 'sem-dados')
     *   - tecnicos: por requisito de projeto (ordem do QFD): valores por
     *     produto, meta da especificação, melhor concorrente (conforme o
     *     sentido de melhoria) e situação da meta frente a ele
     *   - inconsistencias: requisitos em que os clientes preferem um produto
     *     mas todos os valores técnicos fortemente relacionados (9 na matriz)
     *     favorecem o outro
     *   - stats: notas preenchidas
     */
    getAnaliseCompetitiva() {
        this.calculateImportanciaProjeto();
        const data = this.loadData();
        const av = this._ensureAvaliacao(data);
        const produtos = av.produtos;
        const concorrentes = produtos.filter(p => p.tipo !== 'nosso');
        const rcs = data.requisitosCliente || [];
        const rps = data.requisitosProjeto || [];

        const notaDe = (rcId, pId) => {
            const n = av.notasCliente.find(x => x.requisitoClienteId === rcId && x.produtoId === pId);
            return n ? n.nota : null;
        };
        const valorDe = (rpId, pId) => {
            const v = av.valoresTecnicos.find(x => x.requisitoProjetoId === rpId && x.produtoId === pId);
            return v ? v.valor : '';
        };
        // a é melhor que b no sentido de melhoria do requisito?
        const ehMelhor = (sentido, a, b) => (sentido === 'up' ? a > b : a < b);
        const comparar = (sentido, nosso, melhor) =>
            nosso === melhor ? 'empate' : (ehMelhor(sentido, nosso, melhor) ? 'frente' : 'atras');

        const clientes = rcs.map((req, i) => {
            const notas = {};
            produtos.forEach(p => { notas[p.id] = notaDe(req.id, p.id); });

            let melhor = null;
            concorrentes.forEach(p => {
                const n = notas[p.id];
                if (!n) return;
                if (!melhor || n > melhor.valor) melhor = { valor: n, produtos: [p.nome] };
                else if (n === melhor.valor) melhor.produtos.push(p.nome);
            });

            const nossa = notas[PRODUTO_NOSSO_ID];
            const metaObj = av.metasCliente.find(m => m.requisitoClienteId === req.id);
            const meta = metaObj ? metaObj.meta : null;
            return {
                requisito: req,
                numero: i + 1,
                peso: req.peso || 0,
                notas,
                nossa,
                melhor,
                meta,
                indiceMelhoria: meta && nossa ? meta / nossa : null,
                situacao: nossa && melhor ? comparar('up', nossa, melhor.valor) : 'sem-dados'
            };
        });

        const brutos = clientes.map(c => c.peso * (c.indiceMelhoria || 1));
        const somaBrutos = brutos.reduce((a, b) => a + b, 0);
        clientes.forEach((c, i) => { c.prioridade = somaBrutos > 0 ? brutos[i] / somaBrutos : 0; });

        const especificacoes = data.especificacoesProjeto || [];
        const ordenados = [...rps].sort((a, b) => (b.importanciaAbsoluta || 0) - (a.importanciaAbsoluta || 0));
        const tecnicos = ordenados.map((req, rank) => {
            const esp = especificacoes.find(e => e.requisitoProjetoId === req.id) || {};
            const valores = {};
            produtos.forEach(p => { valores[p.id] = valorDe(req.id, p.id); });

            let melhor = null;
            if (req.sentidoMelhoria === 'up' || req.sentidoMelhoria === 'down') {
                concorrentes.forEach(p => {
                    const n = parseNumero(valores[p.id]);
                    if (n === null) return;
                    if (!melhor || ehMelhor(req.sentidoMelhoria, n, melhor.valor)) melhor = { valor: n, produtos: [p.nome] };
                    else if (n === melhor.valor) melhor.produtos.push(p.nome);
                });
            }

            return {
                requisito: req,
                numero: rps.findIndex(r => r.id === req.id) + 1,
                rank: rank + 1,
                unidade: esp.unidadeMedida || '',
                meta: formatarMeta(esp),
                valores,
                melhor,
                situacao: melhor && metaDefinida(esp)
                    ? comparar(req.sentidoMelhoria, valorReferenciaMeta(esp, req.sentidoMelhoria), melhor.valor)
                    : 'sem-dados'
            };
        });

        const inconsistencias = [];
        clientes.forEach(c => {
            const fortes = (data.matrizQFD || [])
                .filter(m => m.requisitoCliente === c.requisito.id && m.influencia >= 9)
                .map(m => rps.find(r => r.id === m.requisitoProjeto))
                .filter(rp => rp && (rp.sentidoMelhoria === 'up' || rp.sentidoMelhoria === 'down'));
            if (!fortes.length) return;

            for (let a = 0; a < produtos.length; a++) {
                for (let b = a + 1; b < produtos.length; b++) {
                    const na = c.notas[produtos[a].id], nb = c.notas[produtos[b].id];
                    if (!na || !nb || na === nb) continue;
                    const [preferido, outro] = na > nb ? [produtos[a], produtos[b]] : [produtos[b], produtos[a]];
                    const comparados = fortes
                        .map(rp => ({ rp, vp: parseNumero(valorDe(rp.id, preferido.id)), vo: parseNumero(valorDe(rp.id, outro.id)) }))
                        .filter(x => x.vp !== null && x.vo !== null && x.vp !== x.vo);
                    if (comparados.length && comparados.every(x => ehMelhor(x.rp.sentidoMelhoria, x.vo, x.vp))) {
                        inconsistencias.push({
                            numero: c.numero,
                            requisito: c.requisito,
                            preferido: preferido.nome,
                            outro: outro.nome,
                            requisitosProjeto: comparados.map(x => rps.indexOf(x.rp) + 1)
                        });
                    }
                }
            }
        });

        const total = rcs.length * produtos.length;
        const preenchidas = clientes.reduce((s, c) => s + produtos.filter(p => c.notas[p.id]).length, 0);
        return {
            produtos,
            concorrentes,
            clientes,
            tecnicos,
            inconsistencias,
            stats: {
                notasTotal: total,
                notasPreenchidas: preenchidas,
                percent: total > 0 ? Math.round((preenchidas / total) * 100) : 0
            }
        };
    }

    // ========================================================================
    // SEÇÃO: ATENDIMENTO AOS REQUISITOS DE CLIENTE
    // ========================================================================

    /**
     * O valor medido atinge a meta? ↑: medido ≥ meta; ↓: medido ≤ meta;
     * nominal (*): dentro de ±TOLERANCIA_NOMINAL da meta.
     */
    metaAtingida(sentido, medido, meta) {
        if (sentido === 'up') return medido >= meta;
        if (sentido === 'down') return medido <= meta;
        return meta === 0 ? medido === 0 : Math.abs(medido - meta) <= Math.abs(meta) * TOLERANCIA_NOMINAL;
    }

    /**
     * Analisa quanto os requisitos de projeto atendem aos requisitos de cliente
     *
     * - Cada requisito de projeto tem um estado: meta 'atingida' ou
     *   'nao-atingida' (valor medido do nosso produto, informado na avaliação
     *   competitiva, comparado com a meta das especificações), 'sem-medicao'
     *   ou 'sem-meta'.
     * - Cada requisito de cliente tem:
     *   - cobertura: a relação mais forte na matriz QFD ('forte' = 9,
     *     'moderada' = 3 ou 5, 'fraca' = 1, 'nenhuma');
     *   - atendimento: entre os requisitos de projeto relacionados que têm
     *     meta e medição, a fração da influência cujas metas foram atingidas
     *     (0 a 1; null se nenhum pode ser avaliado).
     * - atendimentoGeral: média dos atendimentos ponderada pelo peso dos
     *   requisitos de cliente (média simples se os pesos forem zero).
     *
     * @param {boolean} [recalcular=true] - Recalcula (e salva) a importância dos
     *   requisitos de projeto antes; false só lê (o dashboard usa false para não
     *   alterar a data de modificação a cada atualização)
     * @returns {Object} { projetos, clientes, atendimentoGeral, diagnostico, stats }
     */
    getAnaliseAtendimento(recalcular = true) {
        if (recalcular) this.calculateImportanciaProjeto();
        const data = this.loadData();
        const av = this._ensureAvaliacao(data);
        const rcs = data.requisitosCliente || [];
        const rps = data.requisitosProjeto || [];
        const matriz = (data.matrizQFD || []).filter(m => m.influencia > 0);
        const especificacoes = data.especificacoesProjeto || [];

        const valorNosso = rpId => {
            const v = av.valoresTecnicos.find(x => x.requisitoProjetoId === rpId && x.produtoId === PRODUTO_NOSSO_ID);
            return v ? v.valor : '';
        };

        const projetos = [...rps]
            .sort((a, b) => (b.importanciaAbsoluta || 0) - (a.importanciaAbsoluta || 0))
            .map((req, rank) => {
                const esp = especificacoes.find(e => e.requisitoProjetoId === req.id) || {};
                const medido = parseNumero(valorNosso(req.id));
                let estado = 'sem-meta';
                if (metaDefinida(esp)) {
                    estado = medido === null ? 'sem-medicao'
                        : (atingeMeta(esp, medido) ? 'atingida' : 'nao-atingida');
                }
                return {
                    requisito: req,
                    numero: rps.findIndex(r => r.id === req.id) + 1,
                    rank: rank + 1,
                    unidade: esp.unidadeMedida || '',
                    meta: formatarMeta(esp),
                    medido: valorNosso(req.id),
                    estado,
                    relacoes: matriz.filter(m => m.requisitoProjeto === req.id).length
                };
            });

        const avaliavel = p => p.estado === 'atingida' || p.estado === 'nao-atingida';

        const clientes = rcs.map((req, i) => {
            const relacoes = matriz
                .filter(m => m.requisitoCliente === req.id)
                .map(m => ({ influencia: m.influencia, projeto: projetos.find(p => p.requisito.id === m.requisitoProjeto) }))
                .filter(r => r.projeto)
                .sort((a, b) => (b.influencia - a.influencia) || (a.projeto.numero - b.projeto.numero));
            const maxInf = relacoes.reduce((m, r) => Math.max(m, r.influencia), 0);
            const avaliadas = relacoes.filter(r => avaliavel(r.projeto));
            const somaAvaliadas = avaliadas.reduce((s, r) => s + r.influencia, 0);
            const somaAtingidas = avaliadas.filter(r => r.projeto.estado === 'atingida').reduce((s, r) => s + r.influencia, 0);
            const nota = av.notasCliente.find(n => n.requisitoClienteId === req.id && n.produtoId === PRODUTO_NOSSO_ID);
            return {
                requisito: req,
                numero: i + 1,
                peso: req.peso || 0,
                relacoes,
                cobertura: maxInf >= 9 ? 'forte' : maxInf >= 3 ? 'moderada' : maxInf > 0 ? 'fraca' : 'nenhuma',
                atendimento: somaAvaliadas > 0 ? somaAtingidas / somaAvaliadas : null,
                avaliadas: avaliadas.length,
                notaClientes: nota ? nota.nota : null
            };
        });

        const comDados = clientes.filter(c => c.atendimento !== null);
        const pesoTotal = comDados.reduce((s, c) => s + c.peso, 0);
        let atendimentoGeral = null;
        if (comDados.length) {
            atendimentoGeral = pesoTotal > 0
                ? comDados.reduce((s, c) => s + c.peso * c.atendimento, 0) / pesoTotal
                : comDados.reduce((s, c) => s + c.atendimento, 0) / comDados.length;
        }

        const porPeso = lista => [...lista].sort((a, b) => (b.peso - a.peso) || (a.numero - b.numero));
        const diagnostico = {
            semRelacao: porPeso(clientes.filter(c => c.cobertura === 'nenhuma')),
            soFracas: porPeso(clientes.filter(c => c.cobertura === 'fraca')),
            baixoAtendimento: porPeso(clientes.filter(c => c.atendimento !== null && c.atendimento < 0.5)),
            rpSemRelacao: projetos.filter(p => p.relacoes === 0),
            metasNaoAtingidas: projetos.filter(p => p.estado === 'nao-atingida'),
            // Atende tecnicamente, mas os clientes dão nota baixa (ou o contrário)
            divergencias: porPeso(clientes.filter(c => c.atendimento !== null && c.notaClientes &&
                ((c.atendimento >= 0.8 && c.notaClientes <= 2) || (c.atendimento < 0.5 && c.notaClientes >= 4))))
        };

        return {
            projetos,
            clientes,
            atendimentoGeral,
            diagnostico,
            stats: {
                requisitosCliente: clientes.length,
                coberturaForte: clientes.filter(c => c.cobertura === 'forte').length,
                clientesAvaliados: comDados.length,
                metasAtingidas: projetos.filter(p => p.estado === 'atingida').length,
                metasAvaliadas: projetos.filter(avaliavel).length,
                semMeta: projetos.filter(p => p.estado === 'sem-meta').length,
                semMedicao: projetos.filter(p => p.estado === 'sem-medicao').length
            }
        };
    }

    // Exporta dados para JSON
    exportData() {
        const data = this.loadData();
        this._ensureEspecificacoesArray(data);
        this._syncEspecificacoesEntries(data);
        this.saveData(data);
        return this.loadData();
    }

    /**
     * Importa um projeto completo de JSON (backup), migrando-o para a versão
     * atual da estrutura. Recusa arquivos que não sejam um projeto QFD ou que
     * venham de uma versão mais nova do sistema.
     *
     * @param {string|Object} jsonData - Conteúdo do backup
     * @returns {boolean} true se importou (se false, o motivo fica em lastImportError)
     */
    importData(jsonData) {
        this.lastImportError = '';
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (!data || typeof data !== 'object' || Array.isArray(data) ||
                !Array.isArray(data.requisitosCliente) || !Array.isArray(data.requisitosProjeto)) {
                this.lastImportError = 'O arquivo não é um backup de projeto QFD.';
                console.error('Erro ao importar dados:', this.lastImportError);
                return false;
            }
            this.migrateData(data);
            this._ensureEspecificacoesArray(data);
            this._syncEspecificacoesEntries(data);
            this._ensureAvaliacao(data);
            this.saveData(data);
            return true;
        } catch (error) {
            this.lastImportError = error.message;
            console.error('Erro ao importar dados:', error);
            return false;
        }
    }

    /**
     * Obtém estatísticas resumidas do projeto
     * 
     * @returns {Object} Objeto com contadores e informações do projeto:
     *   - requisitosCliente: Quantidade de requisitos de cliente
     *   - requisitosProjeto: Quantidade de requisitos de projeto
     *   - comparacoesCliente: Quantidade de comparações realizadas
     *   - correlacoesProjeto: Quantidade de correlações definidas
     *   - relacoesQFD: Quantidade de relações na matriz QFD
     *   - lastModified: Data da última modificação
     */
    getProjectStats() {
        const data = this.loadData();
        
        const espStats = this.getEspecificacoesStats();

        const av = this._ensureAvaliacao(data);
        const notasTotal = data.requisitosCliente.length * av.produtos.length;
        const notasValidas = av.notasCliente.filter(n =>
            data.requisitosCliente.some(r => r.id === n.requisitoClienteId) &&
            av.produtos.some(p => p.id === n.produtoId)
        ).length;

        return {
            concorrentes: av.produtos.length - 1,
            competitivaPercent: notasTotal > 0 ? Math.round((notasValidas / notasTotal) * 100) : 0,
            requisitosCliente: data.requisitosCliente.length,
            requisitosProjeto: data.requisitosProjeto.length,
            comparacoesCliente: data.comparacaoCliente.length,
            correlacoesProjeto: data.correlacaoProjeto.length,
            relacoesQFD: data.matrizQFD.length,
            especificacoesTotal: espStats.total,
            especificacoesCompletas: espStats.completed,
            especificacoesPercent: espStats.percent,
            lastModified: data.metadata.lastModified
        };
    }

    /**
     * Valida a integridade dos dados do projeto
     * Verifica se não há referências órfãs (requisitos que não existem mais)
     * 
     * @returns {Object} Objeto com:
     *   - isValid: boolean indicando se os dados estão válidos
     *   - errors: Array com mensagens de erros encontrados
     */
    validateData() {
        const data = this.loadData();
        const errors = [];
        
        // Verifica se há requisitos órfãos nas comparações
        data.comparacaoCliente.forEach(comp => {
            const req1Exists = data.requisitosCliente.some(req => req.id === comp.requisito1);
            const req2Exists = data.requisitosCliente.some(req => req.id === comp.requisito2);
            
            if (!req1Exists || !req2Exists) {
                errors.push(`Comparação com requisito inexistente: ${comp.requisito1} - ${comp.requisito2}`);
            }
        });
        
        // Verifica correlações
        data.correlacaoProjeto.forEach(corr => {
            const req1Exists = data.requisitosProjeto.some(req => req.id === corr.requisito1);
            const req2Exists = data.requisitosProjeto.some(req => req.id === corr.requisito2);
            
            if (!req1Exists || !req2Exists) {
                errors.push(`Correlação com requisito inexistente: ${corr.requisito1} - ${corr.requisito2}`);
            }
        });
        
        // Verifica matriz QFD
        data.matrizQFD.forEach(rel => {
            const reqClienteExists = data.requisitosCliente.some(req => req.id === rel.requisitoCliente);
            const reqProjetoExists = data.requisitosProjeto.some(req => req.id === rel.requisitoProjeto);
            
            if (!reqClienteExists || !reqProjetoExists) {
                errors.push(`Relação QFD com requisito inexistente: ${rel.requisitoCliente} - ${rel.requisitoProjeto}`);
            }
        });

        this._ensureEspecificacoesArray(data);
        data.especificacoesProjeto.forEach(esp => {
            const exists = data.requisitosProjeto.some(req => req.id === esp.requisitoProjetoId);
            if (!exists) {
                errors.push(`Especificação com requisito de projeto inexistente: ${esp.requisitoProjetoId}`);
            }
        });

        const av = this._ensureAvaliacao(data);
        const produtoExiste = id => av.produtos.some(p => p.id === id);
        av.notasCliente.forEach(n => {
            if (!produtoExiste(n.produtoId) || !data.requisitosCliente.some(r => r.id === n.requisitoClienteId)) {
                errors.push(`Nota da avaliação competitiva com produto ou requisito inexistente: ${n.produtoId} - ${n.requisitoClienteId}`);
            }
        });
        av.valoresTecnicos.forEach(v => {
            if (!produtoExiste(v.produtoId) || !data.requisitosProjeto.some(r => r.id === v.requisitoProjetoId)) {
                errors.push(`Valor técnico com produto ou requisito inexistente: ${v.produtoId} - ${v.requisitoProjetoId}`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Instância global do banco de dados
const qfdDB = new QFDDatabase();

// Funções utilitárias globais
function resetAllData() {
    if (confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
        qfdDB.clearAllData();
        location.reload();
    }
}

/**
 * Função global para exportar dados do projeto em formato JSON
 * Cria um arquivo JSON para download com todos os dados do projeto
 */
function exportProjectData() {
    const data = qfdDB.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `qfd-project-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Função global para importar dados do projeto de um arquivo JSON
 * 
 * @param {Event} event - Evento do input file com o arquivo selecionado
 */
function importProjectData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const success = qfdDB.importData(e.target.result);
            if (success) {
                alert('Dados importados com sucesso!');
                location.reload();
            } else {
                alert('Erro ao importar dados. ' + (qfdDB.lastImportError || 'Verifique o formato do arquivo.'));
            }
        } catch (error) {
            alert('Erro ao ler o arquivo: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// ========================================================================
// SEÇÃO 8: FUNCIONALIDADES DE IMPORTAÇÃO/EXPORTAÇÃO CSV
// ========================================================================
// 
// Permite importar e exportar dados em formato CSV para facilitar
// a integração com planilhas e outras ferramentas

/**
 * Importa requisitos de um arquivo CSV
 * 
 * @param {Event} event - Evento do input file com o arquivo CSV selecionado
 * @param {string} type - Tipo de requisito: 'cliente' ou 'projeto'
 */
function importCSV(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const result = importRequisitosCSV(e.target.result, type);
            let msg = `${result.importados} requisito(s) importado(s).`;
            if (result.duplicados) msg += `\n${result.duplicados} ignorado(s) por já existirem.`;
            if (result.vazios) msg += `\n${result.vazios} linha(s) sem descrição ignorada(s).`;
            alert(msg);
            if (result.importados) location.reload();
        } catch (error) {
            console.error('Erro ao importar CSV:', error);
            alert('Erro ao importar CSV: ' + error.message);
        }
        event.target.value = '';
    };
    reader.onerror = () => alert('Não foi possível ler o arquivo.');
    reader.readAsText(file);
}

/**
 * Importa requisitos de um texto CSV. Aceita os CSVs exportados pelo próprio
 * sistema, planilhas com cabeçalho (coluna "descrição"/"descricao") e listas
 * simples com uma descrição por linha. Separador vírgula ou ponto e vírgula.
 * Ignora linhas vazias e descrições já cadastradas.
 *
 * @param {string} text - Conteúdo do arquivo
 * @param {'cliente'|'projeto'} type - Tipo de requisito
 * @returns {{importados: number, duplicados: number, vazios: number}}
 */
function importRequisitosCSV(text, type) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('o arquivo está vazio.');

    const norm = cell => String(cell || '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const header = rows[0].map(norm);
    const hasHeader = header.some(h => h.startsWith('descri'));

    let colDesc = 0, colSentido = -1, colDific = -1;
    if (hasHeader) {
        colDesc = header.findIndex(h => h.startsWith('descri'));
        colSentido = header.findIndex(h => h.startsWith('sentido'));
        colDific = header.findIndex(h => h.startsWith('dificuldade'));
        rows.shift();
    }

    const sentidos = { up: 'up', down: 'down', none: 'none', crescente: 'up', decrescente: 'down', nominal: 'none' };
    const dificuldades = { 'muito facil': 1, 'facil': 2, 'moderada': 3, 'dificil': 4, 'muito dificil': 5 };
    const vistos = new Set();
    const result = { importados: 0, duplicados: 0, vazios: 0 };

    rows.forEach(row => {
        // Sem cabeçalho: 1 coluna = descrição; com mais colunas, se a 1ª
        // parece um ID ou número, a descrição é a 2ª
        let idx = colDesc;
        if (!hasHeader) {
            idx = row.length > 1 && /^([0-9a-f-]{36}|\d+)$/i.test(row[0].trim()) ? 1 : 0;
        }
        const descricao = String(row[idx] || '').trim().replace(/\s+/g, ' ');
        if (!descricao) { result.vazios++; return; }

        const chave = descricao.toLowerCase();
        if (vistos.has(chave) || qfdDB.findRequisitoDuplicado(type, descricao)) {
            result.duplicados++;
            return;
        }
        vistos.add(chave);

        if (type === 'cliente') {
            qfdDB.addRequisitoCliente(descricao);
        } else {
            const sentido = sentidos[norm(row[colSentido])] || 'none';
            const dificuldade = parseInt(row[colDific], 10) || dificuldades[norm(row[colDific])];
            qfdDB.addRequisitoProjeto(descricao, sentido, dificuldade >= 1 && dificuldade <= 5 ? dificuldade : 1);
        }
        result.importados++;
    });

    return result;
}

/**
 * Exporta dados específicos de uma página em formato CSV
 * 
 * @param {string} type - Tipo de dados a exportar: 'cliente', 'projeto' ou 'matriz'
 */
function exportPageData(type) {
    const data = qfdDB.loadData();
    let exportContent = '';
    let fileName = '';

    if (type === 'cliente') {
        exportContent = "id,descricao,importancia,peso\n";
        data.requisitosCliente.forEach(req => {
            exportContent += `${req.id},${csvCell(req.descricao)},${req.importancia},${req.peso}\n`;
        });
        fileName = 'requisitos-cliente.csv';
    } else if (type === 'projeto') {
        exportContent = "id,descricao,sentido,dificuldade\n";
        data.requisitosProjeto.forEach(req => {
            exportContent += `${req.id},${csvCell(req.descricao)},${req.sentidoMelhoria},${req.dificuldadeTecnica}\n`;
        });
        fileName = 'requisitos-projeto.csv';
    } else if (type === 'matriz') {
        exportContent = "cliente_id,projeto_id,influencia\n";
        data.matrizQFD.forEach(rel => {
            exportContent += `${rel.requisitoCliente},${rel.requisitoProjeto},${rel.influencia}\n`;
        });
        fileName = 'matriz-qfd.csv';
    } else if (type === 'especificacoes') {
        const blob = new Blob([JSON.stringify(qfdDB.exportEspecificacoesJson(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `especificacoes-projeto-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }

    const blob = new Blob([exportContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
