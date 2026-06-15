export async function checkGenerationLimit(userId: string, supabaseClient: any) {
  try {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('plano, geracoes_usadas_mes, geracoes_limite, mes_referencia, is_admin')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Retorno padrão caso perfil não exista
        return { allowed: false, usedThisMonth: 0, limit: 0, plan: 'free', remaining: 0 };
      }
      throw error;
    }

    // fallback user (dono original rehitut)
    const { data: userData } = await supabaseClient.auth.getUser();
    const isHardcodedAdmin = userData?.user?.email === 'rehitutcontato@gmail.com';

    // Se é admin: sem limite
    if (profile.plano === 'admin' || profile.is_admin || isHardcodedAdmin) {
      // Força sync do plano para 'admin' no banco para evitar inconsistências
      if (profile.plano !== 'admin') {
        await supabaseClient.from('profiles').update({ plano: 'admin', geracoes_limite: 999999 }).eq('id', userId);
      }
      return { allowed: true, usedThisMonth: profile.geracoes_usadas_mes || 0, limit: 999999, plan: 'admin', remaining: 999999 };
    }

    // Verificar se mudou de mês
    const mesAtual = new Date().toISOString().slice(0, 7);
    if (profile.mes_referencia !== mesAtual) {
      // Reset
      await supabaseClient
        .from('profiles')
        .update({
          geracoes_usadas_mes: 0,
          mes_referencia: mesAtual,
        })
        .eq('id', userId);
      
      profile.geracoes_usadas_mes = 0;
    }

    // O limite padrão para contas free normalmente é 0. O profile pode vir sem essas colunas recém-criadas.
    const limiteSeguro = typeof profile.geracoes_limite === 'number' ? profile.geracoes_limite : 0;
    const usadasSeguras = typeof profile.geracoes_usadas_mes === 'number' ? profile.geracoes_usadas_mes : 0;

    // Verificar limite
    const allowed = usadasSeguras < limiteSeguro;
    const remaining = Math.max(0, limiteSeguro - usadasSeguras);

    return {
      allowed,
      usedThisMonth: usadasSeguras,
      limit: limiteSeguro,
      plan: profile.plano || 'free',
      remaining,
    };
  } catch (error) {
    console.error('Erro ao verificar limite:', error);
    return { allowed: false, usedThisMonth: 0, limit: 0, plan: 'free', remaining: 0 };
  }
}

export async function incrementGenerationCount(userId: string, supabaseClient: any) {
  try {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('geracoes_usadas_mes')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const currentUsed = typeof profile.geracoes_usadas_mes === 'number' ? profile.geracoes_usadas_mes : 0;

    await supabaseClient
      .from('profiles')
      .update({ geracoes_usadas_mes: currentUsed + 1 })
      .eq('id', userId);
  } catch (error) {
    console.error('Erro ao incrementar geração:', error);
  }
}
