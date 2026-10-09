/**
 * @file NodePalette.tsx
 * @description Barra lateral retrátil de paleta de nós manuais para o Canvas Studio (ReactFlow).
 * Permite arrastar e soltar (Drag and Drop) ou adicionar blocos funcionais ao canvas com 1 clique.
 */

import React, { useState } from 'react';
import { 
  Zap, 
  Server, 
  Database, 
  Sparkles, 
  HardDrive, 
  Layout as LayoutIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Search,
  Layers
} from 'lucide-react';
import { NodeType, FlowNodeData } from '../../lib/flow/types';

interface NodePaletteProps {
  onAddNode: (type: NodeType, position?: { x: number; y: number }, initialData?: Partial<FlowNodeData>) => void;
}

interface PaletteItem {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  defaultData: Partial<FlowNodeData>;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // TRIGGERS
  {
    id: 'trigger-webhook',
    type: 'trigger',
    label: 'Webhook HTTP',
    description: 'Ponto de entrada de requisições POST com validação HMAC.',
    badge: 'POST',
    icon: Zap,
    colorClass: 'text-[#00ff88]',
    bgClass: 'bg-[#00ff88]/10 border-[#00ff88]/30',
    defaultData: {
      label: 'Webhook HTTP Ingest',
      description: 'Recebe webhooks externos via POST.',
      config: {
        triggerType: 'webhook',
        webhookPath: '/api/v1/webhook',
        httpMethod: 'POST'
      }
    }
  },
  {
    id: 'trigger-cron',
    type: 'trigger',
    label: 'Cron Scheduler',
    description: 'Agendamento recorrente de tarefas automatizadas.',
    badge: 'CRON',
    icon: Zap,
    colorClass: 'text-[#00ff88]',
    bgClass: 'bg-[#00ff88]/10 border-[#00ff88]/30',
    defaultData: {
      label: 'Agendador Cron',
      description: 'Executa a rotina a cada 5 minutos.',
      config: {
        triggerType: 'cron',
        cronExpression: '*/5 * * * *'
      }
    }
  },

  // BACKEND ROUTES
  {
    id: 'route-rest',
    type: 'backend_route',
    label: 'Rota Express REST',
    description: 'Endpoint REST com tratamento de erros e validação.',
    badge: 'ROUTE',
    icon: Server,
    colorClass: 'text-[#00d4ff]',
    bgClass: 'bg-[#00d4ff]/10 border-[#00d4ff]/30',
    defaultData: {
      label: 'Endpoint REST Express',
      description: 'Endpoint de processamento de regras de negócio.',
      config: {
        routePath: '/api/v1/resource',
        routeMethod: 'POST',
        controllerName: 'ResourceController'
      }
    }
  },

  // DATABASE
  {
    id: 'db-supabase',
    type: 'database',
    label: 'Supabase CRUD',
    description: 'Operação de leitura ou gravação com Row Level Security.',
    badge: 'SQL',
    icon: Database,
    colorClass: 'text-[#c084fc]',
    bgClass: 'bg-[#a855f7]/10 border-[#a855f7]/30',
    defaultData: {
      label: 'Supabase Repository',
      description: 'Gravação segura com isolamento de tenant.',
      config: {
        dbTable: 'records',
        dbOperation: 'INSERT',
        rlsPolicy: 'auth.uid() = user_id'
      }
    }
  },

  // SERVICE AI
  {
    id: 'ai-gemini',
    type: 'service_ai',
    label: 'Motor de IA Gemini',
    description: 'Inferência multimodal e geração com Google Gemini 3.6.',
    badge: 'GEMINI',
    icon: Sparkles,
    colorClass: 'text-[#fbbf24]',
    bgClass: 'bg-[#f59e0b]/10 border-[#f59e0b]/30',
    defaultData: {
      label: 'Cognitive Engine Gemini',
      description: 'Análise semântica e tomada de decisão autônoma.',
      config: {
        aiModel: 'gemini-3.6-flash',
        temperature: 0.2,
        outputFormat: 'json'
      }
    }
  },
  {
    id: 'ai-nvidia',
    type: 'service_ai',
    label: 'NVIDIA NIM Nemotron',
    description: 'Modelo de raciocínio de alta precisão via NVIDIA NIM API.',
    badge: 'NIM',
    icon: Sparkles,
    colorClass: 'text-[#fbbf24]',
    bgClass: 'bg-[#f59e0b]/10 border-[#f59e0b]/30',
    defaultData: {
      label: 'NVIDIA Nemotron AI',
      description: 'Raciocínio complexo para regras industriais.',
      config: {
        aiModel: 'nvidia/nemotron-3-super-120b-a12b',
        temperature: 0.1,
        outputFormat: 'json'
      }
    }
  },

  // IOT DEVICE
  {
    id: 'iot-esp32',
    type: 'iot_device',
    label: 'Placa ESP32 Wi-Fi',
    description: 'Nó microcontrolado para telemetria e relés físicos.',
    badge: 'ESP32',
    icon: HardDrive,
    colorClass: 'text-[#f87171]',
    bgClass: 'bg-[#ef4444]/10 border-[#ef4444]/30',
    defaultData: {
      label: 'ESP32 Industrial Node',
      description: 'Controlador de atuadores e leitura de sensores.',
      config: {
        boardType: 'esp32',
        baudRate: 115200,
        gpioPins: [
          { pin: 4, mode: 'OUTPUT', component: 'Relé de Comando', label: 'RELAY_1' },
          { pin: 34, mode: 'ANALOG_IN', component: 'Sensor Analógico', label: 'ADC_1' }
        ]
      }
    }
  },

  // FRONTEND UI
  {
    id: 'ui-dashboard',
    type: 'frontend_ui',
    label: 'Dashboard de Controle',
    description: 'Painel com gráficos de telemetria e botões de ação.',
    badge: 'DASHBOARD',
    icon: LayoutIcon,
    colorClass: 'text-[#f472b6]',
    bgClass: 'bg-[#ec4899]/10 border-[#ec4899]/30',
    defaultData: {
      label: 'Painel de Telemetria',
      description: 'Interface de monitoramento em tempo real.',
      config: {
        uiComponentType: 'dashboard_card',
        uiTitle: 'Painel Central'
      }
    }
  }
];

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = PALETTE_ITEMS.filter(item => 
    item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.badge.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/reactflow-type', item.type);
    event.dataTransfer.setData('application/reactflow-data', JSON.stringify(item.defaultData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside
      className={`relative z-20 flex flex-col bg-[#08090d]/95 backdrop-blur-xl border-r border-white/10 transition-all duration-300 ${
        collapsed ? 'w-12' : 'w-72'
      }`}
    >
      {/* Botão de Toggle da Barra */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-4 z-30 p-1 rounded-full bg-[#111420] border border-white/15 text-white/70 hover:text-white shadow-lg hover:bg-[#1a1f30] transition-colors"
        title={collapsed ? 'Expandir Paleta de Nós' : 'Recolher Paleta'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Header */}
      <div className="p-3.5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#00ff88]" />
          {!collapsed && (
            <div>
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                Blocos Funcionais
              </h3>
              <p className="text-[10px] text-white/40">Arraste ou clique para adicionar</p>
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Campo de Busca */}
          <div className="p-2.5 border-b border-white/5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar nós funcionais..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00ff88]/50"
              />
            </div>
          </div>

          {/* Lista de Blocos */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredItems.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={e => onDragStart(e, item)}
                  className={`p-2.5 rounded-xl border ${item.bgClass} cursor-grab active:cursor-grabbing hover:scale-[1.01] transition-all group`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-3.5 h-3.5 ${item.colorClass}`} />
                      <span className="text-xs font-bold text-white group-hover:text-white transition-colors">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 text-white/60">
                      {item.badge}
                    </span>
                  </div>

                  <p className="text-[10px] text-white/60 mb-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[9px] font-mono text-white/30 uppercase">
                      Drag & Drop
                    </span>
                    <button
                      onClick={() => onAddNode(item.type, undefined, item.defaultData)}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-[#00ff88]/20 hover:text-[#00ff88] text-[10px] text-white/70 font-semibold transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {collapsed && (
        <div className="flex-1 flex flex-col items-center py-4 space-y-3">
          {PALETTE_ITEMS.slice(0, 6).map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onAddNode(item.type, undefined, item.defaultData)}
                title={item.label}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <Icon className={`w-4 h-4 ${item.colorClass}`} />
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
};
