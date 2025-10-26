# Contributing

Thanks for considering a contribution. This project provides a boilerplate for Cursor AI enhanced development environments. Please follow these guidelines to keep changes easy to review and maintain.

## Getting started
- Use spaces (not tabs) with a tab size of 2.
- Prefer Australian English spelling in documentation.
- Keep changes small and focused.

## Formatting and linting
- Prettier is the source of truth for formatting.
- Before opening a PR, run a Prettier check locally:
  - With Node installed: npx prettier --check .
- CI validates:
  - Prettier formatting
  - Markdown linting
  - Spell check (en-AU)
  - Link checking
  - GitHub Actions lint (actionlint)

## Pull requests
- Target the main branch.
- Use clear, descriptive titles (consider Conventional Commits style).
- Provide a concise description of what changed and why.
- Update documentation if you change behaviour or configuration.

## File conventions
- Licence: MIT in LICENSE.
- Keep .cursorrules lessons updated with durable learnings.
- Avoid adding language specific parsers globally in config files (for example Prettier parser).
- For ESLint in config only repos, avoid parserOptions.project unless tsconfig.json exists and type aware linting is needed.

## CI tips
- Workflows run on push and PRs to main.
- If external sites rate limit link checks, re run the workflow; 429 responses are tolerated per config.

## Communication
- Be respectful and concise.
- Prefer issues and PR comments for discussion.

Thanks again for your contributions!
