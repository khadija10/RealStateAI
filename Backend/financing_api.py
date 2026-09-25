from __future__ import annotations

import sys
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


FINANCING_SRC = Path(__file__).resolve().parent.parent / "financement" / "src"
if str(FINANCING_SRC) not in sys.path:
    sys.path.insert(0, str(FINANCING_SRC))

from realstate_financement.agent import Agent  # noqa: E402
from realstate_financement.config import parametre  # noqa: E402
from realstate_financement.dossier import generer_dossier, resumer_dossier  # noqa: E402
from realstate_financement.modeles import ProfilEmprunteur, Projet  # noqa: E402


router = APIRouter(prefix="/api/financing", tags=["financement"])
SESSIONS: dict[str, Agent] = {}


class BorrowerInput(BaseModel):
    revenus_nets_mensuels: float = Field(..., gt=0)
    apport: float = Field(default=0, ge=0)
    charges_credits_mensuelles: float = Field(default=0, ge=0)
    autres_revenus_mensuels: float = Field(default=0, ge=0)
    situation_professionnelle: Literal[
        "CDI", "fonctionnaire", "CDD", "independant", "interim", "chomage"
    ] = "CDI"
    nb_adultes: int = Field(default=1, ge=1)
    nb_enfants: int = Field(default=0, ge=0)
    loyer_actuel: float = Field(default=0, ge=0)
    primo_accedant: bool = False


class ProjectInput(BaseModel):
    prix_bien: float = Field(..., gt=0)
    departement: str = Field(default="75", min_length=2, max_length=3)
    type_bien: Literal["ancien", "neuf"] = "ancien"
    montant_travaux: float = Field(default=0, ge=0)
    duree_souhaitee_annees: int = Field(default=25, ge=1, le=27)
    type_garantie: Literal["caution", "hypotheque"] = "caution"


class FinancingDossierRequest(BaseModel):
    profil: BorrowerInput
    projet: ProjectInput
    charges_logement_previsionnelles: float = Field(default=0, ge=0)
    nb_enfants_moins_14: int | None = Field(default=None, ge=0)
    reference_dossier: str | None = Field(default=None, max_length=100)


class FinancingAgentRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1, max_length=4000)


def _profil(data: BorrowerInput) -> ProfilEmprunteur:
    return ProfilEmprunteur(**data.model_dump())


def _projet(data: ProjectInput) -> Projet:
    return Projet(**data.model_dump())


@router.post("/dossier")
def create_financing_dossier(payload: FinancingDossierRequest) -> dict:
    """Expose le moteur déterministe sans recalculer ses résultats."""
    try:
        dossier = generer_dossier(
            _profil(payload.profil),
            _projet(payload.projet),
            charges_logement_previsionnelles=payload.charges_logement_previsionnelles,
            nb_enfants_moins_14=payload.nb_enfants_moins_14,
            reference_dossier=payload.reference_dossier,
        )
    except (TypeError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return dossier


@router.post("/dossier/resume")
def summarize_financing_dossier(payload: FinancingDossierRequest) -> dict[str, str]:
    dossier = create_financing_dossier(payload)
    return {"resume": resumer_dossier(dossier)}


@router.post("/agent/message")
def financing_agent_message(payload: FinancingAgentRequest) -> dict:
    """Conserve une conversation par session, en mémoire du processus API."""
    try:
        agent = SESSIONS.setdefault(payload.session_id, Agent())
        before = len(agent.journal_outils)
        reply = agent.repondre(payload.message)
    except (SystemExit, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "reply": reply,
        "outils_appeles": [
            call["outil"] for call in agent.journal_outils[before:]
        ],
    }


@router.delete("/agent/{session_id}")
def reset_financing_agent(session_id: str) -> dict[str, bool]:
    SESSIONS.pop(session_id, None)
    return {"reset": True}


@router.get("/rates")
def get_financing_rates() -> dict:
    """Taux indicatifs du barème (source : bareme.yaml)."""
    taux = parametre("hypotheses_marche", "taux_nominal_par_duree", defaut={})
    return {
        "taux_par_duree": {str(k): v for k, v in taux.items()},
        "taux_assurance": parametre("hypotheses_marche", "taux_assurance_emprunteur", defaut=0.0034),
        "derniere_verification": parametre("derniere_verification", defaut=""),
        "millesime": parametre("millesime", defaut=2026),
    }