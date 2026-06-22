import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";
import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";

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
      console.log(`[REQ ${reqId}] Tentativa com Google Gemini (gemini-2.0-flash)...`);
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
        model: 'gemini-2.0-flash',
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
    if (!nvidiaKey || nvidiaKey.startsWith("AIzaSy")) return false;
    try {
      console.log(`[REQ ${reqId}] Tentativa com NVIDIA Llama (meta/llama-3.1-70b-instruct)...`);
      const openai = new OpenAI({ apiKey: nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" });
      
      let openAiConfig: any = {
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: config?.temperature !== undefined ? config.temperature : 1.0,
        top_p: 1,
        max_tokens: 4096,
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
      console.warn(`[REQ ${reqId}] Falha no NVIDIA: ${err.message}.`);
      errors.push(`NVIDIA: ${err.message}`);
      return false;
    }
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

    const aiText = await executeGenerativeTask(prompt, config, userKey, reqId);
    let cleanedText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    console.log(`[REQ ${reqId}] Sucesso na geração IoT usando broker unificado. Tamanho: ${cleanedText.length}`);
    res.json(JSON.parse(cleanedText));
  } catch (error: any) {
    console.error(`[REQ ${reqId}] Erro 500 retornado ao cliente: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/ai/simulate-iot", async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[REQ ${reqId}] POST /api/ai/simulate-iot - Recebendo pedido de simulação para placa: ${req.body?.placa}`);
  
  try {
    const { codigo, linguagem, placa } = req.body;
    const userKey = (req.headers['x-gemini-key'] || req.headers['x-nvidia-key']) as string;
    
    const prompt = `Você é um emulador de ${placa}. Execute este código de ${linguagem} e simule o output do Serial Monitor/console por 10 ciclos de execução.

CÓDIGO:
${codigo}

REGRAS:
- Simule outputs realistas com timestamps
- Se o código tem sensor, simule leituras variadas e realistas
- Se o código tem atuadores, simule as respostas
- Use formato de Serial Monitor real do Arduino (se C++) ou print() real (se Python)
- Dure exatamente 10 ciclos/iterações e pare
- Se houver bug óbvio no código, aponte no output

Retorne APENAS o texto do terminal, linha por linha. Sem JSON. Sem explicação.`;

    const aiText = await executeGenerativeTask(prompt, { temperature: 0.4 }, userKey, reqId);

    console.log(`[REQ ${reqId}] Sucesso na simulação IoT usando broker unificado. Tamanho do payload: ${aiText.length} chars.`);
    res.json({ output: aiText });
  } catch (error: any) {
    console.error(`[REQ ${reqId}] Erro 500 retornado ao cliente: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
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
    
    const aiText = await executeGenerativeTask(contents, config, userKey, reqId);

    console.log(`[REQ ${reqId}] Sucesso na geração geral usando broker de IA. Tamanho: ${aiText.length} chars.`);
    res.json({
      text: aiText,
    });
  } catch (error: any) {
    console.error(`[REQ ${reqId}] Erro 500 retornado ao cliente: ${error.message}`);
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
