/**
 * Helper to extract or synthesize a production Supabase / PostgreSQL schema
 * with UUIDs, RLS policies, performance indexes, and triggers.
 */

export function extractOrGenerateSqlSchema(project: {
  titulo?: string;
  problema?: string;
  tipo?: string;
  nodeGerado?: any;
}): string {
  // 1. Try extracting ```sql block from readme_md or server_js
  if (project.nodeGerado?.readme_md) {
    const readme = project.nodeGerado.readme_md;
    const match = readme.match(/```sql([\s\S]*?)```/i);
    if (match && match[1] && match[1].trim().length > 80) {
      return match[1].trim();
    }
  }

  // 2. Synthesize a production-ready Supabase schema
  const cleanTitle = (project.titulo || 'automacao')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'parvus_system';

  const tableName = cleanTitle.length > 25 ? cleanTitle.substring(0, 25) : cleanTitle;

  return `-- ==============================================================================
-- SCHEMA SUPABASE & POSTGRESQL PARA PRODUÇÃO
-- Gerado por: Parvus Automate Enterprise Engine
-- Projeto: ${project.titulo || 'Sistema Automatizado'}
-- ==============================================================================

-- 1. EXTENSÕES RECOMENDADAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA PRINCIPAL DE DADOS: ${tableName}
CREATE TABLE IF NOT EXISTS public.${tableName} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'pendente', 'processando', 'concluido', 'erro', 'cancelado')),
    dados JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{"source": "parvus_automate", "version": "1.0"}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    valor_monetario NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. TABELA DE AUDITORIA E LOGS DE EVENTOS
CREATE TABLE IF NOT EXISTS public.${tableName}_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES public.${tableName}(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tipo_evento VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    origem VARCHAR(100) DEFAULT 'webhook',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. ÍNDICES DE ALTA PERFORMANCE (B-TREE & GIN PARA JSONB)
CREATE INDEX IF NOT EXISTS idx_${tableName}_user_id ON public.${tableName}(user_id);
CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON public.${tableName}(status);
CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON public.${tableName}(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_${tableName}_dados_gin ON public.${tableName} USING gin (dados);
CREATE INDEX IF NOT EXISTS idx_${tableName}_events_entity_id ON public.${tableName}_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_${tableName}_events_created_at ON public.${tableName}_events(created_at DESC);

-- 5. FUNÇÃO E TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_updated_at_${tableName} ON public.${tableName};
CREATE TRIGGER set_updated_at_${tableName}
    BEFORE UPDATE ON public.${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. POLÍTICAS DE SEGURANÇA ROW LEVEL SECURITY (RLS)
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.${tableName}_events ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Usuários autenticados acessam apenas seus registros
DROP POLICY IF EXISTS "Usuários autenticados podem ver seus próprios registros" ON public.${tableName};
CREATE POLICY "Usuários autenticados podem ver seus próprios registros"
    ON public.${tableName}
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Política de Inserção: O user_id deve ser o próprio do usuário autenticado
DROP POLICY IF EXISTS "Usuários podem criar registros para si mesmos" ON public.${tableName};
CREATE POLICY "Usuários podem criar registros para si mesmos"
    ON public.${tableName}
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Política de Atualização
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios registros" ON public.${tableName};
CREATE POLICY "Usuários podem atualizar seus próprios registros"
    ON public.${tableName}
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Política de Exclusão
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios registros" ON public.${tableName};
CREATE POLICY "Usuários podem deletar seus próprios registros"
    ON public.${tableName}
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Acesso aos logs de auditoria
DROP POLICY IF EXISTS "Usuários podem visualizar eventos de seus registros" ON public.${tableName}_events;
CREATE POLICY "Usuários podem visualizar eventos de seus registros"
    ON public.${tableName}_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.${tableName} t
            WHERE t.id = entity_id AND t.user_id = auth.uid()
        )
    );

-- 7. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON TABLE public.${tableName} IS 'Tabela core do microsserviço gerado pela Parvus Automate.';
COMMENT ON TABLE public.${tableName}_events IS 'Log histórico e audit trail de transações e webhooks.';
`;
}
