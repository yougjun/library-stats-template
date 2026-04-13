# CI/CD Pipeline

## Workflow: `.github/workflows/ci.yml`

Triggered on push to `main` and pull requests.

### Jobs

#### 1. `lint-and-fix`
- Installs Node.js 20, npm ci
- Runs ESLint with `--fix`
- If changes detected, auto-commits with bot author
- Only commits on push events (not PRs)

#### 2. `build-and-deploy`
- Runs after lint-and-fix
- Only on push to main
- `npm ci` + `npm run build` (tsc + vite build)
- Copies `index.html` to `404.html` for SPA routing
- Deploys to GitHub Pages via `actions/deploy-pages@v4`

#### 3. `python-check`
- Validates all Python files compile (`py_compile`)
- Runs in parallel with lint-and-fix

### Required Secrets
- `GITHUB_TOKEN` — automatic, used for commits and Pages deployment

### Vite Base Path
`vite.config.ts` uses `process.env.GITHUB_ACTIONS` to set base:
- CI: `/library-stats-template/`
- Local: `/`

### SPA Routing on GitHub Pages
`404.html` = copy of `index.html`. GitHub Pages serves 404.html for unknown routes, enabling client-side routing.

## Manual Trigger

Push any change to `main`:
```bash
git add -A && git commit -m "trigger ci" && git push
```

## Monitoring

```bash
gh run list --limit 5
gh run view <run-id> --log
```
