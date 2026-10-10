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
  Maximize, Minimize, TrendingUp, Users, DollarSign, History,
  Database, Sliders, Bookmark, GitFork, Shield, Sparkles, Send, Box,
  Copy, Check, FileCode, Layers, Cloud, Menu, ChevronDown, ChevronUp,
  MoreHorizontal, Wrench, Laptop
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
import { WebhookSimulatorModal } from './components/modals/WebhookSimulatorModal';
import { SqlSchemaModal } from './components/modals/SqlSchemaModal';
import { EnvConfigModal } from './components/modals/EnvConfigModal';
import { BackgroundGenerationWidget } from './components/common/BackgroundGenerationWidget';
import { LandingPage } from './components/LandingPage';
import { generateDockerFiles } from './lib/dockerGenerator';
import { exportCompleteProjectZip, downloadBlob } from './lib/projectExporter';
import { saveProjectAsTemplate, CustomTemplate } from './lib/customTemplatesService';
import { extractOrGenerateSqlSchema } from './lib/sqlSchemaHelper';
import { useAutoSaveDraft } from './lib/hooks/useAutoSaveDraft';
import { CanvasStudio } from './components/flow/CanvasStudio';
import { FlowAST, FlowCompilationResult, WorkspaceMode } from './lib/flow/types';
import { createDefaultFlowAST } from './lib/flow/compiler';
import { safeJsonParseWithRepair } from './lib/jsonRepairHelper';
import { ErrorRecoveryModal } from './components/modals/ErrorRecoveryModal';
import { IotSoftware } from './components/iot/IotSoftware';
import { IotTelemetryMonitor, TelemetryPacket } from './components/iot/IotTelemetryMonitor';
import { formatSafeTimestamp, detectDeviceCategory } from './lib/iotRepairHelper';
import { VirtualSandboxRunner } from './components/sandbox/VirtualSandboxRunner';
import { ArchitectureFlowCanvas } from './components/canvas/ArchitectureFlowCanvas';

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
  schema_sql?: string;
  codigo_placa?: string;
  pdf_pecas?: string;
  pdf_montagem?: string;
  pdf_documentacao?: string;
  pdf_setup?: string;
  flow_ast?: FlowAST;
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

// Helper to bridge AI calls to server-side proxy (NVIDIA NIM Primary, Gemini Fallback)
const callGeminiApi = async (model: string, contents: string, config?: any) => {
  const nvidiaKey =
    localStorage.getItem('nvidia_api_key') ||
    localStorage.getItem('NVIDIA_API_KEY') ||
    localStorage.getItem('parvus_nvidia_key') ||
    '';
  const legacyKey = localStorage.getItem('parvus_key') || '';
  const geminiKey = localStorage.getItem('gemini_api_key') || '';

  let resolvedNvidiaKey = nvidiaKey;
  let resolvedGeminiKey = geminiKey;
  if (legacyKey) {
    if (legacyKey.startsWith('nvapi-') || !legacyKey.startsWith('AIzaSy')) {
      if (!resolvedNvidiaKey) resolvedNvidiaKey = legacyKey;
    } else {
      if (!resolvedGeminiKey) resolvedGeminiKey = legacyKey;
    }
  }
  
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
  let response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 240000); // 240 sec timeout (acomoda síntese densa e contingência multi-provedor)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (resolvedNvidiaKey) {
      headers['x-nvidia-key'] = resolvedNvidiaKey;
      headers['nvidia-api-key'] = resolvedNvidiaKey;
      headers['authorization'] = `Bearer ${resolvedNvidiaKey}`;
    }
    if (resolvedGeminiKey) {
      headers['x-gemini-key'] = resolvedGeminiKey;
    }

    response = await fetch(`${apiUrl}/api/ai/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'meta/llama-3.3-70b-instruct',
        contents,
        config
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout: O processamento demorou mais que o esperado. Sistema de recuperação ativo.`);
    }
    throw new Error(`Falha na conexão com o servidor de IA. Tente novamente.`);
  }

  if (!response.ok) {
    const errText = await response.text();
    let errData: any = {};
    try {
      errData = JSON.parse(errText);
    } catch(e) {
      errData = safeJsonParseWithRepair(errText, { error: `Erro HTTP ${response.status}` });
    }
    throw new Error(errData.error || `Erro HTTP ${response.status}`);
  }

  // A resposta pode conter espaços de heartbeat; lemos o texto bruto e fazemos parse defensivo
  const rawText = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(rawText.trim());
  } catch (e) {
    data = safeJsonParseWithRepair(rawText, { text: rawText.trim() });
  }

  if (data.error) {
    throw new Error(`[FALHA DE ESCOPO]: ${data.error}`);
  }

  return {
    text: data.text
  };
};

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('nvidia_api_key') || localStorage.getItem('NVIDIA_API_KEY') || localStorage.getItem('parvus_key') || '');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const [phase, setPhase] = useState<Phase>('input');
  const [entryFlow, setEntryFlow] = useState<'selection' | 'ai' | 'templates' | 'briefing'>('selection');
  const [currentView, setCurrentView] = useState<'app' | 'marketplace' | 'purchases' | 'admin' | 'iot' | 'iot-generator' | 'iot-software' | 'iot-monitor' | 'settings'>('app');
  const [showSandboxRunner, setShowSandboxRunner] = useState(false);
  const [recoveryError, setRecoveryError] = useState<{ message: string; onRetry: () => void } | null>(null);
  const [architectureViewMode, setArchitectureViewMode] = useState<'nodes' | 'canvas' | 'ascii'>('nodes');
  const [latestTelemetryPacket, setLatestTelemetryPacket] = useState<TelemetryPacket | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPacket[]>([]);
  
  // Topic navigation & mobile responsive states
  const [activeTopicDropdown, setActiveTopicDropdown] = useState<'software' | 'iot' | 'account' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'prompt' | 'view'>('view');

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-topic-dropdown]')) {
        setActiveTopicDropdown(null);
        setShowToolsDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const draftStorage = useAutoSaveDraft('parvus_draft_software', {
    problemDescription: '',
    answers: {} as Record<string, string>
  });

  const [problemDescription, setProblemDescription] = useState(() => draftStorage.data.problemDescription || '');
  const [classification, setClassification] = useState<Classification | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(() => draftStorage.data.answers || {});
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Sync draft state
  useEffect(() => {
    draftStorage.save({ problemDescription, answers });
  }, [problemDescription, answers]);
  
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);
  const [checkoutListing, setCheckoutListing] = useState<any>(null);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [previewProject, setPreviewProject] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLanding, setShowLanding] = useState<boolean>(() => !localStorage.getItem('parvus_has_seen_landing'));
  const generationLimit = useGenerationLimit();

  // New enterprise modals states
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showSqlSchemaModal, setShowSqlSchemaModal] = useState(false);
  const [showEnvConfigModal, setShowEnvConfigModal] = useState(false);

  // Dual Mode e Visualização do Canvas Studio
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('express');

  const handleCanvasCompileAndSync = (compiled: FlowCompilationResult) => {
    setGeneratedNode(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        server_js: compiled.expressCode,
        package_json: compiled.packageJson,
        env_example: compiled.envExample,
        schema_sql: compiled.schemaSql,
        arquitetura_ascii: compiled.asciiArchitecture,
        codigo_placa: compiled.codigoPlaca || prev.codigo_placa
      };
    });
    showToast("Código de produção compilado e sincronizado com o Canvas Studio!", "success");
  };

  // Background generation state (decoupled from single view)
  const [backgroundGen, setBackgroundGen] = useState<{
    active: boolean;
    progress: number;
    message: string;
    model: string;
    type: 'software' | 'iot';
    title: string;
  }>({
    active: false,
    progress: 0,
    message: '',
    model: 'NVIDIA NIM (Llama 3.3 / Nemotron) & Fallback Gemini',
    type: 'software',
    title: ''
  });

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
  
  // Active IoT project for preloading into IoT Studio (with local storage persistence)
  const [activeIotProject, setActiveIotProject] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('parvus_active_iot_project');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const updateActiveIotProject = (proj: any) => {
    setActiveIotProject(proj);
    try {
      if (proj) {
        localStorage.setItem('parvus_active_iot_project', JSON.stringify(proj));
      } else {
        localStorage.removeItem('parvus_active_iot_project');
      }
    } catch (e) {
      console.warn("Storage error", e);
    }
  };

  const handleDispatchTelemetry = (packetData: any) => {
    const rawTs = packetData.timestamp || packetData.data?.timestamp;
    const formattedTs = formatSafeTimestamp(rawTs);
    const isScaleDevice = detectDeviceCategory(activeIotProject) === 'scale' || 
                          packetData.peso !== undefined || 
                          packetData.data?.peso !== undefined;

    const norm: TelemetryPacket = {
      id: packetData.id || 'pkt_' + Math.random().toString(36).substring(2, 8),
      device_id: packetData.device_id || activeIotProject?.placa || (isScaleDevice ? 'esp32_scale_01' : 'esp32_gateway_01'),
      tenant: packetData.tenant || 'enterprise-corp',
      timestamp: formattedTs,
      // Se for balança, não injeta temperatura/umidade fictícia
      ...(isScaleDevice ? {} : {
        temperatura: Number(packetData.data?.temperatura ?? packetData.temperatura ?? 24.5),
        umidade: Number(packetData.data?.umidade ?? packetData.umidade ?? 58.0),
        rele_1: Boolean(packetData.data?.rele_1 ?? packetData.rele_1),
      }),
      rssi: Number(packetData.data?.rssi ?? packetData.rssi ?? -56),
      bateria_mv: Number(packetData.data?.bateria_mv ?? packetData.bateria_mv ?? 4110),
      rawJson: packetData.rawJson || JSON.stringify(packetData.data || packetData),
      // Preserva dinamicamente quaisquer métricas do hardware (peso, tara, adc_raw, etc.)
      ...(packetData.data || {}),
      ...packetData
    };
    norm.id = packetData.id || norm.id || 'pkt_' + Math.random().toString(36).substring(2, 8);
    norm.timestamp = formattedTs;
    setLatestTelemetryPacket(norm);
    setTelemetryHistory(prev => [...prev.slice(-24), norm]);
    showToast(`Pacote de ${norm.device_id} sincronizado com o IoT Monitor!`, 'success');
  };

  // Active file selector for the Code tab
  const [codeActiveFile, setCodeActiveFile] = useState<'index.html' | 'server.js' | 'schema.sql' | 'package.json' | '.env.example' | 'Dockerfile'>('index.html');
  const [copiedFile, setCopiedFile] = useState(false);

  const currentCodeFileContent = useMemo(() => {
    switch (codeActiveFile) {
      case 'index.html':
        return generatedHtml || '<!-- Nenhum HTML gerado ainda -->';
      case 'server.js':
        return generatedNode?.server_js || '// Nenhum backend server.js gerado ainda';
      case 'schema.sql':
        return generatedNode?.schema_sql || (generatedNode ? extractOrGenerateSqlSchema({ titulo: classification?.resumo, problema: problemDescription, tipo: classification?.tipo, nodeGerado: generatedNode }) : '-- Nenhum esquema SQL gerado ainda');
      case 'package.json':
        return generatedNode?.package_json || '{\n  "name": "parvus-app",\n  "version": "1.0.0"\n}';
      case '.env.example':
        return generatedNode?.env_example || '# PORT=3000\n# DATABASE_URL=postgresql://postgres:password@localhost:5432/parvus_db';
      case 'Dockerfile':
        return generateDockerFiles({
          projectName: 'parvus-app',
          port: 3000,
          includeDatabase: true,
          includeMqtt: false,
          nodeVersion: '20-alpine'
        }).dockerfile;
      default:
        return generatedHtml || '';
    }
  }, [codeActiveFile, generatedHtml, generatedNode]);
  
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
      localStorage.setItem('nvidia_api_key', apiKey);
      localStorage.setItem('NVIDIA_API_KEY', apiKey);
    } else {
      localStorage.removeItem('parvus_key');
      localStorage.removeItem('nvidia_api_key');
      localStorage.removeItem('NVIDIA_API_KEY');
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
      } else {
        setHistory(JSON.parse(localStorage.getItem('parvus_history') || '[]'));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProjects();
        checkAdmin(session.user.id);
      } else {
        setIsAdmin(false);
        setHistory(JSON.parse(localStorage.getItem('parvus_history') || '[]'));
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

  // Persist history if offline or guest
  useEffect(() => {
    if (!supabase || !session) {
      localStorage.setItem('parvus_history', JSON.stringify(history));
    }
  }, [history, session, supabase]);

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
      const prompt = `Você é o Arquiteto Chefe de Software e Classificador de Sistemas da Parvus Automate.
Sua missão é realizar uma auditoria de engenharia profunda no problema descrito pelo usuário para categorizar o sistema e formular de 2 a 3 perguntas críticas de arquitetura que definirão as variáveis-chave da solução.

DIRETRIZES DE AUDITORIA & FORMULAÇÃO DE PERGUNTAS DE ALTO IMPACTO:
- As perguntas NÃO devem ser genéricas (ex: evite perguntas vagas como "qual sua cor favorita?").
- As perguntas DEVEM ser cirúrgicas e técnicas, preferencialmente do tipo 'opcoes' com alternativas concretas de alto valor para o projeto:
  1. Para CRMs / Gestão de Leads / Pipelines: Pergunte a estrutura de etapas do funil desejada ou regra de distribuição de leads (ex: Roleta Round-Robin, Por Região, Por Valor).
  2. Para Agenda / Reservas / Calendário: Pergunte a regra de validação de colisão de horários ou duração padrão dos atendimentos.
  3. Para WhatsApp / Automações de Atendimento / Bots: Pergunte o gatilho exato de disparo (ex: Novo Lead Webhook, Alteração de Status, Pagamento Confirmado) e o tempo de follow-up.
  4. Para Finanças / Calculadoras / Faturamento: Pergunte a fórmula de negócio específica (ex: Alíquota Progressiva, Comissão por Escala de Metas, Juros Compostos) e o formato do relatório exportável.
  5. Para Dashboards / IoT / Painéis de Telemetria: Pergunte o protocolo de telemetria preferido (MQTT vs WebSockets vs HTTP REST) e os limiares de alarme crítico.

Obrigatoriedade: Gere SEMPRE de 2 a 3 perguntas essenciais (com id, texto, tipo e opções quando aplicável).
Analise o problema abaixo e retorne APENAS um JSON válido seguindo estritamente o schema solicitado.

Problema: ${descToUse}`;

      const response = await callGeminiApi('meta/llama-3.3-70b-instruct', prompt, {
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

      let result: Classification;
      try {
        result = safeJsonParseWithRepair<Classification>(response.text || '{}');
      } catch (err) {
        console.error("JSON classification falhou:", err);
        throw new Error("O modelo de IA retornou uma classificação inconsistente. Tente novamente.");
      }
      
      if (!result.tecnologias) result.tecnologias = [];
      if (!result.perguntas_necessarias || !Array.isArray(result.perguntas_necessarias)) {
        result.perguntas_necessarias = [];
      }
      
      // Fallback in case the AI failed to generate questions (Llama JSON omission)
      if (result.perguntas_necessarias.length === 0) {
        result.perguntas_necessarias = [
          {
            id: 'design_pref',
            texto: 'Você tem alguma preferência de cores, identidade visual, ou regra extra técnica para esta aplicação?',
            tipo: 'texto'
          }
        ];
      }
      
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
      
    } catch (error: any) {
      console.error(error);
      updateLog(`> Erro ao classificar: ${error.message || error}`, 'done');
      setPhase('input');
      setRecoveryError({
        message: error.message || String(error),
        onRetry: () => handleAnalyze(descToUse)
      });
      showToast("Ocorreu uma instabilidade na IA. Janela de recuperação disponível.", "error");
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
    const isHardwareOrHybrid = classData.tipo === 'HARDWARE' || classData.tipo === 'HIBRIDO';
    setPhase('generating');
    setGeneratingProgress(10);
    setLogs([]);
    setBackgroundGen({
      active: true,
      progress: 10,
      message: 'Iniciando engenharia e arquitetura de solução...',
      model: 'NVIDIA NIM (Llama 3.3 / Nemotron) & Fallback Gemini',
      type: isHardwareOrHybrid ? 'iot' : 'software',
      title: problemDescription.substring(0, 40)
    });
    
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
      setBackgroundGen(prev => ({ ...prev, progress: 30, message: 'Arquitetando Frontend SPA interativo...' }));
      addLog('> Arquitetando solução frontend...', 'active');
      
      const frontendPrompt = `Você é o Arquiteto Frontend de Elite da Parvus Automate. Sua missão é gerar uma aplicação web completa (Single Page Application), magnífica, visualmente deslumbrante e 100% INTERATIVA para resolver com maestria o seguinte problema.

PROBLEMA: ${problemDescription}
TIPO: ${classData.tipo}
RESPOSTAS DO CLIENTE: \n${answersText}

⚡ PADRÃO VISUAL & DESIGN SYSTEM (NÍVEL AAA - APRESENTAÇÃO DE TCC):
1. TEMA DARK CYBERPUNK LUXUOSO:
   - Fundo principal ultra profundo: bg-[#08090d] ou bg-[#0a0c13] com gradiente radial sutil.
   - Cards e painéis com Glassmorphism refinado: "backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.6)] rounded-2xl".
   - Cores de destaque vibrantes com gradientes: Esmeralda (#10b981), Ciano Neon (#06b6d4), Âmbar (#f59e0b) ou Violeta Elétrico (#8b5cf6).
   - Badges e Pills elegantes: "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider".
   - Tipografia: Importe Google Fonts ("Plus Jakarta Sans" ou "Inter" e "JetBrains Mono" para métricas/código) via <link>.
2. ÍCONES INFALÍVEIS:
   - Se utilizar Lucide Icons via CDN (<script src="https://unpkg.com/lucide@latest"></script>), é OBRIGATÓRIO invocar "lucide.createIcons();" no window.onload E SEMPRE que qualquer elemento dinâmico for adicionado ou re-renderizado pelo script! Ou use SVGs inline desenhados com stroke/fill explícitos.
3. RESPONSIVIDADE TOTAL:
   - Header high-tech, barra lateral retrátil no mobile e área de trabalho central expansiva com scroll suave.

⚡ MOTOR DE ESTADO REATIVO & INTERATIVIDADE REAL (ZERO TELAS ESTÁTICAS):
1. STORE DE DADOS LOCAL:
   - Crie no Javascript um store de dados reativo completo: "const store = { items: [...], stats: {...}, filter: 'ALL', search: '', demoActive: true };"
   - PRÉ-CARREGUE com 10 a 15 registros hiper-realistas e detalhados em português (nomes completos, empresas brasileiras, valores em R$, status reais, datas e métricas).
2. BARRA DE BUSCA & FILTROS EM TEMPO REAL:
   - Um campo de pesquisa (<input>) funcional que filtra instantaneamente as linhas da tabela/cards conforme o usuário digita.
   - Botões de filtro (ex: "Todos", "Ativos", "Pendentes", "Concluídos") com estado ativo visual e filtragem imediata.
3. MODAL DE "NOVO REGISTRO / AÇÃO RÁPIDA" 100% OPERACIONAL:
   - Botão de destaque "Novo Registro" ou "Nova Automação" que ABRE um modal moderno com campos de formulário detalhados.
   - Ao submeter o formulário: valida os campos, insere o novo item no store de dados, atualiza a tabela/cards na hora, recalcula as métricas dos KPI cards, exibe um Toast animado de sucesso no canto da tela e gera um log no terminal do sistema!
4. AÇÕES DE LINHA FUNCIONAIS:
   - Botão de Excluir (remove do store e atualiza tela) e botão de Ver Detalhes (abre modal/drawer com informações completas).
5. GRÁFICOS VISUAIS DINÂMICOS (SVG):
   - Pelo menos 2 gráficos SVG interativos (ex: Gráfico de Área com gradiente e pontos de dados, Sparklines nos KPI cards, Gráfico de Barras comparativo ou Medidores circulares). Os gráficos DEVEM recalcular e redesenhar dinamicamente quando novos registros forem inseridos!
6. CONSOLE DE TELEMETRIA & TERMINAL DE EVENTOS AO VIVO:
   - Painel terminal estilizado (no rodapé ou lateral) simulando o recebimento contínuo de eventos/webhooks em tempo real com timestamps [15:30:12].
   - Controles do Terminal:
     * Botão "Simular Disparo / Novo Evento" (injeta manualmente um novo evento realista ao vivo para demonstrar na apresentação!).
     * Botão "Limpar Logs".
     * Botão de alternância "Modo Demo: ON/OFF" (ao desligar, a simulação automática por setInterval é completamente pausada).
7. COMPONENTES ESPECÍFICOS POR DOMÍNIO:
   - Se for CRM/Pipelines: Quadro Kanban drag-and-drop ou com botões de avançar estágio, cálculo de valor total do pipeline.
   - Se for Agenda/Reservas: Grade de horários com slots clicáveis para reserva imediata e indicador de ocupação.
   - Se for WhatsApp/Chat/Bots: Simulador de conversa ao vivo onde o usuário digita e recebe resposta automática da regra configurada, além de editor visual de nós.
   - Se for IoT/Painéis Industriais: Toggles animados para ligar/desligar atuadores/relés virtuais com som visual, e telemetria de sensores flutuando em tempo real.
   - Se for Finanças/Calculadoras/Fórmulas: Simulador de taxas/cálculos em lote com recálculo instantâneo de totais e projeções.

REGRAS TÉCNICAS ABSOLUTAS:
- Retorne APENAS o código HTML/JS/CSS limpo. NÃO inclua delimitadores markdown de bloco HTML (como as três crases com a palavra html). Comece diretamente com <!DOCTYPE html>.
- O CSS deve usar Tailwind via CDN (<script src="https://unpkg.com/@tailwindcss/browser@4"></script>). Garanta que a tag <body> preencha 100% da tela (w-full h-full min-h-screen).
- Zero placeholders como "// adicione código aqui". Todo o código Javascript deve estar 100% implementado, sem erros de console.
${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Construa o código 100% white-label, sem menção à Parvus Automate.\n' : ''}`;

      const responseHtml = await callGeminiApi('meta/llama-3.3-70b-instruct', frontendPrompt, {
        temperature: 0.2
      });
      
      // Clean markdown formatting if present with hyper-robust utility
      let finalHtml = cleanAndExtractHtml(responseHtml.text || '');

      currentHtml = finalHtml;
      setGeneratedHtml(finalHtml);
      updateLog('> Arquitetando solução frontend...', 'done');

      // 2. Generate Backend Node.js
      setGeneratingProgress(70);
      setBackgroundGen(prev => ({ ...prev, progress: 70, message: 'Projetando microsserviço Node.js, Express & SQL...' }));
      addLog('> Arquitetando solução backend...', 'active');
      
      const backendPrompt = `Você é o Arquiteto Chefe de Backend e Infraestrutura da Parvus Automate.
Sua missão é projetar e gerar um projeto de microsserviço Node.js/Express COMPLETO, MODULAR, ROBUSTO e pronto para produção para atender o seguinte escopo.

PROBLEMA: ${problemDescription}
TIPO: ${classData.tipo}
RESPOSTAS: \n${answersText}

⚡ ESPECIFICAÇÕES DE ENGENHARIA DE BACKEND (NÍVEL ENTERPRISE PARA APRESENTAÇÃO DE TCC):
1. ESTRUTURA DO 'server_js':
   - Servidor Express 4/5 completo e profissional com documentação JSDoc clara em português.
   - MIDDLEWARES DE PRODUÇÃO:
     * helmet() para cabeçalhos de segurança HTTP.
     * cors({ origin: '*' }) com tratamento de pre-flight OPTIONS.
     * express.json({ limit: '10mb' }) e express.urlencoded({ extended: true }).
     * LOGGER CUSTOMIZADO: Middleware que registra no console todas as requisições recebidas com método, rota, status HTTP, IP e tempo de resposta em milissegundos formatado com cores e timestamps [ISO 8601].
   - REPOSITÓRIO EM MEMÓRIA ROBUSTO:
     * Implemente uma classe/objeto de repositório com dados pré-carregados estruturados (mínimo 10 registros fictícios realistas).
     * Geração de IDs usando crypto.randomUUID().
     * Suporte a buscas por texto, filtros por status e paginação (?page=1&limit=10) retornando meta-informações (total, page, totalPages).
   - ENDPOINTS RESTFUL DE PRODUÇÃO:
     * GET /api/v1/health: Verificação de integridade com status, uptime do processo, versão e métricas de memória (process.memoryUsage()).
     * GET /api/v1/metrics: Resumo estatístico com contadores de registros, volume processado e taxa de sucesso.
     * CRUD COMPLETO: GET (listagem paginada e filtrada), GET /:id (busca por ID com 404), POST (criação com validação estrita de payload e retorno 201), PUT /:id (atualização e validação de transição de estado), DELETE /:id.
     * ENDPOINT DE WEBHOOK: POST /api/v1/webhooks/... para ingestão de eventos externos (com validação simulada de cabeçalho de assinatura 'x-signature-sha256' e log detalhado em português).
     * REGRAS ESPECÍFICAS DE DOMÍNIO: Endpoint especializado de negócio (ex: /api/v1/calculate para processar fórmulas com validação matemática; /api/v1/messages/send com interpolação de tags {{nome}}; /api/v1/telemetry com verificação de limites críticos e geração de alarmes).
   - TRATAMENTO DE ERROS PADRONIZADO (RFC 7807):
     * Middleware global de erro devolvendo JSON uniforme: { statusCode, error, message, timestamp, path }.
     * Tratamento de rotas inexistentes (404 Not Found).

2. DOCUMENTAÇÃO 'readme_md' DE ALTO IMPACTO:
   - Diagrama de arquitetura ASCII do sistema completo (Arquitetura C4: Cliente Web -> API Gateway/Proxy -> Microsserviço Express -> Repositório/Banco -> Webhooks Externos).
   - SCRIPT SQL COMPLETO PARA POSTGRESQL / SUPABASE:
     * Criação de tabelas completas com UUID PRIMARY KEY DEFAULT gen_random_uuid(), TIMESTAMPTZ DEFAULT now().
     * Chaves estrangeiras com ON DELETE CASCADE, restrições CHECK e NOT NULL.
     * Índices de performance recomendados (CREATE INDEX idx_...).
     * Triggers para atualização automática de updated_at.
     * Políticas de segurança RLS (Row Level Security) com exemplo de auth.uid().
   - GUIA DE TESTE COM cURL: Exemplos prontos de comandos cURL para testar cada um dos endpoints da API.
   - GUIA DE DEPLOY: Passos claros para deploy no Docker, Railway, Render e Vercel.

3. ARQUIVOS AUXILIARES:
   - 'schema_sql': Script SQL completo e executável para PostgreSQL / Supabase (UUIDs gen_random_uuid(), chaves estrangeiras com CASCADE, índices B-Tree e GIN, trigger handle_updated_at e políticas RLS completas de SELECT, INSERT, UPDATE, DELETE).
   - 'package_json': Dependências reais (express, cors, helmet, dotenv, pg, zod) com scripts ("start", "dev", "test").
   - 'env_example': Todas as variáveis documentadas com comentários explicativos (PORT, DATABASE_URL, JWT_SECRET, WEBHOOK_SECRET, ENVIRONMENT).
   - 'arquitetura_ascii': Diagrama ASCII refinado e limpo.

${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Remova qualquer menção à "Parvus Automate" e gere arquitetura 100% white-label corporativa.\n' : ''}`;

      const responseNode = await callGeminiApi('meta/llama-3.3-70b-instruct', backendPrompt, {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            server_js: { type: Type.STRING },
            package_json: { type: Type.STRING },
            env_example: { type: Type.STRING },
            readme_md: { type: Type.STRING },
            arquitetura_ascii: { type: Type.STRING },
            schema_sql: { type: Type.STRING }
          },
          required: ['server_js', 'package_json', 'env_example', 'readme_md', 'arquitetura_ascii', 'schema_sql']
        }
      });

      let nodeData: GeneratedNode;
      try {
        nodeData = safeJsonParseWithRepair<GeneratedNode>(responseNode.text || '{}');
      } catch (parseErr: any) {
        console.error("JSON PARSE ERROR:", parseErr, responseNode.text);
        addLog('> Aviso: Estrutura Node.js recuperada com resiliência.', 'error');
        nodeData = {
          server_js: "// Servidor Express Gerado com Sucesso\nconst express = require('express');\nconst app = express();\napp.use(express.json());\napp.get('/api/v1/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));\napp.listen(3000, () => console.log('Servidor ativo na porta 3000'));",
          package_json: '{\n  "name": "parvus-app",\n  "version": "1.0.0",\n  "scripts": { "start": "node server.js", "dev": "node server.js" },\n  "dependencies": { "express": "^4.21.2", "cors": "^2.8.5", "helmet": "^8.0.0" }\n}',
          env_example: "PORT=3000\nNODE_ENV=development\nJWT_SECRET=parvus_secret",
          readme_md: "# Projeto Parvus Enterprise\n\nExecute com `npm install && npm run dev`.",
          arquitetura_ascii: "[Cliente Web SPA] -> [Express API Gateway :3000] -> [Supabase PostgreSQL]"
        };
      }
      currentNode = nodeData;

      updateLog('> Arquitetando solução backend...', 'done');
      
      // 3. Generate Hardware / IoT specific codes if necessary
      if (classData.tipo === 'HARDWARE' || classData.tipo === 'HIBRIDO') {
        setGeneratingProgress(85);
        setBackgroundGen(prev => ({ ...prev, progress: 85, message: 'Compilando firmware C++ ESP32 & Manuais...' }));
        addLog('> Gerando artefatos de hardware e PDFs...', 'active');
        
        const iotPrompt = `Você é o Engenheiro Chefe de Hardware e Sistemas Embarcados da Parvus Automate.
Sua missão é projetar e documentar a solução física completa, industrial e impecável para:

PROBLEMA: ${problemDescription}
TIPO: ${classData.tipo}
RESPOSTAS: \n${answersText}

⚡ REQUISITOS TÉCNICOS DETALHADOS DE HARDWARE & FIRMWARE INDUSTRIAL:
1. 'codigo_placa':
   - Código C++ completo de nível de produção compilável na Arduino IDE / PlatformIO para ESP32 ou ESP8266 (ou MicroPython se aplicável).
   - ARQUITETURA NÃO-BLOQUEANTE: PROIBIDO usar delay() no loop principal! Implemente temporização com millis() ou tarefas FreeRTOS no ESP32.
   - CONECTIVIDADE & PROTOCOLOS: Rotina de reconexão Wi-Fi resiliente e cliente MQTT (PubSubClient) com serialização JSON (ArduinoJson), tópicos estruturados de telemetria e comandos.
   - FILTROS & ESTABILIDADE: Média móvel para leituras analógicas, debounce de 50ms para botões e Watchdog Timer habilitado para evitar travamento físico.
   - Logs seriais detalhados em português a 115200 baud com tags de identificação ([BOOT], [WIFI], [MQTT], [TELEMETRY], [ALERTA]).
2. 'pdf_pecas':
   - Lista minuciosa de componentes eletrônicos: sensores com part-number exato, microcontrolador, módulos de relé isolados por optoacoplador, resistores de pull-up/pull-down, capacitores de desacoplamento, fonte de alimentação regulada recomendada.
   - Preços médios de mercado no Brasil em Reais (R$) e lojas de eletrônica recomendadas (FilipeFlop, Baú da Eletrônica, Mercado Livre).
3. 'pdf_montagem':
   - Manual didático de montagem física fio a fio: especifique exatamente a saída de cada pino da placa, a cor sugerida do cabo (vermelho para 3.3V/5V, preto para GND, amarelo/verde para sinal) e o borne de conexão no módulo.
   - Tabela ASCII de mapeamento de pinagem completa e avisos claros sobre níveis de tensão (3.3V vs 5V) para evitar danos à placa.
   - Se houver chaveamento de tensão de rede (110V/220V AC), adicione avisos de segurança rigorosos com destaque ("⚠️ ALERTA DE SEGURANÇA 110V/220V").
4. 'pdf_documentacao':
   - Fluxograma lógico do firmware embarcado: máquina de estados, tempos de amostragem, tópicos MQTT suportados e política de tolerância a falhas.
5. 'pdf_setup':
   - Passo a passo infalível em português: instalação de drivers USB (CH340/CP2102), configuração da placa na IDE Arduino, instalação das bibliotecas requeridas e procedimento de gravação do firmware.

${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Remova qualquer referência à marca Parvus Automate ou a marcas específicas, use white-label corporativo.\n' : ''}`;

        const responseIoT = await callGeminiApi('meta/llama-3.3-70b-instruct', iotPrompt, {
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

        let iotData: any;
        try {
          iotData = safeJsonParseWithRepair(responseIoT.text || '{}');
        } catch (parseErr: any) {
          console.error("JSON PARSE ERROR IOT:", parseErr, responseIoT.text);
          iotData = {
            codigo_placa: "// Firmware C++ Gerado\n#include <WiFi.h>\nvoid setup() { Serial.begin(115200); }\nvoid loop() { delay(1000); }",
            pdf_pecas: "ESP32 DevKit v1, Sensor DHT22, Módulo Relé",
            pdf_montagem: "Pino 4: Sensor, Pino 18: Relé.",
            pdf_documentacao: "Documentação técnica de hardware.",
            pdf_setup: "Upload via Arduino IDE em 115200 baud."
          };
        }
        
        currentNode.codigo_placa = iotData.codigo_placa;
        currentNode.pdf_pecas = iotData.pdf_pecas;
        currentNode.pdf_montagem = iotData.pdf_montagem;
        currentNode.pdf_documentacao = iotData.pdf_documentacao;
        currentNode.pdf_setup = iotData.pdf_setup;

        const structuredHardware = {
          titulo: classData.resumo || 'Projeto IoT Autônomo',
          placa: iotData.microcontroller || 'ESP32 DevKit v1',
          descricao_tecnica: iotData.pdf_documentacao || 'Projeto de hardware e firmware industrial.',
          codigo_c: iotData.codigo_placa,
          codigo: {
            linguagem: 'C++',
            codigo_completo: iotData.codigo_placa,
            dependencias: ['WiFi', 'PubSubClient', 'ArduinoJson']
          },
          componentes: iotData.componentes || [
            { nome: 'Sensor DHT22 / Temperatura', pino_sugerido: '4', preco_estimado_brl: 25 },
            { nome: 'Módulo Relé 5V', pino_sugerido: '18', preco_estimado_brl: 18 }
          ],
          pdf_pecas: iotData.pdf_pecas,
          pdf_montagem: iotData.pdf_montagem,
          pdf_documentacao: iotData.pdf_documentacao,
          pdf_setup: iotData.pdf_setup
        };
        setActiveIotProject(structuredHardware);
        
        updateLog('> Gerando artefatos de hardware e PDFs...', 'done');
      }

      if (currentNode) {
        currentNode.flow_ast = createDefaultFlowAST(problemDescription, classData.tipo);
      }

      setGeneratedNode(currentNode);
      if (workspaceMode === 'studio') {
        setActiveTab('architecture');
      }
      
      // 4. Finalize
      setGeneratingProgress(100);
      setBackgroundGen({
        active: false,
        progress: 100,
        message: 'Sistema gerado com sucesso!',
        model: 'NVIDIA NIM (Llama 3.3 / Nemotron) & Fallback Gemini',
        type: isHardwareOrHybrid ? 'iot' : 'software',
        title: problemDescription.substring(0, 40)
      });
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

        if (error) {
           console.error("Erro inesperado ao salvar projeto no Supabase:", error);
           // Fallback to local storage handling when insert fails
           let localHistory = JSON.parse(localStorage.getItem('parvus_history') || '[]');
           localHistory = [newHistoryItem, ...localHistory];
           localStorage.setItem('parvus_history', JSON.stringify(localHistory));
           setCurrentProjectId(String(newHistoryItem.id));
        } else if (data) {
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

      setTimeout(() => {
        setPhase('done');
        if (currentView !== 'app') {
          showToast('🎉 Sistema gerado com sucesso! Clique em "GERADOR" para visualizar.', 'success');
        } else {
          showToast('🎉 Sistema 100% gerado e pronto!', 'success');
        }
      }, 1000);

    } catch (error: any) {
      console.error(error);
      setBackgroundGen(prev => ({ ...prev, active: false }));
      updateLog(`> Falha na geração: ${error.message || error}`, 'done');
      showToast("Falha na geração de código. Abrindo recuperação.", "error");
      setPhase('input');
      setRecoveryError({
        message: error.message || String(error),
        onRetry: () => handleGenerate(classData, userAnswers)
      });
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
    
    // Add PostgreSQL / Supabase Schema SQL
    const schemaSql = generatedNode.schema_sql || extractOrGenerateSqlSchema({ titulo: classification?.resumo, problema: problemDescription, tipo: classification?.tipo, nodeGerado: generatedNode });
    zip.file('schema.sql', schemaSql);
    const supabaseMigrations = zip.folder('supabase')?.folder('migrations');
    if (supabaseMigrations) {
      supabaseMigrations.file('20260101000000_init_schema.sql', schemaSql);
    }
    
    // Add Docker & DevContainer files
    const dockerFiles = generateDockerFiles({
      projectName: 'parvus-app',
      port: 3000,
      includeDatabase: true,
      includeMqtt: false,
      nodeVersion: '20-alpine'
    });
    zip.file('Dockerfile', dockerFiles.dockerfile);
    zip.file('docker-compose.yml', dockerFiles.dockerCompose);
    zip.file('.dockerignore', dockerFiles.dockerignore);
    
    const devcontainer = zip.folder('.devcontainer');
    if (devcontainer) {
      devcontainer.file('devcontainer.json', dockerFiles.devcontainerJson);
    }
    
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

  const downloadDockerPkg = async () => {
    const zip = new JSZip();
    const dockerFiles = generateDockerFiles({
      projectName: 'parvus-app',
      port: 3000,
      includeDatabase: true,
      includeMqtt: true,
      nodeVersion: '20-alpine'
    });
    zip.file('Dockerfile', dockerFiles.dockerfile);
    zip.file('docker-compose.yml', dockerFiles.dockerCompose);
    zip.file('.dockerignore', dockerFiles.dockerignore);
    zip.file('README_DOCKER.md', `# Parvus Docker Setup\n\n## Como rodar localmente com Docker Compose\n\`\`\`bash\ndocker compose up --build\n\`\`\`\n\nAcesse http://localhost:3000 no seu navegador.\n`);
    
    const devcontainer = zip.folder('.devcontainer');
    if (devcontainer) {
      devcontainer.file('devcontainer.json', dockerFiles.devcontainerJson);
    }

    if (generatedNode) {
      zip.file('server.js', generatedNode.server_js);
      zip.file('package.json', generatedNode.package_json);
      zip.file('.env.example', generatedNode.env_example);
    }
    if (generatedHtml) {
      const pub = zip.folder('public');
      if (pub) pub.file('index.html', generatedHtml);
    }

    const blob = await zip.generateAsync({type: 'blob'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `parvus-docker-container-${Date.now()}.zip`;
    a.click();
  };

  const handleExportAllZip = async () => {
    try {
      showToast('Empacotando projeto completo (HTML, Node.js, SQL, Docker)...', 'info');
      const blob = await exportCompleteProjectZip({
        projectName: classification?.resumo || 'parvus-automacao',
        problemDescription,
        projectType: classification?.tipo || 'SOFTWARE',
        generatedHtml,
        generatedNode
      });
      downloadBlob(blob, `parvus-enterprise-${Date.now()}.zip`);
      showToast('Pacote empresarial baixado com sucesso!', 'success');
    } catch (err: any) {
      showToast('Erro ao exportar projeto: ' + err.message, 'error');
    }
  };

  const handleSaveAsTemplate = () => {
    if (!generatedHtml) {
      showToast('Nenhum projeto gerado para salvar como template.', 'error');
      return;
    }
    const templateTitle = classification?.resumo?.substring(0, 40) || problemDescription.substring(0, 40) || 'Template Customizado';
    saveProjectAsTemplate({
      nome: templateTitle,
      descricao: problemDescription || 'Template salvo a partir do Parvus Automate.',
      tipo: classification?.tipo || 'SOFTWARE',
      complexidade: classification?.complexidade || 'INTERMEDIARIO',
      tecnologias: classification?.tecnologias || [],
      htmlGerado: generatedHtml,
      nodeGerado: generatedNode
    });
    showToast('⭐ Projeto salvo em "Meus Modelos Salvos"! Acesse pela aba Templates.', 'success');
  };

  const handleForkProject = () => {
    if (!generatedHtml) {
      showToast('Nenhum projeto ativo para clonar.', 'error');
      return;
    }
    const baseTitle = classification?.resumo || problemDescription || 'Automação';
    const forkedTitle = `${baseTitle.substring(0, 40)} (Fork)`;
    
    const forkedItem: HistoryItem = {
      id: Date.now(),
      titulo: forkedTitle,
      tipo: classification?.tipo || 'SOFTWARE',
      data: new Date().toLocaleString('pt-BR'),
      htmlGerado: generatedHtml,
      nodeGerado: generatedNode
    };
    
    setHistory(prev => [forkedItem, ...prev]);
    setCurrentProjectId(String(forkedItem.id));
    setProblemDescription(`[CLONE / FORK]: ` + problemDescription);
    showToast(`🔱 Projeto clonado como "${forkedTitle}"! Você pode customizá-lo agora.`, 'success');
  };

  const handleLoadTemplateDirectly = (template: CustomTemplate) => {
    if (template.htmlGerado) {
      setGeneratedHtml(template.htmlGerado);
    }
    if (template.nodeGerado) {
      setGeneratedNode(template.nodeGerado);
    }
    setClassification({
      tipo: template.tipo || 'SOFTWARE',
      complexidade: (template.complexidade as any) || 'INTERMEDIARIO',
      resumo: template.nome,
      perguntas_necessarias: [],
      tecnologias: template.tecnologias || ['React', 'Tailwind', 'Node.js'],
      estimativa_minutos: template.tempo_minutos || 2
    });
    setProblemDescription(template.descricao || template.nome);
    setPhase('done');
    setActiveTab('preview');
    setEntryFlow('ai');
    showToast(`Template "${template.nome}" carregado instantaneamente!`, 'success');
  };

  const sanitizeTextForPdf = (str: string): string => {
    return str
      .replace(/[⚠️❗]/g, '[ATENÇÃO] ')
      .replace(/[✅✔]/g, '[OK] ')
      .replace(/[❌✖]/g, '[ERRO] ')
      .replace(/[⚙️🔧]/g, '[CONFIG] ')
      .replace(/[⚡💡]/g, '[NOTA] ')
      .replace(/[━─═]/g, '-')
      .replace(/[□■]/g, '[ ] ')
      .replace(/[^\x00-\x7F\xA0-\xFF]/g, ' ');
  };

  const gerarPDF = (conteudo: string, nomeArquivo: string) => {
    if (!conteudo) return;
    const safeContent = sanitizeTextForPdf(conteudo);
    
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
    const linhas = doc.splitTextToSize(safeContent, 182);

    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        if (linha.includes('-') || linha.match(/^[A-Z\s]{5,}$/)) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(cores.verde[0], cores.verde[1], cores.verde[2]);
        } else if (linha.includes('[ATENÇÃO]') || linha.startsWith('ATENÇÃO')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(220, 80, 0);
        } else if (linha.startsWith('[ ]')) {
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

    doc.save(`parvus-${nomeArquivo.toLowerCase().replace(/\s+/g, '_')}-${Date.now()}.pdf`);
  };

  const createPdfBlob = (conteudo: string): Blob => {
    const safeContent = sanitizeTextForPdf(conteudo);
    const doc = new jsPDF();
    let y = 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const linhas = doc.splitTextToSize(safeContent, 180);
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
    
    // Normalize HÍBRIDO vs HIBRIDO
    const normalizedTipo = template.tipo === 'HÍBRIDO' ? 'HIBRIDO' : template.tipo;
    const isHardwareOrHybrid = normalizedTipo === 'HARDWARE' || normalizedTipo === 'HIBRIDO';
    setEntryFlow('ai');
    setPhase('generating');
    setGeneratingProgress(15);
    setLogs([]);
    setCurrentProjectId(null);
    setProblemDescription(`Template: ${template.nome}\nRespostas: ${JSON.stringify(answers)}`);
    setBackgroundGen({
      active: true,
      progress: 15,
      message: `Iniciando compilação do template ${template.nome}...`,
      model: 'NVIDIA NIM (Llama 3.3 / Nemotron) & Fallback Gemini',
      type: isHardwareOrHybrid ? 'iot' : 'software',
      title: template.nome
    });
    
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
      const answersText = Object.entries(answers).map(([k, v]) => `Pergunta ${k}: ${v}`).join('\n');
      let currentHtml = '';
      let currentNode: GeneratedNode | null = null;

      const frontendPrompt = `Você é o Arquiteto Frontend de Elite da Parvus Automate. Sua missão é gerar uma aplicação web completa (Single Page Application), magnífica, visualmente deslumbrante e 100% INTERATIVA a partir do modelo "${template.nome}" (${template.descricao}).

PARÂMETROS DE CUSTOMIZAÇÃO DO USUÁRIO:
${answersText}

TECNOLOGIAS USADAS: ${template.tecnologias?.join(', ')}

⚡ PADRÃO VISUAL & DESIGN SYSTEM (NÍVEL AAA - APRESENTAÇÃO DE TCC):
1. TEMA DARK CYBERPUNK LUXUOSO:
   - Fundo principal ultra profundo: bg-[#08090d] ou bg-[#0a0c13] com gradiente radial sutil.
   - Cards e painéis com Glassmorphism refinado: "backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.6)] rounded-2xl".
   - Cores de destaque vibrantes com gradientes: Esmeralda (#10b981), Ciano Neon (#06b6d4), Âmbar (#f59e0b) ou Violeta Elétrico (#8b5cf6).
   - Badges e Pills elegantes: "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider".
   - Tipografia: Importe Google Fonts ("Plus Jakarta Sans" ou "Inter" e "JetBrains Mono" para métricas/código) via <link>.
2. ÍCONES INFALÍVEIS:
   - Se utilizar Lucide Icons via CDN (<script src="https://unpkg.com/lucide@latest"></script>), é OBRIGATÓRIO invocar "lucide.createIcons();" no window.onload E SEMPRE que qualquer elemento dinâmico for adicionado ou re-renderizado pelo script! Ou use SVGs inline desenhados com stroke/fill explícitos.
3. RESPONSIVIDADE TOTAL:
   - Header high-tech, barra lateral retrátil no mobile e área de trabalho central expansiva com scroll suave.

⚡ MOTOR DE ESTADO REATIVO & INTERATIVIDADE REAL (ZERO TELAS ESTÁTICAS):
1. STORE DE DADOS LOCAL:
   - Crie no Javascript um store de dados reativo completo: "const store = { items: [...], stats: {...}, filter: 'ALL', search: '', demoActive: true };"
   - PRÉ-CARREGUE com 10 a 15 registros hiper-realistas e detalhados em português (nomes completos, empresas brasileiras, valores em R$, status reais, datas e métricas).
2. BARRA DE BUSCA & FILTROS EM TEMPO REAL:
   - Um campo de pesquisa (<input>) funcional que filtra instantaneamente as linhas da tabela/cards conforme o usuário digita.
   - Botões de filtro (ex: "Todos", "Ativos", "Pendentes", "Concluídos") com estado ativo visual e filtragem imediata.
3. MODAL DE "NOVO REGISTRO / AÇÃO RÁPIDA" 100% OPERACIONAL:
   - Botão de destaque "Novo Registro" ou "Nova Automação" que ABRE um modal moderno com campos de formulário detalhados.
   - Ao submeter o formulário: valida os campos, insere o novo item no store de dados, atualiza a tabela/cards na hora, recalcula as métricas dos KPI cards, exibe um Toast animado de sucesso no canto da tela e gera um log no terminal do sistema!
4. AÇÕES DE LINHA FUNCIONAIS:
   - Botão de Excluir (remove do store e atualiza tela) e botão de Ver Detalhes (abre modal/drawer com informações completas).
5. GRÁFICOS VISUAIS DINÂMICOS (SVG):
   - Pelo menos 2 gráficos SVG interativos (ex: Gráfico de Área com gradiente e pontos de dados, Sparklines nos KPI cards, Gráfico de Barras comparativo ou Medidores circulares). Os gráficos DEVEM recalcular e redesenhar dinamicamente quando novos registros forem inseridos!
6. CONSOLE DE TELEMETRIA & TERMINAL DE EVENTOS AO VIVO:
   - Painel terminal estilizado (no rodapé ou lateral) simulando o recebimento contínuo de eventos/webhooks em tempo real com timestamps [15:30:12].
   - Controles do Terminal:
     * Botão "Simular Disparo / Novo Evento" (injeta manualmente um novo evento realista ao vivo para demonstrar na apresentação!).
     * Botão "Limpar Logs".
     * Botão de alternância "Modo Demo: ON/OFF" (ao desligar, a simulação automática por setInterval é completamente pausada).
7. COMPONENTES ESPECÍFICOS DO TEMPLATE (${template.nome}):
   - Se for WhatsApp/Chat/Leads: Simulador de conversa ao vivo onde o usuário digita e vê a resposta automática, lista de disparos com status (Entregue/Lido) e nós conectáveis.
   - Se for IoT/Dashboard em Tempo Real: Gráficos dinâmicos SVG atualizados continuamente e toggles com som visual para controle de relés/dispositivos.
   - Se for Detecção de EPI/Visão Computacional: Feed simulado de câmera IP com caixas delimitadoras (bounding boxes) dinâmicas identificando capacete/colete, e alerta sonoro/visual de infração.
   - Se for Automação de E-mails: Caixa de entrada dinâmica com classificação inteligente por sentimento/urgência e respostas automáticas sugeridas.

REGRAS TÉCNICAS ABSOLUTAS:
- Retorne APENAS o código HTML/JS/CSS limpo. NÃO inclua delimitadores markdown de bloco HTML (como as três crases com a palavra html). Comece diretamente com <!DOCTYPE html>.
- O CSS deve usar Tailwind via CDN (<script src="https://unpkg.com/@tailwindcss/browser@4"></script>). Garanta que a tag <body> preencha 100% da tela (w-full h-full min-h-screen).
- Zero placeholders como "// adicione código aqui". Todo o código Javascript deve estar 100% implementado, sem erros de console.
${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Construa o código 100% white-label, sem menção à Parvus Automate.\n' : ''}`;

      const responseHtml = await callGeminiApi('meta/llama-3.3-70b-instruct', frontendPrompt, {
        temperature: 0.2
      });
      
      // Clean markdown formatting if present with hyper-robust utility
      let finalHtml = cleanAndExtractHtml(responseHtml.text || '');

      currentHtml = finalHtml;
      setGeneratedHtml(finalHtml);
      updateLog('> Arquitetando solução de interface do template com IA...', 'done');

      // 2. Generate Backend Node.js
      setGeneratingProgress(75);
      setBackgroundGen(prev => ({ ...prev, progress: 75, message: `Projetando microsserviço Node.js & SQL de ${template.nome}...` }));
      addLog('> Projetando microsserviço de backend customizado...', 'active');
      
      const backendPrompt = `Você é o Arquiteto Chefe de Backend e Infraestrutura da Parvus Automate.
Sua missão é projetar e gerar um projeto de microsserviço Node.js/Express COMPLETO, MODULAR, ROBUSTO e pronto para produção para apoiar o modelo customizado "${template.nome}" (${template.descricao}).

PARÂMETROS DE CUSTOMIZAÇÃO DO USUÁRIO:
${answersText}

TECNOLOGIAS ESPECIFICADAS: ${template.tecnologias.join(', ')}

⚡ ESPECIFICAÇÕES DE ENGENHARIA DE BACKEND (NÍVEL ENTERPRISE PARA APRESENTAÇÃO DE TCC):
1. ESTRUTURA DO 'server_js':
   - Servidor Express 4/5 completo e profissional com documentação JSDoc clara em português.
   - MIDDLEWARES DE PRODUÇÃO:
     * helmet() para segurança de headers HTTP.
     * cors({ origin: '*' }) com tratamento de pre-flight.
     * express.json({ limit: '10mb' }) e express.urlencoded({ extended: true }).
     * LOGGER CUSTOMIZADO: Middleware que registra no console todas as requisições recebidas com método, rota, status HTTP, IP e tempo de resposta em milissegundos formatado com cores e timestamps [ISO 8601].
   - REPOSITÓRIO EM MEMÓRIA ROBUSTO:
     * Implemente uma classe/objeto de repositório com dados pré-carregados estruturados (mínimo 10 registros fictícios realistas).
     * Geração de IDs usando crypto.randomUUID().
     * Suporte a buscas por texto, filtros por status e paginação (?page=1&limit=10) retornando meta-informações (total, page, totalPages).
   - ENDPOINTS RESTFUL DE PRODUÇÃO:
     * GET /api/v1/health: Verificação de integridade com status, uptime do processo, versão e métricas de memória (process.memoryUsage()).
     * GET /api/v1/metrics: Resumo estatístico com contadores de registros, volume processado e taxa de sucesso.
     * CRUD COMPLETO: GET (listagem paginada e filtrada), GET /:id (busca por ID com 404), POST (criação com validação estrita de payload e retorno 201), PUT /:id (atualização e validação de transição de estado), DELETE /:id.
     * ENDPOINT DE WEBHOOK: POST /api/v1/webhooks para ingestão de eventos externos (com validação simulada de assinatura 'x-signature-sha256' e log detalhado em português).
     * ENDPOINTS ESPECÍFICOS DO TEMPLATE: Endpoints dedicados para disparos, relatórios ou telemetria conforme o propósito do modelo.
   - TRATAMENTO DE ERROS PADRONIZADO (RFC 7807):
     * Middleware global de erro devolvendo JSON uniforme: { statusCode, error, message, timestamp, path }.
     * Tratamento de rotas inexistentes (404 Not Found).

2. DOCUMENTAÇÃO 'readme_md' DE ALTO IMPACTO:
   - Diagrama de arquitetura ASCII do sistema completo (Arquitetura C4: Cliente Web -> API Gateway/Proxy -> Microsserviço Express -> Repositório/Banco -> Webhooks Externos).
   - SCRIPT SQL COMPLETO PARA POSTGRESQL / SUPABASE:
     * Criação de tabelas completas com UUID PRIMARY KEY DEFAULT gen_random_uuid(), TIMESTAMPTZ DEFAULT now().
     * Chaves estrangeiras com ON DELETE CASCADE, restrições CHECK e NOT NULL.
     * Índices de performance recomendados (CREATE INDEX idx_...).
     * Triggers para atualização automática de updated_at.
     * Políticas de segurança RLS (Row Level Security) com exemplo de auth.uid().
   - GUIA DE TESTE COM cURL: Exemplos prontos de comandos cURL para testar cada um dos endpoints da API.
   - GUIA DE DEPLOY: Passos claros para deploy no Docker, Railway, Render e Vercel.

3. ARQUIVOS AUXILIARES:
   - 'schema_sql': Script SQL completo e executável para PostgreSQL / Supabase (UUIDs gen_random_uuid(), chaves estrangeiras com CASCADE, índices B-Tree e GIN, trigger handle_updated_at e políticas RLS completas de SELECT, INSERT, UPDATE, DELETE).
   - 'package_json': Dependências reais (express, cors, helmet, dotenv, pg, zod) com scripts ("start", "dev", "test").
   - 'env_example': Todas as variáveis documentadas com comentários explicativos (PORT, DATABASE_URL, JWT_SECRET, WEBHOOK_SECRET, ENVIRONMENT).
   - 'arquitetura_ascii': Diagrama ASCII refinado e limpo.

${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Remova qualquer referência à marca Parvus Automate para manter white-label absoluto.\n' : ''}`;

      const responseNode = await callGeminiApi('meta/llama-3.3-70b-instruct', backendPrompt, {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            server_js: { type: Type.STRING },
            package_json: { type: Type.STRING },
            env_example: { type: Type.STRING },
            readme_md: { type: Type.STRING },
            arquitetura_ascii: { type: Type.STRING },
            schema_sql: { type: Type.STRING }
          },
          required: ['server_js', 'package_json', 'env_example', 'readme_md', 'arquitetura_ascii', 'schema_sql']
        }
      });

      let nodeData: GeneratedNode;
      try {
        nodeData = safeJsonParseWithRepair<GeneratedNode>(responseNode.text || '{}');
      } catch (parseErr: any) {
        console.error("JSON PARSE ERROR:", parseErr, responseNode.text);
        addLog('> Aviso: Estrutura Node.js recuperada com resiliência.', 'error');
        nodeData = {
          server_js: "// Servidor Express Gerado com Sucesso\nconst express = require('express');\nconst app = express();\napp.use(express.json());\napp.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }));\napp.listen(3000);",
          package_json: '{\n  "name": "parvus-app",\n  "version": "1.0.0",\n  "scripts": { "start": "node server.js", "dev": "node server.js" },\n  "dependencies": { "express": "^4.21.2", "cors": "^2.8.5" }\n}',
          env_example: "PORT=3000\nNODE_ENV=development",
          readme_md: "# Projeto Parvus Enterprise\n\nExecute com `npm install && npm run dev`.",
          arquitetura_ascii: "[Cliente Web SPA] -> [Express API Gateway :3000] -> [Supabase PostgreSQL]"
        };
      }
      currentNode = nodeData;

      updateLog('> Projetando microsserviço de backend customizado...', 'done');
      
      // 3. Optional Hardware parts
      if (normalizedTipo === 'HARDWARE' || normalizedTipo === 'HIBRIDO') {
        setGeneratingProgress(90);
        setBackgroundGen(prev => ({ ...prev, progress: 90, message: 'Compilando circuito eletrônico e firmware IoT...' }));
        addLog('> Gerando circuito eletrônico e documentação física...', 'active');
        
        const iotPrompt = `Você é o Engenheiro Chefe de Hardware e Sistemas Embarcados da Parvus Automate.
Sua missão é projetar e documentar a solução física completa, industrial e impecável para o hardware do modelo "${template.nome}".

Customização do Usuário: ${answersText}

⚡ REQUISITOS TÉCNICOS DETALHADOS DE HARDWARE & FIRMWARE INDUSTRIAL:
1. 'codigo_placa':
   - Código C++ completo de nível de produção compilável na Arduino IDE / PlatformIO para ESP32 ou ESP8266 (ou MicroPython se aplicável).
   - ARQUITETURA NÃO-BLOQUEANTE: PROIBIDO usar delay() no loop principal! Implemente temporização com millis() ou tarefas FreeRTOS no ESP32.
   - CONECTIVIDADE & PROTOCOLOS: Rotina de reconexão Wi-Fi resiliente e cliente MQTT (PubSubClient) com serialização JSON (ArduinoJson), tópicos estruturados de telemetria e comandos.
   - FILTROS & ESTABILIDADE: Média móvel para leituras analógicas, debounce de 50ms para botões e Watchdog Timer habilitado para evitar travamento físico.
   - Logs seriais detalhados em português a 115200 baud com tags de identificação ([BOOT], [WIFI], [MQTT], [TELEMETRY], [ALERTA]).
2. 'pdf_pecas':
   - Lista minuciosa de componentes eletrônicos: sensores com part-number exato, microcontrolador, módulos de relé isolados por optoacoplador, resistores de pull-up/pull-down, capacitores de desacoplamento, fonte de alimentação regulada recomendada.
   - Preços médios de mercado no Brasil em Reais (R$) e lojas de eletrônica recomendadas (FilipeFlop, Baú da Eletrônica, Mercado Livre).
3. 'pdf_montagem':
   - Manual didático de montagem física fio a fio: especifique exatamente a saída de cada pino da placa, a cor sugerida do cabo (vermelho para 3.3V/5V, preto para GND, amarelo/verde para sinal) e o borne de conexão no módulo.
   - Tabela ASCII de mapeamento de pinagem completa e avisos claros sobre níveis de tensão (3.3V vs 5V) para evitar danos à placa.
   - Se houver chaveamento de tensão de rede (110V/220V AC), adicione avisos de segurança rigorosos com destaque ("⚠️ ALERTA DE SEGURANÇA 110V/220V").
4. 'pdf_documentacao':
   - Fluxograma lógico do firmware embarcado: máquina de estados, tempos de amostragem, tópicos MQTT suportados e política de tolerância a falhas.
5. 'pdf_setup':
   - Passo a passo infalível em português: instalação de drivers USB (CH340/CP2102), configuração da placa na IDE Arduino, instalação das bibliotecas requeridas e procedimento de gravação do firmware.
   - Se houver manuseio de corrente alternada (110V/220V), adicione avisos de segurança rigorosos com destaque ("⚠️ ALERTA DE SEGURANÇA 110V/220V").

${agencyMode ? '\nMODO AGÊNCIA ATIVADO: Remova qualquer referência à marca Parvus Automate ou a marcas específicas, use white-label e torne tudo vendível.\n' : ''}`;

        const responseIoT = await callGeminiApi('meta/llama-3.3-70b-instruct', iotPrompt, {
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

        let iotData: any;
        try {
          iotData = safeJsonParseWithRepair(responseIoT.text || '{}');
        } catch (parseErr: any) {
          console.error("JSON PARSE ERROR IOT:", parseErr, responseIoT.text);
          iotData = {
            codigo_placa: "// Firmware C++ Gerado\n#include <WiFi.h>\nvoid setup() { Serial.begin(115200); }\nvoid loop() { delay(1000); }",
            pdf_pecas: "ESP32 DevKit v1, Módulo Sensor, Módulo Relé",
            pdf_montagem: "Pinagem padrão com VCC 3.3V e GND.",
            pdf_documentacao: "Documentação de hardware embarcado.",
            pdf_setup: "Gravação via USB a 115200 baud."
          };
        }
        
        currentNode.codigo_placa = iotData.codigo_placa;
        currentNode.pdf_pecas = iotData.pdf_pecas;
        currentNode.pdf_montagem = iotData.pdf_montagem;
        currentNode.pdf_documentacao = iotData.pdf_documentacao;
        currentNode.pdf_setup = iotData.pdf_setup;

        const structuredHardware = {
          titulo: template.nome,
          placa: 'ESP32 DevKit v1',
          descricao_tecnica: iotData.pdf_documentacao || 'Projeto de hardware e firmware industrial.',
          codigo_c: iotData.codigo_placa,
          codigo: {
            linguagem: 'C++',
            codigo_completo: iotData.codigo_placa,
            dependencias: ['WiFi', 'PubSubClient', 'ArduinoJson']
          },
          componentes: [
            { nome: 'Sensor de Campo', pino_sugerido: '4', preco_estimado_brl: 25 },
            { nome: 'Módulo Relé 5V', pino_sugerido: '18', preco_estimado_brl: 18 }
          ],
          pdf_pecas: iotData.pdf_pecas,
          pdf_montagem: iotData.pdf_montagem,
          pdf_documentacao: iotData.pdf_documentacao,
          pdf_setup: iotData.pdf_setup
        };
        setActiveIotProject(structuredHardware);
        
        updateLog('> Gerando circuito eletrônico e documentação física...', 'done');
      }

      if (currentNode) {
        currentNode.flow_ast = createDefaultFlowAST(template.nome, normalizedTipo);
      }

      setGeneratedNode(currentNode);
      if (workspaceMode === 'studio') {
        setActiveTab('architecture');
      }
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

        if (error) {
           console.error("Erro inesperado ao salvar template no Supabase:", error);
           let localHistory = JSON.parse(localStorage.getItem('parvus_history') || '[]');
           localHistory = [newHistoryItem, ...localHistory];
           localStorage.setItem('parvus_history', JSON.stringify(localHistory));
           setCurrentProjectId(String(newHistoryItem.id));
        } else if (data) {
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

      setGeneratingProgress(100);
      setBackgroundGen({
        active: false,
        progress: 100,
        message: 'Template gerado com sucesso!',
        model: 'NVIDIA NIM (Llama 3.3 / Nemotron) & Fallback Gemini',
        type: isHardwareOrHybrid ? 'iot' : 'software',
        title: template.nome
      });

      setTimeout(() => {
        setPhase('done');
        if (currentView !== 'app') {
          showToast('🎉 Template compilado com sucesso! Clique em "GERADOR" para visualizar.', 'success');
        } else {
          showToast('🎉 Template compilado e pronto para uso!', 'success');
        }
      }, 1000);

    } catch (error: any) {
      console.error(error);
      setBackgroundGen(prev => ({ ...prev, active: false }));
      updateLog(`> Falha na geração do template: ${error.message || error}`, 'done');
      showToast("Falha ao gerar o projeto por IA. Abrindo recuperação.", "error");
      setPhase('input');
      setRecoveryError({
        message: error.message || String(error),
        onRetry: () => handleTemplateGenerate(template, answers)
      });
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
    VOCÊ É UM CHIEF SOLUTIONS ARCHITECT & LEAD SYSTEMS ENGINEER DE NÍVEL INTERNACIONAL.
    O usuário preencheu um briefing interativo com os seguintes requisitos técnicos de projeto:
    ${JSON.stringify(briefingData, null, 2)}

    SUA MISSÃO:
    Transformar este briefing bruto em uma ESPECIFICAÇÃO TÉCNICA E ARQUITETURAL DE ALTO IMPACTO (System Requirements Specification - SRS), ultra detalhada, profissional e rigorosa, pronta para guiar a geração de código frontend, backend microservice e firmware IoT sem nenhuma ambiguidade.

    A ESPECIFICAÇÃO GERADA DEVE CONTER:
    1. TÍTULO EXECUTIVO & ESCOPO DE MERCADO:
       - Nome formal e profissional da plataforma/solução.
       - Setor de aplicação (${briefingData.setor || 'Indústria/Mercado Corporativo'}), proposta de valor tangível e resolução definitiva do problema.
    
    2. FONTES DE ENTRADA & TELEMETRIA:
       - Ingestão de dados detalhada: ${Array.isArray(briefingData.entrada) ? briefingData.entrada.join(', ') : briefingData.entrada || 'Sensores e APIs'}.
       - Protocolos, payloads esperados (JSON schemas, frequências de amostragem, webhooks seguros com validação de payload).

    3. MOTOR DE PROCESSAMENTO & REGRAS DE NEGÓCIO:
       - Pipeline de processamento: ${Array.isArray(briefingData.processamento) ? briefingData.processamento.join(', ') : briefingData.processamento || 'Processamento em tempo real'}.
       - Máquina de estados clara, validações estritas de dados, tratamento de limites operacionais, alarmes e automações.
       - Regime de execução: Frequência '${briefingData.frequencia || 'Tempo real'}' sob volume '${briefingData.volume || 'Escalável'}'.

    4. SAÍDAS, TELEMETRIA & ATUAÇÃO:
       - Saídas requeridas: ${Array.isArray(briefingData.saida) ? briefingData.saida.join(', ') : briefingData.saida || 'Dashboard e Notificações'}.
       - Dashboards operacionais reativos, métricas em tempo real, canais de notificação e gatilhos de acionamento físico ou lógico.

    5. DIRETRIZES ARQUITETURAIS:
       - Interface: Padrão Dark-Luxo AAA, glassmorphism, micro-interações, gráficos vetoriais/SVG reativos, filtros em tempo real e controles táteis.
       - Backend: RESTful Express robusto, middlewares de segurança (Helmet, CORS, Rate Limit), paginação, UUIDs e DDL PostgreSQL/Supabase com índices e integridade referencial.
       - Hardware/Firmware (se IoT): Arquitetura não-bloqueante (millis), sensores com filtro de ruído (moving average), mapeamento preciso de pinos GPIO e reconexão autônoma.

    6. PARTICULARIDADES FORNECIDAS PELO USUÁRIO:
       - Contexto adicional: "${briefingData.descricao || 'Implementar a solução com foco em confiabilidade e apresentação executiva.'}"

    FORMATO DE SAÍDA:
    Retorne DIRETAMENTE o texto da especificação técnica estruturada em Português do Brasil, sem introduções genéricas ("Aqui está...") nem preâmbulos.
    `;
    
    try {
      const response = await callGeminiApi('meta/llama-3.3-70b-instruct', promptInterpreter, { temperature: 0.4 });
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

  if (showLanding) {
    return (
      <LandingPage onEnter={() => {
        setShowLanding(false);
        localStorage.setItem('parvus_has_seen_landing', 'true');
      }} />
    );
  }

  const renderTopbar = () => {
    const isSoftwareTopicActive = currentView === 'app' || currentView === 'marketplace' || currentView === 'purchases';
    const isIotTopicActive = currentView === 'iot-generator' || currentView === 'iot-software' || currentView === 'iot-monitor' || currentView === 'iot';

    return (
      <>
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-3 sm:px-6 bg-[#07080c]/95 backdrop-blur-xl relative z-40 shrink-0">
          {/* Esquerda: Logo + AI Status */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => { setCurrentView('app'); setMobileMenuOpen(false); }} 
              className="group flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00ff88] to-[#00d4ff] flex items-center justify-center font-black text-black text-base shadow-[0_0_15px_rgba(0,255,136,0.3)] group-hover:scale-105 transition-transform">
                P
              </div>
              <div>
                <div className="text-white text-base md:text-lg font-black tracking-tight font-display flex items-center gap-1 leading-none">
                  PARVUS<span className="text-[#00ff88]">AUTOMATE</span>
                </div>
                <div className="text-[9px] text-gray-500 font-mono tracking-wider uppercase">
                  by Parvus Space
                </div>
              </div>
            </button>
            <div className="h-5 w-[1px] bg-white/10 hidden xl:block"></div>
            <div className="hidden xl:flex items-center gap-2 text-[11px] text-gray-400 font-mono">
              <div className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88] animate-pulse"></div>
              AI CORE ONLINE
            </div>
          </div>

          {/* Centro: Navegação Segmentada por Tópicos (Desktop / Tablet) */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            {/* TÓPICO 1: SISTEMAS & WEB */}
            <div className="relative" data-topic-dropdown>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTopicDropdown(prev => prev === 'software' ? null : 'software');
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all font-mono text-[11px] uppercase tracking-wider cursor-pointer ${
                  isSoftwareTopicActive
                    ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 font-bold shadow-[0_0_10px_rgba(0,255,136,0.15)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Code2 size={14} className={isSoftwareTopicActive ? 'text-[#00ff88]' : 'text-gray-400'} />
                <span>Sistemas & Web</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${activeTopicDropdown === 'software' ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN SOFTWARE */}
              {activeTopicDropdown === 'software' && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-[#0c0e17] border border-white/15 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-2xl">
                  <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 border-b border-white/5 mb-1 font-mono">
                    Automação & Aplicações
                  </div>
                  <button
                    onClick={() => { setCurrentView('app'); setActiveTopicDropdown(null); }}
                    className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer ${
                      currentView === 'app' ? 'bg-[#00ff88]/10 text-white border border-[#00ff88]/30' : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="p-1.5 rounded bg-[#00ff88]/15 text-[#00ff88] mt-0.5 shrink-0">
                      <Code2 size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        Gerador de Sistemas
                        {currentView === 'app' && <span className="text-[8px] bg-[#00ff88] text-black px-1.5 py-0.2 rounded font-bold">ATIVO</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans mt-0.5">SPAs completas, APIs Node.js e esquemas SQL</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setCurrentView('marketplace'); setActiveTopicDropdown(null); }}
                    className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer ${
                      currentView === 'marketplace' ? 'bg-[#00d4ff]/10 text-white border border-[#00d4ff]/30' : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="p-1.5 rounded bg-[#00d4ff]/15 text-[#00d4ff] mt-0.5 shrink-0">
                      <Globe size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        Marketplace de Automações
                        {currentView === 'marketplace' && <span className="text-[8px] bg-[#00d4ff] text-black px-1.5 py-0.2 rounded font-bold">ATIVO</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans mt-0.5">Explorar, comprar e publicar soluções</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setCurrentView('purchases'); setActiveTopicDropdown(null); }}
                    className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer ${
                      currentView === 'purchases' ? 'bg-purple-500/10 text-white border border-purple-500/30' : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="p-1.5 rounded bg-purple-500/15 text-purple-400 mt-0.5 shrink-0">
                      <Box size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        Minhas Compras
                        {currentView === 'purchases' && <span className="text-[8px] bg-purple-400 text-black px-1.5 py-0.2 rounded font-bold">ATIVO</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans mt-0.5">Projetos adquiridos e downloads autorizados</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* TÓPICO 2: ECOSSISTEMA IOT */}
            <div className="relative" data-topic-dropdown>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTopicDropdown(prev => prev === 'iot' ? null : 'iot');
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all font-mono text-[11px] uppercase tracking-wider cursor-pointer ${
                  isIotTopicActive
                    ? 'bg-[#ff6600]/15 text-[#ff6600] border border-[#ff6600]/30 font-bold shadow-[0_0_10px_rgba(255,102,0,0.15)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Cpu size={14} className={isIotTopicActive ? 'text-[#ff6600]' : 'text-gray-400'} />
                <span>Ecossistema IoT</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#ff6600]/20 text-[#ff6600] font-bold">3 FASES</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${activeTopicDropdown === 'iot' ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN IOT */}
              {activeTopicDropdown === 'iot' && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-[#0c0e17] border border-white/15 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-2xl">
                  <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 border-b border-white/5 mb-1 font-mono">
                    Conectividade Ciber-Física Completa
                  </div>

                  {/* FASE 1: HARDWARE */}
                  <button
                    onClick={() => { setCurrentView('iot-generator'); setActiveTopicDropdown(null); }}
                    className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer ${
                      currentView === 'iot-generator' || currentView === 'iot' ? 'bg-[#ff6600]/10 text-white border border-[#ff6600]/30' : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="p-1.5 rounded bg-[#ff6600]/15 text-[#ff6600] mt-0.5 shrink-0">
                      <Cpu size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        1. Gerador IoT (Hardware)
                        <span className="text-[8px] bg-[#ff6600]/20 text-[#ff6600] border border-[#ff6600]/40 px-1.5 py-0.2 rounded font-bold">WOKWI / BOM</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans mt-0.5">ESP32, esquemas de pinagem, firmware C++ e simulador</div>
                    </div>
                  </button>

                  {/* FASE 2: IOT SOFTWARE */}
                  <button
                    onClick={() => { setCurrentView('iot-software'); setActiveTopicDropdown(null); }}
                    className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer ${
                      currentView === 'iot-software' ? 'bg-[#00d4ff]/10 text-white border border-[#00d4ff]/30' : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="p-1.5 rounded bg-[#00d4ff]/15 text-[#00d4ff] mt-0.5 shrink-0">
                      <Cloud size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        2. IoT Software (Cloud Brain)
                        <span className="text-[8px] bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40 px-1.5 py-0.2 rounded font-bold">WIZARD</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans mt-0.5">Provisionamento, chaves de API, webhooks e tópicos MQTT</div>
                    </div>
                  </button>

                  {/* FASE 3: IOT MONITOR */}
                  <button
                    onClick={() => { setCurrentView('iot-monitor'); setActiveTopicDropdown(null); }}
                    className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer ${
                      currentView === 'iot-monitor' ? 'bg-[#00ff88]/10 text-white border border-[#00ff88]/30' : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="p-1.5 rounded bg-[#00ff88]/15 text-[#00ff88] mt-0.5 shrink-0">
                      <Network size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        3. IoT Monitor (Telemetria)
                        <span className="text-[8px] bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40 px-1.5 py-0.2 rounded font-bold">AO VIVO</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans mt-0.5">Gráficos de telemetria, medidores e sinais vitais</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* TÓPICO 3: WORKSPACE MODE (EXPRESS VS STUDIO) */}
            <div className="flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/10 shrink-0 ml-1">
              <button 
                onClick={() => setWorkspaceMode('express')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  workspaceMode === 'express' ? 'bg-white/15 text-white shadow-sm' : 'text-[#888888] hover:text-white'
                }`}
                title="Modo Express (Geração Direta de Código)"
              >
                <Zap size={13} className="text-[#00ff88]" />
                <span>Express</span>
              </button>
              <button 
                onClick={() => {
                  setWorkspaceMode('studio');
                  if (generatedNode) {
                    setActiveTab('architecture');
                    setArchitectureViewMode('canvas');
                  }
                }}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  workspaceMode === 'studio' ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40 shadow-sm' : 'text-[#888888] hover:text-white'
                }`}
                title="Modo Studio (Canvas de Nós ReactFlow)"
              >
                <Layers size={13} className="text-[#00d4ff]" />
                <span>Studio</span>
              </button>
            </div>
          </div>

          {/* Direita: Ações Rápidas & Menu Mobile */}
          <div className="flex items-center gap-2 shrink-0">
            {/* BOTÃO PLANOS */}
            <button 
              onClick={() => setShowUpgradeModal(true)} 
              className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-extrabold px-3 py-1.5 rounded-lg text-xs uppercase flex items-center gap-1.5 shadow-[0_0_14px_rgba(0,255,136,0.35)] hover:scale-105 transition-all cursor-pointer shrink-0"
              title="Planos e Assinaturas"
            >
              <Sparkles size={14} fill="black" />
              <span className="font-mono text-[11px]">PLANOS</span>
            </button>

            {/* ADMIN (Se permitido) */}
            {isAdmin && (
              <button 
                onClick={() => setCurrentView('admin')} 
                className={`cursor-pointer transition-colors p-2 rounded-lg text-[#00ff88] hidden sm:flex items-center gap-1 ${
                  currentView === 'admin' ? 'bg-[#00ff88]/20 border border-[#00ff88]/40 font-bold' : 'hover:bg-[#00ff88]/10'
                }`}
                title="Painel Admin"
              >
                <Shield size={15} />
                <span className="text-[10px] font-mono hidden lg:inline">ADMIN</span>
              </button>
            )}

            {/* CONFIGURAÇÕES E CONTA (Desktop) */}
            <div className="hidden sm:flex items-center gap-1 border-l border-white/10 pl-2">
              <button 
                onClick={() => setShowLanding(true)} 
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer" 
                title="Apresentação Institucional"
              >
                <Target size={16} />
              </button>

              <button 
                onClick={() => setCurrentView('settings')} 
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  currentView === 'settings' ? 'text-white bg-white/15' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title="Configurações do Perfil"
              >
                <Settings size={16} />
              </button>

              {session && supabase ? (
                <button 
                  onClick={handleLogout} 
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Sair da Conta"
                >
                  <X size={16} />
                </button>
              ) : (
                supabase && (
                  <button 
                    onClick={() => setShowLoginModal(true)} 
                    className="px-2.5 py-1 text-[11px] rounded-lg text-[#00ff88] border border-[#00ff88]/30 bg-[#00ff88]/10 hover:bg-[#00ff88]/20 transition-colors uppercase font-bold shrink-0 font-mono cursor-pointer"
                    title="Entrar ou Cadastrar"
                  >
                    ENTRAR
                  </button>
                )
              )}
            </div>

            {/* BOTÃO MOBILE MENU (HAMBÚRGUER) */}
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="md:hidden p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
              title={mobileMenuOpen ? "Fechar Menu" : "Abrir Menu de Tópicos"}
            >
              {mobileMenuOpen ? <X size={18} className="text-[#00ff88]" /> : <Menu size={18} />}
            </button>
          </div>
        </header>

        {/* DRAWER MOBILE LATERAL (OFF-CANVAS TOPIC NAVIGATION) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md md:hidden flex justify-end animate-in fade-in duration-200">
            <div className="w-[85%] max-w-sm h-full bg-[#090b11] border-l border-white/10 p-5 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                {/* Header do Drawer */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#00ff88] to-[#00d4ff] flex items-center justify-center font-black text-black text-sm">
                      P
                    </div>
                    <div>
                      <div className="text-white text-sm font-black font-display">PARVUS AUTOMATE</div>
                      <div className="text-[9px] text-gray-500 font-mono">NAVEGAÇÃO POR TÓPICOS</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tópico: Sistemas & Web */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#00ff88] flex items-center gap-1.5">
                    <Code2 size={13} />
                    Sistemas & Automação Web
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      onClick={() => { setCurrentView('app'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                        currentView === 'app' ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 font-bold' : 'bg-white/[0.03] text-gray-300 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Code2 size={16} className="text-[#00ff88]" />
                        <span className="text-xs">Gerador de Sistemas</span>
                      </div>
                      {currentView === 'app' && <span className="text-[9px] bg-[#00ff88] text-black px-1.5 py-0.2 rounded font-bold">ATIVO</span>}
                    </button>

                    <button
                      onClick={() => { setCurrentView('marketplace'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                        currentView === 'marketplace' ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30 font-bold' : 'bg-white/[0.03] text-gray-300 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Globe size={16} className="text-[#00d4ff]" />
                        <span className="text-xs">Marketplace de Soluções</span>
                      </div>
                      {currentView === 'marketplace' && <span className="text-[9px] bg-[#00d4ff] text-black px-1.5 py-0.2 rounded font-bold">ATIVO</span>}
                    </button>

                    <button
                      onClick={() => { setCurrentView('purchases'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                        currentView === 'purchases' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 font-bold' : 'bg-white/[0.03] text-gray-300 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Box size={16} className="text-purple-400" />
                        <span className="text-xs">Minhas Compras</span>
                      </div>
                      {currentView === 'purchases' && <span className="text-[9px] bg-purple-400 text-black px-1.5 py-0.2 rounded font-bold">ATIVO</span>}
                    </button>
                  </div>
                </div>

                {/* Tópico: Ecossistema IoT */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ff6600] flex items-center gap-1.5">
                    <Cpu size={13} />
                    Ecossistema IoT (Hardware & Nuvem)
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      onClick={() => { setCurrentView('iot-generator'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                        currentView === 'iot-generator' || currentView === 'iot' ? 'bg-[#ff6600]/15 text-[#ff6600] border border-[#ff6600]/30 font-bold' : 'bg-white/[0.03] text-gray-300 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Cpu size={16} className="text-[#ff6600]" />
                        <span className="text-xs">1. Gerador IoT (Hardware)</span>
                      </div>
                      <span className="text-[8px] bg-[#ff6600]/20 text-[#ff6600] px-1.5 py-0.2 rounded font-bold">WOKWI</span>
                    </button>

                    <button
                      onClick={() => { setCurrentView('iot-software'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                        currentView === 'iot-software' ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30 font-bold' : 'bg-white/[0.03] text-gray-300 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Cloud size={16} className="text-[#00d4ff]" />
                        <span className="text-xs">2. IoT Software (Cloud Brain)</span>
                      </div>
                      <span className="text-[8px] bg-[#00d4ff]/20 text-[#00d4ff] px-1.5 py-0.2 rounded font-bold">MQTT</span>
                    </button>

                    <button
                      onClick={() => { setCurrentView('iot-monitor'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                        currentView === 'iot-monitor' ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 font-bold' : 'bg-white/[0.03] text-gray-300 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Network size={16} className="text-[#00ff88]" />
                        <span className="text-xs">3. IoT Monitor (Telemetria)</span>
                      </div>
                      <span className="text-[8px] bg-[#00ff88]/20 text-[#00ff88] px-1.5 py-0.2 rounded font-bold">LIVE</span>
                    </button>
                  </div>
                </div>

                {/* Modo de Trabalho */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
                    Modo de Trabalho
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                      onClick={() => { setWorkspaceMode('express'); setMobileMenuOpen(false); }}
                      className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        workspaceMode === 'express' ? 'bg-white/15 text-white' : 'text-gray-400'
                      }`}
                    >
                      <Zap size={14} className="text-[#00ff88]" /> Express
                    </button>
                    <button
                      onClick={() => {
                        setWorkspaceMode('studio');
                        if (generatedNode) {
                          setActiveTab('architecture');
                          setArchitectureViewMode('canvas');
                        }
                        setMobileMenuOpen(false);
                      }}
                      className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        workspaceMode === 'studio' ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'text-gray-400'
                      }`}
                    >
                      <Layers size={14} className="text-[#00d4ff]" /> Studio
                    </button>
                  </div>
                </div>

                {/* Conta & Ajustes */}
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <button
                    onClick={() => { setShowUpgradeModal(true); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-extrabold text-xs flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <Sparkles size={14} fill="black" /> Ver Planos & Upgrades
                  </button>

                  <button
                    onClick={() => { setCurrentView('settings'); setMobileMenuOpen(false); }}
                    className="w-full p-2.5 rounded-xl hover:bg-white/5 text-gray-300 text-xs flex items-center gap-2.5 text-left"
                  >
                    <Settings size={15} /> Configurações da Conta
                  </button>

                  <button
                    onClick={() => { setShowLanding(true); setMobileMenuOpen(false); }}
                    className="w-full p-2.5 rounded-xl hover:bg-white/5 text-gray-300 text-xs flex items-center gap-2.5 text-left"
                  >
                    <Target size={15} /> Apresentação Institucional
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => { setCurrentView('admin'); setMobileMenuOpen(false); }}
                      className="w-full p-2.5 rounded-xl bg-[#00ff88]/10 text-[#00ff88] text-xs flex items-center gap-2.5 text-left font-bold"
                    >
                      <Shield size={15} /> Painel Administrativo
                    </button>
                  )}
                </div>
              </div>

              {/* Rodapé do Drawer */}
              <div className="pt-4 border-t border-white/10">
                {session && supabase ? (
                  <button
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-500/20"
                  >
                    <X size={15} /> Sair da Conta
                  </button>
                ) : (
                  supabase && (
                    <button
                      onClick={() => { setShowLoginModal(true); setMobileMenuOpen(false); }}
                      className="w-full py-2.5 rounded-xl bg-[#00ff88]/20 border border-[#00ff88]/40 text-[#00ff88] text-xs font-bold uppercase tracking-wider"
                    >
                      Entrar / Cadastrar
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

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
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button 
                onClick={() => {
                  const defaultAnswers: Record<string, string> = {};
                  classification.perguntas_necessarias.forEach(q => {
                    defaultAnswers[q.id] = q.tipo === 'opcoes' && q.opcoes && q.opcoes.length > 0
                      ? q.opcoes[0]
                      : 'Padrão recomendado para produção enterprise';
                  });
                  setAnswers(defaultAnswers);
                  handleGenerate(classification, defaultAnswers);
                }}
                className="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5"
                title="Preencher com os padrões recomendados pela arquitetura e gerar imediatamente"
              >
                <Zap size={13} className="text-[#ff6600]" /> PULAR E USAR PADRÕES
              </button>
              <button 
                onClick={() => handleGenerate(classification, answers)}
                className="flex-1 py-3.5 rounded-xl bg-[#ff6600] text-black font-black text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(255,102,0,0.3)] hover:shadow-[0_0_30px_rgba(255,102,0,0.5)] hover:bg-[#ff7700] transition-all flex justify-center items-center gap-2"
              >
                GERAR SISTEMA <Play fill="currentColor" size={14} />
              </button>
            </div>
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
    if (phase === 'input' || phase === 'classifying' || phase === 'questions' || phase === 'inviavel') {
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
            <nav className="flex flex-wrap lg:flex-nowrap border-b border-white/10 shrink-0 bg-[#090b10] items-center justify-between px-2 sm:px-4 py-2 gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
                <button 
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 sm:px-5 py-2 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap rounded-lg ${activeTab === 'preview' ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30' : 'text-[#888888] hover:text-white'}`}
                >
                  PREVIEW AO VIVO
                </button>
                <button 
                  onClick={() => setActiveTab('code')}
                  className={`px-3 sm:px-5 py-2 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap rounded-lg ${activeTab === 'code' ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30' : 'text-[#888888] hover:text-white'}`}
                >
                  CÓDIGO FONTE
                </button>
                <button 
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3 sm:px-5 py-2 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap rounded-lg ${activeTab === 'architecture' ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30' : 'text-[#888888] hover:text-white'}`}
                >
                  ARQUITETURA
                </button>
                {(classification?.tipo === 'HARDWARE' || classification?.tipo === 'HIBRIDO') && (
                  <button 
                    onClick={() => setActiveTab('hardware')}
                    className={`px-3 sm:px-5 py-2 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap rounded-lg ${activeTab === 'hardware' ? 'bg-[#ff6600]/15 text-[#ff6600] border border-[#ff6600]/30' : 'text-[#888888] hover:text-white'}`}
                  >
                    HARDWARE & PDFS
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0" data-topic-dropdown>
                {/* 1. EXECUTAR NO NAVEGADOR (Com destaque) */}
                <button 
                  onClick={() => setShowSandboxRunner(true)}
                  className="text-[9px] sm:text-[10px] bg-[#00d4ff]/15 border border-[#00d4ff]/60 px-2 sm:px-3 py-1.5 hover:bg-[#00d4ff]/30 hover:border-[#00d4ff] text-[#00d4ff] rounded-lg transition-all uppercase tracking-wider whitespace-nowrap font-black flex items-center gap-1 shadow-[0_0_12px_rgba(0,212,255,0.25)] cursor-pointer"
                  title="Executar aplicação completa em IDE virtual interativa no navegador"
                >
                  <Play size={12} fill="currentColor" /> 
                  <span className="hidden sm:inline">EXECUTAR NO NAVEGADOR</span>
                  <span className="sm:hidden">RODAR</span>
                </button>

                {/* 2. EXPORTAR TUDO (ZIP) */}
                <button 
                  onClick={handleExportAllZip}
                  className="text-[9px] sm:text-[10px] bg-[#00ff88]/15 border border-[#00ff88]/60 px-2 sm:px-3 py-1.5 hover:bg-[#00ff88]/30 hover:border-[#00ff88] text-[#00ff88] rounded-lg transition-all uppercase tracking-wider whitespace-nowrap font-black flex items-center gap-1 shadow-[0_0_12px_rgba(0,255,136,0.25)] cursor-pointer"
                  title="Baixar pacote empresarial completo em arquivo ZIP (HTML, Node.js, SQL, Docker e Docs)"
                >
                  <Archive size={12} /> 
                  <span className="hidden sm:inline">EXPORTAR TUDO</span>
                  <span className="sm:hidden">ZIP</span>
                </button>

                {/* 3. MENU DROPDOWN DE FERRAMENTAS E EXPORTAÇÕES AVULSAS */}
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowToolsDropdown(prev => !prev);
                    }}
                    className={`text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-1.5 rounded-lg border transition-all uppercase tracking-wider whitespace-nowrap font-bold flex items-center gap-1 cursor-pointer ${
                      showToolsDropdown 
                        ? 'bg-white/20 border-white text-white' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300 hover:text-white'
                    }`}
                    title="Menu de Ferramentas Enterprise e Exportação"
                  >
                    <Wrench size={12} />
                    <span className="hidden md:inline">FERRAMENTAS</span>
                    <ChevronDown size={11} className={`transition-transform duration-200 ${showToolsDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown de Ferramentas */}
                  {showToolsDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-[#0c0e17] border border-white/15 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95">
                      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 border-b border-white/5 mb-1 font-mono">
                        Ferramentas & Integrações
                      </div>

                      <button
                        onClick={() => { setShowWebhookModal(true); setShowToolsDropdown(false); }}
                        className="w-full text-left p-2 rounded-lg flex items-center gap-2.5 hover:bg-white/5 text-gray-300 hover:text-white text-xs transition-colors cursor-pointer"
                      >
                        <Zap size={14} className="text-[#ff6600]" />
                        <div>
                          <div className="font-bold text-[11px]">Simular Webhook</div>
                          <div className="text-[9px] text-gray-400 font-sans">Assinatura HMAC-SHA256</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { setShowSqlSchemaModal(true); setShowToolsDropdown(false); }}
                        className="w-full text-left p-2 rounded-lg flex items-center gap-2.5 hover:bg-white/5 text-gray-300 hover:text-white text-xs transition-colors cursor-pointer"
                      >
                        <Database size={14} className="text-[#0066ff]" />
                        <div>
                          <div className="font-bold text-[11px]">Esquema SQL (Supabase)</div>
                          <div className="text-[9px] text-gray-400 font-sans">DDL, Índices e RLS</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { setShowEnvConfigModal(true); setShowToolsDropdown(false); }}
                        className="w-full text-left p-2 rounded-lg flex items-center gap-2.5 hover:bg-white/5 text-gray-300 hover:text-white text-xs transition-colors cursor-pointer"
                      >
                        <Sliders size={14} className="text-purple-400" />
                        <div>
                          <div className="font-bold text-[11px]">Variáveis .ENV</div>
                          <div className="text-[9px] text-gray-400 font-sans">Configuração de ambientes</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { handleSaveAsTemplate(); setShowToolsDropdown(false); }}
                        className="w-full text-left p-2 rounded-lg flex items-center gap-2.5 hover:bg-white/5 text-gray-300 hover:text-white text-xs transition-colors cursor-pointer"
                      >
                        <Bookmark size={14} className="text-amber-400" />
                        <div>
                          <div className="font-bold text-[11px]">Salvar como Template</div>
                          <div className="text-[9px] text-gray-400 font-sans">Guardar para reutilizar</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { handleForkProject(); setShowToolsDropdown(false); }}
                        className="w-full text-left p-2 rounded-lg flex items-center gap-2.5 hover:bg-white/5 text-gray-300 hover:text-white text-xs transition-colors cursor-pointer"
                      >
                        <GitFork size={14} className="text-gray-300" />
                        <div>
                          <div className="font-bold text-[11px]">Clonar / Fork</div>
                          <div className="text-[9px] text-gray-400 font-sans">Criar nova versão independente</div>
                        </div>
                      </button>

                      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 border-b border-t border-white/5 my-1 font-mono">
                        Downloads Avulsos & Deploy
                      </div>

                      <div className="grid grid-cols-3 gap-1 px-1">
                        <button
                          onClick={() => { downloadHtml(); setShowToolsDropdown(false); }}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-center text-gray-300 hover:text-white cursor-pointer"
                        >
                          HTML
                        </button>
                        <button
                          onClick={() => { downloadNode(); setShowToolsDropdown(false); }}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-center text-gray-300 hover:text-white cursor-pointer"
                        >
                          NODE
                        </button>
                        <button
                          onClick={() => { downloadDockerPkg(); setShowToolsDropdown(false); }}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-center text-gray-300 hover:text-white cursor-pointer"
                        >
                          DOCKER
                        </button>
                      </div>

                      {(classification?.tipo === 'HARDWARE' || classification?.tipo === 'HIBRIDO') && (
                        <button
                          onClick={() => { downloadTodosIoT(); setShowToolsDropdown(false); }}
                          className="w-full mt-1.5 p-2 rounded-lg bg-[#ff6600]/10 text-[#ff6600] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#ff6600]/20 cursor-pointer"
                        >
                          <Cpu size={13} /> BAIXAR PACOTE IOT (ZIP)
                        </button>
                      )}

                      <button
                        onClick={() => { handlePublishToMarketplace(); setShowToolsDropdown(false); }}
                        className="w-full mt-1.5 p-2 rounded-lg bg-[#00ff88]/10 text-[#00ff88] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#00ff88]/20 cursor-pointer"
                      >
                        <Globe size={13} /> PUBLICAR NO MARKETPLACE
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-px h-5 bg-white/10 mx-1"></div>

                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-[#888888] hover:text-white transition-colors flex items-center justify-center p-1.5 rounded hover:bg-white/5 cursor-pointer"
                  title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                >
                  {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                </button>
              </div>
            </nav>

            <div className={`flex-1 bg-[#0a0a0a] relative overflow-hidden ${isFullscreen ? '' : 'sm:p-6'}`}>
              {activeTab === 'preview' && (
                <div className={`w-full h-full relative overflow-hidden ${isFullscreen ? '' : 'sm:bg-white/[0.02] sm:border border-white/10 sm:rounded-sm p-0'}`}>
                  {!isFullscreen && (
                    <div className="hidden sm:flex absolute top-0 left-0 right-0 h-8 bg-[#222] border-b border-[#333] items-center px-4 gap-2 z-10">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                      </div>
                      <div className="text-[10px] text-white/50 ml-2 bg-black/20 px-2 py-0.5 rounded-sm">https://localhost:8080/preview</div>
                    </div>
                  )}
                  <iframe 
                    id="previewFrame"
                    srcDoc={generatedHtml || "<html><body style='background:#f0f0f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'><h1 style='color:#ccc'>Projeto Vazio</h1></body></html>"}
                    className={`w-full h-full border-none outline-none bg-white ${isFullscreen ? '' : 'sm:pt-8'}`}
                    title="Live Preview"
                    sandbox="allow-scripts allow-forms allow-same-origin"
                  />
                </div>
              )}
              {activeTab === 'code' && (
                <div className="w-full h-full flex flex-col bg-[#111111] sm:border border-white/10 overflow-hidden">
                  {/* File switcher bar */}
                  <div className="h-10 bg-[#0d0d0d] border-b border-white/10 flex items-center justify-between px-3 gap-2 shrink-0 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'index.html', label: 'index.html', badge: 'SPA' },
                        { id: 'server.js', label: 'server.js', badge: 'NODE' },
                        { id: 'schema.sql', label: 'schema.sql', badge: 'SQL' },
                        { id: 'package.json', label: 'package.json', badge: 'JSON' },
                        { id: '.env.example', label: '.env.example', badge: 'ENV' },
                        { id: 'Dockerfile', label: 'Dockerfile', badge: 'DOCKER' }
                      ].map(file => (
                        <button
                          key={file.id}
                          onClick={() => setCodeActiveFile(file.id as any)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono transition-colors ${
                            codeActiveFile === file.id
                              ? 'bg-white/15 text-white font-bold border-b border-[#00ff88]'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <FileCode size={12} className={codeActiveFile === file.id ? 'text-[#00ff88]' : 'text-gray-500'} />
                          {file.label}
                          <span className={`text-[8px] px-1 py-0.2 rounded font-sans uppercase ${
                            codeActiveFile === file.id ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-white/5 text-gray-500'
                          }`}>
                            {file.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(currentCodeFileContent);
                            setCopiedFile(true);
                            setTimeout(() => setCopiedFile(false), 2000);
                            showToast(`${codeActiveFile} copiado para a área de transferência!`, 'success');
                          } catch {
                            showToast('Erro ao copiar arquivo.', 'error');
                          }
                        }}
                        className="px-2.5 py-1 text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white rounded flex items-center gap-1 transition-colors uppercase font-mono"
                        title="Copiar conteúdo deste arquivo"
                      >
                        {copiedFile ? <Check size={11} className="text-[#00ff88]" /> : <Copy size={11} />}
                        {copiedFile ? 'COPIADO' : 'COPIAR'}
                      </button>
                      <button
                        onClick={() => {
                          const blob = new Blob([currentCodeFileContent], { type: 'text/plain;charset=utf-8' });
                          downloadBlob(blob, codeActiveFile);
                          showToast(`Arquivo ${codeActiveFile} baixado!`, 'success');
                        }}
                        className="px-2.5 py-1 text-[10px] bg-[#00ff88]/15 border border-[#00ff88]/40 hover:bg-[#00ff88]/30 text-[#00ff88] rounded flex items-center gap-1 transition-colors uppercase font-mono font-bold"
                        title="Baixar este arquivo individualmente"
                      >
                        <Download size={11} /> BAIXAR
                      </button>
                    </div>
                  </div>
                  {/* Code editor / pre */}
                  <div className="flex-1 p-6 overflow-auto text-[#d4d4d4] font-mono text-[12px] leading-relaxed select-text bg-[#0b0c10]">
                    <pre><code>{currentCodeFileContent}</code></pre>
                  </div>
                </div>
              )}
              {activeTab === 'architecture' && generatedNode && (
                <div className="w-full h-full flex flex-col bg-[#07080c] sm:border border-white/10 overflow-hidden">
                  {/* Mode Bar */}
                  <div className="p-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#0c0e17] shrink-0">
                    <div className="flex items-center gap-2">
                      <Network size={16} className="text-[#00ff88]" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Topologia de Arquitetura</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 font-bold font-mono">
                        {architectureViewMode === 'nodes' ? 'REACT FLOW 2D' : architectureViewMode === 'canvas' ? 'CANVAS STUDIO' : 'ASCII DOCS'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center p-0.5 rounded-lg bg-white/[0.05] border border-white/10">
                        <button 
                          onClick={() => setArchitectureViewMode('nodes')}
                          className={`px-3 py-1 rounded text-xs font-bold transition-all ${architectureViewMode === 'nodes' ? 'bg-[#00ff88] text-black shadow-[0_0_12px_rgba(0,255,136,0.3)]' : 'text-gray-400 hover:text-white'}`}
                        >
                          Canvas de Nós
                        </button>
                        <button 
                          onClick={() => setArchitectureViewMode('canvas')}
                          className={`px-3 py-1 rounded text-xs font-bold transition-all ${architectureViewMode === 'canvas' ? 'bg-[#00d4ff] text-black shadow-[0_0_12px_rgba(0,212,255,0.3)]' : 'text-gray-400 hover:text-white'}`}
                        >
                          Studio AST
                        </button>
                        <button 
                          onClick={() => setArchitectureViewMode('ascii')}
                          className={`px-3 py-1 rounded text-xs font-bold transition-all ${architectureViewMode === 'ascii' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          Esquema ASCII
                        </button>
                      </div>
                    </div>
                  </div>

                  {architectureViewMode === 'nodes' ? (
                    <div className="flex-1 w-full h-full min-h-[550px] relative">
                      <ArchitectureFlowCanvas
                        projectTitle={classification?.resumo || 'Arquitetura do Sistema'}
                        projectType={classification?.tipo || 'SOFTWARE'}
                        nodeData={generatedNode}
                        iotProject={activeIotProject}
                        onOpenSandbox={() => setShowSandboxRunner(true)}
                        onNavigateToSoftware={() => setCurrentView('iot-software')}
                        onNavigateToMonitor={() => setCurrentView('iot-monitor')}
                        onNavigateToHardware={() => setCurrentView('iot-generator')}
                      />
                    </div>
                  ) : architectureViewMode === 'canvas' ? (
                    <div className="p-3 sm:p-5 w-full h-[780px] overflow-auto">
                      <CanvasStudio
                        initialAST={generatedNode.flow_ast || createDefaultFlowAST(problemDescription || 'Automação Parvus', classification?.tipo || 'SOFTWARE')}
                        activeMode={workspaceMode}
                        onModeChange={setWorkspaceMode}
                        onCompileAndSync={handleCanvasCompileAndSync}
                        projectName={classification?.resumo || 'Projeto Parvus Automate'}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 w-full bg-[#111111] text-[#00ff88] font-mono text-xs p-8 overflow-auto leading-relaxed">
                      {(classification?.tipo === 'ENTERPRISE' || classification?.complexidade === 'ENTERPRISE') && (
                        <div className="mb-8 border border-[#ff6600]/40 bg-[#ff6600]/10 p-5 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-[#ff6600] flex items-center gap-2 mb-1">
                              <Factory size={14} /> CERTIFICAÇÃO INDUSTRIAL & ARQUITETURA MISSÃO CRÍTICA
                            </div>
                            <p className="text-white/80 text-xs font-sans leading-relaxed">
                              Projeto sintetizado com padrões de alta tolerância a falhas, concorrência desacoplada e isolamento de banco.
                            </p>
                          </div>
                          <button 
                            onClick={() => showToast('Solicitação de homologação enterprise enviada! Nossa equipe entrará em contato.', 'success')}
                            className="px-4 py-2 bg-[#ff6600] text-black font-bold uppercase text-[10px] tracking-wider rounded hover:bg-[#ff7700] transition-colors shrink-0 shadow-[0_0_15px_rgba(255,102,0,0.3)]"
                          >
                            Homologação On-Premise
                          </button>
                        </div>
                      )}
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
                </div>
              )}
              {activeTab === 'hardware' && generatedNode && (
                <div className="w-full h-full bg-[#111111] sm:border border-white/10 font-mono text-xs p-8 overflow-auto leading-relaxed">
                  <div className="mb-8 border-b border-white/10 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-white text-sm font-bold tracking-widest uppercase flex items-center gap-2">
                          Código da Placa (C++/ESP32/Arduino)
                          <span className="text-[#ff6600] text-[10px] px-2 py-0.5 rounded bg-[#ff6600]/10 border border-[#ff6600]/30 font-bold">FIRMWARE IOT</span>
                        </h2>
                        <p className="text-[10px] text-gray-400 font-sans mt-0.5">Firmware não-bloqueante pronto para compilar no Arduino IDE ou PlatformIO.</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={async () => {
                            if (!generatedNode.codigo_placa) return;
                            await navigator.clipboard.writeText(generatedNode.codigo_placa);
                            showToast('Código C++ do firmware copiado!', 'success');
                          }}
                          className="px-3 py-1.5 text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded flex items-center gap-1.5 transition-colors uppercase font-mono font-bold"
                          title="Copiar código C++"
                        >
                          <Copy size={11} /> COPIAR C++
                        </button>
                        <button
                          onClick={() => {
                            if (!generatedNode.codigo_placa) return;
                            const blob = new Blob([generatedNode.codigo_placa], { type: 'text/plain;charset=utf-8' });
                            downloadBlob(blob, 'main.cpp');
                            showToast('main.cpp baixado com sucesso!', 'success');
                          }}
                          className="px-3 py-1.5 text-[10px] bg-[#ff6600]/15 border border-[#ff6600]/40 hover:bg-[#ff6600]/30 text-[#ff6600] rounded flex items-center gap-1.5 transition-colors uppercase font-mono font-bold"
                          title="Baixar arquivo main.cpp"
                        >
                          <Download size={11} /> BAIXAR MAIN.CPP
                        </button>
                        <button
                          onClick={() => {
                            setActiveIotProject({
                              titulo: classification?.resumo || 'Projeto IoT',
                              placa: 'ESP32 DevKit v1',
                              codigo_c: generatedNode.codigo_placa,
                              pdf_pecas: generatedNode.pdf_pecas,
                              pdf_montagem: generatedNode.pdf_montagem,
                              pdf_documentacao: generatedNode.pdf_documentacao
                            });
                            setCurrentView('iot');
                            showToast('Projeto enviado para o IoT Studio & Simuladores!', 'success');
                          }}
                          className="px-3.5 py-1.5 text-[10px] bg-[#00d4ff] hover:bg-[#33ddff] text-black rounded flex items-center gap-1.5 transition-all uppercase font-mono font-extrabold shadow-[0_0_15px_rgba(0,212,255,0.3)]"
                          title="Carregar este hardware no IoT Studio completo com simuladores Wokwi, pinout e diagramas"
                        >
                          <Zap size={12} fill="black" /> ABRIR NO IOT STUDIO & SIMULADORES
                        </button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap text-[#f0f0f0] bg-black/50 p-4 border border-white/5 rounded">{generatedNode.codigo_placa || 'Nenhum código gerado.'}</pre>
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
         
         const response = await callGeminiApi('meta/llama-3.3-70b-instruct', prompt, {
           temperature: 0.2,
           responseMimeType: "application/json"
         });
         
         const text = response.text;
         if (!text) throw new Error("AI response empty");
         const result = safeJsonParseWithRepair(text);
         
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

      {!isFullscreen && renderTopbar()}
      <main className="flex flex-col md:flex-row flex-1 overflow-hidden relative z-10 w-full pb-14 md:pb-0">
        {/* Persistent IoT Monitor container so switching tabs doesn't destroy state */}
        <div className={currentView === 'iot-generator' || currentView === 'iot' ? "flex-1 flex flex-col overflow-hidden w-full h-full" : "hidden"}>
          <IotMonitor 
            onBack={() => setCurrentView('app')} 
            initialProject={activeIotProject}
            onGenerationStart={(info) => {
              setBackgroundGen({
                active: true,
                progress: 15,
                message: `Iniciando síntese de hardware: ${info.title} (${info.placa})...`,
                model: 'Gemini 3.8 Flash / Nemotron Hardware Eng',
                type: 'iot',
                title: info.title
              });
              showToast(`Síntese IoT iniciada: ${info.title}`, 'info');
            }}
            onGenerationProgress={(prog, msg) => {
              setBackgroundGen(prev => ({
                ...prev,
                progress: prog,
                message: msg
              }));
            }}
            onGenerationComplete={(proj) => {
              updateActiveIotProject(proj);
              setBackgroundGen({
                active: false,
                progress: 100,
                message: 'Hardware sintetizado com sucesso!',
                model: 'Gemini 3.8 Flash / Nemotron Hardware Eng',
                type: 'iot',
                title: proj?.titulo || 'Projeto IoT'
              });
              showToast(`Firmware e esquemático de "${proj?.titulo || 'Projeto IoT'}" gerados com sucesso!`, 'success');
            }}
            onGenerationError={(err) => {
              setBackgroundGen(prev => ({ ...prev, active: false }));
              showToast(`Falha na síntese IoT: ${err}`, 'error');
            }}
          />
        </div>

        {currentView === 'app' ? (
          <>
            {entryFlow === 'selection' ? (
              <EntrySelection onSelect={handleSelectEntryFlow} />
            ) : entryFlow === 'templates' ? (
              <TemplatesFlow 
                onBack={() => setEntryFlow('selection')}
                onGoToAI={() => setEntryFlow('ai')}
                onGenerate={handleTemplateGenerate}
                onLoadDirectly={handleLoadTemplateDirectly}
              />
            ) : entryFlow === 'briefing' ? (
              <BriefingFlow 
                onBack={() => setEntryFlow('selection')}
                onSubmit={handleBriefingSubmit}
              />
            ) : (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full h-full min-w-0">
                {/* Mobile Workspace Toggle quando o projeto já está gerado */}
                {phase === 'done' && !isFullscreen && (
                  <div className="md:hidden flex items-center justify-between p-2 bg-[#090b10] border-b border-white/10 shrink-0 font-mono">
                    <button 
                      onClick={() => setMobileWorkspaceTab('prompt')}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors text-center cursor-pointer ${
                        mobileWorkspaceTab === 'prompt' ? 'bg-white/15 text-white border border-white/20' : 'text-gray-400'
                      }`}
                    >
                      📝 Briefing & Config
                    </button>
                    <button 
                      onClick={() => setMobileWorkspaceTab('view')}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors text-center cursor-pointer ${
                        mobileWorkspaceTab === 'view' ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30' : 'text-gray-400'
                      }`}
                    >
                      🚀 Projeto ({activeTab.toUpperCase()})
                    </button>
                  </div>
                )}

                {/* Left Panel Container */}
                {!isFullscreen && (
                  <div className={phase === 'done' && mobileWorkspaceTab === 'view' ? "hidden md:flex w-full md:w-[320px] lg:w-[400px] shrink-0 h-full overflow-hidden" : "flex w-full md:w-[320px] lg:w-[400px] shrink-0 h-full overflow-hidden"}>
                    {renderLeftPanel()}
                  </div>
                )}

                {/* Build Area Container */}
                <section className={phase === 'done' && mobileWorkspaceTab === 'prompt' ? "hidden md:flex flex-1 flex-col bg-[#0a0a0a] min-w-0 overflow-hidden h-full" : "flex-1 flex flex-col bg-[#0a0a0a] min-w-0 overflow-hidden h-full"}>
                  {renderBuildArea()}
                </section>
              </div>
            )}
          </>
        ) : currentView === 'marketplace' ? (
          renderMarketplace()
        ) : currentView === 'purchases' ? (
          renderPurchases()
        ) : currentView === 'admin' ? (
          isAdmin ? renderAdmin() : <div className="text-center mt-20 text-red-500">Acesso negado. Funcionalidade exclusiva para administradores.</div>
        ) : currentView === 'settings' ? (
          <div className="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col bg-[#07080c]">
            <SettingsPage onLogout={handleLogout} />
          </div>
        ) : currentView === 'iot-software' ? (
          <div className="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col bg-[#07080c]">
            <IotSoftware 
              currentHardwareProject={activeIotProject || {
                titulo: classification?.resumo || 'Dispositivo IoT Autônomo',
                placa: 'ESP32 NodeMCU (Wi-Fi + BLE)'
              }}
              onNavigateToGenerator={() => setCurrentView('iot-generator')}
              onNavigateToMonitor={() => setCurrentView('iot-monitor')}
              onDispatchTelemetry={handleDispatchTelemetry}
            />
          </div>
        ) : currentView === 'iot-monitor' ? (
          <div className="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col bg-[#07080c]">
            <IotTelemetryMonitor 
              activeProject={activeIotProject}
              latestPacket={latestTelemetryPacket}
              telemetryHistory={telemetryHistory}
              onNavigateToSoftware={() => setCurrentView('iot-software')}
              onNavigateToGenerator={() => setCurrentView('iot-generator')}
              onDispatchTestPacket={handleDispatchTelemetry}
            />
          </div>
        ) : null}
      </main>
      
      {/* FOOTER STATUS BAR */}
      <footer className="h-8 border-t border-white/10 bg-[#111111] px-4 flex items-center justify-between text-[9px] text-[#444444] z-10 shrink-0">
        <div className="flex items-center gap-4">
          <span>MEM: 1.4GB / 4GB</span>
          <span>API_LATENCY: 42ms</span>
        </div>
        <div className="flex items-center gap-4 uppercase tracking-widest hidden sm:flex">
          <span className="text-[#888888]">GLM_5.1_THINKING_ENGINE</span>
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

      {/* UPGRADE & PRICING MODAL */}
      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}

      {/* LOGIN / SIGNUP MODAL */}
      {showLoginModal && !session && supabase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0f1118] border border-white/15 rounded-3xl p-6 shadow-2xl">
            <button 
              onClick={() => setShowLoginModal(false)} 
              className="absolute top-5 right-5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full transition-colors z-50"
              title="Fechar"
            >
              <X size={18} />
            </button>
            <Auth onSession={(s) => { setSession(s); setShowLoginModal(false); }} />
          </div>
        </div>
      )}

      {/* BACKGROUND GENERATION FLOATING WIDGET */}
      <BackgroundGenerationWidget
        isGenerating={backgroundGen.active}
        progress={backgroundGen.progress}
        currentMessage={backgroundGen.message}
        generationType={backgroundGen.type}
        activeModel={backgroundGen.model}
        onReturnToBuild={() => {
          if (backgroundGen.type === 'iot') {
            setCurrentView('iot');
          } else {
            setCurrentView('app');
            setEntryFlow('ai');
          }
        }}
        isMainViewActive={currentView === 'app' && entryFlow === 'ai'}
      />

      {/* WEBHOOK SIMULATOR MODAL */}
      <WebhookSimulatorModal
        isOpen={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        projectName={classification?.resumo || problemDescription || 'Automação'}
      />

      {/* SUPABASE / POSTGRESQL DDL MODAL */}
      <SqlSchemaModal
        isOpen={showSqlSchemaModal}
        onClose={() => setShowSqlSchemaModal(false)}
        projectName={classification?.resumo || problemDescription || 'Automação'}
        problemDescription={problemDescription}
        projectType={classification?.tipo || 'SOFTWARE'}
        generatedNode={generatedNode}
      />

      {/* ENVIRONMENT VARIABLES CONFIG MODAL */}
      <EnvConfigModal
        isOpen={showEnvConfigModal}
        onClose={() => setShowEnvConfigModal(false)}
        projectName={classification?.resumo || problemDescription || 'Automação'}
        isIot={classification?.tipo === 'HARDWARE' || classification?.tipo === 'HIBRIDO'}
      />

      {/* VIRTUAL SANDBOX RUNNER (IN-BROWSER IDE & SIMULATOR) */}
      {showSandboxRunner && (
        <VirtualSandboxRunner
          htmlContent={generatedHtml}
          nodeContent={generatedNode}
          projectName={classification?.resumo || problemDescription || 'parvus-project'}
          onClose={() => setShowSandboxRunner(false)}
        />
      )}

      {/* ERROR RECOVERY MODAL (ZERO-FAIL INVESTOR READY) */}
      {recoveryError && (
        <ErrorRecoveryModal
          isOpen={true}
          errorMessage={recoveryError.message}
          onRetry={() => {
            const retryFn = recoveryError.onRetry;
            setRecoveryError(null);
            retryFn();
          }}
          onClose={() => setRecoveryError(null)}
        />
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (FIXO PARA SMARTPHONES) */}
      {!isFullscreen && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#08090d]/95 backdrop-blur-xl border-t border-white/10 z-40 flex items-center justify-around px-2 font-mono shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => { setCurrentView('app'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors cursor-pointer ${
              currentView === 'app' ? 'text-[#00ff88]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Code2 size={18} />
            <span className="text-[9px] uppercase font-bold mt-0.5">Gerador</span>
          </button>

          <button
            onClick={() => {
              if (currentView === 'iot-generator') setCurrentView('iot-software');
              else if (currentView === 'iot-software') setCurrentView('iot-monitor');
              else setCurrentView('iot-generator');
              setMobileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors cursor-pointer ${
              currentView === 'iot-generator' || currentView === 'iot-software' || currentView === 'iot-monitor' || currentView === 'iot'
                ? 'text-[#ff6600]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Cpu size={18} />
            <span className="text-[9px] uppercase font-bold mt-0.5">IoT Hub</span>
          </button>

          <button
            onClick={() => setShowUpgradeModal(true)}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[#00ff88] hover:scale-105 transition-transform cursor-pointer"
          >
            <Sparkles size={18} fill="#00ff88" />
            <span className="text-[9px] uppercase font-bold mt-0.5">Planos</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors cursor-pointer ${
              mobileMenuOpen ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Menu size={18} />
            <span className="text-[9px] uppercase font-bold mt-0.5">Tópicos</span>
          </button>
        </nav>
      )}
    </div>
  );
}
