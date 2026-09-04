# Atualização — quantidade de pacotes ou unidades

Esta versão mantém o nome **Quantidade**, mas deixa claro que ele representa quantos pacotes ou unidades serão comprados. O peso ou tamanho passa a ser informado junto ao nome do produto.

## O que mudou

- A quantidade começa em `1` e aceita somente números inteiros de 1 a 999.
- Os botões `–` e `+` permitem ajustar a quantidade no celular.
- O formulário orienta a incluir peso ou tamanho no nome, como `Arroz 5 kg`.
- O item aparece como `2 × Arroz 5 kg`.
- O botão de lápis permite editar o nome e a quantidade de um item pendente.
- A tela de preço informa que o valor deve ser o de um pacote ou unidade.
- O cálculo do total usa a quantidade numérica validada.
- Os símbolos de carrinho da entrada e do cabeçalho ficaram circulares.

## Banco de dados

Esta atualização não cria colunas ou tabelas. Portanto, **não execute nenhum novo comando SQL no Neon**.

Se o arquivo `database/migrations/002_purchase_price_settings.sql` já foi executado na atualização anterior, o banco está pronto.

## Atualizar e testar

1. Faça uma cópia de segurança da pasta atual do projeto.
2. Substitua os arquivos pelos do novo pacote, preservando o seu `.env.local`.
3. Não copie `node_modules` nem `.next`.
4. No terminal, dentro do projeto, execute:

```bash
npm install
npm run dev
```

5. Abra `http://localhost:3000` e teste:
   - Cadastre `Arroz 5 kg` com quantidade `2`.
   - Confirme a exibição `2 × Arroz 5 kg`.
   - Use o lápis para alterar a quantidade para `3`.
   - Ative o registro de preços nas configurações da família.
   - Marque o arroz como comprado e informe o preço de um pacote.
   - Confirme que o total corresponde a preço unitário × 3.
6. Finalize o servidor com `Ctrl + C`.
7. Faça o commit no GitHub e envie com **Push origin**.
8. Aguarde a publicação automática da Vercel.

Não é necessário alterar a variável `DATABASE_URL`.
