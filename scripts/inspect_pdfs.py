import sqlite3, os
conn = sqlite3.connect("data/vitals.db")
rows = conn.execute("SELECT path, text_content FROM document").fetchall()
for path, text in rows:
    if not text:
        continue
    fname = os.path.basename(path)[:42]
    for kw in ["HbA1c", "25-OH", "Hydroxy", "Vitamine D", "Vit. D", "CRP", "Vitamine B12", "B12 ", "Cobalamine", "Ferritine"]:
        idx = text.find(kw)
        if idx >= 0:
            sample = text[idx:idx + 80].replace("\n", " | ")
            print(f"{fname} | {kw}: {sample}")
