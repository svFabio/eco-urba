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
├── backend/            # High-performance async REST API & Scientific Data Engine (FastAPI)
│   ├── src/backend/    # Modular clean architecture (core, api/v1, services, schemas)
│   ├── tests/          # Pytest suite with async ASGI testing
│   └── pyproject.toml  # Managed with uv (Python 3.12)
├── frontend/           # Reactive Geospatial Dashboard (Angular 22)
│   └── src/app/        # Standalone components, Signals, Leaflet map integration
├── data/               # Local datasets (gitignored: Red MÓNICA CSVs, GeoJSONs)
└── docs/               # Architecture, NASA AppEEARS & GAMC GeoServer documentation
```

- **Frontend:** [Angular 22](https://angular.dev/) (Standalone Components, Signals, [Leaflet](https://leafletjs.com/), SCSS).
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) powered by [uv](https://docs.astral.sh/uv/) and Python 3.12.
- **Testing:** [Pytest](https://docs.pytest.org/) with `pytest-asyncio`.
- **License:** [MIT License](LICENSE)

---

## Quickstart

### 1. Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node.js 20+ and npm

### 2. Backend Setup

```bash
cd backend
# 1. Setup environment variables
cp .env.example .env
# Edit .env with your NASA Earthdata and GAMC credentials

# 2. Sync dependencies
uv sync

# 3. Run test suite
uv run pytest

# 4. Start API server
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
