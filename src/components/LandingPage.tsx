import React, { useEffect, useState } from 'react';
import { Bot, Code2, Network, ChevronRight, Zap, Shield, Sparkles, Terminal } from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const [matrixText, setMatrixText] = useState('');
  const [glitchTitle, setGlitchTitle] = useState('ENGENHARIA AUTÔNOMA');

  useEffect(() => {
    const text = "PARVUS_AUTOMATE_OS // INITIALIZING AI CORE // SYNCING GLOBAL SYSTEMS... SUCCESS // PROTOCOL MATRIX_GREEN ENGAGED //";
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setMatrixText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
    const original = 'ENGENHARIA AUTÔNOMA';
    
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.8) {
        const arr = original.split('');
        const idx = Math.floor(Math.random() * arr.length);
        if (arr[idx] !== ' ') {
          arr[idx] = chars[Math.floor(Math.random() * chars.length)];
          setGlitchTitle(arr.join(''));
          setTimeout(() => setGlitchTitle(original), 100);
        }
      }
    }, 500);
    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-[#00ff88] font-mono overflow-x-hidden selection:bg-[#00ff88] selection:text-black">
      {/* Background Matrix Effect Overlay (Subtle) */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00ff88]/5 via-black to-black z-0"></div>
      
      {/* Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik00MCAwSDB2NDBoNDBWMHptLTEgMWwzOCAzOHYtMzhIMzl6IiBmaWxsPSIjMDBmZjg4IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz4KPC9zdmc+')]"></div>

      {/* Navbar */}
      <nav className="relative z-10 border-b border-[#00ff88]/20 bg-black/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Terminal className="text-[#00ff88]" size={28} />
          <span className="font-bold text-xl tracking-widest uppercase">Parvus<span className="text-white">Automate</span></span>
        </div>
        <button 
          onClick={onEnter}
          className="border border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88] hover:text-black px-6 py-2 rounded-none transition-all uppercase tracking-widest text-sm font-bold animate-pulse hover:animate-none shadow-[0_0_15px_rgba(0,255,136,0.2)] hover:shadow-[0_0_25px_rgba(0,255,136,0.6)]"
        >
          Acessar Sistema
        </button>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-24">
        <div className="inline-block border border-[#00ff88]/30 bg-[#00ff88]/5 px-4 py-1 mb-6 text-xs text-[#00ff88] uppercase tracking-widest font-bold">
          {matrixText}<span className="animate-pulse">_</span>
        </div>
        <h1 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter mb-8 leading-[0.9]">
          A Evolução da <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff88] to-white animate-pulse">{glitchTitle}</span>
        </h1>
        
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="flex-1 border-l-2 border-[#00ff88] pl-6 py-2">
            <p className="text-lg md:text-xl text-gray-400 leading-relaxed font-sans">
              O mercado de Hiperautomação, SaaS e IoT movimenta mais de <strong className="text-white text-2xl tracking-tight">R$ 1.5 Trilhões</strong> anualmente. O maior gargalo das empresas não é a falta de ideias, é o <strong>abismo da execução</strong>.
            </p>
          </div>
          <div className="flex-1 bg-[#111] border border-[#00ff88]/20 p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff88] to-transparent opacity-50"></div>
            <div className="flex items-start gap-4">
              <Bot size={24} className="text-[#00ff88] shrink-0 mt-1" />
              <p className="text-sm text-gray-300 font-sans leading-relaxed">
                O Parvus Automate destrói a barreira técnica. Atuando como um Arquiteto e Engenheiro Sênior 24/7, ele converte briefings em linguagem natural diretamente para código estruturado, arquiteturas IoT e painéis operacionais completos.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={onEnter}
            className="bg-[#00ff88] text-black font-black uppercase tracking-widest px-10 py-5 flex items-center gap-3 hover:bg-white transition-all hover:scale-[1.02] shadow-[0_0_30px_rgba(0,255,136,0.4)]"
          >
            Iniciar Compilação <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Marquee Stats */}
      <div className="relative z-10 border-y border-[#00ff88]/30 bg-[#00ff88]/10 py-6 overflow-hidden flex whitespace-nowrap backdrop-blur-sm">
        <div className="animate-marquee flex gap-12 text-sm font-black uppercase tracking-widest text-[#00ff88]">
          <span>&gt; Zero Setup</span>
          <span className="text-white">///</span>
          <span>&gt; IoT Ready</span>
          <span className="text-white">///</span>
          <span>&gt; 10x Mais Rápido</span>
          <span className="text-white">///</span>
          <span>&gt; Escala Infinita</span>
          <span className="text-white">///</span>
          <span>&gt; Integração Nativa</span>
          <span className="text-white">///</span>
          <span>&gt; Custo Reduzido em 90%</span>
          <span className="text-white">///</span>
          <span>&gt; Zero Setup</span>
          <span className="text-white">///</span>
          <span>&gt; IoT Ready</span>
          <span className="text-white">///</span>
          <span>&gt; 10x Mais Rápido</span>
          <span className="text-white">///</span>
          <span>&gt; Escala Infinita</span>
        </div>
      </div>

      {/* The Bottleneck / Solution Section */}
      <div id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-32">
        <div className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-6 leading-tight">O Fim do Gargalo Operacional</h2>
            <p className="text-gray-400 font-sans text-lg">
              Sprints de meses, orçamentos estourados e falhas de integração são obsoletos. O Parvus Automate reduz o ciclo de desenvolvimento em 90%, entregando soluções limpas e modulares que as empresas precisam agora.
            </p>
          </div>
          <div className="border border-white/10 bg-[#050505] p-6 font-mono text-xs text-gray-500 rounded flex flex-col gap-2">
            <div className="flex gap-2 text-gray-600"><span className="text-red-500">[-]</span> <span>Traditional_Dev: Sprint planning (2 wks)</span></div>
            <div className="flex gap-2 text-gray-600"><span className="text-red-500">[-]</span> <span>Traditional_Dev: Backend setup (4 wks)</span></div>
            <div className="flex gap-2 text-gray-600"><span className="text-red-500">[-]</span> <span>Traditional_Dev: Hardware integration (6 wks)</span></div>
            <div className="w-full h-[1px] bg-white/5 my-2"></div>
            <div className="flex gap-2 text-[#00ff88]"><span className="text-white">[+]</span> <span>Parvus_AI: Initialize Briefing</span></div>
            <div className="flex gap-2 text-[#00ff88]"><span className="text-white">[+]</span> <span>Parvus_AI: Generate Full Stack (2 min)</span></div>
            <div className="flex gap-2 text-[#00ff88]"><span className="text-white">[+]</span> <span>Parvus_AI: Deploy & Scale</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-[#00ff88]/30 bg-black p-8 group hover:bg-[#00ff88]/5 transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff88]"></div>
            <Code2 size={36} className="text-[#00ff88] mb-6" />
            <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-widest">Software Autônomo</h3>
            <p className="text-gray-400 text-sm leading-relaxed font-sans">
              Converta requisitos não-técnicos em interfaces complexas, regras de negócio completas e estruturas de banco de dados instantaneamente, sem escrever código manual.
            </p>
          </div>

          <div className="border border-white/20 bg-black p-8 group hover:border-white/40 transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-white"></div>
            <Network size={36} className="text-white mb-6" />
            <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-widest">Engenharia IoT</h3>
            <p className="text-gray-400 text-sm leading-relaxed font-sans">
              Módulo focado em mecatrônica. Geração de firmware C/C++, pinouts de alta precisão e especificação de componentes para conectar o mundo físico à nuvem.
            </p>
          </div>

          <div className="border border-[#00ff88]/30 bg-[#00ff88]/10 p-8 group hover:bg-[#00ff88]/20 transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff88]"></div>
            <Shield size={36} className="text-[#00ff88] mb-6" />
            <h3 className="text-xl font-bold text-[#00ff88] mb-4 uppercase tracking-widest">White-Label Agency</h3>
            <p className="text-gray-400 text-sm leading-relaxed font-sans text-white/80">
              Crie agências de software como serviço. Empacote as gerações e revenda para o mercado B2B, faturando alto em cima do poder produtivo da nossa infraestrutura.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="relative z-10 border-t border-[#00ff88]/30 bg-[#050505] py-32 text-center flex flex-col items-center">
        <Terminal size={48} className="text-[#00ff88] mb-8 opacity-50" />
        <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-8">System.Init()</h2>
        <button 
          onClick={onEnter}
          className="border-2 border-[#00ff88] text-[#00ff88] font-black uppercase tracking-widest px-12 py-5 hover:bg-[#00ff88] hover:text-black transition-all shadow-[0_0_40px_rgba(0,255,136,0.2)] hover:shadow-[0_0_60px_rgba(0,255,136,0.6)]"
        >
          Acessar Terminal AI
        </button>
      </div>
      
      {/* Tailwind custom animation for marquee */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}} />
    </div>
  );
}
