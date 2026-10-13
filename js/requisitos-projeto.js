/**
 * ============================================================================
 * GERENCIAMENTO DE REQUISITOS DE PROJETO
 * ============================================================================
 * 
 * Este módulo gerencia a página de cadastro e edição de requisitos técnicos
 * do projeto. Requisitos de projeto são características técnicas que devem
 * ser implementadas para atender aos requisitos do cliente.
 * 
 * Cada requisito possui:
 * - Descrição técnica
 * - Sentido de melhoria (crescente ↑, decrescente ↓, nominal *)
 * - Dificuldade técnica (1-5)
 * 
 * Funcionalidades:
 * - Cadastro com sentido de melhoria e dificuldade
 * - Edição inline completa
 * - Exclusão individual ou em massa
 * - Exportação para CSV
 */

// ========================================================================
// SEÇÃO 1: INICIALIZAÇÃO
// ========================================================================

/**
 * Inicializa a página quando o DOM está pronto
 */
document.addEventListener('DOMContentLoaded', function() {
    const campoClassificacao = document.getElementById('classificacao-novo');
    if (campoClassificacao) campoClassificacao.innerHTML = htmlCampoClassificacao('classificacao-requisito', 'justificativa-requisito');
    loadRequisitos();
    setupEventListeners();
    updateNavigationState();
});

function setupEventListeners() {
    const form = document.getElementById('form-requisito-projeto');
    if (form) {
        form.addEventListener('submit', handleSubmitRequisito);
    }
    
    // Auto-resize textarea
    const textarea = document.getElementById('descricao-requisito');
    if (textarea) {
        textarea.addEventListener('input', autoResizeTextarea);
        // Adicionar evento para salvar com Enter
        textarea.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                const form = document.getElementById('form-requisito-projeto');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }
        });
    }
}

function handleSubmitRequisito(event) {
    event.preventDefault();
    
    const descricao = document.getElementById('descricao-requisito').value.trim();
    const sentidoMelhoria = document.getElementById('sentido-melhoria').value;
    const dificuldadeTecnica = parseInt(document.getElementById('dificuldade-tecnica').value);
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

    const duplicado = qfdDB.findRequisitoDuplicado('projeto', descricao);
    if (duplicado) {
        showAlert(`Já existe um requisito com esta descrição: "${escapeHtml(duplicado.descricao)}".`, 'warning');
        return;
    }
    
    if (!sentidoMelhoria) {
        showAlert('Por favor, selecione o sentido da melhoria.', 'warning');
        return;
    }
    
    if (!dificuldadeTecnica || dificuldadeTecnica < 1 || dificuldadeTecnica > 5) {
        showAlert('Por favor, selecione a dificuldade técnica.', 'warning');
        return;
    }

    const classificacao = lerClassificacao('classificacao-requisito', 'justificativa-requisito');
    if (classificacao.erro) {
        showAlert(classificacao.erro, 'warning');
        return;
    }
    
    try {
        const novoRequisito = qfdDB.addRequisitoProjeto(descricao, sentidoMelhoria, dificuldadeTecnica, observacao);
        if (novoRequisito && classificacao.classificacao) {
            delete classificacao.erro;
            qfdDB.updateRequisitoProjeto(novoRequisito.id, classificacao);
        }
        
        if (novoRequisito) {
            showAlert('Requisito de projeto adicionado com sucesso!', 'success');
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

function loadRequisitos() {
    const requisitos = qfdDB.getRequisitosProjeto({ todos: true });
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
                <div class="requisito-number${numeros[index] ? '' : ' fora-qfd'}" title="${numeros[index] ? `RP${numeros[index]} no QFD` : 'Fora do QFD'}">
                    <span class="number">${numeros[index] || '<i class="fas fa-tag"></i>'}</span>
                </div>
                <div class="requisito-content">
                    <div class="requisito-description" id="desc-${requisito.id}">
                        ${escapeHtml(requisito.descricao)}
                    </div>
                    ${requisito.observacao ? `<div class="requisito-observacao-preview"><i class="fas fa-comment-dots"></i> ${escapeHtml(requisito.observacao)}</div>` : ''}
                    ${htmlSeloClassificacao(requisito)}
                    <div class="requisito-attributes">
                        <div class="attribute-item">
                            <span class="attribute-label">Sentido:</span>
                            <span class="sentido-badge ${requisito.sentidoMelhoria}">
                                ${getSentidoSymbol(requisito.sentidoMelhoria)} ${getSentidoLabel(requisito.sentidoMelhoria)}
                            </span>
                        </div>
                        <div class="attribute-item">
                            <span class="attribute-label">Dificuldade:</span>
                            <span class="dificuldade-badge level-${requisito.dificuldadeTecnica}">
                                ${getDificuldadeLabel(requisito.dificuldadeTecnica)}
                            </span>
                        </div>
                    </div>
                    <div class="requisito-meta">
                        <small class="text-muted">
                            <i class="fas fa-calendar"></i> 
                            Criado em ${formatDate(requisito.created)}
                            ${requisito.importanciaAbsoluta > 0 ? `| <i class="fas fa-star"></i> Imp. Abs.: ${requisito.importanciaAbsoluta.toFixed(1)}` : ''}
                            ${requisito.importanciaRelativa > 0 ? `| <i class="fas fa-sort-numeric-down"></i> Ranking: ${requisito.importanciaRelativa}º` : ''}
                            ${requisito.pesoRelativo > 0 ? `| <i class="fas fa-percentage"></i> Peso: ${(requisito.pesoRelativo * 100).toFixed(1)}%` : ''}
                        </small>
                    </div>
                </div>
                <div class="requisito-actions">
                    ${htmlBotaoIdeia('projeto', requisito.id)}
                    <button class="btn-icon btn-edit" onclick="editRequisito('${requisito.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteRequisito('${requisito.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="requisito-edit-form" id="edit-form-${requisito.id}" style="display: none;">
                <div class="edit-form-content">
                    <div class="form-group">
                        <label>Descrição:</label>
                        <textarea class="form-control" id="edit-desc-${requisito.id}" rows="3" maxlength="300">${escapeHtml(requisito.descricao)}</textarea>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-comment-dots"></i> Texto explicativo (aparece como balão ao passar o mouse nas correlações e matriz):</label>
                        <textarea class="form-control" id="edit-obs-${requisito.id}" rows="2" maxlength="1000" placeholder="Ex.: Mede a resistência térmica do material em °C por hora...">${escapeHtml(requisito.observacao || '')}</textarea>
                    </div>
                    ${htmlCampoClassificacao(`edit-class-${requisito.id}`, `edit-just-${requisito.id}`, requisito)}
                    <div class="form-row">
                        <div class="form-group">
                            <label>Sentido da Melhoria:</label>
                            <select class="form-control" id="edit-sentido-${requisito.id}">
                                <option value="up" ${requisito.sentidoMelhoria === 'up' ? 'selected' : ''}>↑ Crescente</option>
                                <option value="down" ${requisito.sentidoMelhoria === 'down' ? 'selected' : ''}>↓ Decrescente</option>
                                <option value="none" ${requisito.sentidoMelhoria === 'none' ? 'selected' : ''}>* Nominal</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Dificuldade Técnica:</label>
                            <select class="form-control" id="edit-dificuldade-${requisito.id}">
                                <option value="1" ${requisito.dificuldadeTecnica === 1 ? 'selected' : ''}>1 - Muito Fácil</option>
                                <option value="2" ${requisito.dificuldadeTecnica === 2 ? 'selected' : ''}>2 - Fácil</option>
                                <option value="3" ${requisito.dificuldadeTecnica === 3 ? 'selected' : ''}>3 - Moderada</option>
                                <option value="4" ${requisito.dificuldadeTecnica === 4 ? 'selected' : ''}>4 - Difícil</option>
                                <option value="5" ${requisito.dificuldadeTecnica === 5 ? 'selected' : ''}>5 - Muito Difícil</option>
                            </select>
                        </div>
                    </div>
                </div>
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

function getDificuldadeLabel(dificuldade) {
    const labels = {
        1: 'Muito Fácil',
        2: 'Fácil',
        3: 'Moderada',
        4: 'Difícil',
        5: 'Muito Difícil'
    };
    return labels[dificuldade] || 'Indefinida';
}

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

function saveEdit(id) {
    const textarea = document.getElementById(`edit-desc-${id}`);
    const sentidoSelect = document.getElementById(`edit-sentido-${id}`);
    const dificuldadeSelect = document.getElementById(`edit-dificuldade-${id}`);
    
    if (!textarea || !sentidoSelect || !dificuldadeSelect) return;
    
    const novaDescricao = textarea.value.trim();
    const novoSentido = sentidoSelect.value;
    const novaDificuldade = parseInt(dificuldadeSelect.value);
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

    const duplicado = qfdDB.findRequisitoDuplicado('projeto', novaDescricao, id);
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
        const updated = qfdDB.updateRequisitoProjeto(id, {
            descricao: novaDescricao,
            observacao: novaObservacao,
            sentidoMelhoria: novoSentido,
            dificuldadeTecnica: novaDificuldade,
            ...classificacao
        });
        
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

function cancelEdit(id) {
    const descElement = document.getElementById(`desc-${id}`);
    const editForm = document.getElementById(`edit-form-${id}`);
    
    if (descElement && editForm) {
        descElement.style.display = 'block';
        editForm.style.display = 'none';
    }
}

function deleteRequisito(id) {
    const requisitos = qfdDB.getRequisitosProjeto({ todos: true });
    const requisito = requisitos.find(r => r.id === id);
    
    if (!requisito) return;
    
    const confirmMessage = `Tem certeza que deseja excluir o requisito:\n\n"${requisito.descricao}"\n\nEsta ação não pode ser desfeita e removerá todas as correlações e relações QFD relacionadas.`;
    
    if (confirm(confirmMessage)) {
        try {
            qfdDB.removeRequisitoProjeto(id);
            showAlert('Requisito excluído com sucesso!', 'success');
            loadRequisitos();
            updateNavigationState();
        } catch (error) {
            console.error('Erro ao excluir requisito:', error);
            showAlert('Erro ao excluir requisito.', 'danger');
        }
    }
}

function clearForm() {
    const form = document.getElementById('form-requisito-projeto');
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
    const requisitos = qfdDB.getRequisitosProjeto();
    
    if (requisitos.length === 0) {
        showAlert('Não há requisitos para excluir.', 'info');
        return;
    }
    
    const confirmMessage = `Tem certeza que deseja excluir TODOS os ${requisitos.length} requisitos de projeto?\n\nEsta ação não pode ser desfeita e removerá todas as correlações e relações QFD relacionadas.`;
    
    if (confirm(confirmMessage)) {
        try {
            requisitos.forEach(req => qfdDB.removeRequisitoProjeto(req.id));
            showAlert('Todos os requisitos foram excluídos!', 'success');
            loadRequisitos();
            updateNavigationState();
        } catch (error) {
            console.error('Erro ao excluir requisitos:', error);
            showAlert('Erro ao excluir requisitos.', 'danger');
        }
    }
}

function exportRequisitos() {
    const requisitos = qfdDB.getRequisitosProjeto();
    
    if (requisitos.length === 0) {
        showAlert('Não há requisitos para exportar.', 'info');
        return;
    }
    
    const csvContent = generateCSV(requisitos);
    downloadFile(csvContent, `requisitos-projeto-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    
    showAlert('Requisitos exportados com sucesso!', 'success');
}

function generateCSV(requisitos) {
    const headers = ['Número', 'Descrição', 'Sentido Melhoria', 'Dificuldade Técnica', 'Imp. Absoluta', 'Ranking', 'Peso (%)', 'Data de Criação'];
    const rows = requisitos.map((req, index) => [
        index + 1,
        csvCell(req.descricao),
        getSentidoLabel(req.sentidoMelhoria),
        getDificuldadeLabel(req.dificuldadeTecnica),
        req.importanciaAbsoluta.toFixed(2),
        req.importanciaRelativa || 0,
        (req.pesoRelativo * 100).toFixed(2),
        formatDate(req.created)
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function updateNavigationState() {
    const requisitos = qfdDB.getRequisitosProjeto();
    const btnProximo = document.getElementById('btn-proximo');
    
    if (btnProximo) {
        if (requisitos.length < 2) {
            btnProximo.classList.add('disabled');
            btnProximo.title = 'Adicione pelo menos 2 requisitos para continuar';
        } else {
            btnProximo.classList.remove('disabled');
            btnProximo.title = 'Continuar para a correlação entre requisitos';
        }
    }
}


