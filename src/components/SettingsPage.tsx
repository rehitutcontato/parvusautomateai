import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGenerationLimit } from '../lib/hooks/useGenerationLimit';
import { 
  Settings, 
  Save, 
  LogOut, 
  CheckCircle2, 
  User, 
  Building2, 
  Phone, 
  Mail, 
  Lock, 
  KeyRound, 
  Crown, 
  Sparkles, 
  Eye, 
  EyeOff,
  AlertCircle
} from 'lucide-react';

interface SettingsPageProps {
  onLogout: () => void;
}

export function SettingsPage({ onLogout }: SettingsPageProps) {
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingSecurity, setUpdatingSecurity] = useState(false);
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [securityError, setSecurityError] = useState('');

  const { plan, usedThisMonth, limit, loading: limitLoading } = useGenerationLimit();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      setUserEmail(session.user.email || '');
      setNewEmail(session.user.email || '');

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !profile) return;
    
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      // 1. Update Profile in public.profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          nome: profile.nome,
          empresa: profile.empresa,
          whatsapp_contato: profile.whatsapp_contato,
          gemini_key_propria: profile.gemini_key_propria,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // 2. If email changed, issue email update authentication
      if (newEmail && newEmail !== userEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) throw emailError;
        setSuccess('Perfil atualizado! Um link de confirmação foi enviado para o novo e-mail.');
      } else {
        setSuccess('Perfil atualizado com sucesso!');
      }

      if (profile.gemini_key_propria) {
        localStorage.setItem('parvus_key', profile.gemini_key_propria);
      } else {
        localStorage.removeItem('parvus_key');
      }

      setTimeout(() => setSuccess(''), 4000);
      fetchProfile();
    } catch (err: any) {
      setError('Erro ao salvar as configurações: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!newPassword) {
      setSecurityError('Insira uma nova senha.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setSecurityError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setUpdatingSecurity(true);
    setSecuritySuccess('');
    setSecurityError('');

    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      setSecuritySuccess('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSecuritySuccess(''), 4000);
    } catch (err: any) {
      setSecurityError('Erro ao atualizar segurança: ' + (err.message || err));
    } finally {
      setUpdatingSecurity(false);
    }
  };

  if (loading || limitLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff88]"></div>
        <p className="text-sm font-medium">Carregando painel de controle...</p>
      </div>
    );
  }

  // Calculate percentage of usage
  const numLimit = limit || 1;
  const numUsed = usedThisMonth || 0;
  const usagePercentage = Math.min(100, Math.round((numUsed / numLimit) * 100));

  // Visual badges based on active plan
  const getPlanBadgeStyles = (planName: string) => {
    const p = (planName || 'free').toLowerCase();
    if (p === 'admin') return { bg: 'bg-red-500/10 border-red-500/40 text-red-400', label: '🛡️ Administrador' };
    if (p === 'enterprise') return { bg: 'bg-sky-500/10 border-sky-500/40 text-sky-400', label: '⚡ Enterprise' };
    if (p === 'agency') return { bg: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500', label: '🔥 Agência' };
    if (p === 'creator') return { bg: 'bg-purple-500/10 border-purple-500/40 text-purple-400', label: '🎨 Criador' };
    if (p === 'pro') return { bg: 'bg-orange-500/10 border-orange-500/40 text-orange-400', label: '⭐ Pro' };
    return { bg: 'bg-gray-500/10 border-gray-500/40 text-gray-400', label: 'Plano Gratuito' };
  };

  const planBadge = getPlanBadgeStyles(plan);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00ff88]/10 rounded-lg border border-[#00ff88]/20">
            <Settings className="text-[#00ff88]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider font-syne">Configurações de Conta</h1>
            <p className="text-xs text-gray-400">Gere e edite suas preferências de Usuário e integrações de IA.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${planBadge.bg}`}>
            {planBadge.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Plan statistics / limits & fast shortcuts */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Plan stats card */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff88]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#00ff88]/10 transition-colors"></div>
            
            <div className="flex items-center gap-2 text-white font-bold text-sm uppercase mb-4 tracking-wider">
              <Crown size={16} className="text-[#00ff88]" />
              Status de Uso do Plano
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Gerações Realizadas</span>
                <span className="font-bold text-[#00ff88]">{numUsed} / {plan === 'admin' ? '∞' : numLimit}</span>
              </div>
              <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-[#00ff88] to-[#00d4ff] rounded-full transition-all duration-500"
                  style={{ width: `${plan === 'admin' ? 0 : usagePercentage}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">
                {plan === 'admin' ? 'Uso irrestrito habilitado para Administradores.' : `Consumido ${usagePercentage}% das gerações do seu plano mensal.`}
              </p>
            </div>

            <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Tipo de Conta:</span>
                <span className="font-bold text-white capitalize">{plan}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Suporte Premium:</span>
                <span className="text-[#00ff88] font-bold">
                  {['enterprise', 'admin', 'agency'].includes(plan?.toLowerCase()) ? 'Habilitado (WhatsApp)' : 'Comunidade'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Info card */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-white font-bold text-sm uppercase mb-4 tracking-wider">
              <Sparkles size={16} className="text-[#00d4ff]" />
              Parvus Automate AI
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Suas chaves de acesso pessoais e dados coletados são salvos localmente e criptografados nos servidores do Google Cloud & Supabase com o máximo rigor de privacidade de dados.
            </p>
            <div className="text-[10px] text-gray-500">
              Versão Técnico-Operacional: v2.4.1 (Stable)<br/>
              Framework Central: React 19 + Vite + Tailwind CSS
            </div>
          </div>
        </div>

        {/* Right Columns: Main settings options */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Card: Edit Profile */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-6">
              <User size={18} className="text-[#00ff88]" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider font-syne">Informações de Perfil</h2>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Full name */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <User size={12} /> Nome Completo
                  </label>
                  <input 
                    type="text" 
                    required
                    value={profile?.nome || ''} 
                    onChange={e => setProfile({...profile, nome: e.target.value})}
                    placeholder="Seu nome"
                    className="w-full bg-[#070707] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>

                {/* Company */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Building2 size={12} /> Empresa / Organização
                  </label>
                  <input 
                    type="text" 
                    value={profile?.empresa || ''} 
                    onChange={e => setProfile({...profile, empresa: e.target.value})}
                    placeholder="Sua empresa"
                    className="w-full bg-[#070707] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Phone size={12} /> WhatsApp / Telefone
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="(DD) 99999-9999"
                    value={profile?.whatsapp_contato || ''} 
                    onChange={e => setProfile({...profile, whatsapp_contato: e.target.value})}
                    className="w-full bg-[#070707] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail size={12} /> endereço de E-mail
                  </label>
                  <input 
                    type="email" 
                    required
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                    className="w-full bg-[#070707] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>

                {/* Custom API Key (Available to everyone directly in custom key layout) */}
                <div className="space-y-2 md:col-span-2 pt-4 border-t border-white/5">
                  <label className="text-xs font-semibold text-[#00ff88] uppercase tracking-widest flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><KeyRound size={12} /> Gemini API Key Própria</span>
                    <span className="text-[9px] bg-[#00ff88]/10 text-[#00ff88] px-2 py-0.5 rounded border border-[#00ff88]/20 font-bold uppercase">Opcional</span>
                  </label>
                  <p className="text-[11px] text-gray-400 leading-normal mb-2">
                    Oferecemos limites generosos por padrão. No entanto, você pode inserir sua própria chave de API do Google AI Studio para ignorar todas as franquias de uso e ter requisições ilimitadas.
                  </p>
                  <input 
                    type="password" 
                    placeholder="AIzaSy... (Sua chave pessoal da API Gemini)"
                    value={profile?.gemini_key_propria || ''} 
                    onChange={e => setProfile({...profile, gemini_key_propria: e.target.value})}
                    className="w-full bg-[#070707] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/50 text-red-500 p-3.5 rounded-xl text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] p-3.5 rounded-xl text-xs font-medium">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto bg-gradient-to-r from-[#00ff88] to-[#00d4ff] hover:brightness-110 text-black font-extrabold uppercase text-xs tracking-wider py-3.5 px-8 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00ff88]/10"
                >
                  {saving ? (
                    <span className="animate-pulse">Salvando dados...</span>
                  ) : (
                    <>
                      <Save size={14} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Card: Security / Password Change */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Lock size={18} className="text-[#00d4ff]" />
              <h2 className="text-lg font-bold text-white uppercase tracking-wider font-syne">Segurança da Conta</h2>
            </div>

            <form onSubmit={handleUpdateSecurity} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* New Password */}
                <div className="space-y-2 relative">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Nova Senha</span>
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-gray-400 hover:text-white transition-colors flex items-center gap-1 normal-case"
                    >
                      {showPassword ? <EyeOff size={11} /> : <Eye size={11} />} {showPassword ? 'Ocultar' : 'Visualizar'}
                    </button>
                  </label>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-[#070707] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-all"
                  />
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Confirmar Senha</label>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full bg-[#070707] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-all"
                  />
                </div>
              </div>

              {securityError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/50 text-red-500 p-3.5 rounded-xl text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{securityError}</span>
                </div>
              )}

              {securitySuccess && (
                <div className="flex items-center gap-2 bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] p-3.5 rounded-xl text-xs font-medium">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{securitySuccess}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button 
                  type="submit"
                  disabled={updatingSecurity}
                  className="w-full sm:w-auto bg-transparent border border-[#00d4ff]/30 hover:bg-[#00d4ff]/5 text-[#00d4ff] font-bold uppercase text-xs tracking-wider py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {updatingSecurity ? (
                    <span className="animate-pulse">Atualizando senha...</span>
                  ) : (
                    <>
                      <Lock size={14} />
                      Atualizar Senha
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Card: System Out */}
          <div className="flex items-center justify-between p-6 bg-red-500/5 border border-red-500/10 rounded-2xl">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Encerrar Sessão</h3>
              <p className="text-xs text-gray-400">Desconectar sua conta com segurança deste dispositivo.</p>
            </div>
            <button 
              onClick={onLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs uppercase font-extrabold tracking-wider px-5 py-3 rounded-xl transition-all border border-red-500/20"
            >
              Sair da Conta
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
