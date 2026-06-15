-- =========================================================================
-- SUPER SCRIPT "NUKE": APAGANDO E RECRIANDO RLS DO ZERO (PENSAMENTO FORA DA CAIXA)
-- Como os nomes das policies podem estar diferentes no seu banco, 
-- esse script usa lógica dinâmica para VARRER DEMAIS e DELETAR TODAS AS POLÍTICAS 
-- da tabela `profiles`, `marketplace_purchases` e `marketplace_listings`.
-- Depois, ele aplica a MAIS SIMPLES e IMUNE versão de RLS baseada no Email do JWT.
-- Rode este exato código no SQL Editor.
-- =========================================================================

-- 1. DELETAR TODAS AS POLÍTICAS DINAMICAMENTE
DO $$ 
DECLARE 
    pol record;
BEGIN
    -- Limpar RLS de profiles
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;

    -- Limpar RLS de marketplace_purchases
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'marketplace_purchases'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.marketplace_purchases', pol.policyname);
    END LOOP;
    
    -- Limpar RLS de marketplace_listings
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'marketplace_listings'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.marketplace_listings', pol.policyname);
    END LOOP;
END $$;

-- 2. RECRIAR UMA ÚNICA POLÍTICA "DEUS" PARA A TABELA PROFILES (IMUNE A RECURSÃO MÁGICA)
-- Esta política não usa subquery, não chama função e não verifica outras tabelas.
-- O "FOR ALL" engloba: SELECT, INSERT, UPDATE e DELETE.
CREATE POLICY "God Mode Profile Policy" 
ON public.profiles FOR ALL 
USING (
  -- Se for o próprio usuário, beleza
  auth.uid() = id 
  OR 
  -- Lemos do JWT nativo do Supabase SEM tocar na tabela. Fim da recursão infinita (code 42P17)
  (current_setting('request.jwt.claims', true)::jsonb ->> 'email') = 'rehitutcontato@gmail.com'
)
WITH CHECK (
  auth.uid() = id 
  OR 
  (current_setting('request.jwt.claims', true)::jsonb ->> 'email') = 'rehitutcontato@gmail.com'
);

-- 3. RECRIAR RLS DO MARKETPLACE PURCHASES (VENDAS/COMPRAS)
CREATE POLICY "God Mode Purchases Policy" 
ON public.marketplace_purchases FOR ALL 
USING (
  auth.uid() = user_id 
  OR 
  (current_setting('request.jwt.claims', true)::jsonb ->> 'email') = 'rehitutcontato@gmail.com'
);

-- 4. RECRIAR RLS DO MARKETPLACE LISTINGS (ANÚNCIOS)
CREATE POLICY "God Mode Listings Policy" 
ON public.marketplace_listings FOR ALL 
USING (
  status = 'approved'
  OR 
  auth.uid() = creator_id
  OR 
  (current_setting('request.jwt.claims', true)::jsonb ->> 'email') = 'rehitutcontato@gmail.com'
);
