# API Contract

## Main endpoints
- POST /pipeline/start
- GET /pipeline/{run_id}/status
- POST /pipeline/{run_id}/stop
- GET /runs
- GET /runs/{run_id}/summary
- GET /runs/{run_id}/train-log
- GET /runs/{run_id}/test-metrics
- GET /runs/{run_id}/per-image
- GET /runs/{run_id}/iterations
- GET /runs/{run_id}/diagnosis
- GET /runs/{run_id}/recommendations
- GET /runs/{run_id}/failure-groups
- POST /runs/{run_id}/explanation
- GET /compare?run_a=...&run_b=...