# 💡 Exemplos de Uso - WhatsApp Business API

## 📤 **1. Enviar Mensagem Simples**

```javascript
// Em qualquer página ou API route
import { getWhatsAppBusinessService } from '@/services/whatsapp-business';

export default async function handler(req, res) {
  const whatsapp = getWhatsAppBusinessService();
  
  try {
    const result = await whatsapp.sendTextMessage(
      '5591988889999',
      'Olá! Esta é uma mensagem do MandatoPro.'
    );
    
    console.log('✅ Mensagem enviada:', result.messageId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Erro:', error.message);
    res.status(500).json({ error: error.message });
  }
}
```

---

## 🎂 **2. Aniversariantes - Envio Automático**

```javascript
// src/pages/api/aniversariantes/enviar-parabens.js
import { getWhatsAppBusinessService } from '@/services/whatsapp-business';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  // Buscar aniversariantes do dia
  const hoje = new Date().toISOString().split('T')[0];
  const { data: aniversariantes } = await supabase
    .from('eleitores')
    .select('nome, telefone, data_nascimento')
    .eq('data_nascimento', hoje);
  
  const whatsapp = getWhatsAppBusinessService();
  const results = [];
  
  for (const pessoa of aniversariantes) {
    try {
      const mensagem = `🎉 Parabéns, ${pessoa.nome}! 
      
Desejamos um feliz aniversário! 🎂🎈

Atenciosamente,
Equipe MandatoPro`;
      
      const result = await whatsapp.sendTextMessage(pessoa.telefone, mensagem);
      results.push({ nome: pessoa.nome, success: true });
      
      // Delay de 1 segundo entre mensagens
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      results.push({ nome: pessoa.nome, success: false, error: error.message });
    }
  }
  
  res.json({ 
    total: aniversariantes.length, 
    enviados: results.filter(r => r.success).length,
    falhas: results.filter(r => !r.success).length,
    detalhes: results 
  });
}
```

---

## 📋 **3. Solicitações - Notificação de Novo Pedido**

```javascript
// src/pages/api/solicitacoes/criar.js
import { getWhatsAppBusinessService } from '@/services/whatsapp-business';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { eleitor_id, tipo, descricao } = req.body;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  // Criar solicitação
  const { data: solicitacao } = await supabase
    .from('solicitacoes')
    .insert({ eleitor_id, tipo, descricao, status: 'pendente' })
    .select()
    .single();
  
  // Buscar dados do eleitor
  const { data: eleitor } = await supabase
    .from('eleitores')
    .select('nome, telefone')
    .eq('id', eleitor_id)
    .single();
  
  // Enviar confirmação ao eleitor
  const whatsapp = getWhatsAppBusinessService();
  
  try {
    const mensagem = `✅ Solicitação Recebida!

Olá ${eleitor.nome},

Sua solicitação foi registrada com sucesso:

📋 Tipo: ${tipo}
📝 Descrição: ${descricao}
🆔 Protocolo: #${solicitacao.id}

Em breve nossa equipe entrará em contato!

Atenciosamente,
MandatoPro`;
    
    await whatsapp.sendTextMessage(eleitor.telefone, mensagem);
    
    // Notificar equipe também
    await whatsapp.sendTextMessage(
      '5591988887777', // Número da equipe
      `🔔 Nova solicitação #${solicitacao.id} de ${eleitor.nome}`
    );
    
    res.json({ success: true, solicitacao });
  } catch (error) {
    // Mesmo com erro no WhatsApp, solicitação foi criada
    res.json({ 
      success: true, 
      solicitacao, 
      whatsapp_error: error.message 
    });
  }
}
```

---

## 📅 **4. Agenda - Lembrete de Evento**

```javascript
// src/pages/api/agenda/lembretes.js
import { getWhatsAppBusinessService } from '@/services/whatsapp-business';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  // Buscar eventos de amanhã
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const dataAmanha = amanha.toISOString().split('T')[0];
  
  const { data: eventos } = await supabase
    .from('agenda')
    .select(`
      *,
      participantes:agenda_participantes(
        eleitor_id,
        eleitores(nome, telefone)
      )
    `)
    .eq('data', dataAmanha);
  
  const whatsapp = getWhatsAppBusinessService();
  const results = [];
  
  for (const evento of eventos) {
    const mensagem = `📅 Lembrete de Evento

Olá! Lembramos que amanhã você tem:

📌 ${evento.titulo}
🕐 ${evento.horario}
📍 ${evento.local || 'Local a confirmar'}

${evento.descricao || ''}

Nos vemos lá!
Equipe MandatoPro`;
    
    for (const p of evento.participantes) {
      try {
        await whatsapp.sendTextMessage(
          p.eleitores.telefone, 
          mensagem.replace('Olá!', `Olá ${p.eleitores.nome}!`)
        );
        results.push({ nome: p.eleitores.nome, success: true });
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        results.push({ nome: p.eleitores.nome, success: false });
      }
    }
  }
  
  res.json({ 
    eventos: eventos.length,
    lembretes_enviados: results.filter(r => r.success).length,
    detalhes: results
  });
}
```

---

## 📢 **5. Comunicados - Envio em Massa**

```javascript
// src/pages/api/comunicacao/enviar-massa.js
import { getWhatsAppBusinessService } from '@/services/whatsapp-business';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { mensagem, filtro } = req.body;
  // filtro pode ser: 'todos', 'liderancas', 'cidade_X', etc.
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  // Buscar destinatários baseado no filtro
  let query = supabase.from('eleitores').select('nome, telefone');
  
  if (filtro === 'liderancas') {
    query = query.eq('tipo', 'lideranca');
  } else if (filtro.startsWith('cidade_')) {
    const cidade = filtro.replace('cidade_', '');
    query = query.eq('cidade', cidade);
  }
  
  const { data: destinatarios } = await query;
  
  const whatsapp = getWhatsAppBusinessService();
  
  // Envio em lote (respeitando limite de 1 msg/segundo)
  const results = [];
  
  for (let i = 0; i < destinatarios.length; i++) {
    const dest = destinatarios[i];
    
    try {
      // Personalizar mensagem
      const msgPersonalizada = mensagem.replace('{nome}', dest.nome);
      
      await whatsapp.sendTextMessage(dest.telefone, msgPersonalizada);
      results.push({ telefone: dest.telefone, success: true });
      
      // Delay de 1 segundo
      if (i < destinatarios.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
      
      // A cada 10 mensagens, aguarda mais tempo (evitar rate limit)
      if ((i + 1) % 10 === 0) {
        console.log(`✅ ${i + 1}/${destinatarios.length} enviadas`);
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (error) {
      results.push({ telefone: dest.telefone, success: false, error: error.message });
    }
  }
  
  res.json({
    total: destinatarios.length,
    enviados: results.filter(r => r.success).length,
    falhas: results.filter(r => !r.success).length,
    detalhes: results
  });
}
```

---

## ⏰ **6. Cron Job - Automação Diária**

```javascript
// src/pages/api/cron/daily-tasks.js
import { getWhatsAppBusinessService } from '@/services/whatsapp-business';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Verificar token de segurança (para cron jobs externos como Vercel Cron)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  const whatsapp = getWhatsAppBusinessService();
  const hoje = new Date().toISOString().split('T')[0];
  
  const tarefas = [];
  
  // 1. Aniversariantes do dia
  const { data: aniversariantes } = await supabase
    .from('eleitores')
    .select('nome, telefone')
    .eq('data_nascimento', hoje);
  
  for (const pessoa of aniversariantes) {
    try {
      await whatsapp.sendTextMessage(
        pessoa.telefone,
        `🎉 Parabéns ${pessoa.nome}! Feliz aniversário! 🎂`
      );
      tarefas.push({ tipo: 'aniversario', nome: pessoa.nome, success: true });
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      tarefas.push({ tipo: 'aniversario', nome: pessoa.nome, success: false });
    }
  }
  
  // 2. Eventos do dia
  const { data: eventos } = await supabase
    .from('agenda')
    .select('titulo, horario')
    .eq('data', hoje);
  
  if (eventos.length > 0) {
    const resumo = eventos.map(e => `• ${e.horario} - ${e.titulo}`).join('\n');
    
    // Enviar resumo para equipe
    try {
      await whatsapp.sendTextMessage(
        '5591988887777',
        `📅 Agenda de Hoje:\n\n${resumo}`
      );
      tarefas.push({ tipo: 'agenda_resumo', success: true });
    } catch (error) {
      tarefas.push({ tipo: 'agenda_resumo', success: false });
    }
  }
  
  res.json({
    executado_em: new Date().toISOString(),
    tarefas_realizadas: tarefas.length,
    sucesso: tarefas.filter(t => t.success).length,
    falhas: tarefas.filter(t => !t.success).length,
    detalhes: tarefas
  });
}
```

**Para configurar no Vercel:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/daily-tasks",
    "schedule": "0 8 * * *"
  }]
}
```

---

## 📊 **7. Verificar Status e Logs**

```javascript
// src/pages/api/whatsapp-business/info.js
import { getWhatsAppBusinessService } from '@/services/whatsapp-business';

export default async function handler(req, res) {
  const whatsapp = getWhatsAppBusinessService();
  
  const status = whatsapp.getStatus();
  
  let phoneInfo = null;
  if (status.configured) {
    try {
      phoneInfo = await whatsapp.getPhoneInfo();
    } catch (error) {
      phoneInfo = { error: error.message };
    }
  }
  
  res.json({
    status,
    phoneInfo,
    timestamp: new Date().toISOString()
  });
}
```

---

## 🎯 **Dicas de Uso:**

### ✅ **Boas Práticas:**

1. **Sempre use delay entre mensagens**
   ```javascript
   await new Promise(r => setTimeout(r, 1000)); // 1 segundo
   ```

2. **Personalizar mensagens**
   ```javascript
   const msg = `Olá ${nome}! ...`;
   ```

3. **Tratamento de erros**
   ```javascript
   try {
     await whatsapp.sendTextMessage(...);
   } catch (error) {
     console.error('Falha ao enviar:', error.message);
     // Salvar em log para retry depois
   }
   ```

4. **Rate limiting**
   - Máximo 80 mensagens/hora no tier gratuito
   - 1 mensagem/segundo é seguro
   - A cada 10 mensagens, pause 3 segundos

5. **Monitorar custos**
   - Acesse: Meta for Developers → WhatsApp → Analytics
   - 1.000 conversas grátis/mês
   - Depois: ~R$ 0,30 por conversa no Brasil

---

## 🚀 **Pronto para usar!**

Escolha o exemplo que se adequa ao seu caso e adapte conforme necessário!
