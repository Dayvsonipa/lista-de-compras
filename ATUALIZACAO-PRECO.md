# Atualização — preço unitário opcional

Esta atualização adiciona o preço opcional de uma unidade. O aplicativo multiplica esse preço pela quantidade e mostra a soma dos itens que ainda estão na seção **Para comprar**.

Exemplo: para `2 caixas` com preço unitário de `R$ 9,00`, informe quantidade `2 caixas` e preço unitário `9,00`. O aplicativo calculará `R$ 18,00`.

Se a quantidade ficar vazia, o sistema considera uma unidade. Para manter compatibilidade com os produtos antigos, o cálculo utiliza o primeiro número informado na quantidade: `2 caixas` vale `2` e `2,5 kg` vale `2,5`.

## 1. Atualizar o banco Neon

1. Abra o projeto **lista-de-casa** no Neon.
2. Entre em **Postgres database → SQL Editor**.
3. Confirme que a branch selecionada é `production`.
4. Abra o arquivo `database/migrations/001_add_item_price.sql` deste pacote.
5. Copie todo o conteúdo, cole no SQL Editor e clique em **Run**.
6. No resultado, confirme que apareceu uma linha para a coluna `price`, com tipo `numeric` e `is_nullable` igual a `YES`.

O comando preserva todos os usuários, famílias e produtos existentes. Os itens antigos continuarão funcionando e ficarão sem preço até serem adicionados novamente.

## 2. Atualizar o projeto no computador

Os arquivos alterados são:

- `components/shopping-app.tsx`
- `app/api/items/route.ts`
- `app/globals.css`
- `database/schema.sql`
- `database/migrations/001_add_item_price.sql`
- `README.md`
- `ATUALIZACAO-PRECO.md`

Você pode substituir esses arquivos no projeto atual ou usar o pacote completo. Não copie `node_modules`, `.next` ou `.env.local` para o GitHub.

## 3. Testar localmente

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` e confira:

1. Adicione um produto sem preço. Ele deve ser salvo normalmente.
2. Adicione um produto com quantidade `2` e preço unitário `12,90`. O total do item deve ser `R$ 25,80`.
3. Adicione outro produto sem quantidade e com preço `4.50`. O total do item deve ser `R$ 4,50`.
4. Confira se a soma ao lado de **Para comprar** mostra `R$ 30,30`.
5. Marque um item como comprado: o total calculado desse item deve sair do total pendente.
6. Desmarque o item: o valor deve voltar ao total.
7. Atualize a página e confirme que os preços unitários continuam salvos.

Ao terminar o teste, pressione `Ctrl + C` no terminal.

## 4. Publicar pela Vercel

1. Abra o GitHub Desktop.
2. Confira os arquivos alterados.
3. Use como mensagem do commit: `Adiciona preços e total da lista`.
4. Clique em **Commit to main**.
5. Clique em **Push origin**.
6. Aguarde a Vercel concluir o deploy automático.
7. Abra o aplicativo publicado e repita um teste com e sem preço.

Não é necessário mudar a variável `DATABASE_URL` na Vercel.
