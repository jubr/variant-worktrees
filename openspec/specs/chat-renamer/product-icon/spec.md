# chat-renamer Specification

## Purpose

Present the supplied chat-renamer artwork as the extension icon. The package README shows the 128×128 mark. The 256×256 file exists so the manifest can point VS Code at it.

## Requirements

### Requirement: Extension icon

The chat-renamer extension manifest SHALL set `icon` to a PNG that is 256×256 pixels and is a square scale of the supplied source artwork. The packaged extension SHALL contain that file.

#### Scenario: Manifest icon is 256 pixels

- **WHEN** the chat-renamer extension manifest is read
- **THEN** `icon` resolves to an existing PNG whose width and height are both 256

#### Scenario: Packaged extension contains the icon

- **WHEN** the chat-renamer extension is packaged
- **THEN** the package contains the file named by `icon`

### Requirement: Published icon sizes

The product SHALL publish square PNG scales of the supplied source artwork at 256 and 128 pixels. Each file SHALL be that artwork scaled to the square. Every pixel SHALL be the scaled artwork. The result SHALL NOT be a different picture.

#### Scenario: 256 pixel icon

- **WHEN** the 256-pixel icon is read
- **THEN** it is a PNG whose width and height are both 256
- **AND** every pixel is the supplied artwork scaled to 256×256

#### Scenario: 128 pixel icon

- **WHEN** the 128-pixel icon is read
- **THEN** it is a PNG whose width and height are both 128
- **AND** every pixel is the supplied artwork scaled to 128×128

### Requirement: Package README mark

The chat-renamer package README SHALL display the 128×128 icon.

#### Scenario: README shows the 128 icon

- **WHEN** the chat-renamer package README is rendered
- **THEN** it includes the 128×128 icon
- **AND** it does not include the 256×256 icon
