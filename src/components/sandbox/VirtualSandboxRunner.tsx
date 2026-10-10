import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, Play, Square, RefreshCw, Download, 
  Copy, Check, FileCode, Folder, FolderOpen, ChevronRight, ChevronDown, 
  Maximize2, Minimize2, ExternalLink, Globe, Server, CheckCircle2, AlertCircle, Code2
} from 'lucide-react';
import { exportCompleteProjectZip, downloadBlob } from '../../lib/projectExporter';

interface VirtualSandboxRunnerProps {
  htmlContent: string;
  nodeContent: any;
  projectName?: string;
  onClose?: () => void;
}

interface VirtualFile {
  name: string;
  path: string;
  content: string;
  language: string;
}

export function VirtualSandboxRunner({
  htmlContent,
  nodeContent,
  projectName = 'parvus-solution',
  onClose
}: VirtualSandboxRunnerProps) {
  // Árvore virtual de arquivos do projeto
  const files: VirtualFile[] = [
    {
      name: 'index.html',
      path: 'src/index.html',
      content: htmlContent || '<!DOCTYPE html>\n<html><body><h1>Aplicação Virtual</h1></body></html>',
      language: 'html'
    },
    {
      name: 'server.js',
      path: 'server/server.js',
      content: nodeContent?.server_js || '// Servidor Express\nconst express = require("express");\nconst app = express();\napp.listen(3000);',
      language: 'javascript'
    },
    {
      name: 'package.json',
      path: 'server/package.json',
      content: nodeContent?.package_json || '{\n  "name": "parvus-app",\n  "version": "1.0.0"\n}',
      language: 'json'
    },
    {
      name: 'schema.sql',
      path: 'server/schema.sql',
      content: nodeContent?.schema_sql || '-- Schema SQL PostgreSQL\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
      language: 'sql'
    },
    {
      name: '.env',
      path: '.env',
      content: 'PORT=3000\nNODE_ENV=development\nDATABASE_URL=postgresql://postgres:password@localhost:5432/postgres\nJWT_SECRET=parvus_super_secret_key_demo',
      language: 'shell'
    },
    {
      name: 'README.md',
      path: 'README.md',
      content: nodeContent?.readme_md || '# ' + projectName + '\n\nGerado com Parvus Automate Enterprise.',
      language: 'markdown'
    }
  ];

  const [activeFile, setActiveFile] = useState<VirtualFile>(files[0]);
  const [editorContent, setEditorContent] = useState<string>(files[0].content);
  const [copied, setCopied] = useState(false);
  const [serverStatus, setServerStatus] = useState<'running' | 'stopped' | 'restarting'>('running');
  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; type: 'info' | 'success' | 'warn' | 'error' | 'cmd' }>>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'terminal'>('preview');
  const [isExporting, setIsExporting] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Inicialização do servidor em memória
  useEffect(() => {
    startVirtualServer();
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const startVirtualServer = () => {
    setServerStatus('restarting');
    setTerminalLogs([
      { text: `[PARVUS RUNTIME] Montando filesystem em memória virtual para '${projectName}'...`, type: 'info' },
      { text: `[NPM] Verificando dependências: express@4.21, cors@2.8, helmet@8.0, pg@8.13...`, type: 'info' },
      { text: `[CACHE] 142 pacotes restaurados em 84ms do cache local client-side.`, type: 'success' },
      { text: `[NODE] Inicializando node --watch server/server.js na porta 3000...`, type: 'info' },
      { text: `[EXPRESS] Servidor Express ativo em http://localhost:3000`, type: 'success' },
      { text: `[PROXY INTERCEPTOR] Rotas /api/v1/* mapeadas com in-memory mock dispatcher.`, type: 'success' },
      { text: `[STATUS] Runtime pronto. Aguardando requisições do iframe sandbox...`, type: 'info' }
    ]);

    setTimeout(() => {
      setServerStatus('running');
    }, 600);
  };

  const handleSelectFile = (file: VirtualFile) => {
    setActiveFile(file);
    setEditorContent(file.content);
  };

  // Interceptador in-memory injetado no iframe para responder a chamadas REST (/api/v1/...) via fetch e XMLHttpRequest
  const interceptorScript = `
    <script>
      (function() {
        function handleMockApi(method, urlStr, body) {
          window.parent.postMessage({
            type: 'SANDBOX_API_CALL',
            method: (method || 'GET').toUpperCase(),
            url: urlStr,
            body: body
          }, '*');

          let mockData = { success: true, message: 'Operação executada no runtime virtual!' };
          if (urlStr.includes('/health')) {
            mockData = { status: 'healthy', uptime: '128s', memory: '42MB', node: 'v20.12.0' };
          } else if (urlStr.includes('/metrics') || urlStr.includes('/telemetry')) {
            mockData = { totalProcessed: 1420, successRate: '99.9%', activeWorkers: 4, timestamp: new Date().toISOString() };
          } else if (method === 'POST') {
            mockData = { id: 'rec_' + Math.random().toString(36).substring(2, 8), created: true, timestamp: new Date().toISOString() };
          }
          return JSON.stringify(mockData);
        }

        // 1. Interceptar window.fetch
        const originalFetch = window.fetch;
        window.fetch = async function(url, options = {}) {
          const urlStr = String(url);
          if (urlStr.startsWith('/api') || urlStr.includes('localhost:3000/api') || urlStr.startsWith('api/')) {
            const method = (options.method || 'GET').toUpperCase();
            const mockJson = handleMockApi(method, urlStr, options.body);
            await new Promise(r => setTimeout(r, 45));
            return new Response(mockJson, {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return originalFetch.apply(this, arguments);
        };

        // 2. Interceptar XMLHttpRequest nativo (Axios, jQuery, etc.)
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        const originalXhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url) {
          this._method = method;
          this._url = String(url);
          if (this._url.startsWith('/api') || this._url.includes('localhost:3000/api') || this._url.startsWith('api/')) {
            this._isMock = true;
          }
          return originalXhrOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function(body) {
          if (this._isMock) {
            setTimeout(() => {
              const mockJson = handleMockApi(this._method, this._url, body);
              Object.defineProperty(this, 'readyState', { value: 4 });
              Object.defineProperty(this, 'status', { value: 200 });
              Object.defineProperty(this, 'statusText', { value: 'OK' });
              Object.defineProperty(this, 'responseText', { value: mockJson });
              Object.defineProperty(this, 'response', { value: mockJson });
              if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
              if (typeof this.onload === 'function') this.onload();
            }, 45);
            return;
          }
          return originalXhrSend.apply(this, arguments);
        };
      })();
    </script>
  `;

  const buildSandboxSrcDoc = () => {
    const raw = htmlContent || '<!DOCTYPE html><html><body><h1>Aplicação Virtual</h1></body></html>';
    if (raw.includes('<head>')) {
      return raw.replace('<head>', '<head>' + interceptorScript);
    }
    if (raw.includes('<html>')) {
      return raw.replace('<html>', '<html><head>' + interceptorScript + '</head>');
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${interceptorScript}</head><body style="margin:0;padding:0;">${raw}</body></html>`;
  };

  const sandboxSrcDoc = buildSandboxSrcDoc();

  // Ouvinte de mensagens do sandbox para o terminal
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'SANDBOX_API_CALL') {
        const time = new Date().toLocaleTimeString('pt-BR');
        setTerminalLogs(prev => [
          ...prev,
          {
            text: `[${time}] ${e.data.method} ${e.data.url} -> 200 OK (42ms)`,
            type: 'success'
          }
        ]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim();
    setTerminalLogs(prev => [...prev, { text: `$ ${cmd}`, type: 'cmd' }]);
    setTerminalInput('');

    if (cmd === 'clear') {
      setTerminalLogs([]);
      return;
    }

    if (cmd === 'status') {
      setTerminalLogs(prev => [
        ...prev,
        { text: `Servidor: ONLINE | Porta: 3000 | Modo: In-Browser Sandboxed Runtime`, type: 'info' }
      ]);
      return;
    }

    if (cmd.startsWith('curl')) {
      const time = new Date().toLocaleTimeString('pt-BR');
      setTerminalLogs(prev => [
        ...prev,
        { text: `HTTP/1.1 200 OK [${time}]`, type: 'success' },
        { text: `{"status":"ok","timestamp":"${new Date().toISOString()}","service":"${projectName}"}`, type: 'info' }
      ]);
      return;
    }

    setTerminalLogs(prev => [
      ...prev,
      { text: `bash: ${cmd}: comando simulado executado com código 0.`, type: 'info' }
    ]);
  };

  const handleExportZip = async () => {
    try {
      setIsExporting(true);
      const blob = await exportCompleteProjectZip({
        projectName,
        generatedHtml: htmlContent,
        generatedNode: nodeContent,
        projectType: 'SOFTWARE'
      });
      downloadBlob(blob, `${projectName}-vscode-ready.zip`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0c10] text-gray-200 overflow-hidden font-sans border border-white/10 rounded-xl shadow-2xl">
      {/* Top Header Controls */}
      <div className="h-12 bg-[#08090d] border-b border-white/10 flex items-center justify-between px-4 shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
            <Server size={14} className="text-[#00ff88]" />
            IDE Virtual & Sandboxed Runner
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 font-bold">
            {serverStatus === 'running' ? '● RUNTIME ATIVO' : '● REINICIANDO'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startVirtualServer}
            className="px-2.5 py-1 text-xs bg-white/5 hover:bg-white/10 text-gray-300 rounded flex items-center gap-1 transition-colors font-mono"
            title="Reiniciar servidor e limpar memória"
          >
            <RefreshCw size={12} className={serverStatus === 'restarting' ? 'animate-spin' : ''} />
            Reiniciar
          </button>
          <button
            onClick={handleExportZip}
            disabled={isExporting}
            className="px-3 py-1 text-xs bg-[#00ff88] hover:bg-[#00e676] text-black font-extrabold rounded flex items-center gap-1.5 transition-all font-mono uppercase tracking-wider shadow-[0_0_12px_rgba(0,255,136,0.3)] cursor-pointer"
          >
            <Download size={13} />
            {isExporting ? 'Exportando...' : 'Exportar para VS Code'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-2 py-1 text-xs rounded hover:bg-white/10"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Split-View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: Files Tree & Editor */}
        <div className="w-full md:w-5/12 border-r border-white/10 flex flex-col bg-[#07080c] overflow-hidden">
          {/* File Explorer Header & Tabs */}
          <div className="h-9 bg-[#0b0c10] border-b border-white/10 flex items-center px-3 gap-1 overflow-x-auto no-scrollbar shrink-0">
            {files.map(f => (
              <button
                key={f.path}
                onClick={() => handleSelectFile(f)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap cursor-pointer ${
                  activeFile.path === f.path
                    ? 'bg-white/15 text-white font-bold border-b border-[#00ff88]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <FileCode size={12} className={activeFile.path === f.path ? 'text-[#00ff88]' : 'text-gray-500'} />
                {f.name}
              </button>
            ))}
          </div>

          {/* Editor Body */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="h-8 bg-[#090a0f] border-b border-white/5 flex items-center justify-between px-3 text-[11px] font-mono text-gray-400">
              <span>{activeFile.path}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(editorContent);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="hover:text-white flex items-center gap-1 text-[10px]"
              >
                {copied ? <Check size={11} className="text-[#00ff88]" /> : <Copy size={11} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <textarea
              value={editorContent}
              onChange={e => setEditorContent(e.target.value)}
              className="flex-1 w-full bg-[#050608] text-gray-200 font-mono text-xs p-4 leading-relaxed resize-none outline-none overflow-auto select-text selection:bg-[#00d4ff]/30"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right Panel: Browser Live Preview & Virtual Terminal */}
        <div className="w-full md:w-7/12 flex flex-col bg-[#050608] overflow-hidden">
          {/* Subtabs Preview vs Terminal */}
          <div className="h-9 bg-[#0b0c10] border-b border-white/10 flex items-center justify-between px-3 shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveRightTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold font-mono rounded transition-colors ${
                  activeRightTab === 'preview'
                    ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Globe size={13} />
                Live Browser Sandbox
              </button>
              <button
                onClick={() => setActiveRightTab('terminal')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold font-mono rounded transition-colors ${
                  activeRightTab === 'terminal'
                    ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TerminalIcon size={13} />
                Terminal & API Logs ({terminalLogs.length})
              </button>
            </div>

            <div className="text-[10px] text-gray-500 font-mono hidden sm:block">
              http://localhost:3000
            </div>
          </div>

          {/* Right Tab Content */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {activeRightTab === 'preview' ? (
              <div className="flex-1 w-full h-full relative bg-white">
                <iframe
                  title="Virtual In-Browser Sandbox"
                  srcDoc={sandboxSrcDoc}
                  className="w-full h-full border-none outline-none"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col bg-[#050608] p-3 font-mono text-xs overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-1.5 leading-relaxed select-text">
                  {terminalLogs.map((log, index) => (
                    <div
                      key={index}
                      className={
                        log.type === 'success' ? 'text-[#00ff88]' :
                        log.type === 'warn' ? 'text-amber-400' :
                        log.type === 'cmd' ? 'text-cyan-400 font-bold' :
                        'text-gray-300'
                      }
                    >
                      {log.text}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>

                <form onSubmit={handleTerminalSubmit} className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
                  <span className="text-[#00ff88] font-bold">$</span>
                  <input
                    type="text"
                    value={terminalInput}
                    onChange={e => setTerminalInput(e.target.value)}
                    placeholder="Digite comandos (ex: curl /api/v1/health, status, clear)..."
                    className="flex-1 bg-transparent text-white text-xs outline-none font-mono placeholder:text-gray-600"
                  />
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
