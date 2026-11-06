## REMOVED Requirements

### Requirement: Unpacked extension for local loading

**Reason**: Local loading moves to `vw-bleeds/variant-vscode` under `meta/dev-bleeds`. The checkout `out/` directory stays the place for release assets, not the folder an editor loads.

**Migration**: Run `task bleed:vsix` and load `vw-bleeds/variant-vscode` with "Extension from location". `task package:vsix` still writes the `.vsix` release asset.
