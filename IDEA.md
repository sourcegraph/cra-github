# Ideas for CRA-GitHub

## Action-Only GitHub App for Custom Branding

### Problem
Current workflow uses `GITHUB_TOKEN` which always posts reviews as "github-actions[bot]" with generic avatar. No way to customize the identity.

### Solution: Action-Only GitHub App
Create a GitHub App that provides authentication tokens to workflows without requiring hosted webhooks.

**Key Insight**: GitHub Apps can be used purely for identity/authentication in workflows without needing a 24/7 server.

### Implementation
1. **Create GitHub App** with custom name ("Amp Code Review") and logo
2. **Configure permissions**: Pull requests (write), Checks (write), Contents (read)
3. **No webhook URL needed** - app only provides tokens
4. **Update workflow** to use `actions/create-github-app-token@v1`
5. **Users install app + copy modified workflow**

### Benefits
- ✅ Custom branding ("Amp Code Review[bot]" with logo)
- ✅ No hosting infrastructure required
- ✅ Same compute model (runs on user's GitHub Actions)
- ✅ Backwards compatible (can offer both options)

### User Setup
1. Install "Amp Code Review" GitHub App on repo
2. Set secrets: `AMP_APP_ID`, `AMP_PRIVATE_KEY`, `AMP_API_KEY`
3. Copy modified workflow that generates app token
4. Reviews appear with custom branding

### Modified Workflow
```yaml
steps:
  - uses: actions/create-github-app-token@v1
    id: app-token
    with:
      app-id: ${{ secrets.AMP_APP_ID }}
      private-key: ${{ secrets.AMP_PRIVATE_KEY }}

  - name: Run Amp Code Review
    uses: docker://ghcr.io/sourcegraph/cra-github:latest
    env:
      GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}  # App token
      AMP_SERVER_URL: ${{ vars.AMP_SERVER_URL }}
      AMP_API_KEY: ${{ secrets.AMP_API_KEY }}
```

### Trade-offs
- **Pro**: Custom branding without hosting costs
- **Con**: Slightly more complex user setup (install app + workflow)
- **Pro**: Can coexist with current simple approach
