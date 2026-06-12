// Runtime env loader for static pages.
// Provide values by setting window.APP_ENV or window.__ENV__ before this file.
// Public keys only: SUPABASE_URL, SUPABASE_ANON_KEY, N8N_WEBHOOK_DISPARO_PRO.
// Optional (only if public): N8N_WEBHOOK_ASAAS_BILLING.
(function () {
  var allowedKeys = {
    SUPABASE_URL: true,
    SUPABASE_ANON_KEY: true,
    N8N_WEBHOOK_DISPARO_PRO: true,
    N8N_WEBHOOK_ASAAS_BILLING: true,
    // API Layer própria — substitui chamadas N8N/Evolution gradualmente.
    // Deixar em branco para continuar usando N8N como antes.
    API_BASE_URL: true
  };

  var env = window.APP_ENV || window.__ENV__ || {};
  var merged = {};

  Object.keys(allowedKeys).forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      merged[key] = env[key];
    }
  });

  window.APP_ENV = merged;

  window.getAppEnv = function (key) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      return merged[key];
    }
    console.warn('[env] Missing ' + key);
    return '';
  };
})();
