## Why

Dispatching the manual registry publication fails in the publish job with `ENOENT: no such file or directory, open 'vsix/*.vsix'`. The release `.vsix` files are downloaded into a `vsix/` directory, then removed before publishing, so nothing reaches the Visual Studio Marketplace or Open VSX.

## What Changes

- The publish job SHALL have the checked-out repository and the downloaded `.vsix` files present together, so the files it publishes still exist when publishing starts.
- The publish job SHALL fail before contacting either registry when no `.vsix` file is present in the publish directory.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `meta/release-artifacts`: manual registry publication must publish the downloaded `.vsix` files and stop early when none are present.

## Impact

- `.github/workflows/publish-extensions.yaml` (`publish` job).
- `openspec/specs/meta/release-artifacts/spec.md` gains one scenario.
- Non-goals: changing release contents, registry credentials, the approval environment, or how the `.vsix` files are built.
