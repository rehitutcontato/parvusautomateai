import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { temAcesso } from '../../lib/permissions';
import { Lock, AlertTriangle, ShieldAlert, CheckSquare, Search, Copy, Download, Code2, Play, Square, Save, Cpu, Layers, ExternalLink, X, Radio, ArrowLeft, Loader2, Info, Terminal, Trash2 } from 'lucide-react';

const PLACAS = [
  { id: 'esp32', name: 'ESP32 WROOM-32' },
  { id: 'arduino', name: 'Arduino UNO/MEGA' },
  { id: 'rasp', name: 'Rasp. Pi 4B/Zero' },
  { id: 'esp8266', name: 'ESP8266 NodeMCU' },
  { id: 'mqtt', name: 'MQTT Broker' },
  { id: 'http', name: 'HTTP Genérico' },
];

const normalizeProject = (savedData: any, hardware: string, nome: string, descricao_tecnica?: string) => {
  if (!savedData) return null;
  
  // If it's a legacy saved structure
  if (savedData.esquema && !savedData.esquema_ligacao) {
    return {
      titulo: nome || 'Projeto IoT',
      descricao_tecnica: descricao_tecnica || 'Projeto gerado com sucesso.',
      placa: hardware,
      imagem_placa_url: '',
      analise_briefing: 'Projeto recuperado do histórico.',
      decisoes_pinagem: [],
      alertas_tecnicos: [],
      componentes: savedData.componentes || [],
      preco_total_estimado_brl: savedData.preco_total || 0,
      esquema_ligacao: savedData.esquema || { descricao_textual: '', conexoes: [], pinout_svg: '' },
      codigo: savedData.codigo || { linguagem: 'C++', arquivo_principal: 'main.cpp', codigo_completo: '', dependencias: [], instrucoes_upload: '' },
      avisos_seguranca: [],
      referencias: savedData.referencias || [],
      proximos_passos: []
    };
  }
  
  // If it's a newer saved structure, make sure it has title/hardware
  return {
    ...savedData,
    titulo: savedData.titulo || nome || 'Projeto IoT',
    placa: savedData.placa || hardware,
    descricao_tecnica: savedData.descricao_tecnica || descricao_tecnica || 'Projeto gerado com sucesso.',
  };
};

export function IotMonitor() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userPlan, setUserPlan] = useState('free');
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsCheckbox, setTermsCheckbox] = useState(false);
  const [agencyMode, setAgencyMode] = useState(false);

  // Agency Way IoT States
  const [iotConstructionMode, setIotConstructionMode] = useState<'simple' | 'agency'>('simple');
  const [iotShowLockMsg, setIotShowLockMsg] = useState(false);
  const [iotBriefing, setIotBriefing] = useState({
    hardware: '',
    objetivo: '',
    protocolo: 'WiFi HTTP REST',
    protocolo_detalhes: '',
    pinagem: '',
    restricoes: '',
    falha: '',
    ambiente: ''
  });
  const [iotFormErrors, setIotFormErrors] = useState<Record<string, string>>({});

  const validateIotForm = () => {
    const errs: Record<string, string> = {};
    if (!iotBriefing.hardware.trim()) {
      errs.hardware = "Campo obrigatório";
    }
    if (!iotBriefing.objetivo.trim()) {
      errs.objetivo = "Campo obrigatório";
    }
    setIotFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Generation States
  const [selectedPlaca, setSelectedPlaca] = useState('ESP32 WROOM-32');
  const [descricao, setDescricao] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Result States
  const [projeto, setProjeto] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('VISÃO GERAL');

  // Simulation States
  const [isSimulating, setIsSimulating] = useState(false);
  const [simTerminal, setSimTerminal] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // My Projects
  const [showSidebar, setShowSidebar] = useState(false);
  const [myProjects, setMyProjects] = useState<any[]>([]);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simTerminal]);

  useEffect(() => {
    // PrismJS Injector for syntax highlighting
    if (projeto && activeTab === 'CÓDIGO') {
      const existingPrism = document.getElementById('prism-js');
      if (!existingPrism) {
        const link = document.createElement('link');
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.id = 'prism-js';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
        script.onload = () => {
          const cpp = document.createElement('script');
          cpp.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js';
          cpp.onload = () => {
            const cpp2 = document.createElement('script');
            cpp2.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js';
            cpp2.onload = () => (window as any).Prism?.highlightAll();
            document.body.appendChild(cpp2);
          };
          
          const py = document.createElement('script');
          py.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js';
          py.onload = () => (window as any).Prism?.highlightAll();
          
          document.body.appendChild(cpp);
          document.body.appendChild(py);
        };
        document.body.appendChild(script);
      } else {
        setTimeout(() => {
          if ((window as any).Prism) {
            (window as any).Prism.highlightAll();
          }
        }, 100);
      }
    }
  }, [projeto, activeTab]);

  const checkAccess = async () => {
    try {
      setCheckingAccess(true);
      if (!supabase) throw new Error("Supabase não configurado");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasAccess(false);
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plano').eq('id', user.id).single();
      const plano = profile?.plano?.toLowerCase() || 'free';
      setUserPlan(plano);
      
      if (temAcesso(plano, 'iot_monitor')) {
        setHasAccess(true);
        if (sessionStorage.getItem('parvus_iot_termo') === 'aceito') {
          setTermsAccepted(true);
        } else {
          setShowTerms(true);
        }
      } else {
        setHasAccess(false);
      }
    } catch (err) {
      console.error(err);
      setHasAccess(false);
    } finally {
      setCheckingAccess(false);
    }
  };

  const handleAcceptTerms = () => {
    sessionStorage.setItem('parvus_iot_termo', 'aceito');
    setShowTerms(false);
    setTermsAccepted(true);
  };

  const carregarMeusProjetos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase.from('iot_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('tipo', 'PROJETO_GERADO')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setMyProjects(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const abrirSidebar = () => {
    setShowSidebar(true);
    carregarMeusProjetos();
  };

  const deleteProjeto = async (id: string) => {
    if(!confirm("Deletar projeto?")) return;
    try {
      await supabase.from('iot_devices').delete().eq('id', id);
      carregarMeusProjetos();
    } catch (e) {
      console.error(e);
    }
  };

  const generateProject = async () => {
    if (iotConstructionMode === 'agency') {
      const isValido = validateIotForm();
      if (!isValido) {
        setErrorMsg("Por favor, preencha todos os campos obrigatórios (*) do briefing do hardware.");
        return;
      }
    } else {
      if (!descricao || descricao.trim().length < 10) {
        setErrorMsg("Descreva o projeto detalhadamente (mínimo 10 caracteres).");
        return;
      }
    }

    setErrorMsg("");
    setProjeto(null);
    setIsGenerating(true);
    setLoadingMsg('Analisando especificações...');

    try {
      let prompt = '';

      if (iotConstructionMode === 'agency') {
        prompt = `Você é um engenheiro de sistemas embarcados sênior. Nível: produção industrial.
O cliente preencheu um briefing técnico completo de hardware. Execute com precisão absoluta.
Assuma que o usuário é extremamente experiente em eletrônica — não explique conceitos básicos.

== BRIEFING TÉCNICO DOS EMBARCADOS ==

HARDWARE DISPONÍVEL: ${iotBriefing.hardware}
OBJETIVO (entradas/saídas/lógica): ${iotBriefing.objetivo}
PROTOCOLO DE COMUNICAÇÃO: ${iotBriefing.protocolo} — ${iotBriefing.protocolo_detalhes}
PINAGEM DEFINIDA: ${iotBriefing.pinagem || 'Não definida pelo usuário — projete a melhor pinagem possível'}
RESTRIÇÕES DE HARDWARE: ${iotBriefing.restricoes || 'Nenhuma'}
COMPORTAMENTO DE FALHA: ${iotBriefing.falha || 'Não especificado — implemente failsafe industrial padrão'}
AMBIENTE DE OPERAÇÃO: ${iotBriefing.ambiente || 'Industrial/Comum padrão'}

== FIM DO BRIEFING ==

Use web search para:
- Buscar datasheet ou pinout oficial do hardware principal mencionado (se aplicável)
- Buscar preços reais dos componentes no Brasil (FilipeFlop, Baú da Eletrônica, Mercado Livre)
- Buscar imagem oficial do hardware de placa principal
- Buscar 3 referências técnicas ou bibliotecas relevantes

${agencyMode ? '- MODO AGÊNCIA ATIVADO: Remova referências ao gerador, crie conteúdo white-label pronto para revenda corporativa.\n' : ''}

Retorne EXCLUSIVAMENTE um JSON válido com esta estrutura estrita:
{
  "titulo": "nome do projeto",
  "descricao_tecnica": "resumo de engenharia em 2 linhas",
  "placa": "${selectedPlaca}",
  "imagem_placa_url": "URL real de imagem oficial da placa encontrada via web search",
  
  "analise_briefing": "sua leitura técnica em 3-4 linhas do que foi pedido",
  "decisoes_pinagem": [
    {
      "pino": "GPIO 5",
      "funcao": "Trigger do Relé",
      "justificativa": "Pino com pull-down interno estável no boot"
    }
  ],
  "alertas_tecnicos": [
    "aviso de risco identificado (ex: corrente limite de GPIO, segurança de 110/220V)"
  ],

  "componentes": [
    {
      "nome": "nome do componente",
      "quantidade": 1,
      "especificacao": "modelo/especificação exata com part number se aplicável",
      "preco_estimado_brl": 15.90,
      "onde_comprar": "FilipeFlop / Mercado Livre / Baú da Eletrônica",
      "link_sugerido": "URL real"
    }
  ],
  "preco_total_estimado_brl": 150.00,

  "esquema_ligacao": {
    "descricao_textual": "cada conexão física descrita de forma clara",
    "conexoes": [
      {
        "de": "ESP32 GPIO 5",
        "para": "In do Módulo Relé",
        "via": "Resistor 1kΩ"
      }
    ],
    "pinout_svg": "SVG COMPLETO representando o diagrama de ligação — use retângulos para representar a placa e componentes, linhas coloridas para os fios, labels em todos os pinos. Deve ser um SVG funcional e legível, mínimo 600x400px, fundo #0a0a0a, texto #00d4ff."
  },

  "codigo": {
    "linguagem": "C++",
    "arquivo_principal": "main.cpp",
    "codigo_completo": "código completo, comentado em português, totalmente funcional sem omitir pinos ou lógica — zero placeholders",
    "dependencias": ["Nome da biblioteca com versão recomendada"],
    "instrucoes_upload": "passo a passo detalhado para flash e upload de código"
  },

  "comportamento_falha_implementado": "descreva como o failsafe foi projetado ou tratado no firmware",
  "avisos_seguranca": [
    "alerta de segurança elétrica ou ambiental"
  ],
  "referencias": [
    {
      "titulo": "Datasheet ou Tutorial de Referência",
      "url": "URL real",
      "descricao": "por que este recurso é útil para o engenheiro na vida real"
    }
  ],
  "proximos_passos": [
    "passo 1 após montar a protoboard"
  ]
}`;
      } else {
        prompt = `Você é um engenheiro de hardware sênior. O usuário descreve um projeto e você gera TUDO necessário para construí-lo.

PLACA SELECIONADA: ${selectedPlaca}
DESCRIÇÃO DO PROJETO: ${descricao}

CONTEXTO CRÍTICO:
- O usuário é EXPERIENTE em eletrônica — não explique conceitos básicos
- Este é um projeto REAL — não uma simulação
- O código gerado deve funcionar no hardware real sem modificações conceituais
- Use web search para buscar preços reais de componentes no Brasil (Mercado Livre, FilipeFlop, Baú da Eletrônica)
- Use web search para buscar a imagem oficial da placa ${selectedPlaca}
- Use web search para buscar 3 links de referência relevantes para este projeto
${agencyMode ? '- MODO AGÊNCIA ATIVADO: Remova referências ao gerador, crie conteúdo white-label pronto para revenda corporativa.\n' : ''}

Retorne EXCLUSIVAMENTE um JSON válido com esta estrutura:
{
  "titulo": "nome curto do projeto",
  "descricao_tecnica": "resumo técnico em 2 linhas",
  "placa": "${selectedPlaca}",
  "imagem_placa_url": "URL real da imagem oficial da placa (buscada via web)",
  "componentes": [
    {
      "nome": "nome do componente",
      "quantidade": 1,
      "especificacao": "modelo/especificação exata",
      "preco_estimado_brl": 25.90,
      "onde_comprar": "FilipeFlop / Mercado Livre / Baú da Eletrônica",
      "link_sugerido": "URL real"
    }
  ],
  "preco_total_estimado_brl": 150.00,
  "esquema_ligacao": {
    "descricao_textual": "descrição detalhada de cada conexão em linguagem técnica",
    "conexoes": [
      {
        "de": "ESP32 GPIO 2",
        "para": "Anodo do LED",
        "via": "Resistor 220Ω"
      }
    ],
    "pinout_svg": "SVG COMPLETO representando o diagrama de ligação — use retângulos para representar a placa e componentes, linhas coloridas para os fios, labels em todos os pinos. Deve ser um SVG funcional e legível, mínimo 600x400px, fundo #0a0a0a, texto #00d4ff."
  },
  "codigo": {
    "linguagem": "C++",
    "arquivo_principal": "main.cpp",
    "codigo_completo": "código completo, comentado em português, pronto para upload na placa — zero placeholders",
    "dependencias": ["lib1", "lib2"],
    "instrucoes_upload": "passo a passo para fazer upload do código na placa"
  },
  "avisos_seguranca": [
    "aviso específico para este projeto — não genérico"
  ],
  "referencias": [
    {
      "titulo": "título do recurso",
      "url": "URL real encontrada via web search",
      "descricao": "por que este link é útil para este projeto"
    }
  ],
  "proximos_passos": [
    "passo 1 após montar o hardware"
  ]
}`;
      }

      setLoadingMsg('Projetando esquema de ligação e simulando componentes...');
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const userKey = localStorage.getItem('parvus_key') || '';
      const req = await fetch(`${apiUrl}/api/ai/generate-iot`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(userKey ? { 'x-gemini-key': userKey, 'x-nvidia-key': userKey } : {})
        },
        body: JSON.stringify({ prompt, placa: selectedPlaca })
      });
      
      let data;
      try {
        data = await req.json();
      } catch (jsonErr) {
        throw new Error("Erro de comunicação com o servidor. A API retornou uma resposta inválida (não JSON). Verifique sua chave da API ou tente novamente.");
      }
      
      if (!data || data.error) {
        throw new Error(data?.error || "Erro ao gerar o projeto com a IA.");
      }

      setProjeto(data);
      setActiveTab('VISÃO GERAL');

      // Auto-save
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('iot_devices').insert({
            user_id: user.id,
            nome: data.titulo || 'Projeto IoT',
            tipo: 'PROJETO_GERADO',
            hardware: data.placa || selectedPlaca,
            descricao: data.descricao_tecnica,
            dados_atuais: {
              ...data,
              componentes: data.componentes,
              codigo: data.codigo,
              esquema: data.esquema_ligacao,
              referencias: data.referencias,
              preco_total: data.preco_total_estimado_brl
            },
            status: 'offline'
          });
        }
      } catch (err) {
        console.error("Auto-save falhou", err);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Falha na comunicação com a API NVIDIA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const simulateExecution = async () => {
    if (!projeto?.codigo?.codigo_completo) return;
    setIsSimulating(true);
    setSimTerminal(['>_ Iniciando sistema IoT Emulator...', `>_ Target: ${projeto.placa}`, '>_ Compilando payload...']);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const userKey = localStorage.getItem('parvus_key') || '';
      const req = await fetch(`${apiUrl}/api/ai/simulate-iot`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(userKey ? { 'x-gemini-key': userKey, 'x-nvidia-key': userKey } : {})
        },
        body: JSON.stringify({ 
          codigo: projeto.codigo.codigo_completo,
          linguagem: projeto.codigo.linguagem,
          placa: projeto.placa 
        })
      });
      
      let data;
      try {
        data = await req.json();
      } catch (e) {
        throw new Error("Resposta inválida do servidor.");
      }
      
      if (data && data.output) {
        const lines = data.output.split('\n');
        for (let i = 0; i < lines.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 300));
          setSimTerminal(prev => [...prev, lines[i]]);
        }
      } else {
        setSimTerminal(prev => [...prev, '>_ Serviço temporariamente indisponível.', '>_ Simulação abortada.']);
      }
    } catch (err) {
      setSimTerminal(prev => [...prev, '>_ [ERROR] Falha de comunicação com o cluster de simulação.']);
    } finally {
      setTimeout(() => setIsSimulating(false), 500);
    }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência');
  };

  if (checkingAccess) {
    return <div className="h-full bg-[#0a0a0a] flex items-center justify-center text-[#00d4ff]"><Loader2 className="animate-spin" /></div>;
  }

  if (!hasAccess) {
    return (
      <div className="flex h-[calc(100vh-64px)] w-full bg-[#0a0a0a] items-center justify-center relative overflow-hidden" 
           style={{ backgroundImage: 'linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
        <div className="absolute inset-0 bg-black/40 pointer-events-none z-0"></div>
        <div className="max-w-5xl w-full mx-4 text-center z-10 p-8 border border-[rgba(0,212,255,0.1)] rounded-2xl bg-[#0f0f0f]/80 backdrop-blur-xl shadow-2xl">
          <Lock size={64} className="mx-auto text-[#ff4444] mb-6 opacity-80 animate-pulse" />
          <h1 className="text-4xl font-black text-[#ff4444] tracking-widest uppercase mb-6" style={{ fontFamily: '"Syne", sans-serif' }}>
            ACESSO RESTRITO
          </h1>
          <p className="text-gray-300 text-lg mb-8" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
            O módulo IoT é exclusivo para planos Creator e Enterprise.<br/><br/>
            Este módulo utiliza IA para projetar sistemas reais de hardware — esquemas de ligação, código de placa, lista de componentes e simulação funcional.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left font-mono">
            {/* Card Creator */}
            <div className="border border-[rgba(0,212,255,0.2)] bg-black/80 rounded-xl p-6 flex flex-col justify-between hover:border-[#9b59b6]/50 hover:shadow-[0_0_20px_rgba(155,89,182,0.1)] transition-all">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 bg-[#9b59b6] rounded flex-shrink-0"></span>
                  <h3 className="text-white font-bold text-lg select-none">CREATOR</h3>
                </div>
                <p className="text-[#00d4ff] text-[11px] mb-4 uppercase tracking-wider font-semibold">Acesso a:</p>
                <ul className="text-xs text-gray-400 space-y-2 mb-6">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#9b59b6] font-bold">✓</span>
                    <span>Gerador (todos os modos)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#9b59b6] font-bold">✓</span>
                    <span>IoT Creator</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#9b59b6] font-bold">✓</span>
                    <span>Agency Way</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#9b59b6] font-bold">✓</span>
                    <span>Landing Pages IA</span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="border-t border-white/10 pt-4 mb-4">
                  <span className="text-gray-500 text-[10px] block uppercase">Valor:</span>
                  <span className="text-white text-base font-bold">R$ 1k–3k/mês</span>
                </div>
                <a href="https://wa.me/5519994656845?text=Olá%2C%20tenho%20interesse%20no%20plano%20Creator%20do%20Parvus%20Automate" 
                   target="_blank" rel="noreferrer" 
                   className="block text-center bg-[#9b59b6] text-white hover:bg-[#8e44ad] text-xs font-bold uppercase py-3 rounded-lg tracking-wider transition-colors">
                  Contatar Vendas
                </a>
              </div>
            </div>

            {/* Card Enterprise */}
            <div className="border border-[rgba(0,212,255,0.2)] bg-black/80 rounded-xl p-6 flex flex-col justify-between hover:border-[#00d4ff]/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.1)] transition-all">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 bg-[#00d4ff] rounded flex-shrink-0"></span>
                  <h3 className="text-white font-bold text-lg select-none">ENTERPRISE</h3>
                </div>
                <p className="text-[#00d4ff] text-[11px] mb-4 uppercase tracking-wider font-semibold">Acesso a:</p>
                <ul className="text-xs text-gray-400 space-y-2 mb-6">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#00d4ff] font-bold">✓</span>
                    <span>Tudo do Creator</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#00d4ff] font-bold">✓</span>
                    <span>SLA garantido</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#00d4ff] font-bold">✓</span>
                    <span>Suporte dedicado</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#00d4ff] font-bold">✓</span>
                    <span>Onboarding completo</span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="border-t border-white/10 pt-4 mb-4">
                  <span className="text-gray-500 text-[10px] block uppercase">Valor:</span>
                  <span className="text-white text-base font-bold">Customizado</span>
                </div>
                <a href="https://wa.me/5519994656845?text=Olá%2C%20tenho%20interesse%20no%20plano%20Enterprise%20do%20Parvus%20Automate" 
                   target="_blank" rel="noreferrer" 
                   className="block text-center bg-[#00d4ff] text-black hover:bg-[#00b4d8] text-xs font-bold uppercase py-3 rounded-lg tracking-wider transition-colors">
                  Contatar Vendas
                </a>
              </div>
            </div>

            {/* Card WhatsApp Contact */}
            <div className="border border-white/10 bg-white/5 rounded-xl p-6 flex flex-col justify-between text-left">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#25D366]"><path d="M12.031 0C5.385 0 .003 5.385.003 12.03c0 2.13.56 4.212 1.611 6.04L0 24l6.103-1.602a11.96 11.96 0 005.928 1.57h.005c6.645 0 12.025-5.384 12.025-12.028C24.06 5.834 21.737 3.511 18.23 1.097 15.65.65 13.9 0 12.03 0zm0 1.942c2.518 0 4.885.987 6.666 2.775 1.782 1.79 2.768 4.168 2.766 6.69-.004 5.228-4.26 9.48-9.48 9.48-2.026 0-4.004-.54-5.719-1.558l-.41-.244-4.25 1.115 1.141-4.143-.268-.425A9.458 9.458 0 011.95 11.411c0-5.23 4.26-9.48 9.486-9.48h.005zM9.467 6.444c-.214-.472-.444-.48-.642-.488-.168-.006-.36-.008-.553-.008-.193 0-.505.074-.77.36s-1.01 1.002-1.01 2.443.513 2.822 1.18 3.511c.717.74 3.197 4.808 6.002 5.86.666.25 1.186.4 1.591.512.67.186 1.28.16 1.76.096.536-.071 1.642-.67 1.874-1.32.23-.65.23-1.206.16-1.32-.07-.114-.265-.183-.553-.328-.288-.143-1.706-.843-1.97-94-.264-.099-.54-.034-.736.216-.275.352-.85 1.082-1.042 1.303-.19.223-.38.25-.668.106-.288-.144-1.217-.45-2.32-1.436-.857-.768-1.436-1.716-1.605-2.003-.17-.288 0-.442.143-.585.127-.127.288-.337.432-.505.143-.168.192-.288.288-.48.095-.19.048-.36-.024-.505-.072-.144-.642-1.55-.88-2.124z"/></svg>
                  <h3 className="text-white font-bold text-lg">Já tem conta?</h3>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed mb-6">
                  Se você já efetuou o pagamento ou possui um código de ativação corporativo, fale com nosso suporte técnico para liberar seu login imediatamente.
                </p>
              </div>
              <div>
                <div className="border-t border-white/10 pt-4 mb-4">
                  <span className="text-gray-500 text-[10px] block uppercase">Fale com vendas:</span>
                  <span className="text-white text-base font-bold">(19) 99465-6845</span>
                </div>
                <a href="https://wa.me/5519994656845?text=Olá%2C%20tenho%20interesse%20no%20plano%20Creator%2FEnterprise%20do%20Parvus%20Automate" 
                   target="_blank" rel="noreferrer" 
                   className="block text-center bg-[#25D366] hover:bg-[#1ebd56] text-black text-xs font-bold uppercase py-3 rounded-lg tracking-wider transition-colors">
                  Abrir WhatsApp
                </a>
              </div>
            </div>
          </div>
          
          <div className="hidden">
            <p className="text-gray-400 font-mono text-sm">Para contratar, entre em contato:</p>
            <a href="https://wa.me/5519994656845?text=Olá%2C%20tenho%20interesse%20no%20módulo%20IoT%20do%20Parvus%20Automate" target="_blank" rel="noreferrer" 
               className="bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold uppercase tracking-widest px-8 py-4 rounded-xl flex items-center gap-3 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12.031 0C5.385 0 .003 5.385.003 12.03c0 2.13.56 4.212 1.611 6.04L0 24l6.103-1.602a11.96 11.96 0 005.928 1.57h.005c6.645 0 12.025-5.384 12.025-12.028C24.06 5.834 21.737 3.511 18.23 1.097 15.65.65 13.9 0 12.03 0zm0 1.942c2.518 0 4.885.987 6.666 2.775 1.782 1.79 2.768 4.168 2.766 6.69-.004 5.228-4.26 9.48-9.48 9.48-2.026 0-4.004-.54-5.719-1.558l-.41-.244-4.25 1.115 1.141-4.143-.268-.425A9.458 9.458 0 011.95 11.411c0-5.23 4.26-9.48 9.486-9.48h.005zM9.467 6.444c-.214-.472-.444-.48-.642-.488-.168-.006-.36-.008-.553-.008-.193 0-.505.074-.77.36s-1.01 1.002-1.01 2.443.513 2.822 1.18 3.511c.717.74 3.197 4.808 6.002 5.86.666.25 1.186.4 1.591.512.67.186 1.28.16 1.76.096.536-.071 1.642-.67 1.874-1.32.23-.65.23-1.206.16-1.32-.07-.114-.265-.183-.553-.328-.288-.143-1.706-.843-1.97-94-.264-.099-.54-.034-.736.216-.275.352-.85 1.082-1.042 1.303-.19.223-.38.25-.668.106-.288-.144-1.217-.45-2.32-1.436-.857-.768-1.436-1.716-1.605-2.003-.17-.288 0-.442.143-.585.127-.127.288-.337.432-.505.143-.168.192-.288.288-.48.095-.19.048-.36-.024-.505-.072-.144-.642-1.55-.88-2.124z"/></svg>
              Abrir WhatsApp
            </a>
            <a href="/" className="text-gray-500 hover:text-white mt-4 flex items-center font-mono uppercase text-xs tracking-widest transition-colors"><ArrowLeft size={14} className="mr-2"/> Voltar ao Início</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] w-full bg-[#0a0a0a] text-[#00d4ff] font-mono overflow-hidden relative" 
         style={{ backgroundImage: 'linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      
      {/* Scanlines Element */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.2) 1px, rgba(0,0,0,0.2) 2px)' }}></div>

      {showTerms && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
          <div className="max-w-3xl border border-[#ffaa00]/30 rounded-xl bg-[#0f0a00] p-8 shadow-[0_0_50px_rgba(255,170,0,0.1)]">
            <h2 className="text-[#ffaa00] text-2xl font-bold flex items-center gap-3 uppercase tracking-widest mb-6">
              <ShieldAlert size={28} /> AVISO IMPORTANTE — LEIA ANTES DE CONTINUAR
            </h2>
            <div className="text-gray-300 space-y-4 mb-8 leading-relaxed text-sm">
              <p>Este módulo é destinado EXCLUSIVAMENTE a pessoas com experiência comprovada em eletrônica e hardware.</p>
              <p className="font-bold text-[#ffaa00] mt-6">AO CONTINUAR, VOCÊ DECLARA QUE:</p>
              <ul className="space-y-3 pl-4">
                <li>✓ Possui conhecimento em eletrônica básica e avançada</li>
                <li>✓ Sabe identificar e manusear componentes eletrônicos</li>
                <li>✓ Entende os riscos de curto-circuito, sobretensão e manuseio incorreto de componentes energizados</li>
                <li>✓ Assume total responsabilidade por danos a equipamentos, componentes ou lesões decorrentes do uso das informações</li>
                <li>✓ A Parvus não se responsabiliza por resultados incorretos gerados pela IA — sempre valide com um profissional</li>
                <li>✓ Nunca trabalhe com tensões acima de 5V sem os devidos equipamentos de proteção individual</li>
              </ul>
            </div>
            
            <label className="flex items-start gap-4 mb-8 cursor-pointer p-4 border border-[#333] rounded hover:border-[#ffaa00] transition-colors">
               <input type="checkbox" checked={termsCheckbox} onChange={(e) => setTermsCheckbox(e.target.checked)} className="mt-1 w-5 h-5 accent-[#ffaa00]" />
               <span className="text-sm text-gray-400 select-none">Li e aceito os termos acima e declaro ter experiência necessária para utilizar este módulo com segurança.</span>
            </label>

            <div className="flex justify-between">
              <a href="/" className="px-6 py-3 border border-[#333] text-gray-500 rounded uppercase tracking-widest text-xs hover:bg-[#111] transition-colors">Cancelar — Voltar</a>
              <button 
                disabled={!termsCheckbox}
                onClick={handleAcceptTerms}
                className="disabled:opacity-30 disabled:cursor-not-allowed bg-[#ffaa00] hover:bg-[#ff8800] text-black font-bold uppercase tracking-widest px-8 py-3 rounded text-xs transition-colors shadow-[0_0_15px_rgba(255,170,0,0.3)]">
                Aceitar e Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER IoT */}
      <div className="absolute top-0 left-0 w-full h-14 bg-[#0a0a0a] border-b border-[rgba(0,212,255,0.1)] z-30 flex items-center justify-between px-6">
         <div className="flex items-center gap-4 text-sm font-bold uppercase tracking-widest">
           <Radio size={18} className="text-[#00ff88] animate-pulse" />
           <span className="text-[#00d4ff]">&gt;_ IOT CREATOR</span>
           <span className="text-[10px] text-[#00ff88] px-2 py-0.5 border border-[#00ff88]/30 bg-[#00ff88]/10 rounded flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]"></span> IA PRONTA
           </span>
         </div>
         <button onClick={abrirSidebar} className="border border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.1)] text-[#00d4ff] px-4 py-1.5 rounded text-xs uppercase tracking-widest flex items-center gap-2 transition-colors">
           <Layers size={14} /> Meus Projetos IoT
         </button>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex w-full h-full pt-14 z-20">
        
        {/* LEFT PANEL - INPUT */}
        <div className="w-[40%] min-w-[400px] border-r border-[rgba(0,212,255,0.1)] bg-[#050505] p-6 overflow-y-auto custom-scrollbar flex flex-col">
          {/* MODO DE CONSTRUÇÃO */}
          <div className="space-y-3 mb-6 p-4 bg-white/5 border border-white/5 rounded-xl">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#9b59b6] rounded-full"></span>
              Modo de Construção IoT
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-black border border-white/5 rounded-xl">
              <button
                type="button"
                onClick={() => setIotConstructionMode('simple')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                  iotConstructionMode === 'simple'
                    ? 'bg-[#00d4ff] text-black shadow-[0_0_15px_rgba(0,212,255,0.4)]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Simple Prompt IoT
              </button>
              <button
                type="button"
                onClick={() => {
                  if (temAcesso(userPlan, 'agency_mode')) {
                    setIotConstructionMode('agency');
                  } else {
                    setIotShowLockMsg(true);
                  }
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all text-center relative ${
                  iotConstructionMode === 'agency'
                    ? 'bg-[#9b59b6] text-white shadow-[0_0_15px_rgba(155,89,182,0.4)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Agency Way IoT ⭐
              </button>
            </div>
            
            {iotShowLockMsg && !temAcesso(userPlan, 'agency_mode') && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[11px] flex flex-col gap-1 mt-2">
                <span>Disponível no plano Creator — </span> 
                <a 
                  href="https://wa.me/5519994656845?text=Olá%2C%20tenho%20interesse%20no%20plano%20Creator%20do%20Parvus%20Automate" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[#9b59b6] font-bold underline hover:text-[#b07cc6]"
                >
                  [Contatar vendas]
                </a>
              </div>
            )}
            
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              {iotConstructionMode === 'simple' 
                ? 'Descreva o projeto em linguagem livre.' 
                : 'Especificação técnica completa com foco industrial.'}
            </p>
          </div>

          <h2 className="text-[#00d4ff] font-bold text-sm uppercase tracking-widest mb-6">&gt;_ SELECIONE A PLACA BASE</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {PLACAS.map((p) => (
              <div 
                key={p.id}
                onClick={() => setSelectedPlaca(p.name)}
                className={`cursor-pointer p-4 border rounded relative overflow-hidden transition-all ${
                  selectedPlaca === p.name ? 'border-[#00d4ff] bg-[#00d4ff]/10 shadow-[0_0_15px_rgba(0,212,255,0.15)]' : 'border-[#222] bg-[#0a0a0a] hover:border-[#00d4ff]/50'
                }`}
              >
                <Cpu size={20} className={`mb-2 mx-auto ${selectedPlaca === p.name ? 'text-[#00d4ff]' : 'text-gray-600'}`} />
                <div className={`text-center text-[10px] font-bold uppercase tracking-wider ${selectedPlaca === p.name ? 'text-white' : 'text-gray-500'}`}>{p.name}</div>
              </div>
            ))}
          </div>

          {iotConstructionMode === 'agency' ? (
            <div className="space-y-5 mb-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                  <span>1. Especificação do Hardware Base *</span>
                  {iotFormErrors.hardware && <span className="text-red-400 text-[10px] lowercase italic">{iotFormErrors.hardware}</span>}
                </label>
                <textarea
                  className={`w-full bg-[#111] border ${iotFormErrors.hardware ? 'border-red-500' : 'border-white/10 focus:border-[#9b59b6]/50'} rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-[#9b59b6]/50 transition-all outline-none resize-none h-[80px] font-light`}
                  placeholder="Selecione ou recomende a placa principal e periféricos. Ex: ESP32-WROOM-32 com sensor DHT22 e display OLED I2C..."
                  value={iotBriefing.hardware}
                  onChange={e => {
                    setIotBriefing(prev => ({ ...prev, hardware: e.target.value }));
                    if (e.target.value.trim()) setIotFormErrors(prev => { const n = {...prev}; delete n.hardware; return n; });
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                  <span>2. Objetivo Funcional (Entradas/Saídas) *</span>
                  {iotFormErrors.objetivo && <span className="text-red-400 text-[10px] lowercase italic">{iotFormErrors.objetivo}</span>}
                </label>
                <textarea
                  className={`w-full bg-[#111] border ${iotFormErrors.objetivo ? 'border-red-500' : 'border-white/10 focus:border-[#9b59b6]/50'} rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-[#9b59b6]/50 transition-all outline-none resize-none h-[120px] font-light`}
                  placeholder="Descreva o fluxo do firmware. Ex: Ler temperatura a cada 10s. Se passar de 30°C, acionar relé no GPIO 5..."
                  value={iotBriefing.objetivo}
                  onChange={e => {
                     setIotBriefing(prev => ({ ...prev, objetivo: e.target.value }));
                     if (e.target.value.trim()) setIotFormErrors(prev => { const n = {...prev}; delete n.objetivo; return n; });
                  }}
                />
              </div>

              <div className="space-y-2 bg-white/5 border border-white/5 p-3 rounded-xl">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">3. Protocolo de Comunicação</label>
                <div className="flex flex-col gap-2 mt-2">
                  {[
                    'WiFi HTTP REST',
                    'WiFi MQTT',
                    'Bluetooth Serial',
                    'Serial USB',
                    'Sem comunicação externa'
                  ].map(proto => (
                    <label key={proto} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="iot_protocol"
                        className="accent-[#9b59b6]"
                        checked={iotBriefing.protocolo === proto}
                        onChange={() => setIotBriefing(prev => ({ ...prev, protocolo: proto }))}
                      />
                      {proto}
                    </label>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Detalhes (broker MQTT, endpoint, etc.)"
                    className="w-full bg-black border border-white/10 focus:border-[#9b59b6]/50 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-[#9b59b6]/50"
                    value={iotBriefing.protocolo_detalhes}
                    onChange={e => setIotBriefing(prev => ({ ...prev, protocolo_detalhes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">4. Pinagem já definida (opcional)</label>
                <textarea
                  className="w-full bg-[#111] border border-white/10 focus:border-[#9b59b6]/50 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-[#9b59b6]/50 transition-all outline-none resize-none h-[80px] font-light"
                  placeholder="Ex: Sensor DHT deve usar GPIO 4; Relé deve usar GPIO 26..."
                  value={iotBriefing.pinagem}
                  onChange={e => setIotBriefing(prev => ({ ...prev, pinagem: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">5. Restrições de Hardware</label>
                <textarea
                  className="w-full bg-[#111] border border-white/10 focus:border-[#9b59b6]/50 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-[#9b59b6]/50 transition-all outline-none resize-none h-[80px] font-light"
                  placeholder="Ex: Deve operar na bateria de LiPo 3.7V, modo sleep profundo ativo..."
                  value={iotBriefing.restricoes}
                  onChange={e => setIotBriefing(prev => ({ ...prev, restricoes: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">6. Comportamento de Falha</label>
                <textarea
                  className="w-full bg-[#111] border border-white/10 focus:border-[#9b59b6]/50 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-[#9b59b6]/50 transition-all outline-none resize-none h-[80px] font-light"
                  placeholder="Ex: Se perder conexão WiFi, fechar válvulas no relé e acionar alarme offline..."
                  value={iotBriefing.falha}
                  onChange={e => setIotBriefing(prev => ({ ...prev, falha: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">7. Ambiente de Operação</label>
                <textarea
                  className="w-full bg-[#111] border border-white/10 focus:border-[#9b59b6]/50 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-[#9b59b6]/50 transition-all outline-none resize-none h-[80px] font-light"
                  placeholder="Ex: Ambiente industrial, alta umidade, temperatura média de 45°C..."
                  value={iotBriefing.ambiente}
                  onChange={e => setIotBriefing(prev => ({ ...prev, ambiente: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-[#00d4ff] font-bold text-sm uppercase tracking-widest mb-4">&gt;_ DESCRIÇÃO DO PROJETO</h2>
              <textarea 
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={isGenerating}
                placeholder='Ex: "Quero um sistema que ligue um LED quando o sensor de presença HC-SR501 detectar movimento e ative um buzzer por 3 segundos."'
                className="w-full h-40 bg-[#0a0a0a] border border-[#333] focus:border-[#00d4ff] text-white p-4 rounded text-sm placeholder:text-gray-700 resize-none outline-none mb-4 transition-colors disabled:opacity-50"
              ></textarea>
            </>
          )}
          
          {temAcesso(userPlan, 'agency_mode') && (
            <div className="flex items-center justify-between p-3 rounded border border-[#9b59b6]/30 bg-[#9b59b6]/5 mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#9b59b6]">Modo Agência</span>
                <span className="text-[10px] text-gray-500">Gera hardware white-label sem marca Parvus</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={agencyMode} onChange={() => setAgencyMode(!agencyMode)} />
                <div className="w-9 h-5 bg-[#222] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#9b59b6]"></div>
              </label>
            </div>
          )}

          <div className="border border-[#ffaa00]/30 bg-[#ffaa00]/5 p-4 rounded flex gap-3 text-[#ffaa00] text-xs mb-8">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>
              <strong>Aviso:</strong> Este sistema projeta esquemas reais para hardware físico. Não é um simulador genérico. Você precisará dos componentes descritos para executar o projeto final na vida real.
            </span>
          </div>

          {errorMsg && <div className="text-[#ff4444] text-xs mb-4 uppercase">{errorMsg}</div>}

          <button 
            onClick={generateProject}
            disabled={isGenerating}
            className={`w-full hover:opacity-90 disabled:opacity-50 text-black font-bold text-sm uppercase tracking-widest py-4 rounded transition-colors flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(0,212,255,0.2)] ${
              iotConstructionMode === 'agency' ? 'bg-[#9b59b6] text-white' : 'bg-[#00d4ff]'
            }`}
            style={{ fontFamily: '"Syne", sans-serif' }}
          >
            {isGenerating ? <><Loader2 size={18} className="animate-spin" /> {loadingMsg}</> : <><Cpu size={18} /> {iotConstructionMode === 'agency' ? 'GERAR ESPECIFICAÇÃO DE ENGENHARIA' : 'GERAR PROJETO DE HARDWARE'}</>}
          </button>
        </div>

        {/* RIGHT PANEL - OUTPUT */}
        <div className="w-[60%] flex flex-col bg-[#080808]/50 backdrop-blur-sm">
          {!projeto && !isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-20">
              <Cpu size={80} className="mb-6 text-[#00d4ff]" />
              <h2 className="text-2xl font-bold uppercase tracking-widest mb-4 font-syne">Aguardando Especificações</h2>
              <p className="max-w-md text-sm leading-relaxed">O projeto gerado será renderizado no cluster virtual à direita da tela, contendo diagrama SVG validado, firmware da placa e lista de peças.</p>
            </div>
          ) : isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center">
               <div className="relative mb-6">
                 <Loader2 size={64} className="animate-spin text-[#00d4ff] opacity-80" />
                 <div className="absolute inset-0 blur-2xl bg-[#00d4ff] opacity-20"></div>
               </div>
               <div className="text-[#00d4ff] uppercase tracking-widest font-bold font-syne animate-pulse">{loadingMsg}</div>
               <div className="mt-8 flex gap-2">
                 {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce" style={{animationDelay: `${i*150}ms`}}></div>)}
               </div>
            </div>
          ) : projeto && (
            <>
              {/* TABS */}
              <div className="flex border-b border-[rgba(0,212,255,0.1)] px-4 bg-[#050505]">
                {(() => {
                  const tabs = ['VISÃO GERAL', 'ESQUEMA', 'CÓDIGO', 'COMPONENTES'];
                  if (projeto.analise_briefing) {
                    tabs.push('ANÁLISE TÉCNICA');
                  }
                  tabs.push('REFERÊNCIAS');
                  return tabs.map(t => (
                    <button key={t} onClick={() => setActiveTab(t)}
                      className={`px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === t ? 'text-[#00d4ff] border-[#00d4ff] bg-[#00d4ff]/5' : 'text-gray-600 border-transparent hover:text-gray-400'}`}>
                      {t}
                    </button>
                  ));
                })()}
              </div>

              {/* TAB CONTENT */}
              <div className="flex-1 overflow-y-auto p-8 relative no-scrollbar">
                
                {/* 1. VISÃO GERAL */}
                {activeTab === 'VISÃO GERAL' && (
                  <div className="animate-in fade-in duration-300">
                    <h1 className="text-3xl font-black text-white uppercase tracking-wider mb-2 font-syne">{projeto.titulo}</h1>
                    <p className="text-gray-400 mb-8 max-w-2xl">{projeto.descricao_tecnica}</p>
                    
                    <div className="flex gap-8 items-start">
                       <div className="flex-1">
                          <h3 className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest mb-4">&gt;_ PLATAFORMA ALVO</h3>
                          <div className="border border-[#333] bg-[#0a0a0a] rounded-lg p-6 mb-8 text-center relative overflow-hidden group">
                            <span className="text-[#00d4ff] font-bold text-xl uppercase font-syne z-10 relative block mb-4">{projeto.placa}</span>
                            {projeto.imagem_placa_url && (
                              <img src={projeto.imagem_placa_url} alt={projeto.placa} onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'; }} className="w-full max-w-[200px] h-[150px] object-contain mx-auto mix-blend-screen opacity-70 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                       </div>
                       
                       <div className="flex-1">
                          <h3 className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest mb-4">&gt;_ AVISOS DE SEGURANÇA</h3>
                          <div className="space-y-3">
                             {projeto.avisos_seguranca?.map((av: string, i: number) => (
                               <div key={i} className="flex gap-3 bg-[#ffaa00]/10 border border-[#ffaa00]/30 text-[#ffaa00] p-4 rounded text-sm">
                                 <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                 <p>{av}</p>
                               </div>
                             ))}
                          </div>
                          
                          <h3 className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest mt-8 mb-4">&gt;_ PRÓXIMOS PASSOS</h3>
                          <ul className="space-y-4">
                            {projeto.proximos_passos?.map((passo: string, i: number) => (
                              <li key={i} className="flex gap-4">
                                <span className="text-[#00d4ff] font-bold">0{i+1}</span>
                                <span className="text-gray-300 text-sm">{passo}</span>
                              </li>
                            ))}
                          </ul>
                       </div>
                    </div>
                  </div>
                )}

                {/* 2. ESQUEMA */}
                {activeTab === 'ESQUEMA' && (
                  <div className="animate-in fade-in duration-300">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest">&gt;_ Mapeamento de Pinos</h3>
                        <button onClick={() => downloadFile('esquema.svg', projeto.esquema_ligacao.pinout_svg)} className="flex items-center gap-2 text-[#00d4ff] border border-[#00d4ff]/30 px-4 py-2 rounded text-xs uppercase hover:bg-[#00d4ff]/10">
                          <Download size={14} /> Baixar SVG
                        </button>
                     </div>
                     <div className="bg-[#050505] border border-[#333] rounded-lg p-6 mb-8 flex items-center justify-center overflow-x-auto" 
                          dangerouslySetInnerHTML={{ __html: projeto.esquema_ligacao.pinout_svg.replace(/<style.*?>.*?<\/style>/is, '') }} />
                     
                     <h3 className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest mb-4">&gt;_ Conexões Físicas</h3>
                     <p className="text-gray-400 mb-6 text-sm">{projeto.esquema_ligacao.descricao_textual}</p>
                     
                     <table className="w-full text-sm text-left">
                       <thead className="text-xs text-gray-500 uppercase bg-[#111]">
                         <tr>
                           <th className="px-6 py-3">Origem (DE)</th>
                           <th className="px-6 py-3">Destino (PARA)</th>
                           <th className="px-6 py-3">Intermediário (VIA)</th>
                         </tr>
                       </thead>
                       <tbody>
                         {projeto.esquema_ligacao.conexoes?.map((c: any, i: number) => (
                           <tr key={i} className="bg-[#0a0a0a] border-b border-[#222]">
                             <td className="px-6 py-4 font-bold text-white">{c.de}</td>
                             <td className="px-6 py-4 text-gray-300">{c.para}</td>
                             <td className="px-6 py-4 text-[#ffaa00]">{c.via}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
                )}

                {/* 3. CÓDIGO */}
                {activeTab === 'CÓDIGO' && (
                  <div className="animate-in fade-in duration-300 h-full flex flex-col">
                     <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                             <Code2 size={16} /> Firmware — {projeto.codigo.arquivo_principal}
                          </h3>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={simulateExecution} disabled={isSimulating} className="flex items-center gap-2 text-black font-bold bg-[#00ff88] px-4 py-2 rounded text-xs uppercase hover:bg-[#00cc66] shadow-[0_0_15px_rgba(0,255,136,0.2)]">
                            <Play size={14} fill="currentColor" /> Simular Execução
                          </button>
                          <button onClick={() => copyToClipboard(projeto.codigo.codigo_completo)} className="flex items-center gap-2 text-white border border-[#333] px-3 py-2 rounded text-xs hover:bg-[#222]">
                            <Copy size={14} />
                          </button>
                          <button onClick={() => downloadFile(projeto.codigo.arquivo_principal, projeto.codigo.codigo_completo)} className="flex items-center gap-2 text-white border border-[#333] px-3 py-2 rounded text-xs hover:bg-[#222]">
                            <Download size={14} />
                          </button>
                        </div>
                     </div>
                     
                     <div className="flex-1 bg-[#050505] border border-[#333] rounded overflow-auto relative">
                       <pre className="p-4 text-sm font-mono leading-relaxed h-full overflow-auto">
                         <code className={`language-${projeto.codigo.linguagem.toLowerCase().includes('python') ? 'python' : 'cpp'}`}>
                           {projeto.codigo.codigo_completo}
                         </code>
                       </pre>
                     </div>

                     <div className="mt-6 bg-[#111] p-4 border border-[#333] rounded">
                       <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">Instruções de Upload</h4>
                       <p className="text-gray-300 text-sm whitespace-pre-wrap">{projeto.codigo.instrucoes_upload}</p>
                     </div>
                  </div>
                )}

                {/* 4. COMPONENTES */}
                {activeTab === 'COMPONENTES' && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                       <h3 className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest">&gt;_ Bill of Materials (BOM)</h3>
                       <div className="text-[#00ff88] text-xl font-black">
                         ~ R$ {projeto.preco_total_estimado_brl?.toFixed(2)}
                       </div>
                    </div>

                    <div className="relative overflow-x-auto bg-[#0a0a0a] border border-[#333] rounded-lg">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase bg-[#111]">
                          <tr>
                            <th className="px-6 py-4">Qtd</th>
                            <th className="px-6 py-4">Componente</th>
                            <th className="px-6 py-4">Especificação</th>
                            <th className="px-6 py-4">Onde encontrar</th>
                            <th className="px-6 py-4">Valor Ext.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projeto.componentes?.map((c: any, i: number) => (
                            <tr key={i} className="border-b border-[#222] hover:bg-[#111] transition-colors">
                              <td className="px-6 py-4 font-bold text-white">{c.quantidade}x</td>
                              <td className="px-6 py-4 text-[#00d4ff] font-bold">{c.nome}</td>
                              <td className="px-6 py-4 text-gray-400">{c.especificacao}</td>
                              <td className="px-6 py-4 text-gray-500 text-xs">
                                {c.link_sugerido ? (
                                  <a href={c.link_sugerido} target="_blank" rel="noreferrer" className="hover:text-blue-400 underline decoration-[#333] flex items-center gap-1">
                                    {c.onde_comprar} <ExternalLink size={10} />
                                  </a>
                                ) : (
                                  c.onde_comprar
                                )}
                              </td>
                              <td className="px-6 py-4 text-[#00ff88]">R$ {c.preco_estimado_brl?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                 {/* ANÁLISE TÉCNICA (EXCLUSIVA AGENCY WAY IOT) */}
                 {activeTab === 'ANÁLISE TÉCNICA' && (
                   <div className="animate-in fade-in duration-300 space-y-8">
                     <div>
                       <h2 className="text-[#9b59b6] font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-[#9b59b6]"></span>
                         &gt;_ Análise do Briefing de Entrada
                       </h2>
                       <div className="bg-[#111] border border-white/5 rounded-xl p-6 text-gray-300 text-sm leading-relaxed">
                         {projeto.analise_briefing}
                       </div>
                     </div>

                     {projeto.decisoes_pinagem && projeto.decisoes_pinagem.length > 0 && (
                       <div>
                         <h2 className="text-[#9b59b6] font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-[#9b59b6]"></span>
                           &gt;_ Decisões e Dimensionamento de Pinagem
                         </h2>
                         <div className="overflow-x-auto bg-[#0a0a0a] border border-white/5 rounded-xl">
                           <table className="w-full text-sm text-left">
                             <thead className="text-xs text-gray-400 uppercase bg-[#111]">
                               <tr>
                                 <th className="px-6 py-4">Pino Proposto</th>
                                 <th className="px-6 py-4">Função Atribuída</th>
                                 <th className="px-6 py-4 font-normal">Justificativa Técnica</th>
                               </tr>
                             </thead>
                             <tbody>
                               {projeto.decisoes_pinagem.map((dp: any, i: number) => (
                                 <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                   <td className="px-6 py-4 font-bold text-white font-mono">{dp.pino}</td>
                                   <td className="px-6 py-4 text-[#9b59b6] font-mono">{dp.funcao}</td>
                                   <td className="px-6 py-4 text-gray-400">{dp.justificativa}</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                       </div>
                     )}

                     {projeto.alertas_tecnicos && projeto.alertas_tecnicos.length > 0 && (
                       <div>
                         <h2 className="text-[#9b59b6] font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                           &gt;_ Alertas e Riscos Técnicos Identificados
                         </h2>
                         <div className="space-y-3">
                           {projeto.alertas_tecnicos.map((ale: string, i: number) => (
                             <div key={i} className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl text-sm leading-relaxed">
                               {ale}
                             </div>
                           ))}
                         </div>
                       </div>
                     )}

                     {projeto.comportamento_falha_implementado && (
                       <div>
                         <h2 className="text-[#9b59b6] font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-[#9b59b6]"></span>
                           &gt;_ Lógica Failsafe e Comportamento de Falha
                         </h2>
                         <div className="bg-[#111] border border-white/5 rounded-xl p-6 text-gray-300 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                           {projeto.comportamento_falha_implementado}
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                {/* 5. REFERÊNCIAS */}
                {activeTab === 'REFERÊNCIAS' && (
                  <div className="animate-in fade-in duration-300">
                    <h3 className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest mb-6">&gt;_ DOCUMENTAÇÃO EXTERNA</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {projeto.referencias?.map((ref: any, i: number) => (
                         <a key={i} href={ref.url} target="_blank" rel="noreferrer" className="block p-6 bg-[#0a0a0a] border border-[#rgba(0,212,255,0.1)] rounded-xl hover:border-[#00d4ff]/50 transition-colors group">
                           <h4 className="text-white font-bold mb-2 flex items-center justify-between">
                             {ref.titulo}
                             <ExternalLink size={16} className="text-gray-600 group-hover:text-[#00d4ff]" />
                           </h4>
                           <p className="text-gray-500 text-sm">{ref.descricao}</p>
                           <div className="mt-4 text-[#00d4ff] text-xs font-mono truncate opacity-60 group-hover:opacity-100">{ref.url}</div>
                         </a>
                       ))}
                    </div>
                  </div>
                )}
                
              </div>
            </>
          )}

          {/* SIMULATION TERMINAL OVERLAY */}
          {isSimulating && (
            <div className="absolute inset-0 z-50 bg-[#050505] flex flex-col font-mono" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
               <div className="bg-[#111] p-4 flex justify-between items-center border-b border-[#333]">
                  <div className="flex items-center gap-3">
                     <Terminal size={18} className="text-[#00d4ff]" />
                     <span className="text-[#00d4ff] font-bold text-xs uppercase tracking-widest">IoT Console Emulator</span>
                  </div>
                  <button onClick={() => setIsSimulating(false)} className="text-gray-400 hover:text-white px-3 border border-transparent hover:border-[#444] rounded bg-[#222]">Fechar</button>
               </div>
               <div className="bg-[#ffaa00]/10 border-b border-[#ffaa00]/20 p-2 text-center text-[#ffaa00] text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                 <Info size={14} /> SIMULAÇÃO VIA IA — NÃO É UM EMULADOR DE HARDWARE — VALIDE NO HARDWARE FÍSICO
               </div>
               <div className="flex-1 p-6 overflow-y-auto text-sm leading-relaxed text-[#00d4ff]">
                  {simTerminal.map((linha, i) => (
                    <div key={i} className="mb-1">{linha}</div>
                  ))}
                  <div ref={terminalEndRef} className="animate-pulse opacity-50 block w-2 h-4 bg-[#00d4ff] mt-2"></div>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* SIDEBAR MEUS PROJETOS */}
      {showSidebar && (
        <div className="absolute top-0 right-0 h-full w-[350px] bg-[#0a0a0a] border-l border-[#333] shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
           <div className="p-5 border-b border-[#333] flex justify-between items-center bg-[#111]">
             <h3 className="text-white font-bold uppercase tracking-widest flex items-center gap-2 text-sm"><Layers size={16}/> Meus Projetos IoT</h3>
             <button onClick={() => setShowSidebar(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
             {myProjects.length === 0 ? (
               <div className="text-center text-gray-500 text-sm mt-10">Nenhum projeto salvo.</div>
             ) : myProjects.map(p => (
               <div key={p.id} className="bg-[#111] border border-[#222] p-4 rounded-lg hover:border-[#00d4ff]/30 transition-colors">
                 <div className="flex items-start justify-between mb-2">
                    <h4 className="text-white font-bold text-sm truncate pr-2 flex items-center gap-2"><Cpu size={14} className="text-[#00d4ff] shrink-0" /> {p.nome}</h4>
                 </div>
                 <div className="text-xs text-gray-400 mb-3">{p.hardware} · <span className="text-[#00ff88]">R$ {(p.dados_atuais?.preco_total || p.dados_atuais?.preco_total_estimado_brl || 0).toFixed(2)}</span></div>
                 <div className="text-[10px] text-gray-600 mb-3 uppercase tracking-wider">Criado em: {new Date(p.created_at).toLocaleDateString()}</div>
                 <div className="flex gap-2">
                    <button onClick={() => { setProjeto(normalizeProject(p.dados_atuais, p.hardware, p.nome, p.descricao)); setActiveTab('VISÃO GERAL'); setSelectedPlaca(p.hardware); setShowSidebar(false); }} className="flex-1 border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 py-2 rounded text-xs transition-colors uppercase font-bold tracking-wider">Carregar</button>
                    <button onClick={() => deleteProjeto(p.id)} className="px-3 border border-[#ff4444]/30 text-[#ff4444] hover:bg-[#ff4444]/10 rounded transition-colors"><Trash2 size={14}/></button>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #050505; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}
