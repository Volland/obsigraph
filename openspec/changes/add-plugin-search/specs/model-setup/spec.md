## Purpose

Defines how a vault gets its embedding model in the plugin: the first-run recommendation, explicit and verified weight downloads, the per-vault choice with a per-device opt-out, safe model changes and the model card in settings.

## ADDED Requirements

### Requirement: First-run recommendation
When semantic search is set up for a vault with no model chosen, the plugin SHALL sample up to 200 notes, SHALL recommend `e5-small-multi` when more than 10% of letters are outside Latin script and `minilm-l6` otherwise, and SHALL show for each option its languages, download size, estimated indexing time on this device and whether it runs well on this device.

#### Scenario: Mixed vault
- **WHEN** 30% of sampled letters are Cyrillic
- **THEN** `e5-small-multi` is recommended with a note that the English model would not understand those notes

#### Scenario: English vault
- **WHEN** 2% of sampled letters are outside Latin script
- **THEN** `minilm-l6` is recommended

#### Scenario: Not now
- **WHEN** the user declines setup
- **THEN** nothing is downloaded and search stays lexical

### Requirement: Explicit, verified weight download
The plugin SHALL download model weights only after an explicit user action, only from a URL pinned in the plugin for that preset, SHALL verify the sha256 before use, SHALL store weights per device outside the vault, and SHALL NOT download executable code.

#### Scenario: Corrupted download
- **WHEN** the downloaded weights do not match the pinned hash
- **THEN** they are discarded, an error is shown and the previous state is unchanged

### Requirement: Per-vault choice, per-device opt-out
The chosen model SHALL be stored in the plugin's synced settings for the vault; whether semantic search runs on a device and whether indexing is paused SHALL be stored per device and not synced. A device whose store fingerprint differs from the synced choice SHALL start a shadow build unless semantic search is off on that device.

#### Scenario: Switched on another device
- **WHEN** the laptop switches the vault to `e5-small-multi` and settings sync to the phone
- **THEN** the phone starts a shadow build that reads the vector pack first

#### Scenario: Phone opted out
- **WHEN** semantic search is off on the phone and the model changes on the laptop
- **THEN** the phone downloads nothing and stays lexical

### Requirement: Confirmed model change
Changing the model SHALL first show the number of units to embed, the estimated time on this device, the download size, that the current search keeps working meanwhile and that other devices will switch too, and SHALL change nothing unless confirmed.

#### Scenario: Cancelled change
- **WHEN** the user cancels the confirmation
- **THEN** the model, the store and the synced settings are unchanged

### Requirement: Model card
Settings SHALL show the vault's model name, languages, dimension, download size and short fingerprint, and for this device the store size, unit counts, units waiting, and actions to pause indexing, rebuild, delete the local store and turn semantic search off.

#### Scenario: Delete local store
- **WHEN** the user deletes the local store
- **THEN** the store is removed from this device, the vault and the vector pack are untouched, and the next search rebuilds it

### Requirement: Network use disclosed
The plugin's README SHALL state that the only network use is downloading model weights from the named host after the user asks, and that notes never leave the device.

#### Scenario: README check
- **WHEN** the release is prepared
- **THEN** the README section on network use names the weights host and the trigger
