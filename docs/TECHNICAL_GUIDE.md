# Technical Guide - RealStateAI

## 1. Architecture

```text
Streamlit Frontend -> FastAPI Backend -> DVF Clean Dataset (CSV)
```

- Frontend sends user input to backend.
- Backend validates payload, searches comparable DVF transactions, computes estimation.
- If DVF file is missing, backend falls back to mock model.

## 2. Backend Design

Main file: `Backend/main.py`

Key responsibilities:
- Load DVF dataset at startup
- Expose health and metadata endpoints
- Expose estimation endpoint
- Fallback search strategy when exact match is not found

### Endpoints
- `GET /api/health`
  - Returns app status, DVF loaded state, active DVF file path, and error message.
- `GET /api/metadata/communes`
  - Returns sorted unique communes available in current DVF dataset.
- `POST /api/predictions/estimate`
  - Input: area, rooms, property_type, commune or address
  - Output: predicted price, price/m2, confidence interval, model source (`dvf` or `mock`)

## 3. Estimation Logic

1. Validate request with Pydantic.
2. If DVF dataset is unavailable -> return mock estimate.
3. Resolve commune from:
   - `commune` field directly, or
   - parsed `address` fallback.
4. Search transactions by:
   - normalized commune
   - property type
   - surface tolerance
5. If no exact result, apply fallback search:
   - commune prefix/contains strategy (e.g., `Paris` -> `PARIS 01..20`)
   - wider surface tolerance
   - `studio -> apartment` fallback
6. Compute final price from transaction statistics.

## 4. Data Pipeline

Pipeline file: `Backend/Data pipeline/Traitement/dvf_data_pipeline.py`

### Inputs
- `ValeursFoncieres-<Year>.txt`
- `ValeursFoncieres-<Year-1>.txt`

### Processing
- Keep relevant columns only
- Type conversion (numeric/date/string)
- Filter invalid rows (`price <= 0`, `surface <= 0`)
- Filter Ile-de-France departments (`75, 77, 78, 91, 92, 93, 94, 95`)
- Keep only `house` and `apartment`
- Compute `prix_au_m2`
- Remove duplicates

### Output
- `Backend/Data pipeline/outputs/DVF_clean_<Year-1>_<Year>.csv`

## 5. Frontend Design

Main file: `Frontend/app.py`

- Loads commune list from backend metadata endpoint.
- Commune input is a searchable select component.
- Sends estimation payload to backend.
- Displays:
  - predicted price
  - price per square meter
  - confidence interval
  - technical JSON details

## 6. Configuration

### Environment variables
- `BACKEND_URL` (frontend): backend base URL
- `DVF_CLEAN_PATH` (backend, optional): explicit CSV path override

## 7. Test Strategy

Current automated test:
- `Backend/tests/test_endpoints.py`
- Covers `/api/health` status code and response shape.

Recommended next tests:
- Unit tests for fallback search behavior
- Endpoint tests for commune/address fallbacks
- Data quality tests for pipeline output

## 8. Known Limitations

- No trained ML model yet (statistical estimation on cleaned DVF data)
- No persistent database integration
- Limited automated test coverage

## 9. Production Hardening Roadmap

1. Add robust outlier filtering policy in pipeline.
2. Add API contract tests and CI checks.
3. Add versioned dataset management and data lineage.
4. Add observability (structured logs + metrics).
5. Add authentication and rate limiting if exposed publicly.
