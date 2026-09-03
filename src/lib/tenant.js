export function obterTenantId(usuario) {
  const tenantId = Number(usuario?.tenant_id ?? usuario?.tenantId ?? 0);
  if (Number.isFinite(tenantId) && tenantId > 0) return tenantId;

  // NUNCA usar usuario.id como fallback de tenant_id.
  // Usuário e Tenant/Gabinete são entidades distintas. Se o usuário não possui tenant_id,
  // retorna null para que a camada chamadora trate o erro de autorização/configuração.
  return null;
}

