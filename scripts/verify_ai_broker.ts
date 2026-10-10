import assert from 'assert';
import {
  normalizeGeminiModelChain,
  normalizeNvidiaModelChain,
  mapRetiredNvidiaModel,
  isDeprecatedGeminiModel,
  shouldFastAbortNvidia,
  resolveAiProviderPriority,
  normalizeSchemaForGemini,
  normalizeSchemaForOpenAi,
  ACTIVE_NVIDIA_MODELS,
  ACTIVE_GEMINI_MODELS
} from '../src/lib/aiBrokerHelper';

console.log('=== TEST SUITE: AI BROKER & MULTI-PROVIDER CONTINGENCY ===\n');

// --- 1. TEST GEMINI DEPRECATION DETECTION & FALLBACK CHAIN ---
console.log('--- 1. Testing Gemini Models Fallback Chain ---');

assert.strictEqual(isDeprecatedGeminiModel('gemini-2.0-flash'), true, 'gemini-2.0-flash must be detected as deprecated');
assert.strictEqual(isDeprecatedGeminiModel('models/gemini-2.0-flash'), true, 'models/gemini-2.0-flash must be detected as deprecated');
assert.strictEqual(isDeprecatedGeminiModel('gemini-2.0-flash-lite'), true, 'gemini-2.0-flash-lite must be detected as deprecated');
assert.strictEqual(isDeprecatedGeminiModel('gemini-1.5-pro'), true, 'gemini-1.5-pro must be detected as deprecated');
assert.strictEqual(isDeprecatedGeminiModel('gemini-3.8-flash'), false, 'gemini-3.8-flash is active, not deprecated');
assert.strictEqual(isDeprecatedGeminiModel('gemini-3.6-flash'), false, 'gemini-3.6-flash is active, not deprecated');
console.log('[PASS] Deprecated Gemini detection accurate.');

// Test default (no model specified)
const defaultGemini = normalizeGeminiModelChain(undefined);
assert.strictEqual(defaultGemini[0], 'gemini-3.8-flash', 'Default model must be gemini-3.8-flash');
assert.ok(!defaultGemini.includes('gemini-2.0-flash'), 'gemini-2.0-flash must never be in list');
assert.ok(defaultGemini.includes('gemini-3.6-flash'), 'gemini-3.6-flash must be available as fallback');
assert.ok(defaultGemini.includes('gemini-2.5-flash'), 'gemini-2.5-flash must be available as fallback');
console.log('[PASS] Default Gemini chain:', defaultGemini);

// Test legacy model redirection (gemini-2.0-flash)
const legacy20 = normalizeGeminiModelChain('gemini-2.0-flash');
assert.strictEqual(legacy20[0], 'gemini-3.8-flash', 'Legacy 2.0 must be promoted to 3.8 Flash');
assert.ok(!legacy20.includes('gemini-2.0-flash'), 'gemini-2.0-flash must be filtered out');
console.log('[PASS] Legacy gemini-2.0-flash redirected:', legacy20);

// Test legacy model redirection with models/ prefix
const legacyPrefixed = normalizeGeminiModelChain('models/gemini-2.0-flash');
assert.strictEqual(legacyPrefixed[0], 'gemini-3.8-flash', 'models/gemini-2.0-flash must be promoted to 3.8 Flash');
assert.ok(!legacyPrefixed.includes('gemini-2.0-flash'), 'gemini-2.0-flash must be filtered out');
console.log('[PASS] Prefixed models/gemini-2.0-flash redirected:', legacyPrefixed);

// Test gemini-2.5-flash promotion (must start with gemini-3.8-flash to prevent 50s timeout)
const legacy25 = normalizeGeminiModelChain('gemini-2.5-flash');
assert.strictEqual(legacy25[0], 'gemini-3.8-flash', 'Must start with 3.8 Flash to prevent timeout');
assert.strictEqual(legacy25[legacy25.length - 1], 'gemini-2.5-flash', '2.5 Flash must be at the end as last resort');
console.log('[PASS] Gemini 2.5 Flash ordered safely:', legacy25);

// Test custom valid model requested (gemini-3.6-flash)
const customGemini = normalizeGeminiModelChain('gemini-3.6-flash');
assert.strictEqual(customGemini[0], 'gemini-3.6-flash', 'Explicitly requested 3.6 Flash must be tried first');
assert.ok(customGemini.includes('gemini-3.8-flash'), '3.8 Flash must remain in fallback chain');
console.log('[PASS] Custom gemini-3.6-flash chain:', customGemini);

// --- 2. TEST NVIDIA RETIRED MODEL MAPPING & ACTIVE CATALOG ---
console.log('\n--- 2. Testing NVIDIA Models Catalog & Retired Slugs Mapping ---');

// Test slug mapping
assert.strictEqual(mapRetiredNvidiaModel('meta/llama-3.1-70b-instruct'), 'meta/llama-3.3-70b-instruct');
assert.strictEqual(mapRetiredNvidiaModel('nvidia/nemotron-4-340b-instruct'), 'nvidia/llama-3.1-nemotron-70b-instruct');
assert.strictEqual(mapRetiredNvidiaModel('nvidia/nemotron-3-super-120b-a12b'), 'nvidia/llama-3.1-nemotron-70b-instruct');
assert.strictEqual(mapRetiredNvidiaModel('deepseek-ai/deepseek-v3'), 'deepseek-ai/deepseek-r1');
assert.strictEqual(mapRetiredNvidiaModel('z-ai/glm-5.1'), 'meta/llama-3.3-70b-instruct');
assert.strictEqual(mapRetiredNvidiaModel('meta/llama-3.3-70b-instruct'), 'meta/llama-3.3-70b-instruct');
console.log('[PASS] Retired NVIDIA slugs mapped to active models.');

// Test default NVIDIA chain
const defaultNvidia = normalizeNvidiaModelChain(undefined);
assert.ok(!defaultNvidia.includes('meta/llama-3.1-70b-instruct'), 'Deprecated llama-3.1-70b (410) must not be in catalog');
assert.ok(!defaultNvidia.includes('nvidia/nemotron-4-340b-instruct'), 'Non-existent nemotron-4-340b (404) must not be in catalog');
assert.ok(!defaultNvidia.includes('deepseek-ai/deepseek-v3'), 'Unreachable deepseek-v3 (404) must not be in catalog');
assert.ok(!defaultNvidia.includes('z-ai/glm-5.1'), 'Deprecated glm-5.1 (410) must not be in catalog');
assert.ok(defaultNvidia.includes('meta/llama-3.3-70b-instruct'), 'Active llama-3.3-70b must be in catalog');
assert.ok(defaultNvidia.includes('nvidia/llama-3.1-nemotron-70b-instruct'), 'Active nemotron-70b must be in catalog');
assert.ok(defaultNvidia.includes('deepseek-ai/deepseek-r1'), 'Active deepseek-r1 must be in catalog');
console.log('[PASS] Active NVIDIA catalog:', defaultNvidia);

// Test requesting a retired NVIDIA model
const requestedRetired = normalizeNvidiaModelChain('z-ai/glm-5.1');
assert.strictEqual(requestedRetired[0], 'meta/llama-3.3-70b-instruct', 'Retired glm-5.1 must be mapped to active llama-3.3');
assert.ok(!requestedRetired.includes('z-ai/glm-5.1'), 'Retired model must not exist in candidate chain');
console.log('[PASS] Requested retired NVIDIA slug normalized correctly.');

// --- 3. TEST FAST ABORT ON ACCOUNT / SCOPE ERRORS ---
console.log('\n--- 3. Testing Fast Abort on Account Auth & Permission Failures ---');

assert.strictEqual(shouldFastAbortNvidia('410 status code (no body)'), true, '410 status code triggers fast abort');
assert.strictEqual(shouldFastAbortNvidia('401 Unauthorized'), true, '401 Unauthorized triggers fast abort');
assert.strictEqual(shouldFastAbortNvidia('403 Forbidden: Public API Endpoints not enabled'), true, '403 Forbidden triggers fast abort');
assert.strictEqual(shouldFastAbortNvidia('Public API Endpoints permission missing'), true, 'Permission text triggers fast abort');
assert.strictEqual(shouldFastAbortNvidia('500 Internal Server Error'), false, '500 Server Error allows model retry');
assert.strictEqual(shouldFastAbortNvidia('Rate limit exceeded 429'), false, '429 Rate limit allows fallback/retry');
console.log('[PASS] Fast abort triggers correctly on permission/auth errors.');

// --- 4. TEST PROVIDER PRIORITY RESOLUTION ---
console.log('\n--- 4. Testing Provider Priority Resolution ---');

// Standard case: Gemini key and NVIDIA key present -> Gemini preferred by default
assert.strictEqual(
  resolveAiProviderPriority({
    isUserNvidiaKey: false,
    isUserGeminiKey: false,
    geminiKey: 'AIzaSy123',
    nvidiaKey: 'nvapi-456'
  }),
  'gemini',
  'Gemini must be prioritized by default when both keys are present'
);

// User provided explicit NVIDIA key -> NVIDIA preferred
assert.strictEqual(
  resolveAiProviderPriority({
    isUserNvidiaKey: true,
    isUserGeminiKey: false,
    geminiKey: 'AIzaSy123',
    nvidiaKey: 'nvapi-user'
  }),
  'nvidia',
  'User NVIDIA key must prioritize NVIDIA'
);

// Environment AI_PROVIDER=nvidia -> NVIDIA preferred
assert.strictEqual(
  resolveAiProviderPriority({
    isUserNvidiaKey: false,
    isUserGeminiKey: false,
    geminiKey: 'AIzaSy123',
    nvidiaKey: 'nvapi-456',
    envProvider: 'nvidia'
  }),
  'nvidia',
  'AI_PROVIDER=nvidia must prioritize NVIDIA'
);

// Only NVIDIA key present (Gemini key absent) -> NVIDIA preferred
assert.strictEqual(
  resolveAiProviderPriority({
    isUserNvidiaKey: false,
    isUserGeminiKey: false,
    geminiKey: undefined,
    nvidiaKey: 'nvapi-456'
  }),
  'nvidia',
  'Only NVIDIA key present must prioritize NVIDIA'
);

console.log('[PASS] Provider priority resolved correctly.');

// --- 5. TEST SCHEMA NORMALIZATION ---
console.log('\n--- 5. Testing Schema Normalization ---');

const inputSchema = {
  type: 'object',
  properties: {
    server_js: { type: 'string' },
    port: { type: 'integer' }
  },
  required: ['server_js']
};

const geminiSchema = normalizeSchemaForGemini(inputSchema);
assert.strictEqual(geminiSchema.type, 'OBJECT', 'Gemini type must be uppercase OBJECT');
assert.strictEqual(geminiSchema.properties.server_js.type, 'STRING', 'Gemini string type must be uppercase STRING');
assert.strictEqual(geminiSchema.properties.port.type, 'INTEGER', 'Gemini integer type must be uppercase INTEGER');

const openAiSchema = normalizeSchemaForOpenAi(geminiSchema);
assert.strictEqual(openAiSchema.type, 'object', 'OpenAI type must be lowercase object');
assert.strictEqual(openAiSchema.properties.server_js.type, 'string', 'OpenAI string type must be lowercase string');
assert.strictEqual(openAiSchema.properties.port.type, 'integer', 'OpenAI integer type must be lowercase integer');

console.log('[PASS] Schema normalization works bi-directionally.');

console.log('\n======================================================');
console.log('ALL AI BROKER TESTS PASSED SUCCESSFULLY! (100% OK)');
console.log('======================================================');
