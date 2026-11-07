## MODIFIED Requirements

### Requirement: Workflow actions run on the supported Node runtime

Every GitHub Action that the workflows under `.github/workflows/` use SHALL be pinned either to a major version, or to the full commit of a release of that major, that runs on the Node.js 24 runtime (or is a composite action), so a run reports no annotation that an action targets a deprecated Node.js runtime. The actions are `actions/checkout`, `actions/upload-artifact`, `actions/download-artifact`, `jdx/mise-action`, `jdx/packslip`, `oven-sh/setup-bun`, `actions/upload-pages-artifact`, `actions/deploy-pages` and `azure/login` (when enabled). Outside `.github/workflows/packslip.yaml`, `actions/upload-artifact` and `actions/download-artifact` SHALL stay pinned to a major version.

#### Scenario: Run without Node deprecation annotations

- **WHEN** the CI workflow runs on a feature branch
- **THEN** its annotations hold no warning that an action targets Node.js 20

#### Scenario: Other workflows keep major pins

- **WHEN** a workflow other than `.github/workflows/packslip.yaml` is read
- **THEN** `actions/upload-artifact` and `actions/download-artifact` are pinned to a major version
