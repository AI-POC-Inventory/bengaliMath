# GitHub Secrets & Variables Setup

Set these in your repo: **Settings → Secrets and variables → Actions**

## Secrets  (Settings → Secrets → New repository secret)

| Secret name        | Value |
|--------------------|-------|
| `GCP_PROJECT_ID`   | Your GCP project ID (e.g. `my-project-123`) |
| `GCP_SA_KEY`       | Full JSON of the GCP service-account key (see below) |
| `SUPABASE_URL`     | Your Supabase project URL |
| `SUPABASE_KEY`     | Your Supabase service-role or anon key |
| `CORS_ORIGINS`     | Comma-separated allowed origins (e.g. `https://your-ui.vercel.app`) |

## Variables  (Settings → Variables → New repository variable)

| Variable name | Value | Default |
|---------------|-------|---------|
| `GCP_REGION`  | GCP region (e.g. `asia-south1`) | `us-central1` |

---

## Creating the GCP Service Account key

```bash
PROJECT=<your-gcp-project-id>

# 1. Create a service account
gcloud iam service-accounts create github-actions-deployer  --display-name "GitHub Actions Deployer"   --project $PROJECT

SA="github-actions-deployer@${PROJECT}.iam.gserviceaccount.com"

# 2. Grant the minimum required roles
gcloud projects add-iam-policy-binding root-slate-312607  --member "serviceAccount:${SA}"   --role "roles/run.admin"

gcloud projects add-iam-policy-binding root-slate-312607  --member "serviceAccount:${SA}"   --role "roles/storage.admin"          # push to GCR

gcloud projects add-iam-policy-binding root-slate-312607  --member "serviceAccount:${SA}"   --role "roles/iam.serviceAccountUser" # act-as for Cloud Run

# 3. Create and download the JSON key
gcloud iam service-accounts keys create sa-key.json \
  --iam-account $SA \
  --project $PROJECT

# 4. Copy the ENTIRE contents of sa-key.json into the GCP_SA_KEY secret.
#    Delete sa-key.json locally afterwards.
cat sa-key.json
```

> **Tip:** If you prefer keyless auth (Workload Identity Federation) over a JSON
> key, see https://github.com/google-github-actions/auth#setup