import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";
import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";
import { jsonrepair } from "jsonrepair";

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

// Unified robust runner that tries the user preferred key/model, automatically falling back dynamically
async function executeGenerativeTask(prompt: string, config: any, userKey?: string, reqId?: string): Promise<string> {
  const isUserGeminiKey = userKey && (userKey.startsWith("AIzaSy") || userKey.startsWith("aizasy") || userKey.includes("AIzaSy"));
  const isUserNvidiaKey = userKey && !isUserGeminiKey;
  
  // Extrai as chaves de forma inteligente
  const geminiKey = isUserGeminiKey ? userKey : (process.env.GEMINI_API_KEY || getCleanApiKey(undefined, 'GEMINI_API_KEY'));
  const nvidiaKey = isUserNvidiaKey ? userKey : (process.env.NVIDIA_API_KEY || getCleanApiKey(undefined, 'NVIDIA_API_KEY'));

  const errors: string[] = [];

  // FUNÇÕES DE EXECUÇÃO
  const runGemini = async () => {
    if (!geminiKey) return false;
    try {
      console.log(`[REQ ${reqId}] Tentativa com Google Gemini (gemini-3.6-flash)...`);
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const genConfig: any = {
        temperature: config?.temperature !== undefined ? config.temperature : 0.2,
      };
      
      if (config?.responseMimeType === 'application/json' || config?.responseSchema) {
        genConfig.responseMimeType = 'application/json';
        if (config?.responseSchema) {
          genConfig.responseSchema = config?.responseSchema;
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: genConfig
      });
      return response.text || "";
    } catch (err: any) {
      console.error(`[REQ ${reqId}] Falha no Gemini: ${err.message}. ${nvidiaKey ? 'Alternando provider...' : ''}`);
      errors.push(`Gemini: ${err.message}`);
      return false;
    }
  };

  const runNvidia = async () => {
    if (!nvidiaKey || nvidiaKey.startsWith("AIzaSy")) {
      errors.push("Chave NVIDIA inválida ou ausente.");
      return false;
    }
    const nvidiaModelsToTry = ["glm-5.2", "deepseek-ai/deepseek-v4-pro", "nvidia/nemotron-3-ultra-550b-a55b"];
    
    for (const nvidiaModel of nvidiaModelsToTry) {
      try {
        console.log(`[REQ ${reqId}] Tentativa com NVIDIA (${nvidiaModel})...`);
        const openai = new OpenAI({ apiKey: nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" });
        
        let openAiConfig: any = {
          model: nvidiaModel,
          messages: [{ role: "user", content: prompt }],
          temperature: config?.temperature !== undefined ? config.temperature : 0.2,
          top_p: 1,
          max_tokens: 8192,
        };
        
        if (config?.responseMimeType === 'application/json' || config?.responseSchema) {
          openAiConfig.response_format = { type: "json_object" };
          let systemPrompt = "You must output strictly JSON format only. Do not output anything else.";
          if (config?.responseSchema) {
            const schemaStr = JSON.stringify(config.responseSchema).replace(/"type":"([A-Z]+)"/g, (match, p1) => `"type":"${p1.toLowerCase()}"`);
            systemPrompt += ` The JSON must exactly match this schema and populate all required fields: ${schemaStr}`;
          }
          openAiConfig.messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ];
        }
  
        const response = await openai.chat.completions.create(openAiConfig);
        return response.choices[0].message?.content || "";
      } catch (err: any) {
        console.warn(`[REQ ${reqId}] Falha no NVIDIA (${nvidiaModel}): ${err.message}. Tentando próximo modelo NVIDIA...`);
        errors.push(`NVIDIA (${nvidiaModel}): ${err.message}`);
      }
    }
    return false;
  };

  // ORDEM DE EXECUÇÃO: Prioriza o que o usuário colocou na dashboard.
  if (isUserNvidiaKey) {
    const res = await runNvidia();
    if (res !== false) return res;
    // Fallback: Gemini
    const fallbackRes = await runGemini();
    if (fallbackRes !== false) return fallbackRes;
  } else {
    // Default/Gemini Priority
    const res = await runGemini();
    if (res !== false) return res;
    // Fallback: Nvidia
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
      let cleanedText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      console.log(`[REQ ${reqId}] Sucesso na geração IoT usando broker unificado. Tamanho: ${cleanedText.length}`);
      
      let parsedJson;
      try {
        parsedJson = JSON.parse(cleanedText);
      } catch (parseErr) {
        console.warn(`[REQ ${reqId}] Erro ao realizar parse do JSON. Tentando recuperar JSON truncado...`);
        try {
          const repairedJson = jsonrepair(cleanedText);
          parsedJson = JSON.parse(repairedJson);
          console.log(`[REQ ${reqId}] JSON truncado recuperado com sucesso via jsonrepair!`);
        } catch (repairErr: any) {
          throw new Error(`Falha ao converter e reparar resposta JSON da IA: ${parseErr} / Repair Error: ${repairErr.message}`);
        }
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
      const aiText = await executeGenerativeTask(contents, config, userKey, reqId);
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
