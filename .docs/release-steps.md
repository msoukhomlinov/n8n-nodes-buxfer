## Pre-release Checklist
1. Ensure all changes are tested and working
2. Update CHANGELOG.md with new version and changes
3. Check that all necessary files are committed
4. Ensure no sensitive or unnecessary files are being tracked

## Release Commands

### 1. Clean Git Cache (if needed)
```powershell
# Remove all files from git's index
git rm -r --cached .

# Re-add all files (will respect .gitignore)
git add .
```

### 2. Stage and Commit Changes
```powershell
# Stage all changes
git add .

# Create release commit
git commit -m "Release vX.X.X: Brief description of changes"
```

### 3. Create Release Tag
```powershell
# Create an annotated tag
git tag -a vX.X.X -m "Version X.X.X: Detailed description of release"
```

### 4. Push to GitHub
```powershell
# Push commit and tags
git push origin main --tags
```

## Version Number Guidelines
- Major version (X.0.0): Breaking changes
- Minor version (X.Y.0): New features
- Patch version (X.Y.Z): Bug fixes and minor improvements

## Common Issues and Solutions
1. If tag already exists:
   ```powershell
   # Delete local tag
   git tag -d vX.X.X

   # Delete remote tag
   git push origin :refs/tags/vX.X.X
   ```

2. If commit needs to be amended:
   ```powershell
   # Amend last commit
   git commit --amend

   # Force push if already pushed (use with caution)
   git push --force origin main
   ```
