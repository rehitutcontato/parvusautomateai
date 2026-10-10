/**
 * @file CustomNode.tsx
 * @description Componente de Nó Customizado para o ReactFlow no Canvas Studio do Parvus Automate.
 * Apresenta acabamento visual dark cyberpunk / glassmorphic de alta fidelidade com handles tipados.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Zap, 
  Server, 
  Database, 
  Sparkles, 
  HardDrive, 
  Layout as LayoutIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight
} from 'lucide-react';
import { FlowNodeData, NodeType } from '../../../lib/flow/types';

const categoryThemes: Record<NodeType, {
  borderColor: string;
  glowColor: string;
  badgeBg: string;
  badgeText: string;
  accentText: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}> = {
  trigger: {
    borderColor: 'border-[#00ff88]/50',
    glowColor: 'shadow-[0_0_20px_rgba(0,255,136,0.15)]',
    badgeBg: 'bg-[#00ff88]/15',
    badgeText: 'text-[#00ff88]',
    accentText: 'text-[#00ff88]',
    icon: Zap,
    tag: 'TRIGGER'
  },
  backend_route: {
    borderColor: 'border-[#00d4ff]/50',
    glowColor: 'shadow-[0_0_20px_rgba(0,212,255,0.15)]',
    badgeBg: 'bg-[#00d4ff]/15',
    badgeText: 'text-[#00d4ff]',
    accentText: 'text-[#00d4ff]',
    icon: Server,
    tag: 'ROUTE'
  },
  database: {
    borderColor: 'border-[#a855f7]/50',
    glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]',
    badgeBg: 'bg-[#a855f7]/15',
    badgeText: 'text-[#c084fc]',
    accentText: 'text-[#c084fc]',
    icon: Database,
    tag: 'SUPABASE'
  },
  service_ai: {
    borderColor: 'border-[#f59e0b]/50',
    glowColor: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    badgeBg: 'bg-[#f59e0b]/15',
    badgeText: 'text-[#fbbf24]',
    accentText: 'text-[#fbbf24]',
    icon: Sparkles,
    tag: 'AI MODEL'
  },
  iot_device: {
    borderColor: 'border-[#ef4444]/50',
    glowColor: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    badgeBg: 'bg-[#ef4444]/15',
    badgeText: 'text-[#f87171]',
    accentText: 'text-[#f87171]',
    icon: HardDrive,
    tag: 'HARDWARE'
  },
  frontend_ui: {
    borderColor: 'border-[#ec4899]/50',
    glowColor: 'shadow-[0_0_20px_rgba(236,72,153,0.15)]',
    badgeBg: 'bg-[#ec4899]/15',
    badgeText: 'text-[#f472b6]',
    accentText: 'text-[#f472b6]',
    icon: LayoutIcon,
    tag: 'FRONTEND'
  }
};

export const CustomNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  const category = data.category || 'backend_route';
  const theme = categoryThemes[category] || categoryThemes.backend_route;
  const IconComponent = theme.icon;

  // Extrai resumo de configuração
  const getConfigSummary = () => {
    const cfg = data.config || {};
    if (category === 'trigger') {
      return cfg.webhookPath || cfg.cronExpression || cfg.triggerType?.toUpperCase() || 'Webhook / Event';
    }
    if (category === 'backend_route') {
      return `${cfg.routeMethod || 'POST'} ${cfg.routePath || '/api'}`;
    }
    if (category === 'database') {
      return `${cfg.dbOperation || 'INSERT'} em "${cfg.dbTable || 'records'}"`;
    }
    if (category === 'service_ai') {
      return `${cfg.aiModel || 'gemini-3.8-flash'} (T: ${cfg.temperature ?? 0.2})`;
    }
    if (category === 'iot_device') {
      const pinCount = cfg.gpioPins?.length || 0;
      return `${cfg.boardType?.toUpperCase() || 'ESP32'} (${pinCount} pinos)`;
    }
    if (category === 'frontend_ui') {
      return cfg.uiTitle || cfg.uiComponentType?.toUpperCase() || 'Dashboard View';
    }
    return '';
  };

  return (
    <div
      className={`relative min-w-[260px] max-w-[300px] rounded-xl bg-[#0b0d14]/95 backdrop-blur-md border ${
        selected ? 'border-white ring-2 ring-white/20' : theme.borderColor
      } ${theme.glowColor} transition-all duration-200 select-none group`}
    >
      {/* Handles de Entrada (Esquerda) */}
      {data.inputs && data.inputs.length > 0 ? (
        data.inputs.map((inputHandle, idx) => (
          <Handle
            key={inputHandle.id || `in-${idx}`}
            type="target"
            position={Position.Left}
            id={inputHandle.id || `in-${idx}`}
            style={{
              top: `${((idx + 1) / (data.inputs.length + 1)) * 100}%`,
              background: '#050608',
              borderColor: '#00ff88',
              borderWidth: 2,
              width: 10,
              height: 10
            }}
            className="transition-transform group-hover:scale-125"
          />
        ))
      ) : (
        // Se for trigger sem inputs definidos, não exibe handle esquerdo
        null
      )}

      {/* Header do Nó */}
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg ${theme.badgeBg}`}>
            <IconComponent className={`w-3.5 h-3.5 ${theme.badgeText}`} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-white/50 block">
              {theme.tag}
            </span>
            <h4 className="text-xs font-bold text-white tracking-wide truncate max-w-[140px]">
              {data.label}
            </h4>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              data.status === 'ready'
                ? 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]'
                : data.status === 'error'
                ? 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]'
                : 'bg-[#f59e0b]'
            }`}
          />
          <span className="text-[9px] font-mono text-white/40 uppercase">
            {data.status}
          </span>
        </div>
      </div>

      {/* Corpo do Nó */}
      <div className="px-3 py-2 space-y-1.5">
        <p className="text-[11px] text-white/70 line-clamp-2 leading-relaxed">
          {data.description}
        </p>

        {/* Resumo da Configuração / Badges */}
        <div className="pt-1 flex items-center justify-between text-[10px] font-mono border-t border-white/5">
          <span className="text-white/40 truncate max-w-[190px]">
            {getConfigSummary()}
          </span>
          <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-white/60 transition-colors" />
        </div>
      </div>

      {/* Handles de Saída (Direita) */}
      {data.outputs && data.outputs.length > 0 ? (
        data.outputs.map((outputHandle, idx) => (
          <Handle
            key={outputHandle.id || `out-${idx}`}
            type="source"
            position={Position.Right}
            id={outputHandle.id || `out-${idx}`}
            style={{
              top: `${((idx + 1) / (data.outputs.length + 1)) * 100}%`,
              background: '#050608',
              borderColor: '#00d4ff',
              borderWidth: 2,
              width: 10,
              height: 10
            }}
            className="transition-transform group-hover:scale-125"
          />
        ))
      ) : (
        // Se for frontend sem outputs definidos, não exibe handle direito
        null
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
