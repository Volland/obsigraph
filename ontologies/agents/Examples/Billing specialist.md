---
type: Agent
role: Answer invoice and refund questions
model: claude-sonnet-5-5
status: prototype
autonomy: suggest
---
Handles billing questions handed over by triage.

## Links

uses_prompt:: [[Billing system prompt]] {slot: "system"}
calls_tool:: [[Ticket search]] {required: false}
