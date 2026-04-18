# TrainDoctor Project

This scaffold uses the uploaded React/Vite `src/` UI as the real frontend base and a FastAPI backend skeleton.

## Structure
- `frontend/` - actual uploaded UI source plus missing config/data files
- `backend/app/` - FastAPI routers/services
- `backend/core/` - place your real Python logic here
- `backend/runs/` - pipeline outputs
- `shared/` - API contract notes

## Important
The backend core files are placeholders in this scaffold. Replace them with your real files from `traindoctor_multi`:
- config_utils.py
- dataset_utils.py
- training_utils.py
- diagnosis_utils.py
- llm_utils.py
- report_utils.py
- pipeline_worker.py

Then wire:
- `backend/app/services/dataset_service.py`
- `backend/app/services/diagnosis_service.py`
- `backend/app/services/llm_service.py`

to `backend/core/*`.

## Run frontend
```bash
cd frontend
npm install
npm run dev
```

## Run backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```