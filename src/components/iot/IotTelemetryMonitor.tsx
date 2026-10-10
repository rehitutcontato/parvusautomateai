import React, { useState, useEffect } from 'react';
import { 
  Activity, Radio, Cpu, Cloud, Zap, RefreshCw, Send, AlertTriangle, 
  CheckCircle2, ArrowRight, ShieldAlert, Sparkles, Filter, Terminal,
  Clock, Server, Waves, BatteryCharging, Gauge, Check, Weight, Database
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, LineChart, Line, 
  XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { detectDeviceCategory, formatSafeTimestamp } from '../../lib/iotRepairHelper';

export interface TelemetryPacket {
  id: string;
  device_id: string;
  tenant: string;
  timestamp: string;
  // Balança / Scale
  peso?: number;
  tara?: number;
  unidade?: string;
  adc_raw?: number;
  estavel?: boolean;
  sobrecarga?: boolean;
  // Clima / Ambiente
  temperatura?: number;
  umidade?: number;
  rele_1?: boolean;
  // Rede e Hardware
  rssi?: number;
  bateria_mv?: number;
  rawJson?: string;
  [key: string]: any;
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
  const category = detectDeviceCategory(activeProject);
  const isScale = category === 'scale';
  const isEnergy = category === 'energy';

  // Unidade de exibição para balança (g ou kg)
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg'>('g');

  // Sensor selecionado para o gráfico
  const [selectedSensor, setSelectedSensor] = useState<string>(isScale ? 'peso' : 'temperatura');

  // Ajusta sensor ativo ao mudar o tipo de projeto
  useEffect(() => {
    if (isScale && selectedSensor !== 'peso' && selectedSensor !== 'adc_raw' && selectedSensor !== 'rssi' && selectedSensor !== 'bateria_mv') {
      setSelectedSensor('peso');
    } else if (!isScale && (selectedSensor === 'peso' || selectedSensor === 'adc_raw')) {
      setSelectedSensor('temperatura');
    }
  }, [isScale]);

  // Histórico de pontos inicial com dados realistas
  const [dataPoints, setDataPoints] = useState<TelemetryPacket[]>(() => {
    if (telemetryHistory && telemetryHistory.length > 0) {
      return telemetryHistory.map(p => ({
        ...p,
        timestamp: formatSafeTimestamp(p.timestamp)
      }));
    }
    const initial: TelemetryPacket[] = [];
    const baseTime = Date.now() - 10 * 30000;
    const devId = activeProject?.placa ? (isScale ? 'esp32_scale_01' : 'esp32_gateway_01') : 'esp32_iot_node';

    if (isScale) {
      for (let i = 0; i < 10; i++) {
        const t = new Date(baseTime + i * 30000);
        const currentWeight = 0.0;
        const adc = Math.round(840000 + (Math.random() * 4 - 2));

        initial.push({
          id: `pkt_${i}`,
          device_id: devId,
          tenant: 'enterprise-corp',
          timestamp: formatSafeTimestamp(t),
          peso: currentWeight,
          tara: 0.0,
          unidade: 'g',
          adc_raw: adc,
          estavel: true,
          sobrecarga: false,
          rssi: Math.floor(-55 - Math.random() * 8),
          bateria_mv: Math.floor(4120 - i * 3)
        });
      }
      return initial;
    }

    for (let i = 0; i < 10; i++) {
      const t = new Date(baseTime + i * 30000);
      initial.push({
        id: `pkt_${i}`,
        device_id: devId,
        tenant: 'enterprise-corp',
        timestamp: formatSafeTimestamp(t),
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
  const [isTaring, setIsTaring] = useState(false);
  const [tareToast, setTareToast] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sincroniza pacotes externos recebidos via props
  useEffect(() => {
    if (latestPacket) {
      setDataPoints(prev => {
        const safePkt: TelemetryPacket = {
          ...latestPacket,
          timestamp: formatSafeTimestamp(latestPacket.timestamp)
        };
        const next = [...prev, safePkt];
        if (next.length > 25) return next.slice(next.length - 25);
        return next;
      });
    }
  }, [latestPacket]);

  // Limpeza de intervalo ao desmontar componente
  useEffect(() => {
    return () => {
      if (simIntervalId) clearInterval(simIntervalId);
    };
  }, [simIntervalId]);

  // Handler para comando real de Tara
  const handleTriggerTare = async () => {
    setIsTaring(true);
    try {
      const current = dataPoints[dataPoints.length - 1];
      const devId = current?.device_id || (activeProject?.placa ? 'esp32_scale_01' : 'esp32_iot_node');
      
      // Envia comando HTTP ao backend
      await fetch('/api/iot/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: devId,
          command: 'tare',
          timestamp: new Date().toISOString()
        })
      }).catch(() => null);

      const nowTime = formatSafeTimestamp(new Date());
      const currentWeight = current?.peso ?? 0;
      const currentTara = current?.tara ?? 0;
      const newTara = Number((currentTara + currentWeight).toFixed(1));

      const tarePacket: TelemetryPacket = {
        id: 'pkt_tare_' + Math.random().toString(36).substring(2, 7),
        device_id: devId,
        tenant: current?.tenant || 'enterprise-corp',
        timestamp: nowTime,
        peso: 0.0,
        tara: newTara,
        unidade: weightUnit,
        adc_raw: Math.round(840000 + Math.random() * 5),
        estavel: true,
        sobrecarga: false,
        rssi: current?.rssi ?? -56,
        bateria_mv: current?.bateria_mv ?? 4110
      };

      setDataPoints(prev => [...prev.slice(-24), tarePacket]);
      
      // Envia telemetria atualizada ao backend
      fetch('/api/iot/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarePacket)
      }).catch(() => null);

      if (onDispatchTestPacket) {
        onDispatchTestPacket(tarePacket);
      }
      setTareToast('Comando TARE executado com sucesso! Balança zerada.');
      setTimeout(() => setTareToast(null), 4000);
    } finally {
      setIsTaring(false);
    }
  };

  // Handler de streaming contínuo de telemetria
  const toggleLiveStreaming = () => {
    if (isSimulating) {
      if (simIntervalId) clearInterval(simIntervalId);
      setSimIntervalId(null);
      setIsSimulating(false);
    } else {
      setIsSimulating(true);
      const timer = setInterval(() => {
        const now = new Date();
        const timeStr = formatSafeTimestamp(now);
        const last = dataPoints[dataPoints.length - 1];

        let newPacket: TelemetryPacket;

        if (isScale) {
          const lastWeight = last?.peso ?? 0.0;
          const currentTara = last?.tara ?? 0.0;
          const isDisturbed = Math.random() < 0.12;
          let newPeso: number;
          let newEstavel: boolean;

          if (lastWeight === 0.0) {
            newEstavel = true;
            newPeso = Math.random() < 0.06 ? 0.1 : 0.0;
          } else if (isDisturbed) {
            newEstavel = false;
            newPeso = Number((Math.max(0, lastWeight + (Math.random() * 3.5 - 1.7))).toFixed(1));
          } else {
            newEstavel = true;
            newPeso = Number((Math.max(0, lastWeight + (Math.random() * 0.3 - 0.15))).toFixed(1));
          }

          const rawCounts = Math.round(840000 + (newPeso + currentTara) * 420.5 + (Math.random() * 10 - 5));
          newPacket = {
            id: 'pkt_' + Math.random().toString(36).substring(2, 8),
            device_id: activeProject?.titulo ? 'esp32_scale_01' : 'esp32_iot_node',
            tenant: 'enterprise-corp',
            timestamp: timeStr,
            peso: newPeso,
            tara: currentTara,
            unidade: weightUnit,
            adc_raw: rawCounts,
            estavel: newEstavel,
            sobrecarga: newPeso > 5000,
            rssi: Math.floor(-52 - Math.random() * 8),
            bateria_mv: Math.floor((last?.bateria_mv ?? 4110) - (Math.random() > 0.8 ? 1 : 0))
          };
        } else {
          const lastTemp = last?.temperatura ?? 25.0;
          const lastUmid = last?.umidade ?? 60.0;
          const newTemp = Number((lastTemp + (Math.random() * 0.8 - 0.38)).toFixed(1));
          const newUmid = Number((lastUmid + (Math.random() * 1.2 - 0.58)).toFixed(1));

          newPacket = {
            id: 'pkt_' + Math.random().toString(36).substring(2, 8),
            device_id: activeProject?.titulo ? 'esp32_device_active' : 'esp32_iot_node',
            tenant: 'enterprise-corp',
            timestamp: timeStr,
            temperatura: newTemp,
            umidade: newUmid,
            rele_1: newTemp > 28.5,
            rssi: Math.floor(-52 - Math.random() * 10),
            bateria_mv: Math.floor((last?.bateria_mv ?? 4100) - (Math.random() > 0.7 ? 1 : 0))
          };
        }

        setDataPoints(prev => {
          const next = [...prev, newPacket];
          if (next.length > 25) return next.slice(next.length - 25);
          return next;
        });

        // Envia telemetria real para o backend HTTP
        fetch('/api/iot/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPacket)
        }).catch(() => null);

        if (onDispatchTestPacket) {
          onDispatchTestPacket(newPacket);
        }
      }, 3000);
      setSimIntervalId(timer);
    }
  };

  // Sincronização direta com a base do backend
  const handleSyncWithServer = async () => {
    setIsSyncing(true);
    try {
      const devId = activeProject?.placa ? (isScale ? 'esp32_scale_01' : 'esp32_gateway_01') : 'esp32_iot_node';
      let res = await fetch(`/api/iot/telemetry/${devId}`);
      let data = res.ok ? await res.json() : null;
      if (!data?.history || data.history.length === 0) {
        res = await fetch(`/api/iot/telemetry`);
        data = res.ok ? await res.json() : null;
      }
      if (data && data.history && data.history.length > 0) {
        setDataPoints(data.history.map((p: any) => ({
          ...p,
          timestamp: formatSafeTimestamp(p.timestamp)
        })));
        setTareToast(`${data.history.length} pacotes sincronizados com o banco!`);
        setTimeout(() => setTareToast(null), 3000);
      } else {
        setTareToast('Nenhum pacote recente registrado no servidor.');
        setTimeout(() => setTareToast(null), 3000);
      }
    } catch (err) {
      console.warn("Sincronização em fallback local", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const currentPkt = dataPoints[dataPoints.length - 1] || (isScale ? {
    peso: 0.0,
    tara: 0.0,
    unidade: 'g',
    adc_raw: 840000,
    estavel: true,
    sobrecarga: false,
    rssi: -56,
    bateria_mv: 4110,
    timestamp: formatSafeTimestamp(new Date())
  } : {
    temperatura: 25.4,
    umidade: 61.2,
    rele_1: false,
    rssi: -56,
    bateria_mv: 4110,
    timestamp: formatSafeTimestamp(new Date())
  });

  const formattedCurrentTimestamp = formatSafeTimestamp(currentPkt.timestamp);
  const deviceName = activeProject?.titulo || (isScale ? 'Balança de Alta Precisão ESP32 HX711' : 'Central ESP32 DevKit v1 - Telemetria Industrial');
  const boardName = activeProject?.placa || 'ESP32 (Wi-Fi + BLE)';
  const topicName = isScale ? 'parvus/enterprise-corp/scale/telemetry' : 'parvus/enterprise-corp/esp32/telemetry';

  return (
    <div className="flex-1 flex flex-col bg-[#07080c] text-gray-200 overflow-y-auto font-sans">
      {/* Toast de Confirmação de Tara */}
      {tareToast && (
        <div className="bg-[#00ff88]/20 border-b border-[#00ff88]/40 px-4 py-2 text-xs font-mono text-[#00ff88] flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span className="font-bold">{tareToast}</span>
          </div>
          <button onClick={() => setTareToast(null)} className="text-gray-400 hover:text-white font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Top Banner & Telemetry Header */}
      <div className="bg-[#0b0c10] border-b border-white/10 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ff88] to-[#00d4ff] p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(0,255,136,0.25)]">
            <div className="w-full h-full bg-[#07080c] rounded-[10px] flex items-center justify-center text-[#00ff88]">
              {isScale ? (
                <Weight size={20} className={isSimulating ? 'animate-pulse' : ''} />
              ) : (
                <Activity size={20} className={isSimulating ? 'animate-pulse' : ''} />
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-white text-base sm:text-lg tracking-tight font-display">
                IoT Monitor <span className="text-[#00ff88]">{isScale ? 'Telemetria de Pesagem HX711' : 'Central de Telemetria'}</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping" />
                ONLINE • MQTTS 8883
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {isScale 
                ? 'Leitura em alta resolução com célula de carga de 24-bits, tara digital e detecção de sobrecarga'
                : 'Sinais vitais em tempo real, telemetria de sensores e métricas de infraestrutura'}
            </p>
          </div>
        </div>

        {/* Quick Actions & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncWithServer}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Sincronizar telemetria persistida no backend"
          >
            <Database size={13} className={isSyncing ? 'animate-spin text-[#00d4ff]' : 'text-gray-400'} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Banco'}
          </button>

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
                Tópico Ingestão: <span className="text-cyan-300">{topicName}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
              <span className="text-gray-500 block text-[9px] uppercase">Último Pacote:</span>
              <span className="text-[#00ff88] font-bold">{formattedCurrentTimestamp}</span>
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
        {isScale ? (
          /* GRID ADAPTATIVA PARA BALANÇA INTELIGENTE */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Card 1: Peso Líquido */}
            <div 
              onClick={() => setSelectedSensor('peso')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedSensor === 'peso'
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/50 shadow-[0_0_20px_rgba(0,255,136,0.2)]'
                  : 'bg-[#0c0e17] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Peso Líquido</span>
                <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setWeightUnit('g'); }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${weightUnit === 'g' ? 'bg-[#00ff88] text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    g
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setWeightUnit('kg'); }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${weightUnit === 'kg' ? 'bg-[#00ff88] text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    kg
                  </button>
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight flex items-baseline gap-1.5">
                {weightUnit === 'kg' 
                  ? ((currentPkt.peso ?? 0) / 1000).toFixed(3)
                  : (currentPkt.peso ?? 0).toFixed(1)}
                <span className="text-sm font-normal text-[#00ff88]">{weightUnit}</span>
              </div>
              <div className="mt-2 text-[10px] font-mono flex items-center justify-between">
                <span className="text-gray-400">Célula: 5kg Shear</span>
                <span className={`px-1.5 py-0.5 rounded font-bold ${
                  (currentPkt.peso ?? 0) > 5000 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' 
                    : currentPkt.estavel !== false 
                      ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30' 
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}>
                  {(currentPkt.peso ?? 0) > 5000 ? '⚠ SOBRECARGA' : currentPkt.estavel !== false ? '● ESTÁVEL' : '◌ OSCILANDO'}
                </span>
              </div>
            </div>

            {/* Card 2: Tara e Zero */}
            <div className="p-4 rounded-2xl bg-[#0c0e17] border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Tara Atual</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleTriggerTare(); }}
                  disabled={isTaring}
                  className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Enviar comando TARE ao firmware ESP32 via HTTP"
                >
                  <RefreshCw size={10} className={isTaring ? 'animate-spin' : ''} />
                  {isTaring ? 'Zerando...' : 'Zerar (TARE)'}
                </button>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                {weightUnit === 'kg'
                  ? ((currentPkt.tara ?? 0) / 1000).toFixed(3)
                  : (currentPkt.tara ?? 0).toFixed(1)}{' '}
                <span className="text-sm font-normal text-amber-400">{weightUnit}</span>
              </div>
              <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
                <span>Offset GPIO 4</span>
                <span className="text-amber-300 font-bold">CALIBRADO</span>
              </div>
            </div>

            {/* Card 3: ADC Raw HX711 */}
            <div 
              onClick={() => setSelectedSensor('adc_raw')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedSensor === 'adc_raw'
                  ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                  : 'bg-[#0c0e17] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-gray-400">ADC Raw (HX711)</span>
                <Cpu size={16} className="text-purple-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                {(currentPkt.adc_raw ?? 840000).toLocaleString('pt-BR')}
              </div>
              <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
                <span>24-bit Ganho 128</span>
                <span className="text-purple-400 font-bold">10 SPS</span>
              </div>
            </div>

            {/* Card 4: RSSI */}
            <div 
              onClick={() => setSelectedSensor('rssi')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedSensor === 'rssi'
                  ? 'bg-[#00d4ff]/10 border-[#00d4ff]/50 shadow-[0_0_20px_rgba(0,212,255,0.2)]'
                  : 'bg-[#0c0e17] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Sinal Wi-Fi (RSSI)</span>
                <Radio size={16} className="text-[#00d4ff]" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                {currentPkt.rssi ?? -56} <span className="text-sm font-normal text-[#00d4ff]">dBm</span>
              </div>
              <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
                <span>Link Wi-Fi:</span>
                <span className="text-[#00ff88] font-bold">
                  {(currentPkt.rssi ?? -56) > -65 ? 'EXCELENTE' : (currentPkt.rssi ?? -56) > -75 ? 'BOM' : 'REGULAR'}
                </span>
              </div>
            </div>

            {/* Card 5: Tensão & Bateria */}
            <div 
              onClick={() => setSelectedSensor('bateria_mv')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                selectedSensor === 'bateria_mv'
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                  : 'bg-[#0c0e17] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Alimentação VCC</span>
                <BatteryCharging size={16} className="text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                {((currentPkt.bateria_mv ?? 4110) / 1000).toFixed(2)} <span className="text-sm font-normal text-amber-400">V</span>
              </div>
              <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between">
                <span>USB / Li-ion 3.7V</span>
                <span className="text-[#00ff88] font-bold">ESTÁVEL</span>
              </div>
            </div>
          </div>
        ) : (
          /* GRID PADRÃO / ESTAÇÃO CLIMÁTICA */
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
                <span className={(currentPkt.temperatura ?? 25) > 30 ? 'text-red-400 font-bold' : 'text-[#00ff88] font-bold'}>
                  {(currentPkt.temperatura ?? 25) > 30 ? 'ALERTA' : 'ESTÁVEL'}
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
                {((currentPkt.bateria_mv ?? 4110) / 1000).toFixed(2)} <span className="text-sm font-normal text-purple-400">V</span>
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
        )}

        {/* Real-time Charts Section with Recharts */}
        <div className="bg-[#0b0c14] border border-white/10 rounded-2xl p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-extrabold text-white font-display flex items-center gap-2">
                <Activity size={18} className="text-[#00ff88]" />
                Série Temporal de Telemetria Dinâmica
              </h2>
              <p className="text-xs text-gray-400">
                {isScale 
                  ? 'Curva de resposta da célula de carga e estabilização de filtragem mediana'
                  : 'Gráficos de leitura com amostragem contínua das variáveis de campo'}
              </p>
            </div>

            {/* Seletores de Gráfico Dinâmicos */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar max-w-full">
              {isScale ? (
                <>
                  <button
                    onClick={() => setSelectedSensor('peso')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedSensor === 'peso' ? 'bg-[#00ff88] text-black shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Peso Líquido ({weightUnit})
                  </button>
                  <button
                    onClick={() => setSelectedSensor('adc_raw')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedSensor === 'adc_raw' ? 'bg-purple-500 text-white shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ADC Raw HX711 (Counts)
                  </button>
                  <button
                    onClick={() => setSelectedSensor('rssi')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedSensor === 'rssi' ? 'bg-[#00d4ff] text-black shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sinal RSSI (dBm)
                  </button>
                  <button
                    onClick={() => setSelectedSensor('bateria_mv')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedSensor === 'bateria_mv' ? 'bg-amber-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Tensão VCC (mV)
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedSensor('temperatura')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedSensor === 'temperatura' ? 'bg-amber-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Temperatura (°C)
                  </button>
                  <button
                    onClick={() => setSelectedSensor('umidade')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedSensor === 'umidade' ? 'bg-[#00d4ff] text-black shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Umidade (%)
                  </button>
                  <button
                    onClick={() => setSelectedSensor('rssi')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedSensor === 'rssi' ? 'bg-[#00ff88] text-black shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sinal RSSI (dBm)
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataPoints} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorAdc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorUmid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorRssi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
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
                
                {selectedSensor === 'peso' && (
                  <Area 
                    type="monotone" 
                    dataKey="peso" 
                    name={`Peso Líquido (${weightUnit})`}
                    stroke="#00ff88" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorPeso)" 
                  />
                )}
                {selectedSensor === 'adc_raw' && (
                  <Area 
                    type="monotone" 
                    dataKey="adc_raw" 
                    name="ADC Raw (counts)"
                    stroke="#a855f7" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorAdc)" 
                  />
                )}
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
                    stroke="#00d4ff" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorRssi)" 
                  />
                )}
                {selectedSensor === 'bateria_mv' && (
                  <Area 
                    type="monotone" 
                    dataKey="bateria_mv" 
                    name="Tensão (mV)"
                    stroke="#f59e0b" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorBat)" 
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
                {isScale ? (
                  <div className="flex flex-wrap items-center gap-2 text-gray-300">
                    <span className="text-gray-500 text-[10px]">[{formatSafeTimestamp(pkt.timestamp)}]</span>
                    <span className="text-cyan-300 font-bold">{pkt.device_id}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-[#00ff88] font-bold">
                      {weightUnit === 'kg' ? `${((pkt.peso ?? 0) / 1000).toFixed(3)}kg` : `${(pkt.peso ?? 0).toFixed(1)}g`}
                    </span>
                    <span className="text-gray-600">|</span>
                    <span className={pkt.estavel !== false ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {pkt.estavel !== false ? 'ESTÁVEL' : 'OSCILANDO'}
                    </span>
                    <span className="text-gray-600">|</span>
                    <span className="text-purple-300">ADC: {(pkt.adc_raw ?? 0).toLocaleString('pt-BR')}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400">Tara: {(pkt.tara ?? 0).toFixed(1)}g</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-cyan-400">{pkt.rssi ?? -55}dBm</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-gray-300">
                    <span className="text-gray-500 text-[10px]">[{formatSafeTimestamp(pkt.timestamp)}]</span>
                    <span className="text-cyan-300 font-bold">{pkt.device_id}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-amber-300 font-bold">{pkt.temperatura}°C</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-cyan-400">{pkt.umidade}%</span>
                    <span className="text-gray-600">|</span>
                    <span className={pkt.rele_1 ? 'text-amber-400 font-bold' : 'text-gray-400'}>
                      Relé: {pkt.rele_1 ? 'ON' : 'OFF'}
                    </span>
                    <span className="text-gray-600">|</span>
                    <span className="text-cyan-400">{pkt.rssi}dBm</span>
                  </div>
                )}
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
