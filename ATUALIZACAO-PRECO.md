# Atualização — preços informados durante a compra

Esta versão mantém o cadastro rápido: ao adicionar um produto, o usuário informa somente o nome e a quantidade. A família decide se deseja registrar o preço unitário quando o produto for marcado como comprado.

Quando a configuração está ligada, o aplicativo multiplica a quantidade pelo preço de uma unidade, mantém o produto na seção **No carrinho** e mostra o total da compra até alguém escolher **Limpar comprados**.

## 1. Atualizar o banco Neon

Esta etapa deve ser realizada **antes** de publicar os novos arquivos na Vercel.

1. Abra o projeto **lista-de-casa** no Neon.
2. Entre em **Postgres database → SQL Editor**.
3. Confirme que a branch selecionada é `production`.
4. Abra `database/migrations/002_purchase_price_settings.sql`.
5. Copie todo o conteúdo, cole no SQL Editor e clique em **Run**.
6. O resultado correto apresentará:

```text
unit_price_type: numeric
family_setting_type: boolean
```

A migração preserva usuários, famílias e produtos. Se a coluna experimental `price` já existir, ela será reaproveitada com o novo nome `unit_price`. Os valores experimentais serão zerados porque ainda não representavam preços efetivamente pagos.

## 2. Atualizar os arquivos do projeto

O pacote completo já contém todos os arquivos. Os arquivos alterados nesta versão são:

- `components/shopping-app.tsx`
- `app/api/items/route.ts`
- `app/api/family/settings/route.ts`
- `app/globals.css`
- `app/page.tsx`
- `lib/auth.ts`
- `database/schema.sql`
- `database/migrations/002_purchase_price_settings.sql`
- `README.md`
- `ATUALIZACAO-PRECO.md`

Não copie `node_modules`, `.next` ou `.env.local` para o GitHub.

## 3. Testar localmente

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` e faça este teste:

1. Entre como criador da família.
2. Toque em **Família**.
3. Ative **Registrar preços durante a compra**.
4. Adicione `Leite`, com quantidade `3`. Nenhum preço deve ser solicitado no cadastro.
5. Marque o leite como comprado.
6. Informe o preço unitário `5,49`.
7. Confirme que o produto foi para **No carrinho** mostrando `R$ 5,49/un.` e total `R$ 16,47`.
8. Adicione e marque outro produto usando **Marcar sem informar preço**.
9. Confirme que o aplicativo avisa que existe um produto sem preço.
10. Atualize a página: os produtos comprados e seus valores devem continuar visíveis.
11. Desmarque um produto: ele deve voltar para **Para comprar** e perder o preço antigo.
12. Clique em **Limpar comprados**, confira a confirmação e cancele.
13. Abra novamente e confirme a limpeza.

Para conferir o modo tradicional, desligue a configuração da família e marque um produto. Ele deverá ir direto para **No carrinho**, sem perguntar o preço.

Ao terminar, pressione `Ctrl + C` no terminal.

## 4. Publicar na Vercel

1. Abra o GitHub Desktop.
2. Confira os arquivos alterados.
3. Use como mensagem do commit: `Registra preços durante a compra`.
4. Clique em **Commit to main**.
5. Clique em **Push origin**.
6. Aguarde o deploy automático da Vercel.
7. Abra o aplicativo publicado e repita o teste principal.

Não é necessário alterar a variável `DATABASE_URL`.
