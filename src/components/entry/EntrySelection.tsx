import React from 'react';
import { Brain, Package, ClipboardList, Sparkles, Zap, FileText, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface EntrySelectionProps {
  onSelect: (flow: 'ai' | 'templates' | 'briefing') => void;
}

export function EntrySelection({ onSelect }: EntrySelectionProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 bg-[#0a0a0a] w-full min-h-[calc(100vh-64px)] overflow-y-auto relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[#00ff88]/5 blur-[120px] rounded-full pointer-events-none"></div>
      
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="max-w-6xl w-full relative z-10 m-auto py-8 sm:py-12"
      >
        <motion.div variants={itemVariants} className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-black mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50">
            Como você quer começar?
          </h1>
          <p className="text-[#888888] text-lg max-w-2xl mx-auto font-light">
            Escolha seu caminho para criar a automação perfeita. Descreva seu problema, use um template pronto ou seja guiado pelo nosso briefing inteligente.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Card 1: IA Pura */}
          <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="group relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#00ff88]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl blur-xl"></div>
            <div className="border border-white/10 bg-[#111111]/80 backdrop-blur-sm p-8 flex flex-col h-full rounded-2xl hover:border-[#00ff88]/50 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-[#00ff88]">
                 <Sparkles size={120} />
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-[#00ff88]/20 to-[#00ff88]/5 flex items-center justify-center rounded-xl mb-8 border border-[#00ff88]/30 shadow-[0_0_30px_rgba(0,255,136,0.1)] group-hover:shadow-[0_0_40px_rgba(0,255,136,0.2)] transition-all">
                <Brain size={32} className="text-[#00ff88]" />
              </div>
              
              <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-4">
                GERAR COM IA
              </h2>
              <p className="text-[#888888] leading-relaxed flex-1 mb-8">
                Descreva seu problema abertamente e deixe a inteligência artificial projetar a arquitetura e gerar a solução completa.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]"></div> Ideias claras e diretas
                </div>
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]"></div> Casos de uso únicos
                </div>
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]"></div> Arquiteturas complexas
                </div>
              </div>
              
              <button 
                onClick={() => onSelect('ai')}
                className="w-full py-4 rounded-xl bg-white text-black font-black text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(0,255,136,0.4)] transition-all duration-300 group-hover:bg-[#00ff88] flex items-center justify-center gap-2"
              >
                COMEÇAR <Zap size={16} className="text-current" />
              </button>
            </div>
          </motion.div>
          
          {/* Card 2: Templates */}
          <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="group relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0066ff]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl blur-xl"></div>
            <div className="border border-white/10 bg-[#111111]/80 backdrop-blur-sm p-8 flex flex-col h-full rounded-2xl hover:border-[#0066ff]/50 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-[#0066ff]">
                 <Package size={120} />
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-[#0066ff]/20 to-[#0066ff]/5 flex items-center justify-center rounded-xl mb-8 border border-[#0066ff]/30 shadow-[0_0_30px_rgba(0,102,255,0.1)] group-hover:shadow-[0_0_40px_rgba(0,102,255,0.2)] transition-all">
                <Package size={32} className="text-[#0066ff]" />
              </div>
              
              <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-4">
                TEMPLATES
              </h2>
              <p className="text-[#888888] leading-relaxed flex-1 mb-8">
                Explore nossa biblioteca de automações estruturadas. Escolha um modelo e customize com seus dados.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0066ff]"></div> Implantação rápida
                </div>
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0066ff]"></div> Padrões validados no mercado
                </div>
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0066ff]"></div> Ideal para iniciantes
                </div>
              </div>
              
              <button 
                onClick={() => onSelect('templates')}
                className="w-full py-4 rounded-xl border border-[#0066ff]/50 text-white font-black text-sm tracking-widest uppercase hover:bg-[#0066ff] hover:border-[#0066ff] hover:shadow-[0_0_30px_rgba(0,102,255,0.4)] transition-all duration-300 flex items-center justify-center gap-2"
              >
                EXPLORAR <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
          
          {/* Card 3: Briefing */}
          <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="group relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#ff6600]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl blur-xl"></div>
            <div className="border border-white/10 bg-[#111111]/80 backdrop-blur-sm p-8 flex flex-col h-full rounded-2xl hover:border-[#ff6600]/50 transition-all duration-300 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 text-[#ff6600]">
                 <FileText size={120} />
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-[#ff6600]/20 to-[#ff6600]/5 flex items-center justify-center rounded-xl mb-8 border border-[#ff6600]/30 shadow-[0_0_30px_rgba(255,102,0,0.1)] group-hover:shadow-[0_0_40px_rgba(255,102,0,0.2)] transition-all">
                <ClipboardList size={32} className="text-[#ff6600]" />
              </div>
              
              <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-4">
                BRIEFING
              </h2>
              <p className="text-[#888888] leading-relaxed flex-1 mb-8">
                Responda a um formulário guiado passo a passo para nos ajudar a extrair o melhor contexto para sua automação.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ff6600]"></div> Não sabe por onde começar?
                </div>
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ff6600]"></div> Escopo vago ou indefinido
                </div>
                <div className="flex items-center gap-2 text-sm text-[#ababab]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ff6600]"></div> Especificação direcionada
                </div>
              </div>
              
              <button 
                onClick={() => onSelect('briefing')}
                className="w-full py-4 rounded-xl border border-[#ff6600]/50 text-white font-black text-sm tracking-widest uppercase hover:bg-[#ff6600] hover:border-[#ff6600] hover:shadow-[0_0_30px_rgba(255,102,0,0.4)] transition-all duration-300 flex items-center justify-center gap-2"
              >
                INICIAR <ClipboardList size={16} />
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

