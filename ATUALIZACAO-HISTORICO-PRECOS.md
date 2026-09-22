# Atualização: catálogo, histórico e comparação de preços

Esta versão preserva as compras finalizadas, sugere produtos já usados pela família e compara o preço unitário atual com o último preço registrado.

## 1. Antes de atualizar

- Confirme que o projeto já utiliza as migrações `001` e `002`.
- Mantenha uma cópia do projeto atual no GitHub.
- Não altere nem compartilhe a variável `DATABASE_URL`.

## 2. Atualizar o banco no Neon

No painel do Neon, abra **Postgres database → SQL Editor**.

Se a migração de categorias ainda não foi executada:

1. Abra `database/migrations/003_categories_and_offline_sync.sql` no VS Code.
2. Copie **todo o conteúdo SQL** do arquivo.
3. Cole o conteúdo no SQL Editor do Neon e clique em **Run**.
4. O resultado deve exibir as colunas `active_categories`, `category_id_type` e `updated_at_type`.

Depois, execute a nova migração:

1. Abra `database/migrations/004_product_catalog_and_purchase_history.sql` no VS Code.
2. Copie **todo o conteúdo SQL** do arquivo.
3. Apague a consulta anterior do editor, cole o conteúdo e clique em **Run**.
4. O resultado deve exibir `catalog_products`, `product_id_type`, `saved_purchases` e `saved_purchase_items`.

Importante: `database/migrations/004_product_catalog_and_purchase_history.sql` é o endereço do arquivo no computador. Não cole apenas esse texto no Neon, pois ele não é um comando SQL.

As migrações são seguras para os dados atuais: usam `IF NOT EXISTS` e não apagam usuários, famílias, categorias nem itens da lista.

## 3. Publicar o código

1. Substitua os arquivos antigos pelos desta versão, sem copiar `node_modules`, `.next` ou `.env.local`.
2. Faça o commit no GitHub.
3. Envie o commit para o repositório remoto.
4. Aguarde a Vercel criar automaticamente o novo deploy.
5. Na Vercel, confirme que o deploy aparece como **Ready**.

## 4. Atualizar o aplicativo instalado

Abra o aplicativo com internet e aguarde alguns segundos. O novo service worker substituirá o cache antigo. Se a interface não atualizar, feche completamente o aplicativo, abra novamente e use a opção de recarregar a página uma vez.

## 5. Teste completo

1. Em **Família**, ative **Registrar preços durante a compra**.
2. Adicione `Arroz 5 kg`, quantidade `1`.
3. Marque como comprado e informe `25,00` como preço unitário.
4. Toque em **Finalizar compra**.
5. Adicione novamente o produto usando a sugestão `Arroz 5 kg`.
6. Marque como comprado e informe `23,50`.
7. O item deverá mostrar uma seta verde `▼` e queda aproximada de `6%`.
8. Finalize essa compra, adicione o mesmo produto novamente e informe `27,00`.
9. O item deverá mostrar uma seta vermelha `▲` e o percentual de aumento.

## 6. Conferir o histórico no Neon

Para consultar os registros salvos, execute:

```sql
SELECT
  ps.purchased_at,
  pi.product_name,
  pi.quantity,
  pi.unit_price,
  pi.total_price
FROM purchase_items pi
JOIN purchase_sessions ps ON ps.id = pi.session_id
ORDER BY ps.purchased_at DESC, pi.product_name;
```

O histórico já fica organizado para relatórios futuros. Esta atualização não adiciona ainda uma tela de relatórios; ela cria a base correta para essa próxima etapa.
