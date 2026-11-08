---
status: in-progress
type: plan
scope: M
created: 2026-11-08
lastUpdated: 2026-11-08
owner: Scott Turner
---

# Plan: Sprint Timeline v1

## Summary

Scott asked on 2026-11-08 to see the whole sprint in Azure DevOps, not only the two development dates, and asked for an extension that shows it graphically. He chose a tab on the Sprints page and a public listing, as Tall Text has. The tab draws development, each step after it, the next sprint and today. A team sets its own steps, so the extension fits any cadence.

The default steps match a common cadence: UAT on the Monday and Tuesday after the last day of development, the release on the Wednesday and the close-out on the Thursday. A team on that cadence needs no setup.

## Decisions

| # | Decision | Ruling |
| --- | --- | --- |
| 1 | Where the timeline shows | Scott, 2026-11-08: a Timeline tab on the Sprints page. |
| 2 | Who can install it | Scott, 2026-11-08: public, like Tall Text, so each team sets its own steps. |
| 3 | Who can change a team's steps | Default: anyone who can open the tab. The steps are stored once per team. |

## Tasks

| # | Task | State |
| --- | --- | --- |
| 1 | Toolchain as Tall Text's: TypeScript, esbuild, tfx, vitest. SDK 4.2, because the API package supports SDK 2 to 4 only. | Done 2026-11-08 |
| 2 | Rules: step dates in working days, where today falls, which sprint, reading saved steps. | Done 2026-11-08, 18 tests |
| 3 | Drawing: status line, chart, table, escaping. | Done 2026-11-08, 12 tests |
| 4 | Which team and sprint the page shows, with a fallback to today's sprint. | Done 2026-11-08, 9 tests |
| 5 | Step form and its checks. | Done 2026-11-08, 5 tests |
| 6 | Tab glue: SDK, team sprints, working days, saved steps, redraw on a sprint change. | Built 2026-11-08, type-checked, not yet run in Azure DevOps |
| 7 | Local preview in light and dark, and the listing assets. | Done 2026-11-08 |
| 8 | Package the .vsix. | Done 2026-11-08: 0.1.0, 107 KB, holds only the tab page, its script and styles, the images, the overview and the license |
| 9 | Publish privately, share with the sandbox organization scottturner-dev, install, and check the tab on a real Sprints page: that it shows, which context the page passes, and that saving steps works. | Published privately on Scott's "Publish privately and test", shared with and installed in scottturner-dev only, 2026-11-08. The sandbox project's Iterations 1 to 3 now carry dates (10/26 to 12/4). Live look done 2026-11-08 in Scott's Chrome signed in as the sandbox owner: the Timeline tab shows on the new Sprints page beside Taskboard, Backlog, Capacity and Analytics; it follows the page's sprint picker (Iteration 2 to 3); it follows the dark theme; Iteration 1 on Sun 11/8 reads "UAT starts Mon 11/9" with today's line on 11/8; a saved step survives a reload. 0.1.1 fixed a Save that did nothing on its first press (`docs/live-check/`) |
| 10 | Public listing and a public GitHub repo. | Scott chose both on 2026-11-08 after the live look. 1.0.0 public, and the repo starts from one clean commit, with sample names in place of the first organization's names |
| 11 | Install in the first consuming organization through its admin, as Tall Text was, and check the tab there. | Asked of that organization's admin on 2026-11-08, as for Tall Text. The admin installed 1.0.0 on 2026-11-08, and the extension management API reads it as installed and enabled. Open: a look at the Timeline tab on one of its Sprints pages with the default steps |

## Open questions that only a live test answers

- Microsoft documents the tab target `ms.vss-work-web.iteration-backlog-tabs`, but not whether it shows on the new Sprints page, nor what it passes the tab about the selected sprint. The tab reads every likely place and falls back to today's sprint, and it has its own buttons for the sprint before and after.
- Who may write the extension's data storage in an organization is not documented. The tab shows an error in place if a save fails.

## Progress notes

| Date | Note |
| --- | --- |
| 2026-11-08 | Scott asked for the extension after the Delivery Plan markers did not give him the picture he wanted. |
| 2026-11-08 | The preview showed the development bar covering its label and the last days cut off at 1000 pixels. The label column went to 236 pixels and a day to 36, and both views fit. |
| 2026-11-08 | The API package supports SDK 2 to 4 only, so the tab uses SDK 4.2, not Tall Text's 5.0. |
| 2026-11-08 | The sandbox is tied to a personal Microsoft account, so it takes only personal accounts. Adding a work account left a pending entry that cannot sign in, and it was removed the same minute. A live look needs a browser signed in as the sandbox owner. |
| 2026-11-08 | In 0.1.0 one Save press after "Use the default steps" did nothing, with no error, and a second press saved. The storage connection was opened outside the error handling. 0.1.1 keeps one connection, shows "Saving" on the button, blocks a second press and shows an error after 15 seconds; on 0.1.1 both test saves went through on the first press. |
| 2026-11-08 | Open: the Microsoft documents give no shape for the context a tab receives. The tab follows the picker in the live test, so the route of the page names the sprint. |
| 2026-11-08 | The first consuming organization installed 1.0.0. A read of its installed extensions shows version 1.0.0 with no disabled flag. |
