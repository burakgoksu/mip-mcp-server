# mip-mcp-server

MCP (Model Context Protocol) server for **MIP** — MDP Group's Integration Platform. Enables AI assistants (Claude, etc.) to manage MIP flows, packages, resources, credentials, service users, certificates, keystores, mappings, and logs through natural language.

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

### Resources (Groovy / XSLT)

| Tool | Description |
|---|---|
| `mip_upload_resource` | Uploads a Groovy script (`.groovy`) or XSLT file (`.xsl`) to a flow |
| `mip_reupload_resource` | Updates an existing Groovy or XSLT resource by ID |
| `mip_list_resources` | Lists all resources; optionally filter by flow ID |

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

## License

MIT
