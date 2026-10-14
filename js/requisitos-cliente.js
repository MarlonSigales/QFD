/**
 * ============================================================================
 * GERENCIAMENTO DE REQUISITOS DE CLIENTE
 * ============================================================================
 * 
 * Este módulo gerencia a página de cadastro e edição de requisitos de cliente.
 * Permite adicionar, editar, excluir e exportar requisitos que representam
 * as necessidades e expectativas do cliente sobre o produto.
 * 
 * Funcionalidades:
 * - Cadastro de novos requisitos
 * - Edição inline de requisitos existentes
 * - Exclusão individual ou em massa
 * - Exportação para CSV
 * - Validação de dados
 * - Auto-resize de textarea
 */

// ========================================================================
// SEÇÃO 1: INICIALIZAÇÃO
// ========================================================================

/**
 * Inicializa a página quando o DOM está pronto
 * Carrega requisitos existentes e configura event listeners
 */
document.addEventListener('DOMContentLoaded', function() {
    const campoClassificacao = document.getElementById('classificacao-novo');
    if (campoClassificacao) campoClassificacao.innerHTML = htmlCampoClassificacao('classificacao-requisito', 'justificativa-requisito');
    loadRequisitos();
    setupEventListeners();
    updateNavigationState();
});

// ========================================================================
// SEÇÃO 2: CONFIGURAÇÃO DE EVENTOS
// ========================================================================

/**
 * Configura todos os event listeners da página
 * Inclui formulário, textarea auto-resize e menu dropdown
 */
function setupEventListeners() {
    const form = document.getElementById('form-requisito');
    if (form) {
        form.addEventListener('submit', handleSubmitRequisito);
    }
    
    // Auto-resize textarea
    const textarea = document.getElementById('descricao-requisito');
    if (textarea) {
        textarea.addEventListener('input', autoResizeTextarea);
        
        // Salvar com Enter (sem Shift)
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitRequisito(new Event('submit'));
            }
        });
    }

}

// ========================================================================
// SEÇÃO 3: GERENCIAMENTO DE REQUISITOS
// ========================================================================

/**
 * Processa o envio do formulário de novo requisito
 * Valida dados e adiciona ao banco de dados
 * 
 * @param {Event} event - Evento de submit do formulário
 */
function handleSubmitRequisito(event) {
    event.preventDefault();
    
    const descricao = document.getElementById('descricao-requisito').value.trim();
    const observacaoEl = document.getElementById('observacao-requisito');
    const observacao = observacaoEl ? observacaoEl.value.trim() : '';
    
    if (!descricao) {
        showAlert('Por favor, insira uma descrição para o requisito.', 'warning');
        return;
    }
    
    if (descricao.length < 10) {
        showAlert('A descrição deve ter pelo menos 10 caracteres.', 'warning');
        return;
    }

    const classificacao = lerClassificacao('classificacao-requisito', 'justificativa-requisito');
    if (classificacao.erro) {
        showAlert(classificacao.erro, 'warning');
        return;
    }

    const duplicado = qfdDB.findRequisitoDuplicado('cliente', descricao);
    if (duplicado) {
        showAlert(`Já existe um requisito com esta descrição: "${escapeHtml(duplicado.descricao)}".`, 'warning');
        return;
    }
    
    try {
        const novoRequisito = qfdDB.addRequisitoCliente(descricao, observacao);
        if (novoRequisito && classificacao.classificacao) {
            delete classificacao.erro;
            qfdDB.updateRequisitoCliente(novoRequisito.id, classificacao);
        }
        
        if (novoRequisito) {
            showAlert('Requisito adicionado com sucesso!', 'success');
            clearForm();
            loadRequisitos();
            updateNavigationState();
        } else {
            showAlert('Erro ao adicionar requisito. Tente novamente.', 'danger');
        }
    } catch (error) {
        console.error('Erro ao adicionar requisito:', error);
        showAlert('Erro interno. Verifique o console para mais detalhes.', 'danger');
    }
}

/**
 * Carrega e exibe todos os requisitos de cliente cadastrados
 * Atualiza a lista na interface e o contador de requisitos
 */
function loadRequisitos() {
    const requisitos = qfdDB.getRequisitosCliente({ todos: true });
    const numeros = numerosNoQFD(requisitos);
    const listaContainer = document.getElementById('lista-requisitos');
    const emptyState = document.getElementById('empty-state');
    const countBadge = document.getElementById('count-requisitos');
    
    if (!listaContainer) return;
    
    // Atualiza contador
    if (countBadge) {
        countBadge.textContent = requisitos.length;
    }
    
    // Mostra/esconde estado vazio
    if (emptyState) {
        emptyState.style.display = requisitos.length === 0 ? 'block' : 'none';
    }
    
    if (requisitos.length === 0) {
        listaContainer.innerHTML = '';
        return;
    }
    
    // Gera HTML dos requisitos
    const requisitosHTML = requisitos.map((requisito, index) => `
        <div class="requisito-item" data-id="${requisito.id}">
            <div class="requisito-header">
                <div class="requisito-number${numeros[index] ? '' : ' fora-qfd'}" title="${numeros[index] ? `RC${numeros[index]} no QFD` : 'Fora do QFD'}">
                    <span class="number">${numeros[index] || '<i class="fas fa-tag"></i>'}</span>
                </div>
                <div class="requisito-content">
                    <div class="requisito-description" id="desc-${requisito.id}">
                        ${escapeHtml(requisito.descricao)}
                    </div>
                    ${requisito.observacao ? `<div class="requisito-observacao-preview"><i class="fas fa-comment-dots"></i> ${escapeHtml(requisito.observacao)}</div>` : ''}
                    ${htmlSeloClassificacao(requisito)}
                    ${htmlReferenciasRequisito('cliente', requisito.id)}
                    <div class="requisito-meta">
                        <small class="text-muted">
                            <i class="fas fa-calendar"></i> 
                            Criado em ${formatDate(requisito.created)}
                            ${requisito.importancia > 0 ? `| <i class="fas fa-star"></i> Importância: ${requisito.importancia.toFixed(1)}` : ''}
                            ${requisito.peso > 0 ? `| <i class="fas fa-percentage"></i> Peso: ${(requisito.peso * 100).toFixed(1)}%` : ''}
                        </small>
                    </div>
                </div>
                <div class="requisito-actions">
                    ${htmlBotaoIdeia('cliente', requisito.id)}
                    <button class="btn-icon btn-edit" onclick="editRequisito('${requisito.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteRequisito('${requisito.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="requisito-edit-form" id="edit-form-${requisito.id}" style="display: none;">
                <div class="form-group">
                    <label>Descrição:</label>
                    <textarea class="form-control" id="edit-desc-${requisito.id}" rows="3" maxlength="300">${escapeHtml(requisito.descricao)}</textarea>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-comment-dots"></i> Texto explicativo (aparece como balão ao passar o mouse nas comparações):</label>
                    <textarea class="form-control" id="edit-obs-${requisito.id}" rows="2" maxlength="1000" placeholder="Ex.: Este requisito refere-se à facilidade de uso para idosos acima de 65 anos...">${escapeHtml(requisito.observacao || '')}</textarea>
                </div>
                ${htmlCampoClassificacao(`edit-class-${requisito.id}`, `edit-just-${requisito.id}`, requisito)}
                <div class="edit-actions">
                    <button class="btn btn-sm btn-success" onclick="saveEdit('${requisito.id}')">
                        <i class="fas fa-check"></i> Salvar
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="cancelEdit('${requisito.id}')">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    listaContainer.innerHTML = requisitosHTML;
}

/**
 * Habilita o modo de edição para um requisito específico
 * 
 * @param {string} id - ID único do requisito a ser editado
 */
function editRequisito(id) {
    const descElement = document.getElementById(`desc-${id}`);
    const editForm = document.getElementById(`edit-form-${id}`);
    
    if (descElement && editForm) {
        descElement.style.display = 'none';
        editForm.style.display = 'block';
        
        const textarea = document.getElementById(`edit-desc-${id}`);
        if (textarea) {
            textarea.focus();
            autoResizeTextarea({ target: textarea });
        }
    }
}

/**
 * Salva as alterações feitas em um requisito em edição
 * 
 * @param {string} id - ID único do requisito sendo editado
 */
function saveEdit(id) {
    const textarea = document.getElementById(`edit-desc-${id}`);
    if (!textarea) return;
    
    const novaDescricao = textarea.value.trim();
    const obsTextarea = document.getElementById(`edit-obs-${id}`);
    const novaObservacao = obsTextarea ? obsTextarea.value.trim() : '';
    
    if (!novaDescricao) {
        showAlert('A descrição não pode estar vazia.', 'warning');
        return;
    }
    
    if (novaDescricao.length < 10) {
        showAlert('A descrição deve ter pelo menos 10 caracteres.', 'warning');
        return;
    }

    const duplicado = qfdDB.findRequisitoDuplicado('cliente', novaDescricao, id);
    if (duplicado) {
        showAlert(`Já existe um requisito com esta descrição: "${escapeHtml(duplicado.descricao)}".`, 'warning');
        return;
    }

    const { erro, ...classificacao } = lerClassificacao(`edit-class-${id}`, `edit-just-${id}`);
    if (erro) {
        showAlert(erro, 'warning');
        return;
    }

    try {
        const updated = qfdDB.updateRequisitoCliente(id, { descricao: novaDescricao, observacao: novaObservacao, ...classificacao });
        
        if (updated) {
            showAlert('Requisito atualizado com sucesso!', 'success');
            loadRequisitos();
        } else {
            showAlert('Erro ao atualizar requisito.', 'danger');
        }
    } catch (error) {
        console.error('Erro ao atualizar requisito:', error);
        showAlert('Erro interno. Verifique o console para mais detalhes.', 'danger');
    }
}

/**
 * Cancela a edição de um requisito, restaurando o estado original
 * 
 * @param {string} id - ID único do requisito sendo editado
 */
function cancelEdit(id) {
    const descElement = document.getElementById(`desc-${id}`);
    const editForm = document.getElementById(`edit-form-${id}`);
    
    if (descElement && editForm) {
        descElement.style.display = 'block';
        editForm.style.display = 'none';
    }
}

/**
 * Remove um requisito de cliente após confirmação
 * Remove também todas as comparações e relações QFD associadas
 * 
 * @param {string} id - ID único do requisito a ser removido
 */
function deleteRequisito(id) {
    const requisitos = qfdDB.getRequisitosCliente({ todos: true });
    const requisito = requisitos.find(r => r.id === id);
    
    if (!requisito) return;
    
    const confirmMessage = `Tem certeza que deseja excluir o requisito:\n\n"${requisito.descricao}"\n\nEsta ação não pode ser desfeita e removerá todas as comparações relacionadas.`;
    
    if (confirm(confirmMessage)) {
        try {
            qfdDB.removeRequisitoCliente(id);
            showAlert('Requisito excluído com sucesso!', 'success');
            loadRequisitos();
            updateNavigationState();
        } catch (error) {
            console.error('Erro ao excluir requisito:', error);
            showAlert('Erro ao excluir requisito.', 'danger');
        }
    }
}

// ========================================================================
// SEÇÃO 4: FUNÇÕES UTILITÁRIAS
// ========================================================================

/**
 * Limpa o formulário de cadastro de requisitos
 */
function clearForm() {
    const form = document.getElementById('form-requisito');
    if (form) {
        form.reset();
        
        const textarea = document.getElementById('descricao-requisito');
        if (textarea) {
            textarea.style.height = 'auto';
        }
        toggleJustificativaClassificacao('classificacao-requisito', 'justificativa-requisito');
    }
}

function clearAllRequisitos() {
    const requisitos = qfdDB.getRequisitosCliente();
    
    if (requisitos.length === 0) {
        showAlert('Não há requisitos para excluir.', 'info');
        return;
    }
    
    const confirmMessage = `Tem certeza que deseja excluir TODOS os ${requisitos.length} requisitos?\n\nEsta ação não pode ser desfeita e removerá todas as comparações e relações QFD relacionadas.`;
    
    if (confirm(confirmMessage)) {
        try {
            requisitos.forEach(req => qfdDB.removeRequisitoCliente(req.id));
            showAlert('Todos os requisitos foram excluídos!', 'success');
            loadRequisitos();
            updateNavigationState();
        } catch (error) {
            console.error('Erro ao excluir requisitos:', error);
            showAlert('Erro ao excluir requisitos.', 'danger');
        }
    }
}

/**
 * Exporta todos os requisitos de cliente para um arquivo CSV
 */
function exportRequisitos() {
    const requisitos = qfdDB.getRequisitosCliente();
    
    if (requisitos.length === 0) {
        showAlert('Não há requisitos para exportar.', 'info');
        return;
    }
    
    const csvContent = generateCSV(requisitos);
    downloadFile(csvContent, `requisitos-cliente-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    
    showAlert('Requisitos exportados com sucesso!', 'success');
}

/**
 * Gera o conteúdo CSV a partir de um array de requisitos
 * 
 * @param {Array} requisitos - Array de requisitos a serem exportados
 * @returns {string} Conteúdo do arquivo CSV
 */
function generateCSV(requisitos) {
    const headers = ['Número', 'Descrição', 'Importância', 'Peso (%)', 'Data de Criação'];
    const rows = requisitos.map((req, index) => [
        index + 1,
        csvCell(req.descricao),
        req.importancia.toFixed(2),
        (req.peso * 100).toFixed(2),
        formatDate(req.created)
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

/**
 * Atualiza o estado do botão de navegação "Próximo"
 * Desabilita se não houver pelo menos 2 requisitos cadastrados
 */
function updateNavigationState() {
    const requisitos = qfdDB.getRequisitosCliente();
    const btnProximo = document.getElementById('btn-proximo');
    
    if (btnProximo) {
        if (requisitos.length < 2) {
            btnProximo.classList.add('disabled');
            btnProximo.title = 'Adicione pelo menos 2 requisitos para continuar';
        } else {
            btnProximo.classList.remove('disabled');
            btnProximo.title = 'Continuar para a comparação dos requisitos';
        }
    }
}


