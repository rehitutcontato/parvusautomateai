/**
 * @file compiler.ts
 * @description Compilador, Gerador de Especificação e Algoritmo de Auto-Layout para a Engine de Grafo do Parvus Automate.
 */

import { 
  FlowAST, 
  FlowNode, 
  FlowEdge, 
  FlowCompilationResult, 
  NodeType, 
  NodeConfig 
} from './types';

/**
 * Algoritmo de Auto-Layout Hierárquico baseado em Camadas Topológicas (DAG Grid Layout)
 * Organiza os nós da esquerda para a direita de acordo com a responsabilidade funcional:
 * Camada 0: Triggers (Webhooks, Cron)
 * Camada 1: Backend Routes / IoT Devices
 * Camada 2: AI Services & Processadores
 * Camada 3: Database & Persistência Supabase
 * Camada 4: Frontend UI & Interfaces
 */
export function autoLayoutGraph(nodes: FlowNode[], edges: FlowEdge[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const layerOrder: Record<NodeType, number> = {
    trigger: 0,
    iot_device: 1,
    backend_route: 1,
    service_ai: 2,
    database: 3,
    frontend_ui: 4
  };

  // Agrupa os nós por camada
  const layers: Record<number, FlowNode[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: []
  };

  nodes.forEach(node => {
    const layerIndex = layerOrder[node.data.category] ?? 1;
    layers[layerIndex].push(node);
  });

  const X_SPACING = 340;
  const Y_SPACING = 200;
  const START_X = 80;
  const START_Y = 80;

  const layoutedNodes = nodes.map(node => {
    const layerIndex = layerOrder[node.data.category] ?? 1;
    const layerNodes = layers[layerIndex];
    const indexInLayer = layerNodes.findIndex(n => n.id === node.id);

    const x = START_X + layerIndex * X_SPACING;
    // Centraliza verticalmente a coluna se ela tiver menos nós
    const totalInLayer = layerNodes.length;
    const yOffset = totalInLayer < 3 ? (3 - totalInLayer) * (Y_SPACING / 2) : 0;
    const y = START_Y + indexInLayer * Y_SPACING + yOffset;

    return {
      ...node,
      position: { x, y }
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Gera um diagrama ASCII representativo baseado na topologia real dos nós e conexões do canvas
 */
export function generateAsciiFromGraph(nodes: FlowNode[], edges: FlowEdge[]): string {
  const nodeMap = new Map<string, FlowNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const lines: string[] = [
    '========================================================================',
    '       PARVUS AUTOMATE - TOPOLOGIA DO SISTEMA GERADA NO CANVAS',
    '========================================================================',
    ''
  ];

  const triggers = nodes.filter(n => n.data.category === 'trigger');
  const routes = nodes.filter(n => n.data.category === 'backend_route');
  const aiNodes = nodes.filter(n => n.data.category === 'service_ai');
  const dbNodes = nodes.filter(n => n.data.category === 'database');
  const iotNodes = nodes.filter(n => n.data.category === 'iot_device');
  const uiNodes = nodes.filter(n => n.data.category === 'frontend_ui');

  if (triggers.length > 0) {
    lines.push('[GATILHOS / ENTRADA]');
    triggers.forEach(t => {
      lines.push(`  +-- (Trigger: ${t.data.label}) [${t.data.config.triggerType || 'webhook'}]`);
    });
    lines.push('       |');
    lines.push('       v');
  }

  if (iotNodes.length > 0) {
    lines.push('[DISPOSITIVOS IOT / HARDWARE]');
    iotNodes.forEach(iot => {
      const pins = iot.data.config.gpioPins?.map(p => `GPIO${p.pin}:${p.component}`).join(', ') || 'N/A';
      lines.push(`  +-- [Dispositivo: ${iot.data.label}] Placa: ${iot.data.config.boardType || 'ESP32'} | Pinos: ${pins}`);
    });
    lines.push('       | (Telemetria MQTT/HTTP)');
    lines.push('       v');
  }

  if (routes.length > 0) {
    lines.push('[ROUTER / EXPRESS BACKEND]');
    routes.forEach(r => {
      lines.push(`  +-- [Endpoint: ${r.data.config.routeMethod || 'POST'} ${r.data.config.routePath || '/api'}] -> ${r.data.label}`);
    });
    lines.push('       |');
    lines.push('       v');
  }

  if (aiNodes.length > 0) {
    lines.push('[SERVIÇOS COGNITIVOS DE IA]');
    aiNodes.forEach(ai => {
      lines.push(`  +-- <IA: ${ai.data.label}> Modelo: ${ai.data.config.aiModel || 'gemini-3.6-flash'} (Temp: ${ai.data.config.temperature ?? 0.2})`);
    });
    lines.push('       |');
    lines.push('       v');
  }

  if (dbNodes.length > 0) {
    lines.push('[PERSISTÊNCIA SUPABASE / POSTGRESQL]');
    dbNodes.forEach(db => {
      lines.push(`  +-- [(DB Table: ${db.data.config.dbTable || 'data'})] Operação: ${db.data.config.dbOperation || 'INSERT'}`);
    });
    lines.push('       |');
    lines.push('       v');
  }

  if (uiNodes.length > 0) {
    lines.push('[CLIENTE FRONTEND / SPA INTERATIVO]');
    uiNodes.forEach(ui => {
      lines.push(`  +-- {UI Component: ${ui.data.label}} Tipo: ${ui.data.config.uiComponentType || 'dashboard'}`);
    });
  }

  lines.push('');
  lines.push('------------------------- CONEXÕES ATIVAS ------------------------------');
  if (edges.length === 0) {
    lines.push('  (Nenhuma conexão explícita entre nós)');
  } else {
    edges.forEach((edge, idx) => {
      const src = nodeMap.get(edge.source)?.data.label || edge.source;
      const tgt = nodeMap.get(edge.target)?.data.label || edge.target;
      const label = edge.data?.label ? ` --[ ${edge.data.label} ]--> ` : ' -------> ';
      lines.push(`  ${idx + 1}. [${src}]${label}[${tgt}]`);
    });
  }
  lines.push('========================================================================');

  return lines.join('\n');
}

/**
 * Serializa e compila o estado atual do canvas para uma especificação técnica formal (FlowCompilationResult)
 * que alimenta a IA e gera código de produção real para o projeto final.
 */
export function compileGraphToSpecification(ast: FlowAST): FlowCompilationResult {
  const { nodes, edges } = ast;
  
  const triggers = nodes.filter(n => n.data.category === 'trigger');
  const routes = nodes.filter(n => n.data.category === 'backend_route');
  const databases = nodes.filter(n => n.data.category === 'database');
  const aiServices = nodes.filter(n => n.data.category === 'service_ai');
  const iotDevices = nodes.filter(n => n.data.category === 'iot_device');
  const frontendUis = nodes.filter(n => n.data.category === 'frontend_ui');

  const asciiArchitecture = generateAsciiFromGraph(nodes, edges);

  // Monta especificação descritiva detalhada para o prompt da IA
  const specLines: string[] = [
    `# ESPECIFICAÇÃO DE ARQUITETURA EXTRAÍDA DO CANVAS STUDIO (FlowAST v${ast.version})`,
    `Projeto: ${ast.name}`,
    `Descrição: ${ast.description}`,
    `Tipo: ${ast.metadata.projectType} | Complexidade: ${ast.metadata.complexity}`,
    `Total de Nós: ${nodes.length} | Conexões Ativas: ${edges.length}`,
    '',
    '## 1. COMPONENTES ARQUITETURAIS REGISTRADOS:',
    ...nodes.map((n, i) => {
      const cfg = n.data.config;
      let cfgDetails = '';
      if (n.data.category === 'trigger') {
        cfgDetails = `Tipo: ${cfg.triggerType}, Rota: ${cfg.webhookPath || 'N/A'}, Cron: ${cfg.cronExpression || 'N/A'}`;
      } else if (n.data.category === 'backend_route') {
        cfgDetails = `Método: ${cfg.routeMethod}, Path: ${cfg.routePath}, Controller: ${cfg.controllerName}`;
      } else if (n.data.category === 'database') {
        cfgDetails = `Tabela: ${cfg.dbTable}, Operação: ${cfg.dbOperation}, RLS: ${cfg.rlsPolicy || 'Default'}`;
      } else if (n.data.category === 'service_ai') {
        cfgDetails = `Modelo: ${cfg.aiModel}, Temp: ${cfg.temperature}, Formato: ${cfg.outputFormat}`;
      } else if (n.data.category === 'iot_device') {
        const pinSummary = cfg.gpioPins?.map(p => `Pino ${p.pin} (${p.component})`).join(', ') || 'Sem pinos';
        cfgDetails = `Placa: ${cfg.boardType}, Baudrate: ${cfg.baudRate}, Pinos: ${pinSummary}`;
      } else if (n.data.category === 'frontend_ui') {
        cfgDetails = `Componente: ${cfg.uiComponentType}, Rota Vinculada: ${cfg.uiRouteBind}`;
      }
      return `${i + 1}. [${n.data.category.toUpperCase()}] "${n.data.label}" (ID: ${n.id})\n   - Descrição: ${n.data.description}\n   - Detalhes: ${cfgDetails}\n   - Status: ${n.data.status}`;
    }),
    '',
    '## 2. RELAÇÕES E FLUXO DE DADOS (EDGES):',
    ...edges.map((e, i) => `   ${i + 1}. De ${e.source} para ${e.target} (${e.data?.label || 'Fluxo direto'})`),
    '',
    '## 3. CÓDIGO FONTE BASE INJETADO PELOS NÓS:',
    ...nodes.filter(n => Boolean(n.data.codeSnippet)).map(n => `### Nó: ${n.data.label}\n\`\`\`javascript\n${n.data.codeSnippet}\n\`\`\``)
  ];

  const specificationText = specLines.join('\n');

  // GERAÇÃO DIRETA DE EXPRESS SERVER CODE BASEADO NOS NÓS
  const routeImplementations = routes.map(r => {
    const method = (r.data.config.routeMethod || 'POST').toLowerCase();
    const routePath = r.data.config.routePath || '/api/action';
    return `
/**
 * Rota gerada pelo nó: ${r.data.label}
 * ${r.data.description}
 */
app.${method}('${routePath}', async (req, res) => {
  try {
    const payload = req.body;
    console.log('[API ${method.toUpperCase()} ${routePath}] Requisição recebida:', payload);
    
    // Lógica definida no nó
    ${r.data.codeSnippet ? r.data.codeSnippet : `
    // Processamento padrão do endpoint
    const result = {
      success: true,
      data: payload,
      processedAt: new Date().toISOString(),
      nodeId: '${r.id}'
    };
    return res.status(200).json(result);
    `}
  } catch (error) {
    console.error('Erro na rota ${routePath}:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});`;
  }).join('\n');

  const expressCode = `/**
 * @file server.js
 * Servidor Express gerado a partir do Canvas Studio da Parvus Automate
 * Topologia: ${nodes.length} nós funcionais compilados.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares essenciais
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger estruturado com timestamp
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.originalUrl} \${res.statusCode} - \${duration}ms\`);
  });
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: '${ast.name}',
    nodesCount: ${nodes.length},
    timestamp: new Date().toISOString()
  });
});

${routeImplementations}

// Inicia servidor
app.listen(PORT, () => {
  console.log(\`🚀 Servidor Parvus Automate rodando com sucesso em http://localhost:\${PORT}\`);
});

export default app;
`;

  // GERAÇÃO DE SCRIPT SQL PARA O SUPABASE
  const sqlTables = databases.map(db => {
    const tableName = db.data.config.dbTable || 'parvus_records';
    return `
-- Tabela gerada pelo nó: ${db.data.label}
CREATE TABLE IF NOT EXISTS public.${tableName} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ativa RLS
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança RLS
DROP POLICY IF EXISTS "Usuário gerencia próprios dados em ${tableName}" ON public.${tableName};
CREATE POLICY "Usuário gerencia próprios dados em ${tableName}" 
  ON public.${tableName} FOR ALL 
  USING (auth.uid() = user_id);
`;
  }).join('\n');

  const schemaSql = `-- ======================================================
-- ESQUEMA SQL SUPABASE / POSTGRESQL GERADO PELO CANVAS STUDIO
-- Projeto: ${ast.name}
-- ======================================================
${sqlTables || `
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs acessíveis ao proprietário" ON public.automation_logs FOR ALL USING (true);
`}
`;

  // GERAÇÃO DE CÓDIGO FIRMWARE IOT SE HOUVER NÓS DE HARDWARE
  let codigoPlaca: string | undefined = undefined;
  if (iotDevices.length > 0) {
    const firstIot = iotDevices[0];
    const board = firstIot.data.config.boardType || 'esp32';
    const pins = firstIot.data.config.gpioPins || [
      { pin: 4, mode: 'OUTPUT', component: 'Relé de Comando', label: 'RELE_PIN' },
      { pin: 34, mode: 'ANALOG_IN', component: 'Sensor Analógico', label: 'SENSOR_PIN' }
    ];

    const pinDefs = pins.map(p => `#define ${p.label || `PIN_${p.pin}`} ${p.pin} // ${p.component} (${p.mode})`).join('\n');
    const pinSetups = pins.map(p => `  pinMode(${p.label || `PIN_${p.pin}`}, ${p.mode === 'OUTPUT' ? 'OUTPUT' : 'INPUT'});`).join('\n');

    codigoPlaca = `/**
 * Firmware gerado automaticamente pelo Parvus Automate Canvas Studio
 * Placa Alvo: ${board.toUpperCase()}
 * Módulo: ${firstIot.data.label}
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// Definição de Pinos GPIO Mapeados no Canvas
${pinDefs}

const char* ssid = "WIFI_REDE";
const char* password = "WIFI_SENHA";
const char* mqtt_server = "broker.hivemq.com";

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = ${firstIot.data.config.telemetryIntervalMs || 5000};

void setup() {
  Serial.begin(${firstIot.data.config.baudRate || 115200});
  Serial.println("\n[BOOT] Iniciando sistema embarcado Parvus Automate...");
  
${pinSetups}

  // Conexão Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("[WIFI] Conectando");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Conectado! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WARN] Wi-Fi em modo offline.");
  }
}

void loop() {
  unsigned long now = millis();
  
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = now;
    
    // Leitura dos canais virtuais definidos no Canvas Studio
    Serial.printf("[TELEMETRIA] Uptime: %lu ms | Heap Livre: %u bytes\\n", now, ESP.getFreeHeap());
  }
}
`;
  }

  const packageJson = JSON.stringify({
    name: ast.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    version: '1.0.0',
    type: 'module',
    scripts: {
      start: 'node server.js',
      dev: 'nodemon server.js'
    },
    dependencies: {
      express: '^4.21.2',
      cors: '^2.8.5',
      helmet: '^8.0.0',
      dotenv: '^16.4.7',
      '@supabase/supabase-js': '^2.49.1'
    }
  }, null, 2);

  const envExample = `# Configurações de Ambiente - ${ast.name}
PORT=3000
NODE_ENV=production
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
WEBHOOK_SECRET=whsec_parvus_${Math.random().toString(36).substring(2, 10)}
`;

  return {
    specificationText,
    expressCode,
    packageJson,
    envExample,
    schemaSql,
    codigoPlaca,
    asciiArchitecture,
    summary: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      triggersCount: triggers.length,
      routesCount: routes.length,
      databasesCount: databases.length,
      aiServicesCount: aiServices.length,
      iotDevicesCount: iotDevices.length,
      frontendUiCount: frontendUis.length
    }
  };
}

/**
 * Cria um FlowAST inicial funcional baseado na descrição do usuário e tipo de projeto
 */
export function createDefaultFlowAST(prompt: string, projectType: 'SOFTWARE' | 'HARDWARE' | 'HIBRIDO' | 'ENTERPRISE' = 'SOFTWARE'): FlowAST {
  const isHardware = projectType === 'HARDWARE' || projectType === 'HIBRIDO';

  const defaultNodes: FlowNode[] = [
    {
      id: 'node-trigger-1',
      type: 'trigger',
      position: { x: 50, y: 150 },
      data: {
        label: 'Webhook de Ingestão',
        description: 'Recebe payloads JSON de eventos externos com assinatura HMAC-SHA256.',
        category: 'trigger',
        status: 'ready',
        config: {
          triggerType: 'webhook',
          webhookPath: '/api/v1/webhook/events',
          httpMethod: 'POST',
          authSecretHeader: 'x-signature-sha256'
        },
        codeSnippet: `// Valida assinatura HMAC
const signature = req.headers['x-signature-sha256'];
if (!signature) throw new Error('Assinatura ausente');`,
        inputs: [],
        outputs: [
          { id: 'out-event', label: 'Evento Ingerido', type: 'event' }
        ]
      }
    },
    {
      id: 'node-route-1',
      type: 'backend_route',
      position: { x: 380, y: 150 },
      data: {
        label: 'Pipeline Controller',
        description: 'Valida o payload, autentica o usuário e coordena a execução do fluxo.',
        category: 'backend_route',
        status: 'ready',
        config: {
          routePath: '/api/v1/automation/process',
          routeMethod: 'POST',
          controllerName: 'ProcessAutomationController',
          middlewares: ['helmet', 'cors', 'authMiddleware']
        },
        codeSnippet: `const { event, data } = req.body;
console.log('[Pipeline] Processando evento:', event);`,
        inputs: [
          { id: 'in-route', label: 'Payload', type: 'data' }
        ],
        outputs: [
          { id: 'out-processed', label: 'Dados Tratados', type: 'data' }
        ]
      }
    },
    {
      id: 'node-ai-1',
      type: 'service_ai',
      position: { x: 720, y: 150 },
      data: {
        label: 'Cognitive Engine IA',
        description: 'Aplica inferência com modelos Gemini/NVIDIA para classificação ou síntese.',
        category: 'service_ai',
        status: 'ready',
        config: {
          aiModel: 'gemini-3.6-flash',
          temperature: 0.2,
          outputFormat: 'json',
          systemPrompt: 'Você é um analisador autônomo. Extraia intenções, entidades e classifique a gravidade.'
        },
        codeSnippet: `const response = await ai.models.generateContent({
  model: 'gemini-3.6-flash',
  contents: prompt
});`,
        inputs: [
          { id: 'in-prompt', label: 'Contexto', type: 'data' }
        ],
        outputs: [
          { id: 'out-decision', label: 'Decisão / JSON', type: 'data' }
        ]
      }
    },
    {
      id: 'node-db-1',
      type: 'database',
      position: { x: 1060, y: 150 },
      data: {
        label: 'Supabase Repository',
        description: 'Gravação segura com isolamento de tenant via Row Level Security (RLS).',
        category: 'database',
        status: 'ready',
        config: {
          dbTable: 'automation_records',
          dbOperation: 'INSERT',
          enableAudit: true,
          rlsPolicy: 'auth.uid() = user_id'
        },
        codeSnippet: `const { data, error } = await supabase
  .from('automation_records')
  .insert(payload);`,
        inputs: [
          { id: 'in-db-data', label: 'Gravação', type: 'data' }
        ],
        outputs: [
          { id: 'out-db-record', label: 'Registro UUID', type: 'data' }
        ]
      }
    },
    {
      id: 'node-ui-1',
      type: 'frontend_ui',
      position: { x: 1400, y: 150 },
      data: {
        label: 'Dashboard de Controle',
        description: 'Interface de telemetria em tempo real com KPI cards e console de eventos.',
        category: 'frontend_ui',
        status: 'ready',
        config: {
          uiComponentType: 'dashboard_card',
          uiTitle: 'Painel de Automações',
          uiRefreshIntervalMs: 2000
        },
        codeSnippet: `// Componente React de visualização
<MetricCard title="Taxa de Sucesso" value="99.4%" />`,
        inputs: [
          { id: 'in-ui-feed', label: 'Feed UI', type: 'data' }
        ],
        outputs: []
      }
    }
  ];

  if (isHardware) {
    defaultNodes.splice(2, 0, {
      id: 'node-iot-1',
      type: 'iot_device',
      position: { x: 550, y: 350 },
      data: {
        label: 'ESP32 IoT Node',
        description: 'Nó físico de aquisição de telemetria e controle de atuadores via relé.',
        category: 'iot_device',
        status: 'ready',
        config: {
          boardType: 'esp32',
          baudRate: 115200,
          gpioPins: [
            { pin: 4, mode: 'OUTPUT', component: 'Relé de Força', label: 'RELAY_1' },
            { pin: 34, mode: 'ANALOG_IN', component: 'Sensor Analógico ADC', label: 'ADC_SENSOR' }
          ],
          telemetryIntervalMs: 3000
        },
        codeSnippet: `digitalWrite(RELAY_1, HIGH); // Ativa relé
float valor = analogRead(ADC_SENSOR);`,
        inputs: [
          { id: 'in-iot-cmd', label: 'Comando', type: 'signal' }
        ],
        outputs: [
          { id: 'out-iot-telemetry', label: 'Telemetria MQTT', type: 'data' }
        ]
      }
    });
  }

  const defaultEdges: FlowEdge[] = [
    {
      id: 'edge-1-2',
      source: 'node-trigger-1',
      target: 'node-route-1',
      sourceHandle: 'out-event',
      targetHandle: 'in-route',
      animated: true,
      data: { label: 'HTTP POST' }
    },
    {
      id: 'edge-2-3',
      source: 'node-route-1',
      target: 'node-ai-1',
      sourceHandle: 'out-processed',
      targetHandle: 'in-prompt',
      animated: true,
      data: { label: 'Inferência' }
    },
    {
      id: 'edge-3-4',
      source: 'node-ai-1',
      target: 'node-db-1',
      sourceHandle: 'out-decision',
      targetHandle: 'in-db-data',
      animated: true,
      data: { label: 'Persistência' }
    },
    {
      id: 'edge-4-5',
      source: 'node-db-1',
      target: 'node-ui-1',
      sourceHandle: 'out-db-record',
      targetHandle: 'in-ui-feed',
      animated: false,
      data: { label: 'WebSocket Push' }
    }
  ];

  if (isHardware) {
    defaultEdges.push({
      id: 'edge-iot-route',
      source: 'node-iot-1',
      target: 'node-route-1',
      sourceHandle: 'out-iot-telemetry',
      targetHandle: 'in-route',
      animated: true,
      data: { label: 'MQTT Telemetry' }
    });
  }

  return {
    version: '2.0.0',
    id: `flow_${Date.now()}`,
    name: 'Arquitetura Parvus Automate',
    description: prompt ? prompt.substring(0, 100) : 'Sistema automatizado inteligente',
    nodes: defaultNodes,
    edges: defaultEdges,
    metadata: {
      version: '2.0.0',
      id: `meta_${Date.now()}`,
      name: 'Arquitetura Parvus Automate',
      description: prompt ? prompt.substring(0, 100) : 'Sistema automatizado inteligente',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectType,
      complexity: 'INTERMEDIARIO',
      technologies: isHardware ? ['React', 'Node.js', 'Express', 'Supabase', 'ESP32', 'MQTT', 'Gemini'] : ['React', 'Node.js', 'Express', 'Supabase', 'Gemini']
    }
  };
}
