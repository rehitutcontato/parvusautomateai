import { OpenAI } from 'openai';

async function test() {
  const openai = new OpenAI({ 
    apiKey: "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", 
    baseURL: "https://integrate.api.nvidia.com/v1" 
  });
  
  try {
    console.log("Fetching...");
    const response = await openai.chat.completions.create({
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      messages: [{ role: "system", content: "You must output JSON format only." }, { role: "user", content: "hello" }],
      response_format: { type: "json_object" },
      temperature: 0.2
    });
    console.log("Success!");
    console.log(response.choices[0].message);
  } catch (e: any) {
    console.error("Error!!");
    console.error(e.message);
    if (e.response && e.response.status) {
      console.error(e.response.status);
    }
  }
}

test();
