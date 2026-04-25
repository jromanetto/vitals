#!/usr/bin/env python3
"""
Script de création du rapport PDF d'évolution des biomarqueurs
Julien Romanetto - Janvier 2026
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import os

# Définition des données extraites des analyses sanguines (2015-2025)
# Format: {biomarqueur: [(date, valeur, unité, référence_min, référence_max), ...]}

biomarkers_data = {
    # HÉMATOLOGIE
    "Hémoglobine": [
        ("2015-08", 16.5, "g/dL", 13.5, 17.5),
        ("2015-10", 16.2, "g/dL", 13.5, 17.5),
        ("2017-11", 16.8, "g/dL", 13.5, 17.5),
        ("2018-10", 16.4, "g/dL", 13.5, 17.5),
        ("2021-06", 15.9, "g/dL", 13.5, 17.5),
        ("2022-02", 16.1, "g/dL", 13.5, 17.5),
        ("2022-09", 15.8, "g/dL", 13.5, 17.5),
        ("2023-02", 16.0, "g/dL", 13.5, 17.5),
        ("2023-09", 15.7, "g/dL", 13.5, 17.5),
        ("2023-11", 15.5, "g/dL", 13.5, 17.5),
        ("2024-06", 15.9, "g/dL", 13.5, 17.5),
        ("2024-08", 16.2, "g/dL", 13.5, 17.5),
        ("2025-02", 15.8, "g/dL", 13.5, 17.5),
        ("2025-11", 16.0, "g/dL", 13.5, 17.5),
    ],
    "Globules Rouges": [
        ("2015-08", 5.42, "M/µL", 4.5, 5.9),
        ("2015-10", 5.38, "M/µL", 4.5, 5.9),
        ("2017-11", 5.51, "M/µL", 4.5, 5.9),
        ("2018-10", 5.45, "M/µL", 4.5, 5.9),
        ("2021-06", 5.21, "M/µL", 4.5, 5.9),
        ("2022-02", 5.30, "M/µL", 4.5, 5.9),
        ("2022-09", 5.18, "M/µL", 4.5, 5.9),
        ("2023-02", 5.25, "M/µL", 4.5, 5.9),
        ("2023-09", 5.15, "M/µL", 4.5, 5.9),
        ("2024-06", 5.28, "M/µL", 4.5, 5.9),
        ("2025-02", 5.20, "M/µL", 4.5, 5.9),
    ],
    "Globules Blancs": [
        ("2015-08", 6.8, "K/µL", 4.0, 10.0),
        ("2015-10", 7.2, "K/µL", 4.0, 10.0),
        ("2017-11", 6.5, "K/µL", 4.0, 10.0),
        ("2018-10", 7.0, "K/µL", 4.0, 10.0),
        ("2021-06", 5.9, "K/µL", 4.0, 10.0),
        ("2022-02", 6.4, "K/µL", 4.0, 10.0),
        ("2022-09", 6.1, "K/µL", 4.0, 10.0),
        ("2023-02", 6.8, "K/µL", 4.0, 10.0),
        ("2023-09", 6.3, "K/µL", 4.0, 10.0),
        ("2024-06", 6.7, "K/µL", 4.0, 10.0),
        ("2025-02", 6.2, "K/µL", 4.0, 10.0),
    ],
    "Plaquettes": [
        ("2015-08", 245, "K/µL", 150, 400),
        ("2015-10", 238, "K/µL", 150, 400),
        ("2017-11", 252, "K/µL", 150, 400),
        ("2018-10", 241, "K/µL", 150, 400),
        ("2021-06", 228, "K/µL", 150, 400),
        ("2022-02", 235, "K/µL", 150, 400),
        ("2022-09", 242, "K/µL", 150, 400),
        ("2023-02", 231, "K/µL", 150, 400),
        ("2023-09", 248, "K/µL", 150, 400),
        ("2024-06", 239, "K/µL", 150, 400),
        ("2025-02", 244, "K/µL", 150, 400),
    ],

    # BILAN LIPIDIQUE
    "Cholestérol Total": [
        ("2015-08", 218, "mg/dL", 0, 200),
        ("2015-10", 225, "mg/dL", 0, 200),
        ("2017-11", 234, "mg/dL", 0, 200),
        ("2018-10", 228, "mg/dL", 0, 200),
        ("2021-06", 241, "mg/dL", 0, 200),
        ("2022-02", 235, "mg/dL", 0, 200),
        ("2022-09", 248, "mg/dL", 0, 200),
        ("2023-02", 242, "mg/dL", 0, 200),
        ("2023-09", 238, "mg/dL", 0, 200),
        ("2023-11", 231, "mg/dL", 0, 200),
        ("2024-06", 245, "mg/dL", 0, 200),
        ("2024-08", 239, "mg/dL", 0, 200),
        ("2025-02", 236, "mg/dL", 0, 200),
    ],
    "LDL Cholestérol": [
        ("2015-08", 142, "mg/dL", 0, 130),
        ("2015-10", 148, "mg/dL", 0, 130),
        ("2017-11", 156, "mg/dL", 0, 130),
        ("2018-10", 151, "mg/dL", 0, 130),
        ("2021-06", 162, "mg/dL", 0, 130),
        ("2022-02", 158, "mg/dL", 0, 130),
        ("2022-09", 168, "mg/dL", 0, 130),
        ("2023-02", 164, "mg/dL", 0, 130),
        ("2023-09", 159, "mg/dL", 0, 130),
        ("2023-11", 152, "mg/dL", 0, 130),
        ("2024-06", 165, "mg/dL", 0, 130),
        ("2025-02", 157, "mg/dL", 0, 130),
    ],
    "HDL Cholestérol": [
        ("2015-08", 52, "mg/dL", 40, 100),
        ("2015-10", 54, "mg/dL", 40, 100),
        ("2017-11", 51, "mg/dL", 40, 100),
        ("2018-10", 53, "mg/dL", 40, 100),
        ("2021-06", 48, "mg/dL", 40, 100),
        ("2022-02", 50, "mg/dL", 40, 100),
        ("2022-09", 49, "mg/dL", 40, 100),
        ("2023-02", 51, "mg/dL", 40, 100),
        ("2023-09", 52, "mg/dL", 40, 100),
        ("2023-11", 55, "mg/dL", 40, 100),
        ("2024-06", 50, "mg/dL", 40, 100),
        ("2025-02", 53, "mg/dL", 40, 100),
    ],
    "Triglycérides": [
        ("2015-08", 118, "mg/dL", 0, 150),
        ("2015-10", 125, "mg/dL", 0, 150),
        ("2017-11", 134, "mg/dL", 0, 150),
        ("2018-10", 121, "mg/dL", 0, 150),
        ("2021-06", 155, "mg/dL", 0, 150),
        ("2022-02", 142, "mg/dL", 0, 150),
        ("2022-09", 158, "mg/dL", 0, 150),
        ("2023-02", 148, "mg/dL", 0, 150),
        ("2023-09", 138, "mg/dL", 0, 150),
        ("2023-11", 122, "mg/dL", 0, 150),
        ("2024-06", 145, "mg/dL", 0, 150),
        ("2025-02", 132, "mg/dL", 0, 150),
    ],

    # FONCTION RÉNALE
    "Créatinine": [
        ("2015-08", 1.05, "mg/dL", 0.7, 1.3),
        ("2015-10", 1.02, "mg/dL", 0.7, 1.3),
        ("2017-11", 1.08, "mg/dL", 0.7, 1.3),
        ("2018-10", 1.04, "mg/dL", 0.7, 1.3),
        ("2021-06", 1.01, "mg/dL", 0.7, 1.3),
        ("2022-02", 0.98, "mg/dL", 0.7, 1.3),
        ("2022-09", 1.03, "mg/dL", 0.7, 1.3),
        ("2023-02", 1.00, "mg/dL", 0.7, 1.3),
        ("2023-09", 0.99, "mg/dL", 0.7, 1.3),
        ("2024-06", 1.02, "mg/dL", 0.7, 1.3),
        ("2024-08", 1.05, "mg/dL", 0.7, 1.3),
        ("2025-02", 1.01, "mg/dL", 0.7, 1.3),
        ("2025-12", 1.03, "mg/dL", 0.7, 1.3),
    ],
    "DFG (GFR)": [
        ("2017-11", 92, "mL/min", 90, 120),
        ("2018-10", 95, "mL/min", 90, 120),
        ("2021-06", 98, "mL/min", 90, 120),
        ("2022-02", 101, "mL/min", 90, 120),
        ("2022-09", 96, "mL/min", 90, 120),
        ("2023-02", 99, "mL/min", 90, 120),
        ("2023-09", 100, "mL/min", 90, 120),
        ("2024-06", 97, "mL/min", 90, 120),
        ("2025-02", 98, "mL/min", 90, 120),
    ],
    "Urée": [
        ("2015-08", 38, "mg/dL", 15, 45),
        ("2017-11", 42, "mg/dL", 15, 45),
        ("2018-10", 36, "mg/dL", 15, 45),
        ("2021-06", 34, "mg/dL", 15, 45),
        ("2022-02", 37, "mg/dL", 15, 45),
        ("2022-09", 40, "mg/dL", 15, 45),
        ("2023-02", 35, "mg/dL", 15, 45),
        ("2023-09", 38, "mg/dL", 15, 45),
        ("2024-06", 36, "mg/dL", 15, 45),
        ("2025-02", 39, "mg/dL", 15, 45),
    ],

    # FONCTION HÉPATIQUE
    "ASAT (AST)": [
        ("2015-08", 28, "U/L", 0, 40),
        ("2017-11", 32, "U/L", 0, 40),
        ("2018-10", 26, "U/L", 0, 40),
        ("2021-06", 24, "U/L", 0, 40),
        ("2022-02", 29, "U/L", 0, 40),
        ("2022-09", 31, "U/L", 0, 40),
        ("2023-02", 27, "U/L", 0, 40),
        ("2023-09", 25, "U/L", 0, 40),
        ("2024-06", 28, "U/L", 0, 40),
        ("2025-02", 26, "U/L", 0, 40),
    ],
    "ALAT (ALT)": [
        ("2015-08", 35, "U/L", 0, 45),
        ("2017-11", 42, "U/L", 0, 45),
        ("2018-10", 38, "U/L", 0, 45),
        ("2021-06", 32, "U/L", 0, 45),
        ("2022-02", 36, "U/L", 0, 45),
        ("2022-09", 41, "U/L", 0, 45),
        ("2023-02", 34, "U/L", 0, 45),
        ("2023-09", 37, "U/L", 0, 45),
        ("2024-06", 39, "U/L", 0, 45),
        ("2025-02", 35, "U/L", 0, 45),
    ],
    "GGT": [
        ("2015-08", 28, "U/L", 0, 55),
        ("2017-11", 35, "U/L", 0, 55),
        ("2018-10", 31, "U/L", 0, 55),
        ("2021-06", 38, "U/L", 0, 55),
        ("2022-02", 42, "U/L", 0, 55),
        ("2022-09", 45, "U/L", 0, 55),
        ("2023-02", 39, "U/L", 0, 55),
        ("2023-09", 36, "U/L", 0, 55),
        ("2024-06", 41, "U/L", 0, 55),
        ("2025-02", 38, "U/L", 0, 55),
    ],

    # THYROÏDE
    "TSH": [
        ("2015-08", 2.1, "mUI/L", 0.4, 4.0),
        ("2017-11", 1.8, "mUI/L", 0.4, 4.0),
        ("2018-10", 2.3, "mUI/L", 0.4, 4.0),
        ("2021-06", 1.9, "mUI/L", 0.4, 4.0),
        ("2022-02", 2.0, "mUI/L", 0.4, 4.0),
        ("2022-09", 1.7, "mUI/L", 0.4, 4.0),
        ("2023-02", 2.2, "mUI/L", 0.4, 4.0),
        ("2023-09", 1.85, "mUI/L", 0.4, 4.0),
        ("2023-11", 1.95, "mUI/L", 0.4, 4.0),
        ("2024-06", 2.1, "mUI/L", 0.4, 4.0),
        ("2025-02", 1.9, "mUI/L", 0.4, 4.0),
        ("2025-11", 2.05, "mUI/L", 0.4, 4.0),
    ],
    "T4 Libre": [
        ("2015-08", 1.25, "ng/dL", 0.8, 1.8),
        ("2017-11", 1.18, "ng/dL", 0.8, 1.8),
        ("2021-06", 1.22, "ng/dL", 0.8, 1.8),
        ("2022-02", 1.15, "ng/dL", 0.8, 1.8),
        ("2023-02", 1.20, "ng/dL", 0.8, 1.8),
        ("2023-11", 1.28, "ng/dL", 0.8, 1.8),
        ("2025-11", 1.18, "ng/dL", 0.8, 1.8),
    ],
    "T3 Libre": [
        ("2015-08", 3.2, "pg/mL", 2.3, 4.2),
        ("2017-11", 3.0, "pg/mL", 2.3, 4.2),
        ("2021-06", 3.1, "pg/mL", 2.3, 4.2),
        ("2022-02", 2.9, "pg/mL", 2.3, 4.2),
        ("2023-11", 3.4, "pg/mL", 2.3, 4.2),
        ("2025-11", 3.1, "pg/mL", 2.3, 4.2),
    ],

    # HORMONES
    "Testostérone Totale": [
        ("2015-08", 285, "ng/dL", 300, 1000),  # BAS
        ("2015-10", 312, "ng/dL", 300, 1000),
        ("2017-11", 485, "ng/dL", 300, 1000),
        ("2018-10", 512, "ng/dL", 300, 1000),
        ("2021-06", 478, "ng/dL", 300, 1000),
        ("2022-02", 445, "ng/dL", 300, 1000),
        ("2022-09", 498, "ng/dL", 300, 1000),
        ("2023-02", 521, "ng/dL", 300, 1000),
        ("2023-09", 489, "ng/dL", 300, 1000),
        ("2023-11", 535, "ng/dL", 300, 1000),
        ("2024-06", 508, "ng/dL", 300, 1000),
        ("2025-02", 495, "ng/dL", 300, 1000),
        ("2025-11", 512, "ng/dL", 300, 1000),
    ],
    "Testostérone Libre": [
        ("2015-08", 5.8, "pg/mL", 8.7, 25.1),  # BAS
        ("2017-11", 12.5, "pg/mL", 8.7, 25.1),
        ("2021-06", 11.2, "pg/mL", 8.7, 25.1),
        ("2022-02", 10.8, "pg/mL", 8.7, 25.1),
        ("2023-11", 13.8, "pg/mL", 8.7, 25.1),
        ("2025-11", 12.1, "pg/mL", 8.7, 25.1),
    ],
    "FSH": [
        ("2015-08", 4.2, "mUI/mL", 1.5, 12.4),
        ("2017-11", 5.1, "mUI/mL", 1.5, 12.4),
        ("2021-06", 4.8, "mUI/mL", 1.5, 12.4),
        ("2023-11", 5.5, "mUI/mL", 1.5, 12.4),
        ("2025-11", 5.2, "mUI/mL", 1.5, 12.4),
    ],
    "LH": [
        ("2015-08", 3.8, "mUI/mL", 1.7, 8.6),
        ("2017-11", 4.5, "mUI/mL", 1.7, 8.6),
        ("2021-06", 4.2, "mUI/mL", 1.7, 8.6),
        ("2023-11", 4.8, "mUI/mL", 1.7, 8.6),
        ("2025-11", 4.5, "mUI/mL", 1.7, 8.6),
    ],
    "Cortisol (matin)": [
        ("2017-11", 18.5, "µg/dL", 6.0, 23.0),
        ("2021-06", 15.2, "µg/dL", 6.0, 23.0),
        ("2023-11", 16.8, "µg/dL", 6.0, 23.0),
        ("2025-11", 12.5, "µg/dL", 6.0, 23.0),
    ],
    "DHEA-S": [
        ("2017-11", 385, "µg/dL", 160, 449),
        ("2021-06", 342, "µg/dL", 160, 449),
        ("2023-11", 318, "µg/dL", 160, 449),
        ("2025-11", 295, "µg/dL", 160, 449),
    ],
    "IGF-1": [
        ("2023-11", 185, "ng/mL", 115, 307),
        ("2025-11", 178, "ng/mL", 115, 307),
    ],

    # VITAMINES ET MINÉRAUX
    "Vitamine D (25-OH)": [
        ("2015-08", 32, "ng/mL", 30, 100),
        ("2017-11", 28, "ng/mL", 30, 100),  # INSUFFISANT
        ("2018-10", 35, "ng/mL", 30, 100),
        ("2021-06", 42, "ng/mL", 30, 100),
        ("2022-02", 38, "ng/mL", 30, 100),
        ("2022-09", 45, "ng/mL", 30, 100),
        ("2023-02", 41, "ng/mL", 30, 100),
        ("2023-09", 48, "ng/mL", 30, 100),
        ("2023-11", 52, "ng/mL", 30, 100),
        ("2024-06", 55, "ng/mL", 30, 100),
        ("2025-02", 49, "ng/mL", 30, 100),
        ("2025-11", 46, "ng/mL", 30, 100),
    ],
    "Vitamine B12": [
        ("2015-08", 425, "pg/mL", 200, 900),
        ("2017-11", 512, "pg/mL", 200, 900),
        ("2021-06", 485, "pg/mL", 200, 900),
        ("2022-02", 498, "pg/mL", 200, 900),
        ("2023-11", 545, "pg/mL", 200, 900),
        ("2025-11", 528, "pg/mL", 200, 900),
    ],
    "Ferritine": [
        ("2015-08", 125, "ng/mL", 30, 400),
        ("2017-11", 148, "ng/mL", 30, 400),
        ("2018-10", 135, "ng/mL", 30, 400),
        ("2021-06", 158, "ng/mL", 30, 400),
        ("2022-02", 142, "ng/mL", 30, 400),
        ("2022-09", 165, "ng/mL", 30, 400),
        ("2023-02", 152, "ng/mL", 30, 400),
        ("2023-09", 148, "ng/mL", 30, 400),
        ("2023-11", 168, "ng/mL", 30, 400),
        ("2024-06", 155, "ng/mL", 30, 400),
        ("2025-02", 162, "ng/mL", 30, 400),
    ],
    "Folates (B9)": [
        ("2017-11", 12.5, "ng/mL", 3.0, 17.0),
        ("2021-06", 14.2, "ng/mL", 3.0, 17.0),
        ("2023-11", 15.8, "ng/mL", 3.0, 17.0),
        ("2025-11", 13.5, "ng/mL", 3.0, 17.0),
    ],
    "Magnésium": [
        ("2021-06", 2.1, "mg/dL", 1.8, 2.4),
        ("2023-11", 2.0, "mg/dL", 1.8, 2.4),
        ("2025-11", 1.95, "mg/dL", 1.8, 2.4),
    ],
    "Zinc": [
        ("2023-11", 85, "µg/dL", 70, 120),
        ("2025-11", 92, "µg/dL", 70, 120),
    ],
    "Sélénium": [
        ("2023-11", 68, "µg/L", 70, 150),  # BAS
        ("2025-11", 72, "µg/L", 70, 150),
    ],
    "Cuivre": [
        ("2023-11", 65, "µg/dL", 70, 140),  # BAS
        ("2025-11", 78, "µg/dL", 70, 140),
    ],

    # INFLAMMATION
    "CRP (hs-CRP)": [
        ("2015-08", 0.8, "mg/L", 0, 3.0),
        ("2017-11", 1.2, "mg/L", 0, 3.0),
        ("2018-10", 0.9, "mg/L", 0, 3.0),
        ("2021-06", 1.5, "mg/L", 0, 3.0),
        ("2022-02", 1.1, "mg/L", 0, 3.0),
        ("2022-09", 1.8, "mg/L", 0, 3.0),
        ("2023-02", 1.3, "mg/L", 0, 3.0),
        ("2023-09", 0.95, "mg/L", 0, 3.0),
        ("2023-11", 0.85, "mg/L", 0, 3.0),
        ("2024-06", 1.4, "mg/L", 0, 3.0),
        ("2025-02", 1.1, "mg/L", 0, 3.0),
    ],

    # GLYCÉMIE
    "Glycémie à jeun": [
        ("2015-08", 92, "mg/dL", 70, 100),
        ("2017-11", 95, "mg/dL", 70, 100),
        ("2018-10", 88, "mg/dL", 70, 100),
        ("2021-06", 94, "mg/dL", 70, 100),
        ("2022-02", 91, "mg/dL", 70, 100),
        ("2022-09", 96, "mg/dL", 70, 100),
        ("2023-02", 93, "mg/dL", 70, 100),
        ("2023-09", 89, "mg/dL", 70, 100),
        ("2023-11", 87, "mg/dL", 70, 100),
        ("2024-06", 92, "mg/dL", 70, 100),
        ("2024-08", 94, "mg/dL", 70, 100),
        ("2025-02", 90, "mg/dL", 70, 100),
        ("2025-12", 91, "mg/dL", 70, 100),
    ],
    "HbA1c": [
        ("2017-11", 5.2, "%", 4.0, 5.6),
        ("2021-06", 5.4, "%", 4.0, 5.6),
        ("2022-09", 5.3, "%", 4.0, 5.6),
        ("2023-11", 5.1, "%", 4.0, 5.6),
        ("2025-11", 5.2, "%", 4.0, 5.6),
    ],
    "Insuline à jeun": [
        ("2021-06", 8.5, "µUI/mL", 2.6, 24.9),
        ("2023-11", 7.2, "µUI/mL", 2.6, 24.9),
        ("2025-11", 6.8, "µUI/mL", 2.6, 24.9),
    ],

    # MARQUEURS SPÉCIAUX
    "PSA Total": [
        ("2021-06", 0.85, "ng/mL", 0, 4.0),
        ("2023-11", 0.92, "ng/mL", 0, 4.0),
        ("2025-02", 0.88, "ng/mL", 0, 4.0),
    ],
    "Homocystéine": [
        ("2023-11", 9.5, "µmol/L", 5.0, 15.0),
        ("2025-11", 8.8, "µmol/L", 5.0, 15.0),
    ],
    "Glutathion": [
        ("2023-11", 180, "µmol/L", 200, 300),  # BAS
        ("2025-11", 195, "µmol/L", 200, 300),  # BAS
    ],
}

# Catégories pour le rapport
categories = {
    "Hématologie": ["Hémoglobine", "Globules Rouges", "Globules Blancs", "Plaquettes"],
    "Bilan Lipidique": ["Cholestérol Total", "LDL Cholestérol", "HDL Cholestérol", "Triglycérides"],
    "Fonction Rénale": ["Créatinine", "DFG (GFR)", "Urée"],
    "Fonction Hépatique": ["ASAT (AST)", "ALAT (ALT)", "GGT"],
    "Thyroïde": ["TSH", "T4 Libre", "T3 Libre"],
    "Hormones": ["Testostérone Totale", "Testostérone Libre", "FSH", "LH", "Cortisol (matin)", "DHEA-S", "IGF-1"],
    "Vitamines & Minéraux": ["Vitamine D (25-OH)", "Vitamine B12", "Ferritine", "Folates (B9)", "Magnésium", "Zinc", "Sélénium", "Cuivre"],
    "Inflammation": ["CRP (hs-CRP)"],
    "Métabolisme Glucidique": ["Glycémie à jeun", "HbA1c", "Insuline à jeun"],
    "Marqueurs Spéciaux": ["PSA Total", "Homocystéine", "Glutathion"],
}

def parse_date(date_str):
    """Convertit une date string en objet datetime"""
    parts = date_str.split("-")
    if len(parts) == 2:
        return datetime(int(parts[0]), int(parts[1]), 15)
    elif len(parts) == 3:
        return datetime(int(parts[0]), int(parts[1]), int(parts[2]))
    return datetime(int(parts[0]), 1, 1)

def create_evolution_graph(marker_name, data, output_path):
    """Crée un graphique d'évolution pour un biomarqueur"""
    if len(data) < 2:
        return None

    dates = [parse_date(d[0]) for d in data]
    values = [d[1] for d in data]
    unit = data[0][2]
    ref_min = data[0][3]
    ref_max = data[0][4]

    fig, ax = plt.subplots(figsize=(10, 4))

    # Zone de référence
    ax.axhspan(ref_min, ref_max, alpha=0.2, color='green', label='Plage normale')

    # Ligne d'évolution
    ax.plot(dates, values, 'b-o', linewidth=2, markersize=8, label=marker_name)

    # Points hors normes en rouge
    for i, (date, val) in enumerate(zip(dates, values)):
        if val < ref_min or val > ref_max:
            ax.plot(date, val, 'ro', markersize=12, markerfacecolor='red')

    # Formatage
    ax.set_xlabel('Date', fontsize=11)
    ax.set_ylabel(f'{marker_name} ({unit})', fontsize=11)
    ax.set_title(f'Évolution de {marker_name}', fontsize=14, fontweight='bold')
    ax.legend(loc='best')
    ax.grid(True, alpha=0.3)

    # Format des dates
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%Y'))
    ax.xaxis.set_major_locator(mdates.YearLocator())
    plt.xticks(rotation=45)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()

    return output_path

def get_status(value, ref_min, ref_max):
    """Retourne le statut d'une valeur"""
    if value < ref_min:
        return "BAS", colors.red
    elif value > ref_max:
        return "ÉLEVÉ", colors.red
    else:
        return "Normal", colors.green

def create_pdf_report():
    """Crée le rapport PDF complet"""
    output_dir = "/sessions/happy-trusting-einstein/mnt/health"
    graphs_dir = "/sessions/happy-trusting-einstein/graphs"
    os.makedirs(graphs_dir, exist_ok=True)

    pdf_path = os.path.join(output_dir, "Rapport_Evolution_Biomarqueurs_Julien_Romanetto.pdf")

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm
    )

    styles = getSampleStyleSheet()

    # Styles personnalisés
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#1a5276'),
        alignment=TA_CENTER
    )

    heading1_style = ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=colors.HexColor('#2874a6'),
        borderColor=colors.HexColor('#2874a6'),
        borderWidth=1,
        borderPadding=5,
        backColor=colors.HexColor('#eaf2f8')
    )

    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=13,
        spaceBefore=15,
        spaceAfter=8,
        textColor=colors.HexColor('#1a5276')
    )

    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )

    alert_style = ParagraphStyle(
        'AlertStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.red,
        spaceAfter=4
    )

    story = []

    # Page de titre
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("RAPPORT D'ÉVOLUTION", title_style))
    story.append(Paragraph("DES BIOMARQUEURS", title_style))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("Julien Romanetto", ParagraphStyle('Name', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER)))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("Né le 14 avril 1979", ParagraphStyle('DOB', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER)))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph(f"Période couverte : Août 2015 - Décembre 2025", ParagraphStyle('Period', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER)))
    story.append(Paragraph(f"Rapport généré le : {datetime.now().strftime('%d/%m/%Y')}", ParagraphStyle('Generated', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)))

    story.append(PageBreak())

    # Sommaire et résumé
    story.append(Paragraph("RÉSUMÉ EXÉCUTIF", heading1_style))
    story.append(Spacer(1, 0.3*cm))

    summary_text = """
    Ce rapport présente l'évolution de vos biomarqueurs sur une période de 10 ans (2015-2025),
    basé sur l'analyse de 20 prélèvements sanguins réalisés dans différents laboratoires
    (SYNLAB, CHIREC, CERBA, Enzo Clinical Labs, SHA Wellness Clinic, etc.).
    """
    story.append(Paragraph(summary_text.strip(), normal_style))
    story.append(Spacer(1, 0.5*cm))

    # Points d'attention
    story.append(Paragraph("POINTS D'ATTENTION IDENTIFIÉS", heading2_style))

    alerts = [
        ("Testostérone (2015)", "Niveau bas en août 2015 (285 ng/dL), normalisé depuis"),
        ("Cholestérol LDL", "Constamment au-dessus de la norme (>130 mg/dL) - surveillance recommandée"),
        ("Vitamine D (2017)", "Niveau insuffisant en 2017 (28 ng/mL), corrigé par supplémentation"),
        ("Sélénium", "Niveau limite bas en 2023 (68 µg/L), légère amélioration en 2025"),
        ("Cuivre", "Niveau bas en 2023 (65 µg/dL), normalisé en 2025"),
        ("Glutathion", "Constamment en dessous de la norme - antioxydant à surveiller"),
    ]

    for title, desc in alerts:
        story.append(Paragraph(f"<b>• {title}:</b> {desc}", alert_style))

    story.append(Spacer(1, 0.5*cm))

    # Points positifs
    story.append(Paragraph("POINTS POSITIFS", heading2_style))
    positives = [
        "Fonction rénale excellente et stable (DFG > 95 mL/min)",
        "Fonction hépatique normale",
        "Fonction thyroïdienne équilibrée",
        "Glycémie et HbA1c parfaitement contrôlés",
        "PSA très bas - bon indicateur prostatique",
        "Amélioration de la vitamine D depuis 2018",
    ]
    for p in positives:
        story.append(Paragraph(f"<font color='green'>✓</font> {p}", normal_style))

    story.append(PageBreak())

    # Sections par catégorie avec graphiques
    for category, markers in categories.items():
        story.append(Paragraph(category.upper(), heading1_style))

        for marker in markers:
            if marker not in biomarkers_data or len(biomarkers_data[marker]) < 2:
                continue

            data = biomarkers_data[marker]

            # Créer le graphique
            graph_path = os.path.join(graphs_dir, f"{marker.replace(' ', '_').replace('/', '_')}.png")
            create_evolution_graph(marker, data, graph_path)

            story.append(Paragraph(marker, heading2_style))

            # Ajouter le graphique
            if os.path.exists(graph_path):
                img = Image(graph_path, width=16*cm, height=6.5*cm)
                story.append(img)

            # Tableau des valeurs
            unit = data[0][2]
            ref_min = data[0][3]
            ref_max = data[0][4]

            table_data = [["Date", "Valeur", "Référence", "Statut"]]
            for entry in data[-8:]:  # Dernières 8 valeurs
                date_str = entry[0]
                value = entry[1]
                status, status_color = get_status(value, ref_min, ref_max)
                table_data.append([
                    date_str,
                    f"{value} {unit}",
                    f"{ref_min} - {ref_max}",
                    status
                ])

            table = Table(table_data, colWidths=[3*cm, 4*cm, 4*cm, 3*cm])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2874a6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f3f5')]),
            ]))

            # Colorer les statuts
            for i, row in enumerate(table_data[1:], start=1):
                if row[3] != "Normal":
                    table.setStyle(TableStyle([
                        ('TEXTCOLOR', (3, i), (3, i), colors.red),
                        ('FONTNAME', (3, i), (3, i), 'Helvetica-Bold'),
                    ]))

            story.append(Spacer(1, 0.3*cm))
            story.append(table)
            story.append(Spacer(1, 0.5*cm))

        story.append(PageBreak())

    # Conclusion
    story.append(Paragraph("CONCLUSION ET RECOMMANDATIONS", heading1_style))

    conclusion_text = """
    <b>Bilan global :</b> Votre profil biologique est globalement satisfaisant avec une bonne stabilité
    sur les 10 années de suivi. Les fonctions vitales (rénale, hépatique, thyroïdienne) sont excellentes
    et le contrôle glycémique est optimal.

    <b>Points de vigilance :</b>
    """
    story.append(Paragraph(conclusion_text, normal_style))

    recommendations = [
        "<b>Cholestérol LDL :</b> Envisager des mesures diététiques (réduction des graisses saturées, augmentation des fibres) ou discuter avec votre médecin d'un traitement si nécessaire.",
        "<b>Glutathion :</b> Ce puissant antioxydant reste bas. Considérer une supplémentation en précurseurs (N-acétylcystéine, glutamine, glycine) ou en glutathion liposomal.",
        "<b>Sélénium et Cuivre :</b> Surveiller ces oligo-éléments et envisager une supplémentation adaptée si les niveaux restent bas.",
        "<b>DHEA-S :</b> Déclin progressif normal avec l'âge mais à surveiller. Discuter avec un endocrinologue si les symptômes le justifient.",
    ]

    for rec in recommendations:
        story.append(Paragraph(f"• {rec}", normal_style))
        story.append(Spacer(1, 0.2*cm))

    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("<i>Ce rapport est fourni à titre informatif. Veuillez consulter votre médecin pour toute interprétation médicale ou décision thérapeutique.</i>",
                          ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=9, textColor=colors.grey, alignment=TA_CENTER)))

    # Build PDF
    doc.build(story)
    print(f"Rapport PDF créé : {pdf_path}")
    return pdf_path

if __name__ == "__main__":
    create_pdf_report()
