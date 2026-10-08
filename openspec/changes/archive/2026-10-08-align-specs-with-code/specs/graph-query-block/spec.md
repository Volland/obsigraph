## MODIFIED Requirements

### Requirement: Live refresh
The system SHALL re-run a visible block once vault changes have been quiet for the plugin's Refresh delay setting (default 300 ms, range 0–60000 ms), SHALL defer re-running a block that is scrolled out of view until it becomes visible, and SHALL update a graph whose element set is unchanged in place, without re-running layout.

#### Scenario: Edge edited
- **WHEN** a note changes in a way that alters the query result
- **THEN** the block shows the new result after the Refresh delay, without a manual re-run

#### Scenario: Hidden block deferred
- **WHEN** a note changes while a block is scrolled out of view
- **THEN** the block re-runs when it is next scrolled into view, not before

#### Scenario: Positions kept
- **WHEN** a change alters only a property of a node already drawn
- **THEN** the graph is restyled with every node in the same position

## ADDED Requirements

### Requirement: Size and code header options
The block header SHALL accept `height` (a number of pixels from 100 to 4000, optionally suffixed `px`, default 360) and `code` (`show` or `hide`), and SHALL report any other value of either as a header error.

#### Scenario: Height set
- **WHEN** a block header has `height: 600`
- **THEN** the rendered graph is 600 pixels tall

#### Scenario: Height out of range
- **WHEN** a block header has `height: 50`
- **THEN** the block shows a header error naming `height` and its allowed range

### Requirement: Latest run wins
A block SHALL show only the result of its most recent run, discarding answers from earlier runs that arrive later.

#### Scenario: Slow earlier answer
- **WHEN** a Ladybug block re-runs after an edit and the answer to the earlier run arrives after the newer one
- **THEN** the block keeps showing the newer result
