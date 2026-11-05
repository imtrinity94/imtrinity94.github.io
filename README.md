# imtrinity94.github.io

Personal site of **Mayank Goyal**: VCF Automation & Orchestrator tools, MCP servers and open-source work.

Live at **https://imtrinity94.github.io**

## How projects work

- Every public, non-fork, non-archived repo is pulled **live from the GitHub API**, so new repos show up on their own.
- `projects.json` controls the big **featured** cards (order, title, tagline, tags, live link) and a `hidden` list.
- **Curator mode:** open `https://imtrinity94.github.io/?curate`. It lists every repo, marks the ones you haven't reviewed yet as **NEW**, and lets you pick ★ feature / ◌ auto / ✕ hide. Then it downloads a fresh `projects.json` for you to commit.

## Stack

Plain HTML/CSS/JS with no build step. The background is a slow, subtle WebGL particle sphere (Three.js, bundled in `assets/vendor`). It stays still when the system's reduce-motion setting is on. Blog posts come from the cloudblogger.co.in WordPress.com public API. Shortcuts: `Ctrl/⌘ K` or `/` opens the command palette.
