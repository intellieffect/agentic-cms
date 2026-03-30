# Agentic CMS Dashboard

Web dashboard for [Agentic CMS](https://github.com/brxce/agentic-cms) — visualize and manage your AI-driven content pipeline.

## Stack

- **Next.js 15** (App Router, Server Components)
- **TypeScript** (strict mode)
- **Tailwind CSS 4**
- **Recharts** for data visualization
- **Supabase** for data (service role, server-side)

## Setup

```bash
cd dashboard
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard home — pipeline stats, recent activity, channel chart |
| `/pipeline` | Kanban board — Draft → Review → Published |
| `/ideas` | Ideas list with promotion status |
| `/publications` | Publication records with metrics |
| `/activity` | Agent activity timeline |

## Build

```bash
npm run build
npm start
```

## License

MIT
