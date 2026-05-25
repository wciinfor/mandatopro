// Runtime env loader for the MandatoPro embedded Mandato Connect.
(function () {
  var allowedKeys = {
    SUPABASE_URL: true,
    SUPABASE_ANON_KEY: true,
    N8N_WEBHOOK_DISPARO_PRO: true,
    N8N_WEBHOOK_ASAAS_BILLING: true,
    API_BASE_URL: true,
    MANDATOPRO_EMBED: true,
    MANDATOPRO_CONTACTS_ENDPOINT: true
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
