import React, { useState } from 'react';
import { Play, Download, Copy, ExternalLink, Cpu, Layers, Sparkles, Check, Code, Terminal, Info } from 'lucide-react';
import { generateWokwiDiagram } from '../../lib/wokwiHelper';

interface WokwiSimulatorProps {
  projeto: any;
}

export function WokwiSimulator({ projeto }: WokwiSimulatorProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'diagram' | 'toml' | 'libraries' | 'instructions'>('visual');

  const { diagram, diagramJson, wokwiToml, librariesTxt } = generateWokwiDiagram(projeto);
  const code = projeto?.codigo?.codigo_completo || '';
  const placa = (projeto?.placa || 'ESP32').toUpperCase();

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadFile = (filename: string, text: string) => {
    const el = document.createElement('a');
    el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    el.setAttribute('download', filename);
    el.style.display = 'none';
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  };

  const openInWokwi = () => {
    // Open Wokwi new project matching board
    let target = 'https://wokwi.com/projects/new/esp32';
    if (placa.includes('ARDUINO')) {
      target = 'https://wokwi.com/projects/new/arduino-uno';
    } else if (placa.includes('RASP') || placa.includes('PICO')) {
      target = 'https://wokwi.com/projects/new/pi-pico';
    }
    window.open(target, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] border border-[rgba(0,212,255,0.2)] rounded-lg overflow-hidden font-mono text-xs">
      {/* Top Banner */}
      <div className="bg-[#0f0f0f] border-b border-[#222] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30">
            <Cpu size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase tracking-wider text-sm">Simulador Wokwi IoT Integrado</span>
              <span className="text-[10px] bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 px-2 py-0.5 rounded">
                {placa}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-sans">
              Diagrama de conexões eletrônicas automatizado e compatível com o simulador Wokwi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openInWokwi}
            className="flex items-center gap-2 bg-[#00ff88] hover:bg-[#00e676] text-black font-bold px-4 py-2 rounded uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,255,136,0.25)]"
          >
            <ExternalLink size={14} /> Abrir no Wokwi Web
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#222] bg-[#0a0a0a] px-4">
        <button
          onClick={() => setActiveTab('visual')}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'visual'
              ? 'text-[#00d4ff] border-[#00d4ff] bg-[#00d4ff]/5'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          <Layers size={14} /> Mapa de Conexões ({diagram.parts.length} componentes)
        </button>
        <button
          onClick={() => setActiveTab('diagram')}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'diagram'
              ? 'text-[#00d4ff] border-[#00d4ff] bg-[#00d4ff]/5'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          <Code size={14} /> diagram.json
        </button>
        <button
          onClick={() => setActiveTab('toml')}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'toml'
              ? 'text-[#00d4ff] border-[#00d4ff] bg-[#00d4ff]/5'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          <Terminal size={14} /> wokwi.toml
        </button>
        {librariesTxt && (
          <button
            onClick={() => setActiveTab('libraries')}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'libraries'
                ? 'text-[#00d4ff] border-[#00d4ff] bg-[#00d4ff]/5'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <Code size={14} /> libraries.txt
          </button>
        )}
        <button
          onClick={() => setActiveTab('instructions')}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'instructions'
              ? 'text-[#00d4ff] border-[#00d4ff] bg-[#00d4ff]/5'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          <Info size={14} /> Guia de Simulação
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        {activeTab === 'visual' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Placa Master */}
              <div className="border border-[#00d4ff]/30 bg-[#0a0a0a] p-5 rounded-lg">
                <div className="text-[#00d4ff] font-bold text-xs uppercase mb-1">Microcontrolador Master</div>
                <div className="text-white text-base font-bold mb-3">{diagram.parts[0]?.type}</div>
                <div className="text-gray-400 text-xs font-sans">
                  Porta lógica principal para execução do firmware C/C++.
                </div>
              </div>

              {/* Contagem de Periféricos */}
              <div className="border border-white/10 bg-[#0a0a0a] p-5 rounded-lg">
                <div className="text-[#00ff88] font-bold text-xs uppercase mb-1">Periféricos Simulados</div>
                <div className="text-white text-base font-bold mb-3">{diagram.parts.length - 1} Módulos/Sensores</div>
                <div className="text-gray-400 text-xs font-sans">
                  Mapeados automaticamente a partir do Bill of Materials do projeto.
                </div>
              </div>

              {/* Conexões VCC/GND/GPIO */}
              <div className="border border-white/10 bg-[#0a0a0a] p-5 rounded-lg">
                <div className="text-[#ffaa00] font-bold text-xs uppercase mb-1">Total de Barramentos</div>
                <div className="text-white text-base font-bold mb-3">{diagram.connections.length} Linhas de Sinal</div>
                <div className="text-gray-400 text-xs font-sans">
                  Trilhas virtuais para barramentos I2C, SPI, PWM e digitais.
                </div>
              </div>
            </div>

            {/* Lista de Conexões Virtuais */}
            <div className="border border-[#222] bg-[#0a0a0a] rounded-lg p-5">
              <h4 className="text-white font-bold uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Trilhas de Ligação no Simulador</span>
                <button
                  onClick={() => copyToClipboard(diagramJson, 'diagram')}
                  className="text-xs text-[#00d4ff] hover:underline flex items-center gap-1"
                >
                  {copiedType === 'diagram' ? <Check size={12} /> : <Copy size={12} />} Copiar Configuração JSON
                </button>
              </h4>

              <div className="space-y-2">
                {diagram.connections.length > 0 ? (
                  diagram.connections.map(([from, to, color], idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#111] p-3 rounded border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color || '#00d4ff' }}
                        ></span>
                        <span className="text-white font-bold">{from}</span>
                        <span className="text-gray-500">─── ligar em ───&gt;</span>
                        <span className="text-[#00ff88] font-bold">{to}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase">{color} wire</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">Nenhuma trilha virtual direta configurada.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'diagram' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Arquivo de Layout do Wokwi:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(diagramJson, 'json')}
                  className="flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-white border border-[#333] px-3 py-1.5 rounded transition-colors"
                >
                  {copiedType === 'json' ? <Check size={14} className="text-[#00ff88]" /> : <Copy size={14} />}
                  {copiedType === 'json' ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={() => downloadFile('diagram.json', diagramJson)}
                  className="flex items-center gap-1.5 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 px-3 py-1.5 rounded transition-colors"
                >
                  <Download size={14} /> Baixar diagram.json
                </button>
              </div>
            </div>
            <pre className="p-4 bg-[#0a0a0a] border border-[#222] rounded overflow-auto max-h-[400px] text-[#00d4ff]">
              <code>{diagramJson}</code>
            </pre>
          </div>
        )}

        {activeTab === 'toml' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Configuração do Compilador Wokwi:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(wokwiToml, 'toml')}
                  className="flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-white border border-[#333] px-3 py-1.5 rounded transition-colors"
                >
                  {copiedType === 'toml' ? <Check size={14} className="text-[#00ff88]" /> : <Copy size={14} />}
                  {copiedType === 'toml' ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={() => downloadFile('wokwi.toml', wokwiToml)}
                  className="flex items-center gap-1.5 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 px-3 py-1.5 rounded transition-colors"
                >
                  <Download size={14} /> Baixar wokwi.toml
                </button>
              </div>
            </div>
            <pre className="p-4 bg-[#0a0a0a] border border-[#222] rounded overflow-auto max-h-[400px] text-[#00ff88]">
              <code>{wokwiToml}</code>
            </pre>
          </div>
        )}

        {activeTab === 'libraries' && librariesTxt && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Bibliotecas Wokwi (libraries.txt):</span>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(librariesTxt, 'libraries')}
                  className="flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-white border border-[#333] px-3 py-1.5 rounded transition-colors"
                >
                  {copiedType === 'libraries' ? <Check size={14} className="text-[#00ff88]" /> : <Copy size={14} />}
                  {copiedType === 'libraries' ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={() => downloadFile('libraries.txt', librariesTxt)}
                  className="flex items-center gap-1.5 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 px-3 py-1.5 rounded transition-colors"
                >
                  <Download size={14} /> Baixar libraries.txt
                </button>
              </div>
            </div>
            <pre className="p-4 bg-[#0a0a0a] border border-[#222] rounded overflow-auto max-h-[400px] text-[#ffaa00]">
              <code>{librariesTxt}</code>
            </pre>
          </div>
        )}

        {activeTab === 'instructions' && (
          <div className="space-y-6 font-sans text-sm text-gray-300 max-w-3xl leading-relaxed">
            <div className="border-l-2 border-[#00ff88] pl-4">
              <h3 className="text-white font-bold text-base mb-1">Como rodar este projeto no Wokwi</h3>
              <p className="text-gray-400 text-xs">
                Você pode simular o microcontrolador e todos os sensores sem precisar comprar o hardware físico primeiro.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0a0a0a] border border-white/10 p-4 rounded-lg flex gap-4 items-start">
                <span className="w-6 h-6 rounded-full bg-[#00ff88]/20 text-[#00ff88] font-bold font-mono flex items-center justify-center shrink-0">1</span>
                <div>
                  <h4 className="text-white font-bold text-xs uppercase font-mono mb-1">Opção A: No Navegador (Wokwi Web)</h4>
                  <p className="text-xs text-gray-400">
                    Clique no botão verde <strong>"Abrir no Wokwi Web"</strong> acima. Na aba do Wokwi, cole o código C/C++ do firmware na aba <code>sketch.ino</code> ou <code>main.cpp</code> e cole o conteúdo de <code>diagram.json</code> na aba <strong>Diagram</strong>. Caso seu projeto tenha dependências, busque-as na aba Library Manager do Wokwi.
                  </p>
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-white/10 p-4 rounded-lg flex gap-4 items-start">
                <span className="w-6 h-6 rounded-full bg-[#00d4ff]/20 text-[#00d4ff] font-bold font-mono flex items-center justify-center shrink-0">2</span>
                <div>
                  <h4 className="text-white font-bold text-xs uppercase font-mono mb-1">Opção B: No VS Code (Extensão Wokwi)</h4>
                  <p className="text-xs text-gray-400">
                    Baixe o <strong>ZIP completo do Projeto IoT</strong> no botão superior. A exportação ZIP <strong>já inclui o arquivo <code>libraries.txt</code></strong> e todos os metadados do Wokwi. Abra a pasta descompactada no VS Code, instale a extensão <strong>"Wokwi Simulator"</strong> e pressione <code>F1 &gt; Wokwi: Start Simulator</code> para depurar em tempo real. O Wokwi instalará as bibliotecas automaticamente!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
