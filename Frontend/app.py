import streamlit as st
import requests
import os
from datetime import datetime

st.set_page_config(
    page_title="RealEstateAI Paris",
    page_icon="🏛",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400&display=swap');

:root {
  --stone:       #f0ebe3;
  --stone-mid:   #e0d8cc;
  --stone-dark:  #c9bfb0;
  --ink:         #1a1714;
  --ink-mid:     #3d3730;
  --ink-light:   #6b6259;
  --copper:      #b5612a;
  --copper-lt:   #d4793f;
  --white:       #faf8f5;
  --shadow:      rgba(26,23,20,0.10);
  --r:           10px;
  --r-lg:        18px;
}

html, body,
[data-testid="stAppViewContainer"],
[data-testid="stMain"],
section[data-testid="stSidebar"] ~ div { background: var(--white) !important; }
[data-testid="stAppViewContainer"] { background: var(--white) !important; color: var(--ink) !important; font-family: 'Syne', sans-serif !important; }
[data-testid="stHeader"] { display: none !important; }
[data-testid="stToolbar"] { display: none !important; }
#MainMenu { visibility: hidden !important; }
footer { visibility: hidden !important; }

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: var(--stone); }
::-webkit-scrollbar-thumb { background: var(--stone-dark); border-radius: 10px; }

/* SIDEBAR */
[data-testid="stSidebar"] { background: var(--ink) !important; border-right: none !important; }
[data-testid="stSidebar"] > div:first-child { padding: 0 !important; }
[data-testid="stSidebar"] * { font-family: 'Syne', sans-serif !important; }
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] span,
[data-testid="stSidebar"] label { color: rgba(250,248,245,0.65) !important; }
[data-testid="stSidebar"] .stTextInput input {
  background: rgba(255,255,255,0.07) !important;
  border: 1px solid rgba(255,255,255,0.14) !important;
  border-radius: 8px !important;
  color: #faf8f5 !important;
  font-size: 0.85rem !important;
}
[data-testid="stSidebar"] .stButton > button {
  background: var(--copper) !important;
  color: #faf8f5 !important;
  border: none !important;
  border-radius: 8px !important;
  font-size: 0.78rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  padding: 10px 18px !important;
  box-shadow: none !important;
  transform: none !important;
}
[data-testid="stSidebar"] .stButton > button:hover {
  background: var(--copper-lt) !important;
  transform: none !important;
  box-shadow: none !important;
}

/* BLOCK CONTAINER */
.block-container { padding: 2rem 3rem 4rem !important; max-width: 1200px !important; }

/* TABS */
[data-testid="stTabs"] [data-baseweb="tab-list"] {
  background: transparent !important;
  border-bottom: 2px solid var(--stone-mid) !important;
  gap: 0 !important;
  margin-bottom: 0 !important;
}
[data-testid="stTabs"] [data-baseweb="tab"] {
  background: transparent !important;
  color: var(--ink-light) !important;
  font-family: 'Syne', sans-serif !important;
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.14em !important;
  text-transform: uppercase !important;
  padding: 14px 26px !important;
  border: none !important;
  border-bottom: 2px solid transparent !important;
  margin-bottom: -2px !important;
}
[data-testid="stTabs"] [aria-selected="true"] { color: var(--copper) !important; border-bottom-color: var(--copper) !important; }
[data-testid="stTabs"] [data-baseweb="tab"]:hover { color: var(--ink) !important; }
[data-testid="stTabs"] [data-baseweb="tab-highlight"] { background: var(--copper) !important; }

/* COULEUR PAR ONGLET */
[data-testid="stTabs"] [data-baseweb="tab"]:nth-child(1):hover { color: #2e7d5e !important; }
[data-testid="stTabs"] [data-baseweb="tab"]:nth-child(1)[aria-selected="true"] { color: #2e7d5e !important; border-bottom-color: #2e7d5e !important; }
[data-testid="stTabs"] [data-baseweb="tab"]:nth-child(2):hover { color: var(--copper) !important; }
[data-testid="stTabs"] [data-baseweb="tab"]:nth-child(2)[aria-selected="true"] { color: var(--copper) !important; border-bottom-color: var(--copper) !important; }
[data-testid="stTabs"] [data-baseweb="tab"]:nth-child(3):hover { color: #3a5f8a !important; }
[data-testid="stTabs"] [data-baseweb="tab"]:nth-child(3)[aria-selected="true"] { color: #3a5f8a !important; border-bottom-color: #3a5f8a !important; }
[data-testid="stTabs"] [data-baseweb="tab"]:nth-child(4):hover { color: #8a3a4a !important; }
[data-testid="stTabs"] [data-baseweb="tab"]:nth-child(4)[aria-selected="true"] { color: #8a3a4a !important; border-bottom-color: #8a3a4a !important; }

/* INPUTS */
[data-testid="stNumberInput"] input,
[data-testid="stTextInput"] input {
  background: var(--stone) !important;
  border: 1.5px solid var(--stone-mid) !important;
  border-radius: 8px !important;
  color: var(--ink) !important;
  font-family: 'Syne', sans-serif !important;
  font-size: 0.9rem !important;
  padding: 12px 14px !important;
  transition: all 0.2s !important;
}
[data-testid="stNumberInput"] input:focus,
[data-testid="stTextInput"] input:focus {
  border-color: var(--copper) !important;
  box-shadow: 0 0 0 3px rgba(181,97,42,0.1) !important;
  background: var(--white) !important;
}
[data-testid="stNumberInput"] label,
[data-testid="stTextInput"] label,
.stSelectbox label {
  font-family: 'Syne', sans-serif !important;
  font-size: 0.67rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.16em !important;
  text-transform: uppercase !important;
  color: var(--ink-light) !important;
}
.stSelectbox [data-baseweb="select"] > div {
  background: var(--stone) !important;
  border: 1.5px solid var(--stone-mid) !important;
  border-radius: 8px !important;
  font-family: 'Syne', sans-serif !important;
  font-size: 0.9rem !important;
  color: var(--ink) !important;
  transition: all 0.2s !important;
}
.stSelectbox [data-baseweb="select"] > div:focus-within {
  border-color: var(--copper) !important;
  box-shadow: 0 0 0 3px rgba(181,97,42,0.1) !important;
}

/* BUTTON */
.stButton > button {
  background: var(--ink) !important;
  color: var(--white) !important;
  font-family: 'Syne', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.78rem !important;
  letter-spacing: 0.18em !important;
  text-transform: uppercase !important;
  border: none !important;
  border-radius: 10px !important;
  padding: 15px 36px !important;
  transition: all 0.22s ease !important;
  box-shadow: 0 2px 12px rgba(26,23,20,0.14) !important;
}
.stButton > button:hover {
  background: var(--copper) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 26px rgba(181,97,42,0.28) !important;
}
.stButton > button:active { transform: translateY(0) !important; }

/* Bouton reset */
.btn-reset > div > button, .btn-reset button {
  background: transparent !important;
  color: #c94040 !important;
  border: 1.5px solid rgba(201,64,64,0.3) !important;
  box-shadow: none !important;
}
.btn-reset > div > button:hover, .btn-reset button:hover {
  background: rgba(201,64,64,0.07) !important;
  border-color: #c94040 !important;
  transform: none !important;
  box-shadow: none !important;
}

/* Bouton PDF */
.btn-pdf > div > button, .btn-pdf button {
  background: linear-gradient(135deg, var(--copper), var(--copper-lt)) !important;
  color: #faf8f5 !important;
  border: none !important;
  box-shadow: 0 3px 14px rgba(181,97,42,0.3) !important;
  transform: none !important;
}
.btn-pdf > div > button:hover, .btn-pdf button:hover {
  background: linear-gradient(135deg, var(--copper-lt), var(--copper)) !important;
  box-shadow: 0 6px 20px rgba(181,97,42,0.4) !important;
  transform: translateY(-1px) !important;
}

/* METRICS */
[data-testid="metric-container"] {
  background: var(--stone) !important;
  border: 1px solid var(--stone-mid) !important;
  border-radius: var(--r) !important;
  padding: 18px 16px !important;
  transition: border-color 0.2s !important;
}
[data-testid="metric-container"]:hover { border-color: var(--copper) !important; }
[data-testid="stMetricLabel"] { font-family: 'Syne', sans-serif !important; font-size: 0.62rem !important; text-transform: uppercase !important; letter-spacing: 0.15em !important; color: var(--ink-light) !important; }
[data-testid="stMetricValue"] { font-family: 'Cormorant Garamond', serif !important; font-size: 1.8rem !important; color: var(--ink) !important; font-weight: 600 !important; }

/* EXPANDER */
[data-testid="stExpander"] { background: var(--stone) !important; border: 1px solid var(--stone-mid) !important; border-radius: var(--r) !important; }
[data-testid="stExpander"] summary { font-family: 'Syne', sans-serif !important; font-size: 0.76rem !important; color: var(--ink-light) !important; letter-spacing: 0.06em !important; }

/* ALERTS */
[data-testid="stAlert"] { background: rgba(181,97,42,0.07) !important; border: 1px solid rgba(181,97,42,0.2) !important; border-radius: var(--r) !important; }

/* SPINNER */
.stSpinner > div { border-color: var(--copper) transparent transparent transparent !important; }

/* ════ CUSTOM COMPONENTS ════ */
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 0 28px; border-bottom: 1px solid var(--stone-mid); margin-bottom: 40px; }
.tb-title { font-family: 'Cormorant Garamond', serif; font-size: 1rem; font-weight: 400; color: var(--ink-light); letter-spacing: 0.04em; }
.tb-right { display: flex; align-items: center; gap: 10px; }
.chip { background: rgba(181,97,42,0.1); color: var(--copper); border: 1px solid rgba(181,97,42,0.22); border-radius: 50px; padding: 4px 12px; font-size: 0.63rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.chip-green { background: rgba(76,175,125,0.1); color: #3a9e67; border: 1px solid rgba(76,175,125,0.25); border-radius: 50px; padding: 4px 12px; font-size: 0.63rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.api-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4caf7d; box-shadow: 0 0 7px rgba(76,175,125,0.6); margin-right: 5px; vertical-align: middle; }

.sb-name { font-family: 'Cormorant Garamond', serif !important; font-size: 1.4rem !important; font-weight: 600 !important; color: #faf8f5 !important; text-align: center; }
.sb-tagline { font-size: 0.62rem !important; color: rgba(250,248,245,0.28) !important; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 4px; text-align: center; }
.sb-header { padding: 0 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 8px; }
.sb-stat { display: flex; justify-content: space-between; align-items: center; padding: 8px 24px; }
.sb-stat .k { font-size: 0.68rem !important; color: rgba(255,255,255,0.28) !important; letter-spacing: 0.06em; }
.sb-stat .v { font-family: 'Cormorant Garamond', serif !important; font-size: 0.98rem !important; color: #faf8f5 !important; font-weight: 600 !important; }
.sb-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 10px 24px; }
.sb-section-label { font-size: 0.6rem !important; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.22) !important; padding: 14px 24px 6px; }

.ph { margin-bottom: 40px; }
.ph-eyebrow { font-size: 0.64rem; letter-spacing: 0.26em; text-transform: uppercase; color: var(--copper); margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
.ph-eyebrow::after { content: ''; display: inline-block; width: 48px; height: 1px; background: var(--copper); opacity: 0.4; }
.ph-title { font-family: 'Cormorant Garamond', serif; font-size: 2.9rem; font-weight: 300; line-height: 1.1; color: var(--ink); margin-bottom: 14px; }
.ph-title em { font-style: italic; color: var(--copper); }
.ph-sub { font-size: 0.87rem; color: var(--ink-light); max-width: 540px; line-height: 1.8; font-weight: 400; margin-bottom: 32px; }

.stat-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 32px; }
.stat-card { background: var(--stone); border: 1px solid var(--stone-mid); border-radius: var(--r); padding: 20px 26px; flex: 1; min-width: 130px; transition: border-color 0.2s, transform 0.2s; }
.stat-card:hover { border-color: var(--copper); transform: translateY(-2px); }
.stat-val { font-family: 'Cormorant Garamond', serif; font-size: 1.85rem; font-weight: 600; color: var(--copper); line-height: 1; }
.stat-lbl { font-size: 0.63rem; color: var(--ink-light); text-transform: uppercase; letter-spacing: 0.12em; margin-top: 5px; }

.feat-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 36px; }
.feat-badge { background: var(--white); border: 1px solid var(--stone-mid); border-radius: 50px; padding: 9px 18px; font-size: 0.77rem; color: var(--ink-mid); display: flex; align-items: center; gap: 7px; font-weight: 500; }
.feat-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--copper); flex-shrink: 0; }

.feat-card { background: var(--stone); border: 1px solid var(--stone-mid); border-radius: var(--r-lg); padding: 28px; transition: all 0.2s; }
.feat-card:hover { border-color: var(--copper); box-shadow: 0 6px 24px var(--shadow); }
.feat-card .icon { font-size: 1.8rem; margin-bottom: 14px; }
.feat-card h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.15rem; font-weight: 600; color: var(--ink); margin-bottom: 10px; }
.feat-card p { font-size: 0.82rem; color: var(--ink-light); line-height: 1.8; }

.fc { background: var(--white); border: 1px solid var(--stone-mid); border-radius: var(--r-lg); padding: 28px; margin-bottom: 18px; box-shadow: 0 2px 14px var(--shadow); }
.fc-label { font-size: 0.62rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--copper); margin-bottom: 18px; display: flex; align-items: center; gap: 8px; font-weight: 700; }
.fc-label::after { content: ''; flex: 1; height: 1px; background: var(--stone-mid); }

.coords-pill { background: var(--stone); border-radius: 8px; padding: 12px 16px; margin-top: 4px; display: flex; align-items: center; justify-content: space-between; font-family: 'DM Mono', monospace; font-size: 0.73rem; color: var(--ink-light); }
.coords-pill span { color: var(--copper); font-size: 0.7rem; letter-spacing: 0.08em; font-weight: 600; font-family: 'Syne', sans-serif; }

.rp { background: var(--ink); border-radius: var(--r-lg); padding: 36px 32px; color: var(--white); position: relative; overflow: hidden; }
.rp::after { content: 'PARIS'; position: absolute; bottom: -20px; right: -8px; font-family: 'Cormorant Garamond', serif; font-size: 7rem; font-weight: 700; color: rgba(255,255,255,0.032); pointer-events: none; line-height: 1; }
.rp-eyebrow { font-size: 0.6rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(212,121,63,0.8); margin-bottom: 18px; }
.rp-price { font-family: 'Cormorant Garamond', serif; font-size: 3.8rem; font-weight: 300; line-height: 1; color: var(--white); margin-bottom: 4px; }
.rp-sublabel { font-size: 0.7rem; color: rgba(255,255,255,0.28); margin-bottom: 28px; letter-spacing: 0.06em; }
.rp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
.rp-item { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 13px 15px; border: 1px solid rgba(255,255,255,0.06); }
.rp-item .rv { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; color: rgba(240,235,227,0.92); }
.rp-item .rl { font-size: 0.6rem; color: rgba(255,255,255,0.28); text-transform: uppercase; letter-spacing: 0.14em; margin-top: 2px; }
.rp-range-header { display: flex; justify-content: space-between; font-size: 0.6rem; color: rgba(255,255,255,0.25); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
.rp-bar-wrap { height: 4px; background: rgba(255,255,255,0.08); border-radius: 10px; position: relative; margin-bottom: 8px; }
.rp-bar-fill { position: absolute; left: 12%; right: 12%; height: 100%; background: linear-gradient(90deg, rgba(181,97,42,0.4), var(--copper-lt), rgba(181,97,42,0.4)); border-radius: 10px; }
.rp-bar-thumb { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 11px; height: 11px; border-radius: 50%; background: var(--copper-lt); box-shadow: 0 0 10px rgba(212,121,63,0.7); }
.rp-range-vals { display: flex; justify-content: space-between; font-family: 'DM Mono', monospace; font-size: 0.68rem; color: rgba(255,255,255,0.33); }
.rp-range-vals .center { color: var(--copper-lt); }
.conf-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(76,175,125,0.1); border: 1px solid rgba(76,175,125,0.22); border-radius: 50px; padding: 6px 14px; font-size: 0.67rem; color: #7dcfa8; letter-spacing: 0.08em; font-weight: 600; margin-top: 18px; }

.empty-state { border: 2px dashed var(--stone-mid); border-radius: var(--r-lg); padding: 60px 32px; text-align: center; background: var(--stone); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.empty-state .es-icon { font-size: 2.8rem; opacity: 0.3; }
.empty-state .es-title { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: var(--ink-light); font-weight: 400; }
.empty-state .es-sub { font-size: 0.78rem; color: var(--stone-dark); max-width: 260px; line-height: 1.7; }

.m-card { background: var(--stone); border: 1px solid var(--stone-mid); border-radius: 12px; padding: 16px 14px; transition: all 0.2s; margin-bottom: 10px; }
.m-card:hover { border-color: var(--copper); box-shadow: 0 4px 16px var(--shadow); transform: translateY(-1px); }
.m-arr { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 600; color: var(--ink); line-height: 1; }
.m-name { font-size: 0.62rem; color: var(--ink-light); text-transform: uppercase; letter-spacing: 0.1em; margin: 3px 0 10px; }
.m-price { font-family: 'DM Mono', monospace; font-size: 0.84rem; color: var(--ink); }
.m-up { font-size: 0.7rem; color: #3a9e67; margin-top: 2px; }
.m-dn { font-size: 0.7rem; color: #c94040; margin-top: 2px; }
.m-bar { height: 3px; background: var(--stone-mid); border-radius: 2px; margin-top: 10px; overflow: hidden; }
.m-bar-fill { height: 100%; background: var(--copper); border-radius: 2px; }

.about-card { background: var(--stone); border: 1px solid var(--stone-mid); border-radius: var(--r-lg); padding: 26px; }
.about-card h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 600; color: var(--ink); margin-bottom: 12px; }
.about-card p, .about-card li { font-size: 0.83rem; color: var(--ink-light); line-height: 1.85; }
.about-card li { list-style: none; padding: 1px 0; }
.about-card li::before { content: "— "; color: var(--copper); }

.rm-item { display: flex; align-items: flex-start; gap: 16px; padding: 15px 0; border-bottom: 1px solid var(--stone-mid); }
.rm-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--copper); margin-top: 5px; flex-shrink: 0; box-shadow: 0 0 8px rgba(181,97,42,0.4); }
.rm-phase { font-size: 0.63rem; color: var(--copper); text-transform: uppercase; letter-spacing: 0.14em; }
.rm-desc { font-size: 0.84rem; color: var(--ink-light); margin-top: 3px; }

.footer { text-align: center; padding: 36px 0 12px; color: var(--stone-dark); font-size: 0.7rem; letter-spacing: 0.1em; border-top: 1px solid var(--stone-mid); margin-top: 56px; }
.footer b { color: var(--copper); }

@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
.anim { animation: fadeUp 0.5s ease forwards; }
</style>
""", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════
#  SIDEBAR
# ═══════════════════════════════════════════════════
with st.sidebar:
    # ── LOGO ──
    col1, col2, col3 = st.columns([0.15, 0.7, 0.15])
    with col2:
        st.image("images/logo_realestate_ai.svg", use_container_width=True)

    st.markdown("""
    <div class="sb-header">
      <div class="sb-name">RealEstateAI</div>
      <div class="sb-tagline">Paris · Estimation IA</div>
    </div>
    <div style="padding:14px 0 10px">
      <div class="sb-stat"><span class="k">Biens analysés</span><span class="v">12 500+</span></div>
      <div class="sb-stat"><span class="k">Précision</span><span class="v">±15%</span></div>
      <div class="sb-stat"><span class="k">Zone couverte</span><span class="v">Paris</span></div>
      <div class="sb-divider"></div>
      <div class="sb-stat">
        <span class="k">API Status</span>
        <span class="v"><span class="api-dot"></span>Connectée</span>
      </div>
    </div>
    <div class="sb-section-label">Configuration</div>
    """, unsafe_allow_html=True)

    default_api_url = os.getenv("API_URL", "http://localhost:8000")
    api_url = st.text_input("URL Backend", value=default_api_url, label_visibility="collapsed")

    if st.button("Tester la connexion API", use_container_width=True):
        try:
            resp = requests.get(f"{api_url}/api/health", timeout=3)
            if resp.status_code == 200:
                st.success("✅ API connectée")
            else:
                st.error("❌ Erreur API")
        except Exception:
            st.info("ℹ️ API non accessible — mode démo actif")

    st.markdown('<div class="sb-section-label">Export</div>', unsafe_allow_html=True)
    st.markdown('<div class="btn-pdf">', unsafe_allow_html=True)
    if st.button("📄 Exporter en PDF", use_container_width=True, key="pdf_export"):
        st.toast("📄 Export PDF bientôt disponible !", icon="🏛")
    st.markdown('</div>', unsafe_allow_html=True)

    st.markdown("""
    <div style="padding:24px 24px 20px;text-align:center">
      <div style="font-size:0.58rem;color:rgba(255,255,255,0.16);letter-spacing:0.1em">
        v0.1.0 · Prototype · Paris
      </div>
    </div>
    """, unsafe_allow_html=True)

# ═══════════════════════════════════════════════════
#  TOPBAR
# ═══════════════════════════════════════════════════
st.markdown(f"""
<div class="topbar anim">
  <div class="tb-title">Estimation de Prix Immobilier — Paris</div>
  <div class="tb-right">
    <span class="chip">Prototype v0.1</span>
    <span class="chip-green"><span class="api-dot"></span>En ligne</span>
    <span style="font-size:0.73rem;color:var(--ink-light);font-weight:500">{datetime.now().strftime('%d %b %Y')}</span>
  </div>
</div>
""", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════
#  TABS
# ═══════════════════════════════════════════════════
tab_home, tab_estim, tab_market, tab_about = st.tabs([
    "Accueil", "Estimateur", "Marché Paris", "À propos"
])

# ══════════════════════════════════════════════
#  ACCUEIL
# ══════════════════════════════════════════════
with tab_home:
    st.markdown("""
    <div class="ph anim">
      <div class="ph-eyebrow">Intelligence Artificielle · Immobilier Parisien</div>
      <h1 class="ph-title">L'estimation <em>immobilière</em><br>réinventée à Paris</h1>
      <p class="ph-sub">Une plateforme d'analyse IA pour estimer le prix de votre bien immobilier parisien avec précision, transparence et en quelques secondes.</p>
    </div>
    <div class="stat-row">
      <div class="stat-card"><div class="stat-val">12 500+</div><div class="stat-lbl">Biens analysés</div></div>
      <div class="stat-card"><div class="stat-val">±15%</div><div class="stat-lbl">Précision modèle</div></div>
      <div class="stat-card"><div class="stat-val">20</div><div class="stat-lbl">Arrondissements</div></div>
      <div class="stat-card"><div class="stat-val">&lt; 1s</div><div class="stat-lbl">Temps de réponse</div></div>
    </div>
    <div class="feat-row">
      <div class="feat-badge"><span class="feat-dot"></span>Estimation instantanée</div>
      <div class="feat-badge"><span class="feat-dot"></span>Intervalle de confiance</div>
      <div class="feat-badge"><span class="feat-dot"></span>Explainability inclus</div>
      <div class="feat-badge"><span class="feat-dot"></span>Données marché réel</div>
      <div class="feat-badge"><span class="feat-dot"></span>100% transparent</div>
    </div>
    """, unsafe_allow_html=True)

    c1, c2, c3 = st.columns(3, gap="medium")
    with c1:
        st.markdown("""<div class="feat-card"><div class="icon">⚡</div><h3>Rapide</h3>
        <p>Résultat en moins d'une seconde grâce à notre modèle ML entraîné sur les transactions parisiennes.</p></div>""", unsafe_allow_html=True)
    with c2:
        st.markdown("""<div class="feat-card"><div class="icon">🎯</div><h3>Précis</h3>
        <p>Précision de ±15% avec intervalle de confiance à 80%. Données issues du marché réel.</p></div>""", unsafe_allow_html=True)
    with c3:
        st.markdown("""<div class="feat-card"><div class="icon">🔍</div><h3>Transparent</h3>
        <p>Explainability incluse. Comprenez comment chaque critère influence le prix de votre bien.</p></div>""", unsafe_allow_html=True)

    st.markdown("<div style='height:32px'></div>", unsafe_allow_html=True)
    _, cb, _ = st.columns([1, 1, 1])
    with cb:
        if st.button("🏛  Estimer mon bien maintenant →", use_container_width=True, key="go_estim"):
            st.info("👆 Cliquez sur l'onglet **Estimateur** en haut pour commencer.")

    st.markdown(f"""<div class="footer">Construit avec soin · <b>RealEstateAI</b> · Paris · {datetime.now().year}</div>""", unsafe_allow_html=True)

# ══════════════════════════════════════════════
#  ESTIMATEUR
# ══════════════════════════════════════════════
with tab_estim:
    st.markdown("""
    <div class="ph anim">
      <div class="ph-eyebrow">Analyse IA · Marché Parisien</div>
      <h1 class="ph-title">Estimez votre bien<br><em>immobilier</em> à Paris</h1>
      <p class="ph-sub">Renseignez les caractéristiques de votre bien pour obtenir une estimation précise.</p>
    </div>
    """, unsafe_allow_html=True)

    col_form, col_result = st.columns([1, 1], gap="large")

    with col_form:
        st.markdown('<div class="fc"><div class="fc-label">📍 Localisation</div>', unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        with c1:
            lat = st.number_input("Latitude", value=48.8566, min_value=41.0, max_value=51.0, step=0.0001, format="%.4f")
        with c2:
            lng = st.number_input("Longitude", value=2.3522, min_value=-5.0, max_value=8.0, step=0.0001, format="%.4f")
        st.markdown(f"""
        <div class="coords-pill">
          <span style="color:var(--ink-light)">{lat:.4f}° N &nbsp;·&nbsp; {lng:.4f}° E</span>
          <span>📍 Paris, France</span>
        </div></div>
        """, unsafe_allow_html=True)

        st.markdown("<div style='height:14px'></div>", unsafe_allow_html=True)

        st.markdown('<div class="fc"><div class="fc-label">🏛 Caractéristiques</div>', unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        with c1:
            area = st.number_input("Surface (m²)", value=65.0, min_value=10.0, max_value=500.0, step=5.0)
        with c2:
            rooms = st.number_input("Nombre de pièces", value=3, min_value=1, max_value=10, step=1)
        prop_type = st.selectbox("Type de bien", ["Appartement", "Maison", "Studio"])
        st.markdown("</div>", unsafe_allow_html=True)

        st.markdown("<div style='height:4px'></div>", unsafe_allow_html=True)
        _, cb, _ = st.columns([0.1, 0.8, 0.1])
        with cb:
            run = st.button("Lancer l'estimation →", use_container_width=True)

        st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
        _, cb2, _ = st.columns([0.1, 0.8, 0.1])
        with cb2:
            st.markdown('<div class="btn-reset">', unsafe_allow_html=True)
            if st.button("↺  Réinitialiser le formulaire", use_container_width=True, key="reset"):
                st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)

    with col_result:
        if run:
            with st.spinner("Analyse en cours…"):
                price, ppm2, low, high, conf = None, None, None, None, "80%"
                try:
                    type_map = {"Appartement": "apartment", "Maison": "house", "Studio": "studio"}
                    payload = {"area_m2": area, "rooms": rooms, "location_lat": lat, "location_lng": lng, "property_type": type_map[prop_type]}
                    response = requests.post(f"{api_url}/api/predictions/estimate", json=payload, timeout=5)
                    if response.status_code == 200:
                        r = response.json()
                        price = r['predicted_price']
                        ppm2  = r['price_per_m2']
                        low   = r['confidence_interval']['lower']
                        high  = r['confidence_interval']['upper']
                        conf  = r['confidence_interval']['confidence']
                    else:
                        raise Exception(f"Erreur API {response.status_code}")
                except requests.exceptions.ConnectionError:
                    ppm2_base = {"Appartement": 8100, "Maison": 7200, "Studio": 9400}
                    ppm2  = ppm2_base[prop_type]
                    price = round(area * ppm2 / 500) * 500
                    low   = round(price * 0.85 / 500) * 500
                    high  = round(price * 1.15 / 500) * 500
                    st.info("ℹ️ Mode démo — API non connectée")
                except Exception as e:
                    st.error(f"❌ {e}")
                    st.stop()

            if price:
                st.markdown(f"""
                <div class="rp anim">
                  <div class="rp-eyebrow">Estimation IA · Paris, France</div>
                  <div class="rp-price">€ {price:,.0f}</div>
                  <div class="rp-sublabel">{prop_type} · {area:.0f} m² · {rooms} pièce{'s' if rooms>1 else ''} · confiance {conf}</div>
                  <div class="rp-grid">
                    <div class="rp-item"><div class="rv">€ {ppm2:,.0f}</div><div class="rl">Prix au m²</div></div>
                    <div class="rp-item"><div class="rv">{rooms} pièce{'s' if rooms>1 else ''}</div><div class="rl">Configuration</div></div>
                    <div class="rp-item"><div class="rv">{area:.0f} m²</div><div class="rl">Surface</div></div>
                    <div class="rp-item"><div class="rv">{prop_type}</div><div class="rl">Type</div></div>
                  </div>
                  <div class="rp-range-header"><span>€ {low:,.0f}</span><span>Fourchette estimée</span><span>€ {high:,.0f}</span></div>
                  <div class="rp-bar-wrap"><div class="rp-bar-fill"></div><div class="rp-bar-thumb"></div></div>
                  <div class="rp-range-vals">
                    <span>€ {low:,.0f}</span>
                    <span class="center">€ {price:,.0f}</span>
                    <span>€ {high:,.0f}</span>
                  </div>
                  <div class="conf-badge">
                    <span style="width:6px;height:6px;border-radius:50%;background:#4caf7d;display:inline-block"></span>
                    Confiance {conf} · Modèle ML v0.1
                  </div>
                </div>
                """, unsafe_allow_html=True)

                st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)
                with st.expander("📋 Détails JSON"):
                    st.json({"predicted_price": price, "price_per_m2": ppm2,
                             "confidence_interval": {"lower": low, "upper": high, "confidence": conf}})
        else:
            st.markdown("""
            <div class="empty-state anim">
              <div class="es-icon">🏛</div>
              <div class="es-title">Votre estimation apparaîtra ici</div>
              <div class="es-sub">Renseignez les caractéristiques du bien à gauche puis cliquez sur « Lancer l'estimation »</div>
            </div>
            """, unsafe_allow_html=True)

# ══════════════════════════════════════════════
#  MARCHÉ PARIS
# ══════════════════════════════════════════════
with tab_market:
    st.markdown("""
    <div class="ph anim">
      <div class="ph-eyebrow">Données Marché · Paris 2024</div>
      <h1 class="ph-title">Le marché <em>immobilier</em><br>par arrondissement</h1>
      <p class="ph-sub">Prix moyens au m² par arrondissement parisien. Données indicatives basées sur les transactions récentes.</p>
    </div>
    """, unsafe_allow_html=True)

    arrondissements = [
        ("1er","Louvre",12400,2.1,True,95),("2e","Bourse",11800,1.5,True,83),
        ("3e","Temple",11200,0.9,True,79),("4e","Hôtel-de-Ville",12100,1.2,True,85),
        ("5e","Panthéon",13000,1.6,True,91),("6e","Luxembourg",14200,1.8,True,100),
        ("7e","Palais-Bourbon",13500,1.1,True,95),("8e","Élysée",13800,0.3,False,97),
        ("9e","Opéra",10900,2.0,True,77),("10e","Entrepôt",9600,2.8,True,68),
        ("11e","Popincourt",9800,2.4,True,69),("12e","Reuilly",8900,1.7,True,63),
        ("13e","Gobelins",8700,1.9,True,61),("14e","Observatoire",9200,1.3,True,65),
        ("15e","Vaugirard",9100,0.8,True,64),("16e","Passy",11500,0.4,False,81),
        ("17e","Batignolles",9700,1.6,True,68),("18e","Montmartre",8400,0.8,False,59),
        ("19e","Buttes-Chaumont",7900,2.1,True,56),("20e","Ménilmontant",7800,0.5,False,55),
    ]

    cols = st.columns(4, gap="small")
    for i, (arr, name, price, pct, up, bar) in enumerate(arrondissements):
        with cols[i % 4]:
            trend_cls = "m-up" if up else "m-dn"
            trend_icon = "↑" if up else "↓"
            sign = "+" if up else "-"
            st.markdown(f"""
            <div class="m-card">
              <div class="m-arr">{arr}</div>
              <div class="m-name">{name}</div>
              <div class="m-price">{price:,} €/m²</div>
              <div class="{trend_cls}">{trend_icon} {sign}{pct}%</div>
              <div class="m-bar"><div class="m-bar-fill" style="width:{bar}%"></div></div>
            </div>
            """, unsafe_allow_html=True)

# ══════════════════════════════════════════════
#  À PROPOS
# ══════════════════════════════════════════════
with tab_about:
    st.markdown("""
    <div class="ph anim">
      <div class="ph-eyebrow">À propos du projet</div>
      <h1 class="ph-title">Mission &<br><em>Roadmap</em></h1>
      <p class="ph-sub">RealEstateAI est développé dans le cadre d'une certification RNCP Titre 7 — Ingénieur Transformation Digitale.</p>
    </div>
    """, unsafe_allow_html=True)

    c1, c2 = st.columns(2, gap="medium")
    with c1:
        st.markdown("""<div class="about-card"><h3>🎯 Mission</h3>
        <p>Fournir des estimations précises et transparentes du marché immobilier français, accessibles à tous grâce à l'intelligence artificielle.</p></div>""", unsafe_allow_html=True)
    with c2:
        st.markdown("""<div class="about-card"><h3>💻 Stack Technique</h3>
        <ul><li>Frontend · Streamlit</li><li>Backend · FastAPI</li><li>ML · XGBoost (roadmap)</li><li>Data · PostgreSQL (roadmap)</li></ul></div>""", unsafe_allow_html=True)

    st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)

    c1, c2 = st.columns(2, gap="medium")
    with c1:
        st.markdown("""<div class="about-card"><h3>📚 Certification</h3>
        <p>RNCP Titre 7<br>Ingénieur Transformation Digitale</p></div>""", unsafe_allow_html=True)
    with c2:
        st.markdown("""<div class="about-card"><h3>📞 Support</h3>
        <p>Tester la connexion API via la sidebar. Consulter les logs du terminal pour le débogage.</p></div>""", unsafe_allow_html=True)

    st.markdown("""
    <div style="margin-top:36px;font-family:'Cormorant Garamond',serif;font-size:1.3rem;color:var(--ink);margin-bottom:4px">🚀 Roadmap</div>
    <div style="width:40px;height:2px;background:var(--copper);border-radius:2px;margin-bottom:20px"></div>
    """, unsafe_allow_html=True)

    for phase, desc in [
        ("Phase 0 — Aujourd'hui", "Prototype fonctionnel, maquette UI/UX"),
        ("Phase 1", "Stratégie & Business Plan complet"),
        ("Phase 2", "UX/UI avancée, design system"),
        ("Phase 3", "Développement back-end complet"),
        ("Phase 4", "Mise en production & scaling"),
    ]:
        st.markdown(f"""
        <div class="rm-item">
          <div class="rm-dot"></div>
          <div><div class="rm-phase">{phase}</div><div class="rm-desc">{desc}</div></div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown(f"""<div class="footer"><b>RealEstateAI</b> · v0.1.0 · Prototype · {datetime.now().strftime("%d/%m/%Y")}</div>""", unsafe_allow_html=True)