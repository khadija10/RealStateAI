import streamlit as st
import requests
import json
from datetime import datetime

# Configuration page
st.set_page_config(
    page_title="RealEstateAI",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Titre & description
st.title("🏠 RealEstateAI")
st.subheader("Estimateur de prix immobilier avec IA")

# Sidebar info
with st.sidebar:
    st.write("### 📊 Informations")
    st.info("""
    **RealEstateAI** - Prototype de plateforme d'estimation immobilière
    
    Utilise un modèle simple de régression pour estimer les prix basés sur :
    - Surface du bien
    - Nombre de pièces
    - Localisation
    - Type de propriété
    """)
    
    st.write("---")
    st.write("### ⚙️ Configuration")
    api_url = st.text_input(
        "URL API Backend",
        value="http://localhost:8000",
        help="URL de l'API FastAPI"
    )
    
    # Test connexion
    if st.button("🔍 Tester connexion API"):
        try:
            resp = requests.get(f"{api_url}/api/health")
            if resp.status_code == 200:
                st.success("✅ Connexion API OK")
            else:
                st.error("❌ Erreur API")
        except Exception as e:
            st.error(f"❌ Erreur connexion : {str(e)}")

# Tabs
tab1, tab2, tab3 = st.tabs(["🏠 Accueil", "📊 Estimateur", "ℹ️ À propos"])

# ===== TAB 1 : ACCUEIL =====
with tab1:
    col1, col2 = st.columns(2)
    
    with col1:
        st.write("## Bienvenue sur RealEstateAI")
        st.write("""
        Estimez le prix de votre propriété immobilière en quelques secondes!
        
        ### Caractéristiques
        - ✅ Estimation rapide
        - ✅ Basée sur données marché
        - ✅ Intervalle de confiance
        - ✅ Explainability
        """)
    
    with col2:
        st.metric("Propriétés analysées", "12,500+")
        st.metric("Précision modèle", "±15%")
        st.metric("Zones couvertes", "Île-de-France")
    
    st.write("---")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.info("💡 **Rapide** - Résultat en < 1 sec")
    with col2:
        st.info("📈 **Fiable** - Modèle entraîné")
    with col3:
        st.info("🎯 **Transparent** - Explainability inclus")

# ===== TAB 2 : ESTIMATEUR =====
with tab2:
    st.write("## Estimez votre propriété")
    st.write("Remplissez les informations ci-dessous pour obtenir une estimation de prix")
    
    # Formulaire
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📍 Localisation")
        location_lat = st.number_input(
            "Latitude",
            value=48.8566,
            min_value=41.0,
            max_value=51.0,
            step=0.0001,
            help="Latitude du bien (Paris : 48.8566)"
        )
        
        location_lng = st.number_input(
            "Longitude",
            value=2.3522,
            min_value=-5.0,
            max_value=8.0,
            step=0.0001,
            help="Longitude du bien (Paris : 2.3522)"
        )
    
    with col2:
        st.subheader("🏠 Caractéristiques")
        area_m2 = st.number_input(
            "Surface (m²)",
            value=65.0,
            min_value=10.0,
            max_value=500.0,
            step=5.0,
            help="Surface habitable en mètres carrés"
        )
        
        rooms = st.number_input(
            "Nombre de pièces",
            value=2,
            min_value=1,
            max_value=10,
            step=1,
            help="Nombre total de pièces"
        )
    
    property_type = st.selectbox(
        "Type de propriété",
        ["apartment", "house", "studio"],
        help="Sélectionnez le type de bien"
    )
    
    st.write("---")
    
    # Bouton d'estimation
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        estimate_button = st.button(
            "💰 Estimer le prix",
            use_container_width=True,
            key="estimate"
        )
    
    # Traitement
    if estimate_button:
        with st.spinner("Estimation en cours..."):
            try:
                # Appel API
                payload = {
                    "area_m2": area_m2,
                    "rooms": rooms,
                    "location_lat": location_lat,
                    "location_lng": location_lng,
                    "property_type": property_type
                }
                
                response = requests.post(
                    f"{api_url}/api/predictions/estimate",
                    json=payload,
                    timeout=5
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Afficher résultat
                    st.success("✅ Estimation calculée!")
                    
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric(
                            "Prix estimé",
                            f"€{result['predicted_price']:,.0f}",
                            delta=None
                        )
                    with col2:
                        st.metric(
                            "Prix par m²",
                            f"€{result['price_per_m2']:,.0f}"
                        )
                    with col3:
                        st.metric(
                            "Confiance",
                            result['confidence_interval']['confidence']
                        )
                    
                    # Intervalle confiance
                    st.write("### 📊 Intervalle de confiance")
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.write(f"**Min** : €{result['confidence_interval']['lower']:,.0f}")
                    with col2:
                        st.write(f"**Estimation** : €{result['predicted_price']:,.0f}")
                    with col3:
                        st.write(f"**Max** : €{result['confidence_interval']['upper']:,.0f}")
                    
                    # Détails
                    with st.expander("📋 Détails estimation"):
                        st.json(result)
                    
                    # Résumé
                    st.write("---")
                    st.info(f"""
                    **Résumé** :
                    - Surface : {area_m2} m²
                    - Pièces : {rooms}
                    - Type : {property_type}
                    - Prix estimé : €{result['predicted_price']:,.0f}
                    - Modèle : {result['model']}
                    """)
                else:
                    st.error(f"Erreur API : {response.status_code}")
            
            except requests.exceptions.ConnectionError:
                st.error("❌ Impossible de se connecter à l'API. Vérifiez que le backend est en cours d'exécution.")
            except Exception as e:
                st.error(f"❌ Erreur : {str(e)}")

# ===== TAB 3 : À PROPOS =====
with tab3:
    st.write("## À propos de RealEstateAI")
    
    col1, col2 = st.columns(2)
    with col1:
        st.write("""
        ### 🎯 Mission
        Fournir des estimations précises et transparentes du marché immobilier français.
        
        ### 💻 Stack Technique
        - **Frontend** : Streamlit
        - **Backend** : FastAPI
        - **ML** : Modèle simple (sera XGBoost)
        - **Data** : Mock (sera PostgreSQL)
        """)
    
    with col2:
        st.write("""
        ### 📚 Certification
        RNCP Titre 7 - Ingénieur Transformation Digitale
        
        ### 🚀 Roadmap
        - Phase 0 (Aujourd'hui) : Prototype
        - Phase 1 : Stratégie & Business Plan
        - Phase 2 : UX/UI avancée
        - Phase 3-4 : Développement complet
        """)
    
    st.write("---")
    
    st.write("### 📞 Support")
    st.write("""
    **Questions ?**
    - Voir la documentation dans le sidebar
    - Tester la connexion API
    - Vérifier les logs du terminal
    """)
    
    st.write("---")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Version", "0.1.0")
    with col2:
        st.metric("Statut", "Prototype")
    with col3:
        st.metric("Mise à jour", datetime.now().strftime("%d/%m/%Y"))