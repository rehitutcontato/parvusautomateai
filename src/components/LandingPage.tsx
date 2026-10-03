import React, { useEffect, useState } from 'react';
import { 
  Bot, Code2, Network, ChevronRight, Zap, Shield, Sparkles, Terminal, 
  CheckCircle2, ArrowRight, Star, Cpu, Layers, DollarSign, HelpCircle, 
  ChevronDown, MessageCircle, ExternalLink, Activity, Play, Download
} from 'lucide-react';
import { PLANS } from '../lib/plans.config';
import { supabase } from '../lib/supabase';
import { buildWhatsAppCheckoutUrl } from '../lib/whatsappCheckout';

interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const [matrixText, setMatrixText] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; id: string }>({
    name: '',
    email: '',
    id: ''
  });

  // Fetch current session if available to enrich checkout messages
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserProfile({
          name: session.user.user_metadata?.nome || session.user.email?.split('@')[0] || 'Usuário',
          email: session.user.email || '',
          id: session.user.id || ''
        });
      }
    });
  }, []);

  useEffect(() => {
    const text = "PARVUS_AUTOMATE_CORE // POWERED BY PARVUS SPACE (parvuspace.com.br) // GLM-5.1 COGNITIVE ENGINE ACTIVE // READY";
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setMatrixText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 25);
    return () => clearInterval(interval);
  }, []);

  const getWhatsAppPlanUrl = (planName: string, planPrice: number) => {
    return buildWhatsAppCheckoutUrl({
      planName,
      planPrice,
      userName: userProfile.name || 'Cliente Parvus',
      userEmail: userProfile.email,
      userId: userProfile.id,
      phone: '5519994656845'
    });
  };

  const faqs = [
    {
      q: 'Como funciona a contratação e ativação dos planos?',
      a: 'A contratação é realizada diretamente via PIX com nosso time oficial pelo WhatsApp (19 99465-6845). Basta clicar no plano desejado, enviar a mensagem pré-formatada e anexar o comprovante. Nossa equipe ativa o seu limite e funcionalidades no sistema em poucos minutos!'
    },
    {
      q: 'O código-fonte gerado pertence a mim? Posso comercializar?',
      a: 'Sim, 100%! Todo o código (Single Page Applications, microsserviços Node.js, firmware C++ para ESP32 e schemas SQL) é de sua propriedade irrestrita. Você pode hospedar, customizar, integrar ou revender aos seus clientes B2B sem royalties.'
    },
    {
      q: 'Preciso ter conhecimentos avançados de programação para usar?',
      a: 'Não. O motor de inteligência artificial da Parvus Space foi projetado para atuar como um Arquiteto e Engenheiro Sênior. Você descreve a necessidade em português claro ou preenche um briefing estruturado, e o sistema projeta a solução completa pronta para rodar.'
    },
    {
      q: 'Quais inteligências artificiais e modelos alimentam a plataforma?',
      a: 'Utilizamos clusters de alta performance NVIDIA NIM com os modelos Z-AI GLM 5.1/5.2/5.3 Thinking, NVIDIA Nemotron, DeepSeek R1 e Google Gemini 3 Flash, combinados com parsers de engenharia que garantem saídas sem erros de sintaxe.'
    },
    {
      q: 'O que é o Ecossistema Parvus Space?',
      a: 'A Parvus Space (parvuspace.com.br) é uma empresa de ponta dedicada ao desenvolvimento de softwares de hiperautomação, plataformas corporativas e soluções avançadas de Internet das Coisas (IoT). O Parvus Automate é sua principal plataforma de engenharia de software autônoma.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#050608] text-[#f0f0f0] font-sans overflow-x-hidden selection:bg-[#00ff88]/30 selection:text-white relative">
      
      {/* Dynamic Background Glow Orbs */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[500px] bg-gradient-to-b from-[#00ff88]/10 via-[#00d4ff]/5 to-transparent blur-[140px] pointer-events-none -z-10"></div>
      <div className="fixed top-1/2 right-0 w-[500px] h-[600px] bg-gradient-to-b from-[#7928ca]/10 via-[#00d4ff]/5 to-transparent blur-[150px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 left-10 w-[500px] h-[400px] bg-gradient-to-t from-[#00ff88]/5 to-transparent blur-[120px] pointer-events-none -z-10"></div>

      {/* Grid Pattern overlay */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-15 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]"></div>

      {/* Modern Sticky Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050608]/85 backdrop-blur-2xl px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00ff88] to-[#00d4ff] flex items-center justify-center font-black text-black text-xl shadow-[0_0_20px_rgba(0,255,136,0.35)]">
              P
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-tight font-display text-white flex items-center gap-1.5 leading-none">
                PARVUS<span className="text-[#00ff88]">AUTOMATE</span>
              </div>
              <div className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">
                by Parvus Space • <a href="https://parvuspace.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ff88] transition-colors">parvuspace.com.br</a>
              </div>
            </div>
          </div>

          {/* Nav Links (Desktop) */}
          <div className="hidden lg:flex items-center gap-8 text-xs font-medium text-gray-300">
            <a href="#recursos" className="hover:text-[#00ff88] transition-colors">Recursos</a>
            <a href="#arquitetura" className="hover:text-[#00ff88] transition-colors">Arquitetura</a>
            <a href="#comparativo" className="hover:text-[#00ff88] transition-colors">Comparativo</a>
            <a href="#planos" className="hover:text-[#00ff88] transition-colors text-white font-bold flex items-center gap-1">
              <Sparkles size={12} className="text-[#00ff88]" />
              Planos & Preços
            </a>
            <a href="#faq" className="hover:text-[#00ff88] transition-colors">FAQ</a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <a 
              href="https://wa.me/5519994656845?text=Ol%C3%A1%20Pablo!%20Gostaria%20de%20tirar%20d%C3%BAvidas%20sobre%20o%20Parvus%20Automate."
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 border border-white/10 hover:border-[#25D366]/50 bg-white/5 hover:bg-[#25D366]/10 text-gray-200 hover:text-[#25D366] px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
              <MessageCircle size={15} className="text-[#25D366]" />
              Falar com Pablo
            </a>
            <button 
              onClick={onEnter}
              className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-extrabold px-5 py-2 rounded-xl text-xs uppercase tracking-wider transition-all hover:scale-[1.03] shadow-[0_0_25px_rgba(0,255,136,0.35)] flex items-center gap-2"
            >
              Acessar Plataforma <ArrowRight size={14} />
            </button>
          </div>

        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-20">
        
        {/* Terminal Live Ticker Badge */}
        <div className="inline-flex items-center gap-2 border border-[#00ff88]/30 bg-[#00ff88]/5 px-3.5 py-1.5 rounded-full mb-8 text-xs text-[#00ff88] font-mono tracking-wide max-w-full overflow-hidden text-ellipsis whitespace-nowrap shadow-[0_0_15px_rgba(0,255,136,0.1)]">
          <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping shrink-0"></span>
          <span className="truncate">{matrixText}</span>
        </div>

        {/* Main Hero Headline */}
        <div className="max-w-4xl">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white uppercase tracking-tight leading-[1.05] font-display mb-6">
            A Nova Era da <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff88] via-[#00d4ff] to-white">
              Engenharia Autônoma
            </span>
          </h1>
          <p className="text-base sm:text-xl text-gray-300 leading-relaxed font-sans max-w-2xl mb-10">
            Converta requisitos em linguagem natural em <strong>Single Page Applications reativas</strong>, microsserviços Node.js de produção e firmware C++ mecatrônico para ESP32 em menos de 2 minutos. Desenvolvido pela <strong>Parvus Space</strong> para exterminar o gargalo da execução de software.
          </p>
        </div>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center gap-4 mb-16">
          <button 
            onClick={onEnter}
            className="bg-[#00ff88] hover:bg-[#00ff88]/90 text-black font-extrabold text-sm uppercase tracking-wider px-8 py-4 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.02] shadow-[0_0_35px_rgba(0,255,136,0.35)]"
          >
            <Zap size={18} fill="black" />
            Iniciar no Gerador Grátis
          </button>
          
          <a 
            href="#planos"
            className="border border-white/20 hover:border-[#00d4ff] bg-white/5 hover:bg-[#00d4ff]/10 text-white font-bold text-sm px-7 py-4 rounded-xl flex items-center gap-2 transition-all"
          >
            <Sparkles size={16} className="text-[#00d4ff]" />
            Ver Planos & Upgrade
          </a>

          <a 
            href="https://wa.me/5519994656845?text=Ol%C3%A1%20Pablo!%20Tenho%20interesse%20em%20uma%20apresenta%C3%A7%C3%A3o%20do%20Parvus%20Automate."
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 ml-2 py-2"
          >
            <MessageCircle size={15} className="text-[#25D366]" />
            Suporte WhatsApp: <strong>(19) 99465-6845</strong>
          </a>
        </div>

        {/* Live Compilation Interactive Mockup */}
        <div className="border border-white/15 rounded-2xl bg-[#0a0c13] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Mockup Header Bar */}
          <div className="bg-[#10121a] border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
              <span className="ml-3 text-xs font-mono text-gray-400">parvus-automate-core ~ live_workspace</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400">
              <span className="flex items-center gap-1 text-[#00ff88]">
                <Activity size={12} className="animate-pulse" /> CLUSTER ONLINE
              </span>
              <span className="hidden sm:inline bg-white/5 px-2 py-0.5 rounded text-gray-300">
                GLM-5.1 Thinking
              </span>
            </div>
          </div>

          {/* Mockup Code / UI split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            {/* Left Terminal Logs */}
            <div className="lg:col-span-5 p-5 font-mono text-xs text-gray-300 bg-[#07080d] space-y-3">
              <div className="text-gray-500 text-[11px] pb-2 border-b border-white/5">
                // EXECUÇÃO DO BRIEFING EM TEMPO REAL
              </div>
              <p className="text-[#00ff88]">&gt; Input: "Criar CRM de Vendas com telemetria WhatsApp e painel IoT"</p>
              <p className="text-gray-400">&gt; Auditoria de engenharia: Sistema classificado como HIBRIDO</p>
              <p className="text-gray-400">&gt; Gerando SPA Reativa: Tailwind CSS + Local Data Store (100% interativo)</p>
              <p className="text-[#00d4ff]">&gt; Gerando microsserviço Express: 7 endpoints RESTful + Schema Supabase</p>
              <p className="text-[#9b59b6]">&gt; Compilando firmware C++: ESP32 FreeRTOS com MQTT e reconexão Wi-Fi</p>
              <div className="pt-2 flex items-center gap-2 text-white font-bold">
                <CheckCircle2 size={16} className="text-[#00ff88]" />
                <span>Solução compilada com sucesso em 48.2s</span>
              </div>
            </div>

            {/* Right Visual Result Preview */}
            <div className="lg:col-span-7 p-6 bg-gradient-to-br from-[#0c0e17] to-[#07090f] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-[#00ff88]/10 text-[#00ff88] text-xs font-bold font-mono">
                      PREVIEW GERADO
                    </span>
                    <span className="text-xs text-gray-400">CRM de Vendas High-Tech</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono">Status: Pronto para Produção</span>
                </div>
                
                {/* Micro UI cards inside preview */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/[0.03] border border-white/10 p-3 rounded-xl">
                    <div className="text-[10px] text-gray-400">Leads Ativos</div>
                    <div className="text-xl font-bold text-white font-display">1.482</div>
                    <div className="text-[10px] text-[#00ff88] font-mono mt-1">+24% hoje</div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 p-3 rounded-xl">
                    <div className="text-[10px] text-gray-400">Pipeline Total</div>
                    <div className="text-xl font-bold text-white font-display">R$ 94.2k</div>
                    <div className="text-[10px] text-[#00d4ff] font-mono mt-1">12 fechamentos</div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/10 p-3 rounded-xl">
                    <div className="text-[10px] text-gray-400">Telemetria IoT</div>
                    <div className="text-xl font-bold text-white font-display">24.8°C</div>
                    <div className="text-[10px] text-emerald-400 font-mono mt-1">Normal</div>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl text-xs text-gray-300 font-mono flex items-center justify-between">
                  <span>Exportação instantânea:</span>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-gray-300">ZIP Completo</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-gray-300">Dockerfile</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-[#00ff88]">Schema SQL</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-gray-400">Quer compilar seu projeto agora?</span>
                <button 
                  onClick={onEnter} 
                  className="bg-white text-black font-extrabold px-4 py-2 rounded-lg text-xs uppercase tracking-wider hover:bg-[#00ff88] transition-colors"
                >
                  Testar no App
                </button>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Metrics Banner */}
      <section className="relative z-10 border-y border-white/10 bg-[#090b12]/60 backdrop-blur-xl py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-display mb-1">
              +15.000
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-mono">
              Soluções Compiladas
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#00ff88] font-display mb-1">
              90%
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-mono">
              Economia de Custo & Tempo
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#00d4ff] font-display mb-1">
              &lt; 2 min
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-mono">
              Tempo Médio de Geração
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-display mb-1">
              99.8%
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-mono">
              Precisão de Código & Schema
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section id="recursos" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-28">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] text-xs font-bold uppercase tracking-wider mb-4">
            Pilares Tecnológicos
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white uppercase tracking-tight font-display mb-4">
            Capacidades Industriais de Ponta a Ponta
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Muito além de snippets de código. O Parvus Automate entrega a arquitetura completa para lançar novos produtos digitais ou conectar instalações físicas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="bg-[#0b0d14] border border-white/10 hover:border-[#00ff88]/50 p-8 rounded-2xl transition-all relative overflow-hidden group">
            <div className="w-12 h-12 rounded-xl bg-[#00ff88]/10 flex items-center justify-center text-[#00ff88] mb-6 border border-[#00ff88]/20">
              <Code2 size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight font-display">
              Software Autônomo & SPA
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-6">
              Interfaces modernas com Tailwind CSS, reatividade com store de dados local, filtros de busca instantâneos, modais de cadastro e gráficos SVG recalculados dinamicamente.
            </p>
            <ul className="text-xs text-gray-300 space-y-2 border-t border-white/5 pt-4 font-mono">
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#00ff88]" /> SPA Single-File auto-suficiente
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#00ff88]" /> Simulador de Terminal ao vivo
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#00ff88]" /> Zero dependências quebradas
              </li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0b0d14] border border-white/10 hover:border-[#00d4ff]/50 p-8 rounded-2xl transition-all relative overflow-hidden group">
            <div className="w-12 h-12 rounded-xl bg-[#00d4ff]/10 flex items-center justify-center text-[#00d4ff] mb-6 border border-[#00d4ff]/20">
              <Network size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight font-display">
              Engenharia IoT & Mecatrônica
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-6">
              Geração de firmware C++ não-bloqueante para microcontroladores ESP32/ESP8266 com MQTT, tarefas FreeRTOS, mapeamento de pinagem físico e lista de peças com preços no Brasil.
            </p>
            <ul className="text-xs text-gray-300 space-y-2 border-t border-white/5 pt-4 font-mono">
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#00d4ff]" /> Código compilável na Arduino IDE
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#00d4ff]" /> Manual de montagem passo a passo
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#00d4ff]" /> PDFs técnicos automáticos
              </li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0b0d14] border border-white/10 hover:border-[#9b59b6]/50 p-8 rounded-2xl transition-all relative overflow-hidden group">
            <div className="w-12 h-12 rounded-xl bg-[#9b59b6]/10 flex items-center justify-center text-[#9b59b6] mb-6 border border-[#9b59b6]/20">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight font-display">
              Modo Agência & White-Label
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-6">
              Estruture sua própria fábrica de software como serviço. Gere projetos 100% white-label para revender a empresas terceiras, lucrando alto sobre a infraestrutura da Parvus Space.
            </p>
            <ul className="text-xs text-gray-300 space-y-2 border-t border-white/5 pt-4 font-mono">
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#9b59b6]" /> Remoção total de marcas
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#9b59b6]" /> Licença comercial irrestrita
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <CheckCircle2 size={13} className="text-[#9b59b6]" /> Marketplace de automações
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparativo" className="relative z-10 border-t border-white/10 bg-[#080a10] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight font-display mb-4">
              Desenvolvimento Tradicional vs Parvus Automate
            </h2>
            <p className="text-sm text-gray-400">
              Veja por que empresas e consultores estão substituindo meses de espera pela compilação autônoma.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Old Way */}
            <div className="bg-[#0f1118]/80 border border-red-500/20 p-6 sm:p-8 rounded-2xl space-y-4">
              <div className="text-xs font-mono font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Método Convencional
              </div>
              <ul className="space-y-4 text-xs sm:text-sm text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-red-400 font-bold shrink-0">✕</span>
                  <span><strong>30 a 90 dias</strong> para prototipar um MVP funcional.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-400 font-bold shrink-0">✕</span>
                  <span>Custo médio de <strong>R$ 15.000 a R$ 40.000</strong> com equipe dev sênior.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-400 font-bold shrink-0">✕</span>
                  <span>Gargalos em integrar placas IoT, firmware e endpoints web.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-400 font-bold shrink-0">✕</span>
                  <span>Dependência contínua de programadores para qualquer pequena alteração.</span>
                </li>
              </ul>
            </div>

            {/* Parvus Automate Way */}
            <div className="bg-[#0b1418]/90 border-2 border-[#00ff88]/60 p-6 sm:p-8 rounded-2xl space-y-4 shadow-[0_0_30px_rgba(0,255,136,0.15)] relative">
              <div className="absolute -top-3 right-6 bg-[#00ff88] text-black font-extrabold text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full">
                Alta Eficiência
              </div>
              <div className="text-xs font-mono font-bold text-[#00ff88] uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span> Parvus Automate
              </div>
              <ul className="space-y-4 text-xs sm:text-sm text-gray-200">
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-[#00ff88] shrink-0 mt-0.5" />
                  <span><strong>Menos de 2 minutos</strong> para arquitetura completa ponta a ponta.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-[#00ff88] shrink-0 mt-0.5" />
                  <span>Planos acessíveis a partir de <strong>R$ 197/mês</strong> com PIX direto.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-[#00ff88] shrink-0 mt-0.5" />
                  <span>Geração nativa de esquemáticos mecatrônicos e firmware ESP32.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-[#00ff88] shrink-0 mt-0.5" />
                  <span>Exportação instantânea de ZIP, Dockerfiles e scripts SQL de banco.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING & PLANS SECTION (NEW & COMPREHENSIVE) */}
      <section id="planos" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-28">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-xs font-bold uppercase tracking-wider mb-4">
            Investimento & Upgrade
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white uppercase tracking-tight font-display mb-4">
            Planos Sob Medida para o Seu Nível
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Liberação imediata via WhatsApp oficial (19 99465-6845). Escolha o plano ideal e turbine sua capacidade de entrega.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          
          {/* Free / Teste */}
          <div className="bg-[#0b0c12] border border-white/10 p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white tracking-tight">{PLANS.free.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">Degustação</span>
              </div>
              <div className="text-3xl font-black text-white font-display my-3">
                R$ 0
                <span className="text-xs font-normal text-gray-400 font-sans">/grátis</span>
              </div>
              <p className="text-xs text-gray-400 mb-6">Para testar a inteligência do motor sem compromisso.</p>
              <ul className="text-xs text-gray-300 space-y-2.5 mb-8">
                {PLANS.free.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-gray-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={onEnter}
              className="w-full text-center bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all"
            >
              Testar Gratuitamente
            </button>
          </div>

          {/* Starter */}
          <div className="bg-[#0b0c12] border border-white/15 hover:border-white/30 p-6 rounded-2xl flex flex-col justify-between transition-all">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white tracking-tight">{PLANS.starter.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-gray-200">
                  {PLANS.starter.generations} Gerações/mês
                </span>
              </div>
              <div className="text-3xl font-black text-white font-display my-3">
                R$ {PLANS.starter.price}
                <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
              </div>
              <p className="text-xs text-gray-400 mb-6">Ideal para validação rápida de projetos pontuais.</p>
              <ul className="text-xs text-gray-300 space-y-2.5 mb-8">
                {PLANS.starter.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00ff88] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={getWhatsAppPlanUrl(PLANS.starter.name, PLANS.starter.price)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={15} />
              Contratar Starter
            </a>
          </div>

          {/* Creator */}
          <div className="bg-[#0b0c12] border border-[#9b59b6]/40 hover:border-[#9b59b6] p-6 rounded-2xl flex flex-col justify-between transition-all relative">
            <div className="absolute -top-3 right-5 bg-[#9b59b6] text-black font-black text-[9px] uppercase tracking-wider px-3 py-0.5 rounded-full">
              IoT + WhiteLabel
            </div>
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white tracking-tight">{PLANS.creator.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#9b59b6]/20 text-[#9b59b6]">
                  {PLANS.creator.generations} Gerações/mês
                </span>
              </div>
              <div className="text-3xl font-black text-white font-display my-3">
                R$ {PLANS.creator.price}
                <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
              </div>
              <p className="text-xs text-gray-400 mb-6">Para desenvolvedores, makers e engenheiros de automação.</p>
              <ul className="text-xs text-gray-300 space-y-2.5 mb-8">
                {PLANS.creator.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#9b59b6] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={getWhatsAppPlanUrl(PLANS.creator.name, PLANS.creator.price)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-[#9b59b6]/20 hover:bg-[#9b59b6] text-white hover:text-black font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={15} />
              Contratar Creator
            </a>
          </div>

          {/* Pro - Mais Popular */}
          <div className="bg-[#0e131d] border-2 border-[#00ff88] p-6 rounded-2xl flex flex-col justify-between transition-all relative shadow-[0_0_35px_rgba(0,255,136,0.2)]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-black text-[10px] uppercase tracking-wider px-3.5 py-0.5 rounded-full flex items-center gap-1.5">
              <Star size={12} fill="black" />
              Mais Popular • Recomendado
            </div>
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white tracking-tight">{PLANS.pro.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00ff88]/20 text-[#00ff88] font-bold">
                  {PLANS.pro.generations} Gerações/mês
                </span>
              </div>
              <div className="text-3xl font-black text-white font-display my-3">
                R$ {PLANS.pro.price}
                <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
              </div>
              <p className="text-xs text-[#00ff88] mb-6">Máximo poder para produção frequente e clientes comerciais.</p>
              <ul className="text-xs text-gray-200 space-y-2.5 mb-8">
                {PLANS.pro.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00ff88] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={getWhatsAppPlanUrl(PLANS.pro.name, PLANS.pro.price)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-[#00ff88] hover:bg-[#00ff88]/90 text-black font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,136,0.4)] hover:scale-[1.02]"
            >
              <Zap size={15} fill="black" />
              Assinar Plano Pro
            </a>
          </div>

          {/* Agency */}
          <div className="bg-[#0b0c12] border border-[#f1c40f]/40 hover:border-[#f1c40f] p-6 rounded-2xl flex flex-col justify-between transition-all relative">
            <div className="absolute -top-3 right-5 bg-[#f1c40f] text-black font-black text-[9px] uppercase tracking-wider px-3 py-0.5 rounded-full">
              Escritórios B2B
            </div>
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white tracking-tight">{PLANS.agency.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f1c40f]/20 text-[#f1c40f]">
                  {PLANS.agency.generations} Gerações/mês
                </span>
              </div>
              <div className="text-3xl font-black text-white font-display my-3">
                R$ {PLANS.agency.price}
                <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
              </div>
              <p className="text-xs text-gray-400 mb-6">Para agências de software que faturam criando soluções para terceiros.</p>
              <ul className="text-xs text-gray-300 space-y-2.5 mb-8">
                {PLANS.agency.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#f1c40f] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={getWhatsAppPlanUrl(PLANS.agency.name, PLANS.agency.price)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-[#f1c40f]/20 hover:bg-[#f1c40f] text-white hover:text-black font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={15} />
              Contratar Agency
            </a>
          </div>

          {/* Enterprise */}
          <div className="bg-gradient-to-br from-[#0c121e] to-[#080d17] border border-[#00d4ff]/40 hover:border-[#00d4ff] p-6 rounded-2xl flex flex-col justify-between transition-all relative shadow-[0_0_30px_rgba(0,212,255,0.15)]">
            <div className="absolute -top-3 right-5 bg-[#00d4ff] text-black font-black text-[9px] uppercase tracking-wider px-3 py-0.5 rounded-full">
              SLA Corporativo
            </div>
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white tracking-tight">{PLANS.enterprise.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00d4ff]/20 text-[#00d4ff]">
                  {PLANS.enterprise.generations} Gerações/mês
                </span>
              </div>
              <div className="text-3xl font-black text-white font-display my-3">
                R$ {PLANS.enterprise.price}
                <span className="text-xs font-normal text-gray-400 font-sans">/mês</span>
              </div>
              <p className="text-xs text-gray-400 mb-6">Operações críticas, suporte direto 24/7 e arquiteturas exclusivas.</p>
              <ul className="text-xs text-gray-300 space-y-2.5 mb-8">
                {PLANS.enterprise.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00d4ff] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={getWhatsAppPlanUrl(PLANS.enterprise.name, PLANS.enterprise.price)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center bg-gradient-to-r from-[#00d4ff] to-[#00ff88] text-black font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-[#00d4ff]/20"
            >
              <Zap size={15} fill="black" />
              Contratar Enterprise
            </a>
          </div>

        </div>

        {/* WhatsApp Checkout Direct Callout */}
        <div className="bg-[#0b0f19] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="text-lg font-bold text-white flex items-center gap-2 justify-center md:justify-start">
              <MessageCircle className="text-[#25D366]" size={20} />
              Deseja uma condição customizada ou tirar dúvidas?
            </h4>
            <p className="text-xs text-gray-400">
              Fale diretamente com Pablo Nunes Pereira, fundador e mantenedor do projeto via WhatsApp.
            </p>
          </div>
          <a
            href={buildWhatsAppCheckoutUrl({
              planName: 'Atendimento Personalizado',
              userName: userProfile.name || 'Cliente Parvus',
              userEmail: userProfile.email,
              userId: userProfile.id,
              phone: '5519994656845'
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#1ebd58] text-white font-extrabold px-6 py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 shadow-[0_0_20px_rgba(37,211,102,0.3)]"
          >
            <MessageCircle size={17} />
            Conversar no WhatsApp (19 99465-6845)
          </a>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="relative z-10 border-t border-white/10 bg-[#06080e] py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-bold uppercase tracking-wider mb-4">
              Perguntas Frequentes
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight font-display mb-4">
              Tudo o que Você Precisa Saber
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-[#0b0d14] border border-white/10 rounded-xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left font-bold text-sm sm:text-base text-white flex items-center justify-between gap-4 hover:text-[#00ff88] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={18} className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#00ff88]' : 'text-gray-500'}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-gray-300 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="relative z-10 border-t border-white/10 bg-gradient-to-b from-[#080a12] to-[#040508] py-28 text-center px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#00ff88] to-[#00d4ff] flex items-center justify-center font-black text-black text-2xl mx-auto shadow-[0_0_40px_rgba(0,255,136,0.3)]">
            P
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight font-display">
            Pronto para Construir o Futuro?
          </h2>
          <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto">
            Acesse o terminal do Parvus Automate agora ou solicite a liberação do seu plano com nossa equipe.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button 
              onClick={onEnter}
              className="bg-[#00ff88] hover:bg-[#00ff88]/90 text-black font-extrabold text-sm uppercase tracking-wider px-10 py-4 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.03] shadow-[0_0_35px_rgba(0,255,136,0.4)]"
            >
              Acessar Plataforma Agora <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer Parvus Space */}
      <footer className="relative z-10 border-t border-white/10 bg-[#040406] py-12 px-4 sm:px-8 text-xs text-gray-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <div className="font-bold text-white text-sm font-display tracking-wider mb-1">
              PARVUS AUTOMATE
            </div>
            <p className="text-gray-400 text-[11px]">
              Desenvolvido pelo ecossistema <a href="https://parvuspace.com.br" target="_blank" rel="noopener noreferrer" className="text-[#00ff88] hover:underline font-bold">Parvus Space (parvuspace.com.br)</a>.
            </p>
            <p className="text-gray-500 text-[10px] mt-1">
              Todos os direitos reservados. CNPJ e atendimento oficial via WhatsApp: <strong>(19) 99465-6845</strong>
            </p>
          </div>
          <div className="flex items-center gap-6 text-gray-400 text-xs">
            <a href="https://parvuspace.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
              parvuspace.com.br <ExternalLink size={12} />
            </a>
            <a href="https://wa.me/5519994656845" target="_blank" rel="noopener noreferrer" className="hover:text-[#25D366] transition-colors">
              Suporte WhatsApp
            </a>
            <button onClick={onEnter} className="hover:text-white transition-colors">
              Terminal
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
