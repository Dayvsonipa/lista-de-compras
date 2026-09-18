# Lista de Casa

Sistema web de lista de compras compartilhada para famílias.

## O que já está pronto

- Tela de abertura leve, com ícone arredondado e adaptada às áreas seguras de Android e iPhone.
- Cadastro com nome, e-mail e senha.
- Login e sessão segura por cookie HTTP-only.
- Senhas protegidas com `scrypt` e salt individual.
- Criação de família.
- Entrada na família por código de 8 caracteres.
- Uma lista compartilhada por família.
- Categorias personalizadas por família, com criação, edição e remoção.
- Produtos agrupados por setor do supermercado.
- Identificação de quem adicionou e de quem comprou.
- Quantidade numérica de pacotes ou unidades, com controles de aumentar e diminuir.
- Edição do nome e da quantidade antes de marcar o produto como comprado.
- Configuração familiar para registrar ou não preços durante a compra.
- Preço unitário opcional ao marcar um produto como comprado.
- Cálculo automático por quantidade e total dos produtos no carrinho.
- Comparação de preços entre 2 ou 3 produtos.
- Cálculo automático do preço por mL e por litro.
- Comparação de garrafas, latas e pacotes com várias unidades.
- Funcionamento offline depois da primeira sincronização.
- Alterações offline salvas no celular e enviadas ao servidor quando a conexão retorna.
- Indicador de modo offline, horário da última atualização e alterações pendentes.
- Atualização automática enquanto o aplicativo está aberto e ao recuperar a conexão.
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

Execute as migrações que ainda não foram aplicadas, sempre em ordem. Para esta versão, depois da migração de preços, execute:

```text
database/migrations/003_categories_and_offline_sync.sql
```

Ela cria as categorias e os campos de sincronização sem apagar usuários, famílias, preços ou produtos. O passo a passo completo está em `ATUALIZACAO-CATEGORIAS-OFFLINE.md`.

## Categorias

Abra **Família → Categorias de produtos** para criar, renomear ou remover categorias. As famílias existentes recebem automaticamente: Hortifruti, Açougue, Padaria, Laticínios, Mercearia, Bebidas, Limpeza e Higiene.

Ao adicionar ou editar um produto, selecione seu setor. A área **Para comprar** será agrupada por categoria; produtos antigos permanecem em **Sem categoria** até serem editados.

## Funcionamento offline

Depois que a lista for aberta uma vez com internet, o aplicativo guarda no aparelho a interface, as categorias e a lista atual. Sem conexão, é possível adicionar, editar, excluir e marcar produtos normalmente. As operações ficam em uma fila local e são enviadas em ordem quando o aplicativo recupera a conexão.

O aplicativo informa quando está offline, o horário da última sincronização e quantas alterações aguardam envio. Se dois integrantes estiverem offline ao mesmo tempo, cada celular verá suas próprias alterações até ambos voltarem à internet.

## Registrar preços durante a compra

O criador da família pode abrir **Família** e ativar **Registrar preços durante a compra**. Quando essa opção está ligada:

1. Os produtos continuam sendo cadastrados somente com nome e quantidade.
2. Ao marcar um produto como comprado, o aplicativo solicita o preço de uma unidade.
3. O sistema multiplica o preço pela quantidade cadastrada.
4. O produto permanece em **No carrinho** mostrando preço unitário e total calculado.
5. O total da compra fica visível até alguém escolher **Limpar comprados**.

A quantidade é um número inteiro de pacotes ou unidades. Registros antigos como `2 un.` ou `2 pacotes` continuam sendo reconhecidos; textos de peso, como `5 kg`, são tratados como uma unidade até serem corrigidos pelo botão de edição.

## Cadastrar nome, tamanho e quantidade

Inclua o tamanho ou peso no nome do produto e use **Quantidade** somente para informar quantos pacotes ou unidades serão comprados:

```text
Produto: Arroz 5 kg
Quantidade: 2
```

O item aparecerá como `2 × Arroz 5 kg`. A quantidade aceita valores inteiros de 1 a 999 e pode ser ajustada pelos botões `–` e `+`. Antes da compra, use o botão de lápis para corrigir o produto ou a quantidade.

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

## Instalar no iPhone

1. Abra o endereço publicado diretamente no **Safari**.
2. Toque no botão **Compartilhar**.
3. Escolha **Adicionar à Tela de Início**.
4. Mantenha ativada a opção **Abrir como App**, quando ela aparecer.
5. Confirme em **Adicionar**.
6. Abra o Lista de Casa pelo novo ícone e aguarde a primeira sincronização com internet.

Depois desse primeiro acesso, a lista poderá ser aberta sem conexão. No iPhone, a sincronização em segundo plano não é garantida pelo sistema; por isso o aplicativo sincroniza ao abrir, ao voltar para a tela e quando detecta que a internet retornou.

## Segurança

- `DATABASE_URL` nunca deve ser colocada no GitHub.
- O arquivo `.env.local` já está bloqueado pelo `.gitignore`.
- Todas as consultas da lista verificam o usuário autenticado e a família antes de acessar os produtos.
