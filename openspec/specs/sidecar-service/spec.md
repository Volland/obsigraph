# sidecar-service Specification

## Purpose
Defines a headless service that reads a vault from a read-only mount, keeps the graph and downstream stores (Ladybug mirror, vector index) in sync per changed file, and serves them over an authenticated REST API with identical semantics to the plugin.

## Requirements

### Requirement: Read-only vault access
The system SHALL treat the vault directory as read-only, SHALL NOT create, modify or delete any file inside it, and SHALL keep all derived data in a separate writable data directory.

#### Scenario: Vault mounted read-only
- **WHEN** the container starts with the vault mounted read-only and a data volume mounted writable
- **THEN** the service starts, indexes the vault and writes only into the data volume

#### Scenario: Data directory missing
- **WHEN** no writable data directory is available
- **THEN** the service fails to start with an error naming the data directory

### Requirement: Same semantics as the plugin
The system SHALL parse edges, assign identifiers and execute queries using the same shared core as the plugin, so that the same vault yields the same nodes, edges, identifiers and query results.

#### Scenario: Conformance with plugin
- **WHEN** the same fixture vault and Cypher query are run in the plugin engine and through the sidecar
- **THEN** the sidecar returns the same columns and rows

### Requirement: Initial sync
The system SHALL index the whole vault on first start and, on later starts, SHALL hand only files that changed while it was stopped to downstream processors such as the Ladybug mirror and vector index.

#### Scenario: First start
- **WHEN** the service starts with an empty data directory
- **THEN** every markdown file is parsed and indexed and the status reports sync complete when finished

#### Scenario: Restart after edits
- **WHEN** two notes changed while the service was stopped
- **THEN** on restart only those two notes are re-processed

### Requirement: Live watching
The system SHALL watch the vault directory and update the graph and downstream processors for created, modified, renamed and deleted markdown files, coalescing rapid successive changes to the same file.

#### Scenario: Note edited
- **WHEN** a note gains a new edge line while the service runs
- **THEN** within the configured debounce interval plus processing time the edge is queryable

#### Scenario: Burst of saves
- **WHEN** a file is saved ten times within the debounce interval
- **THEN** it is processed once

#### Scenario: Watching without native events
- **WHEN** the mount does not deliver file events and polling is enabled
- **THEN** changes are still detected at the polling interval

### Requirement: Read-only query surface
The system SHALL reject Cypher statements containing `CREATE`, `SET`, `DELETE` or other write clauses with a clear error.

#### Scenario: Write attempt
- **WHEN** a client submits `CREATE (n:Person)` through REST
- **THEN** the request fails with a client error naming the rejected clause and nothing changes

### Requirement: REST API
The system SHALL provide HTTP endpoints for health, sync status and Cypher query, returning JSON.

#### Scenario: Health
- **WHEN** a client requests the health endpoint
- **THEN** the response reports the service is up without requiring a token and without revealing vault content

#### Scenario: Status
- **WHEN** an authenticated client requests status
- **THEN** it reports note count, edge count, pending files, sync state and last sync time

#### Scenario: Cypher over REST
- **WHEN** an authenticated client posts a read-only Cypher query
- **THEN** the response contains the same `{columns, rows}` contract as the in-plugin engine

### Requirement: Token authentication
The system SHALL require a bearer token on every REST endpoint except health, SHALL compare it in constant time, SHALL reject missing or wrong tokens with a 401, and SHALL NOT log token values.

#### Scenario: Missing token
- **WHEN** a request to the query endpoint carries no token
- **THEN** it receives 401 and no query is executed

#### Scenario: Wrong token
- **WHEN** a request carries an incorrect token
- **THEN** it receives 401

#### Scenario: No token configured
- **WHEN** no token is configured and the unauthenticated override is not set
- **THEN** the service refuses to start

### Requirement: Safe default network binding
The system SHALL bind to loopback by default and SHALL bind to a non-loopback address only when explicitly configured, in which case it SHALL log a warning if no TLS-terminating proxy is declared.

#### Scenario: Default bind
- **WHEN** no bind address is configured
- **THEN** the service listens only on the loopback interface

#### Scenario: Explicit wide bind
- **WHEN** the bind address is set to all interfaces
- **THEN** the service listens there and logs a warning that traffic is unencrypted unless proxied

### Requirement: Bounded request handling
The system SHALL enforce a request body size limit and a query timeout and SHALL return structured errors without stack traces.

#### Scenario: Slow query
- **WHEN** a Cypher query exceeds the timeout
- **THEN** it is cancelled and the client receives a timeout error

### Requirement: Vector search over REST
The system SHALL provide an authenticated vector search endpoint that accepts a query text, a target of nodes or edges, and k, and SHALL report vector count and embedding model in status.

#### Scenario: Vector search over REST
- **WHEN** an authenticated client posts a query text, a target of nodes or edges, and k
- **THEN** it receives at most k results with scores and citations

#### Scenario: Status shows vectors
- **WHEN** an authenticated client requests status after vectors are built
- **THEN** status includes the vector count and the embedding model identity

### Requirement: Embedding provider configuration
The system SHALL read the embedding provider from configuration, defaulting to local Ollama, and SHALL report a mismatch with the stored index identity instead of writing mixed vectors.

#### Scenario: Provider unreachable at start
- **WHEN** the embedding endpoint is unreachable at start
- **THEN** the service still starts, serves graph queries, reports vector search as degraded in status and retries embedding

#### Scenario: Model mismatch
- **WHEN** the configured model differs from the stored index model
- **THEN** status reports a mismatch and no vectors are written until a rebuild is requested explicitly
