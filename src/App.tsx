/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { Type } from '@google/genai';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { 
  Terminal, Code2, Layout as LayoutIcon, Download, Settings, 
  Cpu, HardDrive, Globe, Zap, Loader2, Target, CheckCircle2, 
  Factory, Play, Network, Archive, Clock, ChevronRight, X, RefreshCw,
  Maximize, Minimize, TrendingUp, Users, DollarSign, History
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { temAcesso } from './lib/permissions';
import { IotMonitor } from './components/iot/IotMonitor';
import { EntrySelection } from './components/entry/EntrySelection';
import { TemplatesFlow } from './components/entry/TemplatesFlow';
import { BriefingFlow } from './components/entry/BriefingFlow';
import { useGenerationLimit } from './lib/hooks/useGenerationLimit';
import { incrementGenerationCount } from './lib/services/generationLimitService';
import { SettingsPage } from './components/SettingsPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UpgradeModal } from './components/modals/UpgradeModal';

// Types
type ProjectType = 'SOFTWARE' | 'HARDWARE' | 'HIBRIDO' | 'ENTERPRISE';
type ProjectComplexity = 'BASICO' | 'INTERMEDIARIO' | 'AVANCADO' | 'ENTERPRISE';

interface Question {
  id: string;
  texto: string;
  tipo: 'opcoes' | 'texto';
  opcoes?: string[];
}

interface Classification {
  tipo: ProjectType;
  viabilidade?: 'VIAVEL' | 'PARCIAL' | 'INVIAVEL';
  motivo_inviabilidade?: string;
  complexidade: ProjectComplexity;
  tecnologias: string[];
  perguntas_necessarias: Question[];
  estimativa_minutos: number;
  resumo: string;
}

interface GeneratedNode {
  server_js: string;
  package_json: string;
  env_example: string;
  readme_md: string;
  arquitetura_ascii: string;
  codigo_placa?: string;
  pdf_pecas?: string;
  pdf_montagem?: string;
  pdf_documentacao?: string;
  pdf_setup?: string;
}

interface HistoryItem {
  id: number;
  titulo: string;
  tipo: string;
  data: string;
  htmlGerado: string;
  nodeGerado: GeneratedNode | null;
}

type Phase = 'input' | 'classifying' | 'questions' | 'inviavel' | 'generating' | 'done';
type Tab = 'preview' | 'code' | 'architecture' | 'hardware';

// Helper to bridge AI calls to server-side proxy
const callGeminiApi = async (model: string, contents: string, config?: any) => {
  const userKey = localStorage.getItem('parvus_key') || '';
  
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${apiUrl}/api/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userKey ? { 'X-Gemini-Key': userKey, 'X-Nvidia-Key': userKey } : {})
    },
    body: JSON.stringify({
      model,
      contents,
      config
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let errData: any = {};
    try {
      errData = JSON.parse(errText);
    } catch(e) {
      throw new Error(`Erro HTTP ${response.status}: ${errText.substring(0, 100)}`);
    }
    throw new Error(errData.error || `Erro HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.text
  };
};

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('parvus_key') || '');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const [phase, setPhase] = useState<Phase>('input');
  const [entryFlow, setEntryFlow] = useState<'selection' | 'ai' | 'templates' | 'briefing'>('selection');
  const [currentView, setCurrentView] = useState<'app' | 'marketplace' | 'purchases' | 'admin' | 'iot' | 'settings'>('app');
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [problemDescription, setProblemDescription] = useState('');
  const [classification, setClassification] = useState<Classification | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);
  const [checkoutListing, setCheckoutListing] = useState<any>(null);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [previewProject, setPreviewProject] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const generationLimit = useGenerationLimit();

  const handleSelectEntryFlow = (flow: 'ai' | 'templates' | 'briefing') => {
    if (!generationLimit.loading && !generationLimit.allowed) {
      if (!session) {
        setShowLoginModal(true);
        showToast("Você atingiu o limite de 1 geração de teste grátis como visitante. Faça login/cadastro para continuar!", "error");
      } else {
        setShowUpgradeModal(true);
      }
      return;
    }
    setEntryFlow(flow);
  };

  const [agencyMode, setAgencyMode] = useState(false);

  const checkAdmin = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('profiles').select('is_admin, plano').eq('id', userId).single();
      if (!error && data) {
        setIsAdmin(!!data.is_admin || data.plano === 'admin');
      } else {
        // Fallback checks if column not created yet but manual override
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email === "rehitutcontato@gmail.com") {
          setIsAdmin(true);
        }
      }
    } catch(e) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email === "rehitutcontato@gmail.com") {
        setIsAdmin(true);
      }
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const [generatedNode, setGeneratedNode] = useState<GeneratedNode | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Generation state
  const [logs, setLogs] = useState<{message: string, status: 'pending' | 'done' | 'active' | 'error'}[]>([]);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  
  const consoleRef = useRef<HTMLDivElement>(null);
  
  // Enterprise Form
  const [enterpriseSubmitted, setEnterpriseSubmitted] = useState(false);

  // Initialize AI with current key
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('parvus_key', apiKey);
    } else {
      localStorage.removeItem('parvus_key');
    }
  }, [apiKey]);

  // Check auth session
  useEffect(() => {
    if (!supabase) {
      // Offline fallback
      setCheckingAuth(false);
      setHistory(JSON.parse(localStorage.getItem('parvus_history') || '[]'));
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
      if (session) {
        fetchProjects();
        checkAdmin(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProjects();
        checkAdmin(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (currentView === 'marketplace' && supabase) {
      fetchListings();
    } else if (currentView === 'purchases' && supabase) {
      fetchPurchases();
    } else if (currentView === 'admin' && supabase) {
      fetchAdminData();
    }
  }, [currentView]);

  const fetchListings = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (data && !error) setListings(data);
  };

  const fetchPurchases = async () => {
    if (!supabase || !session) return;
    const { data, error } = await supabase
      .from('marketplace_purchases')
      .select('*, marketplace_listings(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data && !error) setPurchases(data);
  };

  const [adminData, setAdminData] = useState<any>({ pendingListings: [], pendingPurchases: [], allPurchases: [], total: 0 });
  const fetchAdminData = async () => {
    if (!supabase) return;
    const { data: pListings } = await supabase.from('marketplace_listings').select('*').eq('status', 'pending');
    const { data: pPurchases } = await supabase.from('marketplace_purchases').select('*, marketplace_listings(*)').eq('status', 'pending_payment');
    const { data: allPurchases } = await supabase.from('marketplace_purchases').select('*, marketplace_listings(*)').order('created_at', { ascending: false });
    
    setAdminData({ 
      pendingListings: pListings || [], 
      pendingPurchases: pPurchases || [], 
      allPurchases: allPurchases || [],
      total: allPurchases?.filter((p: any) => p.status === 'paid' || p.status === 'download_used').reduce((acc: number, cur: any) => acc + (Number(cur.preco_pago) || 0), 0) || 0 
    });
  };

  const chartData = useMemo(() => {
    if (!adminData.allPurchases || adminData.allPurchases.length === 0) return [];
    const salesByDate: Record<string, number> = {};
    const paidPurchases = adminData.allPurchases.filter((p: any) => p.status === 'paid' || p.status === 'download_used');
    
    paidPurchases.forEach((p: any) => {
      const date = format(parseISO(p.created_at), 'dd/MM/yyyy');
      if (!salesByDate[date]) salesByDate[date] = 0;
      salesByDate[date] += Number(p.preco_pago);
    });
    
    return Object.keys(salesByDate).sort((a,b) => {
      const [da,ma,ya] = a.split('/');
      const [db,mb,yb] = b.split('/');
      return new Date(`${ya}-${ma}-${da}`).getTime() - new Date(`${yb}-${mb}-${db}`).getTime();
    }).map(date => ({
      date,
      Receita: salesByDate[date]
    }));
  }, [adminData.allPurchases]);

  const handleBuy = async (listing: any) => {
    if (!supabase || !session) return;
    setCheckoutListing(listing);
  };

  const processCheckout = async (listing: any) => {
    if (!supabase || !session) return;
    setCheckoutListing(null);
    try {
      const ref = 'AUTOMATE-' + Math.floor(100000 + Math.random() * 900000);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      const { data, error } = await supabase.from('marketplace_purchases').insert({
        user_id: session.user.id,
        listing_id: listing.id,
        preco_pago: listing.preco,
        status: 'pending_payment',
        chave_pix_ref: ref,
        expires_at: expiresAt.toISOString()
      }).select().single();

      if (error) {
        if (error.code === '23505') {
           showToast('Você já tem uma compra (pendente ou paga) desta automação. Verifique "MINHAS COMPRAS".', 'error');
           setCurrentView('purchases');
        } else {
          throw error;
        }
      } else {
        showToast('Compra iniciada! Finalize o pagamento na aba MINHAS COMPRAS.', 'success');
        setCurrentView('purchases');
      }
    } catch (e: any) {
      showToast('Erro ao iniciar compra: ' + e.message, 'error');
    }
  };

  const fetchProjects = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (data && !error) {
      const formatted = data.map(dbItem => ({
        id: dbItem.id, // using uuid as id now
        titulo: dbItem.titulo,
        tipo: dbItem.tipo,
        data: new Date(dbItem.created_at).toLocaleString('pt-BR'),
        htmlGerado: dbItem.html_gerado,
        nodeGerado: dbItem.node_gerado
      }));
      setHistory(formatted as any);
    }
  };

  // Persist history if offline
  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('parvus_history', JSON.stringify(history));
    }
  }, [history]);

  // Auto-scroll logs
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string, status: 'pending' | 'done' | 'active' | 'error' = 'active') => {
    setLogs(prev => [...prev.filter(l => l.message !== message), {message, status}]);
  };

  const updateLog = (message: string, status: 'pending' | 'done' | 'active' | 'error') => {
    setLogs(prev => prev.map(l => l.message === message ? {...l, status} : l));
  };

  const handleAnalyze = async (overrideDescription?: string | any) => {
    const descToUse = typeof overrideDescription === 'string' ? overrideDescription : problemDescription;
    if (!descToUse.trim()) return;

    if (!generationLimit.loading && !generationLimit.allowed) {
      if (!session) {
        setShowLoginModal(true);
        showToast("Você atingiu o limite de geração de teste gratuita como visitante. Faça login/cadastro para continuar!", "error");
      } else {
        setShowUpgradeModal(true);
      }
      return;
    }

    setPhase('classifying');
    addLog('> Analisando problema...', 'active');
    
    try {
      const prompt = `Você é um classificador de problemas de automação sênior e arquiteto de software de elite.
Sua missão é realizar uma auditoria profunda do que o usuário realmente pede vs. o que ele precisa para criar um software de excelência.
Ao invés de gerar perguntas genéricas, selecione de 2 a 3 perguntas críticas específicas para guiar as variáveis do sistema, as regras de negócio mais finas e a estrutura técnica desse escopo.

DIRETRIZES DE PERGUNTAS DE ACORDO COM O DOMÍNIO DA SOLUÇÃO:
- Se for um CRM/Pipelines: Pergunte qual o KPI principal (Conversão, Acompanhamento, Retenção), quantidade de etapas no funil, e se há integrações externas específicas.
- Se for Agenda/Calendário/Reservas: Pergunte o tipo de agendamento (interno/cliente/ambos), duração padrão da sessão, e regras de colisão de horários.
- Se for Automação WhatsApp/Cobrança/Robôs de Conversa: Pergunte qual o gatilho exato (ex: novo lead, fatura pendente), a sequência de mensagens, e se precisa de logs de rastreio de leitura.
- Se for Calculadoras de Comissão/Impostos, Conversores de Dados, Ferramentas Financeiras ou Utilitários Administrativos: Pergunte sobre as regras de cálculo e fórmulas de negócio (porcentagem fixa, bônus progressivo, taxas dinâmicas), quais campos de entrada o usuário deseja fornecer para processar, e qual a visualização/relatório ideal (gráficos interativos, tabelas exportáveis, etc.).
- Se for Dashboards/IoT/Painéis de Dados: Pergunte de onde vêm os registros em tempo real (dados manuais simulados, webhooks de sensores físicos, banco local), os limites críticos para alertas, e quais atuadores controlar.

Obrigatoriedade de Perguntas: Para QUALQUER cenário, selecione e crie de 2 a 3 perguntas precisas que se adaptem perfeitamente ao problema. Não retorne um array de perguntas vazio; faça as perguntas necessárias para que a geração do código backend e da interface fique impecavelmente fiel ao que o usuário precisa.

Analise o problema abaixo e retorne APENAS um JSON válido seguindo estritamente esse modelo.
Problema: ${descToUse}`;

      const response = await callGeminiApi('gemini-2.0-flash', prompt, {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tipo: { type: Type.STRING, enum: ['SOFTWARE', 'HARDWARE', 'HIBRIDO', 'ENTERPRISE'] },
            viabilidade: { type: Type.STRING, enum: ['VIAVEL', 'PARCIAL', 'INVIAVEL'] },
            motivo_inviabilidade: { type: Type.STRING },
            complexidade: { type: Type.STRING, enum: ['BASICO', 'INTERMEDIARIO', 'AVANCADO', 'ENTERPRISE'] },
            tecnologias: { type: Type.ARRAY, items: { type: Type.STRING } },
            perguntas_necessarias: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  texto: { type: Type.STRING },
                  tipo: { type: Type.STRING, enum: ['opcoes', 'texto'] },
                  opcoes: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['id', 'texto', 'tipo']
              }
            },
            estimativa_minutos: { type: Type.NUMBER },
            resumo: { type: Type.STRING }
          },
          required: ['tipo', 'viabilidade', 'complexidade', 'tecnologias', 'perguntas_necessarias', 'estimativa_minutos', 'resumo']
        }
      });

      let jsonStr = response.text || '{}';
      const startObj = jsonStr.indexOf('{');
      const endObj = jsonStr.lastIndexOf('}');
      if (startObj >= 0 && endObj >= 0) {
        jsonStr = jsonStr.substring(startObj, endObj + 1);
      }
      
      const result = JSON.parse(jsonStr) as Classification;
      if (!result.tecnologias) result.tecnologias = [];
      if (!result.perguntas_necessarias) result.perguntas_necessarias = [];
      
      setClassification(result);
      
      updateLog('> Analisando problema...', 'done');
      
      if (result.viabilidade === 'INVIAVEL') {
        setPhase('inviavel');
        return;
      }

      if (result.perguntas_necessarias && result.perguntas_necessarias.length > 0) {
        setPhase('questions');
      } else {
        handleGenerate(result, {});
      }
      
    } catch (error) {
      console.error(error);
      updateLog(`> Erro ao classificar: ${error}`, 'done');
      setPhase('input');
      showToast("Ocorreu um erro ao analisar o problema. Verifique sua API Key ou tente novamente.", "error");
    }
  };

  const cleanAndExtractHtml = (rawText: string): string => {
    let cleaned = rawText.trim();
    
    // 1. Try to find the start of the HTML code block
    const htmlBlockIndicator = "```html";
    const anyBlockIndicator = "```";
    
    if (cleaned.includes(htmlBlockIndicator)) {
      const startIndex = cleaned.indexOf(htmlBlockIndicator) + htmlBlockIndicator.length;
      cleaned = cleaned.substring(startIndex).trim();
      if (cleaned.includes("```")) {
        cleaned = cleaned.substring(0, cleaned.lastIndexOf("```")).trim();
      }
    } else if (cleaned.includes(anyBlockIndicator)) {
      const startIndex = cleaned.indexOf(anyBlockIndicator) + anyBlockIndicator.length;
      cleaned = cleaned.substring(startIndex).trim();
      if (cleaned.includes("```")) {
        cleaned = cleaned.substring(0, cleaned.lastIndexOf("```")).trim();
      }
    }
    
    // 2. Extra safeguard: extract strictly from <!DOCTYPE or <html to </html> or end of string
    const lower = cleaned.toLowerCase();
    let startIdx = lower.indexOf('<!doctype html');
    if (startIdx === -1) {
      startIdx = lower.indexOf('<html');
    }
    
    if (startIdx !== -1) {
      let endIdx = lower.lastIndexOf('</html>');
      if (endIdx !== -1) {
        cleaned = cleaned.substring(startIdx, endIdx + 7);
      } else {
        cleaned = cleaned.substring(startIdx);
      }
    }
    
    return cleaned.trim();
  };

  const handleGenerate = async (classData: Classification, userAnswers: Record<string, string>) => {
    setPhase('generating');
    setGeneratingProgress(10);
    setLogs([]);
    
    addLog('> Iniciando geração de solução...', 'done');
    
    try {
      const answersText = Object.entries(userAnswers).map(([k, v]) => {
        const q = classData.perguntas_necessarias.find(q => q.id === k);
        return `${q?.texto || k}: ${v}`;
      }).join('\n');

      let currentHtml = '';
      let currentNode: GeneratedNode | null = null;

      // 1. Generate Frontend
      setGeneratingProgress(30);
      addLog('> Arquitetando solução frontend...', 'active');
      
      const frontendPrompt = `Você é um engenheiro frontend de elite da Parvus Automate. Sua missão é gerar uma interface web magnífica, altamente interativa, estilosa e profissional para resolver o seguinte problema.

PROBLEMA: ${problemDescription}
TIPO: ${classData.tipo}
RESPOSTAS: \n${answersText}

⚡ REQUISITOS DE DESIGN E UX (ULTRA POLIDO):
1. CORES E TEMA: Use um tema dark cibernético luxuoso (fundo principal em tom profundo como bg-[#0d0e12] ou bg-[#070709]). Use gradientes e efeitos de bordas brilhantes/glowing com tons como verde esmeralda (#00ff88), azul cobalto profundo (#0066ff) ou laranja neon/yellow.
2. GLASSMORPHISM: Aplique nas divisões de cards ou painéis a classe "backdrop-blur-md bg-white/[0.02] border border-white/10" para um acabamento limpo.
3. ESTILO DE BOTÕES: Efeitos de transição ricos (duration-300), sombras de hover sutis e cantos arredondados modernos (rounded-xl ou rounded-2xl). Evite botões básicos cinzas ou azuis padrão.
4. ÍCONES E FONTES: Carregue fontes elegantes do Google Fonts (como "Plus Jakarta Sans" ou "Space Grotesk") e use ícones modernos (use SVGs Inline refinados ou Lucide Icons via CDN para renderizar ícones bonitos).
5. RESPONSIVIDADE: O layout deve rodar magnificamente em computadores desktop (com barra lateral estruturada e painel de controle principal espaçoso) e adaptar-se perfeitamente a dispositivos móveis.

⚡ ARQUITETURA DA INTERFACE (COMPONENTES OBRIGATÓRIOS):
- HEADER HIGH-TECH: Logo bonita do sistema, indicador ativo com animação pulsante ("● SIMULAÇÃO DE FLUXO ATIVA"), latência simulada (ex: 22ms) e contador de novos eventos ou notificações.
- SIDEBAR DE NAVEGAÇÃO: Abas navegáveis adaptadas ao domínio (ex: se for CRM, use "Kanban, Métricas, Leads"; se for Calculadora ou Utilitário, use "Painel de Cálculo, Histórico, Configurações de Fórmulas"; de forma geral crie abas que façam sentido para o problema do usuário!).
- CARDS DE MÉTRICAS / KPI (MÍNIMO 3 CARDS): Mostre dados em tempo real ou simulações relevantes à aplicação (ex: taxa de conversão %, total de comissões calculadas, ou transações criadas, alertas emitidos). Inclua mini-charts visuais usando SVG.
- ÁREA DE TRABALHO CENTRAL (TOTALMENTE INTERATIVA E FUNCIONAL):
  - Se for CRM/Pipelines: Quadro Kanban real com colunas estilizadas. Permita arrastar leads de um estágio para outro, criar novos leads através de modal com campos detalhados, e abrir detalhes do lead para editar e salvar! 
  - Se for Agenda/Calendário: Visualizador de agenda em grid mensal ou semanal. Mostre slots brilhando e permita clicar num horário livre para agendar verdadeiramente (abre modal, define dados, adiciona à lista com som visual de sucesso).
  - Se for WhatsApp / Automações de Chat / Robôs: Um editor de fluxos gráfico interativo na tela (caixas conectáveis simulando nós ou sequência lógica), um chat de simulação ao vivo (onde é possível digitar algo e ver o chatbot simulado responder imediatamente), e um histórico de logs rolável.
  - Se for Dashboards / Painéis Industriais / IoT: Gráficos de telemetria SVG dinâmicos que se atualizam sozinhos a cada 2 segundos. Toggle botões para ligar/desligar atuadores/relés virtuais com animação e som visual realista.
  - Se for Finanças, Pagamentos, Checkout ou Calculadoras Técnicas: Simulador e processador dinâmico de cálculos/fórmulas matemáticas ou link de faturamento de forma 100% interativa. Adicione formulários interativos para preenchimento de dados de simulação (como valor da venda, metas, descontos, alíquotas), recalcule e plote instantaneamente gráficos SVG de pizza ou barras com o resultado dividido! Ofereça controles para salvar simulações na tabela do histórico, editar taxas diretamente no painel e simular relatório.
- CONSOLE DE LOGS DO SISTEMA: Um painel no rodapé ou na lateral direita simulando a recepção de webhooks em tempo real e processamento do sistema (ex: "[WEBHOOK] Novo lead de Mariana Silveira (marianasilveira@email.com) recebido", "[DISPARO] Automatização 'Boas-vindas' executada com sucesso", etc.). Use um timer para injetar novos logs a cada poucos segundos!
- SUPORTE A MODO DEMO ROBUSTO (COM CONTROLES DE SIMULAÇÃO): Inclua um painel explícito ("Painel de Simulação") com botões rápidos como: "Simular Entrada de Webhook", "Gerar Novo Lead Aleatório", "Disparar Alerta de Teste", "Limpar Histórico". Isso faz com que a interface pareça viva e 100% testável logo de cara!

REGRAS TÉCNICAS ABSOLUTAS:
- Retorne APENAS o código HTML/JS/CSS limpo. NÃO inclua delimitadores markdown de bloco HTML (como as três crases com a palavra html) in hipótese alguma! Comece diretamente com <!DOCTYPE html>.
- O código Javascript inserido no script deve gerenciar de forma impecável todo o estado simulado em memória local (use arrays de objetos pré-carregados com pelo menos 10 registros fictícios detalhados para parecer preenchido).
- Zero placeholders ou comentários do tipo "// adicione código aqui". Tudo precisa estar totalmente implementado e funcional de ponta a ponta.
- Use Tailwind CSS via CDN (<script src="https://unpkg.com/@tailwindcss/browser@4"></script>).
${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Construa o código 100% white-label, sem qualquer menção à "Parvus Automate". Insira no cabeçalho ou nas configurações rápidas uma marca personalizável ou um local para o cliente final logar.\n' : ''}`;

      const responseHtml = await callGeminiApi('gemini-2.0-flash', frontendPrompt, {
        temperature: 0.2
      });
      
      // Clean markdown formatting if present with hyper-robust utility
      let finalHtml = cleanAndExtractHtml(responseHtml.text || '');

      currentHtml = finalHtml;
      setGeneratedHtml(finalHtml);
      updateLog('> Arquitetando solução frontend...', 'done');

      // 2. Generate Backend Node.js
      setGeneratingProgress(70);
      addLog('> Arquitetando solução backend...', 'active');
      
      const backendPrompt = `Você é um engenheiro sênior de infraestrutura e backend Node.js. Sua tarefa é arquitetar e gerar o projeto de microsserviço Express completo, limpo, robusto e perfeitamente estruturado para apoiar o seguinte problema.

PROBLEMA: ${problemDescription}
TIPO: ${classData.tipo}
RESPOSTAS: \n${answersText}

⚡ REQUISITOS DE SOFTWARE E ENGENHARIA DE BACKEND (ULTRA POLIDO):
1. MIDDLEWARES OBRIGATÓRIOS: Configure middlewares para CORS, Express JSON parser, Express URLencoded e um Logger customizado enriquecido para exibir requisições no console do servidor em português.
2. ROTAS E ENDPOINTS DE PRODUÇÃO:
   - Rotas de Verificação: Endpoint GET /api/health retornando status de funcionamento e latência simulada de banco de dados.
   - CRUDs Completos: Endpoints GET, POST, PUT e DELETE implementados com lógica real de manipulação de dados em memória local (usando objetos carregados na inicialização do script), simulando persistência a um banco.
   - Webhooks Receivers: Endpoints POST específicos para receber Webhooks externos (ex: webhook de leads de parceiros, webhook de notificações, webhook de sensores IoT). Faça logs muito claros em português para cada requisição recebida!
3. TRATAMENTO DE ERROS FLUIDO: Bloco try/catch global com tratamento adequado para rotas não encontradas (404) e erros genéricos (500), devolvendo mensagens limpas no formato JSON.
4. COMENTÁRIOS EXPLICATIVOS: Inclua comentários técnicos ricos explicando as rotas, simulações em memória e variáveis.

INSTRUÇÕES ESPECÍFICAS DE ACORDO COM O TIPO DE SISTEMA:
- Para CRM / Pipelines:
  - Banco (README): Defina o esquema SQL de 4 tabelas (leads, interactions, stages, users) com chaves estrangeiras, índices de performance recomendados e triggers para atualização de logs.
  - APIs: GET /api/leads, POST /api/leads para criar leads com validação, PUT /api/leads/:id para troca de estágio de funil, POST /api/webhooks/lead para capturar leads externos em tempo real.
- Para Agenda / Calendário / Reservas:
  - Banco (README): Defina o esquema SQL de tabelas (appointments, users, availability_rules, slots).
  - APIs: GET /api/appointments, POST /api/appointments para reservas com validação avançada (não permitindo sobreposição ou colisão de horários), GET /api/availability para consultar horários disponíveis de acordo com regras de disponibilidade.
- Para WhatsApp / Automações de Chat / Robôs / CRM Chat:
  - Banco (README): Tabelas (whatsapp_automations, whatsapp_messages, whatsapp_logs, templates).
  - APIs: GET /api/automations para listar sequências, POST /api/webhooks/whatsapp para capturar novas mensagens recebidas, POST /api/messages/send como microsserviço de envio (simulando integração transparente com Twilio/Z-API, com suporte à interpolação de variáveis como {{nome}}, {{link}}, etc.).
- Para Dashboards / Painéis Industriais / IoT:
  - Banco (README): Tabelas (devices, telemetry_logs, system_alerts).
  - APIs: POST /api/telemetry para receber dados brutos de sensores IoT com verificação de limites (dispara Alerta se valor de temperatura/pressão for crítico), GET /api/alerts para listar alertas ativos, GET /api/devices para status de atuadores.
- Para Finanças, Pagamentos, Checkout, Calculadoras Técnicas, Utilitários Administrativos ou Ferramentas de Produtividade:
  - Banco (README): Tabelas (calculation_logs, users, formulas_config, sales_targets, transactions, invoices).
  - APIs: GET /api/calculations para obter o histórico de execuções de fórmulas/simulações, POST /api/calculations para salvar e processar um novo cálculo em lote (validando as fórmulas matemáticas e limites de taxas no servidor de forma matemática e segura), PUT /api/formulas para atualizar as porcentagens, descontos e regras de negócio das fórmulas. Ofereça também endpoints de faturamento fictício e logs de transações.

⚡ REGRAS DE RETORNO DO JSON:
- No README: Detalhe o diagrama de arquitetura do sistema em arte ASCII e liste os passos exatos de deploy (Railway, Vercel ou VPS Ubuntu).
- Em package.json: Certifique-se de preencher as dependências corretas (express, cors, dotenv, helmet, pg, drizzle-orm).
- Em env_example: Adicione todas as variáveis necessárias de banco de dados, portas e chaves simuladas.
${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Remova qualquer referência à marca "Parvus Automate" e crie um esqueleto 100% white-label.\n' : ''}`;

      const responseNode = await callGeminiApi('gemini-2.0-flash', backendPrompt, {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            server_js: { type: Type.STRING },
            package_json: { type: Type.STRING },
            env_example: { type: Type.STRING },
            readme_md: { type: Type.STRING },
            arquitetura_ascii: { type: Type.STRING }
          },
          required: ['server_js', 'package_json', 'env_example', 'readme_md', 'arquitetura_ascii']
        }
      });

      let responseNodeText = responseNode.text || '{}';
      const nodeStartObj = responseNodeText.indexOf('{');
      const nodeEndObj = responseNodeText.lastIndexOf('}');
      if (nodeStartObj >= 0 && nodeEndObj >= 0) {
        responseNodeText = responseNodeText.substring(nodeStartObj, nodeEndObj + 1);
      }

      let nodeData: GeneratedNode;
      try {
        nodeData = JSON.parse(responseNodeText) as GeneratedNode;
      } catch (parseErr: any) {
        console.error("JSON PARSE ERROR:", parseErr, responseNodeText);
        addLog('> Aviso: Falha ao interpretar estrutura Node.js retornada pela IA.', 'error');
        nodeData = {
          server_js: "// Falha na geração Node.js\n// " + String(parseErr),
          package_json: "{}",
          env_example: "PORT=3000",
          readme_md: "Houve uma falha na montagem do projeto Node.",
          arquitetura_ascii: ""
        };
      }
      currentNode = nodeData;

      updateLog('> Arquitetando solução backend...', 'done');
      
      // 3. Generate Hardware / IoT specific codes if necessary
      if (classData.tipo === 'HARDWARE' || classData.tipo === 'HIBRIDO') {
        setGeneratingProgress(85);
        addLog('> Gerando artefatos de hardware e PDFs...', 'active');
        
        const iotPrompt = `Você é um engenheiro de hardware e eletrônica sênior especializado em sistemas embarcados e IoT da Parvus Automate. Sua missão é projetar e documentar a solução física completa para:
PROBLEMA: ${problemDescription}
TIPO: ${classData.tipo}
RESPOSTAS: \n${answersText}
        
⚡ REQUISITOS TÉCNICOS DETALHADOS DE HARDWARE:
1. 'codigo_placa': Deve ser um código C++ extremamente robusto e compilável para Arduino IDE (visando ESP32 ou ESP8266), ou código em MicroPython limpo. Inclua comentários ricos e didáticos em português para que o usuário saiba quais pinos conectar de forma exata e como configurar sua rede Wi-Fi/Server Webhooks.
2. 'pdf_pecas': Liste de forma minuciosa todos os componentes eletrônicos necessários (ex: tipo exato de sensor, microcontrolador, resistores de pull-up, relés, cabos, fontes de alimentação recomendadas com especificações de proteção). Adicione preços médios realistas de mercado em reais (R$) para cada item e links fictícios de comércio elétrico seguro no Brasil.
3. 'pdf_montagem': Explique de forma detalhada as conexões físicas. Forneça diagramas técnicos esquemáticos refinados usando diagramação ASCII elegante (ex: mostrando portas GPIO conectadas a pinos VCC, GND e portas de dados do sensor).
4. 'pdf_documentacao': Documente o fluxo lógico do firmware embarcado (como funciona o loop infinito, tempos de amostragem/debounce de botões, e controle de watchdog para evitar panes).
5. 'pdf_setup': Um passo a passo infalível em português ensinando como instalar drivers de placas (CH340/CP2102), configurar as preferências da IDE Arduino, instalar bibliotecas necessárias (PubSubClient, DHT, Adafruit, etc.) e carregar o código para a placa física.
- Se houver manuseio de corrente alternada (110V/220V), adicione avisos de segurança rigorosos com destaque ("⚠️ ALERTA DE SEGURANÇA 110V/220V").
${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Remova qualquer referência à marca Parvus Automate ou a marcas específicas, use white-label e torne tudo vendível.\n' : ''}`;

        const responseIoT = await callGeminiApi('gemini-2.0-flash', iotPrompt, {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              codigo_placa: { type: Type.STRING },
              pdf_pecas: { type: Type.STRING },
              pdf_montagem: { type: Type.STRING },
              pdf_documentacao: { type: Type.STRING },
              pdf_setup: { type: Type.STRING }
            },
            required: ['codigo_placa', 'pdf_pecas', 'pdf_montagem', 'pdf_documentacao', 'pdf_setup']
          }
        });
        
        let responseIoTText = responseIoT.text || '{}';
        const iotStartObj = responseIoTText.indexOf('{');
        const iotEndObj = responseIoTText.lastIndexOf('}');
        if (iotStartObj >= 0 && iotEndObj >= 0) {
          responseIoTText = responseIoTText.substring(iotStartObj, iotEndObj + 1);
        }
  
        let iotData: any;
        try {
          iotData = JSON.parse(responseIoTText);
        } catch (parseErr: any) {
          console.error("JSON PARSE ERROR IOT:", parseErr, responseIoTText);
          iotData = {
            codigo_placa: "// Falha ao gerar código da placa\n" + String(parseErr),
            pdf_pecas: "Falha na geração.",
            pdf_montagem: "",
            pdf_documentacao: "",
            pdf_setup: ""
          };
        }
        
        currentNode.codigo_placa = iotData.codigo_placa;
        currentNode.pdf_pecas = iotData.pdf_pecas;
        currentNode.pdf_montagem = iotData.pdf_montagem;
        currentNode.pdf_documentacao = iotData.pdf_documentacao;
        currentNode.pdf_setup = iotData.pdf_setup;
        
        updateLog('> Gerando artefatos de hardware e PDFs...', 'done');
      }

      setGeneratedNode(currentNode);
      
      // 4. Finalize
      setGeneratingProgress(100);
      addLog('> Configurando integrações...', 'active');
      await new Promise(r => setTimeout(r, 1000));
      updateLog('> Configurando integrações...', 'done');
      addLog('> Sistema pronto.', 'done');

      // Save to history and Database
      const newHistoryItem: any = {
        id: Date.now(), // Fallback if offline
        titulo: problemDescription.substring(0, 50) + '...',
        tipo: classData.tipo,
        data: new Date().toLocaleString('pt-BR'),
        htmlGerado: currentHtml,
        nodeGerado: currentNode
      };

      if (supabase && session) {
        const { data, error } = await supabase.from('projects').insert({
          user_id: session.user.id,
          titulo: problemDescription.substring(0, 50) + '...',
          problema: problemDescription,
          tipo: classData.tipo,
          complexidade: classData.complexidade,
          tecnologias: classData.tecnologias,
          html_gerado: currentHtml,
          node_gerado: currentNode,
          arquitetura_ascii: currentNode?.arquitetura_ascii || '',
          respostas: answers,
          status: 'gerado'
        }).select().single();

        if (data && !error) {
           newHistoryItem.id = data.id;
           setCurrentProjectId(data.id);
        }
      } else {
         setCurrentProjectId(String(newHistoryItem.id));
      }

      setHistory(prev => [newHistoryItem, ...prev]);

      if (session && supabase) {
        await incrementGenerationCount(session.user.id, supabase);
        generationLimit.refreshLimit();
      } else {
        const guestCount = parseInt(localStorage.getItem('parvus_free_generations_done') || '0', 10);
        localStorage.setItem('parvus_free_generations_done', String(guestCount + 1));
        generationLimit.refreshLimit();
      }

      setTimeout(() => setPhase('done'), 1000);

    } catch (error) {
      console.error(error);
      updateLog(`> Falha na geração: ${error}`, 'done');
      showToast("Falha ao gerar código. Verifique o console.", "error");
      setPhase('input');
    }
  };

  const loadHistoryProject = (item: HistoryItem) => {
    setEntryFlow('ai');
    setGeneratedHtml(item.htmlGerado);
    setGeneratedNode(item.nodeGerado);
    setCurrentProjectId(String(item.id));
    setClassification({
      tipo: item.tipo as ProjectType,
      complexidade: 'BASICO', // Fallback, could be persisted
      tecnologias: [],
      perguntas_necessarias: [],
      estimativa_minutos: 5,
      resumo: item.titulo
    });
    setPhase('done');
    setActiveTab('preview');
  };

  const downloadPurchasedProject = async (projectId: string, nome: string) => {
    if (!supabase) return;
    try {
      const { data: proj, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (error || !proj) {
        console.error("Erro no download:", error);
        showToast('Erro ao carregar arquivos do projeto.', 'error');
        return;
      }
      
      const zip = new JSZip();
      
      // Save HTML
      if (proj.html_gerado) {
        zip.file('index.html', proj.html_gerado);
      }
      
      // Save Node Backend
      if (proj.node_gerado) {
        zip.file('server.js', proj.node_gerado.server_js);
        zip.file('package.json', proj.node_gerado.package_json);
        zip.file('.env.example', proj.node_gerado.env_example);
        zip.file('README.md', proj.node_gerado.readme_md);
      }
      
      const content = await zip.generateAsync({type: 'blob'});
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parvus-${nome.replace(/\s+/g, '-').toLowerCase()}.zip`;
      a.click();
    } catch (err: any) {
      showToast('Erro ao baixar: ' + err.message, 'error');
    }
  };

  const downloadPurchasedManual = async (projectId: string, nome: string) => {
    if (!supabase) return;
    try {
       // Since PDF generation from IoT module exists, for MVP software we just put README into a blob or simple html
       const { data: proj, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
       if (error || !proj) throw new Error("Projeto não encontrado.");

       let manual = `MANUAL DE IMPLEMENTAÇÃO - ${nome}\n\n`;
       if (proj.node_gerado?.readme_md) manual += proj.node_gerado.readme_md;
       else manual += "Sem instruções específicas encontradas para este projeto.";

       const blob = new Blob([manual], {type: 'text/plain'});
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `MANUAL-${nome.replace(/\s+/g, '-').toLowerCase()}.txt`;
       a.click();

    } catch(err: any) {
      showToast('Erro ao baixar manual: ' + err.message, 'error');
    }
  };

  const downloadHtml = () => {
    const blob = new Blob([generatedHtml], {type: 'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `parvus-automacao-${Date.now()}.html`;
    a.click();
  };

  const downloadNode = async () => {
    if (!generatedNode) return;
    const zip = new JSZip();
    zip.file('server.js', generatedNode.server_js);
    zip.file('package.json', generatedNode.package_json);
    zip.file('.env.example', generatedNode.env_example);
    zip.file('README.md', generatedNode.readme_md);
    
    const pub = zip.folder('public');
    if (pub) {
      pub.file('index.html', generatedHtml);
    }
    
    const blob = await zip.generateAsync({type: 'blob'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `parvus-automacao-nodejs-${Date.now()}.zip`;
    a.click();
  };

  const gerarPDF = (conteudo: string, nomeArquivo: string) => {
    if (!conteudo) return;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const cores = {
      preto: [10, 10, 10],
      verde: [0, 200, 100],
      cinza: [100, 100, 100],
      cinzaClaro: [240, 240, 240]
    };

    doc.setFillColor(cores.preto[0], cores.preto[1], cores.preto[2]);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PARVUS AUTOMATE', 14, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(nomeArquivo.toUpperCase(), 14, 16);
    doc.text(new Date().toLocaleDateString('pt-BR'), 180, 16, { align: 'right' });

    doc.setTextColor(cores.preto[0], cores.preto[1], cores.preto[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    let y = 30;
    const linhas = doc.splitTextToSize(conteudo, 182);

    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        if (linha.includes('━') || linha.match(/^[A-Z\s]{5,}$/)) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(cores.verde[0], cores.verde[1], cores.verde[2]);
        } else if (linha.startsWith('⚠️') || linha.startsWith('ATENÇÃO')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(220, 80, 0);
        } else if (linha.startsWith('□')) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(cores.preto[0], cores.preto[1], cores.preto[2]);
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(cores.preto[0], cores.preto[1], cores.preto[2]);
        }

        doc.text(linha, 14, y);
        y += 6;
    }

    const totalPaginas = doc.getNumberOfPages();
    for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        doc.setFillColor(cores.cinzaClaro[0], cores.cinzaClaro[1], cores.cinzaClaro[2]);
        doc.rect(0, 285, 210, 12, 'F');
        doc.setFontSize(8);
        doc.setTextColor(cores.cinza[0], cores.cinza[1], cores.cinza[2]);
        doc.text('Parvus Automate — parvus.space', 14, 292);
        doc.text(`Página ${i} de ${totalPaginas}`, 196, 292, { align: 'right' });
    }

    doc.save(`parvus-${nomeArquivo}-${Date.now()}.pdf`);
  };

  const createPdfBlob = (conteudo: string): Blob => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const linhas = doc.splitTextToSize(conteudo, 180);
    for (let i = 0; i < linhas.length; i++) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(linhas[i], 15, y);
      y += 6;
    }
    return doc.output('blob');
  };

  const downloadTodosIoT = async () => {
    if (!generatedNode) return;
    
    const zip = new JSZip();
    if (generatedNode.codigo_placa) zip.file('codigo_placa.cpp', generatedNode.codigo_placa);
    
    const backendZip = new JSZip();
    backendZip.file('server.js', generatedNode.server_js);
    backendZip.file('package.json', generatedNode.package_json);
    backendZip.file('.env.example', generatedNode.env_example);
    zip.file('backend.zip', await backendZip.generateAsync({type: 'blob'}));
    
    zip.file('frontend.html', generatedHtml);

    if (generatedNode.pdf_pecas) zip.file('Lista_de_Pecas.pdf', createPdfBlob(generatedNode.pdf_pecas));
    if (generatedNode.pdf_montagem) zip.file('Manual_de_Montagem.pdf', createPdfBlob(generatedNode.pdf_montagem));
    if (generatedNode.pdf_documentacao) zip.file('Documentacao_Tecnica.pdf', createPdfBlob(generatedNode.pdf_documentacao));
    if (generatedNode.pdf_setup) zip.file('Guia_de_Setup.pdf', createPdfBlob(generatedNode.pdf_setup));

    const content = await zip.generateAsync({type: 'blob'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `parvus-iot-project-${Date.now()}.zip`;
    a.click();
  };

  const resetAll = () => {
    setEntryFlow('selection');
    setPhase('input');
    setProblemDescription('');
    setClassification(null);
    setAnswers({});
    setGeneratedHtml('');
    setGeneratedNode(null);
    setCurrentProjectId(null);
  };

  const handleTemplateGenerate = async (template: any, answers: Record<string, string>) => {
    if (!generationLimit.loading && !generationLimit.allowed) {
      if (!session) {
        setShowLoginModal(true);
        showToast("Você atingiu o limite de geração de teste gratuita como visitante. Faça login/cadastro para continuar!", "error");
      } else {
        setShowUpgradeModal(true);
      }
      return;
    }
    
    setEntryFlow('ai');
    setPhase('generating');
    setGeneratingProgress(15);
    setLogs([]);
    setCurrentProjectId(null);
    setProblemDescription(`Template: ${template.nome}\nRespostas: ${JSON.stringify(answers)}`);
    
    // Normalize HÍBRIDO vs HIBRIDO
    const normalizedTipo = template.tipo === 'HÍBRIDO' ? 'HIBRIDO' : template.tipo;
    const isBasic = template.complexidade === 'BÁSICO';
    const isMedium = template.complexidade === 'MÉDIO';
    const estMinutes = isBasic ? 35 : (isMedium ? 70 : 120);
    
    setClassification({
      tipo: normalizedTipo,
      viabilidade: 'VIAVEL',
      complexidade: isBasic ? 'BASICO' : (isMedium ? 'INTERMEDIARIO' : 'AVANCADO'),
      resumo: template.descricao,
      tecnologias: template.tecnologias || [],
      perguntas_necessarias: [],
      estimativa_minutos: estMinutes
    });

    addLog('> Iniciando geração baseada no Modelo Avançado...', 'done');

    try {
      const answersText = Object.entries(answers).map(([k, v]) => {
        const q = template.perguntas_customizacao?.find((q: any) => q.id === k);
        return `${q?.pergunta || k}: ${v}`;
      }).join('\n');

      let currentHtml = '';
      let currentNode: GeneratedNode | null = null;

      // 1. Generate Frontend with AI
      setGeneratingProgress(35);
      addLog('> Arquitetando solução de interface do template com IA...', 'active');

      const frontendPrompt = `Você é um engenheiro frontend de elite da Parvus Automate. Sua missão é gerar uma interface web magnífica, luxuosa, totalmente interativa e customizada a partir do modelo "${template.nome}" (${template.descricao}).

PARÂMETROS DE CUSTOMIZAÇÃO DO USUÁRIO:
${answersText}

TECNOLOGIAS USADAS: ${template.tecnologias?.join(', ')}

⚡ REQUISITOS DE DESIGN E UX (ULTRA POLIDO):
1. CORES E TEMA: Use um tema dark cibernético luxuoso (fundo principal em tom profundo como bg-[#0d0e12] ou bg-[#070709]). Use gradientes e efeitos de bordas brilhantes/glowing com tons como verde esmeralda (#00ff88), azul cobalto profundo (#0066ff) ou laranja neon/yellow.
2. GLASSMORPHISM: Aplique nas divisões de cards ou painéis a classe "backdrop-blur-md bg-white/[0.02] border border-white/10" para um acabamento limpo.
3. ESTILO DE BOTÕES: Efeitos de transição ricos (duration-300), sombras de hover sutis e cantos arredondados modernos (rounded-xl ou rounded-2xl). Evite botões básicos cinzas ou azuis padrão.
4. ÍCONES E FONTES: Carregue fontes elegantes do Google Fonts (como "Plus Jakarta Sans" ou "Space Grotesk") e use ícones modernos (use SVGs Inline refinados ou Lucide Icons via CDN para renderizar ícones bonitos).
5. RESPONSIVIDADE: O layout deve rodar magnificamente em computadores desktop (com barra lateral estruturada e painel de controle principal espaçoso) e adaptar-se perfeitamente a dispositivos móveis.

⚡ ARQUITETURA DA INTERFACE (COMPONENTES OBRIGATÓRIOS TEMPLATE):
- HEADER HIGH-TECH: Logo bonita do sistema customizado, indicador ativo com animação pulsante ("● SIMULAÇÃO DE FLUXO ATIVA"), latência simulada (ex: 18ms) e contador de novos eventos ou notificações.
- SIDEBAR DE NAVEGAÇÃO: Abas navegáveis adaptadas ao domínio (ex: se for CRM, use "Kanban, Métricas, Leads"; se for Calculadora ou Utilitário, use "Painel de Cálculo, Histórico, Configurações de Fórmulas"; de forma geral crie abas que façam sentido para o problema do usuário!).
- CARDS DE MÉTRICAS / KPI (MÍNIMO 3 CARDS): Mostre dados em tempo real ou simulações relevantes à aplicação (ex: taxa de conversão %, total de comissões calculadas, ou transações criadas, alertas emitidos). Inclua mini-charts visuais usando SVG.
- ÁREA DE TRABALHO CENTRAL (TOTALMENTE INTERATIVA E FUNCIONAL):
  - Se for CRM/Pipelines: Quadro Kanban real com colunas estilizadas. Permita arrastar leads de um estágio para outro, criar novos leads através de modal com campos detalhados, e abrir detalhes do lead para editar e salvar! 
  - Se for Agenda/Calendário: Visualizador de agenda em grid mensal ou semanal. Mostre slots brilhando e permita clicar num horário livre para agendar verdadeiramente (abre modal, define dados, adiciona à lista com som visual de sucesso).
  - Se for WhatsApp / Automações de Chat / Robôs: Um editor de fluxos gráfico interativo na tela (caixas conectáveis simulando nós ou sequência lógica), um chat de simulação ao vivo (onde é possível digitar algo e ver o chatbot simulado responder imediatamente), e um histórico de logs rolável.
  - Se for Dashboards / Painéis Industriais / IoT: Gráficos de telemetria SVG dinâmicos que se atualizam solos a cada 2 segundos. Toggle botões para ligar/desligar atuadores/relés virtuais com animação e som visual realista.
  - Se for Finanças, Pagamentos, Checkout ou Calculadoras Técnicas: Simulador e processador dinâmico de cálculos/fórmulas matemáticas ou link de faturamento de forma 100% interativa. Adicione formulários interativos para preenchimento de dados de simulação (como valor da venda, metas, descontos, alíquotas), recalcule e plote instantaneamente gráficos SVG de pizza ou barras com o resultado dividido! Ofereça controles para salvar simulações na tabela do histórico, editar taxas diretamente no painel e simular relatório.
- CONSOLE DE LOGS DO SISTEMA: Um painel no rodapé ou na lateral direita simulando a recepção de webhooks em tempo real e processamento do sistema (ex: "[WEBHOOK] Novo lead de Mariana Silveira (marianasilveira@email.com) recebido", "[DISPARO] Automatização 'Boas-vindas' executada com sucesso", etc.). Use um timer para injetar novos logs a cada poucos segundos!
- SUPORTE A MODO DEMO ROBUSTO (COM CONTROLES DE SIMULAÇÃO): Inclua um painel explícito ("Painel de Simulação") com botões rápidos como: "Simular Entrada de Webhook", "Gerar Novo Lead Aleatório", "Disparar Alerta de Teste", "Limpar Histórico". Isso faz com que a interface pareça viva e 100% testável logo de cara!

REGRAS TÉCNICAS ABSOLUTAS:
- Retorne APENAS o código HTML/JS/CSS limpo. NÃO inclua delimitadores markdown de bloco HTML (como as três crases com a palavra html) em hipótese alguma! Comece diretamente com <!DOCTYPE html>.
- O código Javascript inserido no script deve gerenciar de forma impecável todo o estado simulado em memória local (use arrays de objetos pré-carregados com pelo menos 10 registros fictícios detalhados para parecer preenchido).
- Zero placeholders ou comentários do tipo "// adicione código aqui". Tudo precisa estar totalmente implementado e funcional de ponta a ponta.
- Use Tailwind CSS via CDN (<script src="https://unpkg.com/@tailwindcss/browser@4"></script>).
${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Construa o código 100% white-label, sem qualquer menção à "Parvus Automate". Insira no cabeçalho ou nas configurações rápidas uma marca personalizável ou um local para o cliente final logar.\n' : ''}`;

      const responseHtml = await callGeminiApi('gemini-2.0-flash', frontendPrompt, {
        temperature: 0.2
      });
      
      // Clean markdown formatting if present with hyper-robust utility
      let finalHtml = cleanAndExtractHtml(responseHtml.text || '');

      currentHtml = finalHtml;
      setGeneratedHtml(finalHtml);
      updateLog('> Arquitetando solução de interface do template com IA...', 'done');

      // 2. Generate Backend Node.js
      setGeneratingProgress(75);
      addLog('> Projetando microsserviço de backend customizado...', 'active');
      
      const backendPrompt = `Você é um engenheiro sênior de infraestrutura e backend Node.js da Parvus Automate. Sua missão é projetar e gerar um microsserviço Express completo, limpo e super funcional em português para apoiar o modelo customizado "${template.nome}" (${template.descricao}).
      
      PARÂMETROS DE CUSTOMIZAÇÃO DO USUÁRIO:
      ${answersText}

      TECNOLOGIAS ESPECIFICADAS: ${template.tecnologias.join(', ')}

      ⚡ REQUISITOS DO PROJETO NODE.JS:
      1. TRATAMENTO COMPLETO DE ROTAS:
         - Endpoint GET /api/health retornando status de saúde do sistema e versão.
         - Endpoints de CRUD para o modelo (GET, POST, PUT, DELETE) com tratamento transparente de dados em memória local simulando persistência correta de dados.
         - Endpoint POST /api/webhooks para capturar eventos de plataformas de terceiros.
      2. MIDDLEWARES OBRIGATÓRIOS: Configure express.json(), cors(), helmet() e um logger de requisições detalhado.
      3. SCHEMAS DE BANCO DE DADOS (README): Liste detalhadamente as tabelas SQL (PostgreSQL/Supabase) necessárias para o modelo de negócios do template, com colunas e tipos precisos.
      4. DOCUMENTAÇÃO PREMIUM: Crie um README.md contendo o diagrama de arquitetura ASCII do sistema, instruções de variáveis do .env e guia rápido de uso com curl/scripts de teste.
      ${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Remova qualquer referência à marca Parvus Automate para manter white-label absoluto.\n' : ''}`;

      const responseNode = await callGeminiApi('gemini-2.0-flash', backendPrompt, {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            server_js: { type: Type.STRING },
            package_json: { type: Type.STRING },
            env_example: { type: Type.STRING },
            readme_md: { type: Type.STRING },
            arquitetura_ascii: { type: Type.STRING }
          },
          required: ['server_js', 'package_json', 'env_example', 'readme_md', 'arquitetura_ascii']
        }
      });

      let responseNodeText = responseNode.text || '{}';
      const nodeStartObj = responseNodeText.indexOf('{');
      const nodeEndObj = responseNodeText.lastIndexOf('}');
      if (nodeStartObj >= 0 && nodeEndObj >= 0) {
        responseNodeText = responseNodeText.substring(nodeStartObj, nodeEndObj + 1);
      }

      let nodeData: GeneratedNode;
      try {
        nodeData = JSON.parse(responseNodeText) as GeneratedNode;
      } catch (parseErr: any) {
        console.error("JSON PARSE ERROR:", parseErr, responseNodeText);
        addLog('> Aviso: Falha ao interpretar estrutura Node.js retornada pela IA.', 'error');
        nodeData = {
          server_js: "// Falha na geração Node.js\n// " + String(parseErr),
          package_json: "{}",
          env_example: "PORT=3000",
          readme_md: "Houve uma falha na montagem do projeto Node.",
          arquitetura_ascii: ""
        };
      }
      currentNode = nodeData;

      updateLog('> Projetando microsserviço de backend customizado...', 'done');
      
      // 3. Optional Hardware parts
      if (normalizedTipo === 'HARDWARE' || normalizedTipo === 'HIBRIDO') {
        setGeneratingProgress(90);
        addLog('> Gerando circuito eletrônico e documentação física...', 'active');
        
        const iotPrompt = `Você é um engenheiro de hardware e eletrônica sênior especializado em sistemas embarcados e IoT da Parvus Automate. Sua missão é projetar e documentar a solução física completa e customizada para o hardware do modelo "${template.nome}".
        Customização do Usuário: ${answersText}
        
        ⚡ REQUISITOS TÉCNICOS DETALHADOS DE HARDWARE:
        1. 'codigo_placa': Deve ser um código C++ extremamente robusto e compilável para Arduino IDE (visando ESP32 ou ESP8266), ou código em MicroPython limpo. Inclua comentários ricos e didáticos em português para que o usuário saiba quais pinos conectar de forma exata e como configurar sua rede Wi-Fi/Server Webhooks.
        2. 'pdf_pecas': Liste de forma minuciosa todos os componentes eletrônicos necessários (ex: tipo exato de sensor, microcontrolador, resistores de pull-up, relés, cabos, fontes de alimentação recomendadas com especificações de proteção). Adicione preços médios realistas de mercado em reais (R$) para cada item e links fictícios de comércio elétrico seguro no Brasil.
        3. 'pdf_montagem': Explique de forma detalhada as conexões físicas. Forneça diagramas técnicos esquemáticos refinados usando diagramação ASCII elegante (ex: mostrando portas GPIO conectadas a pinos VCC, GND e portas de dados do sensor).
        4. 'pdf_documentacao': Documente o fluxo lógico do firmware embarcado (como funciona o loop infinito, tempos de amostragem/debounce de botões, e controle de watchdog para evitar panes).
        5. 'pdf_setup': Um passo a passo infalível em português ensinando como instalar drivers de placas (CH340/CP2102), configurar as preferências da IDE Arduino, instalar bibliotecas necessárias (PubSubClient, DHT, Adafruit, etc.) e carregar o código para a placa física.
        - Se houver manuseio de corrente alternada (110V/220V), adicione avisos de segurança rigorosos com destaque ("⚠️ ALERTA DE SEGURANÇA 110V/220V").
        ${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Remova qualquer referência à marca Parvus Automate ou a marcas específicas, use white-label e torne tudo vendível.\n' : ''}`;

        const responseIoT = await callGeminiApi('gemini-2.0-flash', iotPrompt, {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              codigo_placa: { type: Type.STRING },
              pdf_pecas: { type: Type.STRING },
              pdf_montagem: { type: Type.STRING },
              pdf_documentacao: { type: Type.STRING },
              pdf_setup: { type: Type.STRING }
            },
            required: ['codigo_placa', 'pdf_pecas', 'pdf_montagem', 'pdf_documentacao', 'pdf_setup']
          }
        });
        
        let responseIoTText = responseIoT.text || '{}';
        const iotStartObj = responseIoTText.indexOf('{');
        const iotEndObj = responseIoTText.lastIndexOf('}');
        if (iotStartObj >= 0 && iotEndObj >= 0) {
          responseIoTText = responseIoTText.substring(iotStartObj, iotEndObj + 1);
        }
  
        let iotData: any;
        try {
          iotData = JSON.parse(responseIoTText);
        } catch (parseErr: any) {
          console.error("JSON PARSE ERROR IOT:", parseErr, responseIoTText);
          iotData = {
            codigo_placa: "// Falha ao gerar código da placa\n" + String(parseErr),
            pdf_pecas: "Falha na geração.",
            pdf_montagem: "",
            pdf_documentacao: "",
            pdf_setup: ""
          };
        }
        
        currentNode.codigo_placa = iotData.codigo_placa;
        currentNode.pdf_pecas = iotData.pdf_pecas;
        currentNode.pdf_montagem = iotData.pdf_montagem;
        currentNode.pdf_documentacao = iotData.pdf_documentacao;
        currentNode.pdf_setup = iotData.pdf_setup;
        
        updateLog('> Gerando circuito eletrônico e documentação física...', 'done');
      }

      setGeneratedNode(currentNode);
      setGeneratingProgress(100);
      addLog('> Automação gerada e compilada com sucesso!', 'done');

      // Save to history and Database
      const newHistoryItem: any = {
        id: Date.now(),
        titulo: template.nome,
        tipo: normalizedTipo,
        data: new Date().toLocaleString('pt-BR'),
        htmlGerado: currentHtml,
        nodeGerado: currentNode
      };

      if (supabase && session) {
        const { data, error } = await supabase.from('projects').insert({
          user_id: session.user.id,
          titulo: template.nome,
          problema: `Template: ${template.nome}`,
          tipo: normalizedTipo,
          complexidade: template.complexidade === 'BÁSICO' ? 'BASICO' : (template.complexidade === 'MÉDIO' ? 'INTERMEDIARIO' : 'AVANCADO'),
          tecnologias: template.tecnologias,
          html_gerado: currentHtml,
          node_gerado: currentNode,
          arquitetura_ascii: currentNode?.arquitetura_ascii || '',
          respostas: answers,
          status: 'gerado'
        }).select().single();

        if (data && !error) {
          newHistoryItem.id = data.id;
          setCurrentProjectId(data.id);
        }
      } else {
        setCurrentProjectId(String(newHistoryItem.id));
      }

      setHistory(prev => [newHistoryItem, ...prev]);

      if (session && supabase) {
        await incrementGenerationCount(session.user.id, supabase);
        generationLimit.refreshLimit();
      } else {
        const guestCount = parseInt(localStorage.getItem('parvus_free_generations_done') || '0', 10);
        localStorage.setItem('parvus_free_generations_done', String(guestCount + 1));
        generationLimit.refreshLimit();
      }

      setTimeout(() => setPhase('done'), 1000);

    } catch (error) {
      console.error(error);
      updateLog(`> Falha na geração do template: ${error}`, 'done');
      showToast("Falha ao gerar o projeto por inteligência artificial. Tente novamente.", "error");
      setPhase('input');
    }
  };

  const handleBriefingSubmit = async (briefingData: any) => {
    if (!generationLimit.loading && !generationLimit.allowed) {
      if (!session) {
        setShowLoginModal(true);
        showToast("Você atingiu o limite de geração de teste gratuita como visitante. Faça login/cadastro para continuar!", "error");
      } else {
        setShowUpgradeModal(true);
      }
      return;
    }

    // Show loading
    setEntryFlow('ai'); // Switch to AI area briefly
    setPhase('classifying');
    setProblemDescription("Interpretando briefing...");
    
    const promptInterpreter = `
    ROLE: Você é um especialista em engenharia de prompts para geração de código.
    TASK: O usuário respondeu um briefing. Converta em um PROMPT PROFISSIONAL.
    INPUT:
    ${JSON.stringify(briefingData, null, 2)}
    
    OUTPUT:
    Retorne apenas o prompt estruturado gerado.
    `;
    
    try {
      const response = await callGeminiApi('gemini-2.0-flash', promptInterpreter, { temperature: 0.4 });
      const generatedPrompt = response.text;
      
      if (generatedPrompt) {
        setProblemDescription(generatedPrompt);
        // Automatically proceed to classification
        await handleAnalyze(generatedPrompt);
      } else {
        setPhase('input');
        setProblemDescription(JSON.stringify(briefingData, null, 2));
      }
    } catch(e) {
      console.error(e);
      setPhase('input');
      setProblemDescription(JSON.stringify(briefingData, null, 2));
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setHistory([]);
      setPhase('input');
    }
  };

  const handlePublishToMarketplace = async () => {
    if (!supabase) {
      showToast("Supabase não conectado", "error");
      return;
    }
    if (!session) {
      showToast("Você precisa estar logado para publicar.", "error");
      return;
    }
    if (!currentProjectId) {
      showToast("Nenhum projeto selecionado.", "error");
      return;
    }
    
    setConfirmModal({
      title: "Publicar no Marketplace?",
      message: "Deseja enviar esta automação para revisão no Marketplace? Confirme que não contém dados sensíveis.",
      onConfirm: async () => {
        try {
          const proj = history.find(p => String(p.id) === String(currentProjectId));
          if (!proj) {
            showToast("Projeto selecionado não encontrado no histórico. Verifique se ele já foi salvo.", "error");
            return;
          }
          
          const { data, error } = await supabase.from('marketplace_listings').insert({
            creator_id: session.user.id,
            project_id: currentProjectId,
            nome: proj.titulo,
            descricao: "Aguardando revisão...",
            preco: 0,
            tipo: proj.tipo,
            status: 'pending' // As per prompt, pending until admin approves
          }).select().single();

          if (error) {
            if (error.code === '23505') {
              showToast('Esta automação já foi enviada para o Marketplace.', 'error');
            } else {
              throw error;
            }
          } else {
            showToast('Enviado para análise com sucesso! Após aprovação estará no Marketplace.', 'success');
          }
        } catch (e: any) {
          console.error(e);
          showToast('Erro ao publicar: ' + (e.message || JSON.stringify(e)), 'error');
        }
      }
    });
  };


  // ...

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-[#00ff88]">
         <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  // Remove forced Auth wall:
  // if (!session && supabase) {
  //   return <Auth onSession={setSession} />;
  // }

  if (!session && supabase && showLoginModal) {
     return (
       <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
         <div className="relative w-full max-w-md">
           <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-white z-50">✕</button>
           <Auth onSession={(s) => { setSession(s); setShowLoginModal(false); }} />
         </div>
       </div>
     );
  }

  const renderTopbar = () => (
    <header className="h-auto md:h-16 py-4 md:py-0 border-b border-white/10 flex flex-col md:flex-row items-center justify-between px-4 md:px-6 bg-[#0a0a0a] relative z-10 shrink-0 gap-4 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-4 shrink-0">
        <button onClick={() => setCurrentView('app')} className="text-[#00ff88] text-xl md:text-2xl font-black tracking-tighter hover:brightness-110 transition-all uppercase" style={{ fontFamily: "'Arial Black', sans-serif" }}>
          PARVUS
        </button>
        <div className="h-4 w-[1px] bg-white/20 hidden md:block"></div>
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#888888]">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88] animate-pulse"></div>
          SISTEMA ONLINE
        </div>
      </div>
      
      <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-6 text-xs text-[#888888]">
        <button onClick={() => setCurrentView('app')} className={`hover:text-white cursor-pointer transition-colors uppercase tracking-widest whitespace-nowrap ${currentView === 'app' ? 'text-white font-bold border-b border-[#00ff88]' : ''}`}>
          GERADOR
        </button>
        {session && (
          <>
            <button onClick={() => setCurrentView('marketplace')} className={`hover:text-white cursor-pointer transition-colors uppercase tracking-widest flex items-center gap-1 whitespace-nowrap ${currentView === 'marketplace' ? 'text-white font-bold border-b border-[#00ff88]' : ''}`}>
              MARKETPLACE
            </button>
            <button onClick={() => setCurrentView('purchases')} className={`hover:text-white cursor-pointer transition-colors uppercase tracking-widest whitespace-nowrap ${currentView === 'purchases' ? 'text-white font-bold border-b border-[#00ff88]' : ''}`}>
              MINHAS COMPRAS
            </button>
            <button onClick={() => setCurrentView('iot')} className={`hover:text-white cursor-pointer transition-colors uppercase tracking-widest whitespace-nowrap flex items-center gap-1 ${currentView === 'iot' ? 'text-white font-bold border-b border-[#00d4ff]' : ''}`}>
              <Network size={16} className={currentView === 'iot' ? 'text-[#00d4ff]' : ''} />
              IOT MONITOR <span className="px-1.5 py-0.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] text-[8px] font-bold">NOVO</span>
            </button>
          </>
        )}
        
        <div className="text-white hidden lg:flex items-center gap-3 ml-4 border-l border-white/10 pl-6">
          {!generationLimit.loading && (
            <span className="text-gray-400">
              Gerações: {generationLimit.plan === 'free' || !session
                ? <span className={generationLimit.remainingGenerations > 0 ? "text-yellow-500 font-bold" : "text-[#ff3366] font-bold"}>
                    {generationLimit.usedThisMonth}/1 Teste Grátis {generationLimit.remainingGenerations === 0 && " (Limite)"}
                  </span>
                : generationLimit.plan === 'admin' 
                ? <span className="text-[#00ff88]">∞/∞</span>
                : <span className="text-[#00ff88]">{generationLimit.usedThisMonth}/{generationLimit.limit}</span>
              }
            </span>
          )}
          {session && (
            <span className="font-medium text-gray-300 border-l border-white/5 pl-3">{session.user?.user_metadata?.nome || session.user?.email}</span>
          )}
        </div>
        {isAdmin && (
          <div className="relative group">
            <button onClick={() => setCurrentView('admin')} className={`hover:text-white cursor-pointer transition-colors uppercase tracking-widest text-[#00ff88] ${currentView === 'admin' ? 'font-bold border-b border-[#00ff88]' : ''}`}>
              👑 ADMIN
            </button>
          </div>
        )}
        <div className="relative group">
          <button onClick={() => setCurrentView('settings')} className={`hover:text-white cursor-pointer transition-colors uppercase tracking-widest ${currentView === 'settings' ? 'text-white font-bold border-b border-[#00ff88]' : ''}`}>
            CONFIGURAÇÕES
          </button>
        </div>
        
        {session && supabase ? (
          <button onClick={handleLogout} className="hover:text-white cursor-pointer transition-colors uppercase tracking-widest text-[#ff6600]">
            SAIR
          </button>
        ) : (
          supabase && (
            <button onClick={() => setShowLoginModal(true)} className="hover:text-white cursor-pointer transition-colors uppercase tracking-widest text-[#00ff88]">
              ENTRAR / CADASTRO
            </button>
          )
        )}
        <div className="text-[#00ff88] border border-[#00ff88]/30 px-3 py-1 bg-[#00ff88]/5 tracking-widest hidden xl:block">
          PRO VERSION
        </div>
      </div>
    </header>
  );

  const handleDeleteProject = async (e: React.MouseEvent, id: any) => {
    e.stopPropagation();
    setConfirmModal({
      title: "Excluir Projeto",
      message: "Deseja realmente excluir este projeto?",
      onConfirm: async () => {
        try {
          if (supabase && session) {
            await supabase.from('projects').delete().eq('id', id);
          }
          setHistory(prev => prev.filter(p => p.id !== id));
          if (generatedNode && history.find(p => p.id === id)?.titulo === classification?.resumo) {
            resetAll();
          }
          showToast('Projeto excluído.', 'success');
        } catch (err: any) {
          showToast('Erro ao excluir: ' + err.message, 'error');
        }
      }
    });
  };

  const renderLeftPanel = () => {
    return (
      <aside className="w-[320px] lg:w-[400px] border-r border-white/5 p-4 sm:p-6 flex flex-col gap-6 bg-[#0a0a0a]/95 backdrop-blur-xl shrink-0 relative overflow-y-auto shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-20">
        
        {entryFlow !== 'selection' && (
          <button 
            onClick={resetAll} 
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00ff88]/10 to-transparent border border-[#00ff88]/20 text-[#00ff88] font-black text-xs uppercase tracking-widest hover:border-[#00ff88]/50 hover:bg-[#00ff88]/20 transition-all mb-2 flex items-center justify-center gap-2"
          >
            <span className="text-lg leading-none">+</span> NOVA AUTOMAÇÃO
          </button>
        )}

        {phase === 'input' && entryFlow === 'ai' && (
          <div className="space-y-6">
            
            {!generationLimit.loading && (generationLimit.plan === 'free' || !session) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs leading-relaxed text-yellow-200">
                ⚠️ <strong>Teste Grátis Ativo:</strong> Você possui apenas <strong>1 geração grátis</strong> ({generationLimit.usedThisMonth}/1 utilizada). Faça login e assine um plano para salvar projetos e ter uso ilimitado!
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] text-[#888888] font-bold uppercase tracking-widest flex items-center gap-2 ml-1">
                <div className="w-1 h-3 bg-[#00ff88] rounded-full"></div>
                Descreva sua Necessidade
              </label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00ff88]/50 to-[#0066ff]/50 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500"></div>
                <textarea 
                  className="w-full relative h-[180px] bg-[#111111] border border-white/10 rounded-xl p-4 text-sm text-[#f0f0f0] outline-none resize-none focus:border-[#00ff88]/50 focus:ring-1 focus:ring-[#00ff88]/50 transition-all font-light leading-relaxed"
                  placeholder="Escreva como você falaria. Exemplo: 'Preciso de um sistema que leia os emails dos clientes, cadastre num banco e me avise no WhatsApp...'"
                  value={problemDescription}
                  onChange={e => setProblemDescription(e.target.value)}
                />
                <div className="absolute bottom-3 right-4 text-[10px] text-[#444444] font-mono select-none">{problemDescription.length} chars</div>
              </div>
            </div>
            
            {temAcesso(generationLimit.plan, 'agency_mode') && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-[#9b59b6]/30 bg-[#9b59b6]/5 mb-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9b59b6]">Modo Agência</span>
                  <span className="text-[10px] text-gray-500">Gera código white-label sem marca Parvus</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={agencyMode} onChange={() => setAgencyMode(!agencyMode)} />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#9b59b6]"></div>
                </label>
              </div>
            )}

            <button 
              onClick={() => handleAnalyze()}
              disabled={!problemDescription.trim()}
              className="w-full py-4 rounded-xl bg-white text-black font-black text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] hover:bg-[#00ff88] transition-all disabled:opacity-30 disabled:hover:bg-white disabled:hover:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Analisar Escopo <Zap size={16} />
            </button>
            
            <div className="pt-6 border-t border-white/5 space-y-4">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#666666] ml-1">Capacidades da IA</h3>
               <div className="grid grid-cols-2 gap-2 text-xs text-[#888888]">
                 <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5"><div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]"></div> Web Frontend</div>
                 <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5"><div className="w-1.5 h-1.5 rounded-full bg-[#0066ff]"></div> Backend APIs</div>
                 <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5"><div className="w-1.5 h-1.5 rounded-full bg-[#ff6600]"></div> Hardwares IoT</div>
                 <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5"><div className="w-1.5 h-1.5 rounded-full bg-[#cc00ff]"></div> Enterprise Core</div>
               </div>
            </div>
          </div>
        )}

        {phase === 'classifying' && (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-white/5 rounded-full"></div>
              <div className="w-20 h-20 border-t-4 border-[#00ff88] rounded-full absolute top-0 left-0 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-10 h-10 bg-[#00ff88]/10 rounded-full flex items-center justify-center border border-[#00ff88]/30">
                   <Cpu size={20} className="text-[#00ff88]" />
                 </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-black text-[#00ff88] uppercase tracking-widest leading-none">
                Processando Escopo
              </p>
              <p className="text-xs text-[#888888] font-light">Classificando arquitetura ideal...</p>
            </div>
          </div>
        )}

        {phase === 'questions' && classification && (
          <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-[10px] text-[#888888] font-bold uppercase tracking-widest flex items-center gap-2 ml-1">
              <div className="w-1 h-3 bg-[#ff6600] rounded-full"></div> Especificações Adicionais
            </div>
            <div className="bg-[#111111] border border-[#ff6600]/20 rounded-xl p-5 space-y-6 overflow-y-auto shadow-inner">
              {classification.perguntas_necessarias.map((q) => (
                <div key={q.id} className="space-y-3">
                  <label className="text-xs text-[#f0f0f0] font-medium block leading-relaxed">{q.texto}</label>
                  {q.tipo === 'opcoes' && q.opcoes ? (
                    <div className="relative">
                      <select 
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg p-3 text-sm outline-none focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] text-[#f0f0f0] appearance-none"
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers({...answers, [q.id]: e.target.value})}
                      >
                        <option value="" disabled>Selecione uma opção...</option>
                        {q.opcoes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <div className="absolute right-3 top-3.5 pointer-events-none text-[#888888]">▼</div>
                    </div>
                  ) : (
                    <input 
                      type="text"
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg p-3 text-sm outline-none focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] text-[#f0f0f0]"
                      placeholder="Sua resposta..."
                      value={answers[q.id] || ''}
                      onChange={e => setAnswers({...answers, [q.id]: e.target.value})}
                    />
                  )}
                </div>
              ))}
            </div>
            <button 
              onClick={() => handleGenerate(classification, answers)}
              className="w-full mt-4 py-4 rounded-xl bg-[#ff6600] text-black font-black text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(255,102,0,0.3)] hover:shadow-[0_0_30px_rgba(255,102,0,0.5)] hover:bg-[#ff7700] transition-all flex justify-center items-center gap-2"
            >
              GERAR SISTEMA <Play fill="currentColor" size={14} />
            </button>
            <div className="text-[9px] text-[#666666] mt-2 text-center leading-relaxed px-4">
              Ao gerar, você recebe licença vitalícia de uso. O código fornecido é arquitetado de ponta a ponta.
            </div>
          </div>
        )}

        {phase === 'inviavel' && classification && (
          <div className="flex-1 flex flex-col gap-4 border border-red-500/30 rounded-xl p-6 bg-red-500/5 mt-4">
            <h3 className="text-red-500 font-bold uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> SOLUÇÃO INVIÁVEL</h3>
            <p className="text-sm text-[#f0f0f0] mt-2 block leading-relaxed font-light">{classification.motivo_inviabilidade || 'Não é possível construir essa solução via Parvus Automate.'}</p>
            <button 
              onClick={resetAll}
              className="mt-6 w-full py-3 rounded-lg bg-[#1a1a1a] border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 text-white font-bold text-xs uppercase tracking-widest transition-colors"
            >
              Tentar Repensar Problema
            </button>
          </div>
        )}

        {(classification && phase !== 'input' && phase !== 'questions' && phase !== 'inviavel') && (
          <div className="flex-1 flex flex-col gap-4 mt-2 animate-in fade-in slide-in-from-left-4">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-[10px] text-[#888888] font-bold uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse"></div> Arquitetura Definida
              </div>
              {phase === 'done' && (
                <button onClick={resetAll} className="text-[10px] font-bold text-white hover:text-[#00ff88] bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors flex items-center gap-1">
                  <RefreshCw size={10} /> REINICIAR
                </button>
              )}
            </div>
            
            <div className="bg-[#111111]/80 border border-[#00ff88]/20 rounded-xl p-5 shadow-[0_0_30px_rgba(0,255,136,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#00ff88]/10 blur-[30px] pointer-events-none"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-[10px] text-[#888888] font-bold uppercase tracking-widest mb-1">Módulo Core</div>
                  <div className="text-white text-lg font-black tracking-tight">{classification.tipo}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#888888] font-bold uppercase tracking-widest mb-1">Escalabilidade</div>
                  <div className="text-[#0066ff] font-bold px-2 py-0.5 bg-[#0066ff]/10 rounded border border-[#0066ff]/20 text-xs inline-block">{classification.complexidade}</div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#888888] truncate pr-2 max-w-[80%]">{classification.tecnologias?.join(', ')}</span>
                  <span className="text-[#00ff88]">100%</span>
                </div>
                <div className="h-1.5 w-full bg-[#0a0a0a] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00ff88] w-full"></div>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#888888]">Tempo Estimado</span>
                  <span className="text-[#0066ff]">~{classification.estimativa_minutos}m</span>
                </div>
                <div className="h-1.5 w-full bg-[#0a0a0a] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0066ff] w-[40%]"></div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 text-[10px] text-[#888888] italic">
                "{classification.resumo}"
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-8">
          <div className="text-[10px] text-[#888888] uppercase tracking-widest mb-2 border-t border-white/10 pt-6">Histórico Recente</div>
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-xs text-[#444444] italic">Nenhum projeto gerado ainda.</div>
            ) : (
              history.map((item, idx) => (
                <div 
                  key={item.id} 
                  onClick={() => loadHistoryProject(item)}
                  className={`group flex items-center justify-between text-xs border-l-2 ${idx % 2 === 0 ? 'border-[#ff6600]' : 'border-[#00ff88]'} pl-2 py-1 cursor-pointer text-[#888888] hover:text-white transition-colors`}
                >
                  <div className="truncate flex-1 pr-2">
                    {String(history.length - idx).padStart(2, '0')}. {item.titulo}
                  </div>
                  <button 
                    onClick={(e) => handleDeleteProject(e, item.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-1 transition-opacity"
                    title="Excluir Projeto"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    );
  };

  const renderBuildArea = () => {
    if (phase === 'input') {
      return (
        <main className="flex-1 flex flex-col items-center justify-center relative bg-[#0a0a0a] z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.03),transparent_60%)] pointer-events-none"></div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full animate-[spin_60s_linear_infinite] pointer-events-none opacity-20"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full animate-[spin_40s_linear_infinite_reverse] pointer-events-none opacity-20"></div>
          
          <div className="text-center max-w-xl relative z-10 p-8">
            <div className="relative w-24 h-24 mx-auto mb-8">
               <div className="absolute inset-0 bg-gradient-to-tr from-[#00ff88]/20 to-transparent rounded-2xl blur-xl animate-pulse"></div>
               <div className="w-24 h-24 relative border border-white/10 bg-[#111111]/80 backdrop-blur-xl flex items-center justify-center rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                 <Cpu size={40} className="text-[#00ff88]" />
               </div>
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tighter text-white">Parvus <span className="text-[#00ff88]">Intelligence</span></h2>
            <p className="text-[#888888] text-base leading-relaxed font-light">
              Descreva um problema ou processo no painel lateral. Nossa Engine criará instantaneamente um sistema completo, gerando simultaneamente <span className="text-white font-medium">código frontend, integrações backend e diagramas de arquitetura</span>.
            </p>
          </div>
        </main>
      );
    }

    if (classification && (classification.tipo === 'ENTERPRISE' || classification.complexidade === 'ENTERPRISE')) {
      return (
        <div className="flex-1 p-8 overflow-y-auto relative z-10 bg-[#0a0a0a]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,102,0,0.05),transparent_50%)] pointer-events-none"></div>
          <div className="max-w-3xl mx-auto relative z-10">
             <div className="border border-[#ff6600]/30 bg-[#ff6600]/5 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff6600]/10 blur-[80px] pointer-events-none"></div>
              
              <div className="inline-block border border-[#ff6600] text-[#ff6600] text-[10px] font-bold uppercase tracking-widest px-3 py-1 mb-6">
                INDÚSTRIA 4.0 — ENTERPRISE
              </div>
              
              <h2 className="text-3xl font-display font-bold mb-4 flex items-center gap-3 tracking-tighter text-white">
                <Factory className="text-[#ff6600]" /> Engenharia Especializada
              </h2>
              
              <p className="text-[#888888] text-sm mb-8 leading-relaxed">
                Automações de nível industrial — linhas de produção autônomas, robótica com IA, controle de manufatura sem intervenção humana — exigem uma equipe dedicada com engenheiros de controle, especialistas em robótica e arquitetos de sistemas críticos.
              </p>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="border border-white/10 bg-[#111111] p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 text-[#888888] border-b border-white/10 pb-2">Escopo Técnico</h3>
                  <div className="text-xs text-white leading-relaxed mt-3 whitespace-pre-wrap">
                    {classification.resumo}
                  </div>
                </div>
                
                <div className="border border-white/10 bg-[#111111] p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 text-[#888888] border-b border-white/10 pb-2">Stack Recomendada</h3>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {classification.tecnologias.map(t => (
                      <span key={t} className="bg-[#1a1a1a] border border-[#ff6600]/30 px-2 py-1 text-[10px] text-[#ff6600]">
                        {t}
                      </span>
                    ))}
                    <span className="bg-[#1a1a1a] border border-white/10 px-2 py-1 text-[10px] text-white">EDGE_AI</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#111111] border border-white/10 p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4 text-[#888888]">Solicitar Proposta</h3>
                {enterpriseSubmitted ? (
                  <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 p-4 text-[#00ff88] text-center font-bold text-[10px] uppercase tracking-widest">
                    SOLICITAÇÃO ENVIADA. EQUIPE PARVUS ENTRARÁ EM CONTATO.
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEnterpriseSubmitted(true); }}>
                    <div className="grid grid-cols-2 gap-4">
                      <input required placeholder="Nome Completo" className="bg-[#1a1a1a] border border-white/10 p-3 text-xs focus:border-[#ff6600] text-white outline-none" />
                      <input required placeholder="Empresa" className="bg-[#1a1a1a] border border-white/10 p-3 text-xs focus:border-[#ff6600] text-white outline-none" />
                      <input required type="email" placeholder="E-mail" className="bg-[#1a1a1a] border border-white/10 p-3 text-xs focus:border-[#ff6600] text-white outline-none" />
                      <input required placeholder="Telefone" className="bg-[#1a1a1a] border border-white/10 p-3 text-xs focus:border-[#ff6600] text-white outline-none" />
                    </div>
                    <textarea 
                      required 
                      className="w-full min-h-[100px] bg-[#1a1a1a] border border-white/10 p-3 text-xs focus:border-[#ff6600] text-white outline-none resize-none" 
                      placeholder="Descreva a infraestrutura atual"
                      defaultValue={problemDescription}
                    ></textarea>
                    <button type="submit" className="w-full bg-[#ff6600] hover:brightness-110 text-black font-bold text-sm tracking-tighter uppercase py-4 transition-all shadow-[0_0_15px_rgba(255,102,0,0.3)]">
                      ENVIAR SOLICITAÇÃO
                    </button>
                  </form>
                )}
              </div>
             </div>
          </div>
        </div>
      );
    }

    if (classification && (classification.tipo === 'HARDWARE' || classification.tipo === 'HIBRIDO')) {
      return (
        <div className="flex-1 p-8 overflow-y-auto relative z-10 bg-[#0a0a0a]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,102,255,0.05),transparent_50%)] pointer-events-none"></div>
          <div className="max-w-3xl mx-auto relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="border border-[#0066ff]/30 bg-[#0066ff]/5 p-8 relative overflow-hidden rounded-2xl shadow-[0_0_50px_rgba(0,102,255,0.05)]">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#0066ff]/10 blur-[100px] pointer-events-none"></div>
              
              <div className="inline-block border border-[#0066ff] text-[#0066ff] bg-[#0066ff]/10 text-[10px] font-bold uppercase tracking-widest px-3 py-1 mb-6 rounded">
                LABS — PARVUS IOT VISION
              </div>
              
              <h2 className="text-3xl lg:text-4xl font-display font-black mb-4 flex items-center gap-4 tracking-tighter text-white">
                <div className="w-12 h-12 rounded-xl bg-[#0066ff]/20 flex items-center justify-center border border-[#0066ff]/40 shadow-[0_0_20px_rgba(0,102,255,0.2)]">
                  <Network size={24} className="text-[#0066ff]" />
                </div>
                Hardware Intelligence
              </h2>
              
              <div className="text-[#888888] space-y-4 mb-8 leading-relaxed font-light">
                <p>
                  Sua ideia envolve automação física, robótica, sensores ou dispositivos IoT integrados. O potencial disso é gigantesco!
                </p>
                <p>
                  No momento a <strong>Engine da Parvus</strong> gera código full-stack para web e integrações lógicas de forma impecável. No entanto, para o mundo físico, nosso objetivo é construir um estúdio de engenharia na nuvem revolucionário (similar a um Tinkercad de altíssimo nível, mas concebido por Inteligência Artificial).
                </p>
                <p>
                  Para entregar diagramas elétricos exatos, validação de circuitos em tempo real e compilação para microcontroladores (como ESP32 e Arduino) com 100% de segurança, estamos formatando e levantando os insumos focados nessa tecnologia junto aos melhores profissionais embarcados do mercado.
                </p>
              </div>
              
              <div className="bg-[#111111]/80 backdrop-blur-md border border-[#0066ff]/20 rounded-xl p-6 relative overflow-hidden">
                 <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none">
                    <Cpu size={120} className="text-[#0066ff]" />
                 </div>
                 <h3 className="text-xs font-black uppercase tracking-widest mb-2 text-white">Junte-se à Revolução IoT</h3>
                 <p className="text-sm text-[#888888] mb-6">Estamos cadastrando visionários e empresas parceiras (Early Adopters) que necessitam desta feature num futuro breve. Você receberá acesso beta antes de ir ao mercado.</p>
                 
                 <form className="flex max-sm:flex-col gap-3" onSubmit={(e) => { e.preventDefault(); showToast('Inscrição enviada para a lista de early adopters!', 'success'); }}>
                    <input type="email" placeholder="Seu e-mail..." required className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] outline-none transition-all shadow-inner relative z-10" />
                    <button type="submit" className="px-6 py-3 rounded-lg bg-[#0066ff] text-white font-black text-xs tracking-widest uppercase hover:bg-[#0055dd] hover:shadow-[0_0_20px_rgba(0,102,255,0.4)] transition-all relative z-10">
                      Entrar para o Beta
                    </button>
                 </form>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <main className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden relative z-0">
        {/* Classification Bar */}
        {classification && phase !== 'generating' && (
          <div className="h-16 shrink-0 border-b border-white/10 bg-[#111111]/80 backdrop-blur-sm flex items-center px-8 gap-8 shadow-sm">
            <div>
              <span className="text-[9px] uppercase text-[#888888] font-bold block mb-1 tracking-widest">Tipo Detectado</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${classification.tipo === 'HARDWARE' ? 'bg-[#ff6600]' : classification.tipo === 'HIBRIDO' ? 'bg-[#0066ff]' : 'bg-[#00ff88]'}`}></div>
                <span className="font-mono text-xs tracking-wider font-semibold text-white">{classification.tipo}</span>
              </div>
            </div>
            
            <div className="w-px h-6 bg-white/10"></div>
            
            <div>
              <span className="text-[9px] uppercase text-[#888888] font-bold block mb-1 tracking-widest">Complexidade</span>
              <div className="flex items-center gap-2 text-xs font-mono text-[#888888]">
                <span className="flex">
                  {Array(4).fill(0).map((_, i) => (
                    <span key={i} className={`mr-[2px] ${
                      classification.complexidade === 'BASICO' && i === 0 ? 'text-[#00ff88]' :
                      classification.complexidade === 'INTERMEDIARIO' && i <= 1 ? 'text-[#00ff88]' :
                      classification.complexidade === 'AVANCADO' && i <= 2 ? 'text-[#00ff88]' :
                      classification.complexidade === 'ENTERPRISE' ? 'text-[#ff6600]' : 'text-[#444444] opacity-50'
                    }`}>█</span>
                  ))}
                </span>
                <span className="text-white">{classification.complexidade}</span>
              </div>
            </div>

            <div className="w-px h-6 bg-white/10"></div>

            <div className="flex-1 min-w-0">
              <span className="text-[9px] uppercase text-[#888888] font-bold block mb-1 tracking-widest">Tecnologias</span>
              <div className="text-xs font-mono text-white truncate" title={classification.tecnologias?.join(' · ')}>
                {classification.tecnologias?.join(' · ')}
              </div>
            </div>

            <div className="w-px h-6 bg-white/10"></div>

            <div>
              <span className="text-[9px] uppercase text-[#888888] font-bold block mb-1 tracking-widest">Tempo Estimado</span>
              <div className="text-xs font-mono text-white flex items-center gap-1">
                <Clock size={12} className="text-[#00ff88]" /> ~{classification.estimativa_minutos}m
              </div>
            </div>
          </div>
        )}

        {/* Generation / Execution Status */}
        {phase === 'generating' && (
          <div className="flex-1 flex flex-col p-8 bg-[#0a0a0a] relative z-10 w-full overflow-hidden">
            <div className="flex-1 flex flex-col gap-6 overflow-hidden max-w-5xl mx-auto w-full">
              <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                <div className="flex-1 h-6 bg-[#111111] border border-white/10 flex items-center p-1 gap-1">
                  {Array(8).fill(0).map((_, i) => (
                    <div key={i} className={`h-full flex-1 ${i < generatingProgress / 12.5 ? 'bg-[#00ff88]/80' : i === Math.floor(generatingProgress / 12.5) ? 'bg-[#00ff88]/40 animate-pulse' : 'bg-transparent'}`}></div>
                  ))}
                </div>
                <div className="text-xs text-[#00ff88] font-bold">{generatingProgress}% COMPLETO</div>
              </div>

              <div className="flex-1 flex gap-6 overflow-hidden">
                <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-sm p-4 relative overflow-hidden hidden md:block">
                  <div className="absolute top-4 left-4 right-4 h-8 bg-[#222] rounded flex items-center px-4 gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                      <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                      <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                    </div>
                    <div className="text-[9px] text-white/30 truncate">Sintetizando {classification?.tipo}...</div>
                  </div>
                  <div className="mt-12 flex flex-col items-center justify-center h-full gap-4 text-center">
                    <div className="w-48 h-48 rounded-full border-[10px] border-[#111] flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-full border-t-[10px] border-[#00ff88] animate-spin" style={{ animationDuration: '2s' }}></div>
                      <div className="text-3xl font-bold flex items-center justify-center"><Loader2 className="animate-spin text-white" size={48} /></div>
                    </div>
                    <div className="text-xs tracking-widest text-[#888888] uppercase">Compilando Solução Web</div>
                    <div className="bg-[#00ff88]/10 text-[#00ff88] text-[10px] px-3 py-1 rounded-full border border-[#00ff88]/30 inline-block font-mono">STATUS: EM PROGRESSO</div>
                  </div>
                </div>

                <div 
                  ref={consoleRef}
                  className="w-full md:w-[400px] bg-[#050505] border border-white/10 p-4 font-mono text-[10px] text-green-500/80 overflow-y-auto"
                >
                  <div className="mb-2 text-[#888888]">[SYSTEM_INITIALIZATION]</div>
                  {logs.map((log, i) => (
                    <div key={i} className="flex justify-between items-start gap-2 mb-1">
                      <span className={log.status === 'error' ? "text-red-400 flex-1" : "text-white flex-1"}>{log.message}</span>
                      {log.status === 'done' && <span className="text-[#00ff88] font-bold shrink-0">DONE</span>}
                      {log.status === 'active' && <span className="text-[#0066ff] font-bold shrink-0 animate-pulse">WAIT</span>}
                      {log.status === 'pending' && <span className="text-[#888888] font-bold shrink-0">...</span>}
                      {log.status === 'error' && <span className="text-red-500 font-bold shrink-0">FAIL</span>}
                    </div>
                  ))}
                  {generatingProgress < 100 && (
                    <>
                      <div className="mt-4 text-[#888888] border-t border-white/5 pt-2">CODE_GEN_STATUS:</div>
                      <div className="mt-auto text-[#00ff88] animate-pulse">_ Writing project structure...</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Result Area */}
        {phase === 'done' && (
          <div className={isFullscreen ? "fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col overflow-hidden" : "flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden"}>
            <nav className="flex border-b border-white/10 shrink-0 overflow-x-auto items-center">
              <button 
                onClick={() => setActiveTab('preview')}
                className={`px-8 py-4 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'preview' ? 'border-b-2 border-[#00ff88] bg-[#00ff88]/5 text-[#00ff88]' : 'text-[#888888] hover:text-white'}`}
              >
                PREVIEW AO VIVO
              </button>
              <button 
                onClick={() => setActiveTab('code')}
                className={`px-8 py-4 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'code' ? 'border-b-2 border-[#00ff88] bg-[#00ff88]/5 text-[#00ff88]' : 'text-[#888888] hover:text-white'}`}
              >
                CÓDIGO FONTE
              </button>
              <button 
                onClick={() => setActiveTab('architecture')}
                className={`px-8 py-4 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'architecture' ? 'border-b-2 border-[#00ff88] bg-[#00ff88]/5 text-[#00ff88]' : 'text-[#888888] hover:text-white'}`}
              >
                ARQUITETURA
              </button>
              {(classification?.tipo === 'HARDWARE' || classification?.tipo === 'HIBRIDO') && (
                <button 
                  onClick={() => setActiveTab('hardware')}
                  className={`px-8 py-4 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'hardware' ? 'border-b-2 border-[#ff6600] bg-[#ff6600]/5 text-[#ff6600]' : 'text-[#888888] hover:text-white'}`}
                >
                  HARDWARE & PDFS
                </button>
              )}
              <div className="flex-1"></div>
              <div className="flex items-center px-4 sm:px-6 gap-3">
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-[#888888] hover:text-white transition-colors flex items-center justify-center p-2 rounded hover:bg-white/5"
                  title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <button 
                  onClick={downloadHtml}
                  className="text-[9px] sm:text-[10px] bg-[#1a1a1a] border border-white/10 px-3 py-1 hover:border-[#00ff88] hover:text-[#00ff88] transition-colors text-[#888888] uppercase tracking-widest whitespace-nowrap"
                >
                  HTML ZIP
                </button>
                <button 
                  onClick={downloadNode}
                  className="text-[9px] sm:text-[10px] bg-[#1a1a1a] border border-white/10 px-3 py-1 hover:border-[#0066ff] hover:text-[#0066ff] transition-colors text-[#888888] uppercase tracking-widest whitespace-nowrap"
                >
                  NODE.JS PKG
                </button>
                {(classification?.tipo === 'HARDWARE' || classification?.tipo === 'HIBRIDO') && (
                  <button 
                    onClick={downloadTodosIoT}
                    className="text-[9px] sm:text-[10px] bg-[#ff6600]/10 border border-[#ff6600]/50 px-3 py-1 hover:bg-[#ff6600]/20 hover:text-white transition-colors text-[#ff6600] uppercase tracking-widest whitespace-nowrap font-bold"
                  >
                    BAIXAR IOT (ZIP)
                  </button>
                )}
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <button 
                  onClick={handlePublishToMarketplace}
                  className="text-[9px] sm:text-[10px] bg-[#00ff88]/10 border border-[#00ff88]/50 px-3 py-1 hover:bg-[#00ff88]/20 hover:text-white transition-colors text-[#00ff88] uppercase tracking-widest whitespace-nowrap font-bold"
                >
                  📤 PUBLICAR
                </button>
              </div>
            </nav>

            <div className="flex-1 bg-[#0a0a0a] relative overflow-hidden sm:p-6">
              {activeTab === 'preview' && (
                <div className="w-full h-full sm:bg-white/[0.02] sm:border border-white/10 sm:rounded-sm p-0 relative overflow-hidden">
                  <div className="hidden sm:flex absolute top-0 left-0 right-0 h-8 bg-[#222] border-b border-[#333] flex items-center px-4 gap-2 z-10">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                    </div>
                    <div className="text-[10px] text-white/50 ml-2 bg-black/20 px-2 py-0.5 rounded-sm">https://localhost:8080/preview</div>
                  </div>
                  <iframe 
                    id="previewFrame"
                    srcDoc={generatedHtml || "<html><body style='background:#f0f0f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'><h1 style='color:#ccc'>Projeto Vazio</h1></body></html>"}
                    className="w-full h-full border-none outline-none sm:pt-8 bg-white"
                    title="Live Preview"
                    sandbox="allow-scripts allow-forms allow-same-origin"
                  />
                </div>
              )}
              {activeTab === 'code' && (
                <div className="w-full h-full bg-[#111111] sm:border border-white/10 text-[#d4d4d4] font-mono text-[13px] p-6 overflow-auto">
                  <pre><code>{generatedHtml}</code></pre>
                </div>
              )}
              {activeTab === 'architecture' && generatedNode && (
                <div className="w-full h-full bg-[#111111] sm:border border-white/10 text-[#00ff88] font-mono text-xs p-8 overflow-auto leading-relaxed">
                  <div className="mb-8 border-b border-white/10 pb-4">
                    <h2 className="text-white text-sm mb-2 font-bold tracking-widest uppercase">Arquitetura de Sistemas</h2>
                    <pre className="whitespace-pre-wrap">{generatedNode.arquitetura_ascii}</pre>
                  </div>
                  <div className="mb-8 border-b border-white/10 pb-4">
                    <h2 className="text-white text-sm mb-2 font-bold tracking-widest uppercase">Instalação e Deploy (README)</h2>
                    <pre className="whitespace-pre-wrap text-[#f0f0f0]">{generatedNode.readme_md}</pre>
                  </div>
                  <div className="mb-8 border-b border-white/10 pb-4 text-[#888888]">
                    <h2 className="text-white text-sm mb-2 font-bold tracking-widest uppercase">Dependências (package.json)</h2>
                    <pre className="whitespace-pre-wrap text-[11px]">{generatedNode.package_json}</pre>
                  </div>
                  <div className="text-[#888888]">
                    <h2 className="text-white text-sm mb-2 font-bold tracking-widest uppercase">Backend Fonte (server.js)</h2>
                    <pre className="whitespace-pre-wrap text-[11px]">{generatedNode.server_js}</pre>
                  </div>
                </div>
              )}
              {activeTab === 'hardware' && generatedNode && (
                <div className="w-full h-full bg-[#111111] sm:border border-white/10 font-mono text-xs p-8 overflow-auto leading-relaxed">
                  <div className="mb-8 border-b border-white/10 pb-4">
                    <h2 className="text-white text-sm mb-4 font-bold tracking-widest uppercase flex items-center justify-between">
                      Código da Placa (C++/MicroPython)
                      <span className="text-[#ff6600] text-[10px]">FIRMWARE IOT</span>
                    </h2>
                    <pre className="whitespace-pre-wrap text-[#f0f0f0] bg-black/50 p-4 border border-white/5">{generatedNode.codigo_placa || 'Nenhum código gerado.'}</pre>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                    {generatedNode.pdf_pecas && (
                      <div className="flex flex-col gap-4 border border-white/10 p-4 bg-black/20">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[#ff6600] font-bold">Lista de Peças</h3>
                          <button onClick={() => gerarPDF(generatedNode.pdf_pecas!, 'Lista de Pecas')} className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 transition-colors">PDF</button>
                        </div>
                        <pre className="whitespace-pre-wrap text-[9px] text-[#888888] overflow-hidden max-h-40">{generatedNode.pdf_pecas.substring(0, 500)}...</pre>
                      </div>
                    )}
                    {generatedNode.pdf_montagem && (
                      <div className="flex flex-col gap-4 border border-white/10 p-4 bg-black/20">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[#ff6600] font-bold">Manual de Montagem</h3>
                          <button onClick={() => gerarPDF(generatedNode.pdf_montagem!, 'Manual de Montagem')} className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 transition-colors">PDF</button>
                        </div>
                        <pre className="whitespace-pre-wrap text-[9px] text-[#888888] overflow-hidden max-h-40">{generatedNode.pdf_montagem.substring(0, 500)}...</pre>
                      </div>
                    )}
                    {generatedNode.pdf_documentacao && (
                      <div className="flex flex-col gap-4 border border-white/10 p-4 bg-black/20">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[#ff6600] font-bold">Documentação Técnica</h3>
                          <button onClick={() => gerarPDF(generatedNode.pdf_documentacao!, 'Documentacao Tecnica')} className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 transition-colors">PDF</button>
                        </div>
                        <pre className="whitespace-pre-wrap text-[9px] text-[#888888] overflow-hidden max-h-40">{generatedNode.pdf_documentacao.substring(0, 500)}...</pre>
                      </div>
                    )}
                    {generatedNode.pdf_setup && (
                      <div className="flex flex-col gap-4 border border-white/10 p-4 bg-black/20">
                        <div className="flex justify-between items-center">
                          <h3 className="text-[#ff6600] font-bold">Guia de Setup</h3>
                          <button onClick={() => gerarPDF(generatedNode.pdf_setup!, 'Guia de Setup')} className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 transition-colors">PDF</button>
                        </div>
                        <pre className="whitespace-pre-wrap text-[9px] text-[#888888] overflow-hidden max-h-40">{generatedNode.pdf_setup.substring(0, 500)}...</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    );
  };

  const renderMarketplace = () => {
    let extraDetails: any = null;
    if (selectedListing && selectedListing.resumo_tecnico) {
       try {
         extraDetails = JSON.parse(selectedListing.resumo_tecnico);
       } catch(e) {
         extraDetails = { descricao_longa: selectedListing.resumo_tecnico };
       }
    }

    return (
    <div className="flex-1 p-0 sm:p-8 overflow-y-auto bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto">
        {!selectedListing && <h2 className="text-2xl pt-8 sm:pt-0 px-4 sm:px-0 font-bold mb-8 text-white uppercase tracking-widest">MARKETPLACE DE AUTOMAÇÕES</h2>}
        {selectedListing ? (
          <div className="bg-[#111111] sm:border border-white/10 sm:rounded-sm">
            {/* Cabecalho Detalhes */}
            <div className="border-b border-white/10 p-4 flex items-center justify-between">
              <button onClick={() => setSelectedListing(null)} className="text-[#888888] hover:text-white uppercase text-xs font-bold tracking-widest transition-colors">◀ VOLTAR</button>
              <div className="flex gap-4">
                <button className="text-[#888888] hover:text-[#ff6600] text-xs uppercase tracking-widest transition-colors flex items-center gap-1"><span>❤️</span> Favoritar</button>
                <button className="text-[#888888] hover:text-[#00ff88] text-xs uppercase tracking-widest transition-colors flex items-center gap-1"><span>📤</span> Compartilhar</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-0 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
              
              {/* Esquerda */}
              <div className="p-6 sm:p-8 space-y-8">
                
                {/* Video / Preview Cover */}
                <div className="aspect-video bg-black/50 border border-white/10 flex flex-col items-center justify-center cursor-pointer group hover:border-[#00ff88]/50 transition-colors relative overflow-hidden">
                   <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-[#00ff88]/10 flex items-center justify-center transition-colors">
                     <Play className="w-6 h-6 text-white/50 group-hover:text-[#00ff88] transition-colors ml-1" />
                   </div>
                   <div className="absolute bottom-4 left-4 text-xs font-mono text-[#888888]">Duração: 2:35</div>
                   <div className="absolute bottom-4 right-4 text-xs font-bold uppercase tracking-widest border border-white/10 px-2 py-1 text-white/50 group-hover:text-white transition-colors bg-black">Preview</div>
                </div>

                {/* Detalhes Técnicos Box */}
                <div className="border border-white/10">
                  <div className="bg-white/5 py-2 px-4 border-b border-white/10 text-xs font-bold uppercase tracking-widest text-[#888888]">DETALHES DO PRODUTO</div>
                  <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-[#888888] text-xs mb-1">TIPO</div>
                      <div className="font-bold">{selectedListing.tipo || 'SOFTWARE'}</div>
                    </div>
                    <div>
                      <div className="text-[#888888] text-xs mb-1">COMPLEXIDADE</div>
                      <div className="font-bold">{selectedListing.complexidade || 'MÉDIO'}</div>
                    </div>
                    <div className="col-span-2">
                       <div className="text-[#888888] text-xs mb-1">TECNOLOGIAS</div>
                       <div className="flex flex-wrap gap-2 mt-1">
                          {selectedListing.tecnologias?.length ? selectedListing.tecnologias.map((t: string) => <span key={t} className="bg-white/10 px-2 py-0.5 text-xs">{t}</span>) : <span className="bg-white/10 px-2 py-0.5 text-xs">Node.js</span>}
                       </div>
                    </div>
                    <div className="col-span-2">
                       <div className="text-[#888888] text-xs mb-1">INTEGRAÇÕES</div>
                       <div className="flex flex-wrap gap-2 mt-1">
                         {extraDetails?.integracoes ? extraDetails.integracoes.map((i:string) => <span key={i} className="text-[#00ff88] text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> {i}</span>) : <span className="text-[#00ff88] text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Padrão</span>}
                       </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-white/10 grid grid-cols-2 gap-4 text-sm bg-black/20">
                     <div>
                       <div className="text-[#888888] text-xs mb-1">TAMANHO</div>
                       <div>{extraDetails?.tamanho || '2.4 MB'}</div>
                     </div>
                     <div>
                        <div className="text-[#888888] text-xs mb-1">ÚLTIMA ATUALIZAÇÃO</div>
                        <div>5 dias atrás</div>
                     </div>
                     <div className="col-span-2 mt-2">
                        <div className="text-[#888888] text-xs mb-1">SUPORTE</div>
                        <div className="flex flex-col gap-1">
                          <span>📧 Email direto</span>
                          <span>⏱️ Resposta &lt; 2h</span>
                        </div>
                     </div>
                  </div>
                </div>
              </div>

              {/* Direita */}
              <div className="p-6 sm:p-8 flex flex-col">
                <h3 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">{selectedListing.icone} {selectedListing.nome}</h3>
                <p className="text-[#888888] mb-4 text-sm">{selectedListing.descricao}</p>
                
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-[#00ff88]">★★★★★</div>
                  <div className="font-bold text-sm">4.8/5.0</div>
                  <div className="text-[#888888] text-xs">(127 avaliações)</div>
                </div>
                <div className="text-xs text-[#888888] mb-8 font-mono">
                  ↓ 847 downloads (este mês: 23)
                </div>

                <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-sm">
                  <div className="text-xs text-[#888888] mb-1">Criador</div>
                  <div className="font-bold flex items-center gap-2">João Silva <span className="text-[#ff6600] text-[10px] bg-[#ff6600]/10 px-1 py-0.5 border border-[#ff6600]/30 rounded-sm">⭐ Top Seller</span></div>
                </div>

                <div className="border border-[#00ff88]/30 bg-[#00ff88]/5 p-6 mb-8 mt-auto rounded-sm">
                   <div className="text-4xl font-bold text-[#00ff88] mb-6">R$ {selectedListing.preco.toFixed(2).replace('.', ',')}</div>
                   
                   <button 
                     onClick={() => handleBuy(selectedListing)}
                     className="w-full bg-[#00ff88] text-black py-4 font-bold uppercase tracking-widest hover:brightness-110 transition-all flex justify-center items-center gap-2 mb-4"
                   >
                     COMPRAR COM PIX
                   </button>
                   
                   <div className="flex items-center gap-2 text-xs justify-center text-[#888888]">
                     <CheckCircle2 className="w-4 h-4 text-[#00ff88]"/>
                     Garantia de 7 dias ou dinheiro de volta
                   </div>
                </div>
                
                <div>
                  <h4 className="text-[#888888] text-xs uppercase mb-3 tracking-widest font-bold">O QUE VOCÊ RECEBE:</h4>
                  <ul className="text-sm space-y-2">
                    {extraDetails?.o_que_recebe ? extraDetails.o_que_recebe.map((item:string, idx:number) => (
                      <li key={idx} className="flex items-start gap-2 text-white/90">
                        <CheckCircle2 className="w-4 h-4 text-[#00ff88] mt-0.5 shrink-0"/> {item}
                      </li>
                    )) : (
                      <>
                        <li className="flex items-start gap-2 text-white/90"><CheckCircle2 className="w-4 h-4 text-[#00ff88] mt-0.5 shrink-0"/> Código HTML/Node.js pronto</li>
                        <li className="flex items-start gap-2 text-white/90"><CheckCircle2 className="w-4 h-4 text-[#00ff88] mt-0.5 shrink-0"/> Scripts de instalação automatizados</li>
                        <li className="flex items-start gap-2 text-white/90"><CheckCircle2 className="w-4 h-4 text-[#00ff88] mt-0.5 shrink-0"/> Documentação completa</li>
                        <li className="flex items-start gap-2 text-white/90"><CheckCircle2 className="w-4 h-4 text-[#00ff88] mt-0.5 shrink-0"/> Suporte por email (14 dias)</li>
                        <li className="flex items-start gap-2 text-white/90"><CheckCircle2 className="w-4 h-4 text-[#00ff88] mt-0.5 shrink-0"/> Atualizações incluídas (1 ano)</li>
                      </>
                    )}
                  </ul>
                  
                  <div className="grid grid-cols-2 gap-4 mt-8">
                     <div>
                       <h4 className="text-[#888888] text-xs uppercase mb-3 tracking-widest font-bold">REQUISITOS:</h4>
                       <ul className="text-xs space-y-1 text-white/70">
                         {extraDetails?.requisitos ? extraDetails.requisitos.map((r:string, idx:number)=><li key={idx}>• {r}</li>) : (
                           <>
                            <li>• Node.js 18+</li>
                            <li>• Conta Google</li>
                           </>
                         )}
                       </ul>
                     </div>
                     <div>
                       <h4 className="text-[#888888] text-xs uppercase mb-3 tracking-widest font-bold">TEMPO DE SETUP:</h4>
                       <ul className="text-xs space-y-2 text-white/70">
                         <li>⏱️ {extraDetails?.tempo_setup || '~20 minutos'}</li>
                         <li>⚡ ~2 minutos (upgrades)</li>
                       </ul>
                     </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Descrição Longa */}
            <div className="border-t border-white/10">
               <div className="bg-white/5 py-3 px-6 border-b border-white/10 text-sm font-bold uppercase tracking-widest">DESCRIÇÃO COMPLETA</div>
               <div className="p-6 sm:p-10 font-mono text-sm leading-relaxed text-[#d0d0d0] max-w-4xl markdown-body whitespace-pre-wrap">
                 {extraDetails?.descricao_longa || extraDetails?.descricao || selectedListing.descricao}
               </div>
            </div>

            {/* Avaliações */}
            <div className="border-t border-white/10 pb-8">
               <div className="bg-white/5 py-3 px-6 border-b border-white/10 text-sm font-bold uppercase tracking-widest">AVALIAÇÕES DOS CLIENTES (127)</div>
               <div className="p-6 sm:p-10 max-w-4xl space-y-8">
                  <div className="border-b border-white/5 pb-6">
                    <div className="flex justify-between items-start mb-2">
                       <div className="font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">M</span> Maria Silva</div>
                       <div className="text-[#00ff88] text-xs">★★★★★ 5/5</div>
                    </div>
                    <p className="text-white mb-2">"Funcionou de primeira! Setup levou 15 minutos. Excelente."</p>
                    <p className="text-xs text-[#888888] mb-3">Pontos positivos: Código limpo, Documentação clara, Suporte rápido</p>
                    <div className="text-xs text-white/40 flex items-center gap-1">👍 123 pessoas acharam útil</div>
                  </div>
                  
                  <div className="border-b border-white/5 pb-6">
                    <div className="flex justify-between items-start mb-2">
                       <div className="font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">C</span> Carlos Ferreira</div>
                       <div className="text-[#00ff88] text-xs">★★★★☆ 4/5</div>
                    </div>
                    <p className="text-white mb-2">"Bom produto. Precisei de ajustes no formulário, mas o suporte ajudou."</p>
                    <p className="text-xs text-[#888888] mb-3">Pontos negativos: Docs poderiam ter mais exemplos</p>
                    <div className="text-xs text-white/40 flex items-center gap-1">👍 47 pessoas acharam útil</div>
                  </div>

                  <button className="text-[#00ff88] text-sm hover:underline uppercase tracking-widest font-bold">Carregar mais avaliações ▼</button>
               </div>
            </div>

          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-0">
            {listings.length === 0 ? (
              <div className="col-span-full text-center text-[#888888] py-12">Nenhuma automação publicada ainda.</div>
            ) : (
              listings.map(l => (
                <div key={l.id} className="bg-[#111111] border border-white/10 p-6 flex flex-col hover:border-[#00ff88]/50 transition-colors">
                  <div className="text-4xl mb-4">{l.icone || '⚙️'}</div>
                  <h3 className="font-bold text-white mb-2 line-clamp-1">{l.nome}</h3>
                  <p className="text-xs text-[#888888] mb-6 flex-1 line-clamp-3">{l.descricao}</p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                    <span className="text-[#00ff88] font-bold text-lg">R$ {l.preco.toFixed(2).replace('.', ',')}</span>
                    <button 
                      onClick={() => setSelectedListing(l)}
                      className="text-xs text-white uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2"
                    >
                      Detalhes
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
    );
  };


  const renderPurchases = () => (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-white uppercase tracking-widest">MINHAS COMPRAS</h2>
        <div className="space-y-4">
          {purchases.length === 0 ? (
            <div className="text-center text-[#888888] py-12">Nenhuma compra encontrada.</div>
          ) : purchases.map(p => {
            const isPending = p.status === 'pending_payment';
            const isPaid = p.status === 'paid' || p.status === 'download_used';
            const isExpired = p.status === 'expired';
            
            const listing = p.marketplace_listings || {};
            
            return (
              <div key={p.id} className={`bg-[#111111] border p-6 ${isPaid ? 'border-[#00ff88]/30' : isPending ? 'border-[#ff6600]/30' : 'border-red-500/30'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      {isPaid ? '✅' : isPending ? '⏳' : '❌'} {listing.nome || 'Automação'}
                    </h3>
                    <p className="text-xs text-[#888888]">Comprado em: {new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className={`text-xs font-bold uppercase py-1 px-3 bg-black/50 ${isPaid ? 'text-[#00ff88]' : isPending ? 'text-[#ff6600]' : 'text-red-500'}`}>
                    {isPaid ? 'PAGO' : isPending ? 'AGUARDANDO PAGAMENTO' : 'EXPIRADO'}
                  </div>
                </div>

                {isPending && (
                  <div className="mt-6 border border-white/5 bg-black/20 p-6 space-y-4">
                    <h4 className="text-white text-sm font-bold uppercase border-b border-white/10 pb-2">Passos para finalização</h4>
                    <p className="text-[#888888] text-xs">Transfira o valor de <strong className="text-white text-sm">R$ {Number(p.preco_pago).toFixed(2).replace('.', ',')}</strong> usando o PIX abaixo. Use seu app do banco e confira os dados. O beneficiário será Pablo Nunes Pereira.</p>
                    
                    <div className="flex items-center gap-4 bg-[#1a1a1a] border border-[#00ff88]/20 p-3">
                      <span className="text-[#00ff88] text-sm tracking-widest font-bold">CHAVE PIX (CELULAR):</span>
                      <span className="text-white font-mono">19994656845</span>
                    </div>

                    <div className="flex items-center gap-4 bg-[#1a1a1a] border border-[#ff6600]/20 p-3 mt-2">
                      <span className="text-[#ff6600] text-sm tracking-widest font-bold">REFERÊNCIA DA COMPRA:</span>
                      <span className="text-white font-mono">{p.chave_pix_ref}</span>
                    </div>

                    <p className="text-[#888888] text-xs mt-4">Após o pagamento, envie o comprovante (print) no WhatsApp:</p>
                    <button 
                      onClick={() => {
                        const msg = `PARVUS AUTOMATE COMPRA\n\nUsuário: ${session?.user?.email}\nAutomação: ${listing.nome}\nReferência: ${p.chave_pix_ref}\nValor: R$ ${Number(p.preco_pago).toFixed(2).replace('.', ',')}\n\n[Anexe o print do comprovante aqui]`;
                        window.open(`https://wa.me/5519994656845?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="bg-[#25D366] text-white px-6 py-2 font-bold text-sm hover:brightness-110 flex items-center gap-2 mt-2"
                    >
                      📲 ENVIAR COMPROVANTE VIA WHATSAPP
                    </button>
                    <p className="text-red-400 text-[10px] mt-2 tracking-widest">EXPIRA EM 24 HORAS</p>
                  </div>
                )}

                {isPaid && (
                  <div className="mt-4 flex gap-4">
                     <button onClick={() => downloadPurchasedProject(listing.project_id, listing.nome)} className="bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 px-4 py-2 hover:bg-[#00ff88]/20 transition-colors uppercase text-xs font-bold whitespace-nowrap">
                      ↓ BAIXAR CÓDIGO FONTE (ZIP)
                    </button>
                    <button onClick={() => downloadPurchasedManual(listing.project_id, listing.nome)} className="bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 px-4 py-2 hover:bg-[#00ff88]/20 transition-colors uppercase text-xs font-bold whitespace-nowrap">
                      ↓ BAIXAR MANUAL (TXT)
                    </button>
                  </div>
                )}
                
                {isExpired && (
                  <button onClick={() => {setCurrentView('marketplace'); setSelectedListing(listing);}} className="mt-4 border border-white/20 text-white hover:bg-white/5 px-4 py-2 uppercase text-xs">
                    TENTAR COMPRAR NOVAMENTE
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const confirmPayment = async (purchaseId: string) => {
    if (!supabase) return;
    setConfirmModal({
      title: "Confirmar Pagamento",
      message: "Confirmar que o pagamento foi recebido?",
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.from('marketplace_purchases').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', purchaseId).select();
          
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error("Edição bloqueada pelo banco de dados (Verifique suas políticas RLS no Supabase)");
          }

          showToast('Pagamento confirmado!', 'success');
          fetchAdminData();
        } catch (e: any) {
          showToast('Erro ao confirmar: ' + e.message, 'error');
        }
      }
    });
  };

  const previewListing = async (listingId: string) => {
    if (!supabase) return;
    try {
      const listing = adminData.pendingListings.find((l: any) => l.id === listingId);
      if (!listing) return;
      const { data, error } = await supabase.from('projects').select('*').eq('id', listing.project_id).single();
      if (error) throw error;
      if (data) {
        setPreviewProject(data);
      }
    } catch (e: any) {
      showToast('Erro ao carregar prévia: ' + e.message, 'error');
    }
  };

  const processListing = async (listing: any, action: 'approve'|'reject') => {
    if (!supabase) return;
    if (action === 'approve') {
       // Auto-generate details with Gemini
       try {
         showToast('Gerando dados de marketplace com IA...', 'info');
         const { data: project } = await supabase.from('projects').select('*').eq('id', listing.project_id).single();
         if (!project) throw new Error("Projeto base não encontrado.");

         const prompt = `AGENTE: Marketplace Namer

Input:
- Problema original: ${project.problema}
- Tipo: ${project.tipo}
- Complexidade: ${project.complexidade}
- Tecnologias: ${project.tecnologias?.join(', ') || 'Não especificado'}

Output (JSON válido):
{
  "nome": "Nome comercial curto (3-6 palavras)",
  "descricao": "Resumo de 80-120 caracteres",
  "descricao_longa": "Descrição detalhada em markdown do produto, abordando como funciona, perfeito para, customizações. Formatação estruturada.",
  "preco": 199.90,
  "categoria": "WhatsApp/Mensagens|CRM/Leads|Relatórios/Dados|E-commerce/Vendas|Integrações",
  "tags": ["tag1", "tag2", "tag3"],
  "icone": "emoji único",
  "resumo_tecnico": {
    "integracoes": ["WhatsApp Business", "Google Sheets"],
    "requisitos": ["Node.js 18+", "Conta Google"],
    "tamanho": "2.1 MB",
    "tempo_setup": "⏱️ ~20 minutos",
    "o_que_recebe": ["Código HTML/Node.js pronto", "Documentação", "Deploy automático em 5 min"]
  }
}

TABELA DE PREÇOS (base por categoria):
WhatsApp/Mensagens → R$ 49 a R$ 499
CRM/Leads → R$ 99 a R$ 799
Relatórios/Dados → R$ 79 a R$ 999
E-commerce/Vendas → R$ 149 a R$ 1.999
Integrações → R$ 199 a R$ 2.999
Soluções Enterprise → R$ 2999+

Calcule o preço com base na complexidade e nessas faixas. Arredonde para final .90 ou .00. 
Sem markdown no retorno. Apenas o JSON válido.`;
         
         const response = await callGeminiApi('gemini-2.0-flash', prompt, {
           temperature: 0.2,
           responseMimeType: "application/json"
         });
         
         const text = response.text;
         if (!text) throw new Error("AI response empty");
         const result = JSON.parse(text);
         
         // Immediately save to supabase
         const { data, error } = await supabase.from('marketplace_listings').update({
           status: 'approved',
           nome: result.nome,
           descricao: result.descricao,
           preco: result.preco,
           categoria: result.categoria,
           tags: result.tags,
           icone: result.icone,
           resumo_tecnico: JSON.stringify({
             descricao_longa: result.descricao_longa,
             ...result.resumo_tecnico
           }),
           approved_at: new Date().toISOString()
         }).eq('id', listing.id).select();
         
         if (error) throw error;
         if (!data || data.length === 0) throw new Error("Edição bloqueada pelo RLS no Supabase.");

         showToast('Automação processada pela IA e aprovada!', 'success');
         fetchAdminData();
         
       } catch (e: any) {
         showToast('Erro ao aprovar com IA: ' + e.message, 'error');
       }
    } else {
       setConfirmModal({
         title: "Rejeitar Automação",
         message: "Tem certeza que deseja rejeitar esta automação?",
         onConfirm: async () => {
           try {
             const { data, error } = await supabase.from('marketplace_listings').update({ status: 'rejected' }).eq('id', listing.id).select();
             if (error) throw error;
             if (!data || data.length === 0) throw new Error("Edição bloqueada pelo RLS no Supabase.");

             showToast('Automação rejeitada.', 'success');
             fetchAdminData();
           } catch (e: any) {
             showToast('Erro: ' + e.message, 'error');
           }
         }
       });
    }
  };

  const renderPreviewModal = () => {
    if (!previewProject) return null;
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-white/10 w-full max-w-6xl h-[90vh] flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-white/10">
            <h3 className="text-xl font-bold uppercase tracking-widest text-[#00ff88]">PRÉVIA DA AUTOMAÇÃO: {previewProject.titulo}</h3>
            <button onClick={() => setPreviewProject(null)} className="text-[#888888] hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 bg-white relative">
             <iframe 
               srcDoc={previewProject.html_gerado || '<html><body>Nenhum HTML gerado.</body></html>'}
               className="w-full h-full border-none"
               sandbox="allow-scripts allow-same-origin allow-forms"
             />
          </div>
        </div>
      </div>
    );
  };

  const renderAdmin = () => {
    if (!isAdmin) {
      return <div className="text-center mt-20 text-red-500">Acesso negado. Funcionalidade exclusiva para administradores.</div>;
    }

    return (
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto space-y-8">
          <AdminDashboard />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 border-t border-white/10 pt-8">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <h3 className="text-xl text-[#00ff88] uppercase tracking-widest font-bold">COMPRAS AGUARDANDO ({adminData.pendingPurchases.length})</h3>
                <button onClick={fetchAdminData} className="flex items-center gap-2 border border-white/20 px-3 py-1 hover:bg-white/5 transition-colors text-xs uppercase tracking-widest text-[#888888] hover:text-white">
                  <RefreshCw className="w-3 h-3"/> Atualizar
                </button>
              </div>
              <div className="grid gap-4">
                {adminData.pendingPurchases.map((p: any) => (
                  <div key={p.id} className="bg-[#111111] p-4 border border-[#ff6600]/30 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-bold text-lg">{p.marketplace_listings?.nome || 'N/A'}</div>
                        <div className="text-xs text-[#888888] max-w-[200px] truncate" title={p.user_id}>User: {p.user_id}</div>
                        <div className="text-sm font-mono text-[#ff6600] mt-1">Ref: {p.chave_pix_ref}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#00ff88] font-bold text-xl">R$ {Number(p.preco_pago).toFixed(2).replace('.', ',')}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end border-t border-white/5 pt-4">
                      <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-xs uppercase tracking-widest font-bold transition-colors">👁 COMPROVANTE</button>
                      <button onClick={() => confirmPayment(p.id)} className="bg-[#00ff88] text-black hover:brightness-110 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all">✓ CONFIRMAR</button>
                    </div>
                  </div>
                ))}
                {adminData.pendingPurchases.length === 0 && <div className="text-center bg-[#111111] border border-white/5 p-8 text-[#888888] text-xs">Nenhum pagamento aguardando.</div>}
              </div>
            </div>

            <div>
              <h3 className="text-xl text-[#ff6600] mb-4 uppercase tracking-widest font-bold">AUTOMAÇÕES PENDENTES ({adminData.pendingListings.length})</h3>
              <div className="grid gap-4">
                {adminData.pendingListings.map((l: any) => (
                  <div key={l.id} className="bg-[#111111] p-4 border border-white/10 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-bold text-lg">{l.nome}</div>
                        <div className="text-xs text-[#888888] max-w-[200px] truncate" title={l.creator_id}>Criador: {l.creator_id}</div>
                        {l.tecnologias && l.tecnologias.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                             {l.tecnologias.map((t:any) => <span key={t} className="text-[10px] bg-white/5 text-[#888888] px-2 py-0.5 rounded-sm">{t}</span>)}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-white font-mono font-bold">
                        R$ {Number(l.preco).toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end border-t border-white/5 pt-4">
                      <button onClick={() => previewListing(l.id)} className="border border-[#00ff88] text-[#00ff88] px-3 py-1.5 text-xs hover:bg-[#00ff88]/10 font-bold tracking-widest transition-colors">👁 PREVIEW</button>
                      <button onClick={() => processListing(l, 'approve')} className="bg-[#00ff88] text-black px-3 py-1.5 text-xs font-bold tracking-widest hover:brightness-110 transition-all">✓ APROVAR</button>
                      <button onClick={() => processListing(l, 'reject')} className="bg-red-500 text-white px-3 py-1.5 text-xs font-bold tracking-widest hover:brightness-110 transition-all">✗ REJEITAR</button>
                    </div>
                  </div>
                ))}
                {adminData.pendingListings.length === 0 && <div className="text-center bg-[#111111] border border-white/5 p-8 text-[#888888] text-xs">Nenhuma automação para revisar.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col font-mono bg-[#0a0a0a] text-[#f0f0f0] overflow-hidden relative">
      {/* Backgrounds */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-5" style={{ background: 'repeating-linear-gradient(0deg, #000, #000 2px, transparent 2px, transparent 4px)' }}></div>
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {renderTopbar()}
      <main className="flex flex-1 overflow-hidden relative z-10 w-full">
        {currentView === 'app' ? (
          <>
            {entryFlow === 'ai' && renderLeftPanel()}
            {entryFlow === 'selection' ? (
              <EntrySelection onSelect={handleSelectEntryFlow} />
            ) : entryFlow === 'templates' ? (
              <TemplatesFlow 
                onBack={() => setEntryFlow('selection')}
                onGoToAI={() => setEntryFlow('ai')}
                onGenerate={handleTemplateGenerate}
              />
            ) : entryFlow === 'briefing' ? (
              <BriefingFlow 
                onBack={() => setEntryFlow('selection')}
                onSubmit={handleBriefingSubmit}
              />
            ) : (
              <section className="flex-1 flex flex-col bg-[#0a0a0a]">
                {renderBuildArea()}
              </section>
            )}
          </>
        ) : currentView === 'marketplace' ? (
          renderMarketplace()
        ) : currentView === 'purchases' ? (
          renderPurchases()
        ) : currentView === 'admin' ? (
          isAdmin ? renderAdmin() : <div className="text-center mt-20 text-red-500">Acesso negado. Funcionalidade exclusiva para administradores.</div>
        ) : currentView === 'settings' ? (
          <SettingsPage onLogout={handleLogout} />
        ) : currentView === 'iot' ? (
          <IotMonitor />
        ) : null}
      </main>
      
      {/* FOOTER STATUS BAR */}
      <footer className="h-8 border-t border-white/10 bg-[#111111] px-4 flex items-center justify-between text-[9px] text-[#444444] z-10 shrink-0">
        <div className="flex items-center gap-4">
          <span>MEM: 1.4GB / 4GB</span>
          <span>API_LATENCY: 42ms</span>
        </div>
        <div className="flex items-center gap-4 uppercase tracking-widest hidden sm:flex">
          <span className="text-[#888888]">NVIDIA_NIM_ENGINE</span>
          <span className="text-[#00ff88]">● READY</span>
        </div>
      </footer>

      {/* TOAST SYSTEM */}
      {toast && (
        <div className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-50 px-6 py-3 border whitespace-nowrap shadow-2xl transition-all ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-500' : toast.type === 'success' ? 'bg-[#00ff88]/10 border-[#00ff88]/50 text-[#00ff88]' : 'bg-[#111111] border-white/10 text-white'}`}>
          <span className="font-bold uppercase tracking-widest text-xs">{toast.message}</span>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {renderPreviewModal()}

      {/* CONFIRM MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-tighter">{confirmModal.title}</h3>
            <p className="text-[#888888] text-sm mb-8 whitespace-pre-wrap">{confirmModal.message}</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 hover:bg-white/5 text-[#888888] uppercase text-xs tracking-widest transition-colors font-bold">CANCELAR</button>
              <button 
                onClick={() => {
                  setConfirmModal(null);
                  confirmModal.onConfirm();
                }} 
                className="px-4 py-2 bg-[#00ff88] text-black uppercase text-xs tracking-widest font-bold hover:brightness-110"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {checkoutListing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#00ff88]/30 max-w-xl w-full text-white shadow-[0_0_50px_rgba(0,255,136,0.05)] overflow-hidden flex flex-col max-h-[90vh]">
             <div className="border-b border-white/10 p-4 font-bold tracking-widest text-[#888888] text-xs flex items-center">
                <span className="w-2 h-2 rounded-full bg-[#00ff88] mr-2 animate-pulse"></span>
                FINALIZANDO COMPRA
             </div>
             
             <div className="p-6 sm:p-8 overflow-y-auto">
                <div className="text-xs text-[#888888] mb-1 uppercase tracking-widest font-bold">RESUMO DO PRODUTO</div>
                <div className="border border-white/10 p-6 mb-6">
                   <h3 className="text-xl font-bold text-white mb-2">{checkoutListing.icone} {checkoutListing.nome}</h3>
                   <p className="text-[#888888] text-sm mb-4">Automação 100% pronta para usar</p>
                   
                   <ul className="text-sm space-y-2 mb-6">
                     <li className="flex items-center gap-2 text-white/80"><CheckCircle2 className="w-4 h-4 text-[#888888]" /> Validação de e-mail automática</li>
                     <li className="flex items-center gap-2 text-white/80"><CheckCircle2 className="w-4 h-4 text-[#888888]" /> Envio via {checkoutListing.nome.includes('WhatsApp') ? 'WhatsApp' : 'Webhook/API'}</li>
                     <li className="flex items-center gap-2 text-white/80"><CheckCircle2 className="w-4 h-4 text-[#888888]" /> Registro em Google Sheets</li>
                   </ul>

                   <div className="flex items-center gap-2 mb-6">
                     <div className="text-[#00ff88]">★★★★★</div>
                     <div className="text-xs">4.8/5.0 <span className="text-[#888888]">(127 avaliações)</span></div>
                   </div>

                   <div className="flex justify-between items-center border-t border-white/10 pt-4">
                     <div>
                       <div className="text-xs text-[#888888] line-through">De: R$ {(checkoutListing.preco * 1.5).toFixed(2).replace('.', ',')}</div>
                       <div className="text-xs text-[#00ff88]">Sem desconto aplicável</div>
                     </div>
                     <div className="text-3xl font-bold text-[#00ff88]">R$ {checkoutListing.preco.toFixed(2).replace('.', ',')}</div>
                   </div>
                </div>

                <div className="text-xs text-[#888888] mb-1 uppercase tracking-widest font-bold">VOCÊ RECEBERÁ</div>
                <ul className="text-sm space-y-2 mb-8 bg-white/5 p-4 border border-white/5">
                   <li className="flex items-center gap-2 text-white"><CheckCircle2 className="w-4 h-4 text-[#00ff88]" /> Código fonte completo (HTML/Node.js)</li>
                   <li className="flex items-center gap-2 text-white"><CheckCircle2 className="w-4 h-4 text-[#00ff88]" /> Documentação + README.md</li>
                   <li className="flex items-center gap-2 text-white"><CheckCircle2 className="w-4 h-4 text-[#00ff88]" /> Deploy automático em 5 min (Vercel)</li>
                   <li className="flex items-center gap-2 text-white"><CheckCircle2 className="w-4 h-4 text-[#00ff88]" /> Suporte por email (14 dias)</li>
                   <li className="flex items-center gap-2 text-white"><CheckCircle2 className="w-4 h-4 text-[#00ff88]" /> Atualizações incluídas (1 ano)</li>
                   <li className="flex items-center gap-2 text-white"><CheckCircle2 className="w-4 h-4 text-[#00ff88]" /> Garantia de 7 dias (money-back)</li>
                </ul>
             </div>

             <div className="border-t border-white/10 p-4 bg-black/40 flex justify-between gap-4 mt-auto">
               <button onClick={() => setCheckoutListing(null)} className="px-6 py-3 border border-white/10 hover:bg-white/5 uppercase text-xs tracking-widest font-bold text-white transition-colors">◀ VOLTAR</button>
               <button onClick={() => processCheckout(checkoutListing)} className="flex-1 bg-[#00ff88] text-black px-6 py-3 uppercase text-xs tracking-widest font-bold hover:brightness-110 transition-colors flex justify-center items-center gap-2">CONTINUAR ▶</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
