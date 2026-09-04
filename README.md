# Lista de Casa

Sistema web de lista de compras compartilhada para famílias.

## O que já está pronto

- Cadastro com nome, e-mail e senha.
- Login e sessão segura por cookie HTTP-only.
- Senhas protegidas com `scrypt` e salt individual.
- Criação de família.
- Entrada na família por código de 8 caracteres.
- Uma lista compartilhada por família.
- Identificação de quem adicionou e de quem comprou.
- Preço unitário opcional, cálculo pela quantidade e soma dos itens que ainda faltam comprar.
- Comparação de preços entre 2 ou 3 produtos.
- Cálculo automático do preço por mL e por litro.
- Comparação de garrafas, latas e pacotes com várias unidades.
- Atualização automática da lista a cada 8 segundos.
- Tema claro e escuro com preferência salva no celular.
- Interface responsiva para celular, tablet e computador.
- Instalação como aplicativo no Android, com ícone próprio e abertura sem a barra de endereço.

## Tecnologias

- Next.js com TypeScript.
- Neon Postgres.
- Vercel.

## 1. Criar o banco no Neon

1. Entre em https://console.neon.tech/.
2. Crie um projeto.
3. Abra **SQL Editor**.
4. Copie todo o conteúdo de `database/schema.sql`.
5. Cole no editor e execute.
6. Abra **Connect** e copie a string de conexão.

## 2. Rodar no computador

Crie um arquivo chamado `.env.local` na raiz do projeto:

```env
DATABASE_URL=cole_aqui_a_string_do_neon
```

Depois execute:

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

### Atualizar um banco que já está em uso

Se o sistema já estiver publicado, execute no SQL Editor do Neon o arquivo:

```text
database/migrations/001_add_item_price.sql
```

Ele adiciona a coluna de preço sem apagar os dados atuais. O passo a passo completo está em `ATUALIZACAO-PRECO.md`.

## 3. Publicar

1. Crie um repositório no GitHub.
2. Coloque os arquivos deste projeto no repositório.
3. Faça o commit e envie para o GitHub.
4. Na Vercel, escolha **Add New → Project**.
5. Importe o repositório.
6. Em **Environment Variables**, crie:

   - **Key:** `DATABASE_URL`
   - **Value:** string de conexão copiada do Neon.

7. Clique em **Deploy**.

## Primeiro uso

1. Uma pessoa cria a própria conta.
2. Escolhe **Criar uma família**.
3. Define o nome, por exemplo, `Família Silva`.
4. Copia o código exibido na lista.
5. Outro integrante cria a própria conta.
6. Escolhe **Entrar em uma família**.
7. Digita o código recebido.

A partir desse momento, os integrantes acessam a mesma lista, cada um usando sua própria conta.

## Comparador de preços

Na parte superior da lista, abra **Comparar preços**:

1. Escolha comparar 2 ou 3 produtos.
2. Informe o preço total e a quantidade de cada produto.
3. Selecione mL ou litros.
4. Para fardos ou pacotes, informe quantas unidades estão incluídas.

O sistema calcula o preço por mL, apresenta o equivalente por litro e destaca automaticamente a opção mais econômica.

## Instalar no Android

Depois de publicar a versão mais recente na Vercel:

1. Abra o endereço do sistema diretamente no Google Chrome.
2. Toque nos três pontos no canto superior direito.
3. Escolha **Instalar app** ou **Adicionar à tela inicial**.
4. Confirme a instalação como **Lista de Casa**.

Ao abrir pelo novo ícone, o sistema funciona em modo aplicativo, sem exibir a barra de endereço. Se já havia um atalho antigo, remova-o e instale novamente para que o Android reconheça o novo PWA.

## Segurança

- `DATABASE_URL` nunca deve ser colocada no GitHub.
- O arquivo `.env.local` já está bloqueado pelo `.gitignore`.
- Todas as consultas da lista verificam o usuário autenticado e a família antes de acessar os produtos.
