import React, { useState, useEffect } from 'react';
import { DEFAULT_TEMPLATES } from '../../lib/templatesData';
import { getCustomTemplates, deleteCustomTemplate, CustomTemplate } from '../../lib/customTemplatesService';
import { ArrowLeft, CheckCircle2, Play, ChevronRight, Zap, Bookmark, Trash2, FolderPlus } from 'lucide-react';
import { motion } from 'motion/react';

interface TemplatesFlowProps {
  onBack: () => void;
  onGenerate: (template: any, answers: any) => void;
  onGoToAI: () => void;
  onLoadDirectly?: (template: CustomTemplate) => void;
}

export function TemplatesFlow({ onBack, onGenerate, onGoToAI, onLoadDirectly }: TemplatesFlowProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [templateSourceTab, setTemplateSourceTab] = useState<'official' | 'custom'>('official');
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => getCustomTemplates());

  useEffect(() => {
    setCustomTemplates(getCustomTemplates());
  }, [templateSourceTab]);

  const handleSelectTemplate = (tpl: any) => {
    setSelectedTemplate(tpl);
    setAnswers({});
  };

  const handleAnswerChange = (field: string, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = () => {
    if (selectedTemplate) {
      onGenerate(selectedTemplate, answers);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  if (selectedTemplate) {
    const totalQuestions = selectedTemplate.perguntas_customizacao.length;
    const answeredCount = Object.keys(answers).filter(k => answers[k] && answers[k].trim() !== '').length;
    const progress = (answeredCount / totalQuestions) * 100;

    return (
      <div className="flex-1 flex flex-col p-4 sm:p-8 bg-[#0a0a0a] w-full min-h-[calc(100vh-64px)] overflow-y-auto relative">
        <div className="absolute top-0 right-0 w-full max-w-lg h-96 bg-[#0066ff]/5 blur-[120px] rounded-full pointer-events-none"></div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-6xl w-full mx-auto relative z-10 flex gap-8 flex-col lg:flex-row"
        >
          
          <div className="flex-1">
            <button onClick={() => setSelectedTemplate(null)} className="flex items-center gap-2 text-[#888888] hover:text-white mb-8 uppercase tracking-widest text-[10px] font-bold transition-colors">
              <ArrowLeft size={14} /> Voltar para templates
            </button>
            
            <h1 className="text-3xl md:text-4xl font-display font-black mb-2 tracking-tighter text-white flex items-center gap-4">
              <span className="text-4xl">{selectedTemplate.icone}</span> {selectedTemplate.nome}
            </h1>
            <p className="text-[#888888] mb-8 font-light">Customize as variáveis abaixo para gerar sua automação.</p>
            
            <div className="mb-8">
              <div className="flex items-center justify-between text-[10px] text-[#888888] uppercase tracking-widest font-bold mb-3">
                <span>Progresso de Configuração</span>
                <span className={progress === 100 ? "text-[#00ff88]" : ""}>{answeredCount} de {totalQuestions} respondidas</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ease-out ${progress === 100 ? 'bg-[#00ff88]' : 'bg-[#0066ff]'}`} style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            <div className="space-y-6 bg-[#111111]/80 backdrop-blur-md rounded-2xl border border-white/10 p-6 md:p-8 shadow-2xl">
              {selectedTemplate.perguntas_customizacao.map((q: any, i: number) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={q.id} 
                  className="space-y-3"
                >
                  <label className="text-sm text-white font-medium block">
                    {q.pergunta}
                  </label>
                  {q.tipo === 'select' ? (
                    <select
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm text-[#f0f0f0] outline-none focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] transition-all"
                      value={answers[q.campo_template] || ''}
                      onChange={(e) => handleAnswerChange(q.campo_template, e.target.value)}
                    >
                      <option value="" disabled>Selecione uma opção...</option>
                      {q.opcoes?.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : q.tipo === 'textarea' ? (
                    <textarea
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm text-[#f0f0f0] outline-none focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] transition-all min-h-[120px] resize-y"
                      placeholder={q.placeholder}
                      value={answers[q.campo_template] || ''}
                      onChange={(e) => handleAnswerChange(q.campo_template, e.target.value)}
                    />
                  ) : (
                    <input
                      type={q.tipo === 'number' ? 'number' : 'text'}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm text-[#f0f0f0] outline-none focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] transition-all"
                      placeholder={q.placeholder}
                      value={answers[q.campo_template] || ''}
                      onChange={(e) => handleAnswerChange(q.campo_template, e.target.value)}
                    />
                  )}
                </motion.div>
              ))}

              <div className="pt-8 mt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
                {selectedTemplate.isCustom && onLoadDirectly && (
                  <button
                    type="button"
                    onClick={() => onLoadDirectly(selectedTemplate)}
                    className="px-6 py-4 rounded-xl border border-[#00ff88]/50 bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88] hover:text-black font-extrabold text-xs tracking-widest uppercase transition-all flex items-center gap-2"
                  >
                    ⚡ Carregar Versão Salva Sem IA
                  </button>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={answeredCount < totalQuestions}
                  className="px-8 py-4 bg-[#0066ff] rounded-xl text-white font-black text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(0,102,255,0.2)] hover:shadow-[0_0_30px_rgba(0,102,255,0.4)] disabled:hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
                >
                  <Play size={16} fill="currentColor" />
                  Gerar Automação
                </button>
              </div>
            </div>
          </div>
          
          <div className="w-full lg:w-[380px] shrink-0 lg:pt-20">
             <div className="rounded-2xl border border-[#0066ff]/20 bg-gradient-to-b from-[#0066ff]/10 to-transparent p-6 md:p-8 sticky top-8">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#0066ff] mb-6 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0066ff] animate-pulse"></div>
                  Metadados do Template
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] text-[#888888] uppercase tracking-widest mb-1">Tipo de Solução</div>
                    <div className="text-white font-medium flex items-center gap-2">
                      <div className="px-2 py-1 bg-white/10 rounded text-xs">{selectedTemplate.tipo}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#888888] uppercase tracking-widest mb-1">Complexidade Backend</div>
                    <div className="text-white font-medium">
                      <div className="px-2 py-1 bg-white/10 rounded text-xs inline-block">{selectedTemplate.complexidade}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#888888] uppercase tracking-widest mb-2">Tech Stack Sugerida</div>
                    <div className="text-white font-medium flex flex-wrap gap-2">
                      {selectedTemplate.tecnologias.map((tech: string) => (
                        <span key={tech} className="bg-black/50 border border-white/10 rounded-md px-2.5 py-1 pt-1.5 text-[10px] uppercase font-bold tracking-wider">{tech}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#888888] uppercase tracking-widest mb-1">Tempo de Setup Estimado</div>
                    <div className="text-white font-medium flex items-baseline gap-1">
                      <span className="text-2xl font-light">{selectedTemplate.tempo_minutos}</span> 
                      <span className="text-sm text-[#888888]">min</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-[#0066ff]/20">
                  <p className="text-[#888888] text-xs leading-relaxed flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#0066ff] shrink-0 mt-0.5" />
                    As variáveis informadas serão integradas diretamente no framework final.
                  </p>
                </div>
             </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 bg-[#0a0a0a] w-full min-h-[calc(100vh-64px)] overflow-hidden relative">
      <div className="absolute top-0 right-0 w-full max-w-3xl h-96 bg-[#0066ff]/5 blur-[120px] rounded-full pointer-events-none"></div>
      
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="max-w-6xl w-full relative z-10"
      >
        <motion.button variants={itemVariants} onClick={onBack} className="flex items-center gap-2 text-[#888888] hover:text-white mb-8 uppercase tracking-widest text-[10px] font-bold transition-colors">
          <ArrowLeft size={14} /> Voltar
        </motion.button>
        
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-3xl md:text-5xl font-display font-black mb-4 tracking-tighter text-white">
            Templates Estruturados
          </h1>
          <p className="text-[#888888] text-lg max-w-2xl font-light mb-8">
            Soluções validadas prontas para implantação. Selecione um padrão e injete suas regras de negócio.
          </p>

          {/* Tab Selector */}
          <div className="flex gap-3 border-b border-white/10 pb-4">
            <button
              onClick={() => setTemplateSourceTab('official')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                templateSourceTab === 'official'
                  ? 'bg-[#0066ff] text-white shadow-[0_0_20px_rgba(0,102,255,0.3)]'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              Templates Oficiais ({DEFAULT_TEMPLATES.length})
            </button>
            <button
              onClick={() => setTemplateSourceTab('custom')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                templateSourceTab === 'custom'
                  ? 'bg-[#00ff88] text-black shadow-[0_0_20px_rgba(0,255,136,0.3)]'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              <Bookmark size={13} />
              Meus Modelos Salvos ({customTemplates.length})
            </button>
          </div>
        </motion.div>
        
        {templateSourceTab === 'official' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {DEFAULT_TEMPLATES.map((tpl) => (
              <motion.div 
                key={tpl.id} 
                variants={itemVariants} 
                whileHover={{ y: -4 }}
                onClick={() => handleSelectTemplate(tpl)}
                className="border border-white/10 rounded-2xl bg-[#111111]/80 backdrop-blur-sm p-6 flex flex-col hover:border-[#0066ff]/50 hover:shadow-[0_10px_40px_-10px_rgba(0,102,255,0.2)] transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl mb-6 shadow-inner group-hover:bg-[#0066ff]/10 group-hover:scale-110 transition-all">
                  {tpl.icone}
                </div>
                <h2 className="text-xl font-black text-white mb-3 leading-tight tracking-tight">
                  {tpl.nome}
                </h2>
                <div className="flex gap-2 mb-4">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#0066ff] bg-[#0066ff]/10 px-2 py-1 rounded">{tpl.tipo}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#888888] bg-white/5 px-2 py-1 rounded">{tpl.complexidade}</span>
                </div>
                <p className="text-sm text-[#888888] leading-relaxed mb-8 flex-1">
                  {tpl.descricao}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <span className="text-xs text-[#666666] font-medium flex items-center gap-1">
                    <Play size={10} className="text-[#0066ff]" /> {tpl.tempo_minutos} min deploy
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white group-hover:text-[#0066ff] transition-colors flex items-center">
                    Customizar <ChevronRight size={14} className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="mb-16">
            {customTemplates.length === 0 ? (
              <div className="p-12 border border-dashed border-white/15 rounded-3xl text-center bg-black/30">
                <FolderPlus size={40} className="mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Nenhum template salvo ainda</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto mb-6">
                  Ao gerar qualquer sistema via Parvus Automate, clique em <strong>"⭐ SALVAR COMO TEMPLATE"</strong> para armazenar seu projeto como um modelo corporativo reutilizável aqui.
                </p>
                <button
                  onClick={onGoToAI}
                  className="px-6 py-3 rounded-xl bg-[#00ff88] text-black font-extrabold text-xs uppercase tracking-wider hover:brightness-110"
                >
                  Criar Primeiro Sistema com IA
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customTemplates.map((tpl) => (
                  <motion.div 
                    key={tpl.id} 
                    variants={itemVariants} 
                    whileHover={{ y: -4 }}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="border border-[#00ff88]/30 rounded-2xl bg-[#0c1410]/80 backdrop-blur-sm p-6 flex flex-col hover:border-[#00ff88] hover:shadow-[0_10px_40px_-10px_rgba(0,255,136,0.2)] transition-all cursor-pointer group relative"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomTemplate(tpl.id);
                        setCustomTemplates(getCustomTemplates());
                      }}
                      className="absolute top-5 right-5 text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      title="Excluir Template Salvo"
                    >
                      <Trash2 size={15} />
                    </button>

                    <div className="w-12 h-12 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-2xl mb-6 shadow-inner group-hover:scale-110 transition-all">
                      {tpl.icone || '⚡'}
                    </div>
                    <h2 className="text-xl font-black text-white mb-2 leading-tight tracking-tight">
                      {tpl.nome}
                    </h2>
                    <div className="flex gap-2 mb-4">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#00ff88] bg-[#00ff88]/10 px-2 py-1 rounded">{tpl.tipo}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">CUSTOMIZADO</span>
                    </div>
                    <p className="text-sm text-[#888888] leading-relaxed mb-6 flex-1 line-clamp-3">
                      {tpl.descricao}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 gap-2">
                      {onLoadDirectly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadDirectly(tpl);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#00ff88]/15 border border-[#00ff88]/50 text-[#00ff88] hover:bg-[#00ff88] hover:text-black font-extrabold text-[10px] uppercase tracking-wider transition-all"
                          title="Carregar o código gerado salvo instantaneamente sem gastar IA"
                        >
                          ⚡ Carregar
                        </button>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest text-white group-hover:text-[#00ff88] transition-colors flex items-center ml-auto">
                        Customizar <ChevronRight size={14} className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <motion.div variants={itemVariants} className="text-center p-8 rounded-2xl border border-dashed border-white/20 bg-white/5 flex flex-col sm:flex-row items-center justify-center gap-6">
          <span className="text-[#888888]">Sua regra de negócio não se encaixa nos moldes?</span>
          <button 
            onClick={onGoToAI}
            className="text-sm font-black uppercase tracking-widest text-[#00ff88] hover:text-black transition-all border border-[#00ff88]/30 bg-[#00ff88]/10 hover:bg-[#00ff88] px-6 py-3 rounded-xl flex items-center gap-2 shrink-0"
          >
            Gerar com IA Absoluta <Zap size={16} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
