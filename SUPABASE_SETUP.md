# Configuração do Supabase

Para que o aplicativo funcione, você precisa criar as seguintes tabelas no seu projeto Supabase:

## 1. Tabela `products`
```sql
create table products (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  cover_url text,
  pdf_url text,
  price integer default 9700,
  is_free boolean default false,
  is_active boolean default true,
  is_bonus boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

## 2. Tabela `purchases`
```sql
create table purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, product_id)
);
```

## 3. Storage
Crie um bucket chamado `contents` e torne-o público para leitura ou configure políticas de RLS.
Para este app, assumimos que os PDFs estão no bucket `contents`.

## 4. Políticas de Segurança (RLS)
Habilite o RLS nas tabelas e execute estes comandos:

```sql
-- Habilitar RLS
alter table products enable row level security;
alter table purchases enable row level security;

-- Política para produtos (Leitura pública)
create policy "Produtos são visíveis para todos"
on products for select
using (true);

-- Política para compras (Usuários leem apenas suas próprias compras)
create policy "Usuários podem ver suas próprias compras"
on purchases for select
to authenticated
using (auth.uid() = user_id);

-- 3. Tabela `community_posts`
create table community_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  user_name text,
  content text not null,
  image_url text,
  likes_count integer default 0,
  comments_count integer default 0,
  reply_to_id uuid references community_posts(id) on delete set null,
  reply_to_content text,
  reply_to_user_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabela `post_likes`
create table post_likes (
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references community_posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, post_id)
);

-- 5. Tabela `post_comments`
create table post_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_name text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table community_posts enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;

-- Políticas para posts
create policy "Posts são visíveis para todos" on community_posts for select using (true);
create policy "Usuários podem inserir seus próprios posts" on community_posts for insert to authenticated with check (auth.uid() = user_id);
create policy "Usuários podem deletar seus próprios posts" on community_posts for delete to authenticated using (auth.uid() = user_id);

-- Políticas para likes
create policy "Likes são visíveis para todos" on post_likes for select using (true);
create policy "Usuários podem dar like" on post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "Usuários podem remover like" on post_likes for delete to authenticated using (auth.uid() = user_id);

-- Políticas para comentários
create policy "Comentários são visíveis para todos" on post_comments for select using (true);
create policy "Usuários podem comentar" on post_comments for insert to authenticated with check (auth.uid() = user_id);
create policy "Usuários podem deletar seus próprios comentários" on post_comments for delete to authenticated using (auth.uid() = user_id);

-- 6. Triggers para Contagem Automática (IMPORTANTE - VERSÃO CORRIGIDA)
-- Execute este SQL para garantir que as colunas existam e os contadores funcionem

-- Garantir que as colunas existam (caso a tabela tenha sido criada antes)
do $$ 
begin
  if not exists (select from pg_attribute where attrelid = 'public.community_posts'::regclass and attname = 'likes_count') then
    alter table public.community_posts add column likes_count integer default 0;
  end if;
  if not exists (select from pg_attribute where attrelid = 'public.community_posts'::regclass and attname = 'comments_count') then
    alter table public.community_posts add column comments_count integer default 0;
  end if;
end $$;

-- Função para atualizar contagem de curtidas
create or replace function handle_post_likes_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update community_posts set likes_count = coalesce(likes_count, 0) + 1 where id = new.post_id;
  elsif (TG_OP = 'DELETE') then
    -- Só atualiza se o post ainda existir (evita erro no delete cascade do post)
    update community_posts set likes_count = greatest(0, coalesce(likes_count, 0) - 1) where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- Trigger para curtidas
drop trigger if exists on_post_like on post_likes;
create trigger on_post_like
after insert or delete on post_likes
for each row execute function handle_post_likes_count();

-- Função para atualizar contagem de comentários
create or replace function handle_post_comments_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update community_posts set comments_count = coalesce(comments_count, 0) + 1 where id = new.post_id;
  elsif (TG_OP = 'DELETE') then
    -- Só atualiza se o post ainda existir (evita erro no delete cascade do post)
    update community_posts set comments_count = greatest(0, coalesce(comments_count, 0) - 1) where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- Trigger para comentários
drop trigger if exists on_post_comment on post_comments;
create trigger on_post_comment
after insert or delete on post_comments
for each row execute function handle_post_comments_count();

-- 7. Storage (Imagens da Comunidade)
-- Crie o bucket manualmente no painel do Supabase chamado `community_images` e torne-o público.
-- Ou execute este SQL para configurar as permissões (ajuste se necessário):

create policy "Imagens da comunidade são públicas"
on storage.objects for select
using ( bucket_id = 'community_images' );

create policy "Usuários autenticados podem fazer upload de imagens"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'community_images' );

create policy "Usuários podem deletar suas próprias imagens"
on storage.objects for delete
to authenticated
using ( bucket_id = 'community_images' AND (storage.foldername(name))[1] = auth.uid()::text );

-- 7. Storage (Avatares de Perfil)
-- Crie o bucket manualmente no painel do Supabase chamado `avatars` e torne-o público.

create policy "Avatares são públicos"
on storage.objects for select
using ( bucket_id = 'avatars' );

create policy "Usuários podem fazer upload de seu próprio avatar"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'avatars' );

create policy "Usuários podem atualizar seu próprio avatar"
on storage.objects for update
to authenticated
using ( bucket_id = 'avatars' );

-- 9. Tabela `notifications`
create table notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Tabela `push_tokens`
create table push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, token)
);

-- Habilitar RLS
alter table notifications enable row level security;
alter table push_tokens enable row level security;

-- Políticas para notificações
create policy "Usuários podem ver suas próprias notificações" on notifications for select to authenticated using (auth.uid() = user_id);
create policy "Usuários podem atualizar suas próprias notificações" on notifications for update to authenticated using (auth.uid() = user_id);

-- Políticas para push_tokens
create policy "Usuários podem gerenciar seus próprios tokens" on push_tokens for all to authenticated using (auth.uid() = user_id);



-- Trigger para criar perfil automaticamente no signup
create or replace function public.handle_new_user()
returns trigger as $$
begin

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 12. Políticas de Administrador (Ajuste o email conforme necessário)
-- Substitua 'gabrielchendes@gmail.com' pelo seu email de admin real

-- Admin pode gerenciar produtos
create policy "Admin pode gerenciar produtos" on products for all to authenticated 
using (auth.jwt() ->> 'email' = 'gabrielchendes@gmail.com');

-- Admin pode deletar qualquer post
create policy "Admin pode deletar qualquer post" on community_posts for delete to authenticated 
using (auth.jwt() ->> 'email' = 'gabrielchendes@gmail.com');

-- Admin pode deletar qualquer comentário
create policy "Admin pode deletar qualquer comentário" on post_comments for delete to authenticated 
using (auth.jwt() ->> 'email' = 'gabrielchendes@gmail.com');

-- Admin pode enviar notificações para qualquer um
create policy "Admin pode gerenciar todas as notificações" on notifications for all to authenticated 
using (auth.jwt() ->> 'email' = 'gabrielchendes@gmail.com');

-- Admin pode ver todos os tokens (para broadcast)
create policy "Admin pode ver todos os tokens" on push_tokens for select to authenticated 
using (auth.jwt() ->> 'email' = 'gabrielchendes@gmail.com');

-- 13. Tabela `app_settings`
-- Esta tabela armazena as configurações globais do SaaS (Nome, Cores, Logo, etc.)
create table app_settings (
  id integer primary key default 1,
  app_name text default 'Maternidade Premium',
  app_description text default 'Acesse sua área exclusiva',
  primary_color text default '#ec4899',
  secondary_color text default '#be185d',
  logo_url text,
  favicon_url text,
  pwa_icon_url text,
  support_whatsapp text default '5531997433488',
  support_email text default 'gabrielchendes@hotmail.com',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint one_row check (id = 1)
);

-- Inserir valores padrão
insert into app_settings (id, app_name) values (1, 'Maternidade Premium') on conflict (id) do nothing;

-- Habilitar RLS
alter table app_settings enable row level security;

-- Política de Leitura Pública
create policy "Configurações são visíveis para todos" on app_settings for select using (true);

-- Política de Escrita para Admin
create policy "Admin pode gerenciar configurações" on app_settings for all to authenticated 
using (auth.jwt() ->> 'email' = 'gabrielchendes@gmail.com');

Execute este SQL para criar alguns produtos de exemplo:

```sql
insert into products (title, description, cover_url, pdf_url, price, is_free)
values 
('Guia do Recém-Nascido', 'Tudo o que você precisa saber sobre os primeiros 30 dias do seu bebê.', 'https://picsum.photos/seed/baby1/800/450', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 9700, false),
('Amamentação Sem Dor', 'Técnicas e dicas para uma amamentação tranquila e prazerosa.', 'https://picsum.photos/seed/baby2/800/450', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 14700, false),
('Sono do Bebê', 'Métodos gentis para ajudar seu bebê a dormir a noite toda.', 'https://picsum.photos/seed/baby3/800/450', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 19700, false),
('Introdução Alimentar', 'Receitas e orientações para a transição para alimentos sólidos.', 'https://picsum.photos/seed/baby4/800/450', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 8700, false),
('E-book Gratuito: Primeiros Passos', 'Um guia rápido para começar sua jornada na maternidade.', 'https://picsum.photos/seed/baby5/800/450', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 0, true);
```
