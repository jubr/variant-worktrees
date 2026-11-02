## MODIFIED Requirements

### Requirement: Extension description

The `variant-vscode` manifest `description` SHALL be `Isolated work+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode`.

#### Scenario: Marketplace tagline

- **WHEN** the `variant-vscode` `package.json` is read
- **THEN** its `description` is `Isolated work+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode`

## ADDED Requirements

### Requirement: Extension README has no relative images

The `variant-vscode` package README SHALL NOT embed an image by a repository-relative path, because the extension pages of the marketplaces do not resolve it and render a broken image. The extension icon stays the manifest `icon`.

#### Scenario: No relative image

- **WHEN** the `variant-vscode` package README is read
- **THEN** it contains no markdown image whose target is not an absolute `https://` URL
