import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(cors({
  origin: '*', // Permite todas as origens (ou você pode especificar 'https://parvusautomateai.vercel.app' para mais segurança)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-key']
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

app.post("/api/ai/generate-iot", async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[REQ ${reqId}] POST /api/ai/generate-iot - Recebendo pedido para placa: ${req.body?.placa}`);
  
  try {
    const { prompt, placa } = req.body;
    const userKey = req.headers['x-gemini-key'] as string;
    const isUserKeyNvidia = userKey && userKey.startsWith('nvapi-');
    const isUserKeyGemini = userKey && !isUserKeyNvidia;
    
    let aiText = "";
    let errorLog: string[] = [];
    let providerUsed = "";

    try {
      console.log(`[REQ ${reqId}] Tentando API Gemini...`);
      const geminiKey = getCleanApiKey(isUserKeyGemini ? userKey : undefined, 'GEMINI_API_KEY');
      if (!geminiKey) throw new Error("Sem chave Gemini");
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });
      aiText = geminiResponse.text || "{}";
      providerUsed = "Gemini";
    } catch (geminiError: any) {
      errorLog.push("Gemini: " + geminiError.message);
      console.log(`[REQ ${reqId}] Fallback para Nvidia - Falha na Gemini: ${geminiError.message}`);
      try {
        const nvidiaKey = getCleanApiKey(isUserKeyNvidia ? userKey : undefined, 'NVIDIA_API_KEY');
        if (!nvidiaKey) throw new Error("Sem chave Nvidia");
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" });
        
        const response = await openai.chat.completions.create({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          response_format: { type: "json_object" }
        });

        aiText = response.choices[0].message?.content || "{}";
        providerUsed = "Nvidia (Llama 3.1)";
      } catch (nvidiaError: any) {
         errorLog.push("Nvidia: " + nvidiaError.message);
         console.error(`[REQ ${reqId}] Falha crítica em todas as APIs. Logs: ${errorLog.join(' | ')}`);
         throw new Error(`Falha em ambas as APIs: ${errorLog.join(' | ')}`);
      }
    }

    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    console.log(`[REQ ${reqId}] Sucesso na geração IoT usando: ${providerUsed}. Tamanho do payload: ${aiText.length} chars.`);
    res.json(JSON.parse(aiText));
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
    const userKey = req.headers['x-gemini-key'] as string;
    const isUserKeyNvidia = userKey && userKey.startsWith('nvapi-');
    const isUserKeyGemini = userKey && !isUserKeyNvidia;
    
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

    let aiText = "";
    let errorLog: string[] = [];
    let providerUsed = "";

    try {
      console.log(`[REQ ${reqId}] Tentando API Gemini...`);
      const geminiKey = getCleanApiKey(isUserKeyGemini ? userKey : undefined, 'GEMINI_API_KEY');
      if (!geminiKey) throw new Error("Sem chave Gemini");
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          temperature: 0.4
        }
      });
      aiText = geminiResponse.text || "";
      providerUsed = "Gemini";
    } catch (geminiError: any) {
      errorLog.push("Gemini: " + geminiError.message);
      console.log(`[REQ ${reqId}] Fallback para Nvidia - Falha na Gemini: ${geminiError.message}`);
      try {
        const nvidiaKey = getCleanApiKey(isUserKeyNvidia ? userKey : undefined, 'NVIDIA_API_KEY');
        if (!nvidiaKey) throw new Error("Sem chave Nvidia");
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" });
        
        const response = await openai.chat.completions.create({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4
        });
        aiText = response.choices[0].message?.content || "";
        providerUsed = "Nvidia (Llama 3.1)";
      } catch (nvidiaError: any) {
        errorLog.push("Nvidia: " + nvidiaError.message);
        console.error(`[REQ ${reqId}] Falha crítica em todas as APIs. Logs: ${errorLog.join(' | ')}`);
        throw new Error(`Falha em ambas as APIs: ${errorLog.join(' | ')}`);
      }
    }

    console.log(`[REQ ${reqId}] Sucesso na simulação IoT usando: ${providerUsed}. Tamanho do payload: ${aiText.length} chars.`);
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

    const userKey = req.headers['x-gemini-key'] as string;
    const isUserKeyNvidia = userKey && userKey.startsWith('nvapi-');
    const isUserKeyGemini = userKey && !isUserKeyNvidia;
    
    let aiText = "";
    let errorLog: string[] = [];
    let providerUsed = "";
    
    try {
      console.log(`[REQ ${reqId}] Tentando API Gemini...`);
      const geminiKey = getCleanApiKey(isUserKeyGemini ? userKey : undefined, 'GEMINI_API_KEY');
      if (!geminiKey) throw new Error("Sem chave Gemini");
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const geminiResponse = await ai.models.generateContent({
        model: model === 'gemini-2.5-flash' ? 'gemini-2.0-flash' : (model || 'gemini-2.0-flash'),
        contents: contents,
        config: {
          temperature: config?.temperature,
          responseMimeType: config?.responseMimeType,
          responseSchema: config?.responseSchema
        }
      });
      aiText = geminiResponse.text || "";
      providerUsed = "Gemini";
    } catch (geminiError: any) {
      errorLog.push("Gemini: " + geminiError.message);
      console.log(`[REQ ${reqId}] Fallback para Nvidia - Falha na Gemini: ${geminiError.message}`);
      try {
        const nvidiaKey = getCleanApiKey(isUserKeyNvidia ? userKey : undefined, 'NVIDIA_API_KEY');
        if (!nvidiaKey) throw new Error("Sem chave Nvidia");
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" });
        
        let openAiConfig: any = {
          model: 'meta/llama-3.1-70b-instruct',
          messages: [{ role: "user", content: contents }]
        };

        if (config?.temperature !== undefined) openAiConfig.temperature = config.temperature;
        
        if (config?.responseMimeType === 'application/json' || config?.responseSchema) {
          openAiConfig.response_format = { type: "json_object" };
          let systemPrompt = "You must output JSON format only.";
          if (config?.responseSchema) {
            systemPrompt += ` The JSON must strictly adhere to this schema: ${JSON.stringify(config.responseSchema)}`;
          }
          openAiConfig.messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: contents }
          ];
        }

        const response = await openai.chat.completions.create(openAiConfig);
        aiText = response.choices[0].message?.content || "";
        providerUsed = "Nvidia (Llama 3.1)";
      } catch (nvidiaError: any) {
        errorLog.push("Nvidia: " + nvidiaError.message);
        console.error(`[REQ ${reqId}] Falha crítica em todas as APIs. Logs: ${errorLog.join(' | ')}`);
        throw new Error(`Falha em ambas as APIs: ${errorLog.join(' | ')}`);
      }
    }

    console.log(`[REQ ${reqId}] Sucesso na geração geral usando: ${providerUsed}. Tamanho do payload: ${aiText.length} chars.`);
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
