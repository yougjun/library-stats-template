# GitHub Repository Setup

## Creating the Repo

```bash
cd /home/ubuntu/library-stats-template
git init
git branch -m main
git add -A
git commit -m "feat: initial commit"
gh repo create library-stats-template --public --source=.
```

## Push Authentication

The `gh auth git-credential` helper doesn't work in headless/non-TTY environments.
Use token-embedded URL as workaround:

```bash
TOKEN=$(cat /home/ubuntu/.config/gh/hosts.yml | grep oauth_token | awk '{print $2}')
git remote set-url origin "https://yougjun:${TOKEN}@github.com/yougjun/library-stats-template.git"
git push -u origin main
# Reset URL after push to avoid storing token
git remote set-url origin "https://github.com/yougjun/library-stats-template.git"
```

## Enable GitHub Pages

```bash
gh api repos/yougjun/library-stats-template/pages -X POST --input - <<'EOF'
{
  "build_type": "workflow",
  "source": { "branch": "main", "path": "/" }
}
EOF
```

Site URL: `https://yougjun.github.io/library-stats-template/`
