import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, AlertTriangle } from 'lucide-react';

interface EditUserModalProps {
  user: any;
  onClose: () => void;
  onSave: () => void;
}

export function EditUserModal({ user, onClose, onSave }: EditUserModalProps) {
  const [plano, setPlano] = useState(user.plano || 'free');
  const [limite, setLimite] = useState(user.geracoes_limite || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const limitesPadrao: Record<string, number> = {
    free: 0,
    starter: 5,
    creator: 10,
    pro: 20,
    agency: 50,
    enterprise: 100,
    admin: 999999,
  };

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const novoPlano = e.target.value;
    setPlano(novoPlano);
    setLimite(limitesPadrao[novoPlano]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (!supabase) throw new Error("Supabase não configurado");

      const mesAtual = new Date().toISOString().slice(0, 7);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          plano: plano,
          geracoes_limite: limite,
          geracoes_usadas_mes: 0, // Reseta o uso ao mudar de plano
          mes_referencia: mesAtual,
          plano_ativo_desde: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onSave(); // Refreshes list and toasts conceptually
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar usuário");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111111] border border-white/10 rounded-xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">Editar Usuário</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Nome</label>
            <div className="text-white bg-[#0a0a0a] border border-white/5 px-3 py-2 rounded-lg text-sm">
              {user.nome || 'Sem nome'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">ID Usuário</label>
            <div className="text-gray-500 bg-[#0a0a0a] border border-white/5 px-3 py-2 rounded-lg text-xs truncate">
              {user.id}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Plano</label>
            <select 
              value={plano} 
              onChange={handlePlanChange}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#00ff88]"
            >
              <option value="free">Free (0)</option>
              <option value="starter">Starter (5)</option>
              <option value="creator">Creator (10)</option>
              <option value="pro">Pro (20)</option>
              <option value="agency">Agency (50)</option>
              <option value="enterprise">Enterprise (100)</option>
              <option value="admin">Admin (∞)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Limite Customizado (/mês)</label>
            <input 
              type="number" 
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value))}
              min="0"
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          {error && (
             <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm flex gap-2 items-start">
               <AlertTriangle size={16} className="shrink-0 mt-0.5" />
               <span>{error}</span>
             </div>
          )}

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-white/5">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-sm bg-[#00ff88] text-black font-bold rounded-lg hover:bg-[#00cc6a] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
