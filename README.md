# TrainDoctor: An Agentic AI System for Model Diagnosis and Iterative Improvement

TrainDoctor is an agentic artificial intelligence system designed to transform how machine learning models are developed, evaluated, and improved. Instead of treating model training as a static process followed by manual debugging, the system introduces a feedback-driven workflow that continuously analyzes performance, identifies failure modes, and recommends targeted improvements.

The system is motivated by a fundamental challenge in applied machine learning: while models can be trained efficiently, understanding *why* they fail and *how* to improve them remains largely manual and dependent on expert intuition. TrainDoctor addresses this gap by acting as an intelligent assistant that observes model behavior, reasons about failure patterns, and guides iterative refinement.

---

## System Overview

TrainDoctor operates as a closed-loop system. A dataset and configuration are provided by the user, after which the system executes a pipeline that includes dataset analysis, model training, evaluation, failure detection, and diagnostic reasoning. Rather than producing only performance metrics, the system generates structured insights, natural language explanations, and actionable recommendations.

These outputs enable the creation of an improved configuration, forming an iterative cycle that continuously enhances model performance. This transforms the workflow from a static evaluation process into a dynamic, agent-driven improvement loop.

---

## System Architecture

The architecture of TrainDoctor is organized into three primary layers: the user interface, the backend orchestration layer, and the core pipeline engine.

The frontend is implemented using React and provides an interactive environment for configuring experiments, monitoring progress, and exploring outputs. It includes views for performance metrics, failure cases, diagnosis summaries, and recommendations.

The backend is implemented using FastAPI and serves as the orchestration layer. It exposes APIs for dataset processing, pipeline execution, diagnostic analysis, LLM-based explanation, and experiment tracking. Each execution is managed as a structured run, enabling reproducibility and comparison.

The core pipeline engine contains the logic for dataset preparation, model training, evaluation, and analysis. It integrates multiple modules responsible for dataset auditing, failure detection, diagnosis, recommendation generation, and reporting. These components collectively enable the system’s agentic behavior.

An architectural overview of the system is shown below.

![System Architecture](docs/architecture.png)

---

## Functional Workflow

The workflow begins with dataset ingestion and configuration. The system performs a dataset audit to evaluate class distribution, detect potential imbalances, and identify data quality issues. This stage provides early insight into factors that may affect model performance.

Following this, the system executes model training and evaluation. Standard metrics such as Intersection over Union (IoU), Dice coefficient, precision, and recall are computed and stored as part of the run artifacts.

The system then performs failure detection by identifying samples where the model performs poorly. These cases are grouped into interpretable categories, allowing patterns such as background confusion or low-quality inputs to emerge.

The diagnosis engine builds on these patterns to perform root cause analysis. It correlates dataset characteristics with performance outcomes to identify issues such as insufficient representation of certain classes, annotation inconsistencies, or suboptimal training configurations.

To improve interpretability, the system integrates a language model that translates diagnostic findings into natural language explanations. These explanations are designed to be clear, informative, and grounded in the underlying data.

The final stage involves recommendation generation. Based on the diagnosis, the system proposes specific actions such as adjusting hyperparameters, augmenting data, balancing class distributions, or refining annotations. A new configuration can be generated, enabling the next iteration of the pipeline.

---

## Agentic Behavior

TrainDoctor is designed as an agentic system in that it goes beyond executing predefined steps. It actively participates in decision-making by observing results, reasoning about failure causes, and suggesting improvements.

This behavior is realized through the integration of analysis modules, diagnostic reasoning, and recommendation generation within a unified workflow. The system effectively serves as an intelligent assistant that guides the model development process.

---

## LLM Integration and Evaluation

The system incorporates a language model to enhance interpretability. Diagnostic outputs are translated into natural language explanations, making them accessible to a broader range of users.

To ensure reliability, TrainDoctor includes a structured evaluation framework for LLM outputs. Each explanation is assessed based on relevance, faithfulness to the underlying data, actionability of recommendations, clarity of communication, and safety considerations. This evaluation provides transparency and supports responsible use of AI-generated insights.

---

## Experiment Tracking and Reproducibility

Each pipeline execution is stored as a structured run. This includes configuration files, performance metrics, predictions, logs, diagnostic outputs, and recommendations. The system supports reconstruction of missing artifacts and comparison between runs, ensuring reproducibility and facilitating systematic experimentation.

---

## Project Structure

The repository is organized into frontend, backend, and core logic components.

```id="projstruct1"
frontend/                  # React-based user interface
  src/
    components/            # Reusable UI components (MetricCard, FindingCard, etc.)
    pages/                 # Application pages (Overview, Diagnosis, Recommendations, etc.)
    api/                   # API interaction layer
    hooks/                 # Custom React hooks

backend/
  app/
    routers/               # FastAPI route definitions
    services/              # Business logic for dataset, pipeline, diagnosis, LLM, etc.
    main.py                # Application entry point
  core/
    dataset_utils.py       # Dataset processing and auditing
    training_utils.py      # Model training and evaluation
    diagnosis_utils.py     # Failure detection and diagnosis logic
    llm_utils.py           # LLM interaction logic
    report_utils.py        # Reporting and recommendation generation
    pipeline_worker.py     # Pipeline execution engine
  runs/                    # Stored experiment outputs and artifacts

shared/                    # API contracts and shared definitions
```

---

## Installation and Setup

To run the system locally, both the frontend and backend must be initialized.

Frontend:

```id="setup1"
cd frontend
npm install
npm run dev
```

Backend:

```id="setup2"
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## Application Workflow

A typical usage scenario proceeds as follows. The user uploads a dataset and configures the pipeline through the frontend interface. The system executes the pipeline, performing dataset analysis, model training, and evaluation. It then detects failure cases, generates diagnostic insights, and produces natural language explanations. Based on these insights, the system recommends improvements and generates a new configuration, enabling iterative refinement of the model.

---

## Use Cases

TrainDoctor is applicable to a range of machine learning applications, particularly in domains where interpretability and iterative improvement are critical. These include computer vision tasks such as image segmentation and classification, as well as scientific and environmental monitoring applications.

---

## Conclusion

TrainDoctor represents a shift from conventional machine learning pipelines toward intelligent, agent-driven systems. By combining automated analysis, diagnostic reasoning, and explainable outputs, it enables a more efficient and informed approach to model development and optimization.

---

## Author

Razin Bin Issa
Artificial Intelligence, Robotics, and Environmental Systems
