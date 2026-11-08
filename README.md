# Sprint Timeline

An Azure DevOps extension that adds a **Timeline** tab to the Sprints page.
It draws the whole sprint: development, then every step the team runs after it, such as UAT, the release and the close-out, with a line for today.

## Status

1.0.0, public on the Visual Studio Marketplace since 2026-11-08, after a live check in a sandbox organization.
Install it from the Marketplace listing "Sprint Timeline" by Scott Turner.
See `docs/plans/sprint-timeline-v1.md` for the plan and what is still open.

## How it works

| Part | File | What it does |
|---|---|---|
| Rules | `src/model.ts` | Turns a sprint and the team's steps into dates, in the team's working days. |
| Drawing | `src/render.ts` | Turns a timeline into the status line, the chart and the table. |
| Which sprint | `src/context.ts` | Reads the team and the sprint the page shows, and falls back to today's sprint. |
| Step form | `src/editor.ts` | Draws the form for a team's steps and checks what it reads back. |
| Tab | `src/tab.ts` | Connects the parts to Azure DevOps: sprints, working days, saved steps. |

Each step is stored once per team in the extension's own data storage, as `{ version: 1, steps: [...] }`.
A step starts a number of working days from the sprint's last day, or from its first day when the step has `from: "start"`.
0 is that day itself, a positive number counts forward, and a negative number counts back. A step lasts a number of working days.
A step with no `from` counts from the last day, so a document saved by 1.0 reads the same in 1.1.

## Local build

```bash
npm install
npm test           # rules, drawing, sprint picking and the step form
npm run typecheck
npm run preview    # screenshots of static/preview.html in light and dark, to out/preview/
npm run package    # tests, build, then a .vsix in out/
```

`npm run preview` uses the installed Google Chrome through Playwright, headless.

## Provenance

An independent implementation by Scott Turner, MIT license.
