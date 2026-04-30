# minimal-tech — a Hugo theme

A minimal, slightly terminal-tinged blog theme built around three sections:

- `~/learning` — code, source dives, technical notes (with syntax-highlighted code blocks)
- `~/work` — process, retrospectives, team notes
- `~/life` — anything else

## Features

- Light + dark mode, persisted to `localStorage`
- Single OKLCH accent color (configurable hue + chroma)
- Three density presets (compact / regular / comfy) + base font slider
- Inter for prose, JetBrains Mono for code & UI chrome
- Terminal-style hero with `whoami` / `ls` prompt
- Timeline post list grouped by year-month
- Activity heatmap (last 26 weeks)
- Sidebar: `/now`, `/stats`, `/elsewhere`
- Per-article TOC with scroll-spy
- Code blocks via Hugo's Chroma — dual light/dark theme switched by `[data-theme]`, copy button included
- **Comments**: Giscus or Utterances, configured in `hugo.toml`
- **Search**: Pagefind static index — runs at build time, no server
- Tag pages, archive page, RSS feed
- No JS framework, no build step (besides Hugo itself)

## Setup

```sh
hugo new site myblog
cd myblog
git submodule add https://example.com/minimal-tech.git themes/minimal-tech
cp themes/minimal-tech/exampleSite/hugo.toml ./hugo.toml
hugo new content/learning/my-first-post.md
hugo server
```

## Building search index

After every `hugo` build, run:

```sh
npx -y pagefind --site public
```

Or in CI / Makefile:

```make
build:
	hugo --minify
	npx -y pagefind --site public
```

## Comments

Edit `[params.comments]` in `hugo.toml`. For Giscus, follow https://giscus.app
to get `repoId` / `categoryId`. The theme passes `preferred_color_scheme` so
comments track your site's light/dark setting automatically.

To opt out per post, add `comments: false` to the front matter.

## Front matter

```yaml
---
title: "React Fiber 的协调算法：从递归到可中断"
date: 2026-04-22
draft: false
categories: ["learning"]
tags: ["React", "源码"]
excerpt: "为什么 16 之后 React 抛弃了递归？"
pinned: false
hasCode: true
comments: true
---
```

## Configurable params

See `exampleSite/hugo.toml` — `signature`, `tagline`, `accentHue`, `accentChroma`,
`defaultDark`, `showHeatmap`, `search`, `now.*`, social links, `comments.*`.
