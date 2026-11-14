# EcoUrba

**Urban Microclimate & Environmental Trend Detective**  
NASA International Space Apps Challenge 2026 — Cochabamba

---

## Overview

EcoUrba is an open-source platform designed to analyze, visualize, and forecast urban microclimate dynamics across the 15 Municipal Districts of Cochabamba, Bolivia. By fusing NASA Earth Science satellite observations (LST, NDVI, AOD) with local ground-truth data from the GAMC Red MÓNICA network, EcoUrba provides actionable insights into urban heat islands, vegetation loss, and environmental trends with statistical significance ($p < 0.05$).

---

## Architecture & Tech Stack

```
eco-urba/
├── backend/            # High-performance REST API & Scientific Data Engine (FastAPI)
│   ├── src/backend/    # Modular clean architecture (core, api/v1)
│   └── pyproject.toml  # Managed with uv (Python 3.12)
├── frontend/           # Reactive Geospatial Dashboard (Angular 19+)
│   └── src/            # Standalone components, Signals, MapLibre/Leaflet
└── docs/               # Contextual and scientific documentation
    └── 00-contexto/    # NASA Space Apps & GAMC problem definitions
```

- **Frontend:** [Angular](https://angular.dev/) (Standalone Components, Signals, SCSS).
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) powered by [uv](https://docs.astral.sh/uv/) and Python 3.12.
- **License:** [MIT License](LICENSE)

---

## Quickstart

### 1. Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node.js 20+ and npm

### 2. Backend Setup

```bash
cd backend
uv sync
uv run backend
# API running at http://localhost:8000
# Swagger docs at http://localhost:8000/api/v1/docs
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
# App running at http://localhost:4200
```

---

## License

This project is licensed under the terms of the [MIT License](LICENSE).
