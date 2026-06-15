import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGenerationLimit } from '../lib/hooks/useGenerationLimit';
import { Settings, Save, LogOut, CheckCircle2 } from 'lucide-react';

interface SettingsPageProps {
  onLogout: () => void;
}

export function SettingsPage({ onLogout }: SettingsPageProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { plan, usedThisMonth, limit, remainingGenerations, loading: limitLoading } = useGenerationLimit();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (data) {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !profile) return;
    
    setSaving(true);
    setSuccess('');
    setError('');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        nome: profile.nome,
        empresa: profile.empresa,
        whatsapp_contato: profile.whatsapp_contato,
        gemini_key_propria: profile.gemini_key_propria,
      })
      .eq('id', profile.id);

    if (updateError) {
      setError('Erro ao salvar as configurações. ' + updateError.message);
    } else {
      setSuccess('Configurações salvas com sucesso!');
      if (profile.gemini_key_propria) {
        localStorage.setItem('parvus_key', profile.gemini_key_propria);
      }
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  };

  const copyDatabaseSql = () => {
    const sql = `-- iot_devices table
create table public.iot_devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  tipo text not null,
  hardware text,
  descricao text,
  status text default 'offline',
  ultimo_ping timestamptz,
  dados_atuais jsonb default '{}',
  threshold_alerta jsonb default '{}',
  historico_resumo jsonb default '{}',
  token_dispositivo uuid default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.iot_devices enable row level security;

create policy "select_own_iot" on public.iot_devices for select using (auth.uid() = user_id);
create policy "insert_own_iot" on public.iot_devices for insert with check (auth.uid() = user_id);
create policy "update_own_iot" on public.iot_devices for update using (auth.uid() = user_id);
create policy "delete_own_iot" on public.iot_devices for delete using (auth.uid() = user_id);

-- Função para promover usuário para creator (rodar pelo admin no SQL Editor)
create or replace function public.set_user_plan(target_email text, novo_plano text)
returns text as $$
declare
  target_id uuid;
begin
  select id into target_id from auth.users where email = target_email;
  if target_id is null then
    return 'Usuário não encontrado: ' || target_email;
  end if;
  update public.profiles set plano = novo_plano, updated_at = now() where id = target_id;
  return 'Plano atualizado para ' || novo_plano || ' — usuário: ' || target_email;
end;
$$ language plpgsql security definer;
`;
    navigator.clipboard.writeText(sql);
    setSuccess('SQL do banco copiado!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const copyCleanupSql = () => {
    const sql = `-- Nuke workflows
drop table if exists public.workflow_executions cascade;
drop table if exists public.workflows cascade;
`;
    navigator.clipboard.writeText(sql);
    setSuccess('SQL de Limpeza (Workflows) copiado!');
    setTimeout(() => setSuccess(''), 3000);
  };

  if (loading || limitLoading) {
    return <div className="p-8 text-gray-400">Carregando configurações...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
        <Settings className="text-[#00ff88]" size={28} />
        <h1 className="text-2xl font-bold text-white tracking-tight">Configurações da Conta</h1>
      </div>

      <div className="bg-[#111111] border border-white/5 rounded-xl p-6 mb-8 shadow-xl">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Status do Plano</h2>
            <div className="text-sm text-gray-400">
              Uso atual do mês
            </div>
          </div>
          <div className="bg-white/5 rounded-lg border border-white/10 px-4 py-3 flex gap-4 min-w-[200px]">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Plano</div>
              <div className="font-bold text-lg text-white capitalize">{plan === 'admin' ? 'Infinito' : plan}</div>
            </div>
            <div className="w-[1px] bg-white/10"></div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Gerações</div>
              <div className="font-bold text-lg text-[#00ff88]">
                {plan === 'admin' ? '∞' : `${usedThisMonth} / ${limit}`}
              </div>
            </div>
          </div>
        </div>

        {plan === 'free' && (
          <div className="bg-[#ff3366]/10 border border-[#ff3366]/30 text-[#ff3366] text-sm rounded-lg p-3">
            Você está no plano gratuito (0 gerações). Verifique os planos para obter saldo.
          </div>
        )}
      </div>

      <div className="bg-[#111111] border border-white/5 rounded-xl p-6 mb-8 shadow-xl">
        <h2 className="text-xl font-semibold text-white mb-2">Banco de Dados (Supabase)</h2>
        <p className="text-sm text-gray-400 mb-6">Administração das tabelas relacionadas ao módulo de IoT e limpeza de dados obsoletos.</p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            type="button"
            onClick={copyDatabaseSql}
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-3 px-4 text-[#00ff88] font-bold text-sm text-center transition-colors"
          >
            Copiar SQL de Setup (IoT)
          </button>
          <button 
            type="button"
            onClick={copyCleanupSql}
            className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg py-3 px-4 text-red-500 font-bold text-sm text-center transition-colors"
          >
            Copiar SQL de Limpeza (Workflows)
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Nome Completo</label>
            <input 
              type="text" 
              value={profile?.nome || ''} 
              onChange={e => setProfile({...profile, nome: e.target.value})}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#00ff88] transition-colors"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Empresa (Opcional)</label>
            <input 
              type="text" 
              value={profile?.empresa || ''} 
              onChange={e => setProfile({...profile, empresa: e.target.value})}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#00ff88] transition-colors"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">WhatsApp de Contato</label>
            <input 
              type="text" 
              placeholder="(11) 99999-9999"
              value={profile?.whatsapp_contato || ''} 
              onChange={e => setProfile({...profile, whatsapp_contato: e.target.value})}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#00ff88] transition-colors"
            />
          </div>

          {(plan === 'pro' || plan === 'enterprise' || plan === 'admin') && (
            <div className="space-y-2 md:col-span-2 mt-4 pt-4 border-t border-white/5">
              <label className="text-xs font-semibold text-[#00ff88] uppercase tracking-widest flex items-center gap-2">
                Gemini API Key
                <span className="bg-[#00ff88]/20 text-[#00ff88] px-2 py-0.5 rounded text-[10px]">Avançado</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">Configure sua própria chave de API para o Google Gemini.</p>
              <input 
                type="password" 
                placeholder="AIzaSy..."
                value={profile?.gemini_key_propria || ''} 
                onChange={e => setProfile({...profile, gemini_key_propria: e.target.value})}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#00ff88] transition-colors"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-[#00ff88] text-sm">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-8 border-t border-white/10">
          <button 
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors w-full sm:w-auto p-2"
          >
            <LogOut size={18} />
            Sair da conta
          </button>

          <button 
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-[#00ff88] hover:bg-[#00cc6a] text-black font-bold py-2.5 px-8 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : (
              <>
                <Save size={18} />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
