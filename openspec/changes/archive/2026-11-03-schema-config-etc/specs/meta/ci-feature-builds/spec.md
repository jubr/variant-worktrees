## ADDED Requirements

### Requirement: Workflow actions run on the supported Node runtime

Every GitHub Action that the workflows under `.github/workflows/` use SHALL be pinned to a major version that runs on the Node.js 24 runtime (or is a composite action), so a run reports no annotation that an action targets a deprecated Node.js runtime. The actions are `actions/checkout`, `actions/upload-artifact`, `actions/download-artifact`, `jdx/mise-action`, `oven-sh/setup-bun`, `actions/upload-pages-artifact`, `actions/deploy-pages` and `azure/login` (when enabled).

#### Scenario: Run without Node deprecation annotations

- **WHEN** the CI workflow runs on a feature branch
- **THEN** its annotations hold no warning that an action targets Node.js 20
