# Britton Field

Crew companion app for **Great Britton Construction**.

Live: https://field.greatbrittongc.com

## Develop

```bash
npm install
npm run dev
```

## Deploy

Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.

- `public/CNAME` → `field.greatbrittongc.com`
- DNS: `field` CNAME → `websiteadmingbc.github.io` (Register.com)

GitHub Pages is static hosting. App data currently uses browser local storage (POC). Next step: Supabase for shared jobs, auth, and photos.

## Stack

React · TypeScript · Vite · Tailwind · React Router · Lucide
