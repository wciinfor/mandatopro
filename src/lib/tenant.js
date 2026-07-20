export function obterTenantId(usuario) {
  const tenantId = Number(usuario?.tenant_id || usuario?.tenantId || 0);
  if (Number.isFinite(tenantId) && tenantId > 0) return tenantId;

  const fallbackUsuarioId = Number(usuario?.id || 0);
  return Number.isFinite(fallbackUsuarioId) && fallbackUsuarioId > 0 ? fallbackUsuarioId : null;
}

