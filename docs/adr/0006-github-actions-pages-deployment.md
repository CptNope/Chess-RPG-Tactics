# ADR 0006: GitHub Actions CI/CD for Automated GitHub Pages Deployment

## Status
**Accepted**

## Date
2026-11-17

## Context
We needed a seamless, frictionless way to publish and host playable builds of the game online so that anyone can play directly in their browser without manual build or deployment steps.

## Decision
We implemented an automated CI/CD pipeline using **GitHub Actions and GitHub Pages**:
1. Configured `vite.config.ts` with `base: './'` so that asset URLs in `dist/index.html` resolve relatively under any repository path (e.g., `https://cptnope.github.io/Chess-RPG-Tactics/`) or custom domain.
2. Created `.github/workflows/deploy.yml` using modern standard actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`).
3. Set triggers on `push` to `main` and manual `workflow_dispatch`.

## Consequences
### Positive
- Fully automated: every `git push origin main` triggers a fresh TypeScript compilation, Vite production build, and zero-downtime deployment to GitHub Pages.
- Free, scalable static hosting with HTTPS by default.
- Relative asset paths prevent broken asset 404s common with hardcoded root paths.

### Negative
- Requires repository setting `Source: GitHub Actions` under Settings -> Pages to be enabled once by the repository owner.
