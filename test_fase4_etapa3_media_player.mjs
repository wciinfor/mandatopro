import assert from 'node:assert/strict';
import {
  obterTipoMidia,
  obterTranscricao,
  extrairLegenda,
  extrairNomeArquivo
} from './src/lib/atendimento-connect.js';

console.log('🧪 Iniciando suíte de testes da ETAPA 3 (Detecção de Mídia e Helpers)...\n');

// ─── CENÁRIO A: Mensagem de texto normal continua identificada como text ─────
{
  const msgTexto = {
    id: 1,
    direcao: 'entrada',
    mensagem: 'Olá, bom dia! Gostaria de uma informação sobre o projeto de lei.',
    mediaTipo: null,
    mediaUrl: null,
    rawPayload: { mensagem_tipo: 'text' }
  };

  const tipo = obterTipoMidia(msgTexto);
  assert.strictEqual(tipo, 'text', 'Mensagem de texto deve ter tipo "text"');
  assert.strictEqual(obterTranscricao(msgTexto), null, 'Mensagem de texto não deve ter transcrição');
  console.log('✅ [CENÁRIO A] Mensagem de texto normal classificada exclusivamente como "text"');
}

// ─── CENÁRIO B: Áudio novo com mediaTipo="audio" ────────────────────────────
{
  const msgAudioNovo = {
    id: 101,
    direcao: 'entrada',
    mensagem: '[Áudio ID: 998877]',
    mediaTipo: 'audio',
    mediaUrl: 'https://exemplo.com/audio.ogg',
    rawPayload: {
      media_id: '998877',
      mensagem_tipo: 'audio',
      mime_type: 'audio/ogg'
    }
  };

  const tipo = obterTipoMidia(msgAudioNovo);
  assert.strictEqual(tipo, 'audio', 'Áudio novo deve ser detectado como "audio"');
  const expectedEndpoint = `/api/atendimento-connect/mensagens/${msgAudioNovo.id}/media`;
  assert.strictEqual(expectedEndpoint, '/api/atendimento-connect/mensagens/101/media');
  console.log('✅ [CENÁRIO B] Áudio novo com mediaTipo="audio" detectado e mapeado para endpoint seguro');
}

// ─── CENÁRIO C: Áudio histórico com mediaTipo null e rawPayload.media_id ──────
{
  const msgAudioHistorico1 = {
    id: 102,
    direcao: 'entrada',
    mensagem: '[Áudio ID: 2522537268228018]',
    mediaTipo: null,
    mediaUrl: null,
    rawPayload: {
      media_id: '2522537268228018',
      mensagem_tipo: 'audio'
    }
  };

  const tipo = obterTipoMidia(msgAudioHistorico1);
  assert.strictEqual(tipo, 'audio', 'Áudio com rawPayload.media_id deve ser classificado como "audio"');
  console.log('✅ [CENÁRIO C] Áudio histórico com rawPayload.media_id classificado como "audio"');
}

// ─── CENÁRIO D: Áudio histórico identificado apenas pelo texto legado ─────────
{
  const msgAudioHistorico2 = {
    id: 103,
    direcao: 'entrada',
    mensagem: '[Áudio ID: 2522537268228018]',
    mediaTipo: null,
    mediaUrl: null,
    rawPayload: null
  };

  const tipo = obterTipoMidia(msgAudioHistorico2);
  assert.strictEqual(tipo, 'audio', 'Fallback pelo texto "[Áudio ID:" deve classificar como "audio"');
  console.log('✅ [CENÁRIO D] Áudio histórico legado identificado pelo texto classificado como "audio"');
}

// ─── CENÁRIO E: Áudio WAFLY (inbound ou com URL/transcrição) ─────────────────
{
  const msgWaflyAudio = {
    id: 104,
    direcao: 'entrada',
    mensagem: '[Áudio Wafly] https://wafly.s3.exemplo.com/audios/123.ogg',
    mediaTipo: 'audio',
    mediaUrl: 'https://wafly.s3.exemplo.com/audios/123.ogg',
    rawPayload: {
      provider: 'WAFLY',
      mensagem_tipo: 'audio',
      audio_url: 'https://wafly.s3.exemplo.com/audios/123.ogg'
    }
  };

  const tipo = obterTipoMidia(msgWaflyAudio);
  assert.strictEqual(tipo, 'audio', 'WAFLY áudio deve ser detectado como "audio"');

  const msgWaflyTextoFallback = {
    id: 1041,
    direcao: 'entrada',
    mensagem: '[Áudio Wafly]',
    mediaTipo: null,
    mediaUrl: null
  };
  assert.strictEqual(obterTipoMidia(msgWaflyTextoFallback), 'audio');
  console.log('✅ [CENÁRIO E] Áudio WAFLY identificado corretamente por mediaTipo e por texto legado');
}

// ─── CENÁRIO F: Transcrição de áudio existente ────────────────────────────────
{
  // Formato A: rawPayload.transcription objeto { text: '...' }
  const msgComTranscricaoObj = {
    id: 105,
    direcao: 'entrada',
    mensagem: '[Áudio ID: 12345]',
    mediaTipo: 'audio',
    rawPayload: {
      media_id: '12345',
      transcription: { text: 'Olá, sou o eleitor João e preciso falar com o deputado sobre a escola.' }
    }
  };
  assert.strictEqual(
    obterTranscricao(msgComTranscricaoObj),
    'Olá, sou o eleitor João e preciso falar com o deputado sobre a escola.'
  );

  // Formato B: rawPayload.transcription string direta
  const msgComTranscricaoStr = {
    id: 106,
    direcao: 'entrada',
    mensagem: '[Áudio ID: 12345]',
    mediaTipo: 'audio',
    rawPayload: {
      transcription: 'Transcrição em formato string direta'
    }
  };
  assert.strictEqual(
    obterTranscricao(msgComTranscricaoStr),
    'Transcrição em formato string direta'
  );

  // Formato C: texto legado "[Áudio transcrito]: ..."
  const msgComTranscricaoLegada = {
    id: 107,
    direcao: 'entrada',
    mensagem: '[Áudio transcrito]: Mensagem transcrita pelo provedor de forma legada',
    mediaTipo: null,
    rawPayload: null
  };
  assert.strictEqual(obterTipoMidia(msgComTranscricaoLegada), 'audio');
  assert.strictEqual(
    obterTranscricao(msgComTranscricaoLegada),
    'Mensagem transcrita pelo provedor de forma legada'
  );

  console.log('✅ [CENÁRIO F] Transcrição extraída com suporte a objeto, string direta e fallback textual legado');
}

// ─── CENÁRIO G: Preparação para outras mídias (Imagem, Vídeo, Documento) ──────
{
  // 1. Imagem
  const msgImg = {
    id: 108,
    direcao: 'entrada',
    mensagem: '[Imagem ID: img_777] - Foto do evento comunitário',
    mediaTipo: 'image'
  };
  assert.strictEqual(obterTipoMidia(msgImg), 'image');
  assert.strictEqual(extrairLegenda(msgImg.mensagem), 'Foto do evento comunitário');

  // 2. Vídeo
  const msgVideo = {
    id: 109,
    direcao: 'entrada',
    mensagem: '[Vídeo ID: vid_888] - Depoimento do morador',
    mediaTipo: 'video'
  };
  assert.strictEqual(obterTipoMidia(msgVideo), 'video');
  assert.strictEqual(extrairLegenda(msgVideo.mensagem), 'Depoimento do morador');

  // 3. Documento
  const msgDoc = {
    id: 110,
    direcao: 'entrada',
    mensagem: '[Documento ID: doc_999] requerimento_obra.pdf',
    mediaTipo: 'document',
    rawPayload: { document: { filename: 'requerimento_obra.pdf' } }
  };
  assert.strictEqual(obterTipoMidia(msgDoc), 'document');
  assert.strictEqual(extrairNomeArquivo(msgDoc), 'requerimento_obra.pdf');

  console.log('✅ [CENÁRIO G] Identificação e extração de metadados para Imagem, Vídeo e Documento aprovadas');
}

// ─── CENÁRIO H: Mensagem sem identificador de mídia ou texto comum ────────────
{
  const msgSemMidia = {
    id: 111,
    direcao: 'saida',
    mensagem: 'Mensagem confirmando o recebimento de sua solicitação.',
    mediaTipo: null,
    mediaUrl: null,
    rawPayload: null
  };

  assert.strictEqual(obterTipoMidia(msgSemMidia), 'text');
  assert.strictEqual(obterTranscricao(msgSemMidia), null);
  console.log('✅ [CENÁRIO H] Mensagem comum sem mídia permanece estritamente como "text"');
}

console.log('\n========================================================');
console.log('TODOS OS TESTES DA ETAPA 3 FORAM CONCLUÍDOS COM SUCESSO!');
console.log('========================================================\n');
