## ADDED Requirements

### Requirement: Stdio MCP mode
The system SHALL, when started with `--stdio`, serve the same MCP tools over standard input and output without opening a network listener and without requiring a token.

#### Scenario: Started with --stdio
- **WHEN** the sidecar starts with `--stdio` and no `OBSIGRAPH_TOKEN`
- **THEN** an MCP client on stdin and stdout can list and call the tools and no TCP port is open

### Requirement: Data directory outside the vault
The system SHALL refuse to start when the data directory is missing, not writable, equal to the vault directory or inside it, with an error naming both paths.

#### Scenario: Data inside the vault
- **WHEN** `OBSIGRAPH_VAULT=/vault` and `OBSIGRAPH_DATA=/vault/.data`
- **THEN** the sidecar exits with an error saying the data directory must be outside the vault

### Requirement: Atomic state writes
The system SHALL write each derived state file to a temporary file and rename it into place, so a crash never leaves a partially written state file.

#### Scenario: Crash during a write
- **WHEN** the process is killed while the vector metadata is being written
- **THEN** on restart the metadata file holds either the previous or the new complete content
