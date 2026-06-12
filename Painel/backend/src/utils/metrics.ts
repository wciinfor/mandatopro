// ──────────────────────────────────────────────────────────────
// METRICS REGISTRY — Fase 7
//
// Registry simples de métricas em memória compatível com o formato
// de texto do Prometheus. Sem dependência de bibliotecas externas.
//
// Tipos suportados:
//   Counter   — valor que só cresce (ex: total de requests)
//   Gauge     — valor que pode subir ou descer (ex: conexões ativas)
//   Histogram — distribuição de valores (ex: latência de requests)
//
// Uso:
//   metrics.counter('http_requests_total').inc({ method: 'GET', status: '200' });
//   metrics.gauge('ws_connections').set(42);
//   metrics.histogram('http_duration_ms').observe(150, { path: '/health' });
//
// Endpoint: GET /metrics retorna Prometheus text format
// ──────────────────────────────────────────────────────────────

type LabelSet = Record<string, string>;

function labelsKey(labels?: LabelSet): string {
  if (!labels || Object.keys(labels).length === 0) return '__default__';
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
}

function serializeLabels(labels?: LabelSet): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  const pairs = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
    .join(',');
  return `{${pairs}}`;
}

// ── Counter ────────────────────────────────────────────────────

class Counter {
  private readonly _name: string;
  private readonly _help: string;
  private readonly _values = new Map<string, { labels?: LabelSet; value: number }>();

  constructor(name: string, help: string) {
    this._name = name;
    this._help = help;
  }

  inc(labels?: LabelSet, amount = 1): void {
    const key = labelsKey(labels);
    const entry = this._values.get(key);
    if (entry) {
      entry.value += amount;
    } else {
      this._values.set(key, { labels, value: amount });
    }
  }

  toText(): string {
    const lines: string[] = [
      `# HELP ${this._name} ${this._help}`,
      `# TYPE ${this._name} counter`,
    ];
    for (const { labels, value } of this._values.values()) {
      lines.push(`${this._name}${serializeLabels(labels)} ${value}`);
    }
    return lines.join('\n');
  }
}

// ── Gauge ──────────────────────────────────────────────────────

class Gauge {
  private readonly _name: string;
  private readonly _help: string;
  private readonly _values = new Map<string, { labels?: LabelSet; value: number }>();

  constructor(name: string, help: string) {
    this._name = name;
    this._help = help;
  }

  set(value: number, labels?: LabelSet): void {
    const key = labelsKey(labels);
    this._values.set(key, { labels, value });
  }

  inc(labels?: LabelSet, amount = 1): void {
    const key   = labelsKey(labels);
    const entry = this._values.get(key);
    this._values.set(key, { labels, value: (entry?.value ?? 0) + amount });
  }

  dec(labels?: LabelSet, amount = 1): void {
    const key   = labelsKey(labels);
    const entry = this._values.get(key);
    this._values.set(key, { labels, value: (entry?.value ?? 0) - amount });
  }

  toText(): string {
    const lines: string[] = [
      `# HELP ${this._name} ${this._help}`,
      `# TYPE ${this._name} gauge`,
    ];
    for (const { labels, value } of this._values.values()) {
      lines.push(`${this._name}${serializeLabels(labels)} ${value}`);
    }
    return lines.join('\n');
  }
}

// ── Histogram ──────────────────────────────────────────────────

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

class Histogram {
  private readonly _name:    string;
  private readonly _help:    string;
  private readonly _buckets: number[];
  private readonly _data = new Map<string, {
    labels?:  LabelSet;
    counts:   number[];
    sum:      number;
    count:    number;
  }>();

  constructor(name: string, help: string, buckets: number[] = DEFAULT_BUCKETS) {
    this._name    = name;
    this._help    = help;
    this._buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(value: number, labels?: LabelSet): void {
    const key = labelsKey(labels);
    let entry = this._data.get(key);
    if (!entry) {
      entry = { labels, counts: new Array(this._buckets.length).fill(0), sum: 0, count: 0 };
      this._data.set(key, entry);
    }
    entry.sum += value;
    entry.count++;
    for (let i = 0; i < this._buckets.length; i++) {
      if (value <= this._buckets[i]) entry.counts[i]++;
    }
  }

  toText(): string {
    const lines: string[] = [
      `# HELP ${this._name} ${this._help}`,
      `# TYPE ${this._name} histogram`,
    ];
    for (const { labels, counts, sum, count } of this._data.values()) {
      const lblStr = serializeLabels(labels);
      // Buckets cumulativos
      let cumulative = 0;
      for (let i = 0; i < this._buckets.length; i++) {
        cumulative += counts[i];
        lines.push(`${this._name}_bucket{le="${this._buckets[i]}"${lblStr ? ',' + lblStr.slice(1, -1) : ''}} ${cumulative}`);
      }
      lines.push(`${this._name}_bucket{le="+Inf"${lblStr ? ',' + lblStr.slice(1, -1) : ''}} ${count}`);
      lines.push(`${this._name}_sum${lblStr} ${sum}`);
      lines.push(`${this._name}_count${lblStr} ${count}`);
    }
    return lines.join('\n');
  }
}

// ── Registry ───────────────────────────────────────────────────

class MetricsRegistry {
  private readonly _counters   = new Map<string, Counter>();
  private readonly _gauges     = new Map<string, Gauge>();
  private readonly _histograms = new Map<string, Histogram>();

  counter(name: string, help = ''): Counter {
    if (!this._counters.has(name)) this._counters.set(name, new Counter(name, help));
    return this._counters.get(name)!;
  }

  gauge(name: string, help = ''): Gauge {
    if (!this._gauges.has(name)) this._gauges.set(name, new Gauge(name, help));
    return this._gauges.get(name)!;
  }

  histogram(name: string, help = '', buckets?: number[]): Histogram {
    if (!this._histograms.has(name)) this._histograms.set(name, new Histogram(name, help, buckets));
    return this._histograms.get(name)!;
  }

  toPrometheusText(): string {
    const parts: string[] = [];
    for (const c of this._counters.values())   parts.push(c.toText());
    for (const g of this._gauges.values())     parts.push(g.toText());
    for (const h of this._histograms.values()) parts.push(h.toText());
    return parts.join('\n\n') + '\n';
  }
}

// ── Instância singleton global ──────────────────────────────────

export const metrics = new MetricsRegistry();

// ── Métricas pré-definidas ──────────────────────────────────────

export const httpRequestsTotal = metrics.counter(
  'http_requests_total',
  'Total de requisições HTTP por método, rota e status',
);

export const httpRequestDurationMs = metrics.histogram(
  'http_request_duration_ms',
  'Duração das requisições HTTP em milissegundos',
  [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
);

export const wsConnectionsActive = metrics.gauge(
  'ws_connections_active',
  'Conexões WebSocket ativas no momento',
);

export const bullmqQueueDepth = metrics.gauge(
  'bullmq_queue_depth',
  'Jobs aguardando processamento por fila',
);

export const bullmqFailedJobs = metrics.gauge(
  'bullmq_failed_jobs',
  'Jobs com falha definitiva por fila',
);

export const circuitBreakerState = metrics.gauge(
  'circuit_breaker_state',
  'Estado do circuit breaker: 0=CLOSED, 1=HALF_OPEN, 2=OPEN',
);

export const evolutionRequestsTotal = metrics.counter(
  'evolution_requests_total',
  'Total de chamadas para a Evolution API por status (success/error/fast_fail)',
);

export const openaiRequestsTotal = metrics.counter(
  'openai_requests_total',
  'Total de chamadas para a OpenAI por status (success/error)',
);

export const webhookEventsTotal = metrics.counter(
  'webhook_events_total',
  'Total de eventos de webhook recebidos por provider e event_type',
);
