# Checklist de Integração de Logs - MandatoPro

## ✅ PÁGINAS JÁ INTEGRADAS

### Autenticação
- [x] `src/pages/login.js` - registrarLogin(), registrarErro()
- [x] `src/components/Sidebar.js` - registrarLogout()

### Dashboard
- [x] `src/pages/dashboard.js` - useRegistrarAcesso()

### Cadastros - Eleitores
- [x] `src/pages/cadastros/eleitores/novo.js` - useRegistrarAcesso(), registrarCadastro(), registrarErro()
- [ ] `src/pages/cadastros/eleitores/index.js` - useRegistrarAcesso()
- [ ] `src/pages/cadastros/eleitores/[id].js` - useRegistrarAcesso(), registrarEdicao(), registrarDelecao()

---

## ⬜ PÁGINAS PENDENTES DE INTEGRAÇÃO

### Cadastros - Lideranças (3)
- [ ] `src/pages/cadastros/liderancas/novo.js`
  - Adicionar: useRegistrarAcesso, registrarCadastro, registrarErro
- [ ] `src/pages/cadastros/liderancas/index.js`
  - Adicionar: useRegistrarAcesso
- [ ] `src/pages/cadastros/liderancas/[id].js`
  - Adicionar: useRegistrarAcesso, registrarEdicao, registrarDelecao

### Cadastros - Funcionários (3)
- [ ] `src/pages/cadastros/funcionarios/novo.js`
  - Adicionar: useRegistrarAcesso, registrarCadastro, registrarErro
- [ ] `src/pages/cadastros/funcionarios/index.js`
  - Adicionar: useRegistrarAcesso
- [ ] `src/pages/cadastros/funcionarios/[id].js`
  - Adicionar: useRegistrarAcesso, registrarEdicao, registrarDelecao

### Cadastros - Atendimentos (3)
- [ ] `src/pages/cadastros/atendimentos/novo.js`
  - Adicionar: useRegistrarAcesso, registrarCadastro, registrarErro
- [ ] `src/pages/cadastros/atendimentos/index.js`
  - Adicionar: useRegistrarAcesso
- [ ] `src/pages/cadastros/atendimentos/[id].js`
  - Adicionar: useRegistrarAcesso, registrarEdicao, registrarDelecao

### Emendas (Variável - conforme arquivos existam)
- [ ] `src/pages/emendas/emendas/novo.js`
- [ ] `src/pages/emendas/emendas/[id].js` (se existir)
- [ ] `src/pages/emendas/emendas/index.js`
- [ ] `src/pages/emendas/orgaos/novo.js`
- [ ] `src/pages/emendas/orgaos/[id].js` (se existir)
- [ ] `src/pages/emendas/orgaos/index.js`
- [ ] `src/pages/emendas/responsaveis/novo.js`
- [ ] `src/pages/emendas/responsaveis/[id].js` (se existir)
- [ ] `src/pages/emendas/responsaveis/index.js`
- [ ] `src/pages/emendas/repasses/novo.js`
- [ ] `src/pages/emendas/repasses/[id].js` (se existir)
- [ ] `src/pages/emendas/repasses/index.js`

### Financeiro (Variável - conforme arquivos existam)
- [ ] `src/pages/financeiro/lancamentos/novo.js`
- [ ] `src/pages/financeiro/lancamentos/index.js`
- [ ] `src/pages/financeiro/despesas/novo.js`
- [ ] `src/pages/financeiro/despesas/index.js`
- [ ] `src/pages/financeiro/caixa/index.js`
- [ ] `src/pages/financeiro/doadores/novo.js`
- [ ] `src/pages/financeiro/doadores/index.js`
- [ ] `src/pages/financeiro/relatorios/index.js`

### Geolocalização (1)
- [ ] `src/pages/geolocalizacao/index.js`
  - Adicionar: useRegistrarAcesso

### Comunicação (1)
- [ ] `src/pages/comunicacao/index.js`
  - Adicionar: useRegistrarAcesso, registrarExportacao (para disparo de mensagens)

### Agenda (3)
- [ ] `src/pages/agenda/novo.js`
  - Adicionar: useRegistrarAcesso, registrarCadastro, registrarErro
- [ ] `src/pages/agenda/[id].js`
  - Adicionar: useRegistrarAcesso, registrarEdicao, registrarDelecao
- [ ] `src/pages/agenda/index.js`
  - Adicionar: useRegistrarAcesso

### Aniversariantes (2)
- [ ] `src/pages/aniversariantes/index.js`
  - Adicionar: useRegistrarAcesso
- [ ] `src/pages/aniversariantes/configuracoes.js`
  - Adicionar: useRegistrarAcesso, registrarConfiguracao

### Solicitações (5)
- [ ] `src/pages/solicitacoes/novo.js`
  - Adicionar: useRegistrarAcesso, registrarCadastro, registrarErro
- [ ] `src/pages/solicitacoes/[id].js`
  - Adicionar: useRegistrarAcesso, registrarEdicao, registrarDelecao
- [ ] `src/pages/solicitacoes/index.js`
  - Adicionar: useRegistrarAcesso
- [ ] `src/pages/solicitacoes/atendidos.js`
  - Adicionar: useRegistrarAcesso
- [ ] `src/pages/solicitacoes/recusados.js`
  - Adicionar: useRegistrarAcesso

### Usuários (3)
- [ ] `src/pages/usuarios/novo.js`
  - Adicionar: useRegistrarAcesso, registrarCadastro, registrarErro
- [ ] `src/pages/usuarios/[id].js`
  - Adicionar: useRegistrarAcesso, registrarEdicao, registrarDelecao
- [ ] `src/pages/usuarios/index.js`
  - Adicionar: useRegistrarAcesso

### Configurações (1)
- [ ] `src/pages/configuracoes/sistema.js`
  - Adicionar: useRegistrarAcesso, registrarConfiguracao

### Auditoria (1)
- [x] `src/pages/auditoria/logs.js` - Página de visualização de logs ✅

---

## 📊 RESUMO

**Total de páginas a integrar:** ~40 páginas  
**Já integradas:** 4 páginas (10%)  
**Tempo estimado:** 3-4 horas para integração completa

### Por Categoria:
- Autenticação: 2/2 ✅
- Dashboard: 1/1 ✅
- Cadastros: 1/9 ⬜
- Emendas: 0/8 ⬜
- Financeiro: 0/8 ⬜
- Geolocalização: 0/1 ⬜
- Comunicação: 0/1 ⬜
- Agenda: 0/3 ⬜
- Aniversariantes: 0/2 ⬜
- Solicitações: 0/5 ⬜
- Usuários: 0/3 ⬜
- Configurações: 0/1 ⬜

---

## 🔧 COMO USAR ESTE CHECKLIST

1. **Para cada página não marcada:**
   - Abra o arquivo
   - Siga o padrão de integração de `src/pages/cadastros/eleitores/novo.js`
   - Marque com `[x]` quando terminar

2. **Prioridade recomendada:**
   1. Primeira: Páginas de novo cadastro (novo.js)
   2. Segunda: Páginas de índice (index.js)
   3. Terceira: Páginas de edição ([id].js)

3. **Teste após cada integração:**
   - Faça uma ação na página
   - Vá para Auditoria → Logs
   - Verifique se o evento aparece

---

## 📝 TEMPLATE RÁPIDO DE INTEGRAÇÃO

Para copiar e colar em qualquer página:

```javascript
// Imports (adicionar ao topo)
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';
import { registrarCadastro, registrarEdicao, registrarDelecao, registrarErro } from '@/services/logService';

export default function MinhaPage() {
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(usuarioData);
  }, []);

  // Registra acesso à página
  useRegistrarAcesso(usuario, 'MODULO_NOME', 'Nome da Página');

  // Resto do componente...
}
```

---

## 🎯 META

**Objetivo:** Integrar logs em 100% das páginas do sistema  
**Deadline sugerido:** Final desta semana  
**Responsável:** Equipe de desenvolvimento

---

**Última atualização:** Novembro 2024
