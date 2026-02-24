import pandas as pd




def read_row_dvf(Folder, Year):

    """ lit le fichier de year et year -1 et ajoute une colonne année pour différencier les deux fichiers

    applique aussi un tt premier nettoyer pour supprimer les lignes vides dans les colonnes essentielles
    et garde uniquement les colonnes nécessaires (plus léger)
    
    ET RETOURNE LES DEUX DATAFRAMES LÉGERS"""
    print(f"Lecture des fichiers de {Year} et {Year-1}...")
    File_n = Folder +"ValeursFoncieres-" + str(Year) + ".txt"
    File_n2 = Folder +"ValeursFoncieres-" + str(Year-1) + ".txt"

    # Lecture avec séparateur | et ajouté ccolonne année pour differencier les deux fichiers
    df = pd.read_csv(File_n, sep="|", dtype=str, low_memory=False)
    df["Année"] = Year

    df2 = pd.read_csv(File_n2, sep="|", dtype=str, low_memory=False) 
    df2["Année"] = Year - 1

    # 1) garder uniquement les colonnes nécessaires (plus léger)
    cols = ["No voie", "B/T/Q", "Type de voie", "Voie", "Code postal", "Commune",
            "Type local", "Surface reelle bati", "Valeur fonciere", "Date mutation", "Année"]
    df = df[cols].copy()
    df2_light = df2[cols].copy()

    # 2)nettoyer les données : supprimer les lignes vides dans les colonnes essentielles
    df = df.dropna(subset=["Valeur fonciere", "Surface reelle bati"])
    df2_light = df2_light.dropna(subset=["Valeur fonciere", "Surface reelle bati"])

    print(f"Fichiers de {Year} et {Year-1} lus et nettoyés. Nombre de lignes : {len(df)} et {len(df2_light)}")
    return df, df2_light

def prepare_dvf(df):
    """ Prépare le dataframe :
        - typages des colonnes
        - construire colonne  adresse (gérer les NaN) et la colonnes type_bien et prix au m2 arrondis à 2 chiffres après la virgule
        - appliquer filtre (IDF , pas de prix =< 0, pas de surface =< 0,maison et appart seuelment)
        - enelever les outliers 
    """
    #1) Typages des colonnes
    # --- Colonnes texte ---
    cols_str = ["No voie", "B/T/Q", "Type de voie", "Voie", "Code postal", "Commune", "Type local", "Année"]
    for col in cols_str:
        df[col] = df[col].astype("string")

    # --- Colonnes numériques ---
    df["Valeur fonciere"] = df["Valeur fonciere"].str.replace(",", ".").astype(float)
    df["Surface reelle bati"] = df["Surface reelle bati"].str.replace(",", ".").astype(float)
    df["Surface reelle bati"] = pd.to_numeric(df["Surface reelle bati"], errors="coerce").astype("float32")
    df["Valeur fonciere"] = pd.to_numeric(df["Valeur fonciere"], errors="coerce").astype("float64")

    # --- Date ---
    df["Date mutation"] = pd.to_datetime(df["Date mutation"], errors="coerce", dayfirst=True)

    #2) nettoyage :supprimer les lignes ou le prix = 0 et les lignes vides dans les colonnes essentielles
    df = df[(df["Valeur fonciere"] > 0) & (df["Surface reelle bati"] > 0)].copy()

    #appliquer filtre poru garder seuelemnt en ile des france ( on CP a 5 chiffres)
    df["Code postal"] = (df["Code postal"].str.strip())
    df = df[df["Code postal"].str.match(r"^\d{5}$", na=False)].copy()
    df["dep"] = df["Code postal"].str[:2]
    # départements Île-de-France
    deps_idf = {"75","77","78","91","92","93","94","95"}

    df_idf = df[df["dep"].isin(deps_idf)].copy()

    #3) construire colonne  adresse  et la colonnes type_bien et prix au m2 
    # --- adresse (vectorisé, gère NaN) ---
    df_idf["adresse"] = (
        df_idf["No voie"].fillna("").str.strip() + " " +
        df_idf["B/T/Q"].fillna("").str.strip() + " " +
        df_idf["Type de voie"].fillna("").str.strip() + " " +
        df_idf["Voie"].fillna("").str.strip() + ", " +
        df_idf["Code postal"].fillna("").str.strip() + " " +
        df_idf["Commune"].fillna("").str.strip()
    ).str.replace(r"\s+", " ", regex=True)\
    .str.replace(" ,", ",", regex=False)\
    .str.strip()

    # --- type_bien normalisé ---
    type_map = {
        "Appartement": "apartment",
        "Maison": "house",
        "Local industriel. commercial ou assimilé": "commercial",
        "Dépendance": "outbuilding",
    }
    df_idf["type_bien"] = df_idf["Type local"].str.strip().map(type_map).fillna("other")

    df_idf = df_idf[df_idf["type_bien"].isin(["house", "apartment"])].copy()
    # --- prix au m² arrondi ---
    df_idf["prix_au_m2"] = (df_idf["Valeur fonciere"] / df_idf["Surface reelle bati"]).round(2)



    return df_idf


def pipeline_dvf(Folder, Year):
    df1_light, df2_light = read_row_dvf(Folder, Year)

    df1_clean = prepare_dvf(df1_light)
    df2_clean = prepare_dvf(df2_light)

    df_final = pd.concat([df1_clean, df2_clean], ignore_index=True)

    df_final = df_final.drop_duplicates(
        subset=["adresse", "Date mutation", "Valeur fonciere"]
    ).copy()

    df_final["id"] = df_final.index + 1

    print("Pipeline DVF terminé.")


    #exporter le dataframe final en csv
    df_final.to_csv(f"../outputs/DVF_clean_{Year-1}_{Year}.csv", index=False)
    print(f"Dataframe final exporté en CSV : ../outputs/DVF_clean_{Year-1}_{Year}.csv")
    return df_final


if __name__ == "__main__":

    # Chemin vers ton fichier
    Folder = "../Data/"
    Year = 2025


    dvf_final  = pipeline_dvf(Folder, Year)

