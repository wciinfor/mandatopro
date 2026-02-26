import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  try {
    const supabase = createServerClient();

    // GET - Listar eleitores
    if (req.method === 'GET') {
      const { status, search, limit = 100, offset = 0 } = req.query;

      let query = supabase
        .from('eleitores')
        .select('*', { count: 'exact' });

      if (status) {
        query = query.or(`status.eq.${status},statusCadastro.eq.${status}`);
      }

      // Se há um termo de busca, procura por nome ou CPF
      if (search && search.trim().length > 0) {
        query = query.or(`nome.ilike.%${search}%,cpf.ilike.%${search}%`);
      }

      const { data: eleitores, count, error } = await query
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
        .order('nome', { ascending: true });

      if (error) {
        return res.status(400).json({ 
          message: 'Erro ao listar eleitores',
          error: error.message 
        });
      }

      return res.status(200).json({
        data: eleitores,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }

    // POST - Criar novo eleitor
    if (req.method === 'POST') {
      const body = req.body || {};
      const normalizar = (value) => (value === '' ? null : value);

      const payload = {
        nome: normalizar(body.nome),
        cpf: normalizar(body.cpf),
        email: normalizar(body.email),
        telefone: normalizar(body.telefone),
        celular: normalizar(body.celular),
        whatsapp: normalizar(body.whatsapp),
        tituloEleitoral: normalizar(body.tituloEleitoral),
        tituloeleitoral: normalizar(body.tituloEleitoral),
        secao: normalizar(body.secao),
        zona: normalizar(body.zona),
        municipio: normalizar(body.municipio),
        localVotacao: normalizar(body.localVotacao),
        localvotacao: normalizar(body.localVotacao),
        situacaoTSE: normalizar(body.situacaoTSE),
        situacaotse: normalizar(body.situacaoTSE),
        biometria: normalizar(body.biometria),
        nomeSocial: normalizar(body.nomeSocial),
        nomesocial: normalizar(body.nomeSocial),
        rg: normalizar(body.rg),
        nomePai: normalizar(body.nomePai),
        nomepai: normalizar(body.nomePai),
        nomeMae: normalizar(body.nomeMae),
        nomemae: normalizar(body.nomeMae),
        naturalidade: normalizar(body.naturalidade),
        estadoCivil: normalizar(body.estadoCivil),
        estadocivil: normalizar(body.estadoCivil),
        localTrabalho: normalizar(body.localTrabalho),
        localtrabalho: normalizar(body.localTrabalho),
        observacoes: normalizar(body.observacoes),
        logradouro: normalizar(body.logradouro),
        numero: normalizar(body.numero),
        complemento: normalizar(body.complemento),
        bairro: normalizar(body.bairro),
        cidade: normalizar(body.cidade),
        uf: normalizar(body.uf),
        cep: normalizar(body.cep),
        dataNascimento: normalizar(body.dataNascimento),
        datanascimento: normalizar(body.dataNascimento),
        statusCadastro: normalizar(body.statusCadastro),
        statuscadastro: normalizar(body.statusCadastro),
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        // Colunas base (snake_case)
        endereco: normalizar(body.logradouro || body.endereco),
        estado: normalizar(body.uf || body.estado),
        data_nascimento: normalizar(body.dataNascimento || body.data_nascimento),
        sexo: normalizar(body.sexo) ?? 'MASCULINO',
        profissao: normalizar(body.profissao),
        status: normalizar(body.statusCadastro || body.status)
      };

      const { data: eleitor, error } = await supabase
        .from('eleitores')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return res.status(400).json({ 
          message: error.message || 'Erro ao criar eleitor',
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }

      // Criar/atualizar marcador de geolocalizacao
      if (eleitor?.latitude && eleitor?.longitude) {
        const enderecoBase = eleitor.logradouro || eleitor.endereco || '';
        const numero = eleitor.numero ? `, ${eleitor.numero}` : '';
        const complemento = eleitor.complemento ? ` ${eleitor.complemento}` : '';
        const endereco = `${enderecoBase}${numero}${complemento}`.trim();

        await supabase
          .from('geolocalizacao')
          .delete()
          .eq('tipo', 'ELEITOR')
          .eq('eleitor_id', eleitor.id);

        await supabase
          .from('geolocalizacao')
          .insert([{
            tipo: 'ELEITOR',
            nome: eleitor.nome,
            descricao: 'Eleitor',
            cidade: eleitor.cidade || null,
            bairro: eleitor.bairro || null,
            endereco: endereco || null,
            latitude: eleitor.latitude,
            longitude: eleitor.longitude,
            icon_color: '#14b8a6',
            icon_type: 'ELEITOR',
            eleitor_id: eleitor.id,
            status: eleitor.statusCadastro || eleitor.status || 'ATIVO',
            data_criacao: new Date().toISOString()
          }]);
      }

      return res.status(201).json(eleitor);
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message 
    });
  }
}
