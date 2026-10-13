## ADDED Requirements

### Requirement: Details panel
The Graph view's details panel SHALL separate the note's own properties from graph bookkeeping, SHALL draw links in property values as links, and SHALL let the user size it. Technical rows SHALL be the labels, stub flag and path of a node, the sign, ID, declaring note and source heading of an edge, every style attribute, and the properties that the node's merged schema or the edge's type declaration does not declare; when there is no schema or declaration, every property of the note is a note property. The `type` and `types` properties SHALL always be note properties. Note properties SHALL be listed first. The panel SHALL offer a Technical toggle, off by default, that shows or hides the technical rows, and a Links toggle, on by default, that switches property values between clickable links and plain text. A wikilink or a markdown link to a note in a value SHALL be drawn as a link showing its alias or target, one list item per line, that opens the note (in a new tab with Cmd or Ctrl), and an empty `[[]]` or a link to something that is not a note SHALL stay text. The user SHALL be able to drag a handle between the graph and the panel to set the panel's width, and the width and both toggles SHALL be remembered on the device.

#### Scenario: Business and technical properties
- **WHEN** the user selects a Task node whose schema declares `status` and `owner`, and the note also has `tags`
- **THEN** `type`, `status` and `owner` are listed first, and `labels`, `stub`, `path`, `tags` and every `style.*` row are technical and hidden until the Technical toggle is on

#### Scenario: No schema
- **WHEN** the selected note's labels have no schema
- **THEN** all its frontmatter properties are note properties, and only `labels`, `stub`, `path` and `style.*` are technical

#### Scenario: Links in values
- **WHEN** a property value is `["[[Login]]", "plain"]` or `see [[Auth#Flow|the flow]]`
- **THEN** with the Links toggle on, `Login` is a link on its own line above the text `plain`, and `the flow` is a link to `Auth#Flow` inside the surrounding text

#### Scenario: Links as plain text
- **WHEN** the user turns the Links toggle off
- **THEN** every value is shown as plain text, lists as JSON, as before

#### Scenario: Resize the panel
- **WHEN** the user drags the handle left
- **THEN** the panel gets wider, the graph narrower and redrawn, and the width is restored the next time the view opens
