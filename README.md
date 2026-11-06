# imtrinity94.github.io

Personal site of **Mayank Goyal**: VCF Automation & Orchestrator tools, MCP servers and open-source work.

Live at **https://imtrinity94.github.io**

## How projects work

- Every public, non-fork, non-archived repo is pulled **live from the GitHub API**, so new repos show up on their own.
- `projects.json` controls the big **featured** cards (order, title, tagline, tags, live link) and a `hidden` list.
- **Curator mode:** open `https://imtrinity94.github.io/?curate`. It lists every repo, marks the ones you haven't reviewed yet as **NEW**, and lets you pick ★ feature / ◌ auto / ✕ hide. Then it downloads a fresh `projects.json` for you to commit.

## Stack

Plain HTML/CSS/JS with no build step. The hero is a slowly turning cluster of glass-wireframe objects drawn with Three.js and custom shaders. Each page view picks 18 objects at random from a pool of about 70 (cloud, servers, gears, workflows, security, networking, code tokens and more), a random colour palette and a random arrangement. Scrolling down ungroups it and shatters each object into glowing glass shards; scrolling up rebuilds it. It only appears in the free space beside the hero text, with a gap, and is hidden when there isn't room (phones, narrow windows). Edit the `POOL`, `TOKENS` and `PALETTES` lists in `assets/js/hero.js` to change what can appear. Three.js, its FontLoader and the font are bundled in `assets/vendor`. Blog posts come from the cloudblogger.co.in WordPress.com public API. Shortcuts: `Ctrl/⌘ K` or `/` opens the command palette.
