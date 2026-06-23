import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGenerationLimit } from '../lib/hooks/useGenerationLimit';
import { 
  Settings, 
  Save, 
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
  AlertCircle,
  MessageCircle,
  Shield
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

  const handleUpgradePlan = (planName: string) => {
    const nomeUsuario = profile?.nome || 'Usuário Parvus';
    const emailUsuario = userEmail || 'Sem email cadastrado';
    const message = `Olá! Meu nome é ${nomeUsuario} (${emailUsuario}) e gostaria de assinar ou alterar meu plano no Parvus Automate para o plano ${planName}.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/5519994656845?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Full name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 justify-start">
                    <User size={13} className="text-[#00ff88]" /> Nome Completo
                  </label>
                  <input 
                    type="text" 
                    required
                    value={profile?.nome || ''} 
                    onChange={e => setProfile({...profile, nome: e.target.value})}
                    placeholder="Seu nome"
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>

                {/* Company */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 justify-start">
                    <Building2 size={13} className="text-[#00ff88]" /> Empresa
                  </label>
                  <input 
                    type="text" 
                    value={profile?.empresa || ''} 
                    onChange={e => setProfile({...profile, empresa: e.target.value})}
                    placeholder="Sua empresa"
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 justify-start">
                    <Phone size={13} className="text-[#00ff88]" /> WhatsApp
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="(DD) 99999-9999"
                    value={profile?.whatsapp_contato || ''} 
                    onChange={e => setProfile({...profile, whatsapp_contato: e.target.value})}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 justify-start">
                    <Mail size={13} className="text-[#00ff88]" /> Endereço de E-mail
                  </label>
                  <input 
                    type="email" 
                    required
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
                  />
                </div>

                {/* Custom API Key (Available to everyone directly in custom key layout) */}
                <div className="space-y-2 sm:col-span-2 pt-4 border-t border-white/5">
                  <label className="text-xs font-bold text-[#00ff88] uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><KeyRound size={13} /> NVIDIA API Key Própria (GLM)</span>
                    <span className="text-[9px] bg-[#00ff88]/10 text-[#00ff88] px-2.5 py-0.5 rounded border border-[#00ff88]/20 font-bold uppercase">Opcional</span>
                  </label>
                  <p className="text-[11px] text-gray-400 leading-normal mb-2">
                    Oferecemos limites generosos por padrão. No entanto, você pode inserir sua própria chave de API da NVIDIA (começando com nvapi-) para usar o motor GLM-5.1 de alta capacidade, ignorar todas as franquias de uso e ter requisições ilimitadas.
                  </p>
                  <input 
                    type="password" 
                    placeholder="nvapi-... (Sua chave pessoal NVIDIA x GLM)"
                    value={profile?.gemini_key_propria || ''} 
                    onChange={e => setProfile({...profile, gemini_key_propria: e.target.value})}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all"
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
                  className="w-full sm:w-auto bg-gradient-to-r from-[#00ff88] to-[#00d4ff] hover:brightness-110 text-black font-extrabold uppercase text-xs tracking-wider py-3.5 px-8 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00ff88]/10 animate-fade-in"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* New Password */}
                <div className="space-y-2 relative">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Nova Senha</span>
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-gray-400 hover:text-white transition-colors flex items-center gap-1 normal-case cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={11} /> : <Eye size={11} />} {showPassword ? 'Ocultar' : 'Visualizar'}
                    </button>
                  </label>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-all"
                  />
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block text-left">Confirmar Senha</label>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-all"
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
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs uppercase font-extrabold tracking-wider px-5 py-3 rounded-xl transition-all border border-red-500/20 cursor-pointer"
            >
              Sair da Conta
            </button>
          </div>

        </div>
      </div>

      {/* SEÇÃO DE PLANOS DE ASSINATURA COMPLETA E PREMIUM */}
      <div className="mt-12 pt-8 border-t border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-[#00ff88]/10 rounded-lg border border-[#00ff88]/20">
            <Crown className="text-[#00ff88] animate-pulse" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider font-syne flex items-center gap-2">
              Planos de Assinatura
            </h2>
            <p className="text-xs text-gray-400">Desbloqueie todos os recursos avançados e aumente seu limite de gerações de automações.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Plan: Starter */}
          <div className={`bg-[#111111] border ${plan === 'starter' ? 'border-[#00ff88]/50 shadow-[0_0_20px_rgba(0,255,136,0.08)]' : 'border-white/5'} rounded-2xl p-6 flex flex-col justify-between relative`}>
            {plan === 'starter' && (
              <span className="absolute top-4 right-4 bg-[#00ff88]/10 text-[#00ff88] text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-[#00ff88]/30">
                Seu Plano Ativo
              </span>
            )}
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Starter</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black text-[#00ff88]">R$ 197</span>
                <span className="text-xs text-gray-500">/mês</span>
              </div>
              <p className="text-xs text-[#888888] mb-4">Essencial para quem deseja experimentar e criar as primeiras automações de IA.</p>
              <ul className="space-y-2 text-xs text-gray-300 mb-6 border-t border-white/5 pt-4">
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#00ff88] shrink-0" /> 5 gerações completas/mês</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#00ff88] shrink-0" /> Acesso total ao Marketplace</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-gray-600 shrink-0" /> Exportação de Código Fonte</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-gray-600 shrink-0" /> Suporte por e-mail padrão</li>
              </ul>
            </div>
            <button
              onClick={() => handleUpgradePlan('Starter')}
              className="w-full bg-white/5 hover:bg-[#00ff88]/10 hover:text-[#00ff88] hover:border-[#00ff88]/30 text-white border border-white/10 py-3 rounded-xl text-xs uppercase font-bold transition-all cursor-pointer"
            >
              {plan === 'starter' ? 'Alterar / Renovar' : 'Adquirir Starter'}
            </button>
          </div>

          {/* Plan: Creator */}
          <div className={`bg-[#111111] border ${plan === 'creator' ? 'border-[#9b59b6]/50 shadow-[0_0_20px_rgba(155,89,182,0.08)]' : 'border-white/5'} rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden`}>
            <div className="absolute top-0 right-0 bg-[#9b59b6] text-black font-black text-[8px] uppercase tracking-widest px-3 py-1 rounded-bl">Hardware + IoT</div>
            {plan === 'creator' && (
              <span className="absolute top-4 left-4 bg-[#9b59b6]/10 text-[#9b59b6] text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-[#9b59b6]/30">
                Seu Plano Ativo
              </span>
            )}
            <div className="mt-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Creator</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black text-[#9b59b6]">R$ 397</span>
                <span className="text-xs text-gray-500">/mês</span>
              </div>
              <p className="text-xs text-[#888888] mb-4">Desbloqueie o Monitor IoT Virtual e a criação avançada de hardware.</p>
              <ul className="space-y-2 text-xs text-gray-300 mb-6 border-t border-white/5 pt-4">
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#9b59b6] shrink-0" /> 10 gerações completas/mês</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#9b59b6] shrink-0" /> Monitor IoT Virtual Desbloqueado</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#9b59b6] shrink-0" /> Modo Agência (White-label) ativo</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-gray-600 shrink-0" /> Suporte técnico dedicado</li>
              </ul>
            </div>
            <button
              onClick={() => handleUpgradePlan('Creator')}
              className="w-full bg-[#9b59b6]/10 hover:bg-[#9b59b6]/20 text-[#9b59b6] border border-[#9b59b6]/25 py-3 rounded-xl text-xs uppercase font-bold transition-all cursor-pointer"
            >
              {plan === 'creator' ? 'Alterar / Renovar' : 'Adquirir Creator'}
            </button>
          </div>

          {/* Plan: Pro */}
          <div className={`bg-[#111111] border ${plan === 'pro' ? 'border-[#ff6600]/50 shadow-[0_0_20px_rgba(255,102,0,0.08)]' : 'border-[#ff6600]/20'} rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden`}>
            <div className="absolute top-0 right-0 bg-[#ff6600] text-black font-black text-[8px] uppercase tracking-widest px-3 py-1 rounded-bl">Mais Popular</div>
            {plan === 'pro' && (
              <span className="absolute top-4 left-4 bg-[#ff6600]/10 text-[#ff6600] text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-[#ff6600]/30">
                Seu Plano Ativo
              </span>
            )}
            <div className="mt-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black text-[#ff6600]">R$ 597</span>
                <span className="text-xs text-gray-500">/mês</span>
              </div>
              <p className="text-xs text-[#888888] mb-4">Para profissionais e freelancers que demandam alta performance.</p>
              <ul className="space-y-2 text-xs text-gray-300 mb-6 border-t border-white/5 pt-4">
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#ff6600] shrink-0" /> 20 gerações completas/mês</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#ff6600] shrink-0" /> Monitor IoT + Modo Agência</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#ff6600] shrink-0" /> NVIDIA API Key Própria (GLM)</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#ff6600] shrink-0" /> Suporte VIP prioritário</li>
              </ul>
            </div>
            <button
              onClick={() => handleUpgradePlan('Pro')}
              className="w-full bg-[#ff6600]/15 hover:bg-[#ff6600]/30 text-white border border-[#ff6600]/40 py-3 rounded-xl text-xs uppercase font-bold transition-all cursor-pointer"
            >
              {plan === 'pro' ? 'Alterar / Renovar' : 'Adquirir Pro'}
            </button>
          </div>

          {/* Plan: Agency */}
          <div className={`bg-[#111111] border ${plan === 'agency' ? 'border-[#f1c40f]/50 shadow-[0_0_20px_rgba(241,196,15,0.08)]' : 'border-white/5'} rounded-2xl p-6 flex flex-col justify-between relative`}>
            {plan === 'agency' && (
              <span className="absolute top-4 right-4 bg-[#f1c40f]/10 text-[#f1c40f] text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-[#f1c40f]/30">
                Seu Plano Ativo
              </span>
            )}
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Agency</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black text-[#f1c40f]">R$ 1.197</span>
                <span className="text-xs text-gray-500">/mês</span>
              </div>
              <p className="text-xs text-[#888888] mb-4">Para estúdios e agências focadas em escala e entregas integradas.</p>
              <ul className="space-y-2 text-xs text-gray-300 mb-6 border-t border-white/5 pt-4">
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#f1c40f] shrink-0" /> 50 gerações completas/mês</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#f1c40f] shrink-0" /> Monitor IoT + Modo Agência Completo</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#f1c40f] shrink-0" /> Suporte VIP dedicado via WhatsApp</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#f1c40f] shrink-0" /> Prioridade total na fila de IA</li>
              </ul>
            </div>
            <button
              onClick={() => handleUpgradePlan('Agency')}
              className="w-full bg-[#f1c40f]/10 hover:bg-[#f1c40f]/20 text-[#f1c40f] border border-[#f1c40f]/25 py-3 rounded-xl text-xs uppercase font-bold transition-all cursor-pointer"
            >
              {plan === 'agency' ? 'Alterar / Renovar' : 'Adquirir Agency'}
            </button>
          </div>

          {/* Plan: Enterprise */}
          <div className={`bg-[#111111] border ${plan === 'enterprise' ? 'border-[#00d4ff]/50 shadow-[0_0_20px_rgba(0,212,255,0.08)]' : 'border-white/5'} rounded-2xl p-6 flex flex-col justify-between relative`}>
            {plan === 'enterprise' && (
              <span className="absolute top-4 right-4 bg-[#00d4ff]/10 text-[#00d4ff] text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-[#00d4ff]/30">
                Seu Plano Ativo
              </span>
            )}
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Enterprise</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black text-[#00d4ff]">R$ 2.497</span>
                <span className="text-xs text-gray-500">/mês</span>
              </div>
              <p className="text-xs text-[#888888] mb-4">Capacidade massiva e suporte sob demanda com eng. dedicado.</p>
              <ul className="space-y-2 text-xs text-gray-300 mb-6 border-t border-white/5 pt-4">
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#00d4ff] shrink-0" /> 100 gerações completas/mês</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#00d4ff] shrink-0" /> Suporte Premium 24/7 (WhatsApp)</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#00d4ff] shrink-0" /> Engenheiro de Integração Dedicado</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#00d4ff] shrink-0" /> Customização de API exclusiva</li>
              </ul>
            </div>
            <button
              onClick={() => handleUpgradePlan('Enterprise')}
              className="w-full bg-gradient-to-r from-[#00d4ff] to-[#00ff88] text-black font-extrabold py-3 rounded-xl text-xs uppercase transition-all hover:brightness-110 cursor-pointer"
            >
              {plan === 'enterprise' ? 'Alterar / Renovar' : 'Adquirir Enterprise'}
            </button>
          </div>

          {/* Plan: Admin */}
          <div className="bg-[#111111]/60 border border-[#ff4444]/20 rounded-2xl p-6 flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2 flex items-center gap-1.5"><Shield size={14} className="text-[#ff4444]" /> Admin</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black text-[#ff4444]">Customizado</span>
              </div>
              <p className="text-xs text-[#888888] mb-4">Ambiente administrativo para monitoramento interno e suporte.</p>
              <ul className="space-y-2 text-xs text-gray-300 mb-6 border-t border-white/5 pt-4">
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#ff4444] shrink-0" /> Gerações ilimitadas sem custos</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#ff4444] shrink-0" /> Painel de controle de usuários</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[#ff4444] shrink-0" /> Logs de sistema e auditoria de compras</li>
              </ul>
            </div>
            <button
              disabled
              className="w-full bg-white/5 text-[#888888] border border-white/5 py-3 rounded-xl text-xs uppercase font-bold cursor-not-allowed"
            >
              Apenas Staff
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
