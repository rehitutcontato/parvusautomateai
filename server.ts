import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- GENERIC SECURITY SERVER-SIDE AI API PROXY ---
function getCleanApiKey(userKey: string | undefined): string | undefined {
  let apiKey = userKey || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return undefined;
  apiKey = apiKey.toString().trim().replace(/['"]/g, '').replace('Bearer ', '');
  if (apiKey === 'SUA_CHAVE_AQUI' || apiKey === 'YOUR_API_KEY_HERE') return undefined;
  return apiKey;
}

app.post("/api/ai/generate-iot", async (req, res) => {
  try {
    const { prompt, placa } = req.body;
    const apiKey = getCleanApiKey(req.headers['x-gemini-key'] as string);
    if (!apiKey) return res.status(400).json({ success: false, error: 'Chave API não configurada' });
    
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey, baseURL: "https://integrate.api.nvidia.com/v1" });
    
    const response = await openai.chat.completions.create({
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    let aiText = response.choices[0].message?.content || "{}";
    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    res.json(JSON.parse(aiText));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/ai/simulate-iot", async (req, res) => {
  try {
    const { codigo, linguagem, placa } = req.body;
    const apiKey = getCleanApiKey(req.headers['x-gemini-key'] as string);
    if (!apiKey) return res.status(400).json({ success: false, error: 'Chave API não configurada' });
    
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

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey, baseURL: "https://integrate.api.nvidia.com/v1" });
    
    const response = await openai.chat.completions.create({
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    res.json({ output: response.choices[0].message?.content });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/ai/generate", async (req, res) => {
  try {
    const { model, contents, config } = req.body;
    if (!contents) {
      return res.status(400).json({ success: false, error: 'O prompt ou conteúdo é obrigatório.' });
    }

    const apiKey = getCleanApiKey(req.headers['x-gemini-key'] as string);
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chave de API não configurada no servidor e nenhuma fornecida nas configurações.' 
      });
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey, baseURL: "https://integrate.api.nvidia.com/v1" });
    
    // Convert gemini config schema to openai
    let openAiConfig: any = {
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      messages: [{ role: "user", content: contents }]
    };

    if (config?.temperature !== undefined) openAiConfig.temperature = config.temperature;
    
    // Check if JSON format is requested
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

    res.json({
      text: response.choices[0].message?.content,
    });
  } catch (error: any) {
    console.error("Erro na chamada de IA no servidor:", error);
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// Vite middleware for development
async function startServer() {
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
