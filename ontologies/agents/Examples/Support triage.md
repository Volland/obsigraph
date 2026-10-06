---
type: Agent
role: Route incoming support tickets to the right queue
model: claude-sonnet-5-5
status: production
autonomy: ask-first
---
Reads a ticket, decides the queue and drafts a first reply.

## Links

uses_prompt:: [[Triage system prompt]] {slot: "system"}
calls_tool:: [[Ticket search]] {required: true}
calls_tool:: [[Close ticket]] {required: false}
reads:: [[Help center articles]]
delegates_to:: [[Billing specialist]] {when: "the ticket mentions an invoice"}
evaluated_by:: [[Routing accuracy]] {score: 0.93, date: 2026-09-30}
