from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="RealEstateAI Backend")

# CORS pour Streamlit
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "RealEstateAI API"}

# Model requête
class EstimationRequest(BaseModel):
    area_m2: float
    rooms: int
    location_lat: float
    location_lng: float
    property_type: str = "apartment"

# Prédiction simple (mock)
@app.post("/api/predictions/estimate")
def estimate(req: EstimationRequest):
    """Prédiction simple du prix basée sur surface"""
    
    # Logique : surface × prix_base
    base_price_per_m2 = 7000
    
    # Ajustement type propriété
    type_multipliers = {
        "studio": 1.2,
        "apartment": 1.0,
        "house": 0.9
    }
    multiplier = type_multipliers.get(req.property_type, 1.0)
    
    # Calcul
    price = req.area_m2 * base_price_per_m2 * multiplier
    margin = price * 0.15
    
    return {
        "predicted_price": round(price, 2),
        "price_per_m2": round(price / req.area_m2, 2),
        "confidence_interval": {
            "lower": round(price - margin, 2),
            "upper": round(price + margin, 2),
            "confidence": "85%"
        },
        "model": "Simple Regression v0.1"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)