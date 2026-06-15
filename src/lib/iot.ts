import { supabase } from './supabase';

export interface IoTDevice {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  hardware?: string;
  descricao?: string;
  status: 'online' | 'offline' | 'alerta' | 'erro';
  ultimo_ping?: string;
  dados_atuais: any;
  threshold_alerta: any;
  historico_resumo: any;
  token_dispositivo: string;
  created_at: string;
  updated_at: string;
}

export async function listarDispositivos(): Promise<IoTDevice[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('iot_devices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Erro ao carregar dispositivos');
  return data || [];
}

export async function criarDispositivo(device: Partial<IoTDevice>): Promise<IoTDevice> {
  if (!supabase) throw new Error('Supabase nao inicializado');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  
  const { data, error } = await supabase.from('iot_devices').insert({
    user_id: user.id,
    nome: device.nome,
    tipo: device.tipo,
    hardware: device.hardware,
    descricao: device.descricao,
    status: 'offline',
    dados_atuais: {},
    threshold_alerta: {},
    historico_resumo: {}
  }).select().single();
  
  if (error) throw new Error('Erro ao criar dispositivo: ' + error.message);
  return data;
}

export async function deletarDispositivo(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase nao inicializado');
  const { error } = await supabase.from('iot_devices').delete().eq('id', id);
  if (error) throw new Error('Erro ao deletar dispositivo: ' + error.message);
}

export async function atualizarDadosDispositivo(id: string, dados: any): Promise<void> {
  if (!supabase) throw new Error('Supabase nao inicializado');
  await supabase.from('iot_devices').update({
    dados_atuais: dados,
    ultimo_ping: new Date().toISOString(),
    status: 'online',
    updated_at: new Date().toISOString()
  }).eq('id', id);
}
