# Cursor Dot Files Reference

## Core Configuration Files

### `.cursorconfig`
- Main configuration file for Cursor editor
- Controls editor behaviour, code style, and AI assistance settings
- Includes TypeScript settings, formatting rules, and search configurations
- Project-specific settings that can be version controlled if shared settings are desired

### `.cursorcache`
- Manages Cursor's caching behaviour
- Controls what files are cached and cache size limits
- Improves performance for large codebases
- Should be git-ignored as it's environment-specific

### `.cursorignore`
- Similar to `.gitignore` but for Cursor's indexing
- Specifies which files/directories should be ignored by Cursor's indexing
- Helps improve performance by excluding unnecessary files
- Can be version controlled if team-wide ignores are desired

### `.cursor/`
- Directory containing Cursor's workspace-specific data
- Stores indexes, temporary files, and workspace state
- Should always be git-ignored

### `.cursor-search-cache`
- Contains cached search indices
- Improves search performance
- Should be git-ignored

### `.cursor-settings.json`
- User-specific settings override file
- Takes precedence over `.cursorconfig`
- Should be git-ignored as it contains personal preferences

### `.cursor-snippets`
- Custom code snippets directory
- Contains user-defined code templates
- Can be version controlled if team-wide snippets are desired

### `.cursor-keybindings.json`
- Custom keyboard shortcuts configuration
- User-specific key mappings
- Should be git-ignored as it's user-specific

## Git Integration Files

### `.cursor-git-hooks/`
- Directory for Cursor-specific git hooks
- Can contain pre-commit, post-commit scripts etc.
- Can be version controlled if team-wide hooks are desired

### `.cursor-git-settings.json`
- Git integration settings for Cursor
- Controls git blame, diff viewer, and other git-related features
- Can be version controlled for team-wide git settings

## AI and Language Support

### `.cursor-prompts/`
- Directory for custom AI prompts
- Contains user-defined templates for AI interactions
- Can be version controlled if team-wide prompts are desired

### `.cursor-language-servers/`
- Configuration for language servers
- Controls language-specific features and analysis
- Can be version controlled for consistent team settings

## Recommended Git Ignore Pattern
```gitignore
# Cursor - Environment Specific
.cursorcache
.cursor/
.cursor-search-cache
.cursor-settings.json
.cursor-keybindings.json

# Cursor - Optional Team Files (remove if sharing)
.cursorconfig
.cursorignore
.cursor-snippets/
.cursor-git-hooks/
.cursor-git-settings.json
.cursor-prompts/
.cursor-language-servers/
```

## Notes
- Files marked as "should be git-ignored" contain environment-specific or user-specific settings
- Files that "can be version controlled" contain team-wide settings that might benefit from sharing
- The `.cursor/` directory should always be git-ignored as it contains workspace-specific data 