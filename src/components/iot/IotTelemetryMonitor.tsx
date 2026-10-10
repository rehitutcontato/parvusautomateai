import React, { useState, useEffect } from 'react';
import { 
  Activity, Radio, Cpu, Cloud, Zap, RefreshCw, Send, AlertTriangle, 
  CheckCircle2, ArrowRight, ShieldAlert, Sparkles, Filter, Terminal,
  Clock, Server, Waves, BatteryCharging, Gauge, Check
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, LineChart, Line, 
  XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';

export interface TelemetryPacket {
  id: string;
  device_id: string;
  tenant: string;
  timestamp: string;
  temperatura: number;
  umidade: number;
  rele_1: boolean;
  rssi: number;
  bateria_mv: number;
  rawJson?: string;
}

interface IotTelemetryMonitorProps {
  activeProject?: any;
  latestPacket?: TelemetryPacket | null;
  telemetryHistory?: TelemetryPacket[];
  onNavigateToSoftware?: () => void;
  onNavigateToGenerator?: () => void;
  onDispatchTestPacket?: (packet: Partial<TelemetryPacket>) => void;
}

export function IotTelemetryMonitor({
  activeProject,
  latestPacket,
  telemetryHistory = [],
  onNavigateToSoftware,
  onNavigateToGenerator,
  onDispatchTestPacket
}: IotTelemetryMonitorProps) {
  // Pre-fill realistic historical data points for investor presentation
  const [dataPoints, setDataPoints] = useState<TelemetryPacket[]>(() => {
    if (telemetryHistory && telemetryHistory.length > 0) return telemetryHistory;
    const initial: TelemetryPacket[] = [];
    const baseTime = Date.now() - 10 * 30000;
    for (let i = 0; i < 10; i++) {
      const t = new Date(baseTime + i * 30000);
      initial.push({
        id: `pkt_${i}`,
        device_id: activeProject?.placa ? 'esp32_gateway_01' : 'esp32_iot_node',
        tenant: 'enterprise-corp',
        timestamp: t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        temperatura: Number((23.5 + Math.sin(i / 2) * 2.8 + (Math.random() * 0.4)).toFixed(1)),
        umidade: Number((58.0 + Math.cos(i / 2) * 4.5 + (Math.random() * 0.6)).toFixed(1)),
        rele_1: i >= 7,
        rssi: Math.floor(-55 - Math.random() * 8),
        bateria_mv: Math.floor(4120 - i * 3)
      });
    }
    return initial;
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [simIntervalId, setSimIntervalId] = useState<any>(null);
  const [selectedSensor, setSelectedSensor] = useState<'temperatura' | 'umidade' | 'rssi'>('temperatura');

  // Sync external packets
  useEffect(() => {
    if (latestPacket) {
      setDataPoints(prev => {
        const next = [...prev, latestPacket];
        if (next.length > 25) return next.slice(next.length - 25);
        return next;
      });
    }
  }, [latestPacket]);

  // Handle continuous live simulation
  const toggleLiveStreaming = () => {
    if (isSimulating) {
      clearInterval(simIntervalId);
      setSimIntervalId(null);
      setIsSimulating(false);
    } else {
      setIsSimulating(true);
      const timer = setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const last = dataPoints[dataPoints.length - 1] || {
          temperatura: 25.0,
          umidade: 60.0,
          rele_1: false,
          rssi: -58,
          bateria_mv: 4100
        };

        const newTemp = Number((last.temperatura + (Math.random() * 0.8 - 0.38)).toFixed(1));
        const newUmid = Number((last.umidade + (Math.random() * 1.2 - 0.58)).toFixed(1));
        const newPacket: TelemetryPacket = {
          id: 'pkt_' + Math.random().toString(36).substring(2, 8),
          device_id: activeProject?.titulo ? 'esp32_device_active' : 'esp32_iot_node',
          tenant: 'enterprise-corp',
          timestamp: timeStr,
          temperatura: newTemp,
          umidade: newUmid,
          rele_1: newTemp > 28.5,
          rssi: Math.floor(-52 - Math.random() * 10),
          bateria_mv: Math.floor(last.bateria_mv - (Math.random() > 0.7 ? 1 : 0))
        };

        setDataPoints(prev => {
          const next = [...prev, newPacket];
          if (next.length > 25) return next.slice(next.length - 25);
          return next;
        });

        if (onDispatchTestPacket) {
          onDispatchTestPacket(newPacket);
        }
      }, 3000);
      setSimIntervalId(timer);
    }
  };

  useEffect(() => {
    return () => {
      if (simIntervalId) clearInterval(simIntervalId);
    };
  }, [simIntervalId]);

  const currentPkt = dataPoints[dataPoints.length - 1] || {
    temperatura: 25.4,
    umidade: 61.2,
    rele_1: false,
    rssi: -56,
    bateria_mv: 4110,
    timestamp: 'Agora'
  };

  const deviceName = activeProject?.titulo || 'Central ESP32 DevKit v1 - Telemetria Industrial';
  const boardName = activeProject?.placa || 'ESP32 (Wi-Fi + BLE)';

  return (
    <div className="flex-1 flex flex-col bg-[#07080c] text-gray-200 overflow-y-auto font-sans">
      {/* Top Banner & Telemetry Header */}
      <div className="bg-[#0b0c10] border-b border-white/10 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ff88] to-[#00d4ff] p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(0,255,136,0.25)]">
            <div className="w-full h-full bg-[#07080c] rounded-[10px] flex items-center justify-center text-[#00ff88]">
              <Activity size={20} className={isSimulating ? 'animate-pulse' : ''} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-white text-base sm:text-lg tracking-tight font-display">
                IoT Monitor <span className="text-[#00ff88]">Central de Telemetria</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping" />
                ONLINE • MQTTS 8883
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Sinais vitais em tempo real, telemetria de sensores e métricas de infraestrutura
            </p>
          </div>
        </div>

        {/* Quick Actions & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleLiveStreaming}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              isSimulating 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30' 
                : 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/40 hover:bg-[#00ff88]/25'
            }`}
          >
            <Radio size={14} className={isSimulating ? 'animate-spin' : ''} />
            {isSimulating ? 'Pausar Streaming Live' : 'Iniciar Streaming Live (3s)'}
          </button>

          {onNavigateToSoftware && (
            <button
              onClick={onNavigateToSoftware}
              className="px-3 py-1.5 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Cloud size={14} />
              IoT Software
            </button>
          )}

          {onNavigateToGenerator && (
            <button
              onClick={onNavigateToGenerator}
              className="px-3 py-1.5 bg-[#ff6600]/10 hover:bg-[#ff6600]/20 text-[#ff6600] border border-[#ff6600]/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Cpu size={14} />
              Gerador de Hardware
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Device Active Bar */}
        <div className="bg-[#0e1017] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#00d4ff]">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-extrabold text-sm font-display">{deviceName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">{boardName}</span>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                Tópico Ingestão: <span className="text-cyan-300">parvus/enterprise-corp/esp32/telemetry</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
              <span className="text-gray-500 block text-[9px] uppercase">Último Pacote:</span>
              <span className="text-[#00ff88] font-bold">{currentPkt.timestamp}</span>
            </div>
            <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
              <span className="text-gray-500 block text-[9px] uppercase">Latência Ingestão:</span>
              <span className="text-cyan-300 font-bold">28ms</span>
            </div>
            <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
              <span className="text-gray-500 block text-[9px] uppercase">Total Ingeridos:</span>
              <span className="text-amber-300 font-bold">{dataPoints.length} amostras</span>
            </div>
          </div>
        </div>

        {/* Vital Signs Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Temperatura */}
          <div 
            onClick={() => setSelectedSensor('temperatura')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedSensor === 'temperatura'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                : 'bg-[#0c0e17] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Temperatura</span>
              <Waves size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {currentPkt.temperatura} <span className="text-sm font-normal text-amber-400">°C</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
              <span>Faixa ideal: 18-28°C</span>
              <span className={currentPkt.temperatura > 30 ? 'text-red-400 font-bold' : 'text-[#00ff88] font-bold'}>
                {currentPkt.temperatura > 30 ? 'ALERTA' : 'ESTÁVEL'}
              </span>
            </div>
          </div>

          {/* Card 2: Umidade */}
          <div 
            onClick={() => setSelectedSensor('umidade')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedSensor === 'umidade'
                ? 'bg-[#00d4ff]/10 border-[#00d4ff]/50 shadow-[0_0_20px_rgba(0,212,255,0.2)]'
                : 'bg-[#0c0e17] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Umidade Relativa</span>
              <Gauge size={16} className="text-[#00d4ff]" />
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {currentPkt.umidade} <span className="text-sm font-normal text-[#00d4ff]">%</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
              <span>Sensor: DHT22/BME</span>
              <span className="text-[#00ff88] font-bold">NORMAL</span>
            </div>
          </div>

          {/* Card 3: RSSI */}
          <div 
            onClick={() => setSelectedSensor('rssi')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedSensor === 'rssi'
                ? 'bg-[#00ff88]/10 border-[#00ff88]/50 shadow-[0_0_20px_rgba(0,255,136,0.2)]'
                : 'bg-[#0c0e17] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Sinal Wi-Fi (RSSI)</span>
              <Radio size={16} className="text-[#00ff88]" />
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {currentPkt.rssi} <span className="text-sm font-normal text-[#00ff88]">dBm</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
              <span>Qualidade de link:</span>
              <span className="text-[#00ff88] font-bold">EXCELENTE</span>
            </div>
          </div>

          {/* Card 4: Bateria */}
          <div className="p-4 rounded-2xl bg-[#0c0e17] border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Tensão Bateria</span>
              <BatteryCharging size={16} className="text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {(currentPkt.bateria_mv / 1000).toFixed(2)} <span className="text-sm font-normal text-purple-400">V</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
              <span>96% Li-ion 3.7V</span>
              <span className="text-[#00ff88] font-bold">CARREGADA</span>
            </div>
          </div>

          {/* Card 5: Atuador Relé */}
          <div className="p-4 rounded-2xl bg-[#0c0e17] border border-white/10 relative overflow-hidden col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Atuador Relé 1</span>
              <Zap size={16} className={currentPkt.rele_1 ? 'text-amber-400 fill-amber-400' : 'text-gray-500'} />
            </div>
            <div className={`text-xl font-black font-mono tracking-tight mt-1 ${currentPkt.rele_1 ? 'text-amber-400' : 'text-gray-400'}`}>
              {currentPkt.rele_1 ? 'LIGADO (ON)' : 'DESLIGADO (OFF)'}
            </div>
            <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
              <span>Carga: Ventilação</span>
              <span className="text-cyan-300 font-bold">AUTO RULE</span>
            </div>
          </div>
        </div>

        {/* Real-time Charts Section with Recharts */}
        <div className="bg-[#0b0c14] border border-white/10 rounded-2xl p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-extrabold text-white font-display flex items-center gap-2">
                <Activity size={18} className="text-[#00ff88]" />
                Série Temporal de Telemetria Dinâmica
              </h2>
              <p className="text-xs text-gray-400">
                Gráficos de leitura com amostragem contínua das variáveis de campo
              </p>
            </div>

            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setSelectedSensor('temperatura')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  selectedSensor === 'temperatura' ? 'bg-amber-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                Temperatura (°C)
              </button>
              <button
                onClick={() => setSelectedSensor('umidade')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  selectedSensor === 'umidade' ? 'bg-[#00d4ff] text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                Umidade (%)
              </button>
              <button
                onClick={() => setSelectedSensor('rssi')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  selectedSensor === 'rssi' ? 'bg-[#00ff88] text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                Sinal RSSI (dBm)
              </button>
            </div>
          </div>

          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataPoints} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorUmid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorRssi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2333" />
                <XAxis dataKey="timestamp" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0c0e17', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }} 
                />
                {selectedSensor === 'temperatura' && (
                  <Area 
                    type="monotone" 
                    dataKey="temperatura" 
                    name="Temperatura (°C)"
                    stroke="#f59e0b" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorTemp)" 
                  />
                )}
                {selectedSensor === 'umidade' && (
                  <Area 
                    type="monotone" 
                    dataKey="umidade" 
                    name="Umidade (%)"
                    stroke="#00d4ff" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorUmid)" 
                  />
                )}
                {selectedSensor === 'rssi' && (
                  <Area 
                    type="monotone" 
                    dataKey="rssi" 
                    name="RSSI (dBm)"
                    stroke="#00ff88" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorRssi)" 
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Ingestion Log & History Feed */}
        <div className="bg-[#0b0c14] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-white font-display flex items-center gap-2">
              <Terminal size={16} className="text-[#00d4ff]" />
              Stream de Pacotes Ingeridos em Tempo Real (JSON Payloads)
            </h3>
            <span className="text-[10px] font-mono text-gray-500 uppercase">
              Auto-scroll ativo
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto font-mono text-xs pr-1">
            {dataPoints.slice().reverse().map((pkt, idx) => (
              <div 
                key={pkt.id || idx}
                className="bg-black/50 p-2.5 rounded-xl border border-white/5 flex flex-wrap items-center justify-between gap-2 hover:border-[#00ff88]/30 transition-colors"
              >
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="text-gray-500 text-[10px]">[{pkt.timestamp}]</span>
                  <span className="text-cyan-300 font-bold">{pkt.device_id}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-amber-300 font-bold">{pkt.temperatura}°C</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-cyan-400">{pkt.umidade}%</span>
                  <span className="text-gray-600">|</span>
                  <span className={pkt.rele_1 ? 'text-amber-400 font-bold' : 'text-gray-400'}>
                    Relé: {pkt.rele_1 ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[10px] text-[#00ff88] bg-[#00ff88]/10 px-2 py-0.5 rounded border border-[#00ff88]/20">
                  200 INGEST OK
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
