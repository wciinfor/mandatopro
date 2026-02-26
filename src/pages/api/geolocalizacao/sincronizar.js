import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const supabase = createServerClient();

    // Buscar eleitores com dados de localização
    const { data: eleitores, error: eleitoresError } = await supabase
      .from('eleitores')
      .select('id, nome, status, telefone, celular, whatsapp, email, latitude, longitude, bairro, cidade, endereco, logradouro, numero, complemento, estado, uf, updated_at, e_lideranca');

    if (eleitoresError) {
      return res.status(500).json({ error: eleitoresError.message });
    }

    // Filtrar apenas eleitores com coordenadas válidas
    const eleitoresComGeo = (eleitores || []).filter((e) => e.latitude && e.longitude);

    if (eleitoresComGeo.length === 0) {
      return res.status(200).json({ count: 0, added: 0, updated: 0, message: 'Nenhum eleitor com geolocalização.' });
    }

    // Buscar marcadores existentes
    const { data: marcadoresExistentes, error: marcadoresError } = await supabase
      .from('geolocalizacao')
      .select('id, eleitor_id, latitude, longitude, nome, status, tipo, updated_at')
      .eq('tipo', 'ELEITOR');

    if (marcadoresError) {
      return res.status(500).json({ error: marcadoresError.message });
    }

    // Criar mapa de eleitores existentes por ID
    const mapaMarcadores = {};
    (marcadoresExistentes || []).forEach(m => {
      mapaMarcadores[m.eleitor_id] = m;
    });

    let added = 0;
    let updated = 0;
    let novosMarcadores = [];
    let atualizacoes = [];

    // Processar cada eleitor
    eleitoresComGeo.forEach((eleitor) => {
      const enderecoBase = eleitor.logradouro || eleitor.endereco || '';
      const numero = eleitor.numero ? `, ${eleitor.numero}` : '';
      const complemento = eleitor.complemento ? ` ${eleitor.complemento}` : '';
      const endereco = `${enderecoBase}${numero}${complemento}`.trim();

      // Determinar tipo baseado em e_lideranca
      const tipo = eleitor.e_lideranca ? 'LIDERANCA' : 'ELEITOR';
      const iconColor = eleitor.e_lideranca ? '#9C27B0' : '#14b8a6'; // Roxo para liderança, teal para eleitor

      const novoDado = {
        tipo: tipo,
        nome: eleitor.nome,
        descricao: eleitor.e_lideranca ? 'Liderança' : 'Eleitor',
        cidade: eleitor.cidade || null,
        bairro: eleitor.bairro || null,
        endereco: endereco || null,
        latitude: eleitor.latitude,
        longitude: eleitor.longitude,
        icon_color: iconColor,
        icon_type: tipo,
        eleitor_id: eleitor.id,
        status: eleitor.status || 'ATIVO',
        updated_at: new Date().toISOString(),
      };

      const marcadorExistente = mapaMarcadores[eleitor.id];

      if (!marcadorExistente) {
        // Novo marcador
        novoDado.data_criacao = new Date().toISOString();
        novosMarcadores.push(novoDado);
        added++;
      } else {
        // Verificar se houve mudanças
        const mudouCoordenadas = 
          marcadorExistente.latitude !== eleitor.latitude || 
          marcadorExistente.longitude !== eleitor.longitude;
        const mudouNome = marcadorExistente.nome !== eleitor.nome;
        const mudouStatus = marcadorExistente.status !== (eleitor.status || 'ATIVO');
        const mudouTipo = marcadorExistente.tipo !== tipo; // NOVO: verificar se virou liderança

        if (mudouCoordenadas || mudouNome || mudouStatus || mudouTipo) {
          atualizacoes.push({
            id: marcadorExistente.id,
            ...novoDado,
          });
          updated++;
        }
      }
    });

    // Inserir novos marcadores em lotes
    if (novosMarcadores.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < novosMarcadores.length; i += batchSize) {
        const batch = novosMarcadores.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('geolocalizacao')
          .insert(batch);

        if (insertError) {
          return res.status(500).json({ error: insertError.message });
        }
      }
    }

    // Atualizar marcadores modificados em lotes
    if (atualizacoes.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < atualizacoes.length; i += batchSize) {
        const batch = atualizacoes.slice(i, i + batchSize);
        
        for (const item of batch) {
          const { id, ...dados } = item;
          const { error: updateError } = await supabase
            .from('geolocalizacao')
            .update(dados)
            .eq('id', id);

          if (updateError) {
            return res.status(500).json({ error: updateError.message });
          }
        }
      }
    }

    return res.status(200).json({ 
      count: added + updated, 
      added,
      updated,
      message: `Sincronização concluída: ${added} novo(s), ${updated} atualizado(s).` 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
}
