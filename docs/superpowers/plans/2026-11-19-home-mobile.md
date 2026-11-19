# Homepage and Mobile Layout Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this small, coupled CSS fix in the current session.

**Goal:** Remove homepage horizontal overflow and improve access to project links on desktop and phones.

**Architecture:** Modify the existing shared ProjectShowcase component and its stylesheet. Keep semantic document order and existing interaction handlers; contain only the decorative pseudo-element.

**Tech Stack:** Astro, CSS, existing browser controls.

**Spec:** ../specs/2026-11-19-home-mobile-design.md

## Global Constraints

- Preserve all real project content, status labels, screenshots, themes and switching.
- No new dependencies, fixed content heights, truncation or root overflow suppression.

## Review Focus

- Narrow phones: long labels wrap without widening the document.
- Short desktop windows: primary links remain accessible without clipping content.
- Mobile project arrows: stay in flow, with usable touch targets.
- Screenshot tabs: preserve layout and correct pressed/hidden state.
- Detail navigation and focus: existing sticky and keyboard behavior remains usable.

## Task 1: Shared showcase layout

- [x] Reproduce overflow and action positions on the unmodified live site; record dimensions.
- [x] Modify src/styles/space-project-showcase.css: constrain decorative bounds, reduce stacked hero spacing, move mobile arrow navigation into flow and reserve its grid columns.
- [x] Modify src/components/portfolio/ProjectShowcase.astro: place existing primary links directly after the description, before secondary capability details.
- [x] Run pnpm check, pnpm type-check, pnpm build and existing showcase regression checks.
- [x] Inspect local desktop/tablet/mobile browser screenshots and DOM bounds; exercise image tabs and mobile menu.
- [x] Review diff and record results before committing or opening a PR.

## Execution rulings

Use existing browser measurements as the failing reproduction for this reversible visual change; do not add CSS-string tests. The user's selected scope authorizes direct execution. Work in an isolated managed checkout to preserve existing local edits.

## Validation results

- Astro check: 298 files, zero errors, zero warnings, five hints (normal font configuration).
- `pnpm exec tsc --noEmit`: passed. The repository's stricter `pnpm type-check` fails on existing missing declaration annotations in galleryConfig.ts:51, portfolio-motion.ts:2 and portfolio-scenes.ts:6; none are modified here.
- `CF_WORKERS=1 CI_SKIP_REMOTE_FONTS=1 pnpm build`: full production pipeline passed, including Pagefind (32 pages). The default build without CF_WORKERS has no server adapter.
- Existing release/discovery tests: 25/25 passed. Full Node suite: 269/270, with the unchanged Python tutorial stdout test failing on Windows CRLF versus expected LF.
- Biome check for ProjectShowcase.astro and git diff --check: passed.
- Real Edge desktop viewports 1366x768 and 1440x900: primary links end at y=421 and y=457 respectively, fully visible.
- Widths 360,390,768,1024,1366,1440: scrollWidth equals clientWidth.
- 390px mobile menu open/Escape close, theme toggle, phone screenshot tab state, and next-project navigation verified.
- Fixed a second negative decorative inset in the screenshot stage: scrollHeight810/clientHeight628/scrollTop102 before; 628/628/0 after clicking phone.
- Increased single-column breakpoint to 900px after inspecting cramped tablet columns.
- Independent static review found no important regressions in the final diff.
- Actual phone hardware and production deployment are not verified.
