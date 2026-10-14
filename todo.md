# Sistema QFD - Lista de Tarefas

Site: https://marlonsigales.github.io/QFD/index.html

## Fase 1: Planejamento e estrutura do projeto
- [x] Definir estrutura de arquivos e pastas
- [x] Planejar navegação entre páginas
- [x] Definir esquema do banco de dados local
- [x] Criar wireframes das páginas principais

## Fase 2: Desenvolvimento da estrutura base e banco de dados local
- [x] Criar estrutura HTML base
- [x] Implementar sistema de navegação
- [x] Configurar LocalStorage para banco de dados
- [x] Criar funções básicas de CRUD

## Fase 3: Implementação das páginas de entrada de dados
- [x] Página de requisitos de cliente
- [x] Página de requisitos de projeto com sentido de melhoria

## Fase 4: Desenvolvimento das páginas de comparação e análise
- [x] Página de comparação par a par (diagrama de Mudge)
- [x] Página de correlação entre requisitos de projeto (telhado)

## Fase 5: Implementação da matriz QFD e cálculos
- [x] Matriz QFD principal
- [x] Cálculos de importância absoluta, relativa e peso relativo
- [x] Análises e visualizações dos resultados

## Fase 6: Geração de PDF e finalização
- [x] Implementar geração de PDF da matriz QFD
- [x] Estilização final do sistema
- [x] Validações e tratamento de erros

## Fase 7: Teste e entrega do sistema
- [x] Testes completos do sistema
- [x] Verificação de responsividade
- [x] Entrega final com documentação

## Fase 8: Especificações e textos explicativos (maio–setembro/2026)
- [x] Página de Especificações (unidade, valor, aspectos indesejáveis)
- [x] Especificações no relatório
- [x] Texto explicativo em requisitos de cliente e de projeto, com balão nas demais páginas
- [x] Texto explicativo nas especificações, com balão no relatório
- [x] Aspectos indesejáveis preenchidos automaticamente pelas correlações `--`
- [x] Balões sem HTML cru e seguros com aspas no texto

## Fase 9: Qualidade do código (setembro/2026)
- [x] Funções repetidas reunidas em `js/utils.js`
- [x] Menus corrigidos e padronizados em todas as páginas
- [x] Versionamento dos dados salvos, com migração automática
- [x] Tratamento de erros: dados corrompidos, armazenamento cheio, backups inválidos
- [x] Validações: requisitos duplicados, limites de tamanho
- [x] Importação de CSV reescrita
- [x] Corrigido loop infinito no backup automático do dashboard
- [x] Testes automatizados (`tests/`)
- [x] Documentação atualizada (README, guia de uso, análise do código)

## Fase 9b: Avaliação competitiva (setembro/2026)
- [x] Página "Avaliação Competitiva": nosso produto × até 6 concorrentes
- [x] Notas dos clientes (1 a 5), meta, índice de melhoria, prioridade e situação (à frente / empatado / atrás)
- [x] Valores técnicos por produto, melhor concorrente pelo sentido de melhoria e comparação com a meta das especificações
- [x] Gráfico de perfil, resultado (pontos fortes, a melhorar, metas abaixo do concorrente) e detecção de inconsistências
- [x] Seção no relatório, card no dashboard, exportação CSV, estrutura dos dados v3 com migração, testes

## Fase 9c: Atendimento aos requisitos (setembro/2026)
- [x] Página "Atendimento aos Requisitos": metas × valor medido do nosso produto
- [x] Cobertura e atendimento (%) por requisito de cliente, atendimento geral ponderado
- [x] Diagnóstico: sem relação, só relações fracas, atendimento < 50%, metas não atingidas, requisitos de projeto órfãos, divergência com a nota dos clientes
- [x] Seção no relatório, card no dashboard, exportação CSV, testes
- [x] Relatório: seção de avaliação competitiva completa (descrições, melhor concorrente, resultado)

## Fase 10: Projeto informacional completo (planejada)
Objetivo: cobrir toda a fase de *Planejamento e Esclarecimento da Tarefa* de Pahl & Beitz
(Engineering Design, 3ª ed., Cap. 3.1 e 5), cujo resultado é a lista de requisitos.
Itens detalhados em "Próximos passos → Projeto informacional completo".

## Próximos passos

### Publicar e validar
- [ ] Enviar os commits para o GitHub (`git push`) e confirmar que o site novo foi atualizado
- [ ] Conferir no GitHub se o Pages está ativo no repositório novo (Settings → Pages)
- [ ] Fazer o roteiro de QA manual do [QFD QA.txt](QFD%20QA.txt) no site publicado
- [ ] Gerar um PDF de verdade no relatório (os testes automáticos cobrem só a prévia)

### Projeto informacional completo (Pahl & Beitz, Cap. 3.1 e 5)
Cada item tem um prompt pronto no [QFD QA.txt](QFD%20QA.txt) (código P01–P16).
A ordem abaixo é a sugerida; os itens de prioridade alta que mudam a estrutura
dos dados (P01–P04) devem ser feitos um de cada vez, cada um com sua migração.

**Prioridade alta**
- [ ] P01 — Classificar requisitos como Exigência ou Desejo (desejos com importância alta/média/baixa) — Seção 5.2.1
- [x] P02 — Metas com tipo (=, ≥, ≤, faixa), valor e tolerância nas Especificações — Seções 2.1.2 e 5.2.1
- [ ] P03 — Origem, responsável, histórico de alterações e revisões numeradas da lista de requisitos — Fig. 5.2 e Seção 5.3.1
- [ ] P04 — Categorias do checklist (17 títulos) e painel de cobertura — Fig. 5.3
- [x] P05 — Análise da concorrência (benchmarking) por requisito de cliente e de projeto — Fig. 3.4 (feito como página "Avaliação Competitiva"; nas Especificações, melhor concorrente, "Usar como meta" e aviso)
- [ ] P06 — Página "Definição do projeto": funções pretendidas, custo-alvo, volume, prazos — Seção 3.1.4, passo 6

**Prioridade média**
- [ ] P07 — Assistente de cenários do ciclo de vida do produto — Seção 5.2.4 e Fig. 1.2
- [ ] P08 — Tipos de requisito do cliente: básico, desempenho técnico, atratividade — Seção 5.2.3
- [ ] P09 — Árvore de requisitos do cliente (declaração → desenvolvimento → refinamento) — Seções 5.2.4 e 3.3.2
- [x] P10 — Caderno de ideias de solução, separado da lista de requisitos — Seção 5.4
- [x] P16 — Mostrar a dificuldade técnica nas Especificações, na Matriz e no relatório

**Prioridade baixa**
- [ ] P11 — Requisitos de restrição ("o produto não deve…") em destaque — Seção 5.1
- [ ] P12 — Listas parciais por departamento e visão consolidada — Seção 5.3.2 e Fig. 5.6
- [x] P13 — Estado da técnica: patentes, normas e referências ligadas aos requisitos — Seções 3.1.4 e 5.2.3
- [ ] P14 — Módulo de planejamento do produto (ciclo de vida, matriz produto–mercado, portfólio, necessidade–competência, critérios da Tabela 3.1) — Seção 3.1
- [x] P15 — Assistente de fechamento: abstração em 5 passos e função global (ponte para o projeto conceitual) — Seções 6.2 e 6.3.1

### Melhorias sugeridas
- [x] Diagrama de Mudge: parar de recarregar a página inteira a cada comparação salva
- [x] Unificar o código dos balões (`showTooltip`/`hideTooltip`, ainda diferente por página)
- [x] Mostrar também o texto explicativo da especificação no balão do requisito de projeto na Matriz QFD
- [x] Limpar CSS duplicado (`.nav-dropdown`, `.dropdown-menu`, `.qfd-tooltip`) e mover para o `style.css` os estilos injetados via JavaScript
- [x] Atualizar o ano do rodapé ("© 2024") em todas as páginas
- [x] Remover do repositório `qfd_system_updated.zip` (versão antiga, 220 KB)
- [ ] Melhorar o uso das matrizes em celular

### Baixa prioridade
- [ ] Acessibilidade (ARIA, navegação por teclado)
- [ ] Simplificar a lógica de `getComparacaoCliente()`

### Não recomendado
- IndexedDB: um QFD típico ocupa poucas dezenas de KB, bem abaixo do limite do LocalStorage (~5 MB), e a troca exigiria reescrever todo o acesso aos dados.
