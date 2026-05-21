import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Cpu, Loader2 } from 'lucide-react';

interface AuthProps {
  onSession: (session: any) => void;
}

export function Auth({ onSession }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!supabase) {
         throw new Error('Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) onSession(data.session);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nome: name }
          }
        });
        if (error) throw error;
        if (data.session) {
            onSession(data.session);
        } else {
            setError('Conta criada! Verifique seu email para confirmar ou tente fazer login.');
            setIsLogin(true);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.05),transparent_50%)] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-[#111111] border border-white/10 p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 border border-white/10 bg-[#1a1a1a] flex items-center justify-center rounded-sm mb-4 shadow-[0_0_15px_rgba(0,255,136,0.1)]">
            <Cpu size={32} className="text-[#00ff88]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter text-[#00ff88] uppercase" style={{ fontFamily: "'Arial Black', sans-serif" }}>
            PARVUS_AUTOMATE
          </h1>
          <p className="text-xs text-[#888888] mt-2 tracking-widest uppercase">
            {isLogin ? 'Autenticação' : 'Criar Nova Conta'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs p-3 mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-[10px] text-[#888888] uppercase tracking-widest block mb-1">Nome Completo</label>
              <input 
                type="text" 
                required 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 p-3 text-sm text-white outline-none focus:border-[#00ff88]"
                placeholder="Seu nome"
              />
            </div>
          )}
          
          <div>
            <label className="text-[10px] text-[#888888] uppercase tracking-widest block mb-1">E-mail</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 p-3 text-sm text-white outline-none focus:border-[#00ff88]"
              placeholder="exemplo@parvus.com"
            />
          </div>

          <div>
            <label className="text-[10px] text-[#888888] uppercase tracking-widest block mb-1">Senha</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 p-3 text-sm text-white outline-none focus:border-[#00ff88]"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-[#00ff88] text-black font-bold text-sm tracking-tighter uppercase shadow-[0_0_15px_rgba(0,255,136,0.3)] hover:brightness-110 transition-all flex items-center justify-center disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? 'Entrar →' : 'Criar conta →')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs text-[#888888] hover:text-white transition-colors underline decoration-white/20 underline-offset-4"
          >
            {isLogin ? 'Não tem conta? Cadastre-se aqui' : 'Já tem conta? Entrar aqui'}
          </button>
        </div>
      </div>
    </div>
  );
}
