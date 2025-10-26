# Git Workflow Reference Guide

## Basic Git Commands

### Checking Status and Changes
```bash
# Check repository status
git status

# View changes in files
git diff
```

### Adding and Committing Changes

```bash
# Stage all changes
git add .

# Stage specific file
git add filename.ext

# Commit changes with message
git commit -m "Your descriptive commit message"

# Stage and commit all changes in one command
git commit -am "Your descriptive commit message"
```

### Working with Tags

```bash
# Create a new annotated tag
git tag -a v1.0.0 -m "Version 1.0.0"

# Push tags to remote
git push origin --tags

# List all tags
git tag -l

# Delete a tag locally
git tag -d tagname

# Delete a tag from remote
git push origin --delete tagname
```

### Pushing and Pulling

```bash
# Push changes to remote
git push origin main

# Push changes and tags
git push origin main --tags

# Pull latest changes
git pull origin main
```

## Best Practices

1. **Commit Messages**
   - Use clear, descriptive commit messages
   - Start with a verb (Add, Update, Fix, Refactor, etc.)
   - Keep the first line under 50 characters
   - Add detailed description if needed after a blank line

2. **Version Tagging**
   - Use semantic versioning (MAJOR.MINOR.PATCH)
   - Tag significant releases
   - Include release notes in tag annotations

3. **Before Committing**
   - Review changes with `git status` and `git diff`
   - Ensure only intended files are staged
   - Test your changes before committing

4. **Regular Updates**
   - Pull changes regularly from the main branch
   - Resolve conflicts promptly
   - Keep local repository up to date

## Common Workflows

### Feature Development
1. Pull latest changes: `git pull origin main`
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and commit regularly
4. Push feature branch: `git push origin feature-name`
5. Create pull request when ready

### Version Release
1. Ensure all changes are committed
2. Create version tag: `git tag -a v1.0.0 -m "Version 1.0.0"`
3. Push changes and tags: `git push origin main --tags`

### Fixing Mistakes
```bash
# Undo last commit (keep changes)
git reset --soft HEAD^

# Discard all local changes
git reset --hard HEAD

# Amend last commit message
git commit --amend -m "New message"
```

## Git Configuration

```bash
# Set global user name
git config --global user.name "Your Name"

# Set global email
git config --global user.email "your.email@example.com"

# Set default branch name
git config --global init.defaultBranch main
```
