import React, { useState } from 'react';
import { X, Copy, Check, Download, ExternalLink, Database, ShieldCheck, Cpu } from 'lucide-react';
import { extractOrGenerateSqlSchema } from '../../lib/sqlSchemaHelper';

interface SqlSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  problemDescription?: string;
  projectType?: string;
  generatedNode?: any;
}

export function SqlSchemaModal({
  isOpen,
  onClose,
  projectName = 'Projeto Parvus',
  problemDescription = '',
  projectType = 'SOFTWARE',
  generatedNode
}: SqlSchemaModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'sql' | 'guide'>('sql');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlContent = extractOrGenerateSqlSchema({
    titulo: projectName,
    problema: problemDescription,
    tipo: projectType,
    nodeGerado: generatedNode
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sqlContent], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName || 'parvus').toLowerCase().replace(/\s+/g, '_')}_schema.sql`;
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
            <div className="w-9 h-9 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center">
              <Database className="text-[#00d4ff]" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Esquema SQL & Supabase (PostgreSQL)
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#00d4ff]/15 text-[#00d4ff] font-mono font-bold">
                  RLS ATIVADO
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                DDL de banco de dados com chaves UUID, triggers de auditoria e políticas Row Level Security
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

        {/* Tab switch */}
        <div className="px-6 pt-3 flex gap-2 border-b border-white/10 bg-[#0a0c13]">
          <button
            onClick={() => setActiveSubTab('sql')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeSubTab === 'sql'
                ? 'border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff]/5'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Script SQL Completo
          </button>
          <button
            onClick={() => setActiveSubTab('guide')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeSubTab === 'guide'
                ? 'border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff]/5'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Como Executar no Supabase
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
          {activeSubTab === 'sql' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-sans">
                  Pronto para execução no Supabase SQL Editor ou PostgreSQL 14+:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 text-white flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check size={13} className="text-[#00ff88]" /> : <Copy size={13} />}
                    {copied ? 'Copiado!' : 'Copiar SQL'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-xs font-bold hover:bg-[#00d4ff]/20 text-[#00d4ff] flex items-center gap-1.5 transition-colors"
                  >
                    <Download size={13} />
                    Baixar .sql
                  </button>
                </div>
              </div>

              <div className="bg-[#090b10] border border-white/10 rounded-xl p-4 overflow-x-auto text-gray-200 leading-relaxed max-h-[55vh]">
                <pre>{sqlContent}</pre>
              </div>
            </div>
          ) : (
            <div className="font-sans space-y-6 text-sm text-gray-300">
              <div className="p-4 bg-[#00d4ff]/10 border border-[#00d4ff]/20 rounded-xl">
                <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                  <ShieldCheck className="text-[#00d4ff]" />
                  Passo a Passo para Implantação no Supabase
                </h3>
                <p className="text-xs text-gray-300">
                  O script acima cria automaticamente as tabelas, índices de pesquisa em JSONB, triggers de data e ativa Row Level Security (RLS) para proteger os dados por usuário.
                </p>
              </div>

              <ol className="space-y-4 list-decimal list-inside text-xs leading-relaxed">
                <li className="p-3 bg-black/30 border border-white/5 rounded-lg">
                  <strong className="text-white">Acesse o seu Projeto Supabase:</strong>
                  <p className="mt-1 text-gray-400">
                    Faça login no painel do Supabase (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-[#00d4ff] underline inline-flex items-center gap-1">supabase.com/dashboard <ExternalLink size={10} /></a>) e entre no seu projeto.
                  </p>
                </li>
                <li className="p-3 bg-black/30 border border-white/5 rounded-lg">
                  <strong className="text-white">Abra a ferramenta SQL Editor:</strong>
                  <p className="mt-1 text-gray-400">
                    No menu lateral esquerdo, clique no ícone de terminal <strong>"SQL Editor"</strong> e em seguida em <strong>"New Query"</strong>.
                  </p>
                </li>
                <li className="p-3 bg-black/30 border border-white/5 rounded-lg">
                  <strong className="text-white">Cole e Execute o Script:</strong>
                  <p className="mt-1 text-gray-400">
                    Copie o script SQL da aba anterior, cole no editor e clique no botão verde <strong>"Run"</strong> (ou pressione Ctrl + Enter).
                  </p>
                </li>
                <li className="p-3 bg-black/30 border border-white/5 rounded-lg">
                  <strong className="text-white">Conexão Automática:</strong>
                  <p className="mt-1 text-gray-400">
                    Após executar, seu banco de dados estará 100% pronto para atender o frontend e o microsserviço Node.js com segurança empresarial de nível bancário.
                  </p>
                </li>
              </ol>

              <div className="pt-2">
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00d4ff] text-black font-extrabold text-xs uppercase tracking-wider hover:brightness-110 shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all"
                >
                  Abrir Dashboard do Supabase <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}
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
            onClick={handleCopy}
            className="px-6 py-2.5 rounded-xl bg-[#00ff88] text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-[1.02] shadow-[0_0_15px_rgba(0,255,136,0.3)] transition-all"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'SQL Copiado com Sucesso!' : 'Copiar Script SQL'}
          </button>
        </div>
      </div>
    </div>
  );
}
