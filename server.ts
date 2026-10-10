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
    if (!geminiKey) return false;
    const requestedModel = config?.model;
    const geminiModelsToTry = [
      (requestedModel && (requestedModel.includes('gemini-2') || requestedModel.includes('gemini-1.5'))) ? requestedModel : 'gemini-2.5-flash',
      'gemini-2.0-flash'
    ];
    const uniqueGeminiModels = Array.from(new Set(geminiModelsToTry));

    for (const geminiModel of uniqueGeminiModels) {
      try {
        console.log(`[REQ ${reqId}] Tentativa com Google Gemini (${geminiModel})...`);
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        
        const genConfig: any = {
          temperature: config?.temperature !== undefined ? config.temperature : 0.2,
          maxOutputTokens: config?.maxOutputTokens || 8192,
        };
        
        if (config?.responseMimeType === 'application/json' || config?.responseSchema) {
          genConfig.responseMimeType = 'application/json';
          if (config?.responseSchema) {
            genConfig.responseSchema = config?.responseSchema;
          }
        }

        const callPromise = ai.models.generateContent({
          model: geminiModel,
          contents: prompt,
          config: genConfig
        });

        // Timeout gradual de 35s por modelo Gemini
        const response: any = await withTimeout(callPromise, 35000, `Gemini (${geminiModel})`);
        if (response?.text) return response.text;
      } catch (err: any) {
        console.warn(`[REQ ${reqId}] Falha/Timeout no Gemini (${geminiModel}): ${err.message}.`);
        errors.push(`Gemini (${geminiModel}): ${err.message}`);
      }
    }
    return false;
  };

  const runNvidia = async () => {
    if (!nvidiaKey || nvidiaKey.startsWith("AIzaSy")) {
      errors.push("Chave NVIDIA inválida ou ausente.");
      return false;
    }
    // Catálogo oficial e de alto desempenho NVIDIA NIM
    const nvidiaModelsToTry = [
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.3-70b-instruct",
      "nvidia/nemotron-4-340b-instruct",
      "deepseek-ai/deepseek-v3",
      "z-ai/glm-5.1"
    ];
    
    const isJson = config?.responseMimeType === 'application/json' || Boolean(config?.responseSchema);

    for (const nvidiaModel of nvidiaModelsToTry) {
      const openai = new OpenAI({ 
        apiKey: nvidiaKey, 
        baseURL: "https://integrate.api.nvidia.com/v1",
        timeout: 40000 
      });
      
      let messages: any[] = [{ role: "user", content: prompt }];
      if (isJson) {
        let systemPrompt = "You must output strictly JSON format only. Do not output any markdown code blocks, explanation or introductory text.";
        if (config?.responseSchema) {
          const schemaStr = JSON.stringify(config.responseSchema).replace(/"type":"([A-Z]+)"/g, (_, p1) => `"type":"${p1.toLowerCase()}"`);
          systemPrompt += ` The JSON must strictly conform to this schema: ${schemaStr}`;
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
            max_tokens: config?.max_tokens || 12288,
          };
          
          if (withResponseFormat) {
            openAiConfig.response_format = { type: "json_object" };
          }
    
          const callPromise = openai.chat.completions.create(openAiConfig);
          const response = await withTimeout(callPromise, 40000, `NVIDIA (${nvidiaModel})`);
          const content = response.choices[0].message?.content;
          if (content) return content;
        } catch (err: any) {
          const errMsg = err.message || String(err);
          console.warn(`[REQ ${reqId}] Falha/Timeout no NVIDIA (${nvidiaModel}, response_format=${withResponseFormat}): ${errMsg}`);
          if (withResponseFormat && (errMsg.includes('response_format') || errMsg.includes('400') || errMsg.includes('json_object') || errMsg.includes('unrecognized') || errMsg.includes('not supported'))) {
            continue;
          }
          errors.push(`NVIDIA (${nvidiaModel}): ${errMsg}`);
          break;
        }
      }
    }
    return false;
  };

  // ORDEM DE EXECUÇÃO:
  // Se o usuário enviou chave NVIDIA, ou se o ambiente possui NVIDIA_API_KEY (e não for explicitamente AI_PROVIDER=gemini),
  // priorizamos NVIDIA como o motor de IA principal. Caso contrário, Gemini é o primário com fallback rápido na NVIDIA.
  const preferNvidia = isUserNvidiaKey || (Boolean(nvidiaKey) && (!geminiKey || process.env.AI_PROVIDER === 'nvidia' || !isUserGeminiKey));

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

app.post("/api/ai/generate-iot", async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[REQ ${reqId}] POST /api/ai/generate-iot - Recebendo pedido para placa: ${req.body?.placa}`);
  
  try {
    const { prompt, placa } = req.body;
    const userKey = (req.headers['x-gemini-key'] || req.headers['x-nvidia-key']) as string;
    
    // Deixamos o motor responder dinamicamente de acordo com o esquema solicitado no prompt do IotMonitor.tsx
    const config = {
      responseMimeType: 'application/json'
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
