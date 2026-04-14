# Configuração do Supabase - Maternidade Premium

Copie e cole o código abaixo no **SQL Editor** do seu projeto Supabase para criar todas as tabelas, políticas e triggers necessárias.

```sql
-- 0. Tabela `tenants` (Multi-tenancy)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Tabela `app_settings` (Configurações Globais)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id BIGINT PRIMARY KEY DEFAULT 1,
    admin_email TEXT DEFAULT 'gabrielchendes@gmail.com',
    app_name TEXT DEFAULT 'Maternidade Premium',
    app_description TEXT DEFAULT 'Sua jornada na maternidade começa aqui.',
    primary_color TEXT DEFAULT '#ec4899',
    secondary_color TEXT DEFAULT '#be185d',
    logo_url TEXT,
    favicon_url TEXT,
    pwa_icon_url TEXT,
    support_whatsapp TEXT DEFAULT '5531997433488',
    support_email TEXT DEFAULT 'gabrielchendes@hotmail.com',
    auth_method TEXT DEFAULT 'passwordless',
    show_support_login BOOLEAN DEFAULT true,
    show_support_app BOOLEAN DEFAULT true,
    support_whatsapp_enabled BOOLEAN DEFAULT true,
    support_email_enabled BOOLEAN DEFAULT true,
    login_display_type TEXT DEFAULT 'title',
    custom_texts JSONB DEFAULT '{
        "auth.welcome": "Bem-vinda de volta!",
        "auth.subtitle": "Acesse sua área exclusiva para mamães",
        "community.title": "Comunidade",
        "community.subtitle": "Compartilhe sua jornada com outras mães",
        "courses.title": "Meus Cursos",
        "courses.subtitle": "Continue seu aprendizado"
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row CHECK (id = 1)
);

-- 2. Tabela `profiles` (Perfis de Usuário)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela `courses` (Cursos)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    price INTEGER DEFAULT 0,
    is_free BOOLEAN DEFAULT false,
    is_bonus BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    category TEXT,
    pdf_url TEXT,
    checkout_url TEXT,
    hotmart_product_id TEXT,
    tenant_id TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela `modules` (Módulos dos Cursos)
CREATE TABLE IF NOT EXISTS public.modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela `chapters` (Aulas/Capítulos)
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT CHECK (content_type IN ('video', 'pdf', 'text')),
    video_url TEXT,
    pdf_url TEXT,
    rich_text TEXT,
    duration_minutes INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    is_preview BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela `products` (Legado - para compatibilidade)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    price INTEGER DEFAULT 0,
    is_free BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    pdf_url TEXT,
    hotmart_product_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela `purchases` (Compras/Acessos)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    transaction_id TEXT,
    status TEXT DEFAULT 'approved',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabelas da Comunidade
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_email TEXT,
    user_avatar_url TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    reply_to_id UUID REFERENCES public.community_posts(id) ON DELETE SET NULL,
    reply_to_content TEXT,
    reply_to_user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_avatar_url TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela `notifications`
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tabela `push_tokens`
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    platform TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Tabela `user_progress`
CREATE TABLE IF NOT EXISTS public.user_progress (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT true,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, chapter_id)
);

-- ==========================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ==========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Políticas para tenants
CREATE POLICY "Permitir leitura pública de tenants" ON public.tenants FOR SELECT USING (true);

-- Função para verificar se o usuário é admin (baseado no email em app_settings)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (auth.jwt() ->> 'email' = admin_email)
    FROM public.app_settings
    WHERE id = 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para app_settings
CREATE POLICY "Permitir leitura para todos" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Apenas admin pode atualizar" ON public.app_settings FOR UPDATE USING (public.is_admin());

-- Políticas para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin pode ver todos os perfis" ON public.profiles FOR SELECT USING (public.is_admin());

-- Políticas para courses, modules, chapters
CREATE POLICY "Todos podem ver cursos ativos" ON public.courses FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admin total em cursos" ON public.courses FOR ALL USING (public.is_admin());
CREATE POLICY "Todos podem ver módulos" ON public.modules FOR SELECT USING (true);
CREATE POLICY "Admin total em módulos" ON public.modules FOR ALL USING (public.is_admin());
CREATE POLICY "Todos podem ver capítulos" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "Admin total em capítulos" ON public.chapters FOR ALL USING (public.is_admin());

-- Políticas para community_posts
CREATE POLICY "Todos podem ver posts" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Usuários autenticados podem postar" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Dono ou Admin pode deletar post" ON public.community_posts FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- Políticas para post_likes e post_comments
CREATE POLICY "Todos podem ver likes e comentários" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Todos podem ver comentários" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Usuários autenticados podem dar like" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários autenticados podem comentar" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Dono pode remover seu like" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- Políticas para purchases
CREATE POLICY "Usuários veem suas próprias compras" ON public.purchases FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admin total em compras" ON public.purchases FOR ALL USING (public.is_admin());

-- Políticas para user_progress
CREATE POLICY "Usuários gerenciam seu próprio progresso" ON public.user_progress FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- TRIGGERS PARA CONTADORES
-- ==========================================

-- Função para atualizar contagem de likes
CREATE OR REPLACE FUNCTION public.handle_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.community_posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_post_like AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.handle_post_likes_count();

-- Função para atualizar contagem de comentários
CREATE OR REPLACE FUNCTION public.handle_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.community_posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_post_comment AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.handle_post_comments_count();

-- Inserir tenant padrão
INSERT INTO public.tenants (name, subdomain, primary_color)
VALUES ('Maternidade Premium', 'app', '#ec4899')
ON CONFLICT (subdomain) DO NOTHING;

-- 12. Configuração de Buckets de Storage
-- Nota: Execute estes comandos se o seu projeto permitir criação de buckets via SQL, 
-- caso contrário, crie manualmente no painel do Supabase com os nomes abaixo.

INSERT INTO storage.buckets (id, name, public) VALUES ('course_content', 'course_content', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('course_covers', 'course_covers', true) ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Qualquer um pode ver conteúdo de cursos" ON storage.objects FOR SELECT USING (bucket_id IN ('course_content', 'course_covers'));
CREATE POLICY "Apenas admin pode fazer upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('course_content', 'course_covers') AND public.is_admin());
CREATE POLICY "Apenas admin pode deletar" ON storage.objects FOR DELETE USING (bucket_id IN ('course_content', 'course_covers') AND public.is_admin());
```
