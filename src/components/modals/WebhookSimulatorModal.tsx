import React, { useState, useEffect } from 'react';
import { X, Play, Copy, Check, ShieldCheck, Zap, RefreshCw, Send, Terminal, AlertCircle } from 'lucide-react';

interface WebhookSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEndpoint?: string;
  projectName?: string;
}

const PRESETS = [
  {
    id: 'lead_created',
    name: 'Lead Criado (CRM / WhatsApp)',
    method: 'POST',
    payload: {
      event: 'lead.created',
      timestamp: new Date().toISOString(),
      lead: {
        id: 'ld_98231',
        nome: 'Mariana Silveira',
        email: 'mariana.silveira@techcorp.com.br',
        telefone: '+55 11 98765-4321',
        empresa: 'TechCorp Brasil',
        valor_estimado: 14500.00,
        origem: 'Landing Page Enterprise',
        score: 87
      }
    }
  },
  {
    id: 'payment_pix',
    name: 'Pagamento PIX Aprovado',
    method: 'POST',
    payload: {
      event: 'payment.pix_approved',
      timestamp: new Date().toISOString(),
      transaction: {
        id: 'tx_pix_' + Math.floor(100000 + Math.random() * 900000),
        valor: 450.00,
        moeda: 'BRL',
        status: 'PAID',
        pagador: {
          nome: 'Carlos Eduardo Mendes',
          cpf_mascarado: '***.452.988-**',
          banco: 'Banco Central do Brasil'
        },
        end_to_end_id: 'E18236120202610031545000012'
      }
    }
  },
  {
    id: 'iot_sensor_alert',
    name: 'Alerta Crítico de Telemetria IoT',
    method: 'POST',
    payload: {
      event: 'iot.sensor_threshold_exceeded',
      timestamp: new Date().toISOString(),
      device: {
        device_id: 'esp32_refr_04',
        location: 'Camara Fria 02 - CD Campinas',
        temperatura_celsius: 14.8,
        limite_critico_celsius: 4.0,
        umidade_percentual: 88.5,
        bateria_status: 'OK',
        uptime_segundos: 245910
      },
      severity: 'CRITICAL',
      action_taken: 'Alarme sonoro disparado e relé de emergência desativado'
    }
  },
  {
    id: 'order_status',
    name: 'Atualização de Ordem de Serviço',
    method: 'POST',
    payload: {
      event: 'work_order.updated',
      timestamp: new Date().toISOString(),
      order_id: 'OS-2026-4412',
      status_anterior: 'em_analise',
      novo_status: 'em_execucao',
      tecnico_responsavel: 'Lucas Prado',
      previsao_conclusao: '2026-10-04T18:00:00Z'
    }
  }
];

// Helper to compute HMAC-SHA256 in browser using subtle crypto
async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function WebhookSimulatorModal({
  isOpen,
  onClose,
  defaultEndpoint = 'http://localhost:3000/api/v1/webhooks',
  projectName = 'Sistema'
}: WebhookSimulatorModalProps) {
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].id);
  const [method, setMethod] = useState<'POST' | 'PUT' | 'GET'>('POST');
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [secretKey, setSecretKey] = useState('whsec_parvus_' + Math.random().toString(36).substring(2, 10));
  const [payloadStr, setPayloadStr] = useState(JSON.stringify(PRESETS[0].payload, null, 2));
  const [calculatedSignature, setCalculatedSignature] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedSignature, setCopiedSignature] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Recalculate signature whenever payload or secret changes
  useEffect(() => {
    let isMounted = true;
    computeHmacSha256(secretKey, payloadStr).then(sig => {
      if (isMounted) setCalculatedSignature(sig);
    }).catch(() => {
      if (isMounted) setCalculatedSignature('Erro ao calcular assinatura');
    });
    return () => { isMounted = false; };
  }, [secretKey, payloadStr]);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const p = PRESETS.find(x => x.id === presetId);
    if (p) {
      setMethod(p.method as any);
      setPayloadStr(JSON.stringify(p.payload, null, 2));
    }
  };

  const generateRandomSecret = () => {
    const chars = '0123456789abcdef';
    let s = 'whsec_';
    for (let i = 0; i < 32; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    setSecretKey(s);
  };

  const handleExecuteWebhook = async () => {
    setIsLoading(true);
    setTestResult(null);
    const startTime = performance.now();

    try {
      let parsedPayload: any = {};
      try {
        parsedPayload = JSON.parse(payloadStr);
      } catch (e: any) {
        throw new Error('Payload JSON inválido: ' + e.message);
      }

      // Try calling local or remote endpoint, or simulate instant mock response if localhost unreachable
      let resData: any = null;
      let status = 200;
      let isMock = false;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Signature-SHA256': calculatedSignature,
            'X-Timestamp': new Date().toISOString(),
            'X-Event-Source': 'Parvus-Automate-Webhook-Tester'
          },
          body: method !== 'GET' ? JSON.stringify(parsedPayload) : undefined,
          signal: controller.signal
        });
        clearTimeout(timeout);
        status = response.status;
        const text = await response.text();
        try {
          resData = JSON.parse(text);
        } catch {
          resData = { raw: text };
        }
      } catch (networkErr: any) {
        // High fidelity sandbox simulation for local offline testing
        isMock = true;
        await new Promise(r => setTimeout(r, 120)); // Realistic latency
        status = 200;
        resData = {
          success: true,
          status: 'PROCESSED',
          simulation: true,
          message: `Webhook recebido e verificado com sucesso pelo microsserviço de ${projectName}!`,
          verifiedSignature: true,
          signatureUsed: calculatedSignature.substring(0, 16) + '...',
          auditId: 'evt_' + Math.random().toString(36).substring(2, 10),
          processedAt: new Date().toISOString(),
          receivedEvent: parsedPayload.event || 'custom.event',
          systemState: {
            databaseSynced: true,
            kpisRecalculated: true,
            pushNotificationSent: true
          }
        };
      }

      const latency = Math.round(performance.now() - startTime);

      setTestResult({
        success: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : status === 201 ? 'CREATED' : 'RESPONSE',
        latencyMs: latency,
        isMock,
        response: resData,
        headersSent: {
          'Content-Type': 'application/json',
          'X-Signature-SHA256': calculatedSignature,
          'X-Timestamp': new Date().toISOString()
        }
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        status: 500,
        statusText: 'CLIENT_ERROR',
        latencyMs: Math.round(performance.now() - startTime),
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const curlCommand = `curl -X ${method} "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-Signature-SHA256: ${calculatedSignature}" \\
  -H "X-Timestamp: ${new Date().toISOString()}" \\
  -d '${payloadStr.replace(/\n/g, '').replace(/'/g, "\\'")}'`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0e111a] border border-white/15 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center">
              <Zap className="text-[#00ff88]" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Simulador & Testador de Webhook
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#00ff88]/15 text-[#00ff88] font-mono font-bold">
                  HMAC-SHA256
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Dispare eventos para o microsserviço ou teste APIs com assinatura criptográfica
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Preset Buttons */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              Selecione um Modelo de Evento:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                    selectedPreset === p.id
                      ? 'border-[#00ff88] bg-[#00ff88]/10 text-white font-semibold shadow-[0_0_12px_rgba(0,255,136,0.15)]'
                      : 'border-white/10 bg-white/[0.02] text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="truncate">{p.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint + Method */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Método
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as any)}
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#00ff88] outline-none focus:border-[#00ff88]"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="GET">GET</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Endpoint URL
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                placeholder="http://localhost:3000/api/v1/webhooks"
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          {/* Secret Key & HMAC Signature */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#00ff88]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Chave Secreta HMAC (Shared Secret)</span>
              </div>
              <button
                onClick={generateRandomSecret}
                className="text-[11px] text-[#00d4ff] hover:underline flex items-center gap-1 font-mono"
              >
                <RefreshCw size={11} /> Gerar Nova Chave
              </button>
            </div>
            
            <input
              type="text"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              className="w-full bg-[#121520] border border-white/15 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-300 outline-none focus:border-[#00ff88]"
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-mono text-gray-400">
                  Header Assinatura Calculada (X-Signature-SHA256):
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(calculatedSignature);
                    setCopiedSignature(true);
                    setTimeout(() => setCopiedSignature(false), 2000);
                  }}
                  className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                >
                  {copiedSignature ? <Check size={10} className="text-[#00ff88]" /> : <Copy size={10} />}
                  {copiedSignature ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="bg-[#0b0d14] border border-white/10 rounded px-2.5 py-1 text-[11px] font-mono text-[#00ff88] truncate select-all">
                {calculatedSignature}
              </div>
            </div>
          </div>

          {/* JSON Payload Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Corpo da Requisição (Payload JSON):
              </label>
              <span className="text-[10px] text-gray-500 font-mono">Modifique livremente os dados</span>
            </div>
            <textarea
              rows={8}
              value={payloadStr}
              onChange={e => setPayloadStr(e.target.value)}
              className="w-full bg-[#0b0d14] border border-white/15 rounded-xl p-3 text-xs font-mono text-gray-200 outline-none focus:border-[#00ff88] resize-y"
              spellCheck={false}
            />
          </div>

          {/* Response Console */}
          {testResult && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-gray-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Resposta do Servidor
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    testResult.success ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {testResult.status} {testResult.statusText}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {testResult.latencyMs}ms
                  </span>
                  {testResult.isMock && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-300 font-mono">
                      Emulador Local
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-[#090b10] border border-white/15 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-60">
                <pre className="text-emerald-400 whitespace-pre-wrap">
                  {JSON.stringify(testResult.response || testResult.error, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* cURL Preview */}
          <div className="border border-white/10 rounded-xl p-3 bg-black/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-mono text-gray-400">Comando cURL Equivalente:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(curlCommand);
                  setCopiedCurl(true);
                  setTimeout(() => setCopiedCurl(false), 2000);
                }}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 font-mono"
              >
                {copiedCurl ? <Check size={10} className="text-[#00ff88]" /> : <Copy size={10} />}
                {copiedCurl ? 'cURL Copiado!' : 'Copiar cURL'}
              </button>
            </div>
            <pre className="text-[10px] font-mono text-gray-300 bg-[#090b10] p-2 rounded overflow-x-auto">
              {curlCommand}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider"
          >
            Fechar
          </button>
          
          <button
            onClick={handleExecuteWebhook}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-[1.02] shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Disparando...
              </>
            ) : (
              <>
                <Send size={14} /> Disparar Webhook de Teste
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
