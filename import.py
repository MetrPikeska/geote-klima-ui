import os
import psycopg2

# ====== DATABASE CONNECTION SETTINGS ======
conn = psycopg2.connect(
    host="localhost",
    database="klima",
    user="postgres",
    password="master"   # ← your password
)
cur = conn.cursor()

# ====== PATH TO DATA ======
base_path = r"C:\Skola\4_ZS\GEOTE\sem\Data_semestralka_GEOTE"


# Folders containing CSV
folders = ["RH", "SRA", "TAVG", "WV"]


def safe_name(text):
    """Removes characters that PostgreSQL does not like."""
    return text.lower().replace("-", "_").replace(".", "_")


def import_csv(csv_path, table_name):
    print(f"→ Importing: {csv_path} into table {table_name}")

    # load CSV header
    with open(csv_path, "r", encoding="latin-1", errors="ignore") as f:
        header = f.readline().strip().split(",")

    # create SQL columns (all as TEXT)
    columns = ", ".join([f'"{col}" TEXT' for col in header])

    cur.execute(f"DROP TABLE IF EXISTS {table_name};")
    cur.execute(f"CREATE TABLE {table_name} ({columns});")

    # import CSV using COPY
    with open(csv_path, "r", encoding="latin-1", errors="ignore") as f:
        cur.copy_expert(f"COPY {table_name} FROM STDIN CSV HEADER", f)

    conn.commit()


# ====== MAIN IMPORT ======
for folder in folders:
    folder_path = os.path.join(base_path, folder)

    for file in os.listdir(folder_path):
        if file.endswith(".csv"):
            table_name = safe_name(folder + "_" + file.split(".")[0])
            csv_file = os.path.join(folder_path, file)

            import_csv(csv_file, table_name)

print("\nDONE! All CSVs are in the database.") # Emoji removed here
cur.close()
conn.close()
