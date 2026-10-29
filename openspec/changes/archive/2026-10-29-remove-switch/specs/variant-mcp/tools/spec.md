## REMOVED Requirements

### Requirement: variant_switch tool

**Reason**: Changing the working directory of the MCP server process does not help an MCP client and silently shifts what later tool calls resolve against. `variant_create` and `variant_provision` already ensure the worktree and report its path.

**Migration**: Call `variant_create` for the slug and use the worktree path in its result.
