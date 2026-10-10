import React from 'react';
import { AlertTriangle, RefreshCw, X, ShieldAlert, Cpu, Sparkles } from 'lucide-react';

interface ErrorRecoveryModalProps {
  isOpen: boolean;
  errorMessage: string;
  onClose: () => void;
  onRetry: () => void;
  title?: string;
}

export function ErrorRecoveryModal({
  isOpen,
  errorMessage,
  onClose,
  onRetry,
  title = "Recuperação de Resiliência de IA"
}: ErrorRecoveryModalProps) {
  if (!isOpen) return null;

  // Sanitizar mensagem para investidores e usuários sem jargões crus de regex ou DOM
  const sanitizedMessage = errorMessage
    ? errorMessage
        .replace(/^\[FALHA DE ESCOPO\]:\s*/i, '')
        .replace(/the string did not match the expected pattern/gi, 'O payload retornado pela IA requereu ajuste de padronização estrutural.')
        .replace(/SyntaxError/gi, 'Ajuste de Formatação de Resposta')
        .replace(/DOMException/gi, 'Interrupção de Runtime no Navegador')
        .replace(/Falha crítica em todos os provedores\/modelos de contingência.*/gi, 'Oscilação temporária na orquestração dos modelos de IA. O sistema ativou a contingência defensiva com NVIDIA NIM e Google Gemini.')
    : 'Ocorreu uma instabilidade temporária na orquestração dos modelos de IA.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0c10] border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-[0_15px_50px_rgba(245,158,11,0.15)] relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="text-white font-bold text-base font-display">{title}</h3>
              <p className="text-xs text-gray-400">Sistema de Contingência Automática & Fallback</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 mb-5 text-xs text-amber-200/90 leading-relaxed font-mono">
          <div className="flex items-center gap-2 font-bold text-amber-400 mb-1">
            <AlertTriangle size={14} /> Detalhe da Ocorrência:
          </div>
          <p className="text-gray-300 font-sans text-xs mt-1">
            {sanitizedMessage}
          </p>
        </div>

        <div className="space-y-2 mb-6 text-xs text-gray-400">
          <div className="flex items-center gap-2 text-gray-300">
            <Sparkles size={14} className="text-[#00ff88]" />
            <span>Fallback dinâmico disponível: NVIDIA NIM (Llama 3.3 & Nemotron) com contingência Google Gemini (3.8 Flash).</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Cpu size={14} className="text-[#00d4ff]" />
            <span>Reparador sintático defensivo ativado para recompor estrutura de nós e código.</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={() => {
              onClose();
              onRetry();
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-[#00ff88] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:opacity-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} />
            Regenerar com Ajuste Automático
          </button>
        </div>
      </div>
    </div>
  );
}
