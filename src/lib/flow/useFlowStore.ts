/**
 * @file useFlowStore.ts
 * @description Hook / Store reativo para gerenciamento centralizado do estado do Canvas Studio (ReactFlow),
 * controle do Dual Mode e operações de sincronização arquitetural.
 */

import { useState, useCallback, useMemo } from 'react';
import { 
  applyNodeChanges, 
  applyEdgeChanges, 
  NodeChange, 
  EdgeChange, 
  Connection, 
  addEdge 
} from 'reactflow';
import { 
  FlowNode, 
  FlowEdge, 
  FlowAST, 
  NodeType, 
  FlowNodeData, 
  NodeConfig, 
  FlowCompilationResult, 
  WorkspaceMode 
} from './types';
import { 
  autoLayoutGraph, 
  compileGraphToSpecification, 
  createDefaultFlowAST 
} from './compiler';

export function useFlowStore(initialAST?: FlowAST) {
  const defaultAst = useMemo(() => initialAST || createDefaultFlowAST('Automação Empresarial Inteligente'), [initialAST]);

  const [nodes, setNodes] = useState<FlowNode[]>(defaultAst.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(defaultAst.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('express');
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [lastCompilation, setLastCompilation] = useState<FlowCompilationResult | null>(null);

  // Manipuladores de alteração de nós e arestas do ReactFlow
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
  }, []);

  // Manipulador de nova conexão entre nós
  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection,
      animated: true,
      style: { stroke: '#00ff88', strokeWidth: 2 },
      data: { label: 'Fluxo Conectado' }
    }, eds));
  }, []);

  // Selecionar nó e abrir/fechar o Inspector Drawer
  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    setInspectorOpen(Boolean(id));
  }, []);

  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
  }, []);

  // Adicionar novo nó funcional ao canvas
  const addNode = useCallback((type: NodeType, position?: { x: number; y: number }, initialData?: Partial<FlowNodeData>) => {
    const newId = `node-${type}-${Date.now().toString(36)}`;
    const pos = position || { x: 250 + Math.random() * 80, y: 150 + Math.random() * 80 };

    const typeLabels: Record<NodeType, string> = {
      trigger: 'Novo Gatilho (Trigger)',
      backend_route: 'Nova Rota Backend',
      database: 'Nova Operação Database',
      service_ai: 'Novo Modelo de IA',
      iot_device: 'Nova Placa IoT',
      frontend_ui: 'Novo Componente UI'
    };

    const typeDescriptions: Record<NodeType, string> = {
      trigger: 'Ponto de entrada de eventos (Webhook, Cron ou Mensagem).',
      backend_route: 'Endpoint REST Node.js/Express para lógica de negócio.',
      database: 'Operação PostgreSQL / Supabase com governança RLS.',
      service_ai: 'Chamada cognitiva a LLMs Gemini/Nemotron com prompt.',
      iot_device: 'Microcontrolador ESP32/Arduino com mapeamento GPIO.',
      frontend_ui: 'Interface interativa vinculada à automação.'
    };

    const defaultInputs = type === 'trigger' ? [] : [{ id: 'in-main', label: 'Entrada', type: 'data' as const }];
    const defaultOutputs = type === 'frontend_ui' ? [] : [{ id: 'out-main', label: 'Saída', type: 'data' as const }];

    const newNode: FlowNode = {
      id: newId,
      type,
      position: pos,
      data: {
        label: initialData?.label || typeLabels[type],
        description: initialData?.description || typeDescriptions[type],
        category: type,
        status: 'ready',
        config: initialData?.config || {},
        codeSnippet: initialData?.codeSnippet || '',
        inputs: initialData?.inputs || defaultInputs,
        outputs: initialData?.outputs || defaultOutputs
      }
    };

    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(newId);
    setInspectorOpen(true);
    return newNode;
  }, []);

  // Atualizar dados do nó selecionado
  const updateNodeData = useCallback((id: string, updates: Partial<FlowNodeData>) => {
    setNodes(nds => nds.map(node => {
      if (node.id === id) {
        return {
          ...node,
          data: {
            ...node.data,
            ...updates
          }
        };
      }
      return node;
    }));
  }, []);

  // Atualizar config do nó selecionado
  const updateNodeConfig = useCallback((id: string, configUpdates: Partial<NodeConfig>) => {
    setNodes(nds => nds.map(node => {
      if (node.id === id) {
        return {
          ...node,
          data: {
            ...node.data,
            config: {
              ...node.data.config,
              ...configUpdates
            }
          }
        };
      }
      return node;
    }));
  }, []);

  // Remover nó
  const removeNode = useCallback((id: string) => {
    setNodes(nds => nds.filter(node => node.id !== id));
    setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      setInspectorOpen(false);
    }
  }, [selectedNodeId]);

  // Duplicar nó
  const duplicateNode = useCallback((id: string) => {
    const original = nodes.find(n => n.id === id);
    if (!original) return;

    const newId = `node-${original.data.category}-${Date.now().toString(36)}`;
    const duplicated: FlowNode = {
      ...original,
      id: newId,
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      data: {
        ...original.data,
        label: `${original.data.label} (Cópia)`
      }
    };

    setNodes(nds => [...nds, duplicated]);
    setSelectedNodeId(newId);
  }, [nodes]);

  // Remover aresta
  const removeEdge = useCallback((id: string) => {
    setEdges(eds => eds.filter(edge => edge.id !== id));
  }, []);

  // Aplicar Auto-Layout
  const applyAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = autoLayoutGraph(nodes, edges);
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [nodes, edges]);

  // Exportar AST completo
  const exportAST = useCallback((): FlowAST => {
    return {
      version: '2.0.0',
      id: `flow_export_${Date.now()}`,
      name: 'Arquitetura Parvus Automate',
      description: 'Exportado via Studio Canvas',
      nodes,
      edges,
      metadata: {
        version: '2.0.0',
        id: `meta_${Date.now()}`,
        name: 'Arquitetura Parvus Automate',
        description: 'Exportado via Studio Canvas',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectType: nodes.some(n => n.data.category === 'iot_device') ? 'HIBRIDO' : 'SOFTWARE',
        complexity: 'AVANCADO',
        technologies: ['React', 'Node.js', 'Express', 'Supabase', 'ReactFlow']
      }
    };
  }, [nodes, edges]);

  // Carregar AST
  const loadAST = useCallback((ast: FlowAST) => {
    setNodes(ast.nodes || []);
    setEdges(ast.edges || []);
    setSelectedNodeId(null);
    setInspectorOpen(false);
  }, []);

  // Compilar o Grafo para Produção (Grafo -> Código)
  const compile = useCallback((): FlowCompilationResult => {
    setIsCompiling(true);
    try {
      const currentAst = exportAST();
      const result = compileGraphToSpecification(currentAst);
      setLastCompilation(result);
      return result;
    } finally {
      setIsCompiling(false);
    }
  }, [exportAST]);

  // Limpar canvas
  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setInspectorOpen(false);
  }, []);

  // Nó selecionado atual
  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return {
    nodes,
    edges,
    selectedNodeId,
    selectedNode,
    inspectorOpen,
    activeMode,
    isCompiling,
    lastCompilation,
    setNodes,
    setEdges,
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
    removeEdge,
    applyAutoLayout,
    exportAST,
    loadAST,
    compile,
    clearCanvas,
    setActiveMode
  };
}
