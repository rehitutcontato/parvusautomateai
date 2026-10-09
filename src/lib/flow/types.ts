/**
 * @file types.ts
 * @description Schema estrito de tipos e interfaces do FlowAST (Engine de Nós Funcionais Interativos)
 * para a plataforma Parvus Automate.
 */

import { Node, Edge } from 'reactflow';

export type NodeType = 
  | 'trigger' 
  | 'backend_route' 
  | 'database' 
  | 'service_ai' 
  | 'iot_device' 
  | 'frontend_ui';

export type NodeStatus = 'idle' | 'ready' | 'error';

export type HandleDataType = 'flow' | 'data' | 'signal' | 'event';

export interface NodeHandleDef {
  id: string;
  label: string;
  type: HandleDataType;
  description?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type DatabaseOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
export type TriggerType = 'webhook' | 'cron' | 'mqtt_topic' | 'manual_event';
export type IotBoardType = 'esp32' | 'esp8266' | 'arduino_uno' | 'arduino_mega' | 'raspberry_pi';

export interface GpioPinConfig {
  pin: number;
  mode: 'INPUT' | 'OUTPUT' | 'ANALOG_IN' | 'PWM';
  component: string;
  label: string;
}

export interface NodeConfig {
  // Configurações para 'trigger'
  triggerType?: TriggerType;
  webhookPath?: string;
  httpMethod?: HttpMethod;
  cronExpression?: string;
  mqttTopic?: string;
  authSecretHeader?: string;

  // Configurações para 'backend_route'
  routePath?: string;
  routeMethod?: HttpMethod;
  middlewares?: string[];
  controllerName?: string;
  payloadSchema?: string;

  // Configurações para 'database'
  dbTable?: string;
  dbOperation?: DatabaseOperation;
  dbColumns?: string[];
  rlsPolicy?: string;
  enableAudit?: boolean;

  // Configurações para 'service_ai'
  aiModel?: 'gemini-3.6-flash' | 'gemini-3.5-flash' | 'z-ai/glm-5.1' | 'nvidia/nemotron-3-super-120b-a12b' | 'deepseek-ai/deepseek-r1';
  systemPrompt?: string;
  temperature?: number;
  outputFormat?: 'json' | 'text' | 'stream';

  // Configurações para 'iot_device'
  boardType?: IotBoardType;
  baudRate?: number;
  wifiSsid?: string;
  gpioPins?: GpioPinConfig[];
  telemetryIntervalMs?: number;

  // Configurações para 'frontend_ui'
  uiComponentType?: 'form' | 'dashboard_card' | 'terminal_console' | 'metric_kpi' | 'table_view' | 'kanban';
  uiTitle?: string;
  uiRouteBind?: string;
  uiRefreshIntervalMs?: number;

  // Configurações genéricas
  customVariables?: Record<string, string>;
  notes?: string;
}

export interface FlowNodeData {
  label: string;
  description: string;
  category: NodeType;
  config: NodeConfig;
  status: NodeStatus;
  codeSnippet: string;
  inputs: NodeHandleDef[];
  outputs: NodeHandleDef[];
}

export type FlowNode = Node<FlowNodeData>;

export interface FlowEdgeData {
  label?: string;
  dataType?: HandleDataType;
  description?: string;
}

export type FlowEdge = Edge<FlowEdgeData>;

export interface FlowASTMetadata {
  version: string;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  projectType: 'SOFTWARE' | 'HARDWARE' | 'HIBRIDO' | 'ENTERPRISE';
  complexity: 'BASICO' | 'INTERMEDIARIO' | 'AVANCADO' | 'ENTERPRISE';
  technologies: string[];
}

export interface FlowAST {
  version: string;
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: FlowASTMetadata;
}

export interface FlowCompilationResult {
  specificationText: string;
  expressCode: string;
  packageJson: string;
  envExample: string;
  schemaSql: string;
  codigoPlaca?: string;
  asciiArchitecture: string;
  summary: {
    totalNodes: number;
    totalEdges: number;
    triggersCount: number;
    routesCount: number;
    databasesCount: number;
    aiServicesCount: number;
    iotDevicesCount: number;
    frontendUiCount: number;
  };
}

export type WorkspaceMode = 'express' | 'studio';
