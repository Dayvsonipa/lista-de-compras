# Lista Casa — quantidades, unidades e histórico de preços

Atualização preparada sobre `Dayvsonipa/lista-de-compras`, commit
`08c1e96369710cec71b24e4a4ef7f1168bc7136b` (versão consultada em 29/10/2026).
O pacote contém somente arquivos novos/alterados. Nenhuma alteração foi executada
no banco de produção e nenhuma publicação foi feita automaticamente.

## Comportamento

- Peso e volume são opcionais. Basta preencher o nome: quantidade inicia em 1 e
  unidade em **Não informado**. A compra e o total continuam funcionando.
- Para comparação, escolha a unidade: kg/g, l/ml, un, pacote, caixa etc.
- Gramas são comparados por kg; mililitros, por litro. As outras unidades só são
  comparadas com a mesma unidade e o mesmo produto da mesma família.
- A quantidade de compra fica em campo próprio. Ex.: Filé de frango | 1,6 | kg.
- No carrinho é possível corrigir a quantidade efetivamente comprada e informar
  o preço por unidade de referência ou o total. O total digitado é preservado
  exatamente, evitando diferenças de centavos ao dividir pesos.
- Sem medida informada, a compra é armazenada sem setas de variação. Não é
  presumido que dois lotes de pesos desconhecidos sejam equivalentes.
- Preços antigos continuam guardados com seus valores originais. Como não havia
  unidade confiável, não são usados automaticamente para comparar. A comparação
  começa após uma compra com unidade explícita ser finalizada.
- Marcas e tamanhos FIXOS de embalagem identificam o produto: por exemplo,
  `Creme de leite Marca X 200 g`. As 4 caixas compradas ficam na quantidade, não
  no nome. O sistema não considera caixas de tamanhos distintos equivalentes.
  Esta etapa não cria um cadastro separado de marcas/tamanhos de embalagem.
- A observação é um lembrete, não define identidade nem equivalência de preços.
- Corrigir o nome mantém o identificador e histórico; para outra marca/produto,
  use **Trocar por outro produto, marca ou embalagem**. Se o novo nome exato já
  existir na família, o vínculo é reutilizado. Não há associação por semelhança.
- Em `Aveia ou granola`, `Óleo ou azeite` e semelhantes, escolha o produto real
  usando a edição antes de colocar no carrinho. `Sal e temperos` também precisa
  ser substituído pelo produto real; crie itens separados quando necessário.
- A fila offline leva quantidade/unidade/observação. Erros de validação não
  apagam alterações silenciosamente; o usuário pode descartar a alteração
  bloqueada individualmente, após confirmação, e sincronizar novamente.

## Ordem de aplicação

1. Sincronize os aparelhos da família enquanto estiverem conectados. Resolva as
   alterações pendentes antes da correção dos dados importados. Não compre nem
   edite itens enquanto estiver aplicando essa correção.
2. Guarde uma cópia do projeto atual. Se o repositório recebeu alterações depois
   do commit citado acima, compare os arquivos antes de substituí-los.
3. No SQL Editor do Neon, no banco do Lista Casa, execute **todo** o arquivo
   `database/migrations/009_quantities_and_units.sql`.
   Requer a migração 006 do catálogo já existente no projeto. A 009 é repetível.
   Não execute o schema base para tentar atualizar o banco existente.
4. Copie as pastas/arquivos do pacote para a raiz do projeto, preservando a
   estrutura. Envie pelo GitHub Desktop e aguarde a publicação na Vercel.
   Se trabalhar localmente: `npm ci`, `npm run test:measures`, `npm run build`.
5. Feche e reabra/atualize o app em todos os aparelhos, conectado à internet.
   Confira o campo **Unidade (opcional)**. Não limpe os dados do navegador se
   houver alterações offline ainda pendentes.
6. Execute inteiro `database/migrations/010_repair_week_a.sql` como está:
   `v_aplicar := false`. Essa primeira execução é uma PRÉVIA, não grava nada.
   Os avisos mostram nome anterior, nome novo, quantidade e unidade.
7. Confira a prévia. Se os itens estiverem corretos, altere somente
   `v_aplicar boolean := false` para `v_aplicar boolean := true` e execute
   novamente o arquivo inteiro. Se houver mais de um Dayvson, preencha `v_email`
   com o e-mail exato da conta, como orientado no próprio script.
8. Atualize o app e confira os produtos. Não execute novamente a importação
   antiga `Lista_Casa_Semana_A.sql`: ela usa o modelo de lotes no nome.

## Proteções da correção da Semana A

A 010 procura os IDs específicos gerados pela importação de 31/10/2026. Só
converte itens pendentes adicionados por Dayvson que ainda tenham nome original,
quantidade 1 e não tenham sido convertidos/editados. Itens no carrinho e compras
arquivadas são preservados. Se a prévia mostrar zero, não força correspondências.
Uma nova execução não duplica nem reconverte registros.

O vínculo é reaproveitado somente por nome exato normalizado da família. Por
exemplo, `Filé de frango` não é automaticamente associado a `Peito de frango`.
Cadastros órfãos criados pela importação só são removidos quando nunca foram
comprados, não têm preço nem vínculo global e não são referenciados por itens.

## Validação

- TypeScript e compilação de produção.
- Teste automatizado dos handlers reais das APIs com PostgreSQL embarcado
  (PGlite): quantidades decimais, g/kg, total exato, histórico, isolamento entre
  famílias, reexecução, cliente antigo, rollback da finalização e correção da
  Semana A em modo prévia/aplicação.
- Teste com navegador local, os mesmos handlers e banco de teste: compra de
  1 kg por R$ 20,00 seguida de 1,6 kg por R$ 30,40 → R$ 19,00/kg e seta de queda.
- Navegador: 320/390/720 pixels sem rolagem horizontal; inclusão offline só com
  nome, preservação da fila e sincronização ao reconectar; compra sem medida
  por total sem seta de comparação.
- Esta validação não usa o banco de produção nem substitui a conferência após
  a publicação na Vercel.

O lint dos arquivos alterados é verificado separadamente. O lint geral do
repositório já apresentava avisos de `require()` em `aplicar-layout.cjs`, que não
faz parte desta alteração.

## Se precisar interromper a atualização

Depois da 009, antes de converter itens, o código antigo ainda mantém os campos
antigos. Depois da 010, não volte ao código anterior: ele não entende quantidades
decimais. Nesse caso, mantenha o código novo e investigue o erro antes de comprar.
Não reverta unidades ou valores históricos por suposição.
