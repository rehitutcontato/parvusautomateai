export const ACESSO_POR_RECURSO: Record<string, string[]> = {
  gerador_simples:   ['free', 'starter', 'pro', 'creator', 'agency', 'enterprise', 'admin'],
  marketplace:       ['free', 'starter', 'pro', 'creator', 'agency', 'enterprise', 'admin'],
  minhas_compras:    ['free', 'starter', 'pro', 'creator', 'agency', 'enterprise', 'admin'],
  iot_monitor:       ['creator', 'agency', 'enterprise', 'admin'],
  agency_mode:       ['creator', 'agency', 'enterprise', 'admin'],
  painel_admin:      ['admin']
};

export function temAcesso(planoUsuario: string, recurso: keyof typeof ACESSO_POR_RECURSO): boolean {
  if (!planoUsuario) return false;
  return ACESSO_POR_RECURSO[recurso]?.includes(planoUsuario.toLowerCase()) ?? false;
}

export function getBadgePlano(plano: string) {
  const badges: Record<string, { label: string, cor: string, bg: string }> = {
    free:       { label: 'FREE',       cor: '#444444', bg: '#1a1a1a' },
    starter:    { label: 'STARTER',    cor: '#00ff88', bg: 'rgba(0,255,136,0.1)' },
    pro:        { label: 'PRO',        cor: '#ff6600', bg: 'rgba(255,102,0,0.1)' },
    creator:    { label: 'CREATOR',    cor: '#9b59b6', bg: 'rgba(155,89,182,0.1)' },
    agency:     { label: 'AGENCY',     cor: '#f1c40f', bg: 'rgba(241,196,15,0.1)' },
    enterprise: { label: 'ENTERPRISE', cor: '#00d4ff', bg: 'rgba(0,212,255,0.1)' },
    admin:      { label: 'ADMIN',      cor: '#ff4444', bg: 'rgba(255,68,68,0.1)'  }
  };
  return badges[plano?.toLowerCase()] || badges['free'];
}
