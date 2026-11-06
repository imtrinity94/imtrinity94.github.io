# imtrinity94.github.io

Personal site of **Mayank Goyal**: VCF Automation & Orchestrator tools, MCP servers and open-source work.

Live at **https://imtrinity94.github.io**

## How projects work

- Every public, non-fork, non-archived repo is pulled **live from the GitHub API**, so new repos show up on their own.
- `projects.json` controls the big **featured** cards (order, title, tagline, tags, live link) and a `hidden` list.
- **Curator mode:** open `https://imtrinity94.github.io/?curate`. It lists every repo, marks the ones you haven't reviewed yet as **NEW**, and lets you pick ★ feature / ◌ auto / ✕ hide. Then it downloads a fresh `projects.json` for you to commit.

## Stack

Plain HTML/CSS/JS with no build step. The hero is a slowly turning cluster of glass-wireframe objects (cloud, server rack, database, gears, workflow, run button, containers, network, `{ }`, `>_`, `JS`) drawn with Three.js and custom shaders. Scrolling down ungroups it and shatters each object into glowing glass shards; scrolling up reassembles it. Three.js, its FontLoader and a tiny glyph subset are bundled in `assets/vendor`. Blog posts come from the cloudblogger.co.in WordPress.com public API. Shortcuts: `Ctrl/⌘ K` or `/` opens the command palette.
