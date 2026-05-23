import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeStatus(input) {
  const allowed = new Set(['AGENDADO', 'REALIZADO', 'CANCELADO']);
  const legacyMap = {
    NAO_REALIZADO: 'CANCELADO',
    EM_PROCESSO: 'AGENDADO'
  };

  if (!input) return 'AGENDADO';

  const raw = String(input).trim().toUpperCase();
  const mapped = legacyMap[raw] || raw;
  return allowed.has(mapped) ? mapped : 'AGENDADO';
}

export default async function handler(req, res) {
  // GET - Buscar todos os atendimentos
  if (req.method === 'GET') {
    try {
      const { search, status, dataInicio, dataFim } = req.query;

      // Query simplificada primeiro - sem joins complexos
      let query = supabase
        .from('atendimentos')
        .select(`
          id,
          protocolo,
          data_atendimento,
          tipo_atendimento,
          assunto,
          descricao,
          resultado,
          status,
          eleitor_id,
          campanha_id,
          eleitores!atendimentos_eleitor_id_fkey (
            id,
            nome,
            cpf,
            rg
          ),
          campanhas:campanhas!atendimentos_campanha_id_fkey (
            id,
            nome,
            data_campanha
          )
        `);

      // Aplicar filtros de status e data
      if (status && status !== 'TODOS') {
        query = query.eq('status', normalizeStatus(status));
      }

      if (dataInicio) {
        query = query.gte('data_atendimento', `${dataInicio}T00:00:00`);
      }

      if (dataFim) {
        query = query.lte('data_atendimento', `${dataFim}T23:59:59`);
      }

      let { data, error } = await query.order('data_atendimento', { ascending: false });

      if (error) {
        console.error('Erro na query principal:', error);
        throw error;
      }

      // Buscar serviços separadamente e fazer merge
      if (data && data.length > 0) {
        try {
          const atendimentoIds = data.map(a => a.id);
          const { data: servicos, error: erroServicos } = await supabase
            .from('atendimentos_servicos')
            .select(`
              atendimento_id,
              categorias_servicos (
                id,
                nome
              )
            `)
            .in('atendimento_id', atendimentoIds);

          if (!erroServicos && servicos) {
            // Agrupar serviços por atendimento
            const servicosPorAtendimento = {};
            servicos.forEach(s => {
              if (!servicosPorAtendimento[s.atendimento_id]) {
                servicosPorAtendimento[s.atendimento_id] = [];
              }
              if (s.categorias_servicos) {
                servicosPorAtendimento[s.atendimento_id].push(s.categorias_servicos);
              }
            });

            // Adicionar serviços aos atendimentos
            data = data.map(a => ({
              ...a,
              atendimentos_servicos: servicosPorAtendimento[a.id] || []
            }));
          } else {
            // Se houver erro ao buscar serviços, retornar array vazio
            data = data.map(a => ({
              ...a,
              atendimentos_servicos: []
            }));
          }
        } catch (servicoError) {
          // Se houver erro ao buscar serviços, continuar sem eles
          console.warn('Aviso - Não foi possível buscar serviços:', servicoError.message);
          data = data.map(a => ({
            ...a,
            atendimentos_servicos: []
          }));
        }
      }

      // Aplicar filtro de busca no resultado (case-insensitive)
      if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter(at => 
          (at.eleitores?.nome?.toLowerCase() || '').includes(searchLower) ||
          (at.eleitores?.cpf || '').includes(search) ||
          (at.tipo_atendimento?.toLowerCase() || '').includes(searchLower) ||
          (at.protocolo?.toLowerCase() || '').includes(searchLower)
        );
      }

      return res.status(200).json(data || []);
    } catch (error) {
      console.error('Erro ao buscar atendimentos:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(400).json({ 
        error: error.message,
        details: error.details || 'Sem detalhes'
      });
    }
  }

  // POST - Criar novo atendimento
  if (req.method === 'POST') {
    try {
      const { eleitorId, tipoAtendimento, assunto, descricao, resultado, status, dataAtendimento, campanhaId, servicosSelecionados } = req.body;

      const statusNormalizado = normalizeStatus(status);

      // Gerar protocolo
      const protocolo = `ATD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const { data, error } = await supabase
        .from('atendimentos')
        .insert([
          {
            protocolo,
            eleitor_id: eleitorId,
            tipo_atendimento: tipoAtendimento,
            assunto,
            descricao,
            resultado,
            status: statusNormalizado,
            data_atendimento: dataAtendimento ? new Date(dataAtendimento).toISOString() : new Date().toISOString(),
            campanha_id: campanhaId || null
          }
        ])
        .select();

      if (error) throw error;

      const atendimentoId = data[0].id;

      // Salvar serviços selecionados se houver
      if (servicosSelecionados && servicosSelecionados.length > 0) {
        // Se são strings (nomes), precisa buscar os IDs das categorias_servicos
        const servicosPayload = [];
        
        for (const servico of servicosSelecionados) {
          // Se for string (nome do serviço), buscar o ID
          if (typeof servico === 'string') {
            const { data: categorias } = await supabase
              .from('categorias_servicos')
              .select('id')
              .eq('nome', servico)
              .single();
            
            if (categorias?.id) {
              servicosPayload.push({
                atendimento_id: atendimentoId,
                categoria_servico_id: categorias.id
              });
            }
          } else if (servico.id) {
            // Se é um objeto com id
            servicosPayload.push({
              atendimento_id: atendimentoId,
              categoria_servico_id: servico.id
            });
          }
        }

        if (servicosPayload.length > 0) {
          const { error: erroServicos } = await supabase
            .from('atendimentos_servicos')
            .insert(servicosPayload);
          
          if (erroServicos) {
            console.error('Erro ao associar serviços:', erroServicos);
            // Não falha o atendimento se não conseguir associar serviços
          }

          if (campanhaId) {
            for (const servico of servicosPayload) {
              const { data: campanhaServico, error: erroCampanhaServico } = await supabase
                .from('campanhas_servicos')
                .select('id, quantidade')
                .eq('campanha_id', campanhaId)
                .eq('categoria_servico_id', servico.categoria_servico_id)
                .single();

              if (erroCampanhaServico || !campanhaServico) {
                throw new Error('Servico da campanha nao encontrado para atualizacao de quantidade');
              }

              const quantidadeAtual = campanhaServico.quantidade || 0;
              if (quantidadeAtual < 1) {
                throw new Error('Quantidade do servico esgotada para esta campanha');
              }

              const { error: erroAtualizarQuantidade } = await supabase
                .from('campanhas_servicos')
                .update({ quantidade: quantidadeAtual - 1 })
                .eq('id', campanhaServico.id);

              if (erroAtualizarQuantidade) {
                throw erroAtualizarQuantidade;
              }
            }
          }
        }
      }

      // Retornar atendimento completo com serviços
      const { data: atendimentoCompleto } = await supabase
        .from('atendimentos')
        .select(`
          id,
          protocolo,
          data_atendimento,
          tipo_atendimento,
          assunto,
          descricao,
          resultado,
          status,
          eleitor_id,
          campanha_id,
          eleitores!atendimentos_eleitor_id_fkey (
            id,
            nome,
            cpf
          ),
          atendimentos_servicos (
            categoria_servico_id,
            categorias_servicos (
              id,
              nome
            )
          )
        `)
        .eq('id', atendimentoId)
        .single();

      return res.status(201).json(atendimentoCompleto);
    } catch (error) {
      console.error('Erro ao criar atendimento:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
