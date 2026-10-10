/**
 * AI Broker Helper - Resilient Multi-Provider Orchestration
 * Normalizes model catalogs, routes deprecated/EOL slugs, handles fast-abort
 * on account permission errors and structures schemas for Google GenAI & NVIDIA NIM.
 * 
 * FOCUS: NVIDIA NIM is the primary enterprise provider by default,
 * with Google Gemini functioning as defensive contingency fallback.
 */

export const DEFAULT_PRIMARY_PROVIDER: 'nvidia' | 'gemini' = 'nvidia';
export const DEFAULT_NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const NVIDIA_RETIRED_MODELS_MAP: Record<string, string> = {
  'meta/llama-3.1-70b-instruct': 'meta/llama-3.3-70b-instruct',
  'nvidia/nemotron-4-340b-instruct': 'nvidia/llama-3.1-nemotron-70b-instruct',
  'nvidia/nemotron-3-super-120b-a12b': 'nvidia/llama-3.1-nemotron-70b-instruct',
  'deepseek-ai/deepseek-v3': 'deepseek-ai/deepseek-r1',
  'z-ai/glm-5.1': 'meta/llama-3.3-70b-instruct',
  'z-ai/glm-5': 'meta/llama-3.3-70b-instruct',
  'meta/llama-3-70b-instruct': 'meta/llama-3.3-70b-instruct',
  'meta/llama-3-8b-instruct': 'meta/llama-3.1-8b-instruct',
};

export const ACTIVE_NVIDIA_MODELS: string[] = [
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'deepseek-ai/deepseek-r1',
  'meta/llama-3.1-8b-instruct',
  'mistralai/mistral-large-2-instruct',
];

export const ACTIVE_GEMINI_MODELS: string[] = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
];

/**
 * Checks if a Gemini model string is deprecated or obsolete (e.g. 2.0 or 1.x series)
 */
export function isDeprecatedGeminiModel(model?: string): boolean {
  if (!model) return false;
  const clean = model.replace(/^models\//, '').trim();
  return (
    clean.startsWith('gemini-2.0') ||
    clean.startsWith('gemini-1.') ||
    clean === 'gemini-pro' ||
    clean === 'gemini-1.0'
  );
}

/**
 * Normalizes the fallback chain for Google Gemini.
 * Maps deprecated models (gemini-2.0-flash, gemini-1.5, etc.) to gemini-3.8-flash.
 * Also handles cases where an NVIDIA model slug was requested but Gemini fallback is triggered.
 * Avoids starting with gemini-2.5-flash to prevent 50s timeouts during dense generation.
 */
export function normalizeGeminiModelChain(requestedModel?: string): string[] {
  let cleanRequested = requestedModel ? requestedModel.replace(/^models\//, '').trim() : undefined;

  // Se o modelo requisitado for obsoleto, o legado 2.5, ou não for slug do Gemini, promove para 3.8 Flash
  if (
    !cleanRequested ||
    isDeprecatedGeminiModel(cleanRequested) ||
    cleanRequested === 'gemini-2.5-flash' ||
    !cleanRequested.startsWith('gemini-')
  ) {
    cleanRequested = 'gemini-3.8-flash';
  }

  const rawList = [
    cleanRequested,
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash'
  ];

  const filtered = rawList.filter((m): m is string => Boolean(m) && !isDeprecatedGeminiModel(m) && m.startsWith('gemini-'));
  return Array.from(new Set(filtered));
}

/**
 * Maps a potentially retired NVIDIA model slug to an active replacement.
 */
export function mapRetiredNvidiaModel(model?: string): string | undefined {
  if (!model) return undefined;
  const clean = model.trim();
  return NVIDIA_RETIRED_MODELS_MAP[clean] || clean;
}

/**
 * Builds the active candidate list for NVIDIA NIM inference.
 */
export function normalizeNvidiaModelChain(requestedModel?: string): string[] {
  let initial = requestedModel ? mapRetiredNvidiaModel(requestedModel) : undefined;
  const isNvidiaSlug = initial && (initial.includes('/') || initial.startsWith('meta/') || initial.startsWith('nvidia/'));

  const candidates = [
    isNvidiaSlug ? initial : undefined,
    ...ACTIVE_NVIDIA_MODELS
  ].filter((m): m is string => Boolean(m));

  return Array.from(new Set(candidates));
}

/**
 * Identifies if an error from NVIDIA NIM indicates account-level or scope permission failure
 * (e.g. HTTP 410 "Public API Endpoints not enabled", 401 Unauthorized, 403 Forbidden).
 * Allows instant abort to trigger Gemini fallback without wasting retry timeouts.
 */
export function shouldFastAbortNvidia(errMsg: string): boolean {
  if (!errMsg) return false;
  return (
    errMsg.includes('410') ||
    errMsg.includes('401') ||
    errMsg.includes('403') ||
    errMsg.includes('Unauthorized') ||
    errMsg.includes('Forbidden') ||
    errMsg.includes('Authorization') ||
    errMsg.includes('Public API Endpoints')
  );
}

/**
 * Resolves priority between NVIDIA NIM and Google Gemini.
 * NVIDIA NIM is the PRIMARY provider by default across all generations and IoT synthesis,
 * with Google Gemini functioning as secondary fallback contingency.
 */
export function resolveAiProviderPriority(params: {
  isUserNvidiaKey: boolean;
  isUserGeminiKey: boolean;
  nvidiaKey?: string;
  geminiKey?: string;
  envProvider?: string;
}): 'nvidia' | 'gemini' {
  // 1. Sobrescrita explícita via variável de ambiente AI_PROVIDER
  if (params.envProvider === 'gemini') {
    return 'gemini';
  }
  if (params.envProvider === 'nvidia') {
    return 'nvidia';
  }

  // 2. Chave explícita NVIDIA do usuário sempre prioriza NVIDIA
  if (params.isUserNvidiaKey) {
    return 'nvidia';
  }

  // 3. Usuário forneceu explicitamente chave Gemini e nenhuma chave NVIDIA existe (nem de usuário nem no servidor)
  if (params.isUserGeminiKey && !params.nvidiaKey && !params.isUserNvidiaKey) {
    return 'gemini';
  }

  // 4. Se a chave NVIDIA estiver ausente mas a chave Gemini existir, cai no Gemini
  if (!params.nvidiaKey && !params.isUserNvidiaKey && (params.geminiKey || params.isUserGeminiKey)) {
    return 'gemini';
  }

  // 5. PADRÃO DO SISTEMA: NVIDIA NIM é o provedor PRIMÁRIO
  return 'nvidia';
}

/**
 * Utilitário para resolver credenciais de forma resiliente em ambientes Node / Express
 */
export function resolveServerApiKeys(
  headers: Record<string, any> = {},
  body: Record<string, any> = {},
  env: Record<string, any> = process.env
): {
  nvidiaKey?: string;
  geminiKey?: string;
  isUserNvidiaKey: boolean;
  isUserGeminiKey: boolean;
} {
  const cleanKey = (val?: any): string | undefined => {
    if (!val) return undefined;
    const str = String(val).trim().replace(/['"]/g, '').replace(/^Bearer\s+/i, '');
    if (!str || str === 'SUA_CHAVE_AQUI' || str === 'YOUR_API_KEY_HERE') return undefined;
    return str;
  };

  const headerNvidia = cleanKey(
    headers['x-nvidia-key'] ||
    headers['nvidia-api-key'] ||
    headers['x-nvidia-api-key'] ||
    body?.nvidiaApiKey ||
    body?.nvidiaKey
  );

  const headerGemini = cleanKey(
    headers['x-gemini-key'] ||
    headers['gemini-api-key'] ||
    headers['x-gemini-api-key'] ||
    body?.geminiApiKey ||
    body?.geminiKey
  );

  // Authorization Header
  const rawAuth = headers['authorization'] || headers['Authorization'];
  let authBearerKey = cleanKey(rawAuth);

  const envNvidia = cleanKey(
    env.NVIDIA_API_KEY ||
    env.NVIDIA_KEY ||
    env.NV_API_KEY ||
    env.NVIDIA_NIM_API_KEY
  );

  const envGemini = cleanKey(
    env.GEMINI_API_KEY ||
    env.GOOGLE_API_KEY
  );

  let resolvedNvidiaKey = headerNvidia || envNvidia;
  let resolvedGeminiKey = headerGemini || envGemini;
  let isUserNvidiaKey = Boolean(headerNvidia);
  let isUserGeminiKey = Boolean(headerGemini);

  if (authBearerKey) {
    if (authBearerKey.startsWith('nvapi-') || authBearerKey.startsWith('nv-') || !authBearerKey.startsWith('AIzaSy')) {
      resolvedNvidiaKey = authBearerKey;
      isUserNvidiaKey = true;
    } else {
      resolvedGeminiKey = authBearerKey;
      isUserGeminiKey = true;
    }
  }

  return {
    nvidiaKey: resolvedNvidiaKey,
    geminiKey: resolvedGeminiKey,
    isUserNvidiaKey,
    isUserGeminiKey,
  };
}

/**
 * Normalizes schema property types to UPPERCASE for Google GenAI SDK (OBJECT, STRING, etc.)
 */
export function normalizeSchemaForGemini(schema: any): any {
  if (!schema) return undefined;
  try {
    const jsonStr = JSON.stringify(schema);
    const converted = jsonStr.replace(
      /"type"\s*:\s*"([a-zA-Z_]+)"/g,
      (_, t) => `"type":"${t.toUpperCase()}"`
    );
    return JSON.parse(converted);
  } catch {
    return schema;
  }
}

/**
 * Normalizes schema property types to lowercase for OpenAI / NVIDIA NIM (object, string, etc.)
 */
export function normalizeSchemaForOpenAi(schema: any): any {
  if (!schema) return undefined;
  try {
    const jsonStr = JSON.stringify(schema);
    const converted = jsonStr.replace(
      /"type"\s*:\s*"([a-zA-Z_]+)"/g,
      (_, t) => `"type":"${t.toLowerCase()}"`
    );
    return JSON.parse(converted);
  } catch {
    return schema;
  }
}
