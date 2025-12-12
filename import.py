import os
import psycopg2

# ====== NASTAVENÍ PŘIPOJENÍ K DATABÁZI ======
conn = psycopg2.connect(
    host="localhost",
    database="klima",
    user="postgres",
    password="master"   # ← tvoje heslo
)
cur = conn.cursor()

# ====== CESTA K DATŮM ======
base_path = r"C:\Skola\4_ZS\GEOTE\sem\Data_semestralka_GEOTE"


# Složky, které obsahují CSV
folders = ["RH", "SRA", "TAVG", "WV"]


def safe_name(text):
    """Odstraní znaky, které PostgreSQL nechce."""
    return text.lower().replace("-", "_").replace(".", "_")


def import_csv(csv_path, table_name):
    print(f"→ Importuji: {csv_path} do tabulky {table_name}")

    # načteme hlavičku CSV
    with open(csv_path, "r", encoding="latin-1", errors="ignore") as f:
        header = f.readline().strip().split(",")

    # vytvoříme SQL sloupce (vše jako TEXT)
    columns = ", ".join([f'"{col}" TEXT' for col in header])

    cur.execute(f"DROP TABLE IF EXISTS {table_name};")
    cur.execute(f"CREATE TABLE {table_name} ({columns});")

    # import CSV pomocí COPY
    with open(csv_path, "r", encoding="latin-1", errors="ignore") as f:
        cur.copy_expert(f"COPY {table_name} FROM STDIN CSV HEADER", f)

    conn.commit()



# ====== HLAVNÍ IMPORT ======
for folder in folders:
    folder_path = os.path.join(base_path, folder)

    for file in os.listdir(folder_path):
        if file.endswith(".csv"):
            table_name = safe_name(folder + "_" + file.split(".")[0])
            csv_file = os.path.join(folder_path, file)

            import_csv(csv_file, table_name)

print("\n🔥 HOTOVO! Všechna CSV jsou v databázi.")
cur.close()
conn.close()
