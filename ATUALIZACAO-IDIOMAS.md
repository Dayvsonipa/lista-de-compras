# Atualização: português, inglês e espanhol

Esta versão permite que cada usuário escolha o próprio idioma sem alterar a preferência dos demais integrantes da família.

## O que muda

- Português continua sendo o idioma inicial das contas existentes.
- O usuário pode escolher **Português**, **English** ou **Español**.
- A escolha fica em **Configurações → Idioma do aplicativo**.
- O idioma é salvo na conta e acompanha o usuário em outros aparelhos.
- A preferência também fica guardada no celular para as telas de entrada e para o uso offline.
- Produtos, nomes de famílias e categorias permanecem no idioma em que foram cadastrados.

## 1. Atualizar o banco no Neon

Execute esta etapa **antes de publicar o novo código na Vercel**.

1. Abra o painel do Neon.
2. Entre em **Postgres database → SQL Editor**.
3. No computador, abra `database/migrations/005_user_language.sql` no VS Code.
4. Copie todo o conteúdo do arquivo com `Ctrl + A` e `Ctrl + C`.
5. Apague a consulta anterior do SQL Editor.
6. Cole o conteúdo SQL com `Ctrl + V`.
7. Clique em **Run**.

Importante: não cole somente o texto `database/migrations/005_user_language.sql`. Esse texto é o caminho do arquivo, não o comando SQL.

Ao final, o Neon mostrará uma tabela com as colunas:

```text
preferred_language
users
```

As contas que já existiam aparecerão como `pt-BR`. Nenhum usuário, família, item ou histórico será apagado.

## 2. Publicar a nova versão

1. Substitua os arquivos antigos pelos arquivos deste pacote.
2. Não copie `node_modules`, `.next` nem `.env.local` para o GitHub.
3. Abra o GitHub Desktop.
4. Confira os arquivos alterados.
5. Use uma mensagem como `Adiciona português inglês e espanhol`.
6. Clique em **Commit to main**.
7. Clique em **Push origin**.
8. Aguarde a Vercel concluir o deploy.

## 3. Atualizar o aplicativo instalado

1. Abra o Lista de Casa com internet.
2. Aguarde alguns segundos para o novo cache ser instalado.
3. Feche completamente o aplicativo.
4. Abra novamente pelo ícone.

O aplicativo utiliza uma nova versão do cache offline. Não é necessário desinstalar, salvo se o celular continuar exibindo a interface antiga depois de fechar e abrir novamente.

## 4. Teste sugerido

1. Entre com sua conta.
2. Abra **Configurações**.
3. Em **Idioma do aplicativo**, escolha **English**.
4. Confira a lista, o comparador de preços e a janela de finalização.
5. Saia da conta e confirme que a tela de entrada continua em inglês.
6. Entre novamente e escolha **Español**.
7. Abra o aplicativo em outro aparelho com a mesma conta e confirme que o espanhol foi recuperado.
8. Entre com outro integrante da mesma família e mantenha essa conta em português.

O resultado esperado é que a mesma lista compartilhada seja exibida em idiomas diferentes para cada usuário.
