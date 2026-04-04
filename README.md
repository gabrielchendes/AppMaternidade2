# Maternidade Premium - PWA Netflix Style

Este é um aplicativo web progressivo (PWA) moderno e elegante para uma área de membros de infoprodutos de maternidade.

## Tecnologias Utilizadas
- **Frontend:** React, Tailwind CSS, Motion (animações), Lucide React (ícones).
- **Backend:** Supabase (Autenticação, Banco de Dados, Storage).
- **PWA:** Service Workers e Manifest para instalação na tela inicial.

## Como Conectar com o Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. Execute os comandos SQL presentes no arquivo `SUPABASE_SETUP.md` no Editor SQL do seu painel Supabase.
3. No painel do Supabase, vá em **Project Settings > API** e copie a `URL` e a `anon key`.
4. Crie um arquivo `.env` na raiz do projeto (ou adicione as variáveis no AI Studio) com:
   ```env
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
   ```

## Como Rodar Localmente

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Como Fazer Deploy (Cloudflare Pages)

1. Conecte seu repositório GitHub ao Cloudflare Pages.
2. Configure o comando de build: `npm run build`.
3. Configure o diretório de saída: `dist`.
4. Adicione as variáveis de ambiente (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) nas configurações do projeto no Cloudflare.

## Estrutura do Projeto
- `/src/components`: Componentes reutilizáveis (Navbar, Card, Carousel).
- `/src/pages`: Telas principais (Login, Dashboard).
- `/src/lib`: Configurações do Supabase e utilitários.
- `/public`: Manifest, Service Worker e ícones.
