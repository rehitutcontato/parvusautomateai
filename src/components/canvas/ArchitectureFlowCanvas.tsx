import React, { useState, useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Handle, 
  Position, 
  MarkerType, 
  NodeProps,
  useNodesState,
  useEdgesState,
  Edge,
  Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Cpu, Server, Database, Globe, Radio, Shield, Zap, X, 
  Code2, ExternalLink, ChevronRight, Layers, ArrowRight
} from 'lucide-react';

// Custom Node 1: Hardware IoT
function HardwareCustomNode({ data }: NodeProps) {
  return (
    <div className="bg-[#0c0e17] border-2 border-[#ff6600]/70 rounded-2xl p-4 shadow-[0_0_25px_rgba(255,102,0,0.25)] min-w-[240px] text-left transition-all hover:border-[#ff6600]">
      <Handle type="source" position={Position.Right} className="!bg-[#ff6600] !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-[#ff6600]/20 text-[#ff6600]">
          <Cpu size={16} />
        </div>
        <div>
          <span className="text-[10px] font-mono text-[#ff6600] uppercase font-bold tracking-wider block">
            Hardware Físico
          </span>
          <span className="text-xs font-extrabold text-white font-display">
            {data.placa || 'ESP32 DevKit v1'}
          </span>
        </div>
      </div>
      <div className="space-y-1.5 font-mono text-[10px] text-gray-300">
        <div className="bg-black/40 px-2 py-1 rounded border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Sensores:</span>
          <span className="text-amber-300 font-bold">{data.sensores || 'DHT22 + Relé 5V'}</span>
        </div>
        <div className="bg-black/40 px-2 py-1 rounded border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Firmware:</span>
          <span className="text-emerald-400 font-bold">C++ (FreeRTOS)</span>
        </div>
      </div>
    </div>
  );
}

// Custom Node 2: IoT Software & Broker Gateway
function BrokerCustomNode({ data }: NodeProps) {
  return (
    <div className="bg-[#0c0e17] border-2 border-[#00d4ff]/70 rounded-2xl p-4 shadow-[0_0_25px_rgba(0,212,255,0.25)] min-w-[250px] text-left transition-all hover:border-[#00d4ff]">
      <Handle type="target" position={Position.Left} className="!bg-[#00d4ff] !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-[#00d4ff] !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff]">
          <Radio size={16} />
        </div>
        <div>
          <span className="text-[10px] font-mono text-[#00d4ff] uppercase font-bold tracking-wider block">
            Broker & IoT Software
          </span>
          <span className="text-xs font-extrabold text-white font-display">
            MQTT / Cloud Gateway
          </span>
        </div>
      </div>
      <div className="space-y-1.5 font-mono text-[10px] text-gray-300">
        <div className="bg-black/40 px-2 py-1 rounded border border-white/5 truncate">
          <span className="text-gray-400 block text-[9px]">Topic Telemetry:</span>
          <span className="text-cyan-300 font-bold">parvus/corp/+/telemetry</span>
        </div>
        <div className="bg-black/40 px-2 py-1 rounded border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Regras Cloud:</span>
          <span className="text-[#00ff88] font-bold">Automação Ativa</span>
        </div>
      </div>
    </div>
  );
}

// Custom Node 3: Backend Express
function BackendCustomNode({ data }: NodeProps) {
  return (
    <div className="bg-[#0c0e17] border-2 border-[#00ff88]/70 rounded-2xl p-4 shadow-[0_0_25px_rgba(0,255,136,0.25)] min-w-[250px] text-left transition-all hover:border-[#00ff88]">
      <Handle type="target" position={Position.Left} className="!bg-[#00ff88] !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-[#00ff88] !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-[#00ff88] !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-[#00ff88]/20 text-[#00ff88]">
          <Server size={16} />
        </div>
        <div>
          <span className="text-[10px] font-mono text-[#00ff88] uppercase font-bold tracking-wider block">
            API REST Express
          </span>
          <span className="text-xs font-extrabold text-white font-display">
            Node.js Microservice
          </span>
        </div>
      </div>
      <div className="space-y-1 font-mono text-[10px] text-gray-300">
        <div className="bg-black/40 px-2 py-0.5 rounded border border-white/5 text-[#00ff88]">
          GET /api/v1/health
        </div>
        <div className="bg-black/40 px-2 py-0.5 rounded border border-white/5 text-cyan-300">
          POST /api/v1/telemetry
        </div>
        <div className="bg-black/40 px-2 py-0.5 rounded border border-white/5 text-amber-300">
          POST /api/v1/webhooks
        </div>
      </div>
    </div>
  );
}

// Custom Node 4: Database Supabase
function DatabaseCustomNode({ data }: NodeProps) {
  return (
    <div className="bg-[#0c0e17] border-2 border-purple-500/70 rounded-2xl p-4 shadow-[0_0_25px_rgba(168,85,247,0.25)] min-w-[240px] text-left transition-all hover:border-purple-400">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
          <Database size={16} />
        </div>
        <div>
          <span className="text-[10px] font-mono text-purple-400 uppercase font-bold tracking-wider block">
            Persistência & RLS
          </span>
          <span className="text-xs font-extrabold text-white font-display">
            Supabase / Postgres
          </span>
        </div>
      </div>
      <div className="space-y-1.5 font-mono text-[10px] text-gray-300">
        <div className="bg-black/40 px-2 py-1 rounded border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Tabelas:</span>
          <span className="text-purple-300 font-bold">devices, telemetry, logs</span>
        </div>
        <div className="bg-black/40 px-2 py-1 rounded border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Segurança:</span>
          <span className="text-[#00ff88] font-bold">RLS Ativo (auth.uid)</span>
        </div>
      </div>
    </div>
  );
}

// Custom Node 5: Interface Frontend / IoT Monitor
function InterfaceCustomNode({ data }: NodeProps) {
  return (
    <div className="bg-[#0c0e17] border-2 border-pink-500/70 rounded-2xl p-4 shadow-[0_0_25px_rgba(236,72,153,0.25)] min-w-[250px] text-left transition-all hover:border-pink-400">
      <Handle type="target" position={Position.Left} className="!bg-pink-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
          <Globe size={16} />
        </div>
        <div>
          <span className="text-[10px] font-mono text-pink-400 uppercase font-bold tracking-wider block">
            Frontend SPA & Monitor
          </span>
          <span className="text-xs font-extrabold text-white font-display">
            React + Recharts
          </span>
        </div>
      </div>
      <div className="space-y-1.5 font-mono text-[10px] text-gray-300">
        <div className="bg-black/40 px-2 py-1 rounded border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Componentes:</span>
          <span className="text-pink-300 font-bold">KPI Cards, Gráficos SVG</span>
        </div>
        <div className="bg-black/40 px-2 py-1 rounded border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Design System:</span>
          <span className="text-cyan-300 font-bold">Cyberpunk AAA</span>
        </div>
      </div>
    </div>
  );
}

interface ArchitectureFlowCanvasProps {
  projectTitle?: string;
  projectType?: string;
  nodeData?: any;
  iotProject?: any;
  onOpenSandbox?: () => void;
  onNavigateToSoftware?: () => void;
  onNavigateToMonitor?: () => void;
  onNavigateToHardware?: () => void;
}

export function ArchitectureFlowCanvas({
  projectTitle = 'Sistema Parvus Enterprise',
  projectType = 'SOFTWARE',
  nodeData,
  iotProject,
  onOpenSandbox,
  onNavigateToSoftware,
  onNavigateToMonitor,
  onNavigateToHardware
}: ArchitectureFlowCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const nodeTypes = useMemo(() => ({
    hardwareNode: HardwareCustomNode,
    brokerNode: BrokerCustomNode,
    backendNode: BackendCustomNode,
    databaseNode: DatabaseCustomNode,
    interfaceNode: InterfaceCustomNode
  }), []);

  const isHardware = projectType === 'HARDWARE' || projectType === 'HIBRIDO' || Boolean(iotProject);

  const initialNodes: Node[] = useMemo(() => {
    if (isHardware) {
      return [
        {
          id: '1',
          type: 'hardwareNode',
          position: { x: 50, y: 150 },
          data: {
            title: 'Dispositivo Físico',
            placa: iotProject?.placa || 'ESP32 DevKit v1',
            sensores: iotProject?.componentes?.map((c: any) => c.nome).slice(0, 2).join(' + ') || 'DHT22 + Relé'
          }
        },
        {
          id: '2',
          type: 'brokerNode',
          position: { x: 380, y: 150 },
          data: {
            title: 'IoT Software & Broker',
            protocol: 'MQTT / HTTP'
          }
        },
        {
          id: '3',
          type: 'backendNode',
          position: { x: 720, y: 150 },
          data: {
            title: 'Microsserviço Express'
          }
        },
        {
          id: '4',
          type: 'databaseNode',
          position: { x: 720, y: 380 },
          data: {
            title: 'Supabase PostgreSQL'
          }
        },
        {
          id: '5',
          type: 'interfaceNode',
          position: { x: 1060, y: 150 },
          data: {
            title: 'IoT Monitor & Dashboard'
          }
        }
      ];
    }

    // Default Web/Backend Software
    return [
      {
        id: '2',
        type: 'brokerNode',
        position: { x: 80, y: 150 },
        data: {
          title: 'Gateway / Ingestão'
        }
      },
      {
        id: '3',
        type: 'backendNode',
        position: { x: 420, y: 150 },
        data: {
          title: 'Microsserviço Express'
        }
      },
      {
        id: '4',
        type: 'databaseNode',
        position: { x: 420, y: 380 },
        data: {
          title: 'Supabase PostgreSQL'
        }
      },
      {
        id: '5',
        type: 'interfaceNode',
        position: { x: 780, y: 150 },
        data: {
          title: 'Frontend SPA'
        }
      }
    ];
  }, [isHardware, iotProject]);

  const initialEdges: Edge[] = useMemo(() => {
    if (isHardware) {
      return [
        {
          id: 'e1-2',
          source: '1',
          target: '2',
          animated: true,
          style: { stroke: '#ff6600', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#ff6600' }
        },
        {
          id: 'e2-3',
          source: '2',
          target: '3',
          animated: true,
          style: { stroke: '#00d4ff', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#00d4ff' }
        },
        {
          id: 'e3-4',
          source: '3',
          target: '4',
          animated: true,
          style: { stroke: '#a855f7', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }
        },
        {
          id: 'e3-5',
          source: '3',
          target: '5',
          animated: true,
          style: { stroke: '#00ff88', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#00ff88' }
        }
      ];
    }

    return [
      {
        id: 'e2-3',
        source: '2',
        target: '3',
        animated: true,
        style: { stroke: '#00d4ff', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#00d4ff' }
      },
      {
        id: 'e3-4',
        source: '3',
        target: '4',
        animated: true,
        style: { stroke: '#a855f7', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }
      },
      {
        id: 'e3-5',
        source: '3',
        target: '5',
        animated: true,
        style: { stroke: '#00ff88', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#00ff88' }
      }
    ];
  }, [isHardware]);

  const [nodes, setNodes, onNodesChange] = useNodesState<any>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="w-full h-full relative bg-[#07080c] flex overflow-hidden">
      {/* Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          className="bg-[#07080c]"
        >
          <Background color="#222533" gap={20} size={1.5} />
          <Controls className="!bg-[#0f111a] !border-white/10 !fill-white" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.type === 'hardwareNode') return '#ff6600';
              if (n.type === 'brokerNode') return '#00d4ff';
              if (n.type === 'backendNode') return '#00ff88';
              if (n.type === 'databaseNode') return '#a855f7';
              return '#ec4899';
            }}
            className="!bg-[#0c0e17] !border-white/10 rounded-xl overflow-hidden" 
          />
        </ReactFlow>

        {/* Floating Canvas Tag */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl font-mono text-[11px] text-gray-300 flex items-center gap-2 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></div>
          Fluxo de Dados em Nós C4 • Clique em um nó para inspecionar
        </div>
      </div>

      {/* Collapsible Node Details Drawer */}
      {selectedNode && (
        <div className="w-80 md:w-96 bg-[#0b0c14] border-l border-white/10 p-5 flex flex-col justify-between shrink-0 animate-in slide-in-from-right duration-200 z-10 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-mono font-bold text-gray-400 uppercase">
                Detalhes da Arquitetura
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <h3 className="text-white font-extrabold text-base font-display">
                {selectedNode.type === 'hardwareNode' && 'Nó de Microcontrolador Físico'}
                {selectedNode.type === 'brokerNode' && 'Nó de Broker & IoT Software'}
                {selectedNode.type === 'backendNode' && 'Nó de API Express (Backend)'}
                {selectedNode.type === 'databaseNode' && 'Nó de Persistência Supabase'}
                {selectedNode.type === 'interfaceNode' && 'Nó de Interface Web (Frontend)'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Representação em grafo acíclico direcionado da arquitetura do sistema gerado.
              </p>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div className="bg-[#121420] p-3 rounded-xl border border-white/5">
                <span className="text-gray-400 block text-[10px] mb-1">Status Operacional:</span>
                <span className="text-[#00ff88] font-bold">ONLINE & INTEGRADO</span>
              </div>
              <div className="bg-[#121420] p-3 rounded-xl border border-white/5">
                <span className="text-gray-400 block text-[10px] mb-1">Mecanismo de Conexão:</span>
                <span className="text-[#00d4ff] font-bold">
                  {selectedNode.type === 'hardwareNode' && 'Wi-Fi 802.11 b/g/n + MQTT SSL'}
                  {selectedNode.type === 'brokerNode' && 'Porta 1883 / 8883 MQTTS & WebSockets'}
                  {selectedNode.type === 'backendNode' && 'HTTP RESTful / RFC 7807'}
                  {selectedNode.type === 'databaseNode' && 'PostgreSQL Connection Pooling'}
                  {selectedNode.type === 'interfaceNode' && 'Fetch / Axios + Live State Store'}
                </span>
              </div>
            </div>

            {/* Ações Rápidas de Navegação entre Módulos */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              {onOpenSandbox && (
                <button
                  onClick={onOpenSandbox}
                  className="w-full py-2 px-3 bg-[#00ff88]/15 hover:bg-[#00ff88]/25 text-[#00ff88] border border-[#00ff88]/40 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Code2 size={14} /> Executar no Sandbox Virtual
                </button>
              )}

              {selectedNode.type === 'brokerNode' && onNavigateToSoftware && (
                <button
                  onClick={onNavigateToSoftware}
                  className="w-full py-2 px-3 bg-[#00d4ff]/15 hover:bg-[#00d4ff]/25 text-[#00d4ff] border border-[#00d4ff]/40 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Radio size={14} /> Abrir Configurações no IoT Software
                </button>
              )}

              {(selectedNode.type === 'interfaceNode' || selectedNode.type === 'brokerNode') && onNavigateToMonitor && (
                <button
                  onClick={onNavigateToMonitor}
                  className="w-full py-2 px-3 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Layers size={14} /> Ver Telemetria no IoT Monitor
                </button>
              )}

              {selectedNode.type === 'hardwareNode' && onNavigateToHardware && (
                <button
                  onClick={onNavigateToHardware}
                  className="w-full py-2 px-3 bg-[#ff6600]/15 hover:bg-[#ff6600]/25 text-[#ff6600] border border-[#ff6600]/40 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cpu size={14} /> Abrir no Gerador IoT & Wokwi
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => setSelectedNode(null)}
            className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold font-mono rounded-xl transition-colors uppercase tracking-wider cursor-pointer"
          >
            Fechar Inspecionador
          </button>
        </div>
      )}
    </div>
  );
}
