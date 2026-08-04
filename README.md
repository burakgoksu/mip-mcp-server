# mip-mcp-server

MCP (Model Context Protocol) server for **MIP** — MDP Group's Integration Platform. Enables AI assistants (Claude, etc.) to manage MIP flows, packages, resources, credentials, service users, certificates, keystores, mappings, and logs through natural language.

## What's new in 1.0.19 — RFC Destinations & MCP Servers (Destinations)

Two more Destinations groups:

- **RFC Destinations** (`/api/rfc-destinations`) — `mip_list/create/update/delete_rfc_destination`. SAP application-server connections (destinationName, ashost, sysnr, client, user, password + lang/peakLimit/poolCapacity/sapRouter). List hides the password; update preserves it when omitted (verified: an update without `password` keeps the stored one).
- **MCP Servers** (`/api/mcp-servers`) — `mip_list/create/update/delete_mcp_server`. External MCP servers MIP flows can call: `name` + `serverConfigJson` (validated JSON) + `authType` (NONE/API_KEY/BEARER/BASIC/OAUTH2/CLIENT_CERT; credentialId required when not NONE) + optional `defaultTool`, `isEnabled`.

MCP verified end-to-end (create → filter → disable → delete); RFC create + password-preserving update verified live.

## What's new in 1.0.18 — JDBC Destinations (Destinations)

First of the Destinations tool groups. JDBC destinations (backed by `/api/databases`) are now manageable:

- **`mip_list_jdbc_destinations`** — list destinations (name, driver, url, username), paginated, filterable; password is hidden.
- **`mip_create_jdbc_destination`** — create with `databaseName` + `driver` (PostgreSQL/MySQL/MSSQL/Oracle/MongoDB) + `jdbcUrl` + `userName`/`password` (required except for MongoDB).
- **`mip_update_jdbc_destination`** — update by id; merges against the existing record. The API returns different field names (`databaseDriver`/`databaseUrl`/`databaseUsername`/`databasePassword`, password base64) than it accepts — the tool maps them back and preserves the password when omitted.
- **`mip_delete_jdbc_destination`** — delete by id.

Create → filter → update (merge, password preserved) → delete verified end-to-end against a live MIP instance.

## What's new in 1.0.17 — Flow schema KB: configs as exchange properties

Documentation added to the embedded flow schema (`mip_get_flow_schema` → `expressionLanguage`) so the AI knows global/local flow configurations exist and how flows consume them: a config surfaces at runtime as an **exchange property** keyed by `configKey` — read via `${exchangeProperty.<configKey>}` (Simple) or `exchange.getProperty('<configKey>')` (Groovy), set/overridden via `processSetContext` or Groovy. Guidance: don't hardcode environment/flow-varying constants — read them from a config key. No new tool; this improves generated flows.

## What's new in 1.0.16 — Global Flow Configurations (Integrations)

The last Integrations tool group. Global flow configurations (shared exchange properties, backed by `/api/global-flow-configurations`) are now fully manageable — completing full MCP coverage of the Operations > Integrations menu:

- **`mip_list_global_flow_configs`** — list configs (configKey, configValue, enabled, appliedGlobally), paginated, filter by key.
- **`mip_create_global_flow_config`** — create a config; `configValue` is a scalar or JSON string (JSON is auto-parsed, mirroring the UI's "Value (scalar or JSON)" field). `enabled` = visible/active to flows, `appliedGlobally` = auto-applied to all flows (opt-out).
- **`mip_update_global_flow_config`** — update by key; merges against the existing record. Optional `force:true` to override the in-use warning.
- **`mip_delete_global_flow_config`** — delete by key.

Create (scalar + JSON) → filter → update → delete verified end-to-end against a live MIP instance.

## What's new in 1.0.15 — Performance-Monitoring search & paging

The Monitoring > Performance-Monitoring screen is served by the same endpoint as the existing `mip_get_message_completion_times` tool (`/api/monitoring/logs/message-completion-times`), so it was already covered. This release brings the tool to full parity with the screen: an optional `filter` (search over flowId/flowName/messageCount) and `page`, and dates now accept `YYYY-MM-DD HH:mm` as well as `YYYY-MM-DD`.

## What's new in 1.0.14 — Search Message (Monitoring, stage 2)

The companion to Message Search Rules: search a flow's messages by the value a rule extracts.

- **`mip_search_messages`** — `GET /api/flows/{flowId}/message-search-rules/message-ids`. Pass `flowId` and optionally `resultValue` (a **regex** over the extracted value; empty/omitted returns every message in range), `ruleIds` (defaults to all *enabled* rules on the flow), and a `startDate`/`endDate` window (defaults to the last 24h). Returns messageId, time, resultValue, status, rule id.

Non-obvious detail worked out live: `resultValueRegex` and the base64 `messagesearchrulelistfilter` must be sent as **HTTP headers**, not query params — passed as query params the server silently ignores them and returns everything. Verified with matching / non-matching / empty searches.

## What's new in 1.0.13 — Message Search Rules (Integrations)

Third Integrations tool group. Message search rules (backed by `/api/message-search-rules`) extract a field from a flow's messages via XPATH/JSON_PATH so it can be searched/shown in Monitoring:

- **`mip_list_message_search_rules`** — list rules (flowId, name, type, value, isEnabled), paginated, filter across all fields.
- **`mip_create_message_search_rule`** — create a rule: `flowId` + `name` + `type` (`XPATH`|`JSON_PATH`) + `value` (the expression) + optional `isEnabled`.
- **`mip_update_message_search_rule`** — update by id (including enabling/disabling); merges against the existing record.
- **`mip_delete_message_search_rule`** — delete by id. An **enabled** rule can't be deleted (MIP returns 409); the tool surfaces a clear hint to disable it first.

Create → filter → update → delete verified end-to-end against a live MIP instance.

## Fixed in 1.0.12 — Multi-line alert templates

MIP's `alertTemplate` field rejects any literal line break (`\n`/`\r\n`) with a misleading *"alertTemplate: Cannot be blank"* error, so pasting a normal multi-line HTML template failed. `mip_create_alert` / `mip_update_alert` now normalize newlines to spaces before sending — HTML is whitespace-insensitive between tags, so rendering is unchanged.

## What's new in 1.0.11 — Alerts + SMTP settings (Integrations)

Second Integrations tool group. Scheduled e-mail **Alerts** (backed by `/api/alerts`) and their **SMTP config** (`/api/alerts/mail-config`) are now fully manageable:

- **`mip_list_alerts`** — list alerts (name, recipients, cron schedule + human description, template type, flows), paginated, filter by name.
- **`mip_create_alert`** — create an alert for one or more flows on a cron schedule (`postingFrequency`, e.g. `0 0 8 * * ?`). The template is **inline**: set `useTemplate:true` and pass `alertTemplate` (HTML/text body) + `alertBodyType` (`HTML|JSON|CSV|XML|TEXT`); otherwise MIP sends its default body. There is no separate template library — the template lives on the alert itself.
- **`mip_update_alert`** — update by id; fetches and merges the existing record (maps `integrationFlows` → `flowIds`) so partial edits keep the rest.
- **`mip_delete_alert`** — delete by id.
- **`mip_get_alert_mail_config` / `mip_save_alert_mail_config` / `mip_delete_alert_mail_config`** — read/write/clear the SMTP settings (from, address, port, timeouts, authentication, `credentialId`, encryption) that alert e-mails are sent through.

Alert create → filter → update (merge) → delete verified end-to-end against a live MIP instance.

## What's new in 1.0.10 — Counters (Integrations)

First tool group of the **Integrations** operations menu. Counters (backed by MIP's `/api/number-ranges`) can now be managed end-to-end through natural language:

- **`mip_list_counters`** — list counters (name, minimumValue, maximumValue, currentValue, length), paginated, with optional filter.
- **`mip_create_counter`** — create a counter; `currentValue` defaults to `minimumValue`, `length` to 1.
- **`mip_update_counter`** — update a counter by id; fetches the existing record and merges the given fields, so partial updates never wipe other values.
- **`mip_delete_counter`** — delete a counter by id.

Verified end-to-end (create → update → delete round-trip) against a live MIP instance.

## What's new in 1.0.9 — Correct condition/edge wiring + pre-import validation

Complex flows built through the MCP used to fail at deploy — especially anything with **two or more `processCondition` nodes**, error subflows, or multiple branches. Root cause: the embedded flow schema modelled edges and conditions incorrectly, so the AI emitted flows MIP could not deploy. This release rebuilds the schema knowledge from **55 live customer flows** (Kervan Prod) and adds a validator that catches deploy-breakers *before* import.

- **Edge schema fixed** — every real MIP edge carries `type:"buttonedge"`; the old `style` object (strokeWidth/zIndex) does **not** exist in real flows and is no longer suggested. Normal edges carry `sourceHandle:"normal-source"`; condition edges carry `conditionId:"<src>--<tgt>"` + `label`.
- **`processCondition` rebuilt** — condition branch edges are **not** auto-created; each `conditionsRows[].edgeId` must be matched **exactly** by an edge whose `conditionId` equals it. Documented with real 4-branch and two-condition worked examples. String literals in expressions must be single-quoted (`== 'OK'`, not `== OK`).
- **Error subflow documented** — container is `type:"error"`; `processStartError`/`processEndError` and inner nodes use `parentNode` + `extent:"parent"`.
- **New `mip_get_flow_schema` sections** — `flowTemplates` (ready-to-import full node+edge templates: `linearFlow`, `conditionFlow`, `twoConditionsFlow`, `errorSubflowFragment`, `directChaining`), `expressionLanguage` (Camel Simple/XPath/JSONPath rules), and `validation` (the rule list).
- **Pre-import validation in `mip_create_and_import_flow`** — checks condition↔edge pairing (E2/E3), duplicate default branches, orphan edges, duplicate node ids, missing `processStart`, and error-subflow parent links. On error the import is **blocked** with a fix message. Calibrated so all 55 real production flows pass with 0 errors. Pass `skipValidation:true` to bypass.

## What's new in 1.0.8 — Message-level & time-bucketed monitoring

Previously the only monitoring tool, `mip_download_logs`, returned **aggregated** success/error/delivering counts per flow with no time information — so questions like "which hour of the day is quietest?" could not be answered. This release adds the message-level and chart endpoints the MIP web UI uses internally:

- **`mip_get_flow_message_logs`** — per-message log list for a flow with millisecond `startDate`/`endDate` timestamps (the list shown when you click a flow in monitoring). Use it for hour-of-day / volume / load analysis. `type` accepts a **single** value (`SUCCESS` | `ERROR` | `DELIVERING`) — call once per status and merge; a comma-separated list returns HTTP 204. `startDate`/`endDate` filter at day granularity, so bucket by hour locally from each record's `startDate`. Empty result sets (204) are returned as an empty `content` array with a note rather than an error.
- **`mip_get_message_counts`** — time-bucketed success/error totals for dashboard-style trends. `timeType` selects the bucket size: `DAY`, `WEEK`, `MONTH`, `YEAR` (**no hourly** option — use `mip_get_flow_message_logs` for sub-day analysis).
- **`mip_get_message_completion_times`** — per-flow message count and average processing (completion) time over a date range; handy for spotting slow flows.
- **`mip_generate_monitoring_report`** — one-shot **Excel (.xlsx) report**: pulls every message in a date (and optional `HH:MM` time) window across all/selected flows, buckets by hour, and writes a multi-sheet workbook (Summary, Hour distribution with quietest/busiest hour, Day×Hour heatmap, Flow×Hour heatmap, Daily totals, Flow summary) to `MIP_DOWNLOAD_DIR`. Built with the bundled `jszip` — no Excel dependency. Useful for picking the lowest-traffic maintenance window. Timestamps are used **as-is** (raw MIP server time; no clock-offset correction).

## What's new in 1.0.7 — SOAP Sender / WSDL support

Previous versions only supported Groovy and XSLT resources end-to-end. SOAP Sender flows could not be built fully through the MCP because there was no way to generate or upload a WSDL and bind it to a `processStart` SOAP node. This release closes that gap.

- **`mip_generate_wsdl`** — generates a MIP-compatible WSDL from a structured spec (service name, target namespace, operations with request/response fields). The generated WSDL has `elementFormDefault="qualified"` baked into every `<xs:schema>` (mandatory in MIP — without it, SOAP Sender flows do not work). Optional `uploadAfter:true` uploads the WSDL to a flow in the same call. The tool's response includes a `bindingMetadata` JSON block with the exact `soapWSDLResource`, `soapWSDLBinding`, `soapWSDLOperation` values to copy into the SOAP Start node.
- **`mip_upload_wsdl`** — uploads a hand-crafted or external WSDL to a flow. Before upload, every `<xs:schema>` / `<xsd:schema>` element is checked for `elementFormDefault="qualified"`; if missing it is injected, if `unqualified` it is replaced. The corrected file is written under `MIP_DOWNLOAD_DIR` and uploaded; the original on disk is not modified.
- **`mip_upload_resource`** — extended to accept `resourceType: 'wsdl' | 'xsd' | 'xslt'` in addition to the existing `'groovy' | 'xsl'`. No validation is applied for `wsdl` here — use `mip_upload_wsdl` if you want the auto-fix behavior.
- **Schema knowledge updated** — `mip_get_flow_schema` now documents the SOAP Start ↔ WSDL binding workflow with three real-world examples (`CalculatorSoap`, `OrderServiceBinding`, `SI_SAP_LIMAN_BAKIMMATIK_OUT_SYNBinding`) so the AI assistant correctly extracts `<wsdl:binding name>` and `<wsdl:operation name>` literals from the WSDL rather than guessing from the service name. `soapAddress` is clarified as the MIP endpoint path (e.g. `/myService`), not the WSDL `<soap:address location>`.

## Requirements

- Node.js >= 18
- A running MIP instance
- MIP username and password

## Installation

No installation needed. Use directly with `npx`:

```bash
npx @burakgoksu1/mip-mcp-server
```

Or install globally:

```bash
npm install -g @burakgoksu1/mip-mcp-server
```

## Configuration

The server is configured via environment variables:

| Variable | Required | Description |
|---|---|---|
| `MIP_BASE_URL` | Yes | MIP server URL (e.g. `http://mipserverurl.com`) |
| `MIP_USERNAME` | Yes | MIP username |
| `MIP_PASSWORD` | Yes | MIP password |
| `MIP_DOWNLOAD_DIR` | No | Local path for downloaded files (default: `~/mip-downloads`) |

## Usage with Claude Code

Add to your `.mcp.json` or Claude Code settings:

```json
{
  "mcpServers": {
    "mip-mcp-server": {
      "command": "npx",
      "args": ["-y", "@burakgoksu1/mip-mcp-server"],
      "env": {
        "MIP_BASE_URL": "http://<your-mip-host>",
        "MIP_USERNAME": "<username>",
        "MIP_PASSWORD": "<password>",
        "MIP_DOWNLOAD_DIR": "C:/mip-downloads"
      }
    }
  }
}
```

## Available Tools

### Flow Management

| Tool | Description |
|---|---|
| `mip_get_flow_schema` | Returns comprehensive schema for all MIP node types and flow templates |
| `mip_create_and_import_flow` | Creates and imports a new flow into MIP |
| `mip_export_packages_and_flows` | Exports packages and flows as a zip file |
| `mip_import_packages_and_flows` | Imports packages and flows from a zip file |

### Flow Deploy & Monitoring

| Tool | Description |
|---|---|
| `mip_deploy_flow` | Deploys a flow by flow ID (optionally specify version) |
| `mip_undeploy_flow` | Undeploys (stops) a running flow |
| `mip_set_flow_log_level` | Sets log level for a deployed flow: `1` = Only I/O Payload, `2` = All Steps |

### Flow Mappings

| Tool | Description |
|---|---|
| `mip_export_flow_mappings` | Exports flow mappings by ID |
| `mip_import_flow_mappings` | Imports flow mappings from a zip file into a target flow |
| `mip_upload_flow_mapping_sample` | Uploads a sample file for a flow mapping |
| `mip_reupload_flow_mapping_sample` | Re-uploads a sample file for a flow mapping |
| `mip_download_flow_mapping_sample` | Downloads a flow mapping sample file |

### Resources (Groovy / XSLT / XSD / WSDL)

| Tool | Description |
|---|---|
| `mip_upload_resource` | Uploads a Groovy (`.groovy`), XSLT (`.xsl` / `.xslt`), XSD (`.xsd`), or WSDL (`.wsdl`) file to a flow. For hand-crafted WSDLs prefer `mip_upload_wsdl` (auto-validates `elementFormDefault`). |
| `mip_reupload_resource` | Updates an existing resource by ID |
| `mip_list_resources` | Lists all resources; optionally filter by flow ID |
| `mip_generate_wsdl` | Generates a MIP-compatible WSDL from a structured spec. `elementFormDefault="qualified"` is baked in. Returns the WSDL text plus `bindingMetadata` ready to paste into a SOAP Start node. Optional `uploadAfter:true` uploads to a flow in the same call. |
| `mip_upload_wsdl` | Uploads a WSDL file to a flow with automatic validation: injects `elementFormDefault="qualified"` if missing, replaces `unqualified` with `qualified`. Original file on disk is not modified; corrected copy is written under `MIP_DOWNLOAD_DIR`. |

### Credentials

| Tool | Description |
|---|---|
| `mip_list_credentials` | Lists all saved credentials (BASIC, OAUTH_2, AZURE, AWS, GOOGLE_PUBSUB) |
| `mip_create_credential` | Creates a new credential for accessing external services |
| `mip_update_credential` | Updates an existing credential |
| `mip_delete_credential` | Deletes a credential (only if not in use by any flow) |

### Service Users

| Tool | Description |
|---|---|
| `mip_list_service_users` | Lists MIP service users with optional pagination and search |
| `mip_create_service_user` | Creates a new MIP user with specified roles (`developer`, `ui-user`, `monitoring`, `admin`, `service-user`) |
| `mip_update_service_user` | Updates an existing user's email, password, or roles |
| `mip_delete_service_user` | Deletes a MIP service user |
| `mip_toggle_service_user_lock` | Locks or unlocks a service user account |

### Certificates & Keystores

| Tool | Description |
|---|---|
| `mip_upload_certificate` | Uploads a certificate to MIP |
| `mip_reupload_certificate` | Re-uploads / updates an existing certificate |
| `mip_download_certificate` | Downloads a certificate by ID |
| `mip_upload_key_store` | Uploads a keystore to MIP |
| `mip_reupload_key_store` | Re-uploads / updates an existing keystore |
| `mip_download_key_store` | Downloads a keystore by ID |

### Monitoring & Logs

| Tool | Description |
|---|---|
| `mip_download_logs` | Downloads flow monitoring logs (aggregated success/error/delivering **counts**) by date range |
| `mip_get_flow_message_logs` | Per-message log list for a flow with millisecond timestamps — for hour-of-day / volume analysis. `type` is a single status (SUCCESS/ERROR/DELIVERING) |
| `mip_get_message_counts` | Time-bucketed success/error totals (`timeType`: DAY / WEEK / MONTH / YEAR; no hourly) |
| `mip_get_message_completion_times` | Per-flow message count and average completion time over a date range |
| `mip_generate_monitoring_report` | Generates a multi-sheet **Excel (.xlsx)** volume report for a date/time window (hour distribution, Day×Hour & Flow×Hour heatmaps); saved to `MIP_DOWNLOAD_DIR` |
| `mip_get_system_logs` | Downloads system log file by date range |
| `mip_download_payload` | Downloads payload (in or out) for a given message ID |
| `mip_download_log_details_payload` | Downloads node-level payload for a given message ID and node ID |
| `mip_download_all_attachments` | Downloads all attachments for a message as a zip |
| `mip_download_attachment_by_id` | Downloads a specific attachment by ID |

## Example Prompts

Once connected, you can interact with MIP using natural language:

```
Create a package called P_MY_PACKAGE and a flow called F_MY_FLOW.
The flow should receive HTTP POST requests, call an external REST API, convert the JSON response to XML, and return it.
```

```
Export all flows in package P_MY_PACKAGE to a zip file.
```

```
Show me the error logs for the last 7 days.
```

```
Upload the Groovy script at C:/scripts/transform.groovy to flow F_MY_FLOW.
```

```
Create a BASIC credential named PARTNER_API with username and password, then use it in flow F_MY_FLOW.
```

```
Create a service user john.doe@company.com with developer and ui-user roles.
```

```
Generate a WSDL named OrderService with operations CreateOrder (taking Customer, Amount) and GetOrderStatus (taking OrderId), upload it to flow F_ORDER_SOAP, and create a SOAP Start flow that exposes it at /orders.
```

```
I have a WSDL at C:/wsdl/partner-service.wsdl. Upload it to flow F_PARTNER_SOAP and wire the SOAP Start step to use the first binding/operation defined in the file.
```

## SOAP Sender flow workflow

When building a flow with a `processStart` of `connectorType: "SOAP"`, three fields in `StartState` must be populated together:

| Field | Source |
|---|---|
| `soapWSDLResource` | The exact filename used when uploading the WSDL (e.g. `OrderService.wsdl`) |
| `soapWSDLBinding` | The literal value of `<wsdl:binding name="...">` inside the WSDL — **read it from the file**, do not derive it from the service name (real-world bindings include `CalculatorSoap`, `IDOCBinding`, `SI_SAP_LIMAN_BAKIMMATIK_OUT_SYNBinding`) |
| `soapWSDLOperation` | The literal value of `<wsdl:operation name="...">` you want to bind to |

`soapAddress` is the path MIP exposes the endpoint at (e.g. `/myService`), not the `<soap:address location>` from the WSDL.

For new WSDLs, `mip_generate_wsdl` returns a `bindingMetadata` block with all three values pre-computed so the AI assistant can copy them straight into the SOAP Start node.

## License

MIT
