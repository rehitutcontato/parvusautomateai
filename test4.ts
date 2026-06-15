import { OpenAI } from 'openai';

async function test() {
  const openai = new OpenAI({ 
    apiKey: "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", 
    baseURL: "https://integrate.api.nvidia.com/v1" 
  });
  
  try {
    const response = await openai.chat.completions.create({
      model: 'invalid-model',
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.2
    });
  } catch (e: any) {
    console.error("Message:", e.message);
    if (e.response && e.response.status) {
      console.error(e.response.status);
    }
  }
}

test();
