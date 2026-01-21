This folder contains a small Prometheus exporter demo for the MiniCoders project.

Usage (from repository root):

1. Install dependencies for the exporter:

```powershell
cd metrics
npm install
```

2. Start with Docker Compose (recommended):

```powershell
docker-compose up --build
```

This will start:
- Metrics exporter on port `9100`
- Prometheus on port `9090`
- Grafana on port `3000` (admin/admin)

3. Import a Grafana dashboard or build panels using metrics:

- `facility_review_count{facility="..."}`
- `facility_average_rating{facility="..."}`
- `facility_favorites_count{facility="..."}`

Use Prometheus functions like `topk(1, facility_review_count)` to find top facility by reviews.
