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
- Comparação de preços entre 2 ou 3 produtos.
- Cálculo automático do preço por mL e por litro.
- Comparação de garrafas, latas e pacotes com várias unidades.
- Atualização automática da lista a cada 8 segundos.
- Tema claro e escuro com preferência salva no celular.
- Interface responsiva para celular, tablet e computador.

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

1. Dayvson cria uma conta.
2. Escolhe **Criar uma família**.
3. Define o nome, por exemplo, `Família Rodrigues`.
4. Copia o código exibido na lista.
5. Bia cria a própria conta.
6. Escolhe **Entrar em uma família**.
7. Digita o código enviado por Dayvson.

A partir desse momento, os dois acessam a mesma lista, cada um usando sua própria conta.

## Comparador de preços

Na parte superior da lista, abra **Comparar preços**:

1. Escolha comparar 2 ou 3 produtos.
2. Informe o nome, o preço total e o volume de cada produto.
3. Selecione mL ou litros.
4. Para fardos ou pacotes, informe quantas unidades estão incluídas.

O sistema calcula o preço por mL, apresenta o equivalente por litro e destaca automaticamente a opção mais econômica.

## Segurança

- `DATABASE_URL` nunca deve ser colocada no GitHub.
- O arquivo `.env.local` já está bloqueado pelo `.gitignore`.
- Todas as consultas da lista verificam o usuário autenticado e a família antes de acessar os produtos.
