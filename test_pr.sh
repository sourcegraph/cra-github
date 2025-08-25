#!/bin/bash

# Test PR Creation Script for CRA Testing
# Creates a test PR in sayansisodiya/dead-code-agent to trigger code review

set -e

REPO_OWNER="sayansisodiya"
REPO_NAME="dead-code-agent"
BRANCH_NAME="test-cra-$(date +%s)"
PR_TITLE="[TEST] Add logging to main.py - CRA Test"
PR_BODY="This is a test PR created to test the Code Review Agent functionality. 

Changes:
- Add debug logging to main.py
- Add error handling improvement
- This should trigger the CRA for review"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is required but not installed."
    echo "Install it with: brew install gh"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Please authenticate with GitHub CLI first:"
    echo "gh auth login"
    exit 1
fi

echo "🔍 Checking for existing test PRs..."

# Close any existing test PRs created by this script and delete their branches
EXISTING_PRS=$(gh pr list --repo "$REPO_OWNER/$REPO_NAME" --author "@me" --search "in:title TEST CRA Test" --json number,title,headRefName --jq '.[] | "\(.number) \(.headRefName)"')

if [ ! -z "$EXISTING_PRS" ]; then
    echo "📝 Found existing test PRs. Closing them and deleting branches..."
    while read -r pr_info; do
        pr_number=$(echo "$pr_info" | cut -d' ' -f1)
        branch_name=$(echo "$pr_info" | cut -d' ' -f2)
        echo "  Closing PR #$pr_number and deleting branch $branch_name"
        gh pr close "$pr_number" --repo "$REPO_OWNER/$REPO_NAME" --comment "Closed by test script to create new test PR"
        gh api --method DELETE "repos/$REPO_OWNER/$REPO_NAME/git/refs/heads/$branch_name" 2>/dev/null || echo "    Branch $branch_name already deleted or doesn't exist"
    done <<< "$EXISTING_PRS"
fi

# Clone the repo to a temp directory
TEMP_DIR=$(mktemp -d)
echo "📁 Cloning repo to $TEMP_DIR..."

cd "$TEMP_DIR"
gh repo clone "$REPO_OWNER/$REPO_NAME" .

# Create a new branch
echo "🌿 Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

# Make some test changes that would be interesting for code review
echo "✏️ Making test changes..."

# Add some debug logging to main.py (common change that CRA can review)
sed -i '' '/import sys/a\
import logging\
\
# Configure logging\
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")' main.py

# Add a logging statement in the main function
sed -i '' '/def extract_repo_name/i\
def main_with_logging():\
    """Main function with enhanced logging."""\
    logging.info("Starting dead code analysis tool")\
    try:\
        # Original main logic would go here\
        logging.debug("Tool execution completed successfully")\
    except Exception as e:\
        logging.error(f"Tool execution failed: {e}")\
        raise\
\
' main.py

# Add a potential issue for CRA to catch (missing error handling)
cat >> analyzers.py << 'EOF'

def risky_function():
    """Function with potential issues for CRA to review."""
    # Potential issue: No error handling for file operations
    with open("nonexistent_file.txt", "r") as f:
        content = f.read()
    
    # Potential issue: Division by zero risk
    result = 100 / len(content)
    
    # Potential issue: Unreachable code
    print("This code might not be reached")
    return result
EOF

# Stage and commit changes
git add .
git commit -m "Add logging and error handling improvements

- Add debug logging configuration to main.py
- Add main_with_logging function for better error tracking  
- Add risky_function to analyzers.py (needs review)
- Improve error handling patterns"

# Push the branch
echo "⬆️ Pushing branch to GitHub..."
git push origin "$BRANCH_NAME"

# Create the PR
echo "🔄 Creating pull request..."
PR_URL=$(gh pr create \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    --base main \
    --head "$BRANCH_NAME" \
    --repo "$REPO_OWNER/$REPO_NAME")

echo "✅ Test PR created successfully!"
echo "🔗 PR URL: $PR_URL"
echo ""
echo "👀 The Code Review Agent should now:"
echo "   1. Detect the PR webhook"
echo "   2. Create a check run"
echo "   3. Analyze the code changes"
echo "   4. Leave inline comments and review feedback"
echo ""
echo "🧹 Cleanup: The temporary directory will be removed"
cd /
rm -rf "$TEMP_DIR"

echo "🎯 Monitor your CRA server logs and check the PR for review comments!"
