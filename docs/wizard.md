# The wizard, question by question

`pnpm generate` (or `node bin/gov.mjs create`) asks a short series of questions, shows a summary and writes nothing until you confirm. This page walks through a complete run.

Below is a complete, realistic run for a hypothetical company **Example Org**, building a product with a website and a brand-assets repo. Every question shows what to type, why, and what it changes.

> Press **Enter** to accept any `[default]`. Nothing is written until the final confirmation; answering `n` there writes nothing.

### Part 1 — The organisation

| # | Question | Example answer | What it does |
|---|---|---|---|
| 1 | **Organisation / company name** | `Example Org` | Used in every document header, copyright line, `CLAUDE.md` and README. Also derives the folder slug (`example-org`). |
| 2 | **Owner shown in document headers** | *(Enter → `Example Org`)* | Fills the `Owner` field of every generated doc. Use the **company or team name**, not a person — people change, the registry should not. |
| 3 | **GitHub organisation/user that will own the repos** | `example-org` | Where repos are created when you publish (`example-org/platform`), and what the ruleset commands target. Doesn't touch GitHub until you opt in later. |
| 4 | **Folder to create everything in** | `~/code/example-org` | Absolute or `~` path. One subfolder is created per repo, plus `governance.json`. Default is `./<slug>` under where you ran the command. |

### Part 2 — The rules

| # | Question | Example answer | What it does |
|---|---|---|---|
| 5 | **Regulated / audit-sensitive?** | `n` for most products; `y` if you handle personal data, payments, health, or must prove how defects were fixed | `y` adds the remediation layers **L6** (audit + plan), **L6.1** (execution evidence) and **L7** (forensic chain of custody), plus the remediation rules in `CLAUDE.md`. `n` keeps L0–L5 for product repos. |
| 6 | **Block AI attribution in commits and PRs?** | *(Enter → `y`)* | `y`: the `commit-msg` hook rejects `Co-Authored-By: Claude`, "Generated with…" and session links, and CI rejects them in PR bodies. `n`: those checks aren't generated. |

### Part 3 — The repositories

You add repositories one at a time. For each you answer five things, then choose whether to add another. A typical product has three.

**Repo 1 — the product codebase** *(the main codebase; it owns product facts such as API contracts and data models, and takes its brand from the assets repo)*

| Question | Example answer | What it does |
|---|---|---|
| Repo name (kebab-case) | `platform` | Folder name and GitHub repo name. Lowercase, hyphens only. |
| Type | `product` | Picks the layer set, workflows and `CLAUDE.md` style. See [Repository types](concepts.md#repository-types). |
| One-line description | `Parcel shipping and freight marketplace: mobile app, admin, backend services.` | Appears in the repo's README, in siblings' `CLAUDE.md`, and in the GitHub repo description. |
| Follows which repos? | `assets` | Takes its brand (logo, palette) from the assets repo. Use *(blank)* if it follows nobody. |
| Source of truth for? | `API contracts, shared data models` | Rendered as "this repo is the source of truth for…" so agents never edit those things in a follower. |

**Repo 2 — the public website**

| Question | Example answer | What it does |
|---|---|---|
| Repo name | `website` | |
| Type | `site` | Gets L3 (and L6/L6.1/L7 if regulated). No L0 copy — it points at the standards repo. |
| Description | `Public marketing site, deployed to example.org.` | |
| Follows which repos? | `platform, assets` | Its `CLAUDE.md` will say it follows both: product facts come from `platform`, the brand comes from `assets` - change them there first. |
| Source of truth for? | *(blank)* | |

**Repo 3 — brand assets**

| Question | Example answer | What it does |
|---|---|---|
| Repo name | `assets` | |
| Type | `assets` | Minimal: no doc layers, just governance files and a `CLAUDE.md` that makes this repo the brand's source of truth. |
| Description | `Logo family, social templates and campaign renders.` | |
| Follows which repos? | *(blank)* | The brand starts here, so it follows nobody. |
| Source of truth for? | *(Enter - defaults to logos, palette, fonts and brand media)* | Rendered into every other repo's `CLAUDE.md` as "takes its brand from this repo". |

When asked **"Add another repository?"** answer `y` until you've entered them all, then `n`.

> **Direction matters.** "Follows" points at the repo that *leads*. If `website` follows `assets`, then a logo or brand-colour change is made in `assets` first and copied to `website` afterwards — never the reverse. Getting this backwards produces agent instructions that tell Claude to edit the wrong repo.

### Part 4 — The wiring

| # | Question | Example answer | What it does |
|---|---|---|---|
| — | **Which repo holds the org-wide L0 standards?** *(only asked when there are several repos)* | *(Enter → `platform`)* | That repo gets the full `docs/L0-foundation/` set (naming, change propagation, engineering principles…). Other repos point to it instead of copying, so there is **one** set of standards. |
| — | **Package manager** | `pnpm` | Fills install/lint/type-check/test commands in CI and `CLAUDE.md`. Choosing `npm` or `yarn` rewrites those commands accordingly. |
| — | **Node version** | `22.15.0` | Used in CI and the setup docs. |
| — | **Create the repos on GitHub and apply rulesets now?** | `n` the first time | `y` queues the GitHub step — and it **asks again with the full plan** before touching anything. |
| — | **Create this now?** | `y` | The final gate. A summary of everything is shown first. `n` writes nothing. |

### The summary you'll see

```
── Summary ─────────────────────────────────────────
  Org        Example Org (GitHub: example-org)
  Location   /Users/you/code/example-org
  Layers     standard
  Repo       platform  [product]  (holds L0 standards)
  Repo       website   [site]
  Repo       assets    [assets]
  GitHub     not now

Create this now? (y/n) [y]:
```

Next: [after generating](usage.md#5-after-generating) · [how it all fits together](concepts.md)
