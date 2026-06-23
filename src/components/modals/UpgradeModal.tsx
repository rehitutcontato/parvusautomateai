import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Info, Shield, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PLANS } from '../../lib/plans.config';

interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [userName, setUserName] = useState('Usuário Parvus');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const getProfile = async () => {
      if (!supabase) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserEmail(session.user.email || '');
          const { data } = await supabase.from('profiles').select('nome').eq('id', session.user.id).single();
          if (data?.nome) {
            setUserName(data.nome);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar dados do perfil no modal:", err);
      }
    };
    getProfile();
  }, []);

  const getWhatsAppUrl = (planName: string) => {
    const emailStr = userEmail ? ` (E-mail: ${userEmail})` : '';
    const message = `Olá! Meu nome é ${userName}${emailStr} e gostaria de assinar ou alterar meu plano no Parvus Automate para o plano ${planName}!`;
    return `https://wa.me/5519994656845?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#111111] border border-[#00ff88]/20 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-[0_0_50px_rgba(0,255,136,0.1)] relative animate-in fade-in zoom-in duration-200 my-8">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          title="Fechar"
        >
          <X size={22} />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#00ff88]/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-[#00ff88]/30">
            <Info className="text-[#00ff88]" size={28} />
          </div>
          <h2 className="text-2xl font-black text-white mb-1 tracking-wider uppercase font-syne">Limite Mensal Atingido ⚠️</h2>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Você utilizou todas as cotas de gerações disponíveis no seu plano atual. Faça o upgrade agora para desbloquear o potencial completo da nossa IA!
          </p>
        </div>

        <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-2 mb-6">
          <h3 className="text-xs font-bold text-[#00ff88] uppercase tracking-widest">Planos Premium Disponíveis:</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Starter */}
            <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-white uppercase tracking-wider">{PLANS.starter.name}</span>
                  <span className="text-[#00ff88] font-mono text-xs font-bold">R$ {PLANS.starter.price}/mês</span>
                </div>
                <div className="text-[10px] text-gray-500 mb-3">{PLANS.starter.generations} Gerações/mês</div>
                <ul className="text-[11px] text-gray-400 space-y-1.5 mb-4">
                  {PLANS.starter.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-gray-600 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={getWhatsAppUrl('Starter')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-white/5 hover:bg-[#00ff88]/10 hover:text-[#00ff88] hover:border-[#00ff88]/30 text-white border border-white/10 font-bold py-2 rounded-lg text-xs uppercase transition-all cursor-pointer"
              >
                Escolher Starter
              </a>
            </div>

            {/* Creator */}
            <div className="bg-[#0a0a0a] border border-[#9b59b6]/30 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#9b59b6] text-black font-black text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-bl">IoT + WhiteLabel</div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-white uppercase tracking-wider">{PLANS.creator.name}</span>
                  <span className="text-[#9b59b6] font-mono text-xs font-bold">R$ {PLANS.creator.price}/mês</span>
                </div>
                <div className="text-[10px] text-gray-500 mb-3">{PLANS.creator.generations} Gerações/mês</div>
                <ul className="text-[11px] text-gray-400 space-y-1.5 mb-4">
                  {PLANS.creator.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-[#9b59b6] shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={getWhatsAppUrl('Creator')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-[#9b59b6]/10 hover:bg-[#9b59b6]/20 text-[#9b59b6] border border-[#9b59b6]/30 font-bold py-2 rounded-lg text-xs uppercase transition-all cursor-pointer"
              >
                Escolher Creator
              </a>
            </div>

            {/* Pro */}
            <div className="bg-[#0a0a0a] border border-[#ff6600]/30 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#ff6600] text-black font-black text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-bl">Mais Popular</div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-white uppercase tracking-wider">{PLANS.pro.name}</span>
                  <span className="text-[#ff6600] font-mono text-xs font-bold">R$ {PLANS.pro.price}/mês</span>
                </div>
                <div className="text-[10px] text-gray-500 mb-3">{PLANS.pro.generations} Gerações/mês</div>
                <ul className="text-[11px] text-gray-400 space-y-1.5 mb-4">
                  {PLANS.pro.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-[#ff6600] shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={getWhatsAppUrl('Pro')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-[#ff6600]/15 hover:bg-[#ff6600]/35 text-white border border-[#ff6600]/45 font-bold py-2 rounded-lg text-xs uppercase transition-all cursor-pointer"
              >
                Escolher Pro
              </a>
            </div>

            {/* Agency */}
            <div className="bg-[#0a0a0a] border border-[#f1c40f]/30 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-white uppercase tracking-wider">{PLANS.agency.name}</span>
                  <span className="text-[#f1c40f] font-mono text-xs font-bold">R$ {PLANS.agency.price}/mês</span>
                </div>
                <div className="text-[10px] text-gray-500 mb-3">{PLANS.agency.generations} Gerações/mês</div>
                <ul className="text-[11px] text-gray-400 space-y-1.5 mb-4">
                  {PLANS.agency.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-[#f1c40f] shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={getWhatsAppUrl('Agency')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-[#f1c40f]/10 hover:bg-[#f1c40f]/20 text-[#f1c40f] border border-[#f1c40f]/30 font-bold py-2 rounded-lg text-xs uppercase transition-all cursor-pointer"
              >
                Escolher Agency
              </a>
            </div>

            {/* Enterprise */}
            <div className="bg-[#0a0a0a] border border-[#00d4ff]/30 p-4 rounded-xl flex flex-col justify-between md:col-span-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-white uppercase tracking-wider">{PLANS.enterprise.name}</span>
                  <span className="text-[#00d4ff] font-mono text-xs font-bold">R$ {PLANS.enterprise.price}/mês</span>
                </div>
                <div className="text-[10px] text-gray-500 mb-3">{PLANS.enterprise.generations} Gerações/mês</div>
                <ul className="text-[11px] text-gray-400 grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
                  {PLANS.enterprise.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-[#00d4ff] shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={getWhatsAppUrl('Enterprise')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-gradient-to-r from-[#00d4ff] to-[#00ff88] text-black font-extrabold py-2.5 rounded-lg text-xs uppercase transition-all hover:brightness-110 cursor-pointer shadow-lg shadow-[#00d4ff]/10"
              >
                Escolher Enterprise
              </a>
            </div>
          </div>
        </div>

        <div className="text-center bg-[#0a0a0a] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-left text-xs text-gray-400">
            Deseja negociar condições especiais, suporte corporativo ou tirar alguma dúvida? Converse conosco agora:
          </p>
          <a
            href={getWhatsAppUrl('Upgrade Geral')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebd58] text-white font-bold py-2.5 px-5 rounded-lg text-xs uppercase transition-all whitespace-nowrap cursor-pointer shrink-0"
          >
            <MessageCircle size={15} />
            Suporte WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
