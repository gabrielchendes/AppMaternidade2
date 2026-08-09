# Registro de Alterações e Atualizações do Sistema (Changelog)

Este documento registra as melhorias e correções implementadas no sistema para acompanhamento do projeto.

---

## 📌 Resumo das Atualizações Recentes

### 1. 🛒 Central de Produtos & Mapeamento Hotmart
- **ID Hotmart Opcional no Cadastro:** Agora é possível cadastrar ou editar um produto na Central de Produtos sem informar o ID da Hotmart imediatamente (ficando marcado como `Pendente`). O ID pode ser preenchido posteriormente quando a oferta for criada na Hotmart.
- **Resolução de Conflitos de Upsert:** Ajustada a API `/api/v1/admin.ts` para salvar corretamente produtos com ID da Hotmart em branco sem violar restrições de chave única, utilizando o UUID interno do registro.
- **Layout Clean no Catálogo:** Removidas as tags duplicadas/poluídas de destino dos cards de produtos mapeados, mantendo uma visualização mais limpa com badges de tipo, preço e ID Hotmart.

### 2. 🤖 Assinatura IA Expert VIP (Ilimitada) & Gestão de Usuários
- **Padronização do Nome:** Atualizado o nome em todas as telas, Central de Produtos, seletores e e-mails de "IA Victoria VIP" para **IA Expert VIP (Ilimitada)**.
- **Bloqueio e Desbloqueio Bidirecional Definitivo:** Ajustada a ação de alteração de acesso no servidor (`/api/v1/admin.ts`). Ao liberar acesso, o servidor busca o perfil do usuário por ID e e-mail e atualiza `has_unlimited_ai = true` (criando o registro em `profiles` caso não exista) e registra a assinatura na tabela `purchases`. Ao revogar, define `has_unlimited_ai = false` e remove o registro correspondente. Ambas as operações de bloqueio e desbloqueio refletem instantaneamente no banco de dados e no chat.
- **Sincronização em Tempo Real Sem Depender do LocalStorage:** A validação do VIP agora consulta o Supabase ao abrir a modal ou enviar mensagem. O `localStorage` não é mais a fonte da decisão de acesso e é zerado na hora quando o acesso é revogado.
- **Re-fetch Automático no Dashboard:** O componente `Dashboard.tsx` atualiza o perfil do usuário no banco assim que a modal da IA é aberta, garantindo que qualquer reembolso reflita de forma instantânea na interface.
- **Correção da Liberação Manual de Usuários:** Corrigido a função `handleToggleUserUnlimitedAi` na aba Usuários do Painel Admin que causava o erro `response.json is not a function`. A liberação e revogação manual de acesso VIP funciona perfeitamente de forma instantânea.
- **Sanitização de Nomes na Central de Produtos:** Produtos da assinatura de IA são automaticamente exibidos e sincronizados no banco de dados como **IA Expert VIP (Ilimitada)**.

### 3. ⚡ Webhooks & Automação Hotmart
- **Centralização de Configuração:** Removida a seção duplicada de Webhook que ficava na aba de IA Expert, mantendo todas as configurações de Webhook e mapeamento de produtos organizadas e centralizadas na aba **Central de Produtos**.
- **Notificações e Logs:** O processamento de vendas no webhook (`/api/v1/hotmart-webhook.ts`) identifica automaticamente produtos do tipo `ai_subscription` e gera resumos limpos como `Assinatura IA Expert VIP ATIVADA / REVOGADA`.

---

## ❓ Preciso alterar algo no Supabase?

**NÃO é necessário fazer nenhuma alteração de estrutura no Supabase.**

1. **Estrutura de Tabelas:** Todas as colunas necessárias (`profiles.has_unlimited_ai`, `profiles.has_access`, `hotmart_products`, `app_settings`, `purchases`, `hotmart_events`) já existem no seu banco.
2. **Atualização da Edge Function (Opcional):** Caso você utilize a **Supabase Edge Function** (`/supabase/functions/hotmart-webhook`) diretamente no painel do Supabase, você pode rodar o comando `supabase functions deploy hotmart-webhook` se quiser que as mensagens de log no Supabase Deno utilizem os nomes mais recentes. Se utilizar o endpoint da API Node (`/api/v1/hotmart-webhook`), nada mais precisa ser feito!
