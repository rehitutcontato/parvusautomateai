import { jsonrepair } from 'jsonrepair';

/**
 * Utilitário ultra-defensivo para extrair e reparar JSON retornado por LLMs
 * (Gemini 2.0/2.5 Flash, NVIDIA NIM, Llama, DeepSeek, Nemotron).
 * 
 * Tolera blocos markdown, preâmbulos de texto, comentários, aspas não finalizadas,
 * chaves/colchetes truncados e caracteres de controle especiais.
 */
export function extractJsonString(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '{}';

  let cleaned = rawText.trim();

  // 0. Remover blocos de raciocínio de modelos como DeepSeek R1 (<think>...</think>)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '').trim();

  // 1. Remover blocos markdown de código
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*/i, '');
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/\s*```$/, '');
    }
  }

  // Se houver blocos de código internos (fechados ou não finalizados), extrair o bloco
  const closedBlockRegex = /```(?:json|javascript|js|ts|typescript)?\s*([\s\S]*?)```/i;
  const closedMatch = rawText.match(closedBlockRegex);
  if (closedMatch && closedMatch[1]) {
    const candidate = closedMatch[1].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      cleaned = candidate;
    }
  } else {
    // Truncado sem fechamento ```
    const unclosedBlockRegex = /```(?:json|javascript|js|ts|typescript)?\s*([\s\S]*)$/i;
    const unclosedMatch = rawText.match(unclosedBlockRegex);
    if (unclosedMatch && unclosedMatch[1]) {
      const candidate = unclosedMatch[1].trim();
      if (candidate.startsWith('{') || candidate.startsWith('[')) {
        cleaned = candidate;
      }
    }
  }

  // 2. Localizar o primeiro '{' ou '[' e o último '}' ou ']'
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }

  if (startIdx !== -1) {
    if (endIdx !== -1 && endIdx >= startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    } else {
      // String truncada pelo limite de tokens: extrai do início até o final e deixa o jsonrepair fechar
      cleaned = cleaned.substring(startIdx);
    }
  }

  return cleaned.trim();
}

/**
 * Conta aspas duplas desescapadas sem usar regex lookbehind
 * (evita SyntaxError e pattern mismatch em motores WebKit/Safari legados)
 */
function countUnescapedQuotes(str: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '"') {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && str[j] === '\\') {
        backslashes++;
        j--;
      }
      if (backslashes % 2 === 0) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Executa parse com reparo automático multicamadas
 */
export function safeJsonParseWithRepair<T = any>(rawInput: string, fallbackValue?: T): T {
  if (!rawInput) {
    if (fallbackValue !== undefined) return fallbackValue;
    throw new Error('Conteúdo vazio recebido para parse JSON.');
  }

  const extracted = extractJsonString(rawInput);

  // Tentativa 1: Parse direto do JSON extraído
  try {
    return JSON.parse(extracted) as T;
  } catch (firstErr) {
    // Continua para reparo defensivo
  }

  // Tentativa 2: Uso da biblioteca jsonrepair
  try {
    const repaired = jsonrepair(extracted);
    return JSON.parse(repaired) as T;
  } catch (repairErr) {
    // Continua para heurística adaptativa
  }

  // Tentativa 3: Heurística adaptativa para fechar strings e chaves cortadas
  try {
    let sanitized = extracted;
    // Fechar aspa aberta na última linha se estiver desbalanceada (sem lookbehind)
    const quoteCount = countUnescapedQuotes(sanitized);
    if (quoteCount % 2 !== 0) {
      sanitized += '"';
    }

    // Contar chaves e colchetes abertos e fechados
    let openBraces = (sanitized.match(/\{/g) || []).length;
    let closeBraces = (sanitized.match(/\}/g) || []).length;
    let openBrackets = (sanitized.match(/\[/g) || []).length;
    let closeBrackets = (sanitized.match(/\]/g) || []).length;

    while (closeBrackets < openBrackets) {
      sanitized += ']';
      closeBrackets++;
    }
    while (closeBraces < openBraces) {
      sanitized += '}';
      closeBraces++;
    }

    const repairedWithHeuristic = jsonrepair(sanitized);
    return JSON.parse(repairedWithHeuristic) as T;
  } catch (heuristicErr) {
    // Se ainda falhar e houver fallback configurado, retorne fallback
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw new Error(
      `Falha na decodificação do payload de IA: a estrutura retornada não pôde ser reparada automaticamente. Detalhes: ${String(heuristicErr)}`
    );
  }
}
