import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

app.use(express.json());

// --- GENERIC SECURITY SERVER-SIDE GEMINI API PROXY ---
function getCleanApiKey(userKey: string | undefined): string | undefined {
  let apiKey = userKey || process.env.GEMINI_API_KEY;
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
    
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    let aiText = response.text || "{}";
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

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.4
      }
    });

    res.json({ output: response.text });
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

    const { GoogleGenAI } = await import('@google/genai');
    
    // Check if user has their own custom key in headers (with placeholder clean up)
    const apiKey = getCleanApiKey(req.headers['x-gemini-key'] as string);
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chave de API do Gemini (GEMINI_API_KEY) não configurada no servidor e nenhuma fornecida nas configurações.' 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    // Use gemini-2.5-flash by default if model is not set/invalid or of deprecated versions
    let selectedModel = model || 'gemini-2.5-flash';
    if (
      selectedModel.includes('gemini-1.5') || 
      selectedModel.includes('gemini-2.0') || 
      selectedModel.includes('gemini-3.5') ||
      selectedModel.includes('gemini-3.1') ||
      selectedModel === 'gemini-pro'
    ) {
      // Direct models to gemini-2.5-flash or gemini-2.5-pro to prevent quota depletion
      selectedModel = model?.includes('pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config
    });

    res.json({
      text: response.text,
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
