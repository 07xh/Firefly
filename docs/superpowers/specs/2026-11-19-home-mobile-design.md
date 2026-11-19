# Homepage and mobile layout

The user selected homepage and mobile layout improvements after reviewing the live site issues.

Keep the existing blue/white palette, dark theme, real project screenshots, project switching, and all capability status labels. Fix the overflowing hero decoration at its source. Reduce accumulated hero spacing and heading size to make primary links visible at common desktop sizes. On phones, keep primary links before the longer capability list and put project navigation in document flow so it cannot cover reading content. Do not constrain content height or truncate descriptions.

Approaches considered: a full visual redesign would discard the established direction; hiding overflow at the document root would conceal layout defects. Chosen approach: focused shared showcase CSS and semantic action ordering, verified in real browsers at desktop, tablet and phone widths.

Acceptance: no horizontal page scrolling at 360, 390, 768, 1024 and 1440px; links fully visible in the initial 1440x900 and 1366x768 desktop viewport; mobile navigation does not overlap content; image switching and theme/menu controls still work. Short phones may scroll naturally. No new dependencies or content changes.
