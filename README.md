# Great Britton Field

Vite + React app served at https://field.greatbrittongc.com via GitHub Pages.

## Develop
```
npm install
npm run dev
```

## Deploy
Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.
`public/CNAME` keeps the custom domain set. DNS: `field` CNAME → `websiteadmingbc.github.io` (Register.com).

Note: GitHub Pages is static hosting only. For data/auth, add a hosted backend (e.g. Supabase or Firebase).
