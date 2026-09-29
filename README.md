# ichiro

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React Native, Expo, Hono, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Hono** - Lightweight, performant server framework
- **tRPC** - End-to-end type-safe APIs
- **workers** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **Cloudflare D1** - Database engine
- **Authentication** - Better-Auth
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses Cloudflare D1 (SQLite) with Drizzle ORM.

Runtime database access uses the Cloudflare `DB` binding from `packages/infra/alchemy.run.ts`. If a local `DATABASE_URL` is present, it is only for database tooling.

Alchemy provisions the D1 database and applies migrations during `deploy`.

1. Generate migration files:

```bash
bun run db:generate
```

Then, run the development server:

```bash
bun run dev
```

Use the Expo Go app to run the mobile application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Local Stripe webhooks

Run the API server and Stripe webhook forwarding together:

```bash
bun run dev:stripe
```

Install the Stripe CLI first, and set `STRIPE_SECRET_KEY=sk_test_...` in `apps/server/.env` or the process environment alongside the usual server configuration. The command authenticates the CLI with the same key, obtains the signing secret automatically, and passes it to the server without editing `.env`. No `stripe login` is needed. Press Ctrl+C to stop both processes.

Use `bun run dev:stripe --port 3001` if port 3000 is occupied. Start the native app separately with `bun run dev:native`; when using a different port, update its `EXPO_PUBLIC_SERVER_URL` accordingly. Cloud Linux environments need the Linux Stripe CLI and outbound access to Stripe.

See [the webhook development guide](docs/development/local-stripe-webhook.md) for setup, seed data, and verification.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `bun run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

For Cloudflare, Alchemy loads and validates deployment inputs with `varlock/auto-load` in its Node/Bun deployment process. Worker code reads native bindings; web clients use the framework's public env API through `src/env.public.ts` where needed. Alchemy supplies resource URLs and managed database credentials. In-Worker Varlock protections are deferred until an official Alchemy integration is available; see [the non-Wrangler deployment guidance](https://varlock.dev/integrations/cloudflare/#non-wrangler-deploy-tools-alchemy-sst-pulumi).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Requesting a checker

作成時は自分で判定する設定です。「宣言したワン！」画面の「チェックを友達に依頼する」を押すと、依頼方法を選べます。
「依頼リンクを共有」は iPhone の共有シートを開きます。リンクは ichiro アプリ内で開き、受取人がログインして引き受けるとチェック者になります。
「友達から選ぶ」は、別のコミットメントで依頼済みの友達を選べます。編集シートの「チェック者」からも変更できます。
Web版は作成・検証せず、iOS Simulator または実機のネイティブアプリで確認します。

## Deployment

### Alchemy

- Target: server on Cloudflare
- Configure provider accounts: `cd packages/infra && bunx alchemy profile edit`
- Dev: bun run dev
- Deploy: bun run deploy
- Destroy: bun run destroy

`alchemy profile edit` stores the selected Axiom, Cloudflare, Neon, PlanetScale, and/or Prisma provider profiles under `~/.alchemy`; no provider-specific setup command is required by this scaffold.

Deploy staging and production with explicit environment commands:

```bash
bun run deploy:check:stg
bun run deploy:stg
bun run deploy:check:prod
bun run deploy:prod
```

Configure environment-specific secrets first. See [the Cloudflare environment guide](docs/development/cloudflare-environments.md) for setup, Stripe webhooks, native app configuration, and GitHub Actions.

## Git Hooks and Formatting

- Run checks: `bun run check`

## Project Structure

```
ichiro/
├── apps/
│   ├── native/      # Mobile application (React Native, Expo)
│   └── server/      # Backend API (Hono, TRPC)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:server`: Start only the server
- `bun run dev:stripe`: Start the server with Stripe webhook forwarding
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:native`: Start the React Native/Expo development server
- `bun run db:generate`: Generate database client/types
- `bun run check`: Run Oxlint and Oxfmt
