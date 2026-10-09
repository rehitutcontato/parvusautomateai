/**
 * @file CanvasStudio.tsx
 * @description Ambiente interativo de edição arquitetural viva com ReactFlow (Canvas Studio).
 * Suporta Drag and Drop da paleta, conexões tipadas, inspector lateral,
 * sincronização bidirecional com a IA e compilação para código de produção.
 */

import React, { useRef, useCallback, useMemo, useState } from 'react';
import ReactFlow, { 
  ReactFlowProvider, 
  Controls, 
  Background, 
  MiniMap, 
  ReactFlowInstance,
  NodeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';

import { CustomNode } from './nodes/CustomNode';
import { NodePalette } from './NodePalette';
import { InspectorDrawer } from './InspectorDrawer';
import { 
  FlowAST, 
  FlowCompilationResult, 
  NodeType, 
  FlowNodeData, 
  WorkspaceMode 
} from '../../lib/flow/types';
import { useFlowStore } from '../../lib/flow/useFlowStore';
import { 
  Sparkles, 
  Play, 
  Download, 
  Upload, 
  Trash2, 
  Layers, 
  CheckCircle2, 
  Check, 
  Network, 
  SlidersHorizontal,
  RefreshCw,
  Box,
  FileCode
} from 'lucide-react';

interface CanvasStudioProps {
  initialAST?: FlowAST;
  activeMode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  onCompileAndSync?: (compiled: FlowCompilationResult) => void;
  onRequestAiRegeneration?: () => void;
  projectName?: string;
}

const nodeTypes: NodeTypes = {
  trigger: CustomNode,
  backend_route: CustomNode,
  database: CustomNode,
  service_ai: CustomNode,
  iot_device: CustomNode,
  frontend_ui: CustomNode,
  default: CustomNode
};

export const CanvasStudioInner: React.FC<CanvasStudioProps> = ({
  initialAST,
  activeMode,
  onModeChange,
  onCompileAndSync,
  onRequestAiRegeneration,
  projectName = 'Parvus Automate Studio'
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const {
    nodes,
    edges,
    selectedNode,
    inspectorOpen,
    isCompiling,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    closeInspector,
    addNode,
    updateNodeData,
    updateNodeConfig,
    removeNode,
    duplicateNode,
    applyAutoLayout,
    exportAST,
    loadAST,
    compile,
    clearCanvas
  } = useFlowStore(initialAST);

  // Drag and Drop da Paleta para o Canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow-type') as NodeType;
      const dataStr = event.dataTransfer.getData('application/reactflow-data');

      if (!type) return;

      let initialData: Partial<FlowNodeData> | undefined = undefined;
      try {
        if (dataStr) initialData = JSON.parse(dataStr);
      } catch (err) {
        console.warn('Falha ao decodificar dados do nó solto:', err);
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top
      });

      addNode(type, position, initialData);
    },
    [reactFlowInstance, addNode]
  );

  // Manipulador de Compilação e Sincronização com o Workspace
  const handleCompileAndSync = useCallback(() => {
    const compiled = compile();
    if (onCompileAndSync) {
      onCompileAndSync(compiled);
    }
    setSyncToast('Grafo compilado e sincronizado com o código de produção com sucesso!');
    setTimeout(() => setSyncToast(null), 3500);
  }, [compile, onCompileAndSync]);

  // Exportar AST em arquivo .json
  const handleExportJson = useCallback(() => {
    const ast = exportAST();
    const blob = new Blob([JSON.stringify(ast, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parvus-flow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportAST]);

  // Importar AST de arquivo .json
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportJson = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as FlowAST;
        loadAST(parsed);
        setSyncToast('Arquivo FlowAST carregado no Canvas com sucesso!');
        setTimeout(() => setSyncToast(null), 3000);
      } catch (err) {
        alert('Erro ao carregar o arquivo JSON do FlowAST.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [loadAST]);

  return (
    <div className="relative w-full h-[750px] min-h-[600px] flex flex-col bg-[#050608] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Toast de Notificação */}
      {syncToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#00ff88]/20 border border-[#00ff88]/40 text-[#00ff88] text-xs font-semibold shadow-2xl backdrop-blur-xl animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Toolbar Superior do Studio */}
      <header className="h-14 px-4 bg-[#090b11]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between z-30">
        {/* Esquerda: Seletor Dual Mode & Título */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Network className="w-5 h-5 text-[#00ff88]" />
            <div>
              <h2 className="text-xs font-extrabold text-white tracking-wider uppercase flex items-center space-x-1.5">
                <span>CANVAS STUDIO</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 font-mono">
                  v2.0
                </span>
              </h2>
              <span className="text-[10px] text-white/40 block">
                {nodes.length} nós • {edges.length} conexões ativas
              </span>
            </div>
          </div>

          {/* Seletor Dual Mode */}
          <div className="flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/10">
            <button
              onClick={() => onModeChange('express')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all ${
                activeMode === 'express'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Modo Express
            </button>
            <button
              onClick={() => onModeChange('studio')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all ${
                activeMode === 'studio'
                  ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40 shadow-sm'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Modo Studio
            </button>
          </div>
        </div>

        {/* Direita: Ações Rápidas de Engenharia */}
        <div className="flex items-center space-x-2">
          {/* Auto-Layout */}
          <button
            onClick={applyAutoLayout}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors border border-white/5"
            title="Organizar nós automaticamente em camadas lógicas"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#00d4ff]" />
            <span className="hidden sm:inline">Auto-Layout</span>
          </button>

          {/* Exportar AST */}
          <button
            onClick={handleExportJson}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
            title="Exportar FlowAST em JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Exportar JSON</span>
          </button>

          {/* Importar AST */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
            title="Carregar FlowAST de um JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Importar</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJson}
            accept=".json"
            className="hidden"
          />

          {/* Limpar Canvas */}
          <button
            onClick={clearCanvas}
            className="p-1.5 rounded-lg text-white/40 hover:text-[#ef4444] hover:bg-white/5 transition-colors"
            title="Limpar Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Sincronizar e Compilar para Produção */}
          <button
            onClick={handleCompileAndSync}
            disabled={isCompiling}
            className="flex items-center space-x-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black text-xs font-extrabold uppercase tracking-wider hover:opacity-95 shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Compilar Código</span>
          </button>
        </div>
      </header>

      {/* Área Central de Trabalho com Flex */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Barra Lateral: Paleta de Nós Manuais */}
        <NodePalette onAddNode={addNode} />

        {/* Área Central: ReactFlow Canvas */}
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={(_, node) => selectNode(node.id)}
            onPaneClick={() => closeInspector()}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-[#050608]"
          >
            <Background color="#161b26" gap={24} size={1.2} />
            <Controls className="bg-[#090b11]/90 border border-white/10 rounded-xl text-white shadow-xl overflow-hidden fill-white" />
            <MiniMap
              nodeColor={node => {
                const cat = node.data?.category;
                if (cat === 'trigger') return '#00ff88';
                if (cat === 'backend_route') return '#00d4ff';
                if (cat === 'database') return '#a855f7';
                if (cat === 'service_ai') return '#f59e0b';
                if (cat === 'iot_device') return '#ef4444';
                return '#ec4899';
              }}
              maskColor="rgba(5, 6, 8, 0.85)"
              className="bg-[#090b11]/95 border border-white/10 rounded-xl shadow-2xl"
            />
          </ReactFlow>
        </div>

        {/* Gaveta Lateral Direita: Inspetor de Propriedades */}
        <InspectorDrawer
          node={selectedNode}
          isOpen={inspectorOpen}
          onClose={closeInspector}
          onUpdateData={updateNodeData}
          onUpdateConfig={updateNodeConfig}
          onDuplicate={duplicateNode}
          onRemove={removeNode}
        />
      </div>
    </div>
  );
};

export const CanvasStudio: React.FC<CanvasStudioProps> = props => {
  return (
    <ReactFlowProvider>
      <CanvasStudioInner {...props} />
    </ReactFlowProvider>
  );
};
