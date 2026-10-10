import React, { useState, useEffect } from 'react';
import { 
  Cloud, Cpu, Radio, Shield, Zap, Copy, Check, Terminal, Play, 
  Settings, ArrowRight, CheckCircle2, RefreshCw, Send, AlertTriangle, 
  ExternalLink, Layers, Database, Lock, Sliders, Webhook
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface IotSoftwareProps {
  onNavigateToMonitor?: () => void;
  onNavigateToGenerator?: () => void;
  onDispatchTelemetry?: (packet: any) => void;
  currentHardwareProject?: any;
}

interface AutomationRule {
  id: string;
  name: string;
  conditionSensor: string;
  conditionOperator: '>' | '<' | '==';
  conditionValue: number;
  actionType: 'MQTT_COMMAND' | 'WEBHOOK_POST' | 'DATABASE_LOG';
  actionTarget: string;
  active: boolean;
  lastTriggered?: string;
}

export function IotSoftware({
  onNavigateToMonitor,
  onNavigateToGenerator,
  onDispatchTelemetry,
  currentHardwareProject
}: IotSoftwareProps) {
  const [activeTab, setActiveTab] = useState<'wizard' | 'rules' | 'api' | 'telemetry-stream'>('wizard');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Wizard States
  const [wizardStep, setWizardStep] = useState(1);
  const [tenantName, setTenantName] = useState('enterprise-corp');
  const [deviceId, setDeviceId] = useState(() => 'esp32_node_' + Math.random().toString(36).substring(2, 7));
  const [apiKey, setApiKey] = useState(() => 'pk_live_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2));
  const [authToken, setAuthToken] = useState(() => 'jwt_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2));
  const [wifiSsid, setWifiSsid] = useState('MinhaRede_WiFi');
  const [wifiPassword, setWifiPassword] = useState('senha1234');
  const [brokerHost, setBrokerHost] = useState('broker.parvusautomate.com');
  const [brokerPort, setBrokerPort] = useState(1883);

  // Test Packet States
  const [testPayload, setTestPayload] = useState({
    temperatura: 25.4,
    umidade: 62.0,
    rele_1: false,
    rssi: -58,
    bateria_mv: 4120
  });
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; msg: string; type: 'info' | 'success' | 'warn' }>>([
    { time: '14:20:01', msg: 'IoT Cloud Gateway inicializado em porta 8883 (MQTTS) e 443 (HTTPS).', type: 'info' },
    { time: '14:20:05', msg: 'Tópicos pub/sub registrados no tenant default.', type: 'info' }
  ]);

  // Automation Rules
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: 'rule_1',
      name: 'Resfriamento Crítico (Temp > 30°C)',
      conditionSensor: 'temperatura',
      conditionOperator: '>',
      conditionValue: 30,
      actionType: 'MQTT_COMMAND',
      actionTarget: 'parvus/enterprise-corp/esp32_node_01/commands {"rele_1": true}',
      active: true,
      lastTriggered: '10 min atrás'
    },
    {
      id: 'rule_2',
      name: 'Alerta de Umidade Baixa (< 30%)',
      conditionSensor: 'umidade',
      conditionOperator: '<',
      conditionValue: 30,
      actionType: 'WEBHOOK_POST',
      actionTarget: 'https://api.empresa.com/webhooks/alertas-ambiente',
      active: true,
      lastTriggered: 'Nunca'
    },
    {
      id: 'rule_3',
      name: 'Snapshot em Banco Supabase a cada 60s',
      conditionSensor: 'temperatura',
      conditionOperator: '>',
      conditionValue: -50,
      actionType: 'DATABASE_LOG',
      actionTarget: 'supabase.table("iot_telemetry")',
      active: true,
      lastTriggered: 'Há 5 segundos'
    }
  ]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const topicTelemetry = `parvus/${tenantName}/${deviceId}/telemetry`;
  const topicCommands = `parvus/${tenantName}/${deviceId}/commands`;
  const endpointHttp = `https://api.parvusautomate.com/api/v1/iot/telemetry`;

  // Dynamic Firmware Snippet generated for user
  const firmwareSnippet = `// ========================================================
// PARVUS AUTOMATE - CREDENCIAIS E CONFIGURAÇÃO CLOUD IOT
// Cole estas linhas no início do seu código C++ / Arduino
// ========================================================

const char* WIFI_SSID     = "${wifiSsid}";
const char* WIFI_PASSWORD = "${wifiPassword}";

// Configurações do Broker MQTT & Gateway Parvus
const char* MQTT_SERVER   = "${brokerHost}";
const int   MQTT_PORT     = ${brokerPort};
const char* DEVICE_ID     = "${deviceId}";
const char* TENANT_ID     = "${tenantName}";
const char* DEVICE_TOKEN  = "${authToken}";

// Tópicos Oficiais de Mensageria Bidirecional
const char* TOPIC_TELEMETRY = "${topicTelemetry}";
const char* TOPIC_COMMANDS  = "${topicCommands}";

// Exemplo de Envio no Loop com ArduinoJson:
/*
void enviarTelemetria(float temp, float umid) {
  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperatura"] = temp;
  doc["umidade"] = umid;
  doc["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(doc, buffer);
  client.publish(TOPIC_TELEMETRY, buffer);
  Serial.println("[MQTT] Telemetria despachada com sucesso!");
}
*/`;

  const handleSendTestTelemetry = () => {
    setDispatchStatus('enviando');
    const timeNow = new Date().toLocaleTimeString('pt-BR');
    
    setTimeout(() => {
      const packet = {
        device_id: deviceId,
        tenant: tenantName,
        timestamp: new Date().toISOString(),
        data: testPayload
      };

      // Dispara callback para alimentar o IoT Monitor
      if (onDispatchTelemetry) {
        onDispatchTelemetry(packet);
      }

      // Adiciona aos logs locais
      setLogs(prev => [
        { 
          time: timeNow, 
          msg: `[INGESTION] Pacote recebido de ${deviceId} em ${topicTelemetry} -> Temp: ${testPayload.temperatura}°C, Umid: ${testPayload.umidade}%`, 
          type: 'success' 
        },
        ...prev
      ]);

      // Verifica regras de automação
      if (testPayload.temperatura > 30) {
        setLogs(prev => [
          { time: timeNow, msg: `[TRIGGER] Regra "Resfriamento Crítico" disparada! Comando enviado para ${topicCommands}`, type: 'warn' },
          ...prev
        ]);
      }

      setDispatchStatus('sucesso');
      setTimeout(() => setDispatchStatus(null), 3000);
    }, 400);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#07080c] text-gray-200 overflow-hidden font-sans">
      {/* Top Banner & Header */}
      <div className="bg-[#0b0c10] border-b border-white/10 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00d4ff] to-[#00ff88] p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.25)]">
            <div className="w-full h-full bg-[#07080c] rounded-[10px] flex items-center justify-center text-[#00d4ff]">
              <Cloud size={20} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-white text-base sm:text-lg tracking-tight font-display">
                IoT Software <span className="text-[#00d4ff]">Cloud Brain</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30">
                GATEWAY & AUTOMAÇÃO
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Camada de software em nuvem para orquestração, ingestão de telemetria, webhooks e amarrações com o IoT Monitor
            </p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 px-3 py-1.5 rounded-xl font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></div>
            <span className="text-gray-400 text-[11px]">Broker MQTT:</span>
            <span className="text-white font-bold">ONLINE</span>
          </div>
          <div className="w-px h-4 bg-white/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Tenant:</span>
            <span className="text-[#00d4ff] font-bold">{tenantName}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center border-b border-white/10 bg-[#090a0f] px-4 sm:px-6 shrink-0 overflow-x-auto no-scrollbar">
        {[
          { id: 'wizard', label: 'Wizard Assistente de Configuração', icon: Zap },
          { id: 'rules', label: 'Motor de Regras de Automação', icon: Sliders },
          { id: 'api', label: 'Endpoints HTTP & MQTT Topics', icon: Webhook },
          { id: 'telemetry-stream', label: 'Console de Ingestão em Nuvem', icon: Terminal }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff]/5'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#07080c]">
        {/* TAB 1: WIZARD ASSISTENTE */}
        {activeTab === 'wizard' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Wizard Stepper Header */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-[#0b0d14] border border-white/10 rounded-2xl p-2 font-mono text-xs">
              {[
                { step: 1, title: '1. Hardware & Placa' },
                { step: 2, title: '2. Credenciais & Segurança' },
                { step: 3, title: '3. Tópicos & Endpoints' },
                { step: 4, title: '4. Snippet & Validação' }
              ].map(s => (
                <button
                  key={s.step}
                  onClick={() => setWizardStep(s.step)}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${
                    wizardStep === s.step
                      ? 'bg-[#00d4ff] text-black shadow-[0_0_15px_rgba(0,212,255,0.3)]'
                      : wizardStep > s.step
                      ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {wizardStep > s.step && <Check size={13} />}
                  {s.title}
                </button>
              ))}
            </div>

            {/* Step 1: Hardware & Device Identification */}
            {wizardStep === 1 && (
              <div className="bg-[#0b0d14] border border-white/10 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-white font-bold text-base flex items-center gap-2">
                      <Cpu size={18} className="text-[#00d4ff]" />
                      Vincular Hardware Físico ao IoT Software
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Identifique o microcontrolador físico para provisionamento de segurança
                    </p>
                  </div>
                  {currentHardwareProject && (
                    <span className="px-3 py-1 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold border border-[#00ff88]/30">
                      Projeto Conectado: {currentHardwareProject.titulo || 'ESP32'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase font-mono">
                      Tenant / Organização Empresarial
                    </label>
                    <input
                      type="text"
                      value={tenantName}
                      onChange={e => setTenantName(e.target.value)}
                      className="w-full bg-[#12141c] border border-white/15 rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:border-[#00d4ff] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase font-mono">
                      Device ID Exclusivo (Hardware GUID)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={deviceId}
                        onChange={e => setDeviceId(e.target.value)}
                        className="flex-1 bg-[#12141c] border border-white/15 rounded-xl px-4 py-2.5 text-[#00d4ff] font-bold text-xs font-mono focus:border-[#00d4ff] outline-none"
                      />
                      <button
                        onClick={() => setDeviceId('esp32_' + Math.random().toString(36).substring(2, 7))}
                        className="px-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-mono border border-white/10"
                        title="Gerar novo identificador"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase font-mono">
                      SSID do Wi-Fi Local do Dispositivo
                    </label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={e => setWifiSsid(e.target.value)}
                      className="w-full bg-[#12141c] border border-white/15 rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:border-[#00d4ff] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase font-mono">
                      Senha do Wi-Fi
                    </label>
                    <input
                      type="password"
                      value={wifiPassword}
                      onChange={e => setWifiPassword(e.target.value)}
                      className="w-full bg-[#12141c] border border-white/15 rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:border-[#00d4ff] outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-6 py-2.5 bg-[#00d4ff] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-[#33ddff] flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,212,255,0.25)]"
                  >
                    Avançar para Credenciais <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Credenciais & Segurança */}
            {wizardStep === 2 && (
              <div className="bg-[#0b0d14] border border-white/10 rounded-2xl p-6 space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-white font-bold text-base flex items-center gap-2">
                    <Shield size={18} className="text-[#00ff88]" />
                    Chaves Criptográficas & Tokens de Comunicação
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Geração de credenciais seguras para autenticação em TLS e HMAC
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#12141c] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-gray-300">API Key de Produção (X-API-Key)</span>
                      <button
                        onClick={() => copyText(apiKey, 'apikey')}
                        className="text-[10px] text-[#00ff88] hover:underline flex items-center gap-1 font-mono"
                      >
                        {copiedKey === 'apikey' ? <Check size={11} /> : <Copy size={11} />}
                        {copiedKey === 'apikey' ? 'COPIADO' : 'COPIAR'}
                      </button>
                    </div>
                    <code className="text-[#00ff88] font-mono text-xs break-all block bg-black/40 p-2.5 rounded-lg border border-white/5">
                      {apiKey}
                    </code>
                  </div>

                  <div className="bg-[#12141c] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-gray-300">JWT Device Bearer Token</span>
                      <button
                        onClick={() => copyText(authToken, 'jwt')}
                        className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1 font-mono"
                      >
                        {copiedKey === 'jwt' ? <Check size={11} /> : <Copy size={11} />}
                        {copiedKey === 'jwt' ? 'COPIADO' : 'COPIAR'}
                      </button>
                    </div>
                    <code className="text-[#00d4ff] font-mono text-xs break-all block bg-black/40 p-2.5 rounded-lg border border-white/5">
                      {authToken}
                    </code>
                  </div>
                </div>

                <div className="flex justify-between pt-3">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="px-5 py-2.5 bg-white/5 text-gray-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setWizardStep(3)}
                    className="px-6 py-2.5 bg-[#00d4ff] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-[#33ddff] flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,212,255,0.25)]"
                  >
                    Avançar para Tópicos <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Tópicos MQTT & Endpoints */}
            {wizardStep === 3 && (
              <div className="bg-[#0b0d14] border border-white/10 rounded-2xl p-6 space-y-5">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-white font-bold text-base flex items-center gap-2">
                    <Radio size={18} className="text-[#ff6600]" />
                    Rotas Oficiais de Pub/Sub & Webhook HTTP
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Endpoints e canais de mensageria amarrados ao IoT Monitor
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#12141c] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-gray-300">1. Tópico MQTT de Telemetria (Dispositivo → Nuvem)</span>
                      <button onClick={() => copyText(topicTelemetry, 'tt')} className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1 font-mono">
                        {copiedKey === 'tt' ? 'COPIADO' : 'COPIAR'}
                      </button>
                    </div>
                    <code className="text-amber-400 font-mono text-xs block bg-black/40 p-2.5 rounded-lg border border-white/5">
                      {topicTelemetry}
                    </code>
                  </div>

                  <div className="bg-[#12141c] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-gray-300">2. Tópico MQTT de Comandos/Atuadores (Nuvem → Dispositivo)</span>
                      <button onClick={() => copyText(topicCommands, 'tc')} className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1 font-mono">
                        {copiedKey === 'tc' ? 'COPIADO' : 'COPIAR'}
                      </button>
                    </div>
                    <code className="text-emerald-400 font-mono text-xs block bg-black/40 p-2.5 rounded-lg border border-white/5">
                      {topicCommands}
                    </code>
                  </div>

                  <div className="bg-[#12141c] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-gray-300">3. Endpoint HTTP POST Fallback (REST / Webhook)</span>
                      <button onClick={() => copyText(endpointHttp, 'eh')} className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1 font-mono">
                        {copiedKey === 'eh' ? 'COPIADO' : 'COPIAR'}
                      </button>
                    </div>
                    <code className="text-cyan-400 font-mono text-xs block bg-black/40 p-2.5 rounded-lg border border-white/5">
                      {endpointHttp}
                    </code>
                  </div>
                </div>

                <div className="flex justify-between pt-3">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2.5 bg-white/5 text-gray-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setWizardStep(4)}
                    className="px-6 py-2.5 bg-[#00d4ff] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-[#33ddff] flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,212,255,0.25)]"
                  >
                    Ver Snippet & Testar <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Snippet Interativo & Teste de Disparo */}
            {wizardStep === 4 && (
              <div className="bg-[#0b0d14] border border-white/10 rounded-2xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-white font-bold text-base flex items-center gap-2">
                      <Zap size={18} className="text-[#00ff88]" />
                      Snippet Interativo para Colar no Firmware
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Substituição automática realizada com suas credenciais prontas
                    </p>
                  </div>
                  <button
                    onClick={() => copyText(firmwareSnippet, 'snippet')}
                    className="px-4 py-2 bg-[#00ff88] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-[#00e676] flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,255,136,0.25)] self-start sm:self-auto"
                  >
                    {copiedKey === 'snippet' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === 'snippet' ? 'SNIPPET COPIADO!' : 'COPIAR SNIPPET COMPLETO'}
                  </button>
                </div>

                {/* Code Box */}
                <div className="bg-[#06070a] border border-white/10 rounded-xl p-4 overflow-x-auto text-[11px] font-mono text-cyan-300 leading-relaxed max-h-72 select-text">
                  <pre>{firmwareSnippet}</pre>
                </div>

                {/* Interactive Test Panel */}
                <div className="border border-[#00d4ff]/30 bg-[#00d4ff]/5 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold text-sm flex items-center gap-2">
                        <Send size={15} className="text-[#00d4ff]" />
                        Simular Envio de Pacote do Dispositivo Físico
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Injeta telemetria instantaneamente no IoT Software e no IoT Monitor
                      </p>
                    </div>
                    {dispatchStatus === 'sucesso' && (
                      <span className="flex items-center gap-1 text-[#00ff88] text-xs font-bold animate-in fade-in">
                        <CheckCircle2 size={14} /> Pacote Ingerido com Sucesso!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="bg-[#0b0d14] p-2.5 rounded-lg border border-white/10">
                      <span className="text-gray-400 block text-[10px]">Temperatura:</span>
                      <span className="text-white font-bold text-sm">{testPayload.temperatura} °C</span>
                    </div>
                    <div className="bg-[#0b0d14] p-2.5 rounded-lg border border-white/10">
                      <span className="text-gray-400 block text-[10px]">Umidade:</span>
                      <span className="text-white font-bold text-sm">{testPayload.umidade} %</span>
                    </div>
                    <div className="bg-[#0b0d14] p-2.5 rounded-lg border border-white/10">
                      <span className="text-gray-400 block text-[10px]">RSSI Wi-Fi:</span>
                      <span className="text-[#00d4ff] font-bold text-sm">{testPayload.rssi} dBm</span>
                    </div>
                    <div className="bg-[#0b0d14] p-2.5 rounded-lg border border-white/10">
                      <span className="text-gray-400 block text-[10px]">Relé 1:</span>
                      <span className={testPayload.rele_1 ? "text-[#00ff88] font-bold text-sm" : "text-gray-400 font-bold text-sm"}>
                        {testPayload.rele_1 ? "LIGADO" : "DESLIGADO"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={handleSendTestTelemetry}
                      disabled={dispatchStatus === 'enviando'}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#00d4ff] to-[#00ff88] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:opacity-95 transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)] flex items-center gap-2 cursor-pointer"
                    >
                      {dispatchStatus === 'enviando' ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                      Disparar Pacote de Teste
                    </button>
                    {onNavigateToMonitor && (
                      <button
                        onClick={onNavigateToMonitor}
                        className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5"
                      >
                        Abrir IoT Monitor para Ver Gráficos <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REGRAS DE AUTOMAÇÃO */}
        {activeTab === 'rules' && (
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-base flex items-center gap-2 font-display">
                  <Sliders size={18} className="text-[#00d4ff]" />
                  Motor de Regras & Automação de Nuvem
                </h2>
                <p className="text-xs text-gray-400">
                  Condições lógicas avaliadas em tempo real conforme as leituras do hardware chegam
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-[#0b0d14] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-white/20"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{rule.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        rule.active ? 'bg-[#00ff88]/15 text-[#00ff88]' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {rule.active ? 'ATIVA' : 'PAUSADA'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400">
                      <span>SE <strong className="text-cyan-300">{rule.conditionSensor}</strong> {rule.conditionOperator} <strong className="text-amber-400">{rule.conditionValue}</strong></span>
                      <span>→</span>
                      <span className="text-[#00ff88]">{rule.actionType}: {rule.actionTarget}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-gray-500">Último disparo: {rule.lastTriggered}</span>
                    <button
                      onClick={() => {
                        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                        rule.active
                          ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 hover:bg-[#00ff88]/25'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      {rule.active ? 'Ligada' : 'Desligada'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ENDPOINTS E API */}
        {activeTab === 'api' && (
          <div className="max-w-5xl mx-auto space-y-5">
            <div>
              <h2 className="text-white font-bold text-base flex items-center gap-2 font-display">
                <Webhook size={18} className="text-[#00d4ff]" />
                Arquitetura de Endpoints & Protocolos Suportados
              </h2>
              <p className="text-xs text-gray-400">
                Padrões de integração RESTful e MQTT para conexão com firmware e servidores externos
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0b0d14] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#00d4ff] font-bold text-xs uppercase font-mono">
                  <Radio size={14} /> Broker MQTT (Portas 1883 / 8883)
                </div>
                <p className="text-xs text-gray-400">
                  Comunicação bidirecional com QoS 0 e 1, ideal para microcontroladores ESP32, STM32 e Raspberry Pi Pico W.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-gray-400 block text-[10px]">Pub Telemetria:</span>
                    <span className="text-amber-400">{topicTelemetry}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-gray-400 block text-[10px]">Sub Comandos:</span>
                    <span className="text-emerald-400">{topicCommands}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0b0d14] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#00ff88] font-bold text-xs uppercase font-mono">
                  <Cloud size={14} /> Ingestão HTTP POST (Webhook REST)
                </div>
                <p className="text-xs text-gray-400">
                  Para dispositivos que utilizam HTTP client simples ou gateways GSM/GPRS.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-gray-400 block text-[10px]">POST URL:</span>
                    <span className="text-cyan-400">{endpointHttp}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-gray-400 block text-[10px]">Header de Auth:</span>
                    <span className="text-gray-200">X-Device-Token: {authToken.substring(0, 16)}...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CONSOLE DE INGESTÃO AO VIVO */}
        {activeTab === 'telemetry-stream' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-base flex items-center gap-2 font-display">
                  <Terminal size={18} className="text-[#00ff88]" />
                  Console de Ingestão em Nuvem (Live Packet Feed)
                </h2>
                <p className="text-xs text-gray-400">
                  Logs brutos de pacotes de dados processados pelo pipeline de backend
                </p>
              </div>
              <button
                onClick={() => setLogs([])}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 text-xs rounded-xl font-mono"
              >
                Limpar Logs
              </button>
            </div>

            <div className="bg-[#050608] border border-white/10 rounded-2xl p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-gray-500 shrink-0">[{log.time}]</span>
                  <span className={
                    log.type === 'success' ? 'text-[#00ff88]' :
                    log.type === 'warn' ? 'text-amber-400' : 'text-gray-300'
                  }>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
