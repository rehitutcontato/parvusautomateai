import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";
import crypto from "crypto";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import { safeJsonParseWithRepair, extractJsonString } from "./src/lib/jsonRepairHelper";
import { repairIncompleteIotProject, sanitizeFirmwareCode } from "./src/lib/iotRepairHelper";
import {
  normalizeGeminiModelChain,
  normalizeNvidiaModelChain,
  shouldFastAbortNvidia,
  resolveAiProviderPriority,
  normalizeSchemaForGemini,
  normalizeSchemaForOpenAi
} from "./src/lib/aiBrokerHelper";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(cors({
  origin: '*', // Permite todas as origens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-key', 'x-nvidia-key']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- AI API PROXY MANAGER ---
function getCleanApiKey(userKey: string | undefined, envKeyName: string): string | undefined {
  let apiKey = userKey || process.env[envKeyName];
  if (!apiKey) return undefined;
  apiKey = apiKey.toString().trim().replace(/['"]/g, '').replace('Bearer ', '');
  if (apiKey === 'SUA_CHAVE_AQUI' || apiKey === 'YOUR_API_KEY_HERE') return undefined;
  return apiKey;
}

// Extrator robusto de JSON compartilhado
function extractJsonSubstring(text: string): string {
  return extractJsonString(text);
}

// Unified robust runner that tries the user preferred key/model, automatically falling back dynamically
async function executeGenerativeTask(prompt: string, config: any, userKey?: string, reqId?: string): Promise<string> {
  const isUserGeminiKey = userKey && (userKey.startsWith("AIzaSy") || userKey.startsWith("aizasy") || userKey.includes("AIzaSy"));
  const isUserNvidiaKey = userKey && !isUserGeminiKey;
  
  // Extrai as chaves de forma inteligente
  const geminiKey = isUserGeminiKey ? userKey : (process.env.GEMINI_API_KEY || getCleanApiKey(undefined, 'GEMINI_API_KEY'));
  const nvidiaKey = isUserNvidiaKey ? userKey : (process.env.NVIDIA_API_KEY || getCleanApiKey(undefined, 'NVIDIA_API_KEY'));

  const errors: string[] = [];

  // Helper para timeout defensivo por tentativa
  const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout de ${ms / 1000}s excedido em ${label}`));
      }, ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  };

  // FUNÇÕES DE EXECUÇÃO
  const runGemini = async () => {
    if (!geminiKey) {
      errors.push("Chave Gemini ausente ou não configurada.");
      return false;
    }

    const uniqueGeminiModels = normalizeGeminiModelChain(config?.model);

    for (const geminiModel of uniqueGeminiModels) {
      try {
        console.log(`[REQ ${reqId}] Tentativa com Google Gemini (${geminiModel})...`);
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        
        const genConfig: any = {
          temperature: config?.temperature !== undefined ? config.temperature : 0.2,
          maxOutputTokens: config?.maxOutputTokens || config?.max_tokens || 16384,
        };
        
        if (config?.responseMimeType === 'application/json' || config?.responseSchema) {
          genConfig.responseMimeType = 'application/json';
          if (config?.responseSchema) {
            genConfig.responseSchema = normalizeSchemaForGemini(config.responseSchema);
          }
        }

        let response: any;
        try {
          const callPromise = ai.models.generateContent({
            model: geminiModel,
            contents: prompt,
            config: genConfig
          });
          response = await withTimeout(callPromise, 70000, `Gemini (${geminiModel})`);
        } catch (callErr: any) {
          const callErrMsg = callErr.message || String(callErr);
          // Se falhou com erro de validação ou restrição de schema, retenta sem strict responseSchema mantendo application/json
          if (genConfig.responseSchema && (callErrMsg.includes('schema') || callErrMsg.includes('Schema') || callErrMsg.includes('400') || callErrMsg.includes('Invalid argument'))) {
            console.warn(`[REQ ${reqId}] Retentando Gemini (${geminiModel}) sem restrição estrita de schema...`);
            const fallbackConfig = { ...genConfig };
            delete fallbackConfig.responseSchema;
            const retryPromise = ai.models.generateContent({
              model: geminiModel,
              contents: prompt,
              config: fallbackConfig
            });
            response = await withTimeout(retryPromise, 70000, `Gemini (${geminiModel}-fallback)`);
          } else {
            throw callErr;
          }
        }

        const text = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (err: any) {
        const errMsg = err.message || String(err);
        console.warn(`[REQ ${reqId}] Falha/Timeout no Gemini (${geminiModel}): ${errMsg}.`);
        errors.push(`Gemini (${geminiModel}): ${errMsg}`);
      }
    }
    return false;
  };

  const runNvidia = async () => {
    if (!nvidiaKey || nvidiaKey.startsWith("AIzaSy")) {
      errors.push("Chave NVIDIA inválida ou ausente.");
      return false;
    }

    const nvidiaModelsToTry = normalizeNvidiaModelChain(config?.model);
    const isJson = config?.responseMimeType === 'application/json' || Boolean(config?.responseSchema);

    for (const nvidiaModel of nvidiaModelsToTry) {
      const openai = new OpenAI({ 
        apiKey: nvidiaKey, 
        baseURL: "https://integrate.api.nvidia.com/v1",
        timeout: 60000 
      });
      
      let messages: any[] = [{ role: "user", content: prompt }];
      if (isJson) {
        let systemPrompt = "You must output strictly JSON format only. Do not output any markdown code blocks, explanation or introductory text.";
        if (config?.responseSchema) {
          const openAiSchema = normalizeSchemaForOpenAi(config.responseSchema);
          systemPrompt += ` The JSON must strictly conform to this schema: ${JSON.stringify(openAiSchema)}`;
        }
        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ];
      }

      const attempts = isJson ? [true, false] : [false];

      for (const withResponseFormat of attempts) {
        try {
          console.log(`[REQ ${reqId}] Tentativa com NVIDIA (${nvidiaModel}) [response_format=${withResponseFormat}]...`);
          const openAiConfig: any = {
            model: nvidiaModel,
            messages,
            temperature: config?.temperature !== undefined ? config.temperature : 0.2,
            top_p: 1,
            max_tokens: config?.max_tokens || config?.maxOutputTokens || 16384,
          };
          
          if (withResponseFormat) {
            openAiConfig.response_format = { type: "json_object" };
          }
    
          const callPromise = openai.chat.completions.create(openAiConfig);
          const response = await withTimeout(callPromise, 60000, `NVIDIA (${nvidiaModel})`);
          const content = response.choices?.[0]?.message?.content;
          if (content) return content;
        } catch (err: any) {
          const errMsg = err.message || String(err);
          console.warn(`[REQ ${reqId}] Falha/Timeout no NVIDIA (${nvidiaModel}, response_format=${withResponseFormat}): ${errMsg}`);
          if (withResponseFormat && (errMsg.includes('response_format') || errMsg.includes('400') || errMsg.includes('json_object') || errMsg.includes('unrecognized') || errMsg.includes('not supported'))) {
            continue;
          }
          errors.push(`NVIDIA (${nvidiaModel}): ${errMsg}`);

          // Interrupção rápida defensiva: se o erro for de autorização ou escopo da conta (410, 401, 403),
          // nenhum outro modelo NVIDIA funcionará com essa mesma chave.
          // Interrompe imediatamente para acionar o fallback do Gemini sem latência acumulada.
          if (shouldFastAbortNvidia(errMsg)) {
            console.warn(`[REQ ${reqId}] Chave NVIDIA sem permissão pública/créditos (código 410/401/403). Interrompendo tentativas NVIDIA para fallback rápido.`);
            return false;
          }
          break;
        }
      }
    }
    return false;
  };

  // ORDEM DE EXECUÇÃO:
  // Se o usuário enviou chave NVIDIA, ou AI_PROVIDER='nvidia', prioriza NVIDIA.
  // Caso contrário (padrão com geminiKey ou chave Gemini do usuário), prioriza Gemini com contingência automática na NVIDIA.
  const preferNvidia = resolveAiProviderPriority({
    isUserNvidiaKey: Boolean(isUserNvidiaKey),
    isUserGeminiKey: Boolean(isUserGeminiKey),
    nvidiaKey,
    geminiKey,
    envProvider: process.env.AI_PROVIDER
  }) === 'nvidia';

  if (preferNvidia) {
    const res = await runNvidia();
    if (res !== false) return res;
    // Fallback: Gemini
    console.log(`[REQ ${reqId}] Acionando contingência imediata com Google Gemini...`);
    const fallbackRes = await runGemini();
    if (fallbackRes !== false) return fallbackRes;
  } else {
    // Gemini Priority
    const res = await runGemini();
    if (res !== false) return res;
    // Fallback: Nvidia
    console.log(`[REQ ${reqId}] Acionando contingência imediata com NVIDIA NIM...`);
    const fallbackRes = await runNvidia();
    if (fallbackRes !== false) return fallbackRes;
  }

  throw new Error(`Falha crítica em todos os provedores/modelos de contingência. Detalhes: ${errors.join(" | ")}`);
}

// Buffer em memória para telemetria de alta performance e baixo overhead
const telemetryBuffer = new Map<string, any[]>();
const globalRecentPackets: any[] = [];
const deviceCommandBuffer = new Map<string, any[]>();

app.post("/api/ai/generate-iot", async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[REQ ${reqId}] POST /api/ai/generate-iot - Recebendo pedido para placa: ${req.body?.placa}`);
  
  try {
    const { prompt, placa } = req.body;
    const userKey = (req.headers['x-gemini-key'] || req.headers['x-nvidia-key']) as string;
    
    // Deixamos o motor responder dinamicamente com limite ampliado de tokens
    const config = {
      responseMimeType: 'application/json',
      maxOutputTokens: 16384,
      max_tokens: 16384
    };

    res.setHeader('Content-Type', 'application/json');
    res.write(' ');
    const heartbeat = setInterval(() => { res.write(' '); }, 15000);

    try {
      const aiText = await executeGenerativeTask(prompt, config, userKey, reqId);
      clearInterval(heartbeat);
      let cleanedText = extractJsonSubstring(aiText);
      
      console.log(`[REQ ${reqId}] Sucesso na geração IoT usando broker unificado. Tamanho: ${cleanedText.length}`);
      
      let parsedJson: any;
      try {
        parsedJson = safeJsonParseWithRepair(cleanedText);
        console.log(`[REQ ${reqId}] JSON validado/reparado com sucesso!`);
      } catch (parseErr: any) {
        throw new Error(`Falha ao converter e reparar resposta JSON da IA: ${parseErr.message}`);
      }

      // Sanitiza e valida completude do código de firmware
      if (parsedJson?.codigo) {
        if (typeof parsedJson.codigo.codigo_completo === 'string') {
          parsedJson.codigo.codigo_completo = sanitizeFirmwareCode(parsedJson.codigo.codigo_completo);
        }
      }

      // Se o firmware veio truncado ou incompleto (ex: sem loop ou sem setup), repara imediatamente
      const codeStr = parsedJson?.codigo?.codigo_completo || '';
      const isIncomplete = !codeStr || !codeStr.includes('void loop') || !codeStr.includes('void setup') || codeStr.length < 250;
      if (isIncomplete) {
        console.warn(`[REQ ${reqId}] Firmware truncado ou incompleto detectado. Acionando síntese de engenharia industrial...`);
        parsedJson = repairIncompleteIotProject(parsedJson, prompt, placa);
      }
      
      res.write(JSON.stringify(parsedJson));
      res.end();
    } catch (error: any) {
      clearInterval(heartbeat);
      console.error(`[REQ ${reqId}] Erro retornado ao cliente: ${error.message}`);
      res.write(JSON.stringify({ error: error.message }));
      res.end();
    }
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(JSON.stringify({ error: error.message }));
      res.end();
    }
  }
});

// ENDPOINTS REAIS DE TELEMETRIA IOT INTEGRADOS COM BANCO DE DADOS
app.post(["/api/iot/telemetry", "/api/v1/iot/telemetry"], async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  try {
    const body = req.body || {};
    const deviceId = body.device_id || body.deviceId || 'esp32_scale_01';
    const tenant = body.tenant || 'enterprise-corp';
    
    const packet = {
      id: 'pkt_' + Math.random().toString(36).substring(2, 8),
      device_id: deviceId,
      tenant,
      timestamp: body.timestamp || new Date().toISOString(),
      ...body
    };

    if (!telemetryBuffer.has(deviceId)) {
      telemetryBuffer.set(deviceId, []);
    }
    const history = telemetryBuffer.get(deviceId)!;
    history.push(packet);
    if (history.length > 50) history.shift();

    globalRecentPackets.push(packet);
    if (globalRecentPackets.length > 100) globalRecentPackets.shift();

    console.log(`[REQ ${reqId}] Telemetria ingerida de ${deviceId}:`, JSON.stringify(packet).substring(0, 120));

    // Persistência no Supabase se configurado
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!);
        await sb.from('iot_devices').update({
          dados_atuais: packet,
          ultimo_ping: new Date().toISOString(),
          status: 'online'
        }).or(`token_dispositivo.eq.${deviceId},nome.ilike.%${deviceId}%`);
      } catch (dbErr: any) {
        // Falha silenciosa defensiva
      }
    }

    res.json({ success: true, timestamp: packet.timestamp, packet });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(["/api/iot/telemetry", "/api/iot/telemetry/:deviceId"], async (req, res) => {
  const targetId = req.params.deviceId;
  let history: any[] = [];

  if (targetId && targetId !== 'latest' && targetId !== 'all') {
    history = telemetryBuffer.get(targetId) || [];
  }

  // Fallback para buffer global se o dispositivo específico não tiver histórico
  if (history.length === 0 && globalRecentPackets.length > 0) {
    history = [...globalRecentPackets];
  }

  // Fallback para Supabase se o buffer em memória estiver vazio
  if (history.length === 0 && process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!);
      const { data } = await sb.from('iot_devices')
        .select('dados_atuais, ultimo_ping, nome, hardware')
        .order('updated_at', { ascending: false })
        .limit(25);
      if (data && data.length > 0) {
        history = data
          .map(d => d.dados_atuais)
          .filter(Boolean);
      }
    } catch {
      // Ignora falha de DB defensivamente
    }
  }

  const latest = history[history.length - 1] || null;
  res.json({ success: true, latest, history });
});

app.post("/api/iot/command", (req, res) => {
  const { device_id, command, params } = req.body;
  const cmd = {
    id: 'cmd_' + Math.random().toString(36).substring(2, 8),
    device_id,
    command,
    params,
    timestamp: new Date().toISOString()
  };
  if (!deviceCommandBuffer.has(device_id)) {
    deviceCommandBuffer.set(device_id, []);
  }
  deviceCommandBuffer.get(device_id)!.push(cmd);
  console.log(`[IOT CMD] Comando enfileirado para ${device_id}: ${command}`);
  res.json({ success: true, cmd });
});

app.post("/api/ai/simulate-iot", async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[REQ ${reqId}] POST /api/ai/simulate-iot - Recebendo pedido de simulação para placa: ${req.body?.placa}`);
  
  try {
    const { codigo, linguagem, placa } = req.body;
    const userKey = (req.headers['x-gemini-key'] || req.headers['x-nvidia-key']) as string;
    
    const prompt = `Você é um emulador de hardware industrial e console serial de alta precisão para a plataforma: ${placa}.
Execute o seguinte código de ${linguagem} e simule o output do Serial Monitor / console de depuração por exatamente 10 ciclos de execução em tempo real.

CÓDIGO-FONTE A EXECUTAR:
${codigo}

DIRETRIZES DE EMULAÇÃO DE ALTA FIDELIDADE:
1. ETAPA DE BOOTLOADER / INICIALIZAÇÃO (Primeiras 4-6 linhas):
   - Simule o boot real da placa (ex: se ESP32, mostre clock de 240MHz, chip revision, MAC address, Free Heap, versão do core).
   - Simule a inicialização de barramentos (I2C/SPI/UART) e pinos GPIO conforme definidos no código.
   - Se houver Wi-Fi/Ethernet no código, simule a tentativa de conexão com pontos de progresso (....), sucesso, RSSI em dBm e obtenção de IP local (ex: 192.168.1.x).
   - Se houver MQTT/HTTP/WebSockets, simule a conexão ao servidor/broker com Client ID e inscrição de tópicos.

2. 10 CICLOS DE TELEMETRIA E PROCESSAMENTO:
   - Simule 10 iterações com timestamps crescentes realistas (ex: [00:00:02.150]).
   - Sensores: Apresente dados dinâmicos coerentes com ruído físico real (ex: temperatura variando 24.3°C, 24.6°C, 24.5°C; umidade variando; valores de ADC com flutuação natural).
   - Atuadores: Exiba feedback visual e técnico estrito de quando relés, buzzers, LEDs ou saídas digitais comutam de estado (ex: "[ATUADOR] Pino GPIO 4 -> HIGH (Relé 1 ATIVADO)").
   - Payloads de Rede: Mostre os pacotes JSON realmente enviados via MQTT/HTTP conforme codificado no loop.
   - Telemetria de Sistema: Inclua métricas de heap livre e status de watchdog se aplicável.

3. DIAGNÓSTICO:
   - Se houver erro de sintaxe, pino conflituoso ou biblioteca ausente no código, aponte um alerta claro formatado como "[RUNTIME WARN]" ou "[EXCEPTION]".

FORMATO DE RETORNO:
Retorne EXCLUSIVAMENTE o texto puro do Serial Monitor linha por linha. Não inclua blocos markdown (\`\`\`), explicações ou JSON. Apenas a saída bruta do terminal.`;

    res.setHeader('Content-Type', 'application/json');
    res.write(' ');
    const heartbeat = setInterval(() => { res.write(' '); }, 15000);

    try {
      const aiText = await executeGenerativeTask(prompt, { temperature: 0.4 }, userKey, reqId);
      clearInterval(heartbeat);
      console.log(`[REQ ${reqId}] Sucesso na simulação IoT usando broker unificado. Tamanho do payload: ${aiText.length} chars.`);
      res.write(JSON.stringify({ output: aiText }));
      res.end();
    } catch (error: any) {
      clearInterval(heartbeat);
      console.error(`[REQ ${reqId}] Erro retornado ao cliente: ${error.message}`);
      res.write(JSON.stringify({ error: error.message }));
      res.end();
    }
  } catch (error: any) {
    if (!res.headersSent) {
       res.status(500).json({ success: false, error: error.message });
    } else {
       res.write(JSON.stringify({ error: error.message }));
       res.end();
    }
  }
});

app.post("/api/ai/generate", async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[REQ ${reqId}] POST /api/ai/generate - Recebendo pedido geral de IA.`);
  
  try {
    const { model, contents, config } = req.body;
    if (!contents) {
      console.warn(`[REQ ${reqId}] Pedido recusado: sem contents (prompt).`);
      return res.status(400).json({ success: false, error: 'O prompt ou conteúdo é obrigatório.' });
    }

    const userKey = (req.headers['x-gemini-key'] || req.headers['x-nvidia-key']) as string;
    
    // Configura o heartbeat anti-timeout para plataformas Serverless/Render:
    res.setHeader('Content-Type', 'application/json');
    res.write(' '); // Força o envio imediato dos headers para não dar timeout de Header

    const heartbeat = setInterval(() => {
      res.write(' '); // chunks de espaço não quebram o parser JSON.parse do cliente
    }, 15000);

    try {
      const effectiveConfig = { ...config, model: model || config?.model };
      const aiText = await executeGenerativeTask(contents, effectiveConfig, userKey, reqId);
      clearInterval(heartbeat);
      console.log(`[REQ ${reqId}] Sucesso na geração geral usando broker de IA. Tamanho: ${aiText.length} chars.`);
      res.write(JSON.stringify({ text: aiText }));
      res.end();
    } catch (error: any) {
      clearInterval(heartbeat);
      console.error(`[REQ ${reqId}] Erro retornado ao cliente: ${error.message}`);
      // Mandamos status 200 pro HTTP mas o JSON vai conter sucesso: false.
      // E a aplicação cliente em `src/App.tsx` vai falhar lindamente ali em response.ok = true mas err.success = false
      // Então vamos garantir que o json retorne o erro.
      res.write(JSON.stringify({ error: error.message || String(error) }));
      res.end();
    }
  } catch (error: any) {
    console.error(`[REQ ${reqId}] Erro Crítico POST /api/ai/generate: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message || String(error) });
    } else {
      res.write(JSON.stringify({ error: error.message || String(error) }));
      res.end();
    }
  }
});

// Endpoint para simulação e teste de webhooks empresariais com HMAC-SHA256
app.post("/api/tools/simulate-webhook", async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  try {
    const { targetUrl, payload, secret = "whsec_parvus_default", method = "POST", customHeaders = {} } = req.body;
    const bodyStr = typeof payload === "string" ? payload : JSON.stringify(payload || {});
    const signature = crypto.createHmac("sha256", secret).update(bodyStr).digest("hex");
    const timestamp = new Date().toISOString();
    
    console.log(`[REQ ${reqId}] Simulador de Webhook acionado: method=${method} url=${targetUrl || 'local_mock'}`);

    // Headers enviados
    const headersSent = {
      "Content-Type": "application/json",
      "X-Signature-SHA256": signature,
      "X-Timestamp": timestamp,
      "X-Delivery-Id": "dlv_" + crypto.randomUUID(),
      ...customHeaders
    };

    let dispatchResult: any = null;
    let latencyMs = 0;
    const start = Date.now();

    // Se houver uma URL externa real válida e configurada
    if (targetUrl && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) && !targetUrl.includes("localhost:3000")) {
      try {
        const hasBody = method !== "GET" && method !== "HEAD";
        const response = await fetch(targetUrl, {
          method,
          headers: headersSent,
          body: hasBody ? bodyStr : undefined
        });
        latencyMs = Date.now() - start;
        const text = await response.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = text; }
        dispatchResult = {
          dispatched: true,
          status: response.status,
          statusText: response.statusText,
          response: parsed
        };
      } catch (err: any) {
        latencyMs = Date.now() - start;
        dispatchResult = {
          dispatched: false,
          error: err.message
        };
      }
    } else {
      // Simulação local de alta fidelidade
      latencyMs = Math.floor(15 + Math.random() * 45);
      dispatchResult = {
        dispatched: true,
        simulation: true,
        status: 200,
        statusText: "OK",
        response: {
          success: true,
          message: "Webhook verificado e processado com sucesso pelo receptor!",
          audit: {
            signatureVerified: true,
            algorithm: "HMAC-SHA256",
            digest: signature,
            receivedAt: timestamp,
            event: payload?.event || "custom.event"
          }
        }
      };
    }

    res.json({
      success: true,
      signature,
      timestamp,
      latencyMs,
      headersSent,
      result: dispatchResult
    });
  } catch (error: any) {
    console.error(`[REQ ${reqId}] Erro ao simular webhook:`, error);
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.VERCEL) {
     return; // Vercel handles serving and listening
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
