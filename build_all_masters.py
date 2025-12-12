import psycopg2

# Připojení k databázi
conn = psycopg2.connect(
    host="localhost",
    database="klima",
    user="postgres",
    password="master"
)
cur = conn.cursor()

# Pomocná funkce pro update jednoho sloupce
def update_column(year, src_table, target_column):
    print(f"   → {year}: {src_table} → {target_column}")
    sql = f"""
    UPDATE climate_{year} c
    SET {target_column} = t."Avg"::double precision
    FROM {src_table} t
    WHERE c.kod_ku = t."AreaId";
    """
    cur.execute(sql)

# Získáme seznam všech tabulek v public
cur.execute("""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public';
""")
all_tables = {row[0] for row in cur.fetchall()}


def build_master_for_year(year: int):
    print(f"\n===== ROK {year} =====")

    # 1) Drop + create climate_YEAR
    cur.execute(f"DROP TABLE IF EXISTS climate_{year};")

    cur.execute(f"""
    CREATE TABLE climate_{year} (
        kod_ku TEXT PRIMARY KEY,

        -- TAVG měsíce
        tavg_m1 DOUBLE PRECISION,
        tavg_m2 DOUBLE PRECISION,
        tavg_m3 DOUBLE PRECISION,
        tavg_m4 DOUBLE PRECISION,
        tavg_m5 DOUBLE PRECISION,
        tavg_m6 DOUBLE PRECISION,
        tavg_m7 DOUBLE PRECISION,
        tavg_m8 DOUBLE PRECISION,
        tavg_m9 DOUBLE PRECISION,
        tavg_m10 DOUBLE PRECISION,
        tavg_m11 DOUBLE PRECISION,
        tavg_m12 DOUBLE PRECISION,

        -- TAVG roční
        tavg_avg DOUBLE PRECISION,

        -- SRA měsíce
        sra_m1 DOUBLE PRECISION,
        sra_m2 DOUBLE PRECISION,
        sra_m3 DOUBLE PRECISION,
        sra_m4 DOUBLE PRECISION,
        sra_m5 DOUBLE PRECISION,
        sra_m6 DOUBLE PRECISION,
        sra_m7 DOUBLE PRECISION,
        sra_m8 DOUBLE PRECISION,
        sra_m9 DOUBLE PRECISION,
        sra_m10 DOUBLE PRECISION,
        sra_m11 DOUBLE PRECISION,
        sra_m12 DOUBLE PRECISION,

        -- SRA roční
        sra_avg DOUBLE PRECISION,

        -- Indexy
        de_martonne DOUBLE PRECISION,
        pet DOUBLE PRECISION
    );
    """)

    # 2) Naplníme KÓDY KATASTRŮ
    cur.execute(f"""
        INSERT INTO climate_{year} (kod_ku)
        SELECT DISTINCT "KOD_KU" FROM ku_cr;
    """)

    # 3) Doplňujeme TAVG (měsíčně)
    print(" - TAVG (měsíční)")
    for m in range(1, 13):
        tbl = f"tavg_tavg_{year}_m{m}"
        if tbl in all_tables:
            update_column(year, tbl, f"tavg_m{m}")
        else:
            print(f"     ! Tabulka {tbl} neexistuje")

    # 4) TAVG roční
    tbl_tavg_as = f"tavg_tavg_{year}_a_s"
    print(" - TAVG (roční A-S)")
    if tbl_tavg_as in all_tables:
        update_column(year, tbl_tavg_as, "tavg_avg")
    else:
        print(f"     ! Tabulka {tbl_tavg_as} neexistuje")

    # 5) SRA (měsíčně)
    print(" - SRA (měsíční)")
    for m in range(1, 13):
        tbl = f"sra_sra_{year}_m{m}"
        if tbl in all_tables:
            update_column(year, tbl, f"sra_m{m}")
        else:
            print(f"     ! Tabulka {tbl} neexistuje")

    # 6) SRA roční
    tbl_sra_as = f"sra_sra_{year}_a_s"
    print(" - SRA (roční A-S)")
    if tbl_sra_as in all_tables:
        update_column(year, tbl_sra_as, "sra_avg")
    else:
        print(f"     ! Tabulka {tbl_sra_as} neexistuje")

    # 7) Výpočet DeMartonne indexu
    print(" - Výpočet De Martonne indexu")
    cur.execute(f"""
        UPDATE climate_{year}
        SET de_martonne = CASE
            WHEN tavg_avg IS NOT NULL AND sra_avg IS NOT NULL
            THEN sra_avg / (tavg_avg + 10.0)
            ELSE NULL
        END;
    """)

    # 8) Výpočet PET
    print(" - Výpočet PET")
    cur.execute(f"""
        UPDATE climate_{year}
        SET pet = calc_pet(
            tavg_m1, tavg_m2, tavg_m3, tavg_m4,
            tavg_m5, tavg_m6, tavg_m7, tavg_m8,
            tavg_m9, tavg_m10, tavg_m11, tavg_m12
        );
    """)

    conn.commit()
    print(f" ✅ Hotovo: climate_{year}")


# Hlavní smyčka: projdeme roky 1995–2055
for year in range(1995, 2056):
    build_master_for_year(year)

print("\n🔥 Všechny MASTER tabulky climate_1995–climate_2055 jsou vytvořené.")
cur.close()
conn.close()
