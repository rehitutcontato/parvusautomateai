/**
 * @file InspectorDrawer.tsx
 * @description Gaveta lateral direita de inspeção e edição de propriedades dos nós do Canvas Studio.
 * Permite que o operador humano reconfigure URLs, métodos HTTP, consultas Supabase,
 * pinos GPIO e parâmetros de IA do nó selecionado.
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Copy, 
  Code2, 
  Sliders, 
  Plus, 
  Check, 
  Cpu, 
  Database, 
  Server, 
  Zap, 
  Sparkles, 
  HardDrive, 
  Layout as LayoutIcon 
} from 'lucide-react';
import { 
  FlowNode, 
  FlowNodeData, 
  NodeConfig, 
  HttpMethod, 
  DatabaseOperation, 
  TriggerType, 
  IotBoardType, 
  GpioPinConfig 
} from '../../lib/flow/types';

interface InspectorDrawerProps {
  node: FlowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateData: (id: string, updates: Partial<FlowNodeData>) => void;
  onUpdateConfig: (id: string, configUpdates: Partial<NodeConfig>) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  node,
  isOpen,
  onClose,
  onUpdateData,
  onUpdateConfig,
  onDuplicate,
  onRemove
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!isOpen || !node) return null;

  const { id, data } = node;
  const category = data.category;
  const config = data.config || {};

  const handleCopySnippet = () => {
    if (data.codeSnippet) {
      navigator.clipboard.writeText(data.codeSnippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  const handleAddGpioPin = () => {
    const currentPins = config.gpioPins || [];
    const nextPinNumber = currentPins.length > 0 ? Math.max(...currentPins.map(p => p.pin)) + 1 : 4;
    const newPin: GpioPinConfig = {
      pin: nextPinNumber,
      mode: 'OUTPUT',
      component: 'Novo Dispositivo',
      label: `PIN_${nextPinNumber}`
    };
    onUpdateConfig(id, { gpioPins: [...currentPins, newPin] });
  };

  const handleRemoveGpioPin = (pinIndex: number) => {
    const currentPins = config.gpioPins || [];
    const updated = currentPins.filter((_, idx) => idx !== pinIndex);
    onUpdateConfig(id, { gpioPins: updated });
  };

  const handleUpdateGpioPin = (pinIndex: number, field: keyof GpioPinConfig, value: any) => {
    const currentPins = [...(config.gpioPins || [])];
    if (currentPins[pinIndex]) {
      currentPins[pinIndex] = {
        ...currentPins[pinIndex],
        [field]: value
      };
      onUpdateConfig(id, { gpioPins: currentPins });
    }
  };

  return (
    <aside className="fixed top-0 right-0 h-full w-96 z-50 bg-[#090b11]/98 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header do Inspector */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-[#00d4ff]" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Inspetor de Bloco
            </h3>
            <span className="text-[10px] font-mono text-white/40 block">
              ID: {id}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo com Scroll */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-white">
        {/* Identificação Geral */}
        <section className="space-y-3">
          <h4 className="text-[11px] font-mono font-bold text-[#00ff88] uppercase tracking-wider">
            Identificação Geral
          </h4>

          <div>
            <label className="text-[10px] font-semibold text-white/60 mb-1 block">
              Nome do Bloco (Label)
            </label>
            <input
              type="text"
              value={data.label}
              onChange={e => onUpdateData(id, { label: e.target.value })}
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00d4ff]/60"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-white/60 mb-1 block">
              Descrição Arquitetural
            </label>
            <textarea
              rows={2}
              value={data.description}
              onChange={e => onUpdateData(id, { description: e.target.value })}
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00d4ff]/60 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-white/60 mb-1 block">
              Status do Nó
            </label>
            <select
              value={data.status}
              onChange={e => onUpdateData(id, { status: e.target.value as any })}
              className="w-full bg-[#111420] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00d4ff]/60"
            >
              <option value="ready">Ready (Pronto)</option>
              <option value="idle">Idle (Em Espera)</option>
              <option value="error">Error (Alerta de Falha)</option>
            </select>
          </div>
        </section>

        {/* Configurações Específicas do Tipo */}
        <section className="space-y-3 pt-3 border-t border-white/10">
          <h4 className="text-[11px] font-mono font-bold text-[#00d4ff] uppercase tracking-wider">
            Parâmetros de Engenharia ({category.toUpperCase()})
          </h4>

          {/* TRIGGER */}
          {category === 'trigger' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Tipo de Gatilho
                </label>
                <select
                  value={config.triggerType || 'webhook'}
                  onChange={e => onUpdateConfig(id, { triggerType: e.target.value as TriggerType })}
                  className="w-full bg-[#111420] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00d4ff]/60"
                >
                  <option value="webhook">Webhook HTTP</option>
                  <option value="cron">Agendamento Cron</option>
                  <option value="mqtt_topic">Tópico MQTT</option>
                  <option value="manual_event">Evento Manual</option>
                </select>
              </div>

              {config.triggerType === 'webhook' && (
                <div>
                  <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                    Caminho do Webhook
                  </label>
                  <input
                    type="text"
                    value={config.webhookPath || '/api/v1/webhook'}
                    onChange={e => onUpdateConfig(id, { webhookPath: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              )}

              {config.triggerType === 'cron' && (
                <div>
                  <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                    Expressão Cron (5 campos)
                  </label>
                  <input
                    type="text"
                    value={config.cronExpression || '*/5 * * * *'}
                    onChange={e => onUpdateConfig(id, { cronExpression: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              )}
            </>
          )}

          {/* BACKEND ROUTE */}
          {category === 'backend_route' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                    Método
                  </label>
                  <select
                    value={config.routeMethod || 'POST'}
                    onChange={e => onUpdateConfig(id, { routeMethod: e.target.value as HttpMethod })}
                    className="w-full bg-[#111420] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                    Rota Express
                  </label>
                  <input
                    type="text"
                    value={config.routePath || '/api/v1/resource'}
                    onChange={e => onUpdateConfig(id, { routePath: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Controller de Negócio
                </label>
                <input
                  type="text"
                  value={config.controllerName || 'ResourceController'}
                  onChange={e => onUpdateConfig(id, { controllerName: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </>
          )}

          {/* DATABASE */}
          {category === 'database' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Tabela Supabase / PostgreSQL
                </label>
                <input
                  type="text"
                  value={config.dbTable || 'records'}
                  onChange={e => onUpdateConfig(id, { dbTable: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Operação SQL
                </label>
                <select
                  value={config.dbOperation || 'INSERT'}
                  onChange={e => onUpdateConfig(id, { dbOperation: e.target.value as DatabaseOperation })}
                  className="w-full bg-[#111420] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                >
                  <option value="SELECT">SELECT (Busca e Listagem)</option>
                  <option value="INSERT">INSERT (Gravação de Registro)</option>
                  <option value="UPDATE">UPDATE (Atualização de Estado)</option>
                  <option value="DELETE">DELETE (Exclusão Segura)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Política RLS (Row Level Security)
                </label>
                <input
                  type="text"
                  value={config.rlsPolicy || 'auth.uid() = user_id'}
                  onChange={e => onUpdateConfig(id, { rlsPolicy: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono text-[11px]"
                />
              </div>
            </>
          )}

          {/* SERVICE AI */}
          {category === 'service_ai' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Modelo Cognitivo de IA
                </label>
                <select
                  value={config.aiModel || 'gemini-3.6-flash'}
                  onChange={e => onUpdateConfig(id, { aiModel: e.target.value as any })}
                  className="w-full bg-[#111420] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                >
                  <option value="gemini-3.6-flash">Google Gemini 3.6 Flash (Ultrarrápido)</option>
                  <option value="gemini-3.5-flash">Google Gemini 3.5 Flash</option>
                  <option value="nvidia/nemotron-3-super-120b-a12b">NVIDIA Nemotron 120B (Enterprise)</option>
                  <option value="z-ai/glm-5.1">NVIDIA GLM-5.1 (Raciocínio Rápido)</option>
                  <option value="deepseek-ai/deepseek-r1">DeepSeek R1 (Lógica e Dedução)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Temperatura ({config.temperature ?? 0.2})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.temperature ?? 0.2}
                  onChange={e => onUpdateConfig(id, { temperature: parseFloat(e.target.value) })}
                  className="w-full accent-[#f59e0b]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  System Prompt Customizado
                </label>
                <textarea
                  rows={3}
                  value={config.systemPrompt || ''}
                  placeholder="Instruções específicas para o modelo de IA..."
                  onChange={e => onUpdateConfig(id, { systemPrompt: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono resize-none"
                />
              </div>
            </>
          )}

          {/* IOT DEVICE */}
          {category === 'iot_device' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Placa de Hardware Embarcado
                </label>
                <select
                  value={config.boardType || 'esp32'}
                  onChange={e => onUpdateConfig(id, { boardType: e.target.value as IotBoardType })}
                  className="w-full bg-[#111420] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                >
                  <option value="esp32">ESP32 SoC (Wi-Fi + BLE)</option>
                  <option value="esp8266">ESP8266 NodeMCU</option>
                  <option value="arduino_uno">Arduino UNO</option>
                  <option value="arduino_mega">Arduino MEGA 2560</option>
                  <option value="raspberry_pi">Raspberry Pi 4B (Linux)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-white/60">
                    Pinos GPIO & Atuadores
                  </label>
                  <button
                    onClick={handleAddGpioPin}
                    className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#00ff88]/20 text-[#00ff88] text-[9px] font-bold hover:bg-[#00ff88]/30 transition-colors"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Adicionar Pino</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(config.gpioPins || []).map((pin, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#00ff88] font-bold">
                          GPIO {pin.pin}
                        </span>
                        <button
                          onClick={() => handleRemoveGpioPin(idx)}
                          className="text-white/40 hover:text-[#ef4444] transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={pin.component}
                          placeholder="Ex: Relé"
                          onChange={e => handleUpdateGpioPin(idx, 'component', e.target.value)}
                          className="bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white"
                        />
                        <select
                          value={pin.mode}
                          onChange={e => handleUpdateGpioPin(idx, 'mode', e.target.value)}
                          className="bg-[#111420] border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white"
                        >
                          <option value="OUTPUT">OUTPUT</option>
                          <option value="INPUT">INPUT</option>
                          <option value="ANALOG_IN">ANALOG_IN</option>
                          <option value="PWM">PWM</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* FRONTEND UI */}
          {category === 'frontend_ui' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Tipo de Componente
                </label>
                <select
                  value={config.uiComponentType || 'dashboard_card'}
                  onChange={e => onUpdateConfig(id, { uiComponentType: e.target.value as any })}
                  className="w-full bg-[#111420] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="dashboard_card">Dashboard Card / KPI</option>
                  <option value="table_view">Tabela de Registros Interativa</option>
                  <option value="terminal_console">Console Terminal de Logs</option>
                  <option value="form">Formulário de Ingestão</option>
                  <option value="kanban">Quadro Kanban</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-white/60 mb-1 block">
                  Título da Seção UI
                </label>
                <input
                  type="text"
                  value={config.uiTitle || 'Painel de Métricas'}
                  onChange={e => onUpdateConfig(id, { uiTitle: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
            </>
          )}
        </section>

        {/* Editor de Code Snippet Associado */}
        <section className="space-y-2 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-mono font-bold text-[#c084fc] uppercase tracking-wider flex items-center space-x-1.5">
              <Code2 className="w-3.5 h-3.5" />
              <span>Código-Fonte Injetado</span>
            </h4>
            <button
              onClick={handleCopySnippet}
              className="text-[10px] text-white/50 hover:text-white flex items-center space-x-1"
            >
              {copiedSnippet ? <Check className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSnippet ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          <textarea
            rows={5}
            value={data.codeSnippet || ''}
            placeholder="// Código customizado gerado para este bloco..."
            onChange={e => onUpdateData(id, { codeSnippet: e.target.value })}
            className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 font-mono text-[11px] text-[#00ff88] focus:outline-none focus:border-[#00ff88]/50 resize-y leading-relaxed"
          />
        </section>
      </div>

      {/* Footer com Ações Rápidas */}
      <div className="p-3 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
        <button
          onClick={() => onDuplicate(id)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Duplicar</span>
        </button>

        <button
          onClick={() => onRemove(id)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#f87171] text-xs font-semibold transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Excluir Bloco</span>
        </button>
      </div>
    </aside>
  );
};
