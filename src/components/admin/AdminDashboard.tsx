import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, DollarSign, Activity, Settings2, ShoppingCart } from 'lucide-react';
import { UsersTable } from './UsersTable';

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdminStats();
  }, []);

  const loadAdminStats = async () => {
    if (!supabase) return;
    
    try {
      // 1. Fetch Profiles Stats
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('plano, geracoes_usadas_mes, geracoes_limite, created_at');
      
      if (pErr) throw pErr;

      const counts = {
        free: profiles?.filter(p => p.plano === 'free').length || 0,
        starter: profiles?.filter(p => p.plano === 'starter').length || 0,
        creator: profiles?.filter(p => p.plano === 'creator').length || 0,
        pro: profiles?.filter(p => p.plano === 'pro').length || 0,
        enterprise: profiles?.filter(p => p.plano === 'enterprise').length || 0,
        admin: profiles?.filter(p => p.plano === 'admin').length || 0,
      };
      
      const revenuePlanos = {
        starter: counts.starter * 99,
        creator: counts.creator * 149, // Placeholder price if not specified
        pro: counts.pro * 247,
        enterprise: counts.enterprise * 497,
      };

      const totalRevenuePlanos = revenuePlanos.starter + revenuePlanos.creator + revenuePlanos.pro + revenuePlanos.enterprise;
      const totalGenerations = profiles?.reduce((acc, curr) => acc + (curr.geracoes_usadas_mes || 0), 0) || 0;

      // 2. Fetch Marketplace Stats
      const { data: purchases, error: mkErr } = await supabase
        .from('marketplace_purchases')
        .select('preco_pago, status');

      // Se a tabela não existir ainda ou houver erro RLS (pode ignorar)
      let totalRevenueMarketplace = 0;
      let MarketplaceSales = 0;
      let pendingApprovals = 0;

      if (!mkErr && purchases) {
        // Considera apenas compras pagas ou utilizadas
        const pagas = purchases.filter(p => p.status === 'paid' || p.status === 'download_used');
        totalRevenueMarketplace = pagas.reduce((acc, curr) => acc + Number(curr.preco_pago || 0), 0);
        MarketplaceSales = pagas.length;
        pendingApprovals = purchases.filter(p => p.status === 'pending_payment').length;
      }

      setStats({ 
        counts, 
        revenuePlanos, 
        totalRevenuePlanos, 
        totalGenerations,
        totalRevenueMarketplace,
        MarketplaceSales,
        pendingApprovals,
        totalRevenueGeneral: totalRevenuePlanos + totalRevenueMarketplace
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao carregar os dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-[#00ff88]">Carregando painel admin...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-red-500 max-w-2xl">
          <h2 className="font-bold text-lg mb-2">Erro de Acesso ao Banco de Dados</h2>
          <p className="mb-4">{error}</p>
          <p className="text-sm">Isso geralmente é causado pela política RLS (Recursão Infinita) ou tabela faltando.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
        <Settings2 className="text-[#00ff88]" size={28} />
        <h1 className="text-2xl font-bold text-white tracking-tight">Painel Admin</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-400 text-sm font-medium">Usuários Totais</h3>
            <Users className="text-blue-400" size={20} />
          </div>
          <div className="text-3xl font-bold text-white">
            {Object.values(stats.counts).reduce((a: any, b: any) => a + b, 0)}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#00ff88]/20 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff88]/10 blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-[#00ff88] text-sm font-medium">Receita Estimada Total</h3>
            <DollarSign className="text-[#00ff88]" size={20} />
          </div>
          <div className="text-3xl font-bold text-[#00ff88] relative z-10">
            R$ {stats.totalRevenueGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-[#00ff88]/70 flex justify-between">
            <span>Planos: R$ {stats.totalRevenuePlanos}</span>
            <span>Loja: R$ {stats.totalRevenueMarketplace}</span>
          </div>
        </div>

        <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-400 text-sm font-medium">Vendas Marketplace</h3>
            <ShoppingCart className="text-[#ff3366]" size={20} />
          </div>
          <div className="text-3xl font-bold text-white flex items-baseline gap-2">
            {stats.MarketplaceSales}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {stats.pendingApprovals} pendentes/PIX
          </div>
        </div>
        
        <div className="bg-[#111111] border border-white/5 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Planos Ativos</h3>
          </div>
          <div className="space-y-1 text-sm bg-[#0a0a0a] p-3 rounded-lg border border-white/5">
            <div className="flex justify-between w-full"><span className="text-gray-500">Free:</span> <span className="text-white">{stats.counts.free}</span></div>
            <div className="flex justify-between w-full"><span className="text-[#00ff88]">Starter:</span> <span className="text-white">{stats.counts.starter}</span></div>
            <div className="flex justify-between w-full"><span className="text-[#9b59b6]">Creator:</span> <span className="text-white">{stats.counts.creator}</span></div>
            <div className="flex justify-between w-full"><span className="text-purple-400">Pro:</span> <span className="text-white">{stats.counts.pro}</span></div>
            <div className="flex justify-between w-full"><span className="text-blue-400">Enterprise:</span> <span className="text-white">{stats.counts.enterprise}</span></div>
          </div>
        </div>
      </div>

      <UsersTable />
    </div>
  );
}
