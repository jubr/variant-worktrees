## Purpose

Present the supplied chat-renamer artwork as the extension icon and the package README mark, at the pixel size those surfaces use.

## ADDED Requirements

### Requirement: Extension icon

The chat-renamer-vscode extension manifest SHALL set `icon` to a PNG that is 128×128 pixels and is a square downscale of the supplied source artwork, masked to a rounded rectangle. The packaged extension SHALL contain that file.

#### Scenario: Manifest icon is 128 pixels

- **WHEN** the chat-renamer-vscode extension manifest is read
- **THEN** `icon` resolves to an existing PNG whose width and height are both 128

#### Scenario: Packaged extension contains the icon

- **WHEN** the chat-renamer-vscode extension is packaged
- **THEN** the package contains the file named by `icon`

### Requirement: Published icon size

The product SHALL publish a square PNG downscale of the supplied source artwork at 128 pixels. The file SHALL be that artwork scaled to the square and then masked to a rounded rectangle flush with the icon sides. The corner radius SHALL be one tenth of the icon side. Pixels whose centers lie outside that rounded rectangle SHALL be fully transparent. Pixels whose centers lie inside it SHALL be the scaled artwork. The result SHALL NOT be an upscale of the source and SHALL NOT be a different picture.

#### Scenario: 128 pixel icon

- **WHEN** the 128-pixel icon is read
- **THEN** it is a PNG whose width and height are both 128
- **AND** pixels inside the rounded rectangle are the supplied artwork scaled to 128×128
- **AND** pixels outside that rounded rectangle are fully transparent

### Requirement: Package README mark

The chat-renamer package README SHALL display the 128×128 icon.

#### Scenario: README shows the icon

- **WHEN** the chat-renamer package README is rendered
- **THEN** it includes the 128×128 icon
