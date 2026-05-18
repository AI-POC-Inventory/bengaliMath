---
description: Debug Cloud Run services by fetching and analyzing logs for errors and issues
allowed-tools: gcp-run-logs gcp-run-services gcp-cloud-logging gcp-run-describe gcp-run-revisions
---

## Input Parameters

**Service Name:** {service_name}  
**Time Range:** Last 1 hour (configurable)  
**Log Level Filter:** ERROR, WARNING, or ALL

---

## Step 1: Verify Service Exists

Use GCP MCP tool `gcp-run-services` to list all Cloud Run services and verify `{service_name}` exists.

If the service is not found, please provide the exact service name from the list.

---

## Step 2: Get Service Details & Status

Use GCP MCP tool `gcp-run-describe` to fetch detailed information about service `{service_name}`:
- Service name, status, URL
- Conditions and deployment status
- Resource allocation and configuration

---

## Step 3: Fetch Recent Error Logs (Last Hour)

Use GCP MCP tool `gcp-cloud-logging` to query logs for service `{service_name}`:
- Filter: severity >= ERROR
- Time range: Last 1 hour
- Limit: 50 entries
- Look for patterns in error messages

---

## Step 4: Fetch Warning Logs (Last Hour)

Use GCP MCP tool `gcp-cloud-logging` to query logs for service `{service_name}`:
- Filter: severity = WARNING
- Time range: Last 1 hour
- Limit: 30 entries
- Identify potential issues before they become errors

---

## Step 5: Check Recent Container Metrics

Use GCP MCP tool to fetch Cloud Run revision metrics:
- CPU usage trends
- Memory usage
- Request latency
- Error rates over time

---

## Step 6: Check Cloud Run Revisions & Deployment Status

Use GCP MCP tool `gcp-run-revisions` to list recent revisions for service `{service_name}`:
- Revision names and timestamps
- Deployment status (ACTIVE, SUPERSEDED, etc.)
- Traffic allocation
- Creation time relative to error occurrence

---

## Analysis Instructions

Based on the logs fetched above:

### 1. **Error Summary**
   - Count total errors in the last hour
   - Group errors by type (connection, timeout, out-of-memory, permission, etc.)
   - Identify the most frequent error

### 2. **Critical Issues to Check**
   - **Connection Errors**: Database unreachable? External API timeout?
   - **Authentication/Authorization**: Permission denied on resources?
   - **Out of Memory**: Container hitting memory limits?
   - **Timeout**: Requests taking too long?
   - **Dependency Issues**: Missing environment variables or secrets?
   - **Resource Exhaustion**: CPU/Memory at limit?

### 3. **Recent Deployments**
   - Check if errors coincide with recent deployment
   - Compare error rate before/after deployment

### 4. **Recommendations**
   - If connection errors: Verify network configuration, VPC, firewall rules
   - If OOM: Increase memory allocation in Cloud Run settings
   - If timeout: Check backend service health, increase timeout setting
   - If auth fails: Verify service account permissions, check secret manager
   - If recent deploy caused issues: Consider rolling back to previous revision

### 5. **Output Format**

Report findings as:
- **Status**: ✅ Healthy / ⚠️ Warning / ❌ Error
- **Error Count**: X errors in last hour
- **Top Errors**: List the 3 most frequent issues
- **Root Cause**: Best guess based on logs
- **Quick Fixes**: Actionable next steps

---

## GCP MCP Server Setup (Optional)

To enable GCP MCP server for enhanced Cloud Run debugging:

1. Configure GCP MCP in `.claude/settings.json`:
```json
{
  "mcpServers": {
    "gcp": {
      "command": "npx",
      "args": ["@anthropic-ai/sdk/gcp-mcp"]
    }
  }
}
```

2. Available GCP MCP tools:
   - `gcp-run-services` - List all Cloud Run services
   - `gcp-run-describe` - Get service details
   - `gcp-cloud-logging` - Read logs with filters
   - `gcp-run-revisions` - List service revisions
   - `gcp-metrics` - Fetch metrics and performance data

---

## Fallback: Manual gcloud Commands

If GCP MCP is not available, use these gcloud commands:

```bash
# Stream live logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name={service_name}" --limit=100 --format=text

# Get service configuration
gcloud run services describe {service_name} --format=json

# Check environment variables
gcloud run services describe {service_name} --format='value(spec.template.spec.containers[0].env[*])'

# View deployment history
gcloud run revisions list --service={service_name} --limit=10

# Check if service is receiving traffic
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name={service_name}" --format="table(timestamp, severity, jsonPayload.message)" --limit=100
```

---

## Notes

- **GCP MCP** is preferred for structured data and better integration
- Logs are typically available for 30 days
- Real-time streaming: Use `gcloud logging read --follow` (gcloud only)
- For advanced metrics: Check Cloud Run dashboard in Google Cloud Console
- If using gcloud: Ensure authentication (`gcloud auth login`) and proper permissions
