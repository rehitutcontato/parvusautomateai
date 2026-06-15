-- ==========================================
-- SCRIPT DEFINITIVO DE CORREÇÃO: RECURSÃO INFINITA (RLS)
-- Copie este código e rode no SQL Editor do Supabase.
-- ==========================================

-- 1. DELETAR TODAS AS POLÍTICAS PROBLEMÁTICAS
-- Vamos limpar as políticas antigas de profiles para garantir que a recursão suma.
DROP POLICY IF EXISTS "Admin visualiza todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admin edita todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Visualização do próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Atualização do próprio perfil" ON public.profiles;

-- 2. FUNÇÃO DEUS (GOD MODE) BASEADA NO EMAIL DO JWT
-- Isso lê o email direto do token de autenticação, SEM FAZER SELECT NA TABELA PROFILES!
-- Isso acaba com o erro 42P17 (Infinite Recursion) de uma vez por todas.
CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS BOOLEAN AS $$
DECLARE
  jwt_email text;
BEGIN
  -- Tenta pegar o email do JWT atual
  jwt_email := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
  
  -- Se for o email mestre, tem acesso a TUDO
  IF jwt_email = 'rehitutcontato@gmail.com' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 3. RECRIAR AS POLÍTICAS DE PROFILES DE FORMA SEGURA
-- O usuário vê e edita o próprio perfil; o ADMIN (você) vê e edita de todo mundo.
CREATE POLICY "Visualizar profiles" 
  ON public.profiles FOR SELECT 
  USING ( auth.uid() = id OR public.is_admin_jwt() );

CREATE POLICY "Editar profiles" 
  ON public.profiles FOR UPDATE 
  USING ( auth.uid() = id OR public.is_admin_jwt() );

-- Garante que o trigger pode inserir perfis novos:
DROP POLICY IF EXISTS "Inserir profiles" ON public.profiles;
CREATE POLICY "Inserir profiles" 
  ON public.profiles FOR INSERT 
  WITH CHECK ( auth.uid() = id );

-- Garante que o admin possa deletar perfis
DROP POLICY IF EXISTS "Deletar profiles" ON public.profiles;
CREATE POLICY "Deletar profiles" 
  ON public.profiles FOR DELETE 
  USING ( auth.uid() = id OR public.is_admin_jwt() );

-- 4. GARANTIR QUE SEU EMAIL SEMPRE SEJA ADMIN AO CRIAR A CONTA (TRIGGER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, plano, geracoes_limite, is_admin)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'nome', 'Novo Usuário'), 
    CASE WHEN new.email = 'rehitutcontato@gmail.com' THEN 'admin' ELSE 'free' END, 
    CASE WHEN new.email = 'rehitutcontato@gmail.com' THEN 999999 ELSE 0 END,
    CASE WHEN new.email = 'rehitutcontato@gmail.com' THEN true ELSE false END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. ATUALIZAR AS OUTRAS TABELAS PARA ACEITAR O DEUS (rehitutcontato)
DROP POLICY IF EXISTS "Apenas admin atualiza compras" ON public.marketplace_purchases;
CREATE POLICY "Apenas admin atualiza compras"
  ON public.marketplace_purchases FOR UPDATE
  USING ( public.is_admin_jwt() );

DROP POLICY IF EXISTS "Admin ou dono visualizam compras" ON public.marketplace_purchases;
CREATE POLICY "Admin ou dono visualizam compras"
  ON public.marketplace_purchases FOR SELECT
  USING ( auth.uid() = user_id OR public.is_admin_jwt() );

DROP POLICY IF EXISTS "Apenas admin atualiza listings" ON public.marketplace_listings;
CREATE POLICY "Apenas admin atualiza listings"
  ON public.marketplace_listings FOR UPDATE
  USING ( public.is_admin_jwt() );

DROP POLICY IF EXISTS "Admin visualiza todos os listings" ON public.marketplace_listings;
CREATE POLICY "Admin visualiza todos os listings"
  ON public.marketplace_listings FOR SELECT
  USING ( status = 'approved' OR auth.uid() = creator_id OR public.is_admin_jwt() );

DROP POLICY IF EXISTS "Admin visualiza todos os projetos" ON public.projects;
CREATE POLICY "Admin visualiza todos os projetos"
  ON public.projects FOR SELECT
  USING ( auth.uid() = user_id OR public.is_admin_jwt() );

DROP POLICY IF EXISTS "Admin visualiza todos os workflows" ON workflows;
CREATE POLICY "Admin visualiza todos os workflows"
  ON workflows FOR SELECT
  USING ( auth.uid() = user_id OR public.is_admin_jwt() );
