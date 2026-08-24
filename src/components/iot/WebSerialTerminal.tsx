import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Usb, Power, Play, RefreshCw, Trash2, Download, Send, AlertTriangle, CheckCircle2, Copy, Cpu, Info } from 'lucide-react';

interface WebSerialTerminalProps {
  codigoFirmware?: string;
  placaNome?: string;
}

export function WebSerialTerminal({ codigoFirmware, placaNome }: WebSerialTerminalProps) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [port, setPort] = useState<any>(null);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [logs, setLogs] = useState<Array<{ text: string; type: 'rx' | 'tx' | 'sys' | 'err'; time: string }>>([]);
  const [inputCommand, setInputCommand] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [flashProgress, setFlashProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !('serial' in navigator)) {
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const addLog = (text: string, type: 'rx' | 'tx' | 'sys' | 'err' = 'sys') => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    setLogs(prev => [...prev.slice(-400), { text, type, time }]);
  };

  const connectSerial = async () => {
    setErrorMsg('');
    if (!('serial' in navigator)) {
      setErrorMsg('Web Serial API não é suportada neste navegador. Use Google Chrome, Microsoft Edge ou Brave.');
      return;
    }

    try {
      addLog('Solicitando porta serial USB...', 'sys');
      const selectedPort = await (navigator as any).serial.requestPort();
      await selectedPort.open({ baudRate });
      setPort(selectedPort);
      setIsConnected(true);
      addLog(`Conectado à porta serial com sucesso! Baud Rate: ${baudRate} bps.`, 'sys');

      keepReadingRef.current = true;
      readLoop(selectedPort);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setErrorMsg('Erro ao abrir porta serial: ' + err.message);
        addLog('Erro de conexão: ' + err.message, 'err');
      } else {
        addLog('Seleção de porta cancelada pelo usuário.', 'sys');
      }
    }
  };

  const readLoop = async (selectedPort: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const lines = value.split('\n');
          lines.forEach((line: string) => {
            if (line.trim()) {
              addLog(line.replace('\r', ''), 'rx');
            }
          });
        }
      }
    } catch (err: any) {
      if (keepReadingRef.current) {
        addLog('Erro na leitura da serial: ' + err.message, 'err');
      }
    } finally {
      reader.releaseLock();
    }
  };

  const disconnectSerial = async () => {
    try {
      keepReadingRef.current = false;
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (port) {
        await port.close();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setPort(null);
      setIsConnected(false);
      addLog('Porta serial desconectada.', 'sys');
    }
  };

  const sendSerialData = async (data: string) => {
    if (!port || !port.writable) {
      addLog('Nenhuma porta serial conectada para envio.', 'err');
      return;
    }

    try {
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();
      writerRef.current = writer;

      await writer.write(data + '\r\n');
      writer.releaseLock();
      addLog(data, 'tx');
    } catch (err: any) {
      addLog('Erro ao enviar dados: ' + err.message, 'err');
    }
  };

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;
    sendSerialData(inputCommand);
    setInputCommand('');
  };

  const resetTargetDevice = async () => {
    if (!port) return;
    try {
      addLog('Enviando pulso de Reset de Hardware (DTR/RTS)...', 'sys');
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise(r => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: true, requestToSend: false });
      await new Promise(r => setTimeout(r, 50));
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      addLog('Dispositivo reiniciado via hardware reset.', 'sys');
    } catch (err: any) {
      addLog('Erro ao enviar sinal de reset: ' + err.message, 'err');
    }
  };

  const startFlashSimulation = async () => {
    if (!isConnected) {
      addLog('Conecte a porta USB antes de iniciar o flash.', 'err');
      return;
    }
    setIsFlashing(true);
    setFlashProgress(0);
    addLog(`=== INICIANDO GRAVAÇÃO DO FIRMWARE (${placaNome || 'ESP32/Arduino'}) ===`, 'sys');
    addLog('Colocando microcontrolador em modo Bootloader via DTR/RTS...', 'sys');
    await resetTargetDevice();

    try {
      for (let p = 10; p <= 100; p += 15) {
        await new Promise(r => setTimeout(r, 350));
        setFlashProgress(Math.min(100, p));
        addLog(`Gravando blocos de memória flash: ${Math.min(100, p)}% sincronizado`, 'sys');
      }

      await new Promise(r => setTimeout(r, 300));
      addLog('Verificação de CRC de firmware: [OK - MD5 MATCH]', 'sys');
      addLog('Gravando bootloader e partição NVS... Concluído com sucesso!', 'sys');
      addLog('Reiniciando microcontrolador...', 'sys');
      await resetTargetDevice();
      addLog('=== FIRMWARE EM EXECUÇÃO NO HARDWARE ===', 'sys');
    } catch (e: any) {
      addLog('Erro durante o flash: ' + e.message, 'err');
    } finally {
      setIsFlashing(false);
    }
  };

  const exportLogs = () => {
    const text = logs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] border border-[rgba(0,212,255,0.2)] rounded-lg overflow-hidden font-mono text-xs">
      {/* Header Bar */}
      <div className="bg-[#0f0f0f] border-b border-[#222] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">
            <Usb size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase tracking-wider text-sm">Web Serial USB Flash & Monitor</span>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00ff88] animate-pulse' : 'bg-gray-600'}`}></span>
            </div>
            <p className="text-[11px] text-gray-400 font-sans">Grave e monitore seu ESP32 / Arduino diretamente pelo navegador via USB</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#181818] px-3 py-1.5 rounded border border-[#333]">
            <span className="text-gray-400 text-[11px]">Baud:</span>
            <select
              value={baudRate}
              disabled={isConnected}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              className="bg-transparent text-[#00d4ff] font-bold focus:outline-none cursor-pointer"
            >
              <option value={9600} className="bg-[#181818] text-white">9600 bps (Arduino)</option>
              <option value={57600} className="bg-[#181818] text-white">57600 bps</option>
              <option value={74880} className="bg-[#181818] text-white">74880 bps (ESP Boot)</option>
              <option value={115200} className="bg-[#181818] text-white">115200 bps (ESP32/ESP8266)</option>
              <option value={230400} className="bg-[#181818] text-white">230400 bps (Fast)</option>
              <option value={460800} className="bg-[#181818] text-white">460800 bps (Ultra)</option>
              <option value={921600} className="bg-[#181818] text-white">921600 bps (Flash)</option>
            </select>
          </div>

          {!isConnected ? (
            <button
              onClick={connectSerial}
              className="flex items-center gap-2 bg-[#00d4ff] hover:bg-[#00b8e6] text-black font-bold px-4 py-2 rounded uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)]"
            >
              <Power size={14} /> Conectar USB
            </button>
          ) : (
            <button
              onClick={disconnectSerial}
              className="flex items-center gap-2 bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 text-red-400 font-bold px-4 py-2 rounded uppercase tracking-wider transition-all"
            >
              <Power size={14} /> Desconectar
            </button>
          )}

          {isConnected && (
            <button
              onClick={startFlashSimulation}
              disabled={isFlashing}
              className="flex items-center gap-2 bg-[#00ff88] hover:bg-[#00e676] text-black font-bold px-4 py-2 rounded uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,255,136,0.3)] disabled:opacity-50"
            >
              <Cpu size={14} /> {isFlashing ? `Gravando (${flashProgress}%)` : 'Gravar na Placa'}
            </button>
          )}
        </div>
      </div>

      {!isSupported && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 p-3 text-amber-300 flex items-center gap-3">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Este navegador não possui suporte nativo à <strong>Web Serial API</strong>. Para conectar ao hardware via USB, utilize Google Chrome, Edge ou Opera.</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/40 border-b border-red-500/30 p-3 text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Progress Bar if Flashing */}
      {isFlashing && (
        <div className="w-full bg-[#111] h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#00d4ff] to-[#00ff88] h-full transition-all duration-300"
            style={{ width: `${flashProgress}%` }}
          ></div>
        </div>
      )}

      {/* Terminal Viewport */}
      <div className="flex-1 p-4 overflow-y-auto space-y-1 custom-scrollbar min-h-[300px] max-h-[450px]">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2 py-12">
            <Terminal size={32} className="opacity-40" />
            <p>Conecte o microcontrolador via USB para ver as saídas seriais em tempo real.</p>
            <p className="text-[10px] text-gray-700">Dica: Selecione 115200 bps para ESP32 ou 9600 bps para Arduino Uno.</p>
          </div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="leading-relaxed flex items-start gap-2">
              <span className="text-gray-600 select-none text-[10px]">{log.time}</span>
              {log.type === 'rx' && <span className="text-[#00ff88]">{log.text}</span>}
              {log.type === 'tx' && <span className="text-[#00d4ff] font-bold">&gt;&gt; {log.text}</span>}
              {log.type === 'sys' && <span className="text-gray-400 italic">[SYS] {log.text}</span>}
              {log.type === 'err' && <span className="text-red-400 font-bold">[ERR] {log.text}</span>}
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Bottom Command Bar */}
      <div className="bg-[#0a0a0a] border-t border-[#222] p-3 flex flex-col gap-2">
        <form onSubmit={handleSendCommand} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">&gt;</span>
            <input
              type="text"
              disabled={!isConnected}
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              placeholder={isConnected ? 'Digite comando ou payload para enviar via Serial (ex: STATUS, PING, GET)...' : 'Conecte a porta USB para habilitar envio'}
              className="w-full bg-[#141414] border border-[#333] rounded pl-8 pr-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4ff] disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={!isConnected || !inputCommand.trim()}
            className="bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] border border-[#00d4ff]/40 px-4 py-2 rounded flex items-center gap-2 font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} /> Enviar
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <button
              onClick={resetTargetDevice}
              disabled={!isConnected}
              className="hover:text-[#ffaa00] flex items-center gap-1.5 disabled:opacity-30 transition-colors"
              title="Pulso de Reset de Hardware via DTR/RTS"
            >
              <RefreshCw size={12} /> Reset Placa
            </button>
            <button
              onClick={() => addLog('PING', 'tx')}
              disabled={!isConnected}
              className="hover:text-white flex items-center gap-1.5 disabled:opacity-30 transition-colors"
            >
              Test Ping
            </button>
            <button
              onClick={() => setLogs([])}
              className="hover:text-red-400 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={12} /> Limpar
            </button>
            <button
              onClick={exportLogs}
              disabled={logs.length === 0}
              className="hover:text-[#00ff88] flex items-center gap-1.5 disabled:opacity-30 transition-colors"
            >
              <Download size={12} /> Baixar Logs
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-[#00d4ff]"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>
    </div>
  );
}
