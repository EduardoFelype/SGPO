# SGPO — Sistema de Gestão para Pequenas Oficinas

Sistema web para organizar o dia a dia de oficinas mecânicas de pequeno porte: clientes, veículos, ordens de serviço, estoque de peças, financeiro e relatórios em um só lugar.

---

## Sumário

1. [O que o sistema faz](#o-que-o-sistema-faz)
2. [O que o sistema não faz](#o-que-o-sistema-não-faz)
3. [Tecnologias](#tecnologias)
4. [Como instalar](#como-instalar)
5. [Como usar](#como-usar)
6. [Regras de negócio](#regras-de-negócio)
7. [Comandos úteis](#comandos-úteis)
8. [Estrutura do projeto](#estrutura-do-projeto)
9. [Documentação (diagramas)](#documentação-diagramas)
10. [Problemas comuns](#problemas-comuns)

---

## O que o sistema faz

| Módulo | O que faz |
|---|---|
| **Login** | Acesso com usuário e senha. No primeiro acesso, o próprio sistema pede para criar o administrador. Senhas guardadas com criptografia (bcrypt) e sessão por token JWT. |
| **Dashboard** | Mostra OS abertas e concluídas, receitas, estoque crítico, gráficos (7, 30 e 90 dias) e as últimas ordens de serviço. |
| **Clientes** | Cadastro de pessoa física (CPF) ou jurídica (CNPJ), com validação do documento, telefone com DDD e endereço preenchido pelo CEP (ViaCEP). Busca, edição e histórico do cliente. |
| **Veículos** | Cadastro vinculado ao cliente. Marca, modelo e ano são escolhidos da **tabela FIPE**, evitando nomes digitados errados. Placa no padrão antigo ou Mercosul. |
| **Ordens de serviço (OS)** | Abertura com serviços, peças do estoque, quantidades, valores, desconto e previsão de entrega. Controle de status, fotos do veículo, impressão em PDF e envio pelo WhatsApp. |
| **Conclusão da OS** | Ao concluir, o sistema baixa as peças do estoque, gera a receita no financeiro e atualiza a quilometragem do veículo — tudo automático. |
| **Estoque** | Cadastro de peças e insumos, entradas, saídas, ajustes, histórico de movimentações e alerta de estoque mínimo. |
| **Financeiro** | Contas a pagar e a receber, registro de pagamento, categorias e fluxo de caixa. |
| **Relatórios** | Relatórios por período, com exportação em CSV, Excel e PDF. |
| **Configurações** | Dados da oficina (nome, CNPJ, telefone, endereço) usados nas OS impressas. |
| **Interface** | Tema claro e escuro, layout responsivo (computador, tablet e celular). |

## O que o sistema não faz

Para deixar claro o escopo do projeto, estes recursos **não** fazem parte do SGPO:

- **Não emite nota fiscal** (NF-e / NFS-e) nem se integra com a Receita ou a prefeitura.
- **Não processa pagamentos**: não cobra cartão, Pix ou boleto; apenas **registra** que um pagamento foi feito.
- **Não agenda horários** de atendimento para os clientes.
- **Não envia mensagens automáticas**: o WhatsApp abre com o texto pronto, mas quem envia é o usuário.
- **Não tem recuperação de senha** ("esqueci minha senha").
- **Não tem tela para cadastrar outros usuários**: o administrador inicial é criado no primeiro acesso; outros administradores podem ser criados pelo terminal (`pnpm seed:admin`).
- **Não atende várias oficinas** na mesma instalação: cada instalação é de uma oficina.
- **Não controla funcionários**, comissões, ponto ou folha de pagamento.
- **Não funciona sem internet** para buscar a tabela FIPE e o CEP (o restante funciona na rede local).
- **Não é um aplicativo de celular nativo**: é um sistema web que abre no navegador do celular.
- **Não faz backup automático** do banco de dados; o backup deve ser feito pelo responsável.

---

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Interface | React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts |
| API | Node.js, Express, tRPC 11, Zod |
| Banco de dados | MySQL 8, Drizzle ORM |
| Segurança | bcryptjs (senhas) e JWT (sessão) |
| APIs externas | Tabela FIPE (via BrasilAPI, com a API Parallelum como reserva) e ViaCEP |
| Infraestrutura | Docker e Docker Compose |

---

## Como instalar

Existem duas formas. A **opção 1 (Docker)** é a mais fácil, porque já instala o banco de dados junto.

### Opção 1 — Com Docker (recomendado)

**Pré-requisitos**

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e **aberto**
- Portas `3000` e `3306` livres no computador

**Passo a passo**

1. Baixe o projeto:

   ```bash
   git clone https://github.com/EduardoFelype/SGPO.git
   cd SGPO
   ```

2. Crie o arquivo de configuração a partir do modelo:

   ```bash
   # Linux / macOS / Git Bash
   cp .env.example .env

   # Windows (Prompt de Comando)
   copy .env.example .env
   ```

3. Abra o arquivo `.env` e troque:
   - `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` por senhas suas;
   - `JWT_SECRET` por uma chave aleatória com 32 caracteres ou mais (pode gerar com `openssl rand -hex 32`).

4. Suba o sistema e o banco de dados:

   ```bash
   docker compose up --build
   ```

   Na primeira vez demora alguns minutos. Quando aparecer que o servidor está rodando, siga para o próximo passo.

5. Abra no navegador: **http://localhost:3000**

Para desligar:

```bash
docker compose down
```

Os dados do banco e as fotos das OS ficam guardados e voltam na próxima vez que o sistema for ligado.

> ⚠️ `docker compose down -v` **apaga todos os dados** (banco e fotos). Use apenas se quiser começar do zero.

### Opção 2 — Sem Docker (modo desenvolvimento)

**Pré-requisitos**

- [Node.js 22](https://nodejs.org/) ou mais recente
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)
- [MySQL 8](https://dev.mysql.com/downloads/mysql/) instalado e rodando, com um banco vazio (ex.: `sgpo`)

**Passo a passo**

1. Baixe o projeto e entre na pasta:

   ```bash
   git clone https://github.com/EduardoFelype/SGPO.git
   cd SGPO
   ```

2. Crie o `.env` a partir do modelo (veja o passo 2 da opção 1) e ajuste:
   - `DATABASE_URL` com o usuário, a senha e o nome do seu banco. Exemplo: `mysql://root:minhasenha@localhost:3306/sgpo`
   - `JWT_SECRET` com uma chave aleatória de 32 caracteres ou mais.

3. Instale as dependências, crie as tabelas e inicie:

   ```bash
   pnpm install
   pnpm drizzle-kit migrate
   pnpm dev
   ```

4. Abra no navegador: **http://localhost:3000**

---

## Como usar

### 1. Primeiro acesso

Na primeira vez que o sistema é aberto, ele pede **nome, usuário e senha do administrador**. Depois disso, o acesso é sempre pela tela de login.

### 2. Configure a oficina

Em **Configurações**, preencha nome, CNPJ, telefone e endereço da oficina. Esses dados aparecem nas ordens de serviço impressas.

### 3. Cadastre as peças do estoque

Em **Estoque → Nova peça**, informe código, nome, quantidade, estoque mínimo e preços. Use **Movimentar** para registrar entradas (compras) e saídas.

### 4. Cadastre o cliente e o veículo

- **Clientes → Novo cliente**: informe nome, CPF ou CNPJ, telefone e CEP (o endereço é preenchido sozinho).
- **Veículos → Novo veículo**: escolha o cliente, informe a placa e selecione **marca, modelo e ano da lista FIPE**.

### 5. Abra uma ordem de serviço

1. Clique em **Nova OS** (no menu ou no Dashboard).
2. Escolha o cliente e o veículo.
3. Informe quilometragem, diagnóstico e previsão de entrega.
4. Adicione os **serviços** (mão de obra) e as **peças** do estoque.
5. Salve. O número da OS é gerado automaticamente.

Na tela da OS é possível anexar fotos do veículo, imprimir em PDF e enviar ao cliente pelo WhatsApp.

### 6. Acompanhe e conclua a OS

Altere o status conforme o andamento (em análise, aguardando aprovação, aguardando peça, em andamento). Ao marcar como **Concluída**:

- as peças saem do estoque;
- a receita é lançada no **Financeiro**;
- a quilometragem do veículo é atualizada.

Uma OS concluída fica bloqueada. Para corrigir algo, use **Reabrir** (as peças voltam ao estoque e a receita é cancelada).

### 7. Controle o financeiro

Em **Financeiro**, registre despesas (aluguel, fornecedores etc.) e outras receitas, e use **Registrar pagamento** quando uma conta for paga ou recebida.

### 8. Veja os resultados

- **Dashboard**: resumo do negócio e alertas de estoque crítico.
- **Relatórios**: escolha o período e exporte em CSV, Excel ou PDF.

---

## Regras de negócio

| Código | Regra |
|---|---|
| RN01 | Só acessa o sistema quem fizer login com usuário e senha válidos. |
| RN02 | O primeiro usuário é o administrador; só ele pode criar novos usuários. |
| RN03 | CPF ou CNPJ deve ser válido e não pode estar cadastrado em outro cliente. |
| RN04 | Telefone com DDD (10 ou 11 dígitos). |
| RN05 | O endereço é preenchido pelo CEP (ViaCEP). |
| RN06 | Cliente, veículo ou produto com OS não pode ser excluído (o histórico é mantido). |
| RN07 | Placa no padrão antigo (ABC1234) ou Mercosul (ABC1D23), sem repetir. |
| RN08 | Marca, modelo e ano vêm da tabela FIPE; ano entre 1950 e o ano seguinte ao atual. |
| RN09 | Quilometragem até 2.000.000 km e nunca menor que a da última OS. |
| RN10 | O veículo da OS precisa ser do cliente escolhido; o número da OS é automático. |
| RN11 | OS com pelo menos um item com valor; até 50 itens; quantidade de 1 a 999; item até R$ 999.999,99; total até R$ 9.999.999,99. |
| RN12 | O desconto não pode ser maior que o valor da peça. |
| RN13 | A previsão de entrega não pode ser antes da abertura nem passar de 365 dias. |
| RN14 | Só conclui a OS se houver estoque; ao concluir, baixa as peças, gera uma única receita e atualiza a quilometragem. |
| RN15 | OS concluída ou cancelada não pode ser editada sem antes ser reaberta. |
| RN16 | Reabrir ou cancelar uma OS concluída devolve as peças e cancela a receita. |
| RN17 | Até 20 fotos por OS, com até 5 MB cada. |
| RN18 | Código do produto único; preço de venda maior que zero; quantidades de 0 a 99.999. |
| RN19 | A saída do estoque não pode ser maior que o disponível; toda alteração gera movimentação. |
| RN20 | Produto com quantidade igual ou abaixo do mínimo gera alerta de estoque crítico. |
| RN21 | Lançamento financeiro com valor maior que zero e vencimento em até 10 anos. |
| RN22 | Lançamentos gerados pela OS não podem ser editados nem excluídos manualmente. |
| RN23 | Lançamento cancelado não pode ser pago; lançamento pago não pode ser pago de novo. |
| RN24 | Relatórios só são exportados quando há dados no período. |

---

## Comandos úteis

| Comando | Para que serve |
|---|---|
| `pnpm dev` | Inicia o sistema em modo desenvolvimento. |
| `pnpm build` | Gera a versão de produção. |
| `pnpm start` | Inicia a versão de produção (depois do `build`). |
| `pnpm test` | Roda os testes automatizados. |
| `pnpm check` | Verifica erros de TypeScript. |
| `pnpm drizzle-kit migrate` | Cria ou atualiza as tabelas do banco. |
| `pnpm seed:admin` | Cria um usuário administrador pelo terminal (usa as variáveis `ADMIN_*` do `.env`). |

---

## Estrutura do projeto

```text
client/src/pages/        Telas do sistema (Dashboard, Clientes, Veículos, OS, Estoque, Financeiro...)
client/src/components/   Componentes reutilizáveis da interface
server/routers/          Rotas da API por módulo
server/validation.ts     Validações (CPF, CNPJ, placa, telefone, limites)
server/fipe.ts           Integração com a tabela FIPE
shared/limits.ts         Limites de valores e quantidades usados no front e no back
drizzle/schema.ts        Tabelas do banco de dados
drizzle/*.sql            Migrações do banco
docs/diagramas/          Diagramas de casos de uso e de classe
compose.yaml             Configuração do Docker (sistema + MySQL)
.env.example             Modelo das configurações
```

---

## Documentação (diagramas)

| Diagrama de casos de uso | Diagrama de classe |
|---|---|
| ![Diagrama de casos de uso](docs/diagramas/diagrama-casos-de-uso.png) | ![Diagrama de classe](docs/diagramas/diagrama-de-classe.png) |

---

## Problemas comuns

| Problema | Solução |
|---|---|
| `port is already allocated` ao subir o Docker | A porta 3000 ou 3306 já está em uso. Feche o outro programa ou mude `APP_PORT` no `.env`. |
| Tela de login não aceita a senha | Confira usuário e senha. Se perdeu o acesso, crie outro administrador com `pnpm seed:admin`. |
| A lista de marcas ou modelos FIPE não carrega | Verifique a internet. O sistema busca na BrasilAPI e, se ela falhar, na API Parallelum. Se as duas estiverem fora do ar, aparece uma lista básica de marcas e é possível digitar o modelo. |
| Erro de conexão com o banco (sem Docker) | Confira se o MySQL está ligado e se `DATABASE_URL` no `.env` está correto. |

---

Projeto desenvolvido para a disciplina de Projeto Integrado — Engenharia de Software, UNICEPLAC (2026).
