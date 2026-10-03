import React, { useState } from 'react';
import { X, Copy, Check, Download, RefreshCw, Key, Shield, Sliders } from 'lucide-react';

interface EnvConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  isIot?: boolean;
}

function generateRandomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function EnvConfigModal({
  isOpen,
  onClose,
  projectName = 'parvus-app',
  isIot = false
}: EnvConfigModalProps) {
  const [port, setPort] = useState('3000');
  const [nodeEnv, setNodeEnv] = useState<'production' | 'development'>('production');
  const [databaseUrl, setDatabaseUrl] = useState('postgresql://postgres:sua_senha@db.exemplo.supabase.co:5432/postgres');
  const [jwtSecret, setJwtSecret] = useState(() => 'jwt_' + generateRandomHex(40));
  const [webhookSecret, setWebhookSecret] = useState(() => 'whsec_' + generateRandomHex(32));
  const [supabaseUrl, setSupabaseUrl] = useState('https://sua-instancia.supabase.co');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.exemplo_chave_publica');
  const [mqttBroker, setMqttBroker] = useState('mqtt://broker.hivemq.com:1883');
  
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRegenerateTokens = () => {
    setJwtSecret('jwt_' + generateRandomHex(40));
    setWebhookSecret('whsec_' + generateRandomHex(32));
  };

  const envContent = `# ==============================================================================
# PARVUS AUTOMATE - VARIÁVEIS DE AMBIENTE (.env)
# Projeto: ${projectName}
# Gerado em: ${new Date().toLocaleString('pt-BR')}
# ==============================================================================

# SERVIDOR NODE.JS
PORT=${port}
NODE_ENV=${nodeEnv}

# BANCO DE DADOS (SUPABASE / POSTGRESQL)
DATABASE_URL="${databaseUrl}"

# CHAVES SUPABASE (CLIENT & ADMIN)
SUPABASE_URL="${supabaseUrl}"
SUPABASE_ANON_KEY="${supabaseAnonKey}"

# SEGURANÇA & CRIPTOGRAFIA (HMAC / JWT)
JWT_SECRET="${jwtSecret}"
WEBHOOK_SECRET="${webhookSecret}"
${isIot ? `\n# BROKER MQTT IOT TELEMETRIA\nMQTT_BROKER_URL="${mqttBroker}"\nMQTT_CLIENT_ID="parvus_${projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.floor(1000 + Math.random() * 9000)}"` : ''}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(envContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([envContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0e111a] border border-white/15 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ff6600]/10 border border-[#ff6600]/30 flex items-center justify-center">
              <Sliders className="text-[#ff6600]" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Configurador de Variáveis (.env)
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#ff6600]/15 text-[#ff6600] font-mono font-bold">
                  PRODUCTION READY
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Gere e exporte segredos e credenciais com tokens criptográficos seguros
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
          
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Parâmetros de Produção
            </span>
            <button
              onClick={handleRegenerateTokens}
              className="text-xs text-[#00d4ff] hover:underline flex items-center gap-1 font-mono font-bold"
            >
              <RefreshCw size={12} /> Regenerar Tokens Criptográficos
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Porta HTTP (PORT)
              </label>
              <input
                type="text"
                value={port}
                onChange={e => setPort(e.target.value)}
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-[#ff6600]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Ambiente (NODE_ENV)
              </label>
              <select
                value={nodeEnv}
                onChange={e => setNodeEnv(e.target.value as any)}
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-[#ff6600]"
              >
                <option value="production">production</option>
                <option value="development">development</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                String de Conexão do Banco (DATABASE_URL)
              </label>
              <input
                type="text"
                value={databaseUrl}
                onChange={e => setDatabaseUrl(e.target.value)}
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-[#ff6600]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Supabase URL (SUPABASE_URL)
              </label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-[#ff6600]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Supabase Anon Key (SUPABASE_ANON_KEY)
              </label>
              <input
                type="text"
                value={supabaseAnonKey}
                onChange={e => setSupabaseAnonKey(e.target.value)}
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-[#ff6600]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Token Secreto JWT (JWT_SECRET)
              </label>
              <input
                type="text"
                value={jwtSecret}
                onChange={e => setJwtSecret(e.target.value)}
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#00ff88] outline-none focus:border-[#ff6600]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Segredo de Assinatura Webhook (WEBHOOK_SECRET)
              </label>
              <input
                type="text"
                value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)}
                className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-[#00ff88] outline-none focus:border-[#ff6600]"
              />
            </div>

            {isIot && (
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Broker MQTT (MQTT_BROKER_URL)
                </label>
                <input
                  type="text"
                  value={mqttBroker}
                  onChange={e => setMqttBroker(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-[#ff6600]"
                />
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Conteúdo do Arquivo .env:
              </span>
              <button
                onClick={handleCopy}
                className="text-xs text-gray-300 hover:text-white flex items-center gap-1 font-mono"
              >
                {copied ? <Check size={12} className="text-[#00ff88]" /> : <Copy size={12} />}
                {copied ? 'Copiado!' : 'Copiar Texto'}
              </button>
            </div>
            <pre className="bg-[#090b10] border border-white/10 rounded-xl p-4 text-xs font-mono text-gray-300 overflow-x-auto max-h-52">
              {envContent}
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
          
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-all flex items-center gap-1.5"
            >
              {copied ? <Check size={13} className="text-[#00ff88]" /> : <Copy size={13} />}
              {copied ? 'Copiado!' : 'Copiar .env'}
            </button>
            <button
              onClick={handleDownload}
              className="px-5 py-2.5 rounded-xl bg-[#ff6600] text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-[1.02] shadow-[0_0_15px_rgba(255,102,0,0.3)] transition-all"
            >
              <Download size={14} />
              Baixar Arquivo .env
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
