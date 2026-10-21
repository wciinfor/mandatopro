import fs from 'fs';
import path from 'path';
import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato, aplicarFiltroPertencimentoEleitor } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

const CIDADES_CACHE_TTL_MS = 10 * 60 * 1000;
const cidadesCache = new Map();

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sanitizarTermoFiltro(valor) {
  return String(valor || '')
    .trim()
    .replace(/[,()"']/g, '');
}

function aplicarFiltrosBase(query, { status, liderancaFiltro, excludeLiderancas }) {
  let next = query;

  if (status) {
    const s = String(status).trim().toUpperCase();
    if (s === 'ATIVO') {
      next = next.or('status.eq.ATIVO,status.is.null');
    } else if (s === 'INATIVO') {
      next = next.eq('status', 'INATIVO');
    } else {
      next = next.eq('status', s);
    }
  }

  if (excludeLiderancas === 'true' || excludeLiderancas === true) {
    next = next.is('lideranca_id', null);
  }

  if (liderancaFiltro) {
    next = next.eq('lideranca_id', liderancaFiltro);
  }

  return next;
}

function tentarCorrigirLatin1ParaUtf8(value) {
  const texto = String(value || '');
  if (!/[ÃÂ]/.test(texto)) return texto;
  try {
    return Buffer.from(texto, 'latin1').toString('utf8');
  } catch {
    return texto;
  }
}

function limparCidadeDisplay(value) {
  return tentarCorrigirLatin1ParaUtf8(value)
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarCidadeKey(value) {
  return limparCidadeDisplay(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcularQualidadeTexto(value) {
  const texto = String(value || '');
  let score = 0;
  if (!texto.includes('\uFFFD')) score += 2;
  if (!/[ÃÂ]/.test(texto)) score += 2;
  if (/[A-Za-z]/.test(texto)) score += 1;
  if (texto.trim().length >= 4) score += 1;
  return score;
}

async function carregarCidadesDisponiveis() {
  const chaveCache = 'v5_geo_cidades_export';
  const cache = cidadesCache.get(chaveCache);
  if (cache && cache.expireAt > Date.now() && Array.isArray(cache.data) && cache.data.length > 0) {
    return cache.data;
  }

  const cidadesMap = new Map();
  const processarCidade = (cidadeRaw) => {
    const value = String(cidadeRaw || '').trim();
    if (!value) return;

    const labelBase = limparCidadeDisplay(value);
    const keyBase = normalizarCidadeKey(labelBase || value);
    if (!keyBase) return;

    const key = keyBase;
    const label = labelBase || value;

    const atual = cidadesMap.get(key) || {
      key,
      label,
      qualidade: -1,
      values: new Set(),
    };

    const qualidadeAtual = calcularQualidadeTexto(label);
    if (qualidadeAtual > atual.qualidade) {
      atual.label = label;
      atual.qualidade = qualidadeAtual;
    }

    atual.values.add(value);
    atual.values.add(label);
    atual.values.add(keyBase);
    cidadesMap.set(key, atual);
  };

  try {
    const arquivoGeo = path.join(process.cwd(), 'public', 'data', 'geo', 'pa-municipios.geojson');
    if (fs.existsSync(arquivoGeo)) {
      const conteudo = fs.readFileSync(arquivoGeo, 'utf8');
      const geojson = JSON.parse(conteudo);
      if (Array.isArray(geojson?.features)) {
        geojson.features.forEach(f => {
          const nomeMun = f.properties?.name || f.properties?.description;
          if (nomeMun) processarCidade(nomeMun);
        });
      }
    }
  } catch (errGeo) {
    console.warn('[Export Eleitores API] Aviso ao ler pa-municipios.geojson:', errGeo?.message);
  }

  const data = Array.from(cidadesMap.values()).map((item) => ({
    key: item.key,
    label: item.label,
    values: Array.from(item.values),
  }));

  cidadesCache.set(chaveCache, {
    expireAt: Date.now() + CIDADES_CACHE_TTL_MS,
    data,
  });

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  let clienteDesconectado = false;
  req.on('close', () => {
    clienteDesconectado = true;
  });

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const {
      status,
      search,
      liderancaId,
      lideranca_id,
      cidade,
      cidadeValues,
      excludeLiderancas = false,
      ordem = 'recentes'
    } = req.query;

    const contextoMandato = await obterContextoMandato(req, usuario, supabase);
    const liderancaFiltro = liderancaId || lideranca_id;

    const cidadeValuesArr = Array.isArray(cidadeValues)
      ? cidadeValues
      : cidadeValues
        ? [cidadeValues]
        : [];
    let cidadeValuesLimpos = cidadeValuesArr
      .map(sanitizarTermoFiltro)
      .filter(Boolean);

    // Resolução de cidade compatível com index.js
    if (cidadeValuesLimpos.length === 0 && cidade) {
      const cidadeParam = sanitizarTermoFiltro(cidade);
      const cidadeKeyParam = normalizarCidadeKey(cidadeParam);

      if (cidadeKeyParam) {
        const cidadesDisponiveis = await carregarCidadesDisponiveis();
        const cidadeOpcao = cidadesDisponiveis.find(
          (item) => item.key === cidadeKeyParam || normalizarCidadeKey(item.label) === cidadeKeyParam
        );

        if (cidadeOpcao?.values?.length) {
          cidadeValuesLimpos = cidadeOpcao.values
            .map(sanitizarTermoFiltro)
            .filter(Boolean);
        }
      }
    }

    const construirQueryBase = () => {
      let q = aplicarFiltroPertencimentoEleitor(
        aplicarFiltrosBase(
          supabase.from('eleitores').select('id, nome, telefone'),
          { status, liderancaFiltro, excludeLiderancas }
        ),
        contextoMandato
      );

      if (search && search.trim().length > 0) {
        const termo = sanitizarTermoFiltro(search);
        const qDigitos = termo.replace(/\D/g, '');
        const ehPuramenteNumerico = /^\d+$/.test(termo.replace(/[\s.\-/]/g, '')) && qDigitos.length >= 3;

        if (ehPuramenteNumerico) {
          const filtrosNumericos = [
            `cpf.eq.${qDigitos}`,
            `rg.eq.${qDigitos}`,
            `tituloEleitoral.eq.${qDigitos}`,
            `cpf.like.${qDigitos}%`,
            `rg.like.${qDigitos}%`,
            `tituloEleitoral.like.${qDigitos}%`,
            `cpf.ilike.%${qDigitos}%`,
            `rg.ilike.%${qDigitos}%`,
          ];
          q = q.or(filtrosNumericos.join(','));
        } else if (termo.length > 0) {
          const filtrosTexto = [
            `nome.ilike.%${termo}%`,
            `municipio.ilike.%${termo}%`,
            `bairro.ilike.%${termo}%`,
            `cidade.ilike.%${termo}%`,
          ];
          if (qDigitos.length >= 3) {
            filtrosTexto.push(`cpf.eq.${qDigitos}`, `rg.eq.${qDigitos}`);
          }
          q = q.or(filtrosTexto.join(','));
        }
      }

      if (cidadeValuesLimpos.length > 0) {
        const filtrosCidade = cidadeValuesLimpos
          .map((v) => `cidade.eq.${v}`)
          .concat(cidadeValuesLimpos.map((v) => `municipio.eq.${v}`));
        q = q.or(filtrosCidade.join(','));
      } else if (cidade) {
        const cLimpa = sanitizarTermoFiltro(cidade);
        q = q.or(`cidade.eq.${cLimpa},municipio.eq.${cLimpa}`);
      }

      return q;
    };

    let orderCol = 'id';
    let ascending = false;

    if (ordem === 'nome_asc' || ordem === 'alfabetica') {
      orderCol = 'nome';
      ascending = true;
    } else if (ordem === 'nome_desc') {
      orderCol = 'nome';
      ascending = false;
    } else if (ordem === 'antigos') {
      orderCol = 'id';
      ascending = true;
    } else {
      orderCol = 'id';
      ascending = false;
    }

    const dataAtual = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eleitores-${dataAtual}.csv"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // UTF-8 BOM para Excel
    res.write('\uFEFFNome,Telefone\n');

    const BATCH_SIZE = 1000;
    let offset = 0;
    let continuar = true;

    while (continuar) {
      if (clienteDesconectado || res.destroyed) {
        break;
      }

      let queryBatch = construirQueryBase()
        .range(offset, offset + BATCH_SIZE - 1)
        .order(orderCol, { ascending });

      // Ordenação secundária por id para evitar drift e duplicação/omissão entre páginas
      if (orderCol !== 'id') {
        queryBatch = queryBatch.order('id', { ascending: true });
      }

      const { data: batch, error } = await queryBatch;

      if (error) {
        console.error('[Export Eleitores API] Erro no lote:', error);
        res.destroy(new Error(`Erro ao consultar lote de eleitores: ${error.message}`));
        return;
      }

      if (!batch || batch.length === 0) {
        break;
      }

      const linhas = batch.map((el) => [
        csvEscape(el.nome),
        csvEscape(el.telefone || '')
      ].join(',')).join('\n');

      const canWrite = res.write(linhas + '\n');
      if (!canWrite && !clienteDesconectado && !res.destroyed) {
        await new Promise((resolve) => res.once('drain', resolve));
      }

      if (batch.length < BATCH_SIZE) {
        continuar = false;
      } else {
        offset += BATCH_SIZE;
      }
    }

    if (!res.destroyed && !clienteDesconectado) {
      res.end();
    }
  } catch (err) {
    console.error('[Export Eleitores API] Erro fatal:', err);
    if (!res.headersSent) {
      return res.status(err?.statusCode || 500).json({
        message: err?.message || 'Erro ao exportar eleitores'
      });
    }
    if (!res.destroyed) {
      res.destroy(err);
    }
  }
}
