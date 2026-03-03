import streamlit as st
import requests
import os
from datetime import datetime

# =========================
# CONFIGURATION PAGE
# =========================
st.set_page_config(
    page_title="RealEstateAI",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# =========================
# CUSTOM CSS (Design Premium)
# =========================
st.markdown(
    """
<style>
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
header {visibility: hidden;}

.block-container { padding-top: 1.5rem; padding-bottom: 2rem; }

.card {
    padding: 1.25rem 1.25rem;
    border-radius: 16px;
    border: 1px solid rgba(200,200,200,0.18);
    background: rgba(255,255,255,0.03);
    margin-bottom: 1rem;
}

.small { opacity: 0.75; font-size: 0.95rem; }
.h1 { font-size: 2rem; font-weight: 800; line-height: 1.1; margin: 0; }
.h2 { font-size: 1.15rem; font-weight: 700; margin: 0; }
hr { margin: 1.2rem 0; }
</style>
""",
    unsafe_allow_html=True,
)

# =========================
# BACKEND CONFIG
# =========================
DEFAULT_API_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")


@st.cache_data(ttl=300)
def fetch_communes(api_base_url: str):
    try:
        resp = requests.get(f"{api_base_url}/api/metadata/communes", timeout=8)
        if resp.status_code != 200:
            return []
        data = resp.json() or {}
        communes = data.get("communes", [])
        if not isinstance(communes, list):
            return []
        return [str(c) for c in communes if c]
    except Exception:
        return []

# =========================
# HEADER
# =========================
st.markdown(
    """
<div class="card">
  <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
    <div>
      <div class="h1">🏠 RealEstateAI</div>
      <div class="small">Estimateur immobilier – FastAPI + Streamlit (prototype)</div>
    </div>
  </div>
</div>
""",
    unsafe_allow_html=True,
)

# =========================
# SIDEBAR
# =========================
with st.sidebar:
    st.write("### ⚙️ Configuration API")

    api_url = st.text_input(
        "URL API Backend",
        value=DEFAULT_API_URL,
        help="Ex: http://localhost:8000 (local) ou http://backend:8000 (docker)",
    ).rstrip("/")

    if st.button("🔍 Tester connexion API"):
        try:
            resp = requests.get(f"{api_url}/api/health", timeout=5)
            if resp.status_code == 200:
                st.success("✅ Connexion API OK")
            else:
                st.error("❌ API répond mais erreur")
        except Exception as e:
            st.error("❌ Backend indisponible")
            st.caption(str(e))

    st.write("---")
    st.caption("Astuce démo : utilise le bouton “Remplir exemple (Paris)” dans l’onglet Estimateur.")

# =========================
# TABS
# =========================
tab1, tab2, tab3 = st.tabs(["🏠 Accueil", "📊 Estimateur", "ℹ️ À propos"])

# =========================
# TAB 1 - ACCUEIL
# =========================
with tab1:
    col1, col2 = st.columns([1.3, 1])

    with col1:
        st.markdown(
            """
<div class="card">
  <div class="h2">Bienvenue</div>
  <div class="small" style="margin-top:0.4rem;">
    Estimez le prix d’un bien en quelques secondes à partir de la surface, du nombre de pièces,
    du type et de la commune.
  </div>
  <hr/>
  <div class="small">
    ✅ MVP connecté à une API FastAPI<br/>
    ✅ Intervalle de confiance<br/>
    ✅ Déployable via Docker
  </div>
</div>
""",
            unsafe_allow_html=True,
        )

    with col2:
        st.markdown('<div class="card">', unsafe_allow_html=True)
        st.metric("Précision (cible)", "±15%")
        st.metric("Statut", "Prototype")
        st.metric("Zone", "Île-de-France")
        st.markdown("</div>", unsafe_allow_html=True)

# =========================
# TAB 2 - ESTIMATEUR
# =========================
with tab2:
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown('<div class="h2">Estimation</div>', unsafe_allow_html=True)
    st.caption("Renseigne les champs puis clique sur “Estimer le prix”.")

    # Bouton démo
    if st.button("⚡ Remplir exemple (Paris)"):
        st.session_state["address"] = "10 Rue de Rivoli, 75001 Paris"
        st.session_state["commune_select"] = "PARIS 01"
        st.session_state["area_m2"] = 65.0
        st.session_state["rooms"] = 2
        st.session_state["property_type"] = "apartment"

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("📍 Localisation")
        communes = fetch_communes(api_url)

        address = st.text_input(
            "Adresse",
            value=st.session_state.get("address", ""),
            placeholder="Ex: 10 Rue de Rivoli, 75001 Paris",
            key="address",
        )
        if communes:
            selected = st.session_state.get("commune_select", "")
            commune_options = [""] + communes
            if selected and selected not in commune_options:
                commune_options = [selected] + commune_options
            commune = st.selectbox(
                "Commune",
                commune_options,
                index=commune_options.index(selected) if selected in commune_options else 0,
                key="commune_select",
                help="Recherche disponible: tape pour filtrer",
            )
        else:
            st.caption("Liste des communes indisponible, saisie manuelle activée.")
            commune = st.text_input(
                "Commune",
                value=st.session_state.get("commune_select", ""),
                placeholder="Ex: PARIS 01",
                key="commune_select",
            )

    with col2:
        st.subheader("🏠 Caractéristiques")
        area_m2 = st.number_input(
            "Surface (m²)",
            value=float(st.session_state.get("area_m2", 65.0)),
            min_value=10.0,
            max_value=500.0,
            step=5.0,
            key="area_m2",
        )
        rooms = st.number_input(
            "Nombre de pièces",
            value=int(st.session_state.get("rooms", 2)),
            min_value=1,
            max_value=10,
            step=1,
            key="rooms",
        )

    types = ["apartment", "house", "studio"]
    current_type = st.session_state.get("property_type", "apartment")
    if current_type not in types:
        current_type = "apartment"

    property_type = st.selectbox(
        "Type de bien",
        types,
        index=types.index(current_type),
        key="property_type",
    )

    st.write("")
    estimate_button = st.button("💰 Estimer le prix", use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)  # end card

    # Call API + Résultat
    if estimate_button:
        payload = {
            "area_m2": float(area_m2),
            "rooms": int(rooms),
            "property_type": str(property_type),
            "address": str(address).strip() or None,
            "commune": str(commune).strip() or None,
        }

        try:
            with st.spinner("Calcul en cours..."):
                response = requests.post(
                    f"{api_url}/api/predictions/estimate",
                    json=payload,
                    timeout=10,
                )

            if response.status_code == 200:
                result = response.json()

                predicted_price = float(result.get("predicted_price", 0))
                price_per_m2 = float(result.get("price_per_m2", 0))

                ci = result.get("confidence_interval", {}) or {}
                lower = float(ci.get("lower", 0))
                upper = float(ci.get("upper", 0))
                confidence = str(ci.get("confidence", "—"))

                price_str = f"€ {predicted_price:,.0f}".replace(",", " ")
                ppm2_str = f"€ {price_per_m2:,.0f}".replace(",", " ")
                min_str = f"€ {lower:,.0f}".replace(",", " ")
                max_str = f"€ {upper:,.0f}".replace(",", " ")

                st.markdown('<div class="card">', unsafe_allow_html=True)
                st.markdown('<div class="h2">Résultat</div>', unsafe_allow_html=True)

                c1, c2, c3 = st.columns(3)
                c1.metric("💰 Prix estimé", price_str)
                c2.metric("📊 Prix / m²", ppm2_str)
                c3.metric("Confiance", confidence)

                st.write("### 📈 Intervalle de confiance")
                c1, c2, c3 = st.columns(3)
                c1.write(f"**Min** : {min_str}")
                c2.write(f"**Estimation** : {price_str}")
                c3.write(f"**Max** : {max_str}")

                with st.expander("📋 Détails techniques"):
                    st.write("Résultat API :")
                    st.json(result)
                    st.write("Payload envoyé :")
                    st.json(payload)

                st.markdown("</div>", unsafe_allow_html=True)

            else:
                st.error(f"Erreur API : {response.status_code}")
                try:
                    st.json(response.json())
                except Exception:
                    st.write(response.text)

        except requests.exceptions.ConnectionError:
            st.error("Backend indisponible. Lance Docker ou vérifie l’URL API.")
        except Exception as e:
            st.error(f"❌ Erreur : {str(e)}")

# =========================
# TAB 3 - À PROPOS
# =========================
with tab3:
    st.markdown(
        """
<div class="card">
  <div class="h2">À propos</div>
  <div class="small" style="margin-top:0.4rem;">
    Ce prototype démontre une architecture Data + API + Frontend, déployable via Docker.
  </div>
  <hr/>
  <div class="small">
    <b>Stack</b><br/>
    • Frontend : Streamlit<br/>
    • Backend : FastAPI<br/>
    • Modèle : Régression simple<br/>
    • Déploiement : Docker
  </div>
</div>
""",
        unsafe_allow_html=True,
    )

    c1, c2, c3 = st.columns(3)
    c1.metric("Version", "0.1.0")
    c2.metric("Statut", "Prototype")
    c3.metric("Date", datetime.now().strftime("%d/%m/%Y"))
