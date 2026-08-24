# mip-mcp-server

MCP (Model Context Protocol) server for **MIP** — MDP Group's Integration Platform. Enables AI assistants (Claude, etc.) to drive almost the entire MIP UI through natural language: flows & packages (incl. **graphical mapping** generation), deploy/monitoring, mappings, resources & WSDL, credentials, service users, certificates & keystores, **Integrations** (counters, alerts + SMTP, message search rules, global flow configs), **Destinations** (JDBC, RFC/SAP, MCP servers, OFTP2), **Operations** (Kafka queues, EDI schemas, SAP connections, XI queues, RFC explorer, SOA services), **Editors** (run Groovy / XSLT), **Management** (system health + reports, test connectivity, alert configurations, license — read-only), and **API Management** (APISIX gateway — routes, consumers, rejected requests, service-user sync). **150 tools** in total.

> ⚠️ **Danger zones:** this server deliberately exposes **no** tools for MIP's *Database Management*, *DB Analysis & Backup* (backup/restore), or *license write* — these can cause irreversible damage on a live server. License is read-only.

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
| `MIP_LANG` | No | Interface language: `tr` (default) or `en`. Sets tool/parameter descriptions, result messages and report labels. |

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
        "MIP_DOWNLOAD_DIR": "C:/mip-downloads",
        "MIP_LANG": "en"
      }
    }
  }
}
```

## Available Tools

**150 tools.** Naming convention is `mip_<verb>_<noun>`; list/create/update/delete groups follow the same shape. Reads return pretty JSON; writes return a short confirmation.

### Flows & Packages

| Tool | Description |
|---|---|
| `mip_get_flow_schema` | Returns the embedded MIP flow KB (node types, edge/condition wiring, templates, expression language, validation, safety notes). **Call this before building any flow.** |
| `mip_create_and_import_flow` | Builds a flow zip and imports it; runs pre-import validation to block deploy-breakers. **Auto-normalizes node ids to `dndnode_*`** (v1.16 deploy requirement). Optional `resources` (schema/xslt/…) + `flowMappings` for graphical-mapping flows: `links` (1:1 field maps) and `functions` (CONSTANT / MULTIPLY / ADD / CONCAT / UPPER_CASE / … — e.g. set a field to a constant or multiply a field by N) |
| `mip_export_packages_and_flows` | Exports packages and flows as a zip |
| `mip_import_packages_and_flows` | Imports packages and flows from a zip |

### Deploy & Endpoints

| Tool | Description |
|---|---|
| `mip_deploy_flow` | Deploys a flow (auto-resolves latest version if omitted) |
| `mip_undeploy_flow` | Undeploys (stops) a running flow |
| `mip_set_flow_log_level` | Sets log level for a deployed flow: `1` = Only I/O Payload, `2` = All Steps |

### Flow Mappings

| Tool | Description |
|---|---|
| `mip_export_flow_mappings` | Exports flow mappings by ID |
| `mip_import_flow_mappings` | Imports flow mappings from a zip into a target flow |
| `mip_upload_flow_mapping_sample` | Uploads a sample file for a flow mapping |
| `mip_reupload_flow_mapping_sample` | Re-uploads a sample file for a flow mapping |
| `mip_download_flow_mapping_sample` | Downloads a flow mapping sample file |

### Resources & WSDL

| Tool | Description |
|---|---|
| `mip_upload_resource` | Uploads a Groovy / XSLT / XSD / WSDL file to a flow |
| `mip_reupload_resource` | Updates an existing resource by ID |
| `mip_list_resources` | Lists resources; optional flow filter |
| `mip_generate_wsdl` | Generates a MIP-compatible WSDL from a spec (`elementFormDefault="qualified"` baked in) + `bindingMetadata` for the SOAP Start node; optional `uploadAfter` |
| `mip_upload_wsdl` | Uploads a WSDL with auto-validation (forces `qualified`); corrected copy saved under `MIP_DOWNLOAD_DIR` |

### Credentials

| Tool | Description |
|---|---|
| `mip_list_credentials` | Lists credentials (secrets stripped) — BASIC/OAUTH_2/AZURE/AWS/GOOGLE_PUBSUB |
| `mip_create_credential` | Creates a credential for external services |
| `mip_update_credential` | Updates a credential |
| `mip_delete_credential` | Deletes a credential (if unused) |

### Service Users

| Tool | Description |
|---|---|
| `mip_list_service_users` | Lists MIP service users (pagination/search) |
| `mip_list_pure_service_users` | (v1.16) Only `SERVICE-USER`-role users (the "Service Users" list) |
| `mip_list_platform_users` | (v1.16) Users with developer/ui-user/monitoring/admin roles (the "MDP Integration Platform Users" list) |
| `mip_create_service_user` | Creates a MIP user with roles (`developer`, `ui-user`, `monitoring`, `admin`, `service-user`); sends both `role`/`roles` for old+new compatibility |
| `mip_update_service_user` | Updates a user's email / password / roles |
| `mip_delete_service_user` | Deletes a service user |
| `mip_toggle_service_user_lock` | Locks / unlocks a service user account |

### Certificates & Keystores

| Tool | Description |
|---|---|
| `mip_upload_certificate` / `mip_reupload_certificate` / `mip_download_certificate` | Upload / update / download a certificate |
| `mip_upload_key_store` / `mip_reupload_key_store` / `mip_download_key_store` | Upload / update / download a keystore (`.jks`) |

### Monitoring & Logs

| Tool | Description |
|---|---|
| `mip_download_logs` | Aggregated success/error/delivering **counts** by date range |
| `mip_get_flow_message_logs` | Per-message log list for a flow with ms timestamps (hour-of-day / volume analysis) |
| `mip_get_message_counts` | Time-bucketed totals (`timeType`: DAY/WEEK/MONTH/YEAR) |
| `mip_get_message_completion_times` | **Performance-Monitoring**: per-flow message count + completion time (optional filter/paging) |
| `mip_generate_monitoring_report` | Multi-sheet **Excel** volume report (hour distribution, Day×Hour & Flow×Hour heatmaps) → `MIP_DOWNLOAD_DIR` |
| `mip_search_messages` | **Search-Message**: find messages by the value a message-search-rule extracts (regex; empty = all) |
| `mip_get_system_logs` | Downloads the system log file by date range |
| `mip_download_payload` | Downloads in/out payload for a message ID |
| `mip_download_log_details_payload` | Node-level payload for a message ID + node ID |
| `mip_download_all_attachments` / `mip_download_attachment_by_id` | All attachments as zip / a single attachment by ID |

### Integrations — Counters

| Tool | Description |
|---|---|
| `mip_list_counters` / `mip_create_counter` / `mip_update_counter` / `mip_delete_counter` | CRUD for counters (number ranges): name, min/max/current value, length |

### Integrations — Alerts (email) & SMTP

| Tool | Description |
|---|---|
| `mip_list_alerts` / `mip_create_alert` / `mip_update_alert` / `mip_delete_alert` | CRUD for scheduled e-mail alerts (cron, recipients, flows, optional inline HTML template) |
| `mip_get_alert_mail_config` / `mip_save_alert_mail_config` / `mip_delete_alert_mail_config` | Read / write / clear the SMTP settings alerts are sent through |

### Integrations — Message Search Rules

| Tool | Description |
|---|---|
| `mip_list_message_search_rules` / `mip_create_message_search_rule` / `mip_update_message_search_rule` / `mip_delete_message_search_rule` | CRUD for XPATH/JSON_PATH field-extraction rules (used by Search-Message). Enabled rules can't be deleted — disable first |

### Integrations — Global Flow Configurations

| Tool | Description |
|---|---|
| `mip_list_global_flow_configs` / `mip_create_global_flow_config` / `mip_update_global_flow_config` / `mip_delete_global_flow_config` | CRUD for shared exchange properties (scalar or JSON value, `enabled`, `appliedGlobally`). Read in flows as `${exchangeProperty.<key>}` |

### Destinations — JDBC

| Tool | Description |
|---|---|
| `mip_list_jdbc_destinations` / `mip_create_jdbc_destination` / `mip_update_jdbc_destination` / `mip_delete_jdbc_destination` | CRUD for JDBC destinations (PostgreSQL/MySQL/MSSQL/Oracle/MongoDB; `jdbcUrl` + user/password) |

### Destinations — RFC (SAP)

| Tool | Description |
|---|---|
| `mip_list_rfc_destinations` / `mip_create_rfc_destination` / `mip_update_rfc_destination` / `mip_delete_rfc_destination` | CRUD for SAP RFC destinations (ashost, sysnr, client, user, …) |

### Destinations — MCP Servers

| Tool | Description |
|---|---|
| `mip_list_mcp_servers` / `mip_create_mcp_server` / `mip_update_mcp_server` / `mip_delete_mcp_server` | CRUD for external MCP servers MIP connects to (`serverConfigJson`, `authType`) |
| `mip_sync_mcp_server` | Connects to the MCP server and refreshes its tools (SYNCED/FAILED + count) |
| `mip_list_mcp_server_tools` | Lists the discovered tools with input/output schemas |

### Destinations — OFTP2

| Tool | Description |
|---|---|
| `mip_list_oftp2_connections` / `mip_create_oftp2_connection` / `mip_update_oftp2_connection` / `mip_delete_oftp2_connection` | CRUD for OFTP2 connections (own/partner SSID·SFID·password, virtual file name, flags; **requires** a partner certificate + own keystore ID) |

### Operations — Queues (Kafka)

| Tool | Description |
|---|---|
| `mip_list_kafka_topics` | Kafka topics with cluster/status/producer·consumer counts (`scope` MIP or ALL) |
| `mip_get_kafka_topic_detail` | Brokers, partitions, replication, retention + the MIP flows using the topic |
| `mip_update_kafka_topic` | Modifies real Kafka topic config (retention, …) on `editable` topics |

### Operations — EDI Schemas

| Tool | Description |
|---|---|
| `mip_list_edi_schemas` | EDI schema resources (EDIFACT/X12/… · xsd/xslt) |
| `mip_upload_edi_schema` / `mip_reupload_edi_schema` | Upload / update an EDI schema (multipart) |
| `mip_delete_edi_schema` / `mip_download_edi_schema` | Delete / download by id |

### Operations — SAP Connections (SOA / PO / XI Systems)

| Tool | Description |
|---|---|
| `mip_list/create/update/delete_soa_connection` + `mip_set_soa_connection_enabled` | SOA (SAP web service) connections |
| `mip_list/create/update/delete_po_connection` + `mip_set_po_connection_enabled` | XI Proxy → PO (Process Orchestration) connections |
| `mip_list/create/update/delete_xi_system` + `mip_test_xi_system` | XI Proxy → Systems (business systems) + connection test |

### Operations — XI Queues (SAP XI/PI messages)

| Tool | Description |
|---|---|
| `mip_list_xi_queue_messages` / `mip_get_xi_queue_summary` | List (filter status/qos/queue/interface) / summary (blocked queues + counts) |
| `mip_get_xi_queue_payload` | Message payload by id |
| `mip_retry_xi_queue_message` / `mip_cancel_xi_queue_message` | Requeue / cancel a stuck message |

### Operations — RFC Explorer

| Tool | Description |
|---|---|
| `mip_test_sap_connection` | RFC handshake (saved `destinationId` or inline ashost/sysnr/client/user/password) |
| `mip_browse_rfcs` | Search RFC/BAPI functions by SAP mask (`*` wildcard required, e.g. `STFC*`) |
| `mip_get_rfc_interface` | A function's import/export/changing params, tables, structures |
| `mip_list_imported_sap_objects` | SAP objects materialized into MIP for a destination |

### Operations — SOA Services

| Tool | Description |
|---|---|
| `mip_list_soa_services` / `mip_list_available_soa_services` | Imported services / services discoverable on SAP (live) |
| `mip_import_soa_services` | Import all (or named subset) into MIP |
| `mip_get_soa_service_wsdl` | A service's WSDL (`refresh=true` re-fetches from SAP) |

### API Management (APISIX gateway)

| Tool | Description |
|---|---|
| `mip_list/create/update/delete_api_route` | Routes. Plugin shortcuts: `rateLimit`, `ipWhitelist`, `allowedConsumers`, `openIdConnect`, `basicAuth` (+ raw `plugins`) |
| `mip_list/create/update/delete_api_consumer` | Consumers (optional BASIC/JWT credential), keyed by `username` |
| `mip_search_rejected_requests` | Gateway rejection log (default last 24h; filter clientIp/uri/status/consumer) |

### API Management — Sync (MIP identities → gateway)

| Tool | Description |
|---|---|
| `mip_sync_service_user_to_gateway` / `mip_unsync_service_user_from_gateway` | Sync a MIP service user into the gateway as a consumer (`includeCredentials`; unsync `strategy` ERROR/CASCADE/RETAIN_CREDENTIALS). Needed so the backend recognizes the consumer |
| `mip_list_service_user_basic_auth_credentials` / `mip_sync/unsync_basic_auth_credential_(to\|from)_gateway` | List + sync/unsync a single BASIC credential |
| `mip_list_service_user_jwt_credentials` / `mip_sync/unsync_jwt_credential_(to\|from)_gateway` | List + sync/unsync a single JWT credential |

### Editors

| Tool | Description |
|---|---|
| `mip_execute_groovy_script` | Runs a Groovy script against an input body/headers/properties (script signature uses `ScriptExchangeDTO`) |
| `mip_execute_xslt_transform` | Applies an XSLT stylesheet to XML input and returns the result |

### Management — System Health & Connectivity

| Tool | Description |
|---|---|
| `mip_get_system_health` | Per-pod CPU / memory (MB) / inflight exchanges (read-only) |
| `mip_generate_system_health_report` | Samples health N times → standard **Markdown** report (min/avg/max + OK/UYARI) |
| `mip_generate_system_health_excel` | Same, as a fixed-layout **Excel (.xlsx)** (Ozet + Ornekler sheets) → `MIP_DOWNLOAD_DIR` |
| `mip_test_connectivity` | Tests reaching a `host:port` from the MIP backend (non-destructive) |

### Management — Alert Configurations

| Tool | Description |
|---|---|
| `mip_list_alert_config_emails` / `mip_add_alert_config_email` / `mip_remove_alert_config_email` | Manage system-health alert mail receivers |
| `mip_get_alert_rules` / `mip_update_alert_rules` | Read / merge-update per-component thresholds (CPU/RAM/disk %, response ms, …) |
| `mip_get_cron_frequency` / `mip_update_cron_frequency` | Read / merge-update per-component health-check cron |

### Management — License (read-only)

| Tool | Description |
|---|---|
| `mip_get_license_detail` | License detail (customer, type, dates, key; sensitive data server-masked) |
| `mip_check_license` | License validity (`valid`, dates, features) |

## Example Prompts

Once connected, you can interact with MIP using natural language:

**Flows & SOAP**
```
Get the flow schema, then create a package P_MY_PACKAGE and a flow F_MY_FLOW that receives
HTTP POST, calls an external REST API, converts the JSON response to XML, and returns it.
```
```
Generate a WSDL named OrderService with operations CreateOrder (Customer, Amount) and
GetOrderStatus (OrderId), upload it to flow F_ORDER_SOAP, and wire a SOAP Start at /orders.
```

**Deploy & monitoring**
```
Deploy F_MY_FLOW, set its log level to All Steps, and show me the error counts for the last 7 days.
```
```
Generate a monitoring Excel report for 2026-08-01 to 2026-08-07 and tell me the quietest hour.
```

**Integrations**
```
Create a counter invoice_no from 1 to 999999 with length 6.
```
```
Create a daily 08:00 e-mail alert for flow F_ORDER on ops@acme.com, then set up the SMTP config
using credential smtp_cred (Office 365).
```
```
Add a message search rule "UserName" (XPATH //*[local-name()='UserName']/text()) on F_SAP_TO_ICE,
enable it, then search that flow for messages where UserName = test_user in the last 24h.
```
```
Create a global flow config isSalesOrderReportFileExists = No, applied globally.
```

**Graphical mapping flows**
```
Create a flow F_ORDER_MAP in P_DEMO: REST POST /orders → graphical mapping → End, using
order_in.xsd and order_out.xsd (I'll give the files). Map Order/CustomerName → Invoice/BuyerName
and Order/Qty → Invoice/Quantity, then deploy it.
```
```
In the F_ORDER_MAP graphical mapping, set the target Status field to a constant "OK" and
multiply Qty by 3.
```

**Destinations**
```
Create a PostgreSQL JDBC destination demo_pg (jdbc:postgresql://host:5432/db) with user pg/pass.
```
```
Add an MCP server pointing to https://mcp.deepwiki.com/sse, sync it, and list its tools.
```

**Operations (Kafka / EDI / SAP)**
```
Show the Kafka topics used by MIP flows, then give me the detail (brokers, partitions, retention)
for topic orders on the mip cluster.
```
```
Upload edi/ORDERS_D96A.xsd as an EDIFACT EDI schema, then list the EDI schemas.
```
```
On RFC destination S4H, browse RFCs matching BAPI_PO_*, then show the interface of
BAPI_PO_CREATE1.
```
```
List the SOA services on connection SAP, import zycilgi_ws_001, and show its WSDL.
```
```
Show the blocked XI queue messages, then retry message 12345.
```

**API Management (gateway)**
```
Create a service user gw_partner, sync it to the gateway, then create a route /http/partner-api
to mip-backend:9000 (GET+POST) with basic auth, rate limit 100/min, and only gw_partner allowed.
```
```
Show the rejected gateway requests in the last 24h with status 403.
```

**Editors**
```
Run this Groovy against input "hello": uppercase the body and set header Processed=true.
```
```
Transform this order XML with an XSLT that outputs a summary sorted by amount descending.
```

**Management**
```
Generate a System Health Excel report.
```
```
Test connectivity from MIP to 10.0.0.5:1433.
```
```
Show the license detail and whether it's still valid.
```

## What's new in 1.3.0 — English language support (i18n)

The server is now bilingual. `MIP_LANG` selects the language and **defaults to `tr`**, so existing
installations behave exactly as before; set `MIP_LANG=en` for English.

- **All 150 tool descriptions and 523 parameter descriptions** are now English in the source, with
  Turkish served from a translation catalog (`src/i18n/tr/tools.json`). Since these descriptions are
  what the calling AI reads when choosing among 150 tools, English improves tool-selection accuracy
  for non-Turkish assistants.
- **Result messages, errors, and Excel/Markdown report labels** are localized too, including the
  number format (`1.234.567` vs `1,234,567`) and Excel sheet names.
- A missing translation falls back to English rather than rendering blank.
- Adding another language means adding one JSON file — no code changes.

**Fixed:** `package.json` listed only `index.js` under `files`, so the published tarball shipped
without `src/` and `npx @burakgoksu1/mip-mcp-server` was broken from 1.1.0 onward. Now fixed.

*Still Turkish (planned for the next release):* the flow knowledge base returned by
`mip_get_flow_schema` and the `validateFlow` messages.

## What's new in 1.2.3 — node names are canonical (stop breaking the flow object)

A node's display name (`data.label`) is **fixed per node type** in MIP — the UI enforces it and it can't be changed. Across 157 real flows every `processSetContext` is labeled exactly `"Set Context"`, every `processScript` `"Script"`, etc. When a generated flow gave a node a custom name (e.g. a Set Context node called `"mail body"`), the JSON no longer matched what the UI enforces and **broke the flow object**.

`mip_create_and_import_flow` now **auto-normalizes every node's `data.label` to the canonical name for its `objectType`** (`normalizeNodeLabels`, right after the node-id normalization) — so whatever name the model gives, the imported flow always carries the correct, UI-consistent name. The KB's node-name guidance and all flow templates were corrected to canonical labels too (they previously taught custom names like "Set route" / "Transform" / "Route"). Edge/branch labels (`conditionName`) stay custom — only node names are fixed. Verified idempotent against all 157 real flows (0 changes).

## What's new in 1.2.2 — graphical-mapping functions

`mip_create_and_import_flow`'s `flowMappings` now accepts **`functions`** (not just 1:1 `links`) — so the model can build transforming mappings, not just field copies:

- **CONSTANT** — set a target field to a fixed value: `{type:"CONSTANT", value:"123", target:"Root/MENGE"}`.
- **MULTIPLY / ADD / SUBTRACT** — arithmetic. Multiply a field by a constant: `{type:"MULTIPLY", inputs:["Root/BNFPO"], constants:["3"], target:"Root/BNFPO"}` (MULTIPLY multiplies its inputs; the `3` is fed as an auto-generated CONSTANT node).
- **CONCAT / UPPER_CASE / LOWER_CASE / SUBSTRING / REPLACE / TRIM / TO_NUMBER / TO_STRING / IF_ELSE / DATE_*** — the full APISIX-editor palette (String / Math / Type / Constant / Conditional / Date).

Verified live end-to-end: a graphical-mapping flow with `MENGE = constant 123` and `BNFPO × 3` returned `MENGE=123`, `BNFPO=30` (input `BNFPO=10`) through the deployed REST endpoint. The runtime uses `data.mappings` + `data.functions`; `data.transformations` is editor-only and not required to deploy.

## What's new in 1.2.1 — the real deploy-breaker: node id format

Found (and fixed) the actual cause of "the flow opens but won't deploy": **MIP v1.16's deploy compiler requires node ids in `dndnode_<number>` format.** Ids like `start1`/`cond1`/`okEnd` (which the KB templates used) let the flow open and save, but deploy fails with `HTTP 500 "Flow can not deploy. Cause is :"` (empty cause). Isolated decisively — an exact copy of a deployable flow deployed; the same flow rebuilt with `start1` ids failed; changing only the ids to `dndnode_` made it deploy.

`mip_create_and_import_flow` now **auto-normalizes** node ids on import (`normalizeNodeIds`): every non-conforming id becomes `dndnode_<n>`, and all references are rewritten consistently — edge `source`/`target`/`id`/`conditionId`, `conditionsRows[].edgeId`, and `parentNode`. So the model can still emit `start1` and the flow deploys. Verified live: a `start1`-id flow (plain and with graphical mapping) now deploys. Also verified end-to-end: a graphical-mapping flow (`Start → GraphicalMapping → End`, real XSD) deployed with log level All.

## What's new in 1.2.0 — v1.16 flow KB: graphical mapping, new nodes & a deploy-breaker fix

Analyzed **140 fresh sample flows** (MIP v1.16) and updated the internal flow knowledge base (`src/kb/flowSchema.js`) + `mip_create_and_import_flow` accordingly:

- **Deploy-breaker fix (condition edges):** real v1.16 condition edges carry `sourceHandle:"normal-source"` **together with** `conditionId` + `label` — the KB previously said condition edges must *not* carry `sourceHandle`. Generated condition flows now match the real format (a condition edge = a normal edge + `conditionId` + `label`). Templates + validator updated. Verified against all 140 flows: `validateFlow` produces **zero** false errors (the one flagged flow has a genuine orphan edge).
- **3 new node types documented:** `processGraphicalMapping` (`GraphicalMappingState.mappingName`), `processMCP` (`MCPState.tool` — calls a tool on a synced MCP server), `processXIProxy` (`XIProxyState` — MIP→SAP XI/PI proxy). New Start `connectorType: SAPXI`. `validateFlow` now also warns on unknown `objectType` (W6).
- **Graphical mapping generation + import** (`src/graphicalMapping.js` + `mip_create_and_import_flow`): a new `flowMappings` input (`{name, sourceSchema, targetSchema, links:[{sourcePath,targetPath}]}`) plus `resources` (schema files). The tool bundles the schema resources, imports the flow, resolves the new resource IDs, and creates each graphical mapping via `POST /api/flow-mappings` (they can't ride in the import zip — the mapping needs resource IDs assigned at import). `buildFlowMapping` output is byte-identical to real exports. New KB section `graphicalMapping`.
- **Fix:** `mip_list_resources` now requests a large page (v1.16 `/api/resources` is paginated, default 25).

## What's new in 1.1.9 — JWT credential sync

Completes gateway sync with the JWT credential type (mirrors the basic-auth trio from 1.1.8):

- **`mip_list_service_user_jwt_credentials`** — `GET /api/service-users/{id}/jwt-authentication-credentials`.
- **`mip_sync_jwt_credential_to_gateway`** / **`mip_unsync_jwt_credential_from_gateway`** — `POST`/`DELETE /api/api-management/sync/jwt-authentication-credentials/{credId}` (optional `consumerUsername`, `onConflict`).

## What's new in 1.1.8 — Gateway ↔ Service User sync

Syncs MIP **service users** (and their basic-auth credentials) into the APISIX gateway as consumers. This is the missing link that makes a gateway consumer actually usable: a standalone consumer passes gateway auth but the MIP **backend** rejects it (`Invalid user authorization`) because it validates the forwarded principal against a real service user. Syncing solves that.

- **`mip_sync_service_user_to_gateway`** — `POST /api/api-management/sync/service-users/{id}`. `includeCredentials` (default true) copies the user's basic-auth credential so the gateway consumer can actually authenticate. Optional `consumerUsername`, `onConflict` (`ERROR`/`SKIP`).
- **`mip_unsync_service_user_from_gateway`** — `DELETE …/{id}`. `strategy`: `ERROR` (default; fails if credentials still synced), `CASCADE` (remove credentials too), `RETAIN_CREDENTIALS`.
- **`mip_list_service_user_basic_auth_credentials`** — `GET /api/service-users/{id}/basic-authentication-credentials`.
- **`mip_sync_basic_auth_credential_to_gateway`** / **`mip_unsync_basic_auth_credential_from_gateway`** — sync/unsync a single basic-auth credential (`…/sync/basic-authentication-credentials/{id}`).

Verified live with full round-trips (sync → consumer appears → unsync `CASCADE` → consumer gone). Demonstrated end-to-end: after syncing, an authenticated request passes both the gateway and the MIP backend.

## What's new in 1.1.7 — Service Users v1.16 compatibility

MIP v1.16 changed the Service Users API; these tools now work on **both** old and new versions:

- **`mip_create_service_user` / `mip_update_service_user`** — v1.16 renamed the roles field from `roles` to `role`. The payload now sends **both** (each version reads its own field, ignores the other), so no caller change is needed and the old server keeps working.
- **`mip_list_pure_service_users`** *(new)* — `GET /api/service-users/pure`: only pure `SERVICE-USER`-role users (the new UI's "Service Users" section).
- **`mip_list_platform_users`** *(new)* — `GET /api/service-users/with-other-roles`: users with developer/ui-user/monitoring/admin roles (the new UI's "MDP Integration Platform Users" section).

The original `mip_list_service_users` (flat list) is untouched. Verified live on v1.16.0-rc.5: dual-field create round-trips, and the two new lists match the UI counts.

## What's new in 1.1.6 — API Management (APISIX gateway)

The **API Management** menu — MIP's APISIX-based API gateway. Covers the three tabs (`/api/api-management/*`):

- **Routes** — `mip_list_api_routes` / `mip_create_api_route` / `mip_update_api_route` / `mip_delete_api_route`. A route = `id`, `name`, `uri` (gateway path), `methods`, upstream `nodes` (host:port → weight), and plugins. Plugins have **friendly shortcuts** matching the UI toggles — `rateLimit {count, window}`, `ipWhitelist [cidr…]`, `allowedConsumers [username…]`, `openIdConnect {discovery, client_id, client_secret}`, `basicAuth: true` — plus a raw `plugins` escape hatch (merged over the shortcuts) for any other APISIX plugin. `plugins` defaults to `{}` (the gateway rejects null).
- **Consumers** — `mip_list_api_consumers` / `mip_create_api_consumer` / `mip_update_api_consumer` / `mip_delete_api_consumer`. Create optionally attaches a `BASIC` (password) or `JWT` (key/secret/algorithm) credential; consumers are keyed by `username`.
- **Rejected Requests** — `mip_search_rejected_requests`: paginated gateway-rejection log, defaults to last 24h, filter by `clientIp`/`requestUri`/`statusCode`/`consumerName`.

Verified live with full round-trips (route create→update→delete, consumer create→delete all 200/201; list + rejected-search return real data). Consumer→gateway **sync** (from MIP service users / credentials) lives under Security and is not built here.

## What's new in 1.1.5 — RFC Explorer + SOA Services & WSDL

Two more Sap-Connections sub-tools:

**RFC Explorer** (`/api/sap-connections/*`) — inspect a SAP system's remote functions. Connection is either a saved RFC destination (`destinationId`) or inline `ashost`/`sysnr`/`client`/`user`/`password`/`lang`:

- **`mip_test_sap_connection`** — RFC handshake (`connected: true/false`).
- **`mip_browse_rfcs`** — search RFC/BAPI functions by SAP mask. **`*` is the wildcard and is required** — `STFC*` matches, bare `STFC` returns nothing.
- **`mip_get_rfc_interface`** — a function's import/export/changing parameters, tables and structure fields.
- **`mip_list_imported_sap_objects`** — SAP objects already materialized into MIP for a destination.

**SOA Services** (`/api/soa-connections/{id}/*`, `/api/soa-services/{id}/wsdl`):

- **`mip_list_soa_services`** — SOAP services already imported for a SOA connection.
- **`mip_list_available_soa_services`** — services discoverable on the SAP system (live).
- **`mip_import_soa_services`** — import all (or a named subset) into MIP.
- **`mip_get_soa_service_wsdl`** — a service's WSDL (`refresh=true` re-fetches from SAP).

Verified live against a real S/4HANA destination (`test`/`browse STFC*`/`rfc-interface STFC_CONNECTION`/`soa services`/`wsdl` all returned real data). The existing `mip_*_rfc_destination` tools are untouched.

## What's new in 1.1.4 — XI Queues (SAP XI/PI messages)

Completes the Sap-Connections > XI Proxy tab — the **Queues** sub-tab (`/api/xi-queues`), for monitoring and unblocking SAP XI/PI messages:

- **`mip_list_xi_queue_messages`** — paginated list, filter by `status`/`qos`/`queueId`/`interfaceName`/`from`/`to`.
- **`mip_get_xi_queue_summary`** — `/summary`: definedQueues, blockedQueues, status counts.
- **`mip_get_xi_queue_payload`** — message payload by id.
- **`mip_retry_xi_queue_message`** / **`mip_cancel_xi_queue_message`** — `PATCH /{id}/retry` · `/cancel` to requeue or cancel a stuck message.

List + summary verified live (currently 0 messages on the instance); retry/cancel/payload built to the saga contracts.

## What's new in 1.1.3 — SAP Connections (SOA / PO / XI Systems)

In MIP v1.16.0-rc.5 the old RFC Destinations page became **Operations > Sap-Connections** with three connection types. The existing `mip_*_rfc_destination` tools (RFC tab, `/api/rfc-destinations`) are **left untouched**; these are added alongside:

- **SOA** (`/api/soa-connections`) — `mip_list/create/update/delete_soa_connection` + `mip_set_soa_connection_enabled` (name, scheme, host, port, systemClient, wsilPath, credentialId).
- **XI Proxy → PO Connections** (`/api/po-connections`) — `mip_list/create/update/delete_po_connection` + `mip_set_po_connection_enabled` (…, esrPath, credentialId).
- **XI Proxy → Systems** (`/api/xi-systems`) — `mip_list/create/update/delete_xi_system` + `mip_test_xi_system` (name, businessSystem, businessParty, …, enginePath).

Updates merge against the current record. List paths verified live (SOA/PO/XI all return real SYNCED connections; RFC tools confirmed still present). Create/update/delete/enable/test are built to the reverse-engineered saga contracts (not test-written against the customer's real SAP systems). The **XI Proxy → Queues** sub-tab (`/api/xi-queues`, message retry/cancel) is not built yet.

## What's new in 1.1.2 — EDI Schemas

**Operations > Edi-Schemas** — manage EDI schema resources (XSD/XSLT for EDIFACT/X12/etc.). Backed by `/api/edi-schemas`:

- **`mip_list_edi_schemas`** — list (resourceName, ediType, resourceType, dataFormat, version), paginated + filter.
- **`mip_upload_edi_schema`** — `PUT /api/edi-schemas/upload` (multipart: `file` + `data` JSON). `ediType` ∈ EDIFACT/EANCOM/ANSI_X12/ODETTE/VDA/TRADACOMS, `resourceType` xsd/xslt, `dataFormat` XML.
- **`mip_reupload_edi_schema`** — update by id (`PUT /api/edi-schemas/{id}/upload`).
- **`mip_delete_edi_schema`** / **`mip_download_edi_schema`** — delete / download by id.

Verified live end-to-end (upload → list → delete round-trip; 103 tools).

## What's new in 1.1.1 — Queues (Kafka topics)

New in MIP v1.16.0-rc.5: **Operations > Queues** — Kafka topic monitoring. First feature added on the new modular structure (one module + one registry line):

- **`mip_list_kafka_topics`** — `GET /api/queues/kafka/topics`: topics with cluster (bootstrapServers), status (HEALTHY/DOWN), producer/consumer counts, `inMip`. `scope` `MIP` (topics used by MIP flows) or `ALL`; paginated + filter.
- **`mip_get_kafka_topic_detail`** — `GET /api/queues/kafka/topics/detail`: cluster brokers, partitions, replication, retention/cleanup/compression, plus the MIP producer/consumer **flows** using the topic (`bootstrapServers` + `topic` required, `windowMinutes` default 60).
- **`mip_update_kafka_topic`** — `PUT /api/queues/kafka/topics` with `{bootstrapServers, topic, changes}` — modifies real Kafka topic config (retention, etc.); only on `editable` topics.

Also **robustness**: `BASE_URL` now strips a trailing slash, so `MIP_BASE_URL` written as `http://host/` no longer produces `//api/...`. Verified live on the new instance (98 tools; list + detail return real data).

## Refactor in 1.1.0 — modularized (behavior-preserving)

`index.js` had grown to ~4200 lines. It's now a **64-line entry point** (dispatch + MCP server wiring); everything else lives under `src/`. No tool, description, schema, return value, or error format changed — this is purely structural.

**Project structure**

```
index.js              thin entry: getToken→authHeaders→HANDLERS[name](args, headers); MCP Server + stdio connect
src/
  config.js           env + BASE_URL / HEALTH_BASE / DOWNLOAD_DIR (+ validation)
  auth.js             getToken / authHeaders (private token cache)
  util.js             parseConfigValue / saveFile / extractFilename / ensureDownloadDir
  xlsx.js             buildSystemHealthXlsx / buildMonitoringReportXlsx (OOXML via jszip)
  wsdl.js             generateWsdl / ensureElementFormDefaultQualified
  kb/flowSchema.js    MIP_FLOW_SCHEMA (the flow KB) + validateFlow
  registry.js         imports every tool module → exports { tools[], handlers{} }
  tools/*.js          one module per domain (20): each exports { tools, handlers };
                      handlers are `(args, headers) => …`
```

Adding a tool is now a one-file change (edit the domain module) + one line in `registry.js`. The refactor was done in small verified steps — after each, a harness re-imported the registry, checked the tool set was identical (95), ran offline unit tests for the extracted pure functions, and made read-only live calls; plus a JSON-RPC `tools/list` boot check.

## What's new in 1.0.28 — Danger-zone safety note in the flow schema KB

Added a first-line entry to `MIP_FLOW_SCHEMA.importantNotes` (served by `mip_get_flow_schema`): the MCP deliberately exposes **no** tools for Database Management, DB Analysis & Backup (backup/restore), or license write — these can cause irreversible damage on a live MIP server and must never be built, called, or probed (license is read-only). Bilingual (EN + short TR) so it's clear regardless of the caller's language; the MCP's tool descriptions/KB are static strings and don't auto-translate.

## What's new in 1.0.27 — System Health Excel report (standard template)

- **`mip_generate_system_health_excel`** — samples the health endpoint N times and writes a **fixed-layout** `.xlsx` to `MIP_DOWNLOAD_DIR`. Always the same two sheets: **Ozet** (per-pod CPU% / memory (MB) / inflight min·avg·max + OK/UYARI status) and **Ornekler** (the raw samples). Built as OOXML via JSZip (same approach as the monitoring report), so the template is byte-identical every run — only the values change. Verified valid by reading it back with openpyxl.

## What's new in 1.0.26 — License info (read-only)

Two **read-only** License tools (GET only — no save/write is exposed, by design, on the live customer server):

- **`mip_get_license_detail`** — `GET /api/license/detail`: customerName, licenseType, status, start/end dates, licenseKey, enabledModules, contactMails (the sensitive `licenseKeyData` is masked by the server).
- **`mip_check_license`** — `GET /api/license/check`: `valid`, start/end dates, features.

## What's new in 1.0.25 — Alert Configurations (Management)

The Alert Configurations screen turned out to be reachable after all — it lives behind the `/healthcheck-service` path prefix (`VITE_MAIN_SYSTEM_HEALTH_URL`), not the main API base, which is why it first looked like a 404. Seven tools:

- **Mail receivers** — `mip_list_alert_config_emails` / `mip_add_alert_config_email` / `mip_remove_alert_config_email` (`/healthcheck-service/api/email-alerts`, add is POST, remove is DELETE `/{id}`).
- **Alert rules** — `mip_get_alert_rules` / `mip_update_alert_rules`. Per-component thresholds (cpu/ram/disk %, response-time ms, db-size GB, connection-pool %). Update merges each `componentKey` you pass against the current rules and PUTs the full array to `/api/alert-rules/multiple-component`, so partial edits keep the rest.
- **Cron frequency** — `mip_get_cron_frequency` / `mip_update_cron_frequency`. Per-component health-check cron; same merge-and-PUT to `/api/cron-frequency/multiple-component`.

Verified live without disturbing real config: an email was added then removed (round-trip), and rules/cron write paths confirmed with no-op PUTs (current values sent back unchanged). The base defaults to `/healthcheck-service`, overridable via `MIP_HEALTH_PATH`.

## What's new in 1.0.24 — Management: System Health & Test Connectivity

Safe, read/diagnostic Management tools (destructive areas deliberately untouched — see note):

- **`mip_get_system_health`** — `GET /api/backend-system-statics`: per-pod `cpuLoad` (0-1), `memoryLoad` (MB), `inflightExchanges`. Read-only.
- **`mip_generate_system_health_report`** — samples the health endpoint N times (default 4 × 800ms) and produces a Markdown report: per-pod CPU%, memory (MB/GB), and inflight min/avg/max with OK/warning thresholds. (This instance has no historical health data, so the report is based on the short sampling window.)
- **`mip_test_connectivity`** — `PUT /api/test-connectivity` with `{host, port}`: MIP tests reaching the target (non-destructive TCP/HTTP handshake), returns `{status, resultCode, duration, responsePayload}`.

**System Logs** is already covered by `mip_get_system_logs`. **Not built:** Database Management, DB Analysis & Backup, and License Settings are intentionally left untouched on the live customer server (irreversible risk). Alert Configurations, health-score, and backup/restore live on a separate `VITE_MAIN_SYSTEM_HEALTH_URL` service that isn't configured on this instance (they 404), so they aren't exposed.

## What's new in 1.0.23 — Editors: run Groovy & XSLT

The execute-style Editors now work through the MCP (the Groovy editor previously appeared broken):

- **`mip_execute_groovy_script`** — `POST /api/groovy-script-execute`: run a Groovy script against an input body + headers + properties, returns `{output, headers, properties}`. **Key gotcha** (why it "didn't work" before): the editor's default template types the parameter as `org.apache.camel.Exchange`, but at runtime MIP passes a `com.mdp.middleware.processor.connector.mappings.ScriptExchangeDTO`, and static type-checking rejects the mismatch. The script must be `def executeMessage(com.mdp.middleware.processor.connector.mappings.ScriptExchangeDTO message) { …; return message }`. DTO API: `getBody/setBody`, `getHeaders/setHeader`, `getProperties/setProperty`.
- **`mip_execute_xslt_transform`** — `POST /api/xslt-transform-execute` with `{inputXml, xsltCode}`: apply an XSLT stylesheet to XML, returns `{output, xsltVersion, outputMethod, status, errors}`.

Both verified live (Groovy uppercases a body + sets header/property; XSLT transforms an order into a result doc). The visual JSON Designer and XSD Designer are model-tree GUIs, not exposed as tools.

## What's new in 1.0.22 — MCP Server sync & tool discovery

Completes the MCP Servers feature. A newly created MCP server is `NOT_SYNCED` and exposes no tools until MIP connects to it:

- **`mip_sync_mcp_server`** — `POST /api/mcp-servers/{id}/refresh-tools`: MIP connects to the external MCP server and enumerates its tools; reports `connectionStatus` (SYNCED/FAILED) and `toolsCount`.
- **`mip_list_mcp_server_tools`** — `GET /api/mcp-servers/{id}/tools`: the discovered tools with name, description, and input/output JSON schemas.

Verified live end-to-end: a server pointed at the public `https://mcp.deepwiki.com/sse` synced to **SYNCED** and discovered 3 tools (`ask_question`, `read_wiki_contents`, `read_wiki_structure`). Note: the target MIP host connects to **remote HTTP/SSE** MCP servers; local stdio (`command`/`npx`) servers failed to sync on it.

## Fixed in 1.0.21 — JDBC destination requires user/password for all drivers

Live testing across all five drivers revealed the backend requires `userName` and `password` for **every** driver, including MongoDB (the UI's validation exempts MongoDB, but the API rejects a blank credential). `mip_create_jdbc_destination` now marks both as required and no longer special-cases MongoDB.

## What's new in 1.0.20 — OFTP2 Connections (Destinations, complete)

Final Destinations group — completing full MCP coverage of the Destinations menu.

- **OFTP2 Connections** (`/api/oftp-connections`) — `mip_list/create/update/delete_oftp2_connection`. Own/partner SSID·SFID·password, `expectedVirtualFileName` (regex), encoding, compress/secure/sign/verify flags. Create/update **require** a `partnerCertificateId` (a certificate) and `ownKeyStoreId` (a keystore) — the payload sends `oftp2PartnerCertificateId`/`oftp2OwnKeyStoreId`. Passwords are hidden in list and preserved on update when omitted.

Verified end-to-end (since 1.0.22): OFTP2 mandatorily needs a keystore, so a test JKS was generated and uploaded, then a connection was created (partner cert + own keystore, signed + verify) and updated (merge, values preserved). Create and update both confirmed live.

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

## License

MIT
