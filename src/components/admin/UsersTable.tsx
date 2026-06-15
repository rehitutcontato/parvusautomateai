import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Edit2 } from 'lucide-react';
import { EditUserModal } from './EditUserModal';
import { getBadgePlano } from '../../lib/permissions';

export function UsersTable() {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchUsers = async () => {
    setLoading(true);
    if (!supabase) return;
    
    // Auth users and profile join conceptually, but we can only select profiles directly over API 
    // unless there's a view. Assuming profile table contains what we need.
    // If we need email, it usually comes from auth.users which is restricted, 
    // but the instruction says "Buscar todos os profiles", so we'll just query profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profiles) {
      setUsers(profiles);
      setFilteredUsers(profiles);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredUsers(users.filter(u => 
      String(u.nome || '').toLowerCase().includes(q) || 
      String(u.id || '').toLowerCase().includes(q)
    ));
  }, [searchQuery, users]);

  return (
    <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-white">Gestão de Usuários</h2>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00ff88]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-gray-500">
              <th className="p-3 font-medium">Nome / ID</th>
              <th className="p-3 font-medium">Contato</th>
              <th className="p-3 font-medium">Plano</th>
              <th className="p-3 font-medium">Gerações</th>
              <th className="p-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-500">Carregando usuários...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <div className="font-medium text-white">{user.nome || 'Sem nome'}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[150px]" title={user.id}>{user.id}</div>
                  </td>
                  <td className="p-3 text-gray-400">
                    {user.whatsapp_contato || 'Sem contato'}
                  </td>
                  <td className="p-3">
                    <span 
                      className="px-2 py-1 rounded text-xs font-semibold uppercase"
                      style={{ 
                        color: getBadgePlano(user.plano).cor, 
                        backgroundColor: getBadgePlano(user.plano).bg 
                      }}
                    >
                      {getBadgePlano(user.plano).label}
                    </span>
                  </td>
                  <td className="p-3 text-gray-300">
                    {user.plano === 'admin' ? '∞/∞' : `${user.geracoes_usadas_mes || 0}/${user.geracoes_limite || 0}`}
                  </td>
                  <td className="p-3 text-right">
                    <button 
                      onClick={() => setEditingUser(user)}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                      title="Editar plano"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal 
          user={editingUser} 
          onClose={() => setEditingUser(null)} 
          onSave={() => {
            setEditingUser(null);
            fetchUsers();
          }} 
        />
      )}
    </div>
  );
}
