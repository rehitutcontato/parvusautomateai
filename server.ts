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
  const geminiKey = getCleanApiKey(userKey, 'GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  const nvidiaKey = getCleanApiKey(userKey, 'NVIDIA_API_KEY');

  const isUserGeminiKey = userKey && (userKey.startsWith("AIzaSy") || userKey.startsWith("aizasy") || userKey.includes("AIzaSy"));

  // 1. If key belongs to Gemini or Gemini is configured natively and NVIDIA isn't, use Gemini primary
  if (isUserGeminiKey || (geminiKey && !nvidiaKey)) {
    console.log(`[REQ ${reqId}] Direcionando requisição diretamente para o Gemini API pela excelente performance e latência reduzida...`);
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const responseSchema = config?.responseSchema;
      const model = 'gemini-3.5-flash';
      
      const genConfig: any = {
        temperature: config?.temperature !== undefined ? config.temperature : 0.2,
      };
      
      if (config?.responseMimeType === 'application/json' || responseSchema) {
        genConfig.responseMimeType = 'application/json';
        if (responseSchema) {
          genConfig.responseSchema = responseSchema;
        }
      }

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: genConfig
      });

      return response.text || "";
    } catch (err: any) {
      console.error(`[REQ ${reqId}] Chamada direta ao Gemini falhou: ${err.message}. Tentando fallback/NVIDIA...`);
    }
  }

  // 2. Try NVIDIA GLM 5.1 (unless it's a Gemini key)
  if (nvidiaKey && !nvidiaKey.startsWith("AIzaSy")) {
    try {
      console.log(`[REQ ${reqId}] Processando com API NVIDIA (z-ai/glm-5.1)...`);
      const openai = new OpenAI({ apiKey: nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" });
      
      let openAiConfig: any = {
        model: "z-ai/glm-5.1",
        messages: [{ role: "user", content: prompt }],
        temperature: config?.temperature !== undefined ? config.temperature : 1.0,
        top_p: 1,
        max_tokens: 16384,
        chat_template_kwargs: { "enable_thinking": true, "clear_thinking": false }
      };
      
      if (config?.responseMimeType === 'application/json' || config?.responseSchema) {
        openAiConfig.response_format = { type: "json_object" };
        let systemPrompt = "You must output JSON format only.";
        if (config?.responseSchema) {
          systemPrompt += ` The JSON must strictly adhere to this schema: ${JSON.stringify(config.responseSchema)}`;
        }
        openAiConfig.messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ];
      }

      const response = await openai.chat.completions.create(openAiConfig);
      return response.choices[0].message?.content || "";
    } catch (err: any) {
      console.warn(`[REQ ${reqId}] Chamada NVIDIA falhou ou excedeu o limite de tempo: ${err.message}. Entrando em modo de contingência direta com o Gemini.`);
    }
  }

  // 3. Fallback/Contingency mechanism using server-side Gemini key
  if (geminiKey) {
    console.log(`[REQ ${reqId}] Ativando Fallback de contingência para o Gemini (gemini-3.5-flash)...`);
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const responseSchema = config?.responseSchema;
      const model = 'gemini-3.5-flash';
      
      const genConfig: any = {
        temperature: config?.temperature !== undefined ? config.temperature : 0.2,
      };
      
      if (config?.responseMimeType === 'application/json' || responseSchema) {
        genConfig.responseMimeType = 'application/json';
        if (responseSchema) {
          genConfig.responseSchema = responseSchema;
        }
      }

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: genConfig
      });

      return response.text || "";
    } catch (geminiErr: any) {
      console.error(`[REQ ${reqId}] Falha crítica em todos os provedores: ${geminiErr.message}`);
      throw geminiErr;
    }
  }

  throw new Error("Nenhum provedor de IA (NVIDIA ou Gemini) com chave válida foi localizado para esta transação.");
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
