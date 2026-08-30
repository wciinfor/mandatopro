import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

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
  const supabase = createServerClient();
  let usuario = null;
  try {
    const authResult = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(authResult.usuario);
    usuario = authResult.usuario;
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Erro interno' });
  }

  // GET - Buscar todos os atendimentos
  if (req.method === 'GET') {
    try {
      const contextoMandato = await obterContextoMandato(req, usuario, supabase);
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
          ausente_acao_campanha,
          eleitor_id,
          campanha_id,
          lideranca_id,
          mandato_id,
          liderancas:lideranca_id(id, nome),
          eleitores!atendimentos_eleitor_id_fkey (
            id,
            nome,
            cpf,
            rg,
            email,
            telefone,
            celular,
            endereco,
            logradouro,
            bairro,
            cep,
            nomeMae,
            nomemae
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

      // Isolamento por mandato: inclui atendimentos do mandato ativo + legados (mandato_id NULL)
      // Legados (NULL) permanecem no Mandato Estadual (ID 1) por retrocompatibilidade.
      if (contextoMandato.mandatoId === 1) {
        // Estadual vê: mandato_id = 1 OU mandato_id NULL (legados preservados)
        query = query.or(`mandato_id.eq.${contextoMandato.mandatoId},mandato_id.is.null`);
      } else {
        // Federal vê apenas: mandato_id = 2 (exclui legados NULL por segurança)
        query = query.eq('mandato_id', contextoMandato.mandatoId);
      }

      // Busca diretamente no banco de dados antes da ordenação/limitação
      if (search && search.trim().length > 0) {
        const q = search.trim().replace(/[,()"']/g, '');
        const qDigitos = q.replace(/\D/g, '');

        // 1. Busca IDs de eleitores correspondentes (nome, cpf, rg)
        let eleitoresQuery = supabase.from('eleitores').select('id');
        const filtrosEleitores = [`nome.ilike.%${q}%`];
        if (qDigitos.length >= 3) {
          filtrosEleitores.push(`cpf.ilike.%${qDigitos}%`, `rg.ilike.%${qDigitos}%`);
        }
        eleitoresQuery = eleitoresQuery.or(filtrosEleitores.join(',')).limit(500);

        const { data: eleitoresEncontrados } = await eleitoresQuery;
        const eleitorIds = (eleitoresEncontrados || []).map(e => e.id);

        // 2. Busca também por campanhas que batem com o nome
        const { data: campanhasEncontradas } = await supabase
          .from('campanhas')
          .select('id')
          .ilike('nome', `%${q}%`)
          .limit(100);
        const campanhaIds = (campanhasEncontradas || []).map(c => c.id);

        // 3. Monta condições OR na query de atendimentos
        const orConditions = [
          `protocolo.ilike.%${q}%`,
          `tipo_atendimento.ilike.%${q}%`,
          `assunto.ilike.%${q}%`
        ];

        if (eleitorIds.length > 0) {
          orConditions.push(`eleitor_id.in.(${eleitorIds.join(',')})`);
        }
        if (campanhaIds.length > 0) {
          orConditions.push(`campanha_id.in.(${campanhaIds.join(',')})`);
        }

        query = query.or(orConditions.join(','));
      }

      // Ordenar por created_at DESC (ou data_atendimento se created_at for nulo) para que cadastros recentes nunca fiquem invisíveis
      let { data, error } = await query
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('data_atendimento', { ascending: false });

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
      const { eleitorId, tipoAtendimento, assunto, descricao, resultado, status, ausenteAcaoCampanha, dataAtendimento, campanhaId, servicosSelecionados, liderancaId, lideranca_id } = req.body || {};

      // Resolução de Mandato e Snapshot de Liderança (Sprint P2.11)
      let userMandates = usuario.mandatos || [];
      if (usuario.nivel === 'ADMINISTRADOR') {
        userMandates = [1, 2];
      } else if (!userMandates.length) {
        const { data: vinculosUser } = await supabase
          .from('usuarios_mandatos')
          .select('mandato_id')
          .eq('usuario_id', usuario.id);
        userMandates = (vinculosUser || []).map(v => v.mandato_id);
      }

      let mandatoIdFinal = req.body.mandato_id ? parseInt(req.body.mandato_id) : null;
      if (campanhaId) {
        const { data: cm } = await supabase
          .from('campanhas_mandatos')
          .select('mandato_id')
          .eq('campanha_id', campanhaId)
          .maybeSingle();

        if (cm?.mandato_id) {
          mandatoIdFinal = cm.mandato_id;
        }
      }

      if (mandatoIdFinal && !userMandates.includes(mandatoIdFinal)) {
        return res.status(403).json({ error: `Você não possui permissão para registrar atendimentos no mandato ${mandatoIdFinal === 1 ? 'Estadual' : 'Federal'}` });
      }

      let eleitorInfo = null;
      if (eleitorId) {
        const { data: eFound } = await supabase
          .from('eleitores')
          .select('id, pertencimento, lideranca_id')
          .eq('id', parseInt(eleitorId))
          .maybeSingle();
        eleitorInfo = eFound;
      }

      let liderancaIdFinal = null;
      const targetLiderancaId = liderancaId || lideranca_id;

      if (targetLiderancaId && !isNaN(parseInt(targetLiderancaId))) {
        const reqLidId = parseInt(targetLiderancaId);
        if (mandatoIdFinal) {
          const { data: lm } = await supabase
            .from('liderancas_mandatos')
            .select('lideranca_id')
            .eq('lideranca_id', reqLidId)
            .eq('mandato_id', mandatoIdFinal)
            .maybeSingle();

          if (!lm) {
            return res.status(400).json({ error: 'A liderança selecionada para a ação não pertence ao mandato da campanha' });
          }
        }
        liderancaIdFinal = reqLidId;
      } else if (eleitorId && mandatoIdFinal) {
        const { data: elm } = await supabase
          .from('eleitores_liderancas_mandatos')
          .select('lideranca_id')
          .eq('eleitor_id', parseInt(eleitorId))
          .eq('mandato_id', mandatoIdFinal)
          .maybeSingle();

        if (elm?.lideranca_id) {
          liderancaIdFinal = elm.lideranca_id;
        } else if (eleitorInfo?.lideranca_id) {
          liderancaIdFinal = eleitorInfo.lideranca_id;
        }
      }

      const statusNormalizado = normalizeStatus(status);

      // Verificar duplicidade: eleitor já atendido na mesma campanha (regra não se aplica a atendimentos avulsos)
      if (campanhaId && eleitorId) {
        const { data: atendimentosExistentes } = await supabase
          .from('atendimentos')
          .select('id, protocolo')
          .eq('eleitor_id', parseInt(eleitorId))
          .eq('campanha_id', campanhaId)
          .limit(1);

        const atendimentoExistente = atendimentosExistentes?.[0];

        if (atendimentoExistente) {
          return res.status(409).json({
            error: 'Este eleitor já possui atendimento registrado nesta campanha.',
            detalhe: `Protocolo existente: ${atendimentoExistente.protocolo || atendimentoExistente.id}`
          });
        }
      }

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
            ausente_acao_campanha: Boolean(ausenteAcaoCampanha),
            data_atendimento: dataAtendimento ? new Date(dataAtendimento).toISOString() : new Date().toISOString(),
            campanha_id: campanhaId || null,
            lideranca_id: liderancaIdFinal,
            mandato_id: mandatoIdFinal
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

          if (campanhaId && !ausenteAcaoCampanha) {
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
          ausente_acao_campanha,
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
