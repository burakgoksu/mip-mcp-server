# mip-mcp-server

MCP (Model Context Protocol) server for **MIP** — MDP Group's Integration Platform. Enables AI assistants (Claude, etc.) to manage MIP flows, packages, resources, credentials, service users, certificates, keystores, mappings, and logs through natural language.

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
| `mip_download_logs` | Downloads flow monitoring logs (success/error/delivering counts) by date range |
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
