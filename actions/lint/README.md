# ContextKit Lint Action

Validate your semantic plane with ContextKit on every pull request.

## Usage

Add the following step to your GitHub Actions workflow:

```yaml
# In your .github/workflows/ci.yml:
- uses: runcontext/lint-action@v1
  with:
    context-dir: context/
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `context-dir` | Path to your context directory | No | `context/` |
| `fail-on-warning` | Fail the check on warnings (not just errors) | No | `false` |

## Example

```yaml
name: CI
on:
  pull_request:
    paths:
      - 'context/**'

jobs:
  lint-context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: runcontext/lint-action@v1
        with:
          context-dir: context/
          fail-on-warning: 'true'
```
