export async function registrarLogAuditoria(dados = {}) {
  try {
    const response = await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usuarioId: dados.usuario_id || dados.usuarioId,
        tipoEvento: dados.acao || dados.tipoEvento,
        modulo: dados.modulo,
        descricao: dados.descricao,
        status: dados.status,
        dados: dados.dados || dados.dados_novos || null
      })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.erro || result.message || 'Erro ao registrar log');
    }
  } catch (error) {
    console.error('Erro ao registrar log:', error.message);
  }
}
