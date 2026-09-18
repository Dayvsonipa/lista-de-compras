# Atualização — categorias e funcionamento offline

Esta versão adiciona categorias personalizadas por família e transforma o Lista de Casa em uma PWA offline. Todos os cadastros, famílias, produtos, preços e configurações atuais são preservados.

## O que muda

- Cada família recebe categorias iniciais e pode criar, renomear ou remover outras.
- Cada produto pode ser ligado a uma categoria.
- A lista **Para comprar** fica agrupada por setor do supermercado.
- Produtos antigos aparecem em **Sem categoria** até serem editados.
- A lista e as categorias ficam salvas no celular depois da primeira sincronização.
- Alterações feitas sem internet entram em uma fila local.
- Ao recuperar a conexão, o aplicativo envia a fila ao Neon e baixa a lista atualizada.
- O aplicativo informa quando está offline, o horário da última sincronização e a quantidade de alterações pendentes.

## 1. Atualizar o Neon

Faça esta etapa antes de publicar os novos arquivos.

1. Abra o projeto `lista-de-casa` no Neon.
2. Entre em **Postgres database → SQL Editor**.
3. Confirme que a branch selecionada é `production`.
4. Abra o arquivo `database/migrations/003_categories_and_offline_sync.sql`.
5. Copie todo o conteúdo, cole no SQL Editor e clique em **Run**.

Ao terminar, o resultado deve mostrar:

```text
active_categories: número maior que zero
category_id_type: uuid
updated_at_type: timestamp with time zone
```

O número de categorias depende de quantas famílias já existem. Cada família existente recebe até oito categorias iniciais. A migração pode ser executada novamente com segurança: ela não duplica categorias.

## 2. Atualizar o projeto

Substitua os arquivos do repositório pelos arquivos deste pacote. Não copie:

```text
node_modules
.next
.env.local
```

Arquivos principais desta atualização:

- `app/api/categories/route.ts`
- `app/api/items/route.ts`
- `app/api/family/create/route.ts`
- `components/shopping-app.tsx`
- `components/service-worker-register.tsx`
- `lib/offline-db.ts`
- `public/sw.js`
- `database/migrations/003_categories_and_offline_sync.sql`
- `database/schema.sql`
- `app/globals.css`

## 3. Testar localmente

No terminal, dentro da pasta do projeto:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` e faça o teste online:

1. Entre em sua conta.
2. Abra **Família**.
3. Confirme as categorias iniciais.
4. Crie uma categoria chamada `Congelados`.
5. Renomeie-a para `Frios e congelados`.
6. Adicione `Pizza`, quantidade `2`, nessa categoria.
7. Confirme que o produto aparece dentro do grupo correto.
8. Edite o produto e troque sua categoria.
9. Marque-o como comprado e confirme que as funções de preço continuam normais.

## 4. Testar sem internet

O primeiro acesso precisa ser feito com internet para salvar a versão atual da lista.

1. Com a lista aberta e sincronizada, atualize a página uma vez.
2. Abra as ferramentas do navegador com `F12`.
3. Em **Network**, selecione **Offline**.
4. Atualize a página.
5. Confirme que a lista continua abrindo.
6. Adicione um produto, edite outro e marque um terceiro como comprado.
7. Feche e abra novamente a página ainda offline.
8. Confirme que todas as alterações continuam visíveis.
9. Volte **Network** para **No throttling**.
10. Aguarde o aviso de sincronização desaparecer.
11. Atualize a página e confirme que as alterações permaneceram.

No celular, repita o teste instalando o aplicativo, abrindo a lista com internet e depois ativando o modo avião.

## 5. Publicar na Vercel

1. No GitHub Desktop, confira que `.env.local`, `node_modules` e `.next` não aparecem.
2. Use a mensagem de commit: `Adiciona categorias e modo offline`.
3. Clique em **Commit to main**.
4. Clique em **Push origin**.
5. Aguarde o deploy automático da Vercel.
6. Abra o aplicativo publicado com internet e aguarde a primeira sincronização.
7. Em aparelhos que já tinham o aplicativo instalado, feche-o completamente e abra novamente para receber a nova versão.

Não é necessário criar outra variável na Vercel. A `DATABASE_URL` existente continua sendo usada.

## Limite esperado do modo offline

Quando dois integrantes estão sem internet, um aparelho não consegue ver imediatamente as ações realizadas no outro. Cada celular envia suas alterações ao servidor quando a conexão retorna. Se ambos alterarem o mesmo produto offline, prevalecerá a última alteração sincronizada.
