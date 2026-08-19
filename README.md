# SGPO — Sistema de Gestão para Pequenas Oficinas

Sistema web para a operação diária de oficinas mecânicas. O SGPO reúne cadastro de clientes e veículos, ordens de serviço, estoque, financeiro, relatórios e configurações da oficina em uma interface com identidade visual azul-marinho e laranja.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Interface | React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion e Recharts |
| API | Node.js, Express, tRPC 11 e Zod |
| Persistência | MySQL 8, Drizzle ORM |
| Segurança | Login local com senha protegida por bcryptjs e sessão JWT HTTP-only |
| Infraestrutura local | Docker Compose, MySQL e volume persistente para fotos |

## Funcionalidades

| Módulo | Principais recursos |
|---|---|
| Acesso | Primeiro administrador criado pela própria tela de configuração; papéis `admin` e `user`; sessão por cookie seguro. |
| Dashboard | Indicadores, gráficos e filtros de 7, 30 e 90 dias. |
| Clientes e veículos | Cadastro, busca, edição, histórico e vínculo entre cliente e veículo. |
| Ordens de serviço | Serviços, peças, mão de obra, totais, status, impressão e compartilhamento por WhatsApp. Ao concluir uma OS, o estoque e o financeiro são atualizados automaticamente. |
| Fotos da OS | Anexo, visualização e exclusão de fotos do veículo, persistidas no volume local do Docker. |
| Estoque | Produtos, entradas, saídas, ajustes, histórico e alertas de estoque mínimo. |
| Financeiro | Contas a pagar e receber, fluxo de caixa, categorias e status de pagamento. |
| Relatórios | Filtros por período e exportação em CSV, Excel compatível e PDF. |
| Interface | Tema claro/escuro persistente e layout responsivo. |

## Executar com Docker — recomendado

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ou Docker Engine com Docker Compose.
- Portas locais `3000` e `3306` livres, ou ajuste `APP_PORT` no arquivo `.env`.

### Passos

```bash
# 1. Entre na pasta do projeto.
cd sgpo

# 2. Crie o arquivo de configuração local.
cp env.example .env

# 3. Edite .env e troque JWT_SECRET por uma chave aleatória de pelo menos 32 caracteres.
# Exemplo para gerar a chave: openssl rand -hex 32

# 4. Inicie a aplicação e o MySQL.

```

Abra [http://localhost:3000](http://localhost:3000). No primeiro acesso, o sistema solicitará o nome, usuário e senha do **administrador inicial**. O MySQL e as fotos da OS são preservados nos volumes `mysql_data` e `uploads_data`.

Para encerrar os contêineres, use:

```bash
docker compose down
```

> Para apagar também os dados locais de banco e fotos, execute `docker compose down -v`. Esse comando é destrutivo.

## Executar sem Docker

1. Instale um MySQL 8 e crie um banco de dados vazio.
2. Copie `env.example` para `.env` e ajuste `DATABASE_URL` para o endereço do seu MySQL, por exemplo: `mysql://usuario:senha@localhost:3306/sgpo`.
3. Instale e inicie:

```bash
pnpm install
pnpm drizzle-kit migrate
pnpm dev
```

Para gerar uma conta administrativa via terminal, defina as variáveis `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME` e, opcionalmente, `ADMIN_EMAIL`, depois execute:

```bash
pnpm seed:admin
```

## Comandos úteis

| Comando | Finalidade |
|---|---|
| `pnpm dev` | Inicia o servidor em desenvolvimento. |
| `pnpm check` | Executa a verificação TypeScript. |
| `pnpm test` | Executa a suíte Vitest. |
| `pnpm build` | Gera o frontend e o backend de produção. |
| `pnpm start` | Inicia a versão compilada. |
| `pnpm drizzle-kit migrate` | Aplica as migrações do banco de dados. |
| `pnpm seed:admin` | Cria um administrador local a partir das variáveis `ADMIN_*`. |

## Estrutura principal

```text
client/src/pages/       Páginas do sistema
client/src/components/  Componentes e design system
server/routers/         Procedimentos tRPC por domínio
server/authLocal.ts     Hash de senha e validações do login local
server/_core/localSession.ts  Criação e verificação de sessões JWT
server/storage.ts       Armazenamento local de fotos e suporte opcional a S3
drizzle/schema.ts       Modelo do banco de dados
drizzle/*.sql           Migrações MySQL
compose.yaml            Orquestração Docker + MySQL
env.example             Modelo de variáveis locais
```

## Regras de negócio automatizadas

- A conclusão de uma ordem de serviço baixa as peças utilizadas do estoque e registra a movimentação correspondente.
- A conclusão de uma ordem de serviço gera a receita financeira vinculada.
- Produtos abaixo ou no estoque mínimo são destacados como alerta no sistema.
- Senhas não são armazenadas em texto puro: apenas o hash bcrypt é persistido no banco.

## Identidade visual

As logos oficiais fornecidas para o SGPO estão incluídas no projeto e são servidas localmente. A paleta utiliza azul-marinho, laranja e tons metálicos; a interface oferece alternância entre os temas claro e escuro.
