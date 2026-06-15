import React, { useState } from 'react';
import { ArrowLeft, Play, LayoutGrid, Database, Cpu, Globe, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BriefingFlowProps {
  onBack: () => void;
  onSubmit: (briefing: any) => void;
}

export function BriefingFlow({ onBack, onSubmit }: BriefingFlowProps) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<any>({
    tipo_problema: '',
    entrada: [],
    processamento: [],
    saida: [],
    setor: '',
    volume: '',
    frequencia: '',
    descricao: ''
  });

  const toggleArrayOption = (field: string, option: string) => {
    setAnswers((prev: any) => {
      const arr = prev[field] || [];
      if (arr.includes(option)) {
        return { ...prev, [field]: arr.filter((i: string) => i !== option) };
      } else {
        return { ...prev, [field]: [...arr, option] };
      }
    });
  };

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const isStepValid = () => {
    if (step === 1) return !!answers.tipo_problema;
    if (step === 2) return answers.entrada.length > 0;
    if (step === 3) return answers.processamento.length > 0;
    if (step === 4) return answers.saida.length > 0;
    if (step === 5) return !!answers.setor && !!answers.volume && !!answers.frequencia;
    return true;
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  };

  const [direction, setDirection] = useState(1);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            key="step1"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#ff6600]/10 flex items-center justify-center border border-[#ff6600]/30 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                <LayoutGrid size={24} className="text-[#ff6600]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">O que você quer automatizar?</h2>
                <p className="text-[#888888] font-light mt-1">Defina o objetivo principal do seu sistema.</p>
              </div>
            </div>
            
            <div className="grid gap-3">
            {[
              'Processar dados / registros',
              'Enviar notificações / alertas',
              'Monitorar sensores / hardware',
              'Integrar sistemas diferentes',
              'Gerar relatórios automaticamente',
              'Classificar informações',
              'Executar ações em tempo real'
            ].map(opt => (
              <label 
                key={opt} 
                className={`flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  answers.tipo_problema === opt 
                    ? 'border-[#ff6600] bg-[#ff6600]/5 shadow-[0_4px_20px_rgba(255,102,0,0.1)]' 
                    : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  answers.tipo_problema === opt ? 'border-[#ff6600]' : 'border-white/30'
                }`}>
                  {answers.tipo_problema === opt && <motion.div layoutId="radioObj" className="w-2.5 h-2.5 rounded-full bg-[#ff6600]"></motion.div>}
                </div>
                <input 
                  type="radio" 
                  name="tipo_problema" 
                  checked={answers.tipo_problema === opt}
                  onChange={() => setAnswers({ ...answers, tipo_problema: opt })}
                  className="hidden" 
                />
                <span className={`text-base font-medium transition-colors ${answers.tipo_problema === opt ? 'text-[#ff6600]' : 'text-white'}`}>
                  {opt}
                </span>
              </label>
            ))}
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            key="step2"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#ff6600]/10 flex items-center justify-center border border-[#ff6600]/30 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                <Database size={24} className="text-[#ff6600]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">De onde vêm os dados?</h2>
                <p className="text-[#888888] font-light mt-1">Selecione todas as fontes aplicáveis.</p>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Formulários da web', 'E-mails', 'API/Webhooks de terceiros', 
              'Sensores / Hardware', 'Banco de dados', 'Arquivo (CSV, Excel)', 'Redes sociais / APIs'
            ].map(opt => (
              <label 
                key={opt} 
                className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  answers.entrada.includes(opt) 
                    ? 'border-[#ff6600] bg-[#ff6600]/5 shadow-[0_4px_20px_rgba(255,102,0,0.1)]' 
                    : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className={`w-5 h-5 rounded-[4px] border-2 mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                  answers.entrada.includes(opt) ? 'border-[#ff6600] bg-[#ff6600]' : 'border-white/30'
                }`}>
                   {answers.entrada.includes(opt) && <Check size={14} className="text-black stroke-[3]" />}
                </div>
                <input 
                  type="checkbox" 
                  checked={answers.entrada.includes(opt)}
                  onChange={() => toggleArrayOption('entrada', opt)}
                  className="hidden" 
                />
                <span className={`text-sm font-medium transition-colors ${answers.entrada.includes(opt) ? 'text-white' : 'text-[#888888]'}`}>
                  {opt}
                </span>
              </label>
            ))}
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div 
            key="step3"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#ff6600]/10 flex items-center justify-center border border-[#ff6600]/30 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                <Cpu size={24} className="text-[#ff6600]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">O que precisa acontecer?</h2>
                <p className="text-[#888888] font-light mt-1">Como devemos processar estes dados?</p>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Validar / limpar dados', 'Transformar / reformatar', 'Classificar / categorizar', 
              'Buscar em banco de dados', 'Calcular / agregar', 'Usar IA/ML para análise', 'Gerar arquivo de saída'
            ].map(opt => (
              <label 
                key={opt} 
                className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  answers.processamento.includes(opt) 
                    ? 'border-[#ff6600] bg-[#ff6600]/5 shadow-[0_4px_20px_rgba(255,102,0,0.1)]' 
                    : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className={`w-5 h-5 rounded-[4px] border-2 mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                  answers.processamento.includes(opt) ? 'border-[#ff6600] bg-[#ff6600]' : 'border-white/30'
                }`}>
                   {answers.processamento.includes(opt) && <Check size={14} className="text-black stroke-[3]" />}
                </div>
                <input 
                  type="checkbox" 
                  checked={answers.processamento.includes(opt)}
                  onChange={() => toggleArrayOption('processamento', opt)}
                  className="hidden" 
                />
                <span className={`text-sm font-medium transition-colors ${answers.processamento.includes(opt) ? 'text-white' : 'text-[#888888]'}`}>
                  {opt}
                </span>
              </label>
            ))}
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div 
            key="step4"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#ff6600]/10 flex items-center justify-center border border-[#ff6600]/30 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                <Globe size={24} className="text-[#ff6600]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">O que fazer com o resultado?</h2>
                <p className="text-[#888888] font-light mt-1">Qual o destino ou ação final recomendada?</p>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Enviar e-mail', 'Enviar SMS / WhatsApp', 'Criar registro no banco', 
              'Integrar com outra ferramenta', 'Gerar dashboard / relatório', 
              'Executar ação em hardware', 'Webhook para outro sistema'
            ].map(opt => (
              <label 
                key={opt} 
                className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  answers.saida.includes(opt) 
                    ? 'border-[#ff6600] bg-[#ff6600]/5 shadow-[0_4px_20px_rgba(255,102,0,0.1)]' 
                    : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className={`w-5 h-5 rounded-[4px] border-2 mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                  answers.saida.includes(opt) ? 'border-[#ff6600] bg-[#ff6600]' : 'border-white/30'
                }`}>
                   {answers.saida.includes(opt) && <Check size={14} className="text-black stroke-[3]" />}
                </div>
                <input 
                  type="checkbox" 
                  checked={answers.saida.includes(opt)}
                  onChange={() => toggleArrayOption('saida', opt)}
                  className="hidden" 
                />
                <span className={`text-sm font-medium transition-colors ${answers.saida.includes(opt) ? 'text-white' : 'text-[#888888]'}`}>
                  {opt}
                </span>
              </label>
            ))}
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div 
            key="step5"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#ff6600]/10 flex items-center justify-center border border-[#ff6600]/30 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                <LayoutGrid size={24} className="text-[#ff6600]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Conte mais sobre seu negócio</h2>
                <p className="text-[#888888] font-light mt-1">Isso ajuda a dimensionar a arquitetura.</p>
              </div>
            </div>
            
            <div className="grid gap-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-[#888888] ml-1">Setor/Indústria</label>
                <input 
                  type="text" 
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] outline-none transition-all"
                  placeholder="Ex: E-commerce, Saúde, Logística..."
                  value={answers.setor}
                  onChange={e => setAnswers({ ...answers, setor: e.target.value })}
                />
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#888888] ml-1">Volume (por dia)</label>
                  <select 
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] outline-none transition-all"
                    value={answers.volume}
                    onChange={e => setAnswers({ ...answers, volume: e.target.value })}
                  >
                    <option value="" disabled>Selecione</option>
                    <option value="Baixo (< 100)">Baixo (&lt; 100)</option>
                    <option value="Médio (100-1000)">Médio (100-1000)</option>
                    <option value="Alto (1000-100k)">Alto (1000-100k)</option>
                    <option value="Muito alto (> 100k)">Muito alto (&gt; 100k)</option>
                  </select>
                </div>
                
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#888888] ml-1">Frequência</label>
                  <select 
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] outline-none transition-all"
                    value={answers.frequencia}
                    onChange={e => setAnswers({ ...answers, frequencia: e.target.value })}
                  >
                    <option value="" disabled>Selecione</option>
                    <option value="Uma vez (one-off)">Uma vez (one-off)</option>
                    <option value="Diário">Diário</option>
                    <option value="Horário">Horário</option>
                    <option value="Tempo real / contínuo">Tempo real / contínuo</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-[#888888] ml-1">Descrição livre (opcional)</label>
                <textarea 
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] outline-none min-h-[120px] resize-y transition-all"
                  placeholder="Detalhes adicionais ou requisitos únicos..."
                  value={answers.descricao}
                  onChange={e => setAnswers({ ...answers, descricao: e.target.value })}
                />
              </div>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 bg-[#0a0a0a] w-full min-h-[calc(100vh-64px)] overflow-y-auto relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-96 bg-[#ff6600]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-3xl w-full mx-auto relative z-10 flex flex-col h-full">
        <button onClick={onBack} className="self-start flex items-center gap-2 text-[#888888] hover:text-white mb-8 uppercase tracking-widest text-[10px] font-bold transition-colors">
          <ArrowLeft size={14} /> Cancelar Briefing
        </button>
        
        <div className="mb-10">
           <div className="flex justify-between items-end mb-4">
               <div>
                  <h1 className="text-3xl md:text-4xl font-display font-black tracking-tighter text-white">
                    Briefing Estruturado
                  </h1>
               </div>
               <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-medium text-[#888888]">
                 Etapa <span className="text-white">{step}</span> de 5
               </div>
           </div>
          
           <div className="flex gap-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-1.5 flex-1 rounded-full overflow-hidden bg-white/5">
                <motion.div 
                  className="h-full bg-[#ff6600]"
                  initial={{ width: 0 }}
                  animate={{ width: step >= i ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-[#111111]/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl flex-1 flex flex-col">
          <div className="flex-1 min-h-[420px] overflow-x-hidden p-1">
             <AnimatePresence mode="wait" custom={direction}>
                {renderStep()}
             </AnimatePresence>
          </div>
          
          <div className="flex justify-between items-center mt-10 pt-8 border-t border-white/5">
            <button 
              onClick={() => { setDirection(-1); handlePrev(); }} 
              disabled={step === 1}
              className="px-6 py-3 rounded-xl border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              Voltar
            </button>
            
            {step < 5 ? (
              <button 
                onClick={() => { setDirection(1); handleNext(); }} 
                disabled={!isStepValid()}
                className="px-8 py-3 rounded-xl bg-[#ff6600] text-white font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(255,102,0,0.4)] disabled:shadow-none disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Próximo Etapa &rarr;
              </button>
            ) : (
              <button 
                onClick={() => onSubmit(answers)} 
                disabled={!isStepValid()}
                className="px-8 py-4 rounded-xl bg-[#ff6600] text-white font-black flex items-center gap-2 text-sm uppercase tracking-widest hover:shadow-[0_0_30px_rgba(255,102,0,0.5)] disabled:shadow-none disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Play size={16} fill="currentColor" /> Gerar Solução
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
