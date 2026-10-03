/**
 * Service to manage custom saved templates and cloning/forking of projects.
 */

export interface CustomTemplate {
  id: string;
  nome: string;
  descricao: string;
  tipo: 'SOFTWARE' | 'HARDWARE' | 'HIBRIDO' | 'ENTERPRISE';
  complexidade: string;
  icone: string;
  tecnologias: string[];
  tempo_minutos: number;
  isCustom: boolean;
  created_at: string;
  htmlGerado: string;
  nodeGerado: any;
  perguntas_customizacao: {
    id: string;
    tipo: 'text' | 'textarea' | 'select' | 'number';
    pergunta: string;
    placeholder?: string;
    campo_template: string;
    opcoes?: { value: string; label: string }[];
  }[];
}

const STORAGE_KEY = 'parvus_custom_templates';

export function getCustomTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Erro ao ler custom templates:', e);
    return [];
  }
}

export function saveProjectAsTemplate(params: {
  nome: string;
  descricao: string;
  tipo: string;
  complexidade?: string;
  tecnologias?: string[];
  htmlGerado: string;
  nodeGerado: any;
  icone?: string;
}): CustomTemplate {
  const templates = getCustomTemplates();
  
  const newTemplate: CustomTemplate = {
    id: `tpl_custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    nome: params.nome || 'Template Customizado',
    descricao: params.descricao || 'Template salvo a partir de um projeto gerado.',
    tipo: (params.tipo as any) || 'SOFTWARE',
    complexidade: params.complexidade || 'INTERMEDIARIO',
    icone: params.icone || '⚡',
    tecnologias: params.tecnologias && params.tecnologias.length > 0 ? params.tecnologias : ['Node.js', 'Express', 'Tailwind', 'Supabase'],
    tempo_minutos: 3,
    isCustom: true,
    created_at: new Date().toISOString(),
    htmlGerado: params.htmlGerado,
    nodeGerado: params.nodeGerado,
    perguntas_customizacao: [
      {
        id: 'q_custom_nome',
        tipo: 'text',
        pergunta: 'Nome da instância ou cliente',
        placeholder: 'Ex: Minha Empresa / Sistema V2',
        campo_template: 'INSTANCE_NAME'
      },
      {
        id: 'q_custom_obs',
        tipo: 'textarea',
        pergunta: 'Ajustes específicos ou novas regras desejadas',
        placeholder: 'Descreva parâmetros extras a serem adicionados...',
        campo_template: 'EXTRA_NOTES'
      }
    ]
  };

  const updated = [newTemplate, ...templates];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newTemplate;
}

export function deleteCustomTemplate(id: string): boolean {
  try {
    const templates = getCustomTemplates();
    const filtered = templates.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error('Erro ao deletar custom template:', e);
    return false;
  }
}
