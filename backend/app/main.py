from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.routers.dataset import router as dataset_router
from backend.app.routers.pipeline import router as pipeline_router
from backend.app.routers.runs import router as runs_router
from backend.app.routers.diagnosis import router as diagnosis_router
from backend.app.routers.llm import router as llm_router
from backend.app.routers.compare import router as compare_router

app = FastAPI(
    title="TrainDoctor API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dataset_router)
app.include_router(pipeline_router)
app.include_router(runs_router)
app.include_router(diagnosis_router)
app.include_router(llm_router)
app.include_router(compare_router)

@app.get("/")
def root():
    return {"status": "ok"}