import React, { useState } from 'react';
import { Loader2, ArrowUpRight, Cpu, Layers, Sparkles, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface BackgroundGenerationWidgetProps {
  isGenerating: boolean;
  progress: number;
  currentMessage: string;
  generationType?: 'software' | 'iot';
  activeModel?: string;
  onReturnToBuild: () => void;
  isMainViewActive: boolean;
}

export function BackgroundGenerationWidget({
  isGenerating,
  progress,
  currentMessage,
  generationType = 'software',
  activeModel = 'NVIDIA NIM GLM-5.1',
  onReturnToBuild,
  isMainViewActive
}: BackgroundGenerationWidgetProps) {
  const [collapsed, setCollapsed] = useState(false);

  // If not generating, don't show widget
  if (!isGenerating) return null;

  // If the user is already looking at the full-screen generator build area, we can render a subtle floating pill or hide
  // But if they navigate to marketplace, purchases, iot, settings, admin, etc., show full prominent floating badge!
  const isElsewhere = !isMainViewActive;

  return (
    <div className="fixed bottom-12 right-6 z-[999] animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className={`backdrop-blur-xl border rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.8)] transition-all overflow-hidden ${
        generationType === 'iot'
          ? 'bg-[#0a0f1d]/95 border-[#00d4ff]/40 shadow-[0_0_35px_rgba(0,212,255,0.15)]'
          : 'bg-[#0c120e]/95 border-[#00ff88]/40 shadow-[0_0_35px_rgba(0,255,136,0.15)]'
      } ${collapsed ? 'w-auto' : 'w-80 sm:w-96'}`}>
        
        {/* Header / Bar */}
        <div className="p-3.5 flex items-center justify-between gap-3 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full animate-ping absolute inset-0 ${
                generationType === 'iot' ? 'bg-[#00d4ff]' : 'bg-[#00ff88]'
              } opacity-75`} />
              <div className={`w-3 h-3 rounded-full ${
                generationType === 'iot' ? 'bg-[#00d4ff]' : 'bg-[#00ff88]'
              }`} />
            </div>
            
            <div className="truncate">
              <span className="text-[10px] uppercase font-black tracking-widest text-white block leading-none">
                Geração em Segundo Plano
              </span>
              <span className={`text-[9px] font-mono ${
                generationType === 'iot' ? 'text-[#00d4ff]' : 'text-[#00ff88]'
              }`}>
                {activeModel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
              title={collapsed ? 'Expandir' : 'Recolher'}
            >
              {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Body (when expanded) */}
        {!collapsed && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-mono truncate pr-2 text-[11px]">
                {currentMessage || 'Processando pipeline de IA...'}
              </span>
              <span className={`font-mono font-black text-xs shrink-0 ${
                generationType === 'iot' ? 'text-[#00d4ff]' : 'text-[#00ff88]'
              }`}>
                {progress}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  generationType === 'iot'
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#0066ff]'
                    : 'bg-gradient-to-r from-[#00ff88] to-[#00d4ff]'
                }`}
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                <Loader2 size={11} className="animate-spin text-white" />
                <span>Navegue à vontade enquanto compila</span>
              </div>

              <button
                onClick={onReturnToBuild}
                className={`px-3 py-1.5 rounded-lg text-black font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 hover:scale-105 transition-all shadow-md ${
                  generationType === 'iot'
                    ? 'bg-[#00d4ff] hover:bg-[#38bdf8]'
                    : 'bg-[#00ff88] hover:bg-[#34d399]'
                }`}
              >
                Ver Geração <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
