## Purpose

Present the supplied variant-worktrees artwork as the extension icon, the docs site logo and favicon, and the repository README mark, each at the pixel size that surface uses.

## ADDED Requirements

### Requirement: Extension icon

The variant-vscode extension manifest SHALL set `icon` to a PNG that is 256×256 pixels and is a square downscale of the supplied source artwork. The packaged extension SHALL contain that file.

#### Scenario: Manifest icon is 256 pixels

- **WHEN** the variant-vscode extension manifest is read
- **THEN** `icon` resolves to an existing PNG whose width and height are both 256

#### Scenario: Packaged extension contains the icon

- **WHEN** the variant-vscode extension is packaged
- **THEN** the package contains the file named by `icon`

### Requirement: Published icon sizes

The product SHALL publish square PNG downscales of the supplied source artwork at 256, 128, 32, and 16 pixels. Each file SHALL be that artwork scaled to the square, not a different image and not an upscale of the source.

#### Scenario: 128 pixel icon

- **WHEN** the 128-pixel icon is read
- **THEN** it is a PNG whose width and height are both 128 and whose pixels are the supplied artwork scaled to 128×128

#### Scenario: 32 and 16 pixel icons

- **WHEN** the 32-pixel icon and the 16-pixel icon are read
- **THEN** each is a PNG whose width and height equal that size and whose pixels are the supplied artwork scaled to that square

### Requirement: Docs logo and favicon

The docs site SHALL use the 256×256 icon as its navigation logo and SHALL serve the 32×32 and 16×16 icons as favicons.

#### Scenario: Docs site exposes the logo and favicons

- **WHEN** the docs site is built
- **THEN** the navigation logo is the 256×256 icon and the site icon links point at the 32×32 and 16×16 icons

### Requirement: Repository README mark

The repository README SHALL display the 256×256 icon.

#### Scenario: README shows the icon

- **WHEN** the repository README is rendered
- **THEN** it includes the 256×256 icon
