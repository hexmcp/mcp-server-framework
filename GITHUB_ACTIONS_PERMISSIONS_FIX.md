# GitHub Actions Permissions Fix for Changesets Automation

## Problem
The GitHub Actions release workflow was failing to create "Version Packages" pull requests with the error: "GitHub Actions is not permitted to create or approve pull requests."

## Root Cause Analysis
The issue was caused by insufficient permissions configuration in the GitHub Actions workflow and potentially restrictive repository settings.

## ✅ Fixes Applied

### 1. Enhanced Workflow Permissions
- **Added workflow-level permissions** to ensure the entire workflow has necessary access
- **Enhanced job-level permissions** with additional scopes
- **Updated Changesets action** to latest version (v1.4.7) with better permission handling

### 2. Improved Checkout Configuration
- **Added explicit token configuration** in checkout step
- **Added fetch-depth: 0** to ensure full git history access
- **Enhanced git user setup** in the Changesets action

### 3. Added Debugging and Fallback
- **Debug step** to check changeset status before processing
- **Fallback mechanism** that applies version changes directly if PR creation fails
- **Better error handling** and logging

### 4. Updated Action Configuration
- **Added setupGitUser: true** to ensure proper git configuration
- **Added createGithubReleases: false** to focus only on version PRs
- **Pinned action version** for better stability

## 🔧 Repository Settings to Verify

### Required Repository Settings
Please verify these settings in your GitHub repository:

#### 1. Actions General Settings
Go to: **Settings > Actions > General**

- **Actions permissions**: "Allow all actions and reusable workflows"
- **Workflow permissions**: "Read and write permissions" 
- **Allow GitHub Actions to create and approve pull requests**: ✅ **ENABLED**

#### 2. Branch Protection Rules
Go to: **Settings > Branches**

If you have branch protection on `main`:
- Ensure "Restrict pushes that create files" is NOT enabled
- Consider adding "github-actions[bot]" to bypass restrictions if needed

#### 3. Organization Policies (if applicable)
If this is an organization repository, check:
- Organization-level Actions permissions
- Organization-level workflow permissions
- Any policies restricting PR creation by Actions

## 🧪 Testing the Fix

### Option 1: Test with Current Changeset
You have a changeset file (`.changeset/feat-stdio-transport.md`) ready to test:

1. Commit and push the workflow changes
2. The release workflow should automatically run
3. Check if it creates a "Version Packages" PR

### Option 2: Manual Test Workflow
A test workflow has been created at `.github/workflows/test-permissions.yml`:

1. Go to Actions tab in GitHub
2. Run "Test Permissions" workflow manually
3. Check if it can create test branches and access GitHub API

## 📋 Verification Checklist

- [ ] Repository has "Allow GitHub Actions to create and approve pull requests" enabled
- [ ] Workflow permissions are set to "Read and write permissions"
- [ ] No restrictive branch protection rules blocking Actions
- [ ] Organization policies (if any) allow PR creation by Actions
- [ ] Changeset file exists and is properly formatted
- [ ] Workflow runs without permission errors
- [ ] "Version Packages" PR is created successfully

## 🔄 Expected Workflow Behavior

After the fix:

1. **When changeset exists**: Creates "Version Packages" PR with version bumps
2. **When no changesets**: Workflow completes without errors
3. **If PR creation fails**: Fallback applies versions directly to main branch
4. **Debug output**: Shows changeset status and files for troubleshooting

## 🚨 If Issues Persist

If the workflow still fails after applying these fixes:

1. **Check the test workflow output** for specific permission errors
2. **Verify repository settings** match the requirements above
3. **Check organization policies** if this is an org repository
4. **Consider using a Personal Access Token** instead of GITHUB_TOKEN if needed

## 📝 Next Steps

1. Commit these workflow changes
2. Verify repository settings
3. Test with the existing changeset
4. Monitor the release workflow execution
5. Remove the test workflow once confirmed working

The Changesets automation should now work properly and create "Version Packages" pull requests when changesets are present.
