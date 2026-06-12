/**
 * InboxDashboard — Fase 6
 * Dashboard operacional do inbox multiatendente.
 *
 * Responsabilidades:
 *  - Exibir métricas em tempo real (polling 30s)
 *  - Conversas por status, agentes online, SLA, volume, IA
 *  - Filtros por período (hoje / 7d / 30d / personalizado)
 *  - Alertas ativos do workspace
 *
 * Dependências: window.InboxApi
 */
const InboxDashboard = (() => {
  // ── Estado ───────────────────────────────────────────────────

  let _container   = null;
  let _pollTimer   = null;
  let _lastData    = null;
  let _period      = '30d'; // 'today' | '7d' | '30d'

  const POLL_MS = 30_000;

  // ── Escape XSS ───────────────────────────────────────────────

  function _esc(v) {
    if (v === null || v === undefined) return '—';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Cálculo do período ────────────────────────────────────────

  function _buildQuery() {
    const to  = new Date();
    let   from;
    switch (_period) {
      case 'today': from = new Date(to); from.setHours(0, 0, 0, 0); break;
      case '7d':    from = new Date(to.getTime() - 7  * 86_400_000); break;
      default:      from = new Date(to.getTime() - 30 * 86_400_000);
    }
    return { from: from.toISOString(), to: to.toISOString() };
  }

  // ── Formatadores ──────────────────────────────────────────────

  function _fmtMin(minutes) {
    if (minutes === null || minutes === undefined) return '—';
    const m = Math.round(minutes);
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h}h ${r}min` : `${h}h`;
  }

  function _fmtNum(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('pt-BR');
  }

  // ── Barra de progresso simples ────────────────────────────────

  function _bar(pct, color) {
    const w = Math.max(0, Math.min(100, pct ?? 0));
    return `<div class="dash-bar-track"><div class="dash-bar-fill" style="width:${w}%;background:${_esc(color)}"></div></div>`;
  }

  // ── Render: cards de status ───────────────────────────────────

  function _renderStatusCards(sc) {
    const total = (sc.open + sc.pending + sc.waiting) || 1;
    return `
      <div class="dash-section">
        <h3 class="dash-section-title">📊 Conversas — Estado atual</h3>
        <div class="dash-cards-row">
          <div class="dash-card dash-card--open">
            <span class="dash-card-value">${_fmtNum(sc.open)}</span>
            <span class="dash-card-label">Abertas</span>
          </div>
          <div class="dash-card dash-card--pending">
            <span class="dash-card-value">${_fmtNum(sc.pending)}</span>
            <span class="dash-card-label">Pendentes</span>
          </div>
          <div class="dash-card dash-card--waiting">
            <span class="dash-card-value">${_fmtNum(sc.waiting)}</span>
            <span class="dash-card-label">Aguardando</span>
          </div>
          <div class="dash-card dash-card--closed">
            <span class="dash-card-value">${_fmtNum(sc.closed)}</span>
            <span class="dash-card-label">Fechadas (hoje)</span>
          </div>
        </div>
        ${_bar((sc.open / total) * 100, 'var(--dash-color-open)')}
      </div>
    `;
  }

  // ── Render: agentes ───────────────────────────────────────────

  function _renderAgents(agents, onlineCount) {
    const rows = agents.slice(0, 10).map((a) => `
      <tr>
        <td>
          <span class="dash-agent-dot ${a.is_online ? 'dash-agent-dot--online' : 'dash-agent-dot--offline'}"></span>
          ${_esc(a.display_name ?? 'Agente')}
        </td>
        <td class="dash-td-num">${_fmtNum(a.open_count)}</td>
        <td>${a.is_online ? '<span class="dash-badge--online">online</span>' : '<span class="dash-badge--offline">offline</span>'}</td>
      </tr>
    `).join('');

    return `
      <div class="dash-section">
        <h3 class="dash-section-title">👥 Agentes — ${_fmtNum(onlineCount)} online</h3>
        <div class="dash-table-wrap">
          <table class="dash-table">
            <thead><tr><th>Agente</th><th>Conversas</th><th>Status</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="3" class="dash-empty">Nenhum agente cadastrado</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Render: SLA ───────────────────────────────────────────────

  function _renderSla(sla) {
    const breachPct = Math.round(sla.breach_rate_pct ?? 0);
    const breachColor = breachPct > 30 ? '#ef4444' : breachPct > 10 ? '#f59e0b' : '#22c55e';
    return `
      <div class="dash-section">
        <h3 class="dash-section-title">⏱ SLA — Período selecionado</h3>
        <div class="dash-cards-row">
          <div class="dash-card">
            <span class="dash-card-value">${_fmtMin(sla.avg_first_response_minutes)}</span>
            <span class="dash-card-label">Tempo médio 1ª resposta</span>
          </div>
          <div class="dash-card">
            <span class="dash-card-value">${_fmtMin(sla.avg_resolution_minutes)}</span>
            <span class="dash-card-label">Tempo médio resolução</span>
          </div>
          <div class="dash-card ${breachPct > 20 ? 'dash-card--warn' : ''}">
            <span class="dash-card-value">${breachPct}%</span>
            <span class="dash-card-label">Taxa de breach SLA</span>
          </div>
          <div class="dash-card">
            <span class="dash-card-value">${_fmtNum(sla.sla_first_response_breach_count + sla.sla_resolution_breach_count)}</span>
            <span class="dash-card-label">Breaches no período</span>
          </div>
        </div>
        ${_bar(breachPct, breachColor)}
      </div>
    `;
  }

  // ── Render: volume por hora (gráfico de barras CSS) ───────────

  function _renderHourlyVolume(hourly) {
    if (!hourly || hourly.length === 0) {
      return `<div class="dash-section"><h3 class="dash-section-title">📈 Volume por hora (24h)</h3><p class="dash-empty">Sem dados</p></div>`;
    }

    const max = Math.max(...hourly.map((h) => h.count), 1);
    const bars = hourly.map((h) => {
      const pct   = Math.round((h.count / max) * 100);
      const label = h.hour.slice(11, 13) + 'h';
      return `
        <div class="dash-hbar-col">
          <span class="dash-hbar-count">${h.count}</span>
          <div class="dash-hbar-fill" style="height:${pct}%" title="${_esc(h.hour)}: ${h.count} msgs"></div>
          <span class="dash-hbar-label">${_esc(label)}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="dash-section">
        <h3 class="dash-section-title">📈 Volume de mensagens — últimas 24h</h3>
        <div class="dash-hbar-chart">${bars}</div>
      </div>
    `;
  }

  // ── Render: departamentos ─────────────────────────────────────

  function _renderDepartments(depts) {
    if (!depts || depts.length === 0) return '';
    const total = depts.reduce((s, d) => s + d.count, 0) || 1;
    const rows  = depts.slice(0, 8).map((d) => {
      const pct = Math.round((d.count / total) * 100);
      return `
        <div class="dash-dept-row">
          <span class="dash-dept-name">${_esc(d.department_name ?? 'Sem departamento')}</span>
          <div class="dash-bar-track dash-bar-track--sm">
            <div class="dash-bar-fill" style="width:${pct}%;background:var(--dash-color-dept)"></div>
          </div>
          <span class="dash-dept-count">${d.count}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="dash-section">
        <h3 class="dash-section-title">🏢 Volume por departamento</h3>
        <div class="dash-dept-list">${rows}</div>
      </div>
    `;
  }

  // ── Render: métricas de IA ────────────────────────────────────

  function _renderAi(ai) {
    const total   = (ai.sentiment_distribution.positivo + ai.sentiment_distribution.neutro + ai.sentiment_distribution.negativo) || 1;
    const posPct  = Math.round((ai.sentiment_distribution.positivo / total) * 100);
    const negPct  = Math.round((ai.sentiment_distribution.negativo / total) * 100);
    const neuPct  = 100 - posPct - negPct;

    const leadScore = ai.avg_lead_score !== null ? ai.avg_lead_score : null;
    const leadColor = leadScore >= 70 ? '#22c55e' : leadScore >= 40 ? '#f59e0b' : '#6b7280';

    return `
      <div class="dash-section">
        <h3 class="dash-section-title">🤖 Métricas de IA</h3>
        <div class="dash-cards-row">
          <div class="dash-card">
            <span class="dash-card-value" style="color:${leadScore !== null ? leadColor : ''}">
              ${leadScore !== null ? leadScore + '/100' : '—'}
            </span>
            <span class="dash-card-label">Lead score médio</span>
          </div>
          <div class="dash-card">
            <span class="dash-card-value" style="color:${posPct > negPct ? '#22c55e' : '#ef4444'}">
              ${ai.avg_sentiment_score !== null ? (ai.avg_sentiment_score > 0 ? '+' : '') + ai.avg_sentiment_score : '—'}
            </span>
            <span class="dash-card-label">Score sentimento médio</span>
          </div>
        </div>
        <div class="dash-sentiment-bar">
          <div style="width:${posPct}%;background:#22c55e" title="Positivo: ${ai.sentiment_distribution.positivo}"></div>
          <div style="width:${neuPct}%;background:#94a3b8" title="Neutro: ${ai.sentiment_distribution.neutro}"></div>
          <div style="width:${negPct}%;background:#ef4444" title="Negativo: ${ai.sentiment_distribution.negativo}"></div>
        </div>
        <div class="dash-sentiment-legend">
          <span>😊 ${ai.sentiment_distribution.positivo} positivos</span>
          <span>😐 ${ai.sentiment_distribution.neutro} neutros</span>
          <span>😠 ${ai.sentiment_distribution.negativo} negativos</span>
        </div>
      </div>
    `;
  }

  // ── Render: alertas ───────────────────────────────────────────

  function _renderAlerts(alerts) {
    if (!alerts || alerts.length === 0) return '';

    const ALERT_ICONS = {
      sla_first_response_breach: '⏰',
      sla_resolution_breach:     '🚨',
      agent_overloaded:          '👤',
      queue_growing:             '📈',
      webhook_failing:           '🔌',
      instance_disconnected:     '📵',
    };

    const rows = alerts.slice(0, 5).map((a) => `
      <div class="dash-alert dash-alert--${_esc(a.severity)}">
        <span class="dash-alert-icon">${ALERT_ICONS[a.alert_type] ?? '⚠️'}</span>
        <div class="dash-alert-content">
          <strong>${_esc(a.title)}</strong>
          <span>${_esc(a.message)}</span>
        </div>
        <button class="btn btn-sm dash-alert-resolve"
                data-alert-id="${_esc(a.id)}"
                title="Marcar como resolvido">✓</button>
      </div>
    `).join('');

    return `
      <div class="dash-section dash-section--alerts">
        <h3 class="dash-section-title">🔔 Alertas ativos</h3>
        <div class="dash-alerts-list">${rows}</div>
      </div>
    `;
  }

  // ── Render principal ──────────────────────────────────────────

  function _render(data, alerts) {
    const genAt = data?.generated_at
      ? new Date(data.generated_at).toLocaleTimeString('pt-BR')
      : '—';

    const periodOptions = [
      { v: 'today', l: 'Hoje' },
      { v: '7d',    l: '7 dias' },
      { v: '30d',   l: '30 dias' },
    ].map((o) => `<option value="${o.v}" ${_period === o.v ? 'selected' : ''}>${o.l}</option>`).join('');

    return `
      <div class="dash-inner">
        <div class="dash-header">
          <h2 class="dash-title">📊 Dashboard Operacional</h2>
          <div class="dash-controls">
            <select class="dash-period-select" data-action="period">${periodOptions}</select>
            <button class="btn btn-sm dash-refresh-btn" data-action="refresh" title="Atualizar agora">🔄</button>
            <span class="dash-gen-at">Atualizado às ${genAt}</span>
          </div>
        </div>

        ${data ? `
          ${_renderStatusCards(data.status_counts)}
          ${_renderAgents(data.agent_workload, data.agents_online)}
          ${_renderSla(data.sla)}
          ${_renderHourlyVolume(data.hourly_volume)}
          ${_renderDepartments(data.department_volume)}
          ${_renderAi(data.ai)}
          ${_renderAlerts(alerts)}
        ` : '<div class="dash-loading"><div class="ai-panel-spinner"></div><p>Carregando métricas...</p></div>'}
      </div>
    `;
  }

  // ── Polling ───────────────────────────────────────────────────

  function _stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  function _startPolling() {
    _stopPolling();
    _pollTimer = setInterval(() => { _loadData(); }, POLL_MS);
  }

  async function _loadData() {
    if (!_container) return;
    try {
      const q    = _buildQuery();
      const wid  = await window.ApiService.getWorkspaceId();

      const [metricsRes, alertsRes] = await Promise.all([
        window.ApiService.request('GET',
          `/api/v1/workspaces/${wid}/inbox/dashboard?from=${encodeURIComponent(q.from)}&to=${encodeURIComponent(q.to)}`),
        window.ApiService.request('GET',
          `/api/v1/workspaces/${wid}/inbox/alerts?resolved=false&limit=10`),
      ]);

      _lastData = metricsRes?.data ?? null;
      const alerts = alertsRes?.data ?? [];

      _container.innerHTML = _render(_lastData, alerts);
      _bindEvents(alerts);
    } catch (err) {
      console.error('[InboxDashboard] Erro ao carregar:', err);
    }
  }

  function _bindEvents(alerts) {
    if (!_container) return;

    // Seletor de período
    const sel = _container.querySelector('[data-action="period"]');
    if (sel) {
      sel.addEventListener('change', (e) => {
        _period = e.target.value;
        _loadData();
      });
    }

    // Botão atualizar
    const refreshBtn = _container.querySelector('[data-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => _loadData());
    }

    // Resolver alertas
    _container.querySelectorAll('.dash-alert-resolve').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const alertId = btn.dataset.alertId;
        if (!alertId) return;
        try {
          const wid = await window.ApiService.getWorkspaceId();
          await window.ApiService.request('POST', `/api/v1/workspaces/${wid}/inbox/alerts/${alertId}/resolve`);
          _loadData(); // recarrega
        } catch (err) {
          console.error('[InboxDashboard] Erro ao resolver alerta:', err);
        }
      });
    });
  }

  // ── API pública ───────────────────────────────────────────────

  function init(containerId = 'inbox-dashboard-container') {
    _container = document.getElementById(containerId);
    if (!_container) {
      console.warn(`[InboxDashboard] Elemento #${containerId} não encontrado`);
      return;
    }
    _container.innerHTML = _render(null, []);
    _loadData();
    _startPolling();
  }

  function destroy() {
    _stopPolling();
    _container = null;
    _lastData  = null;
  }

  function refresh() {
    _loadData();
  }

  return { init, destroy, refresh };
})();

window.InboxDashboard = InboxDashboard;
