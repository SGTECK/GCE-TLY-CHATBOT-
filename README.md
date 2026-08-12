# GCE-TLY AI Assistant

Official AI information assistant for Government College of Engineering, Tirunelveli (GCE-TLY). Built with Next.js 14, TypeScript, Tailwind CSS, and Anthropic Claude.

## Features
- Official college information assistant
- Retrieval-based grounded answers
- HTML/Markdown UI for chat
- Optional voice input
- Exportable conversation history
- Local rate limiting and session isolation

## Setup

```bash
npm install
cp .env.example .env.local
# add your Anthropic API key
npm run dev
```

Open http://localhost:3000

## Scripts
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run crawl`
- `npm run update-knowledge`
