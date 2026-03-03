#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variaveis de ambiente nao configuradas.');
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exitCode = 1;
  return;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const idArg = args.find(a => a.startsWith('--id='));
const campanhaId = idArg ? idArg.split('=')[1] : null;
const campanhaNome = args.find(a => !a.startsWith('--'));

function formatDate(dateIso) {
  if (!dateIso) return '-';
  const dt = new Date(dateIso);
  return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleString('pt-BR');
}

async function main() {
  const { error: erroCampanhaId } = await supabase
    .from('atendimentos')
    .select('campanha_id', { count: 'exact', head: true })
    .limit(1);

  if (erroCampanhaId) {
    const { error: erroTabela } = await supabase
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (!erroTabela) {
      console.error('A coluna atendimentos.campanha_id nao existe no banco.');
      console.error('Execute a migracao 204_add_campanha_id_to_atendimentos.sql antes do backfill.');
      process.exitCode = 1;
      return;
    }

    console.error('Erro ao verificar coluna campanha_id:', erroCampanhaId);
    try {
      console.error('Detalhes do erro:', JSON.stringify(erroCampanhaId));
      console.error('Erro ao acessar tabela atendimentos:', erroTabela);
    } catch (stringifyError) {
      console.error('Nao foi possivel serializar detalhes do erro.');
    }
    process.exitCode = 1;
    return;
  }

  let campanha = null;

  if (campanhaId) {
    const { data, error } = await supabase
      .from('campanhas')
      .select('id, nome, local, campanhas_servicos(id, categoria_servico_id, quantidade, categorias_servicos(id, nome))')
      .eq('id', campanhaId)
      .single();

    if (error || !data) {
      console.error('Campanha nao encontrada pelo id informado.');
      process.exitCode = 1;
      return;
    }

    campanha = data;
  } else if (campanhaNome) {
    const { data, error } = await supabase
      .from('campanhas')
      .select('id, nome, local, campanhas_servicos(id, categoria_servico_id, quantidade, categorias_servicos(id, nome))')
      .ilike('nome', `%${campanhaNome}%`);

    if (error || !data || data.length === 0) {
      console.error('Nenhuma campanha encontrada com esse nome.');
      process.exitCode = 1;
      return;
    }

    if (data.length > 1) {
      console.error('Encontradas varias campanhas. Use --id=<id> para escolher:');
      data.forEach(c => {
        console.log(`- ${c.id} | ${c.nome} | ${c.local || '-'}`);
      });
      process.exitCode = 1;
      return;
    }

    campanha = data[0];
  } else {
    console.error('Informe o nome da campanha ou --id=<id>.');
    process.exitCode = 1;
    return;
  }

  console.log(`\nCampanha selecionada: ${campanha.nome} (${campanha.id})`);

  const { data: atendimentos, error: erroAtendimentos } = await supabase
    .from('atendimentos')
    .select('id, data_atendimento, tipo_atendimento, eleitores(nome), campanha_id')
    .eq('campanha_id', campanha.id);

  if (erroAtendimentos) {
    console.error('Erro ao buscar atendimentos:', erroAtendimentos.message);
    process.exitCode = 1;
    return;
  }

  console.log(`\nAtendimentos encontrados: ${atendimentos.length}`);
  atendimentos.forEach(at => {
    console.log(`- ${at.id} | ${at.eleitores?.nome || '-'} | ${at.tipo_atendimento || '-'} | ${formatDate(at.data_atendimento)}`);
  });

  const atendimentoIds = atendimentos.map(a => a.id);
  let servicosAtendimentos = [];

  if (atendimentoIds.length > 0) {
    const { data, error } = await supabase
      .from('atendimentos_servicos')
      .select('atendimento_id, categoria_servico_id')
      .in('atendimento_id', atendimentoIds);

    if (error) {
      console.error('Erro ao buscar atendimentos_servicos:', error.message);
      process.exitCode = 1;
      return;
    }

    servicosAtendimentos = data || [];
  }

  const usoPorServico = {};
  servicosAtendimentos.forEach(item => {
    usoPorServico[item.categoria_servico_id] = (usoPorServico[item.categoria_servico_id] || 0) + 1;
  });

  console.log('\nResumo por servico:');
  for (const cs of (campanha.campanhas_servicos || [])) {
    const total = cs.quantidade || 0;
    const usados = usoPorServico[cs.categoria_servico_id] || 0;
    const disponiveis = Math.max(total - usados, 0);
    const nomeServico = cs.categorias_servicos?.nome || 'Servico';

    console.log(`- ${nomeServico}: Total ${total} | Usados ${usados} | Disponiveis ${disponiveis}`);

    if (apply) {
      const { error: erroUpdate } = await supabase
        .from('campanhas_servicos')
        .update({ quantidade: disponiveis })
        .eq('id', cs.id);

      if (erroUpdate) {
        console.error(`Erro ao atualizar ${nomeServico}:`, erroUpdate.message);
        process.exitCode = 1;
        return;
      }
    }
  }

  if (apply) {
    console.log('\nAtualizacao aplicada com sucesso.');
  } else {
    console.log('\nModo simulacao (dry-run). Use --apply para debitar no banco.');
  }
}

main().catch((error) => {
  console.error('Erro inesperado:', error);
  process.exitCode = 1;
});
