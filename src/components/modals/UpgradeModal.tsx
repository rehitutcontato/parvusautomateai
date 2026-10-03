import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Info, Shield, CheckCircle2, Zap, Sparkles, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PLANS } from '../../lib/plans.config';
import { buildWhatsAppCheckoutUrl } from '../../lib/whatsappCheckout';

interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const getProfile = async () => {
      if (!supabase) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserEmail(session.user.email || '');
          setUserId(session.user.id || '');
          const { data } = await supabase.from('profiles').select('nome').eq('id', session.user.id).single();
          if (data?.nome) {
            setUserName(data.nome);
          } else if (session.user.user_metadata?.nome) {
            setUserName(session.user.user_metadata.nome);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar dados do perfil no modal:", err);
      }
    };
    getProfile();
  }, []);

  const handleCheckout = (planName: string, planPrice: number) => {
    return buildWhatsAppCheckoutUrl({
      planName,
      planPrice,
      userName: userName || (userEmail ? userEmail.split('@')[0] : 'Usuário Parvus'),
      userEmail,
      userId,
      phone: '5519994656845'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#0b0c10] border border-white/15 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-[0_0_80px_rgba(0,255,136,0.12)] relative animate-in fade-in zoom-in duration-200 my-auto max-h-[92vh] flex flex-col">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#00ff88]/10 via-[#00d4ff]/5 to-transparent rounded-tr-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all"
          title="Fechar"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center mb-6 shrink-0 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-[11px] font-bold uppercase tracking-wider mb-3">
            <Sparkles size={13} />
            Ecossistema Parvus Space • Upgrade Oficial
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight font-display">
            Desbloqueie o Poder Máximo da Hiperautomação
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
            Gerações completas de software fullstack, firmware IoT, modos white-label para agências e modelos de IA de última geração.
          </p>
        </div>

        {/* User identification bar */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl px-4 py-2.5 mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span>
            <span>Conta: <strong className="text-white font-mono">{userEmail || 'Visitante (Sem Login)'}</strong></span>
          </div>
          {userId && (
            <div className="text-[11px] font-mono text-gray-500">
              ID: <span className="text-[#00d4ff]">{userId.substring(0, 8)}...</span>
            </div>
          )}
          <div className="text-[11px] text-[#00ff88]">
            ✓ Ativação Imediata via WhatsApp / PIX
          </div>
        </div>

        {/* Plans Grid */}
        <div className="overflow-y-auto pr-1 mb-5 space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Starter */}
            <div className="bg-[#101218] border border-white/10 hover:border-white/20 p-5 rounded-2xl flex flex-col justify-between transition-all group">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-base text-white tracking-tight">{PLANS.starter.name}</h3>
                    <p className="text-[11px] text-gray-400">Ideal para validações rápidas</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-gray-300">
                    {PLANS.starter.generations} Gerações
                  </span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-black text-white font-display">
                    R$ {PLANS.starter.price}
                    <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
                  </div>
                </div>
                <ul className="text-xs text-gray-300 space-y-2 mb-5">
                  {PLANS.starter.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#00ff88] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={handleCheckout(PLANS.starter.name, PLANS.starter.price)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={14} />
                Assinar Starter
              </a>
            </div>

            {/* Creator */}
            <div className="bg-[#101218] border border-[#9b59b6]/40 hover:border-[#9b59b6] p-5 rounded-2xl flex flex-col justify-between transition-all relative group shadow-[0_0_20px_rgba(155,89,182,0.1)]">
              <div className="absolute -top-2.5 right-4 bg-[#9b59b6] text-black font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                IoT + WhiteLabel
              </div>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-base text-white tracking-tight">{PLANS.creator.name}</h3>
                    <p className="text-[11px] text-gray-400">Para criadores & engenheiros</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#9b59b6]/15 text-[#9b59b6]">
                    {PLANS.creator.generations} Gerações
                  </span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-black text-white font-display">
                    R$ {PLANS.creator.price}
                    <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
                  </div>
                </div>
                <ul className="text-xs text-gray-300 space-y-2 mb-5">
                  {PLANS.creator.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#9b59b6] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={handleCheckout(PLANS.creator.name, PLANS.creator.price)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-[#9b59b6]/20 hover:bg-[#9b59b6] text-white hover:text-black font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={14} />
                Assinar Creator
              </a>
            </div>

            {/* Pro - Mais Popular */}
            <div className="bg-[#121620] border-2 border-[#00ff88] p-5 rounded-2xl flex flex-col justify-between transition-all relative group shadow-[0_0_30px_rgba(0,255,136,0.15)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-black text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full flex items-center gap-1">
                <Star size={11} fill="black" />
                Mais Escolhido
              </div>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-base text-white tracking-tight">{PLANS.pro.name}</h3>
                    <p className="text-[11px] text-[#00ff88]">Máxima potência para devs</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#00ff88]/20 text-[#00ff88]">
                    {PLANS.pro.generations} Gerações
                  </span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-black text-white font-display">
                    R$ {PLANS.pro.price}
                    <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
                  </div>
                </div>
                <ul className="text-xs text-gray-200 space-y-2 mb-5">
                  {PLANS.pro.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#00ff88] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={handleCheckout(PLANS.pro.name, PLANS.pro.price)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-[#00ff88] hover:bg-[#00ff88]/90 text-black font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:scale-[1.02]"
              >
                <Zap size={14} fill="black" />
                Assinar Pro Agora
              </a>
            </div>

            {/* Agency */}
            <div className="bg-[#101218] border border-[#f1c40f]/40 hover:border-[#f1c40f] p-5 rounded-2xl flex flex-col justify-between transition-all relative group">
              <div className="absolute -top-2.5 right-4 bg-[#f1c40f] text-black font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                Alta Demanda
              </div>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-base text-white tracking-tight">{PLANS.agency.name}</h3>
                    <p className="text-[11px] text-gray-400">Escritórios & Agências SaaS</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f1c40f]/15 text-[#f1c40f]">
                    {PLANS.agency.generations} Gerações
                  </span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-black text-white font-display">
                    R$ {PLANS.agency.price}
                    <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
                  </div>
                </div>
                <ul className="text-xs text-gray-300 space-y-2 mb-5">
                  {PLANS.agency.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#f1c40f] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={handleCheckout(PLANS.agency.name, PLANS.agency.price)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-[#f1c40f]/20 hover:bg-[#f1c40f] text-white hover:text-black font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={14} />
                Assinar Agency
              </a>
            </div>

            {/* Enterprise */}
            <div className="bg-gradient-to-br from-[#101420] to-[#0a1120] border border-[#00d4ff]/40 hover:border-[#00d4ff] p-5 rounded-2xl flex flex-col justify-between transition-all md:col-span-2 relative group shadow-[0_0_30px_rgba(0,212,255,0.1)]">
              <div className="absolute -top-2.5 right-4 bg-[#00d4ff] text-black font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                Corporativo Custom
              </div>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-base text-white tracking-tight">{PLANS.enterprise.name}</h3>
                    <p className="text-[11px] text-gray-400">Grandes operações e times técnicos</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#00d4ff]/20 text-[#00d4ff]">
                    {PLANS.enterprise.generations} Gerações
                  </span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-black text-white font-display">
                    R$ {PLANS.enterprise.price}
                    <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
                  </div>
                </div>
                <ul className="text-xs text-gray-300 grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                  {PLANS.enterprise.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-[#00d4ff] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={handleCheckout(PLANS.enterprise.name, PLANS.enterprise.price)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-gradient-to-r from-[#00d4ff] to-[#00ff88] text-black font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 hover:brightness-110 shadow-lg shadow-[#00d4ff]/20"
              >
                <Zap size={14} fill="black" />
                Contratar Enterprise
              </a>
            </div>

          </div>
        </div>

        {/* Footer info & WhatsApp direct */}
        <div className="shrink-0 bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-gray-400">
            <Shield className="text-[#00ff88] shrink-0" size={20} />
            <div>
              <p className="text-white font-medium">Pagamento Seguro via PIX Oficial</p>
              <p className="text-[11px] text-gray-500">Envie o comprovante para liberação imediata no WhatsApp oficial Parvus Space.</p>
            </div>
          </div>
          <a
            href={buildWhatsAppCheckoutUrl({
              planName: 'Dúvidas e Negociação',
              userName,
              userEmail,
              userId,
              phone: '5519994656845'
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebd58] text-white font-bold py-2.5 px-5 rounded-xl transition-all whitespace-nowrap uppercase text-xs tracking-wider shrink-0"
          >
            <MessageCircle size={16} />
            Falar no WhatsApp (19 99465-6845)
          </a>
        </div>
      </div>
    </div>
  );
}
