# Sistema QFD - Quality Function Deployment

**Acesse o sistema:** https://marlonsigales.github.io/QFD/index.html

Sistema web para criação de QFD (Casa da Qualidade), voltado para engenheiros de produto. Funciona inteiramente no navegador: não há servidor e os dados ficam salvos no próprio navegador (LocalStorage).

- [Guia de uso](Sistema%20QFD%20-%20Quality%20Function%20Deployment.md): como usar cada etapa
- [Análise do código](ANALISE_CODIGO.md): explicação dos módulos e melhorias
- [Lista de tarefas](todo.md) e [QA](QFD%20QA.txt): o que foi feito e próximos passos

---

## Como abrir

- **Online (recomendado):** use o link acima (GitHub Pages).
- **Local, por servidor HTTP:** na pasta do projeto, rode `python -m http.server 8080` e abra `http://localhost:8080` (ou `npx serve .`).
- **Local, com duplo clique no `index.html`:** funciona, mas alguns navegadores só aplicam o CSS e os ícones depois do primeiro clique na página.

> Os dados ficam no navegador e no endereço em que o sistema foi aberto. Um projeto feito no link online não aparece na versão local, e vice-versa. Para levar um projeto de um para o outro, use **Backup & Export → Exportar Backup (JSON)** e **Importar Backup**.

## Etapas do QFD

| # | Página | O que faz |
|---|--------|-----------|
| 1 | Requisitos de Cliente | Cadastro das necessidades do cliente, com texto explicativo opcional |
| 2 | Comparação Cliente | Diagrama de Mudge: comparação par a par (1, 3 ou 5) e hierarquização dos requisitos |
| 3 | Requisitos de Projeto | Características técnicas, sentido de melhoria (↑ ↓ \*), dificuldade técnica (1–5) e texto explicativo |
| 4 | Correlação Projeto | Telhado da casa: correlações `++`, `+`, `0`, `-` e `--` entre requisitos de projeto |
| 5 | Matriz QFD | Relação cliente × projeto (0, 1, 3 ou 9); importância absoluta, relativa e peso |
| 6 | Especificações | Requisitos de projeto na ordem do QFD, com unidade, meta (mínimo ≥, máximo ≤, nominal = com tolerância ± ou intervalo; o tipo vem sugerido pelo sentido de melhoria), texto explicativo e aspectos indesejáveis (vindos das correlações `--`) |
| 7 | Avaliação Competitiva | Depois do QFD: notas dos clientes (1 a 5) para o nosso produto e os concorrentes, meta, índice de melhoria e prioridade; valores técnicos medidos de cada produto comparados com as metas das especificações; gráfico, pontos fortes, pontos a melhorar e inconsistências |
| 8 | Atendimento aos Requisitos | Quanto os requisitos de projeto atendem a cada requisito de cliente: cobertura na matriz, metas atingidas (valor medido × meta) e diagnóstico |
| 9 | Relatório PDF | Relatório configurável com as seções escolhidas, prévia e geração de PDF |

**Textos explicativos:** o texto cadastrado em cada requisito aparece num balão ao passar o mouse sobre ele na comparação, na correlação, na matriz e no relatório. O texto das especificações aparece no relatório.

## Cálculos

- **Peso do requisito de cliente:** pontuação no Diagrama de Mudge, normalizada para somar 100%.
- **Importância absoluta do requisito de projeto:** `IA(j) = Σ peso_cliente(i) × influência(i,j)`.
- **Peso relativo:** `PR(j) = IA(j) / Σ IA`. O ranking ordena por importância absoluta e divide os requisitos em terços (superior, médio, inferior).
- **Avaliação competitiva:**
  - *Situação* de cada requisito de cliente: nossa nota comparada com a maior nota entre os concorrentes (à frente, empatado ou atrás).
  - *Índice de melhoria* = meta ÷ nossa nota; *prioridade* = peso × índice de melhoria (1 se não houver meta), normalizada para somar 100%.
  - *Melhor concorrente técnico*: maior valor se o sentido é ↑, menor se é ↓; requisitos nominais (\*) não são comparados. A meta da especificação é comparada com esse valor (num intervalo, o limite menos exigente: o mínimo para ↑, o máximo para ↓).
- **Meta atingida** (atendimento): `≥` medido ≥ meta; `≤` medido ≤ meta; intervalo: dentro dele; `=`: dentro da tolerância ± informada (sem tolerância, ±5% da meta).
  - *Inconsistência* (avaliação competitiva): os clientes dão nota maior a um produto, mas todos os requisitos de projeto com relação forte (9) com aquele requisito têm valores técnicos melhores no outro produto. Indica erro de medição, de nota ou um requisito de projeto faltando.

- **Atendimento aos requisitos:**
  - *Meta atingida*: valor medido do nosso produto ≥ meta (↑), ≤ meta (↓) ou dentro de ±5% (\*).
  - *Cobertura* de um requisito de cliente: sua relação mais forte na matriz (9 forte, 3 moderada, 1 fraca, nenhuma).
  - *Atendimento* de um requisito de cliente = Σ influência dos requisitos de projeto com meta atingida ÷ Σ influência dos que têm meta e medição.
  - *Atendimento geral* = média dos atendimentos ponderada pelo peso dos requisitos de cliente.

## Backup, importação e exportação

Pelo menu **Backup & Export** de cada página:

- **Backup completo (JSON):** exporta e importa o projeto inteiro. Backups de versões antigas do sistema são atualizados automaticamente ao importar; arquivos inválidos ou de uma versão mais nova do sistema são recusados sem alterar os dados atuais.
- **Requisitos (CSV):** importa listas de requisitos. Aceita os CSVs exportados pelo sistema, planilhas do Excel (separador `;`) e listas simples com uma descrição por linha. Linhas vazias e descrições já cadastradas são ignoradas.
- **Especificações (JSON)** e exportações da matriz e das correlações.
- **Backup automático:** o dashboard mantém uma cópia do último estado salvo, usada também para recuperar dados corrompidos.

## Estrutura de arquivos

```
QFD/
├── index.html                  # Dashboard
├── css/style.css               # Estilos
├── js/
│   ├── database.js             # Banco de dados (LocalStorage), migrações, importação/exportação
│   ├── utils.js                # Funções compartilhadas: menu, alertas, escape de HTML, CSV, números, gráfico competitivo
│   ├── dashboard.js
│   ├── requisitos-cliente.js
│   ├── comparacao-cliente.js
│   ├── requisitos-projeto.js
│   ├── correlacao-projeto.js
│   ├── matriz-qfd.js
│   ├── especificacoes.js
│   ├── avaliacao-competitiva.js
│   ├── atendimento-requisitos.js
│   └── relatorio.js            # Relatório e PDF (jsPDF + html2canvas)
├── pages/                      # Uma página HTML por etapa
└── tests/
    ├── testes.html             # Testes no navegador
    ├── testes.js
    └── rodar-testes.ps1        # Testes no Chrome/Edge headless
```

Toda página carrega os scripts nesta ordem: `database.js` → `utils.js` → script da página.

## Estrutura dos dados

Tudo fica numa única chave do LocalStorage, `qfd_data`:

```javascript
{
  requisitosCliente: [{ id, descricao, observacao, importancia, peso, created }],
  requisitosProjeto: [{ id, descricao, observacao,
                        sentidoMelhoria,        // 'up' | 'down' | 'none'
                        dificuldadeTecnica,     // 1 a 5
                        importanciaAbsoluta, importanciaRelativa, pesoRelativo, created }],
  comparacaoCliente: [{ requisito1, requisito2, valor, created }],        // valor: 1, 3 ou 5
  correlacaoProjeto: [{ requisito1, requisito2, correlacao, created }],   // '++' '+' '-' '--'
  matrizQFD:         [{ requisitoCliente, requisitoProjeto, influencia, created }], // 1, 3 ou 9
  especificacoesProjeto: [{ requisitoProjetoId, unidadeMedida, observacao,
                            tipoMeta,               // '>=' | '<=' | '=' | 'faixa' | '' (sem meta)
                            valorMeta, valorMax,    // números; valorMax só no intervalo ('faixa')
                            tolerancia,             // ± (só em '='; null = ±5%)
                            metaTexto, revisarMeta, // texto antigo que não virou número
                            aspectosIndesejaveis, aspectosAutoGerado, updated }],
  avaliacaoCompetitiva: {
    produtos:        [{ id, nome, tipo }],          // tipo 'nosso' (id 'nosso') ou 'concorrente'; até 6 concorrentes
    notasCliente:    [{ requisitoClienteId, produtoId, nota }],   // 1 a 5
    metasCliente:    [{ requisitoClienteId, meta }],              // 1 a 5
    valoresTecnicos: [{ requisitoProjetoId, produtoId, valor }]   // texto, ex.: "1,5 kg"
  },
  metadata: { created, lastModified, schemaVersion }
}
```

Outras chaves: `qfd_backup` (backup automático) e `qfd_data_corrompido` (cópia de dados ilegíveis, se isso já aconteceu).

### Versão da estrutura (migrações)

`metadata.schemaVersion` guarda a versão da estrutura (atual: **4**; a versão 3 acrescentou `avaliacaoCompetitiva`; a 4 trocou o `valorUnitario` em texto das especificações pela meta tipada). Ao abrir qualquer página ou importar um backup, dados de versões anteriores são atualizados pelas funções de `SCHEMA_MIGRATIONS` em `database.js`.

**Migração da versão 4:** o valor antigo que for só um número vira meta do tipo sugerido pelo sentido de melhoria (↑ `≥`, ↓ `≤`, \* `=`), como o sistema já avaliava antes; textos como `≥ 20`, `80 ± 5` e `10 a 12` viram o tipo correspondente. O que não puder ser convertido (ex.: "aprox. 3") fica guardado em `metaTexto` e a linha aparece com o aviso "Revisar meta" nas Especificações.

Para mudar a estrutura dos dados:
1. Aumente `SCHEMA_VERSION`.
2. Acrescente em `SCHEMA_MIGRATIONS` a função da nova versão (ex.: `4(data) { ... }`), que recebe os dados da versão anterior e os ajusta.
3. Acrescente um teste em `tests/testes.js`.

## Validações e tratamento de erros

- Descrição com no mínimo 10 e no máximo 300 caracteres; texto explicativo até 1000.
- Requisitos com a mesma descrição são bloqueados (ignorando maiúsculas e espaços extras).
- **Dados corrompidos no navegador:** uma cópia é guardada em `qfd_data_corrompido`, o último backup automático é restaurado (ou um projeto vazio é iniciado) e o usuário é avisado.
- **Armazenamento do navegador cheio:** o usuário é avisado de que a alteração não foi salva.

## Testes

```powershell
powershell -ExecutionPolicy Bypass -File tests\rodar-testes.ps1
```

Roda todos os testes no Chrome ou Edge sem abrir janela, com um perfil temporário (não mexe nos seus dados), e retorna código 1 se algo falhar. Cobre utilitários, cálculos, especificações, avaliação competitiva, migrações, importação de backup e CSV, recuperação de erros e, em cada página, o carregamento, os menus e os balões.

Também é possível abrir `tests/testes.html` direto no navegador: os testes de lógica rodam e os de páginas são pulados. Os dados do projeto são guardados antes e restaurados depois.

Para acrescentar um teste: `test('nome', () => { ... })` dentro de uma `suite()` em `tests/testes.js`.

## Histórico de mudanças

### Setembro/2026
- **Página de Atendimento aos Requisitos**: cobertura de cada requisito de cliente na matriz, metas atingidas pelo nosso produto, atendimento por requisito e geral, diagnóstico (requisitos sem relação, só relações fracas, metas não atingidas, requisitos de projeto órfãos, divergências com as notas dos clientes) e seção no relatório.
- **Relatório:** a seção de avaliação competitiva agora traz também descrições, melhor concorrente e o resultado completo.
- **Página de Avaliação Competitiva** (depois das Especificações): nosso produto × concorrentes na visão dos clientes e nos valores técnicos, com gráfico, resultado e seção no relatório. Estrutura dos dados na versão 3.
- **Cartão de status** das páginas agora aparece com os contadores lado a lado (estava sem estilo).
- **Textos explicativos** em requisitos de cliente, de projeto e especificações, exibidos em balões nas demais páginas e no relatório.
- **Página de Especificações** integrada ao relatório; aspectos indesejáveis agora são preenchidos automaticamente a partir das correlações `--` (antes ficavam vazios quando o telhado era feito depois dos requisitos).
- **Menus corrigidos:** o dropdown "Backup & Export" não abria em algumas páginas e o menu não funcionava em outras; agora todos usam o mesmo código (`utils.js`).
- **Código compartilhado:** funções que estavam copiadas em até 6 arquivos foram reunidas em `utils.js`.
- **Versionamento dos dados** com migração automática (`schemaVersion`).
- **Tratamento de erros:** recuperação de dados corrompidos, aviso de armazenamento cheio e validação de backups importados.
- **Validações:** bloqueio de duplicados e limites de tamanho nos campos.
- **Importação de CSV reescrita:** descrições com vírgulas ou aspas eram cortadas e o cabeçalho do próprio export era importado como requisito.
- **Balões:** não mostram mais HTML cru nem quebram com aspas no texto.
- **Backup automático do dashboard:** corrigido um loop infinito ao salvar.
- **Testes automatizados** (`tests/`).

## Tecnologias

HTML5, CSS3 e JavaScript puro (sem build e sem dependências instaladas). jsPDF e html2canvas (via CDN) para o PDF; Font Awesome para os ícones.

## Privacidade

Os dados ficam só no navegador de quem usa; nada é enviado para servidores. Limpar os dados do site no navegador apaga o projeto, então exporte backups com frequência.
