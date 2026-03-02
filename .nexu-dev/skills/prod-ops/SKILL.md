---
name: prod-ops
description: Use when the user says "production", "prod", "deploy to prod", "run migration", "connect to prod DB", "check prod", "prod secrets", or needs any production environment operations. Covers EKS, RDS, SSM tunnels, migrations, secrets, and post-deploy tasks.
---

# Nexu Production Operations

Production environment operations for the Nexu platform on AWS (EKS + RDS).

## Quick Reference

| Resource | Value |
|----------|-------|
| EKS cluster | `nexu-prod-eks` (us-east-1) |
| K8s namespace | `nexu` |
| RDS host | `nexu-prod-db.cb8aa42esqoe.us-east-1.rds.amazonaws.com` |
| SSM jump host | `i-08ffa2a4100b49346` |
| Local DB tunnel port | `5434` |
| DB name | `nexu` |
| DB user | `nexu_app` |
| Secrets K8s secret | `nexu-secrets` (17 keys) |

## Operations

### 1. Connect to EKS Cluster

```bash
aws eks update-kubeconfig --region us-east-1 --name nexu-prod-eks
kubectl get pods -n nexu
```

Verify pods: `nexu-api`, `nexu-gateway-*`, `nexu-web`.

### 2. Connect to Production Database

**Step A — SSM tunnel** (keep terminal open):

```bash
aws ssm start-session \
  --target "i-08ffa2a4100b49346" \
  --document-name "AWS-StartPortForwardingSessionToRemoteHost" \
  --parameters '{"host":["nexu-prod-db.cb8aa42esqoe.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5434"]}'
```

**Step B — Connect** (in another terminal):

```bash
psql "postgresql://nexu_app:jmw%5B%7C7gW8f6XrFpE%3EKMbI~s_Y2QH@localhost:5434/nexu"
```

Password (URL-decoded): `jmw[|7gW8f6XrFpE>KMbI~s_Y2QH`

### 3. Run Migrations

After establishing the SSM tunnel, run the app migration against production:

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
DATABASE_URL="postgresql://nexu_app:jmw%5B%7C7gW8f6XrFpE%3EKMbI~s_Y2QH@localhost:5434/nexu" \
  node -e "import('./apps/api/src/db/migrate.ts').then(m => m.migrate('postgresql://nexu_app:jmw%5B%7C7gW8f6XrFpE%3EKMbI~s_Y2QH@localhost:5434/nexu')).catch(e => { console.error(e); process.exit(1); })"
```

Or run specific DDL directly via psql. Always use `IF NOT EXISTS` / `IF NOT EXISTS` for idempotency.

**Do NOT use `drizzle-kit push`** — it tries to drop better-auth tables.

### 4. Port-Forward to Internal Services

Access internal APIs without going through ingress:

```bash
# API (port 3001 locally → 3000 in cluster)
kubectl port-forward -n nexu svc/nexu-api 3001:3000

# Gateway (port 18790 locally → 18789 in cluster)
kubectl port-forward -n nexu svc/nexu-gateway 18790:18789
```

### 5. Read Production Secrets

```bash
# List all secret keys
kubectl get secret -n nexu nexu-secrets -o json | jq -r '.data | keys[]'

# Read a specific secret
kubectl get secret -n nexu nexu-secrets -o jsonpath='{.data.INTERNAL_API_TOKEN}' | base64 -d

# Common keys: INTERNAL_API_TOKEN, ENCRYPTION_KEY, DATABASE_URL
```

### 6. Store Pool Secrets (Post-Deploy)

After deploying code that includes the PUT secrets endpoint:

```bash
# Get production internal token
PROD_TOKEN=$(kubectl get secret -n nexu nexu-secrets -o jsonpath='{.data.INTERNAL_API_TOKEN}' | base64 -d)

# Port-forward to API
kubectl port-forward -n nexu svc/nexu-api 3001:3000 &

# Insert secrets for each pool (pool_prod_01, gateway_pool_1, gateway_pool_2)
curl -X PUT http://localhost:3001/api/internal/pools/<poolId>/secrets \
  -H "x-internal-token: ${PROD_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"secrets":{"KEY_NAME":"value"}}'
```

Secrets are encrypted by the API using the production `ENCRYPTION_KEY`. You cannot INSERT encrypted values directly via SQL.

### 7. Sync Skills to Production

```bash
PROD_TOKEN=$(kubectl get secret -n nexu nexu-secrets -o jsonpath='{.data.INTERNAL_API_TOKEN}' | base64 -d)

# Port-forward if not already active
kubectl port-forward -n nexu svc/nexu-api 3001:3000 &

# Read local skill files and PUT to production
node -e "
const fs = require('fs');
const skillMd = fs.readFileSync('$HOME/.openclaw/skills/<skill-name>/SKILL.md', 'utf8');
const extraFiles = {};  // e.g. { 'scripts/deploy.sh': fs.readFileSync('...', 'utf8') }
fetch('http://localhost:3001/api/internal/skills/<skill-name>', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'x-internal-token': '${PROD_TOKEN}' },
  body: JSON.stringify({ content: skillMd, files: extraFiles, status: 'active' })
}).then(r => r.json()).then(console.log);
"
```

### 8. Check Deployed Version

```bash
curl -s http://localhost:3001/health | jq .metadata.commitHash
# Compare with: git log --oneline origin/main -1
```

### 9. View Pod Logs

```bash
# API logs
kubectl logs -n nexu -l app=nexu-api --tail=100 -f

# Gateway logs
kubectl logs -n nexu nexu-gateway-1 --tail=100 -f
```

## Production Pool IDs

| Pool ID | Pool Name | Notes |
|---------|-----------|-------|
| pool_prod_01 | prod-pool-01 | Primary production pool |
| gateway_pool_1 | gateway_pool_1 | Additional gateway |
| gateway_pool_2 | gateway_pool_2 | Additional gateway |

## Rules

1. **Always use SSM tunnel** for DB access — RDS is in a private subnet
2. **Never run `drizzle-kit push`** against production — it drops auth tables
3. **Use `IF NOT EXISTS`** for all DDL statements
4. **Secrets go through the API** — never insert encrypted values directly via SQL
5. **Confirm with user** before any destructive operation (DROP, DELETE, TRUNCATE)
6. **Keep SSM tunnel terminal open** — closing it drops the connection
7. **Kill port-forwards** when done — `pkill -f "kubectl port-forward.*nexu"`
