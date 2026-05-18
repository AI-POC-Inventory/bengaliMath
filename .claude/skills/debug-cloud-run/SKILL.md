---
description: Debug Cloud Run services by fetching and analyzing logs for errors and issues
allowed-tools: Bash(gcloud runs services list) Bash(gcloud logging read) Bash(gcloud runs describe) Bash(gcloud runs metrics)
---

## Input Parameters

**Service Name:** {service_name}  
**Time Range:** Last 1 hour (configurable)  
**Log Level Filter:** ERROR, WARNING, or ALL

---

## Step 1: Verify Service Exists

!`gcloud run services list --format="table(metadata.name,status.conditions[0].type)" 2>&1 | grep {service_name}`

If the service is not found, please provide the exact service name from the list above.

---

## Step 2: Get Service Details & Status

!`gcloud run services describe {service_name} --format="yaml(metadata.name, status.conditions, status.url, status.observedGeneration)" 2>&1`

---

## Step 3: Fetch Recent Error Logs (Last Hour)

!`gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name={service_name} AND severity>=ERROR" --limit=50 --format=json 2>&1 | head -100`

---

## Step 4: Fetch Warning Logs (Last Hour)

!`gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name={service_name} AND severity=WARNING" --limit=30 --format=json 2>&1 | head -80`

---

## Step 5: Check Recent Container Metrics

!`gcloud monitoring time-series list --filter="resource.type=cloud_run_revision AND resource.labels.service_name={service_name}" --format=json 2>&1 | head -50`

---

## Step 6: Check Cloud Run Revisions & Deployment Status

!`gcloud run revisions list --service={service_name} --format="table(metadata.name, status.conditions[0].type, status.conditions[0].status, metadata.creationTimestamp)" 2>&1`

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

## Useful Commands for Manual Investigation

```bash
# Stream live logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name={service_name}" --limit=100 --format=text

# Get service configuration
gcloud run services describe {service_name} --format=json

# Check environment variables (if accessible)
gcloud run services describe {service_name} --format='value(spec.template.spec.containers[0].env[*])'

# View deployment history
gcloud run revisions list --service={service_name} --limit=10

# Check if service is receiving traffic
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name={service_name}" --format="table(timestamp, severity, jsonPayload.message)" --limit=100
```

---

## Notes

- Logs are typically available for 30 days
- Real-time streaming: Use `gcloud logging read` with `--follow` flag
- For detailed metrics: Check Cloud Run dashboard in Google Cloud Console
- If gcloud command fails: Ensure you're authenticated (`gcloud auth login`) and have proper permissions
