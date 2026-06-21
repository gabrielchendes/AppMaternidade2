/**
 * CONFIGURAÇÃO DO CLOUDFLARE WORKER PARA WEBHOOK DA HOTMART
 * 
 * Este arquivo contém o código pronto para ser implantado no Cloudflare Workers.
 * Ele integra a Hotmart diretamente com o seu banco de dados Supabase utilizando
 * chamadas de API nativas com o Token de Serviço Administrativo do Supabase.
 * 
 * --- COMO USAR ---
 * 1. Crie um novo Worker no painel do Cloudflare (Workers & Pages).
 * 2. Cole este código no editor do Worker.
 * 3. Vá em "Settings" -> "Variables" no seu Cloudflare Worker e adicione as seguintes variáveis de ambiente:
 *    - SUPABASE_URL: URL do seu projeto do Supabase (ex: https://xxxx.supabase.co)
 *    - SUPABASE_SERVICE_ROLE_KEY: Sua chave de Service Role (que tem privilégios de Admin para criar/excluir usuários)
 *    - HOTMART_TOKEN: Token de segurança configurado na Hotmart (opcional, mas altamente recomendado)
 * 4. Salve e implante o Worker.
 * 5. Configure a URL do Worker (ex: https://seu-worker.seu-subdominio.workers.dev) no painel de Webhooks da Hotmart.
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-client-info, apikey, authorization',
    };

    // Resposta de pré-verificação do navegador (CORS Preflight)
    if (request.method === 'OPTIONS') {
      return new Response('OK', { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido. Utilize POST.' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const { event, data, hottok } = body;

      // 1. Validação do Token de Segurança da Hotmart
      if (env.HOTMART_TOKEN && hottok !== env.HOTMART_TOKEN) {
        console.error('Token de segurança da Hotmart incorreto ou inválido.');
        return new Response(JSON.stringify({ error: 'Não autorizado. Token inválido.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const email = (data?.buyer?.email || data?.subscriber?.email || '').trim().toLowerCase();
      const hotmartProductId = data?.product?.id?.toString();
      const fullName = (data?.buyer?.name || data?.subscriber?.name || 'Aluna Premium').trim();

      console.log(`Recebendo evento ${event} para o e-mail: ${email} e produto original: ${hotmartProductId}`);

      if (!email || !hotmartProductId) {
        return new Response(JSON.stringify({ error: 'Dados obrigatórios ausentes (e-mail ou ID do produto).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Limpa e resolve a URL base do Supabase (impede duplicações se o usuário configurou com '/rest/v1')
      let supabaseUrl = (env.SUPABASE_URL || '').trim().replace(/\/$/, '');
      if (supabaseUrl.endsWith('/rest/v1')) {
        supabaseUrl = supabaseUrl.slice(0, -8);
      }
      supabaseUrl = supabaseUrl.replace(/\/$/, '');

      const adminHeaders = {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      };

      // 2. Busca de Configuração Global
      // Obtém o "main_course_hotmart_id" diretamente no app_settings (ID 1) - Sem buscar custom_texts por padrão para máxima eficiência
      let mainProductId = '';
      let debugFetchError = null;
      let debugFallbackError = null;
      let directResStatus = null;
      let fallbackResStatus = null;
      let settingsObjRaw = null;

      try {
        let settingsRes = await fetch(`${supabaseUrl}/rest/v1/app_settings?id=eq.1&select=main_course_hotmart_id`, { headers: adminHeaders });
        directResStatus = settingsRes.status;
        
        if (settingsRes.ok) {
          let settingsData = await settingsRes.json();
          settingsObjRaw = settingsData;
          
          // Se não achar ID=1, tenta buscar sem filtro de ID para máxima resiliência (por exemplo, se o ID for diferente)
          if (settingsData.length === 0) {
            console.log('Aviso: Nenhum registro de app_settings com ID = 1 foi retornado. Tentando buscar o primeiro registro disponível...');
            const settingsResAll = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=main_course_hotmart_id&limit=1`, { headers: adminHeaders });
            if (settingsResAll.ok) {
              settingsData = await settingsResAll.json();
              settingsObjRaw = settingsData;
            }
          }

          const settingsObj = settingsData[0] || {};
          const mainRaw = settingsObj.main_course_hotmart_id;
          mainProductId = (mainRaw !== null && mainRaw !== undefined) ? mainRaw.toString().trim() : '';
        } else {
          console.warn(`Aviso: Falha na busca direta de main_course_hotmart_id (status ${settingsRes.status}). Possível ausência da coluna. Fazendo fallback para custom_texts...`);
          debugFetchError = `Status ${settingsRes.status}`;
        }
      } catch (err) {
        console.error('Erro na requisição direta de app_settings:', err.message);
        debugFetchError = err.message;
      }

      // Fallback resiliente: se der vazio ou der erro na busca direta da coluna, busca dinamicamente de custom_texts
      if (mainProductId === '') {
        try {
          let fallbackRes = await fetch(`${supabaseUrl}/rest/v1/app_settings?id=eq.1&select=custom_texts`, { headers: adminHeaders });
          fallbackResStatus = fallbackRes.status;
          
          if (fallbackRes.ok) {
            let fallbackData = await fallbackRes.json();
            
            // Backup query se não encontrar ID=1
            if (fallbackData.length === 0) {
              const fallbackResAll = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=custom_texts&limit=1`, { headers: adminHeaders });
              if (fallbackResAll.ok) {
                fallbackData = await fallbackResAll.json();
              }
            }

            const fallbackObj = fallbackData[0]?.custom_texts || {};
            mainProductId = (fallbackObj['main_product_id'] || '').trim();
            console.log(`Fallback bem-sucedido! ID recuperado de custom_texts: ${mainProductId}`);
          } else {
            debugFallbackError = `Status ${fallbackRes.status}`;
          }
        } catch (fbErr) {
          console.error('Falha no fallback de custom_texts:', fbErr.message);
          debugFallbackError = fbErr.message;
        }
      }

      const resolvedProductId = hotmartProductId;
      const hotmartProductName = (data?.product?.name || '').trim();
      console.log(`ID do Produto Recebido: ${resolvedProductId}, Nome: ${hotmartProductName}`);

      let targetIds = [];
      let isMainCourse = false;

      // Se bater com o Produto Principal configurado globalmente OR se for o ID '0' de sandbox/teste da Hotmart e a tabela app_settings não puder ser lida ou for zero
      let isMainProductMatch = (mainProductId !== '' && resolvedProductId === mainProductId) || 
                               (resolvedProductId === '0' && (mainProductId === '' || mainProductId === '0'));

      // Se for teste com ID '0' mas possuímos nome do produto, tentamos encontrar um curso ou pacote correspondente antes de assumir o produto principal!
      let resolvedByTestName = false;
      if (resolvedProductId === '0' && hotmartProductName !== '') {
        try {
          // 1. Busca se há pacote com este nome
          const pkgRes = await fetch(`${supabaseUrl}/rest/v1/course_packages?title=ilike.${encodeURIComponent(hotmartProductName)}&select=id,package_courses(course_id)`, { headers: adminHeaders });
          if (pkgRes.ok) {
            const pkgData = await pkgRes.json();
            const pkg = pkgData[0];
            if (pkg) {
              const coursesInPkg = pkg.package_courses?.map(pc => pc.course_id) || [];
              targetIds = [pkg.id, ...coursesInPkg];
              resolvedByTestName = true;
              isMainProductMatch = false;
              console.log(`[TESTE ID 0] Produto identificado por NOME como pacote: ${pkg.id}`);
            }
          }

          // 2. Se não achou pacote, busca se há curso com este nome
          if (!resolvedByTestName) {
            const courseRes = await fetch(`${supabaseUrl}/rest/v1/courses?title=ilike.${encodeURIComponent(hotmartProductName)}&select=id,linked_package_id`, { headers: adminHeaders });
            if (courseRes.ok) {
              const courseData = await courseRes.json();
              const course = courseData[0];
              if (course) {
                if (course.linked_package_id) {
                  const linkedPkgRes = await fetch(`${supabaseUrl}/rest/v1/course_packages?id=eq.${course.linked_package_id}&select=id,package_courses(course_id)`, { headers: adminHeaders });
                  if (linkedPkgRes.ok) {
                    const linkedPkgData = await linkedPkgRes.json();
                    const linkedPkg = linkedPkgData[0];
                    if (linkedPkg) {
                      const coursesInPkg = linkedPkg.package_courses?.map(pc => pc.course_id) || [];
                      targetIds = [linkedPkg.id, ...coursesInPkg];
                    } else {
                      targetIds = [course.id];
                    }
                  } else {
                    targetIds = [course.id];
                  }
                } else {
                  targetIds = [course.id];
                }
                resolvedByTestName = true;
                isMainProductMatch = false;
                console.log(`[TESTE ID 0] Produto identificado por NOME como curso individual: ${course.id}`);
              }
            }
          }
        } catch (err) {
          console.error('Erro ao mapear produto de teste por nome no worker:', err.message);
        }
      }

      if (isMainProductMatch) {
        // Se bater com o Produto Principal configurado globalmente ou for teste com ID 0
        isMainCourse = true;
        
        // Buscamos o UUID do curso principal real no Supabase (is_free = true, is_bonus = false)
        const courseRes = await fetch(`${supabaseUrl}/rest/v1/courses?is_free=eq.true&is_bonus=eq.false&select=id`, { headers: adminHeaders });
        const courseData = await courseRes.json();
        const mainCourse = courseData && courseData[0];
        
        if (mainCourse && mainCourse.id) {
          targetIds = [mainCourse.id];
          console.log(`Produto principal identificado (ID: ${resolvedProductId}). Mapeado para o UUID do curso principal correspondente no Supabase: ${mainCourse.id}`);
        } else {
          // Fallback resiliente: se não achar o curso principal exato com is_free=true & is_bonus=false, busca qualquer curso disponível
          const backupCourseRes = await fetch(`${supabaseUrl}/rest/v1/courses?select=id&limit=1`, { headers: adminHeaders });
          const backupCourseData = await backupCourseRes.json();
          const backupCourse = backupCourseData && backupCourseData[0];
          
          if (backupCourse && backupCourse.id) {
            targetIds = [backupCourse.id];
            console.log(`Aviso: Curso principal (is_free=true, is_bonus=false) não encontrado no Supabase. Utilizando primeiro curso disponível como fallback: ${backupCourse.id}`);
          } else {
            targetIds = [resolvedProductId];
            console.log(`Aviso: Nenhum curso encontrado no Supabase para mapeamento de fallback.`);
          }
        }
      } else {
        // Caso não seja o produto principal global, mapeamos pacotes e cursos individuais
        
        // A) Verifica se é um pacote diretamente
        const pkgRes = await fetch(`${supabaseUrl}/rest/v1/course_packages?hotmart_product_id=eq.${resolvedProductId}&select=id,package_courses(course_id)`, { headers: adminHeaders });
        const pkgData = await pkgRes.json();
        const pkg = pkgData[0];

        if (pkg) {
          const coursesInPkg = pkg.package_courses?.map(pc => pc.course_id) || [];
          targetIds = [pkg.id, ...coursesInPkg];
          console.log(`Produto mapeado como pacote no banco. ID pacote: ${pkg.id}, expandido para ${targetIds.length} itens.`);
        } else {
          // B) Se não for pacote, verifica se é um curso individual
          const courseRes = await fetch(`${supabaseUrl}/rest/v1/courses?hotmart_product_id=eq.${resolvedProductId}&select=id,linked_package_id`, { headers: adminHeaders });
          const courseData = await courseRes.json();
          const course = courseData[0];

          if (course) {
            if (course.linked_package_id) {
              // Se tiver um pacote vinculado, libera o pacote Inteiro e todos os seus cursos também!
              const linkedPkgRes = await fetch(`${supabaseUrl}/rest/v1/course_packages?id=eq.${course.linked_package_id}&select=id,package_courses(course_id)`, { headers: adminHeaders });
              const linkedPkgData = await linkedPkgRes.json();
              const linkedPkg = linkedPkgData[0];

              if (linkedPkg) {
                const coursesInPkg = linkedPkg.package_courses?.map(pc => pc.course_id) || [];
                targetIds = [linkedPkg.id, ...coursesInPkg];
                console.log(`Produto mapeado como curso individual vinculado ao pacote ${linkedPkg.id}. Expandido para liberar o pacote completo.`);
              } else {
                targetIds = [course.id];
              }
            } else {
              targetIds = [course.id];
            }
          }
        }
      }

      // Se não mapeou nenhum ID de produto correspondente
      if (targetIds.length === 0) {
        console.error(`Produto Hotmart ID ${resolvedProductId} não mapeado no Banco de Dados.`);
        return new Response(JSON.stringify({ 
          error: `Produto Hotmart ID ${resolvedProductId} não mapeado no painel administrativo.`,
          debug: {
            resolvedProductId: resolvedProductId,
            mainProductId: mainProductId,
            mainProductIdType: typeof mainProductId,
            hasMainProductMatch: (mainProductId !== '' && resolvedProductId === mainProductId),
            isMainProductIdEmpty: (mainProductId === ''),
            directResStatus: directResStatus,
            settingsObjRaw: settingsObjRaw,
            debugFetchError: debugFetchError,
            fallbackResStatus: fallbackResStatus,
            debugFallbackError: debugFallbackError
          }
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      // 3. Verifica ou Cria o Usuário no Supabase Auth
      const cleanEmail = email.trim().toLowerCase();
      const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${cleanEmail}&select=id`, { headers: adminHeaders });
      const profiles = await profileRes.json();
      let userId = profiles[0]?.id;

      if (!userId) {
        // Tenta busca case-insensitive usando ilike para máxima resiliência
        const profileResIlike = await fetch(`${supabaseUrl}/rest/v1/profiles?email=ilike.${cleanEmail}&select=id`, { headers: adminHeaders });
        if (profileResIlike.ok) {
          const profilesIlike = await profileResIlike.json();
          userId = profilesIlike[0]?.id;
          if (userId) {
            console.log(`Usuário encontrado via busca case-insensitive (ilike) em profiles: ${userId}`);
          }
        }
      }

      if (!userId) {
        console.log(`Usuário não encontrado em profiles para o e-mail: ${cleanEmail}. Criando uma nova conta ou buscando no Auth...`);
        
        const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            email: cleanEmail,
            email_confirm: true,
            user_metadata: { full_name: fullName, is_auto_created: true }
          })
        });
        
        const rawResText = await createUserRes.text();
        let createdUserData = {};
        try {
          createdUserData = JSON.parse(rawResText);
        } catch (e) {}
        
        if (createUserRes.ok && (createdUserData.id || createdUserData.user?.id)) {
          userId = createdUserData.id || createdUserData.user?.id;
          console.log(`Nova conta de usuária criada com sucesso. UID: ${userId}`);
        } else {
          // Se a criação falhou, pode ser que o usuário já exista no Auth (só não tinha registro em profiles)
          console.warn(`Aviso: Falha ao criar usuário diretamente (Status ${createUserRes.status}). Tentando resgatar ID de conta existente no Auth... Info: ${rawResText}`);
          
          try {
            const listUsersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
              method: 'GET',
              headers: adminHeaders
            });
            
            if (listUsersRes.ok) {
              const listData = await listUsersRes.json();
              const usersArray = listData.users || (Array.isArray(listData) ? listData : []);
              const existingUser = usersArray.find(u => u.email?.toLowerCase() === cleanEmail);
              
              if (existingUser && existingUser.id) {
                userId = existingUser.id;
                console.log(`Usuário existente encontrado no Auth por varredura. UID recuperado: ${userId}`);
              }
            }
          } catch (listErr) {
            console.error(`Erro ao varrer lista de usuários no Auth:`, listErr.message);
          }
        }
        
        if (!userId) {
          const errMsg = createdUserData.msg || createdUserData.message || createdUserData.error?.message || createdUserData.error_description || rawResText;
          throw new Error(`Falha ao criar usuário administrativo no Supabase: ${errMsg}`);
        }
      }

      // Sincroniza/Garante que o registro na tabela public.profiles exista para este userId do Auth (evita erro na FK de purchases)
      if (userId) {
        console.log(`Garantindo a existência do perfil para o UID: ${userId}`);
        const profileUpsertRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
          method: 'POST',
          headers: {
            ...adminHeaders,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            id: userId,
            email: cleanEmail,
            full_name: fullName || 'Aluna Premium',
            has_access: true
          })
        });
        console.log(`Sincronização do perfil concluída (Status: ${profileUpsertRes.status})`);
      }

      // 4. Trata Ativação vs Cancelamento
      const isGrant = event === 'PURCHASE_APPROVED' || event === 'PURCHASE_COMPLETE';
      const isRevoke = [
        'PURCHASE_REFUNDED', 
        'PURCHASE_CHARGEBACK', 
        'PURCHASE_CANCELED',
        'SUBSCRIPTION_CANCELED',
        'SUBSCRIPTION_EXPIRED'
      ].includes(event);

      if (isGrant) {
        // Libera acesso para todos os IDs identificados
        for (const pid of targetIds) {
          const transactionId = data?.purchase?.transaction || `hotmart_${Date.now()}`;
          const insertRes = await fetch(`${supabaseUrl}/rest/v1/purchases`, {
            method: 'POST',
            headers: { ...adminHeaders, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({
              user_id: userId,
              product_id: pid,
              transaction_id: transactionId
            })
          });
          
          if (!insertRes.ok) {
            console.error(`Erro ao inserir compra do produto ${pid} para o usuário ${userId}`);
          }
        }
        console.log(`Sucesso: Acesso liberado para o e-mail ${email} nos seguintes produtos: ${targetIds.join(', ')}`);

      } else if (isRevoke) {
        if (isMainCourse) {
          // EXCLUSÃO COMPLETA: Se cancelou o Produto Principal de venda única, deleta completamente o usuário do Auth
          const deleteUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
            method: 'DELETE',
            headers: adminHeaders
          });
          
          if (!deleteUserRes.ok) {
            const deleteError = await deleteUserRes.json();
            throw new Error(`Falha ao deletar a conta de usuária: ${deleteError.error?.message || 'Erro desconhecido'}`);
          }
          console.log(`Sucesso: Conta do e-mail ${email} foi DELETADA permanentemente do sistema porque cancelou o Produto Principal.`);
        } else {
          // REVOGAÇÃO PARCIAL: Se for bônus, pacote avulso ou outro curso diferente do principal, deleta apenas os acessos correspondentes
          const formattedIds = targetIds.map(id => `"${id}"`).join(',');
          const revokeRes = await fetch(`${supabaseUrl}/rest/v1/purchases?user_id=eq.${userId}&product_id=in.(${formattedIds})`, {
            method: 'DELETE',
            headers: adminHeaders
          });

          if (!revokeRes.ok) {
            console.error(`Erro ao remover os privilégios das compras.`);
          }
          console.log(`Sucesso: Acesso revogado para o e-mail ${email} dos seguintes produtos: ${targetIds.join(', ')}`);
        }
      }

      // Retorna sucesso para a Hotmart
      return new Response(JSON.stringify({ 
        success: true, 
        event, 
        processed_items_count: targetIds.length 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } catch (error) {
      console.error('Falha de execução no Worker:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }
}
