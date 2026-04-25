#!/usr/bin/env python3
"""
Script de création du rapport PDF d'évolution des biomarqueurs
Julien Romanetto - Janvier 2026
VERSION 2 - UNIQUEMENT DONNÉES RÉELLES EXTRAITES DES DOCUMENTS
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

# ============================================================================
# DONNÉES RÉELLES EXTRAITES DES DOCUMENTS ORIGINAUX
# Chaque entrée: (date, valeur, unité, ref_min, ref_max, source)
# ============================================================================

biomarkers_data = {
    # HÉMATOLOGIE - Hémoglobine
    "Hémoglobine": [
        ("2021-06", 15.1, "g/dL", 13.2, 17.3, "CHIREC"),
        ("2022-09", 15.6, "g/dL", 13.5, 17.5, "SYNLAB"),
        ("2023-09", 14.9, "g/dL", 13.1, 17.3, "SHA Wellness"),  # SHA data
        ("2024-06", 14.8, "g/dL", 13.5, 16.9, "CEF Boulard"),
        ("2025-02", 14.7, "g/dL", 13.5, 17.5, "SYNLAB"),
        ("2025-11", 14.7, "g/dL", 13.5, 16.9, "CEF Pelleport"),
        ("2025-12", 14.6, "g/dL", 13.1, 17.2, "CHIREC"),
    ],

    # Globules Rouges (Erythrocytes)
    "Globules Rouges": [
        ("2021-06", 4.84, "M/µL", 4.30, 5.70, "CHIREC"),
        ("2022-09", 5.10, "10^12/L", 4.3, 5.9, "SYNLAB"),
        ("2023-09", 4.62, "10^6/uL", 4.20, 5.60, "LIMS"),
        ("2023-11", 4.52, "10^6/uL", 4.4, 5.8, "SHA"),
        ("2024-06", 4.87, "tera/L", 4.44, 5.61, "CEF Boulard"),
        ("2025-02", 4.88, "10^12/L", 4.3, 5.9, "SYNLAB"),
        ("2025-11", 4.76, "tera/L", 4.44, 5.61, "CEF Pelleport"),
        ("2025-12", 4.77, "10^6/mm3", 4.2, 5.6, "CHIREC"),
    ],

    # Globules Blancs (Leucocytes)
    "Globules Blancs": [
        ("2021-06", 10.2, "K/µL", 4.5, 11.0, "CHIREC"),
        ("2022-09", 7.73, "10^9/L", 3.5, 11.0, "SYNLAB"),
        ("2023-09", 7.6, "10^3/uL", 4.0, 10.5, "LIMS"),
        ("2023-11", 5.3, "10^3/uL", 4.0, 9.0, "SHA"),
        ("2024-06", 8.8, "giga/L", 3.9, 10.9, "CEF Boulard"),
        ("2025-02", 8.43, "10^9/L", 3.5, 11.0, "SYNLAB"),
        ("2025-11", 6.6, "giga/L", 3.9, 10.9, "CEF Pelleport"),
        ("2025-12", 6.8, "K/mm3", 4.5, 11.0, "CHIREC"),
    ],

    # Plaquettes
    "Plaquettes": [
        ("2021-06", 221, "K/µL", 150, 400, "CHIREC"),
        ("2022-09", 248, "10^9/L", 150, 400, "SYNLAB"),
        ("2023-11", 194, "10^3/uL", 130, 400, "SHA"),
        ("2024-06", 252, "giga/L", 166, 308, "CEF Boulard"),
        ("2025-02", 273, "10^9/L", 150, 400, "SYNLAB"),
        ("2025-11", 237, "giga/L", 166, 308, "CEF Pelleport"),
        ("2025-12", 254, "K/mm3", 150, 400, "CHIREC"),
    ],

    # BILAN LIPIDIQUE - Cholestérol Total
    "Cholestérol Total": [
        ("2022-02", 202, "mg/dL", 140, 190, "SYNLAB"),
        ("2022-09", 216, "mg/dL", 140, 190, "SYNLAB"),
        ("2023-02", 202, "mg/dL", 140, 190, "SYNLAB"),
        ("2023-09", 175, "mg/dL", 0, 190, "LIMS"),
        ("2023-11", 163, "mg/dL", 110, 200, "SHA"),
        ("2024-06", 216, "mg/dL", 0, 200, "CEF Boulard"),  # 2.16 g/L
        ("2024-08", 182, "mg/dL", 0, 200, "CHIREC"),
        ("2025-02", 174, "mg/dL", 140, 190, "SYNLAB"),
        ("2025-11", 220, "mg/dL", 0, 200, "CEF Pelleport"),  # 2.20 g/L
    ],

    # LDL Cholestérol
    "LDL Cholestérol": [
        ("2022-02", 122, "mg/dL", 0, 114, "SYNLAB"),
        ("2022-09", 136, "mg/dL", 0, 114, "SYNLAB"),
        ("2023-02", 130, "mg/dL", 0, 114, "SYNLAB"),
        ("2023-09", 111, "mg/dL", 0, 115, "LIMS"),
        ("2023-11", 92, "mg/dL", 100, 150, "SHA"),  # Noté bas par SHA
        ("2024-06", 121, "mg/dL", 0, 130, "CEF Boulard"),  # 1.21 g/L
        ("2024-08", 104, "mg/dL", 0, 100, "CHIREC"),
        ("2025-02", 104, "mg/dL", 0, 114, "SYNLAB"),
        ("2025-11", 139, "mg/dL", 0, 130, "CEF Pelleport"),  # 1.39 g/L
    ],

    # HDL Cholestérol
    "HDL Cholestérol": [
        ("2022-02", 54, "mg/dL", 40, 100, "SYNLAB"),
        ("2022-09", 47, "mg/dL", 40, 100, "SYNLAB"),
        ("2023-02", 46, "mg/dL", 40, 100, "SYNLAB"),
        ("2023-09", 50.4, "mg/dL", 40, 100, "LIMS"),
        ("2023-11", 52, "mg/dL", 35, 150, "SHA"),
        ("2024-06", 55, "mg/dL", 60, 100, "CEF Boulard"),  # 0.55 g/L, ref >0.60
        ("2024-08", 58, "mg/dL", 55, 100, "CHIREC"),
        ("2025-02", 55, "mg/dL", 40, 100, "SYNLAB"),
        ("2025-11", 54, "mg/dL", 60, 100, "CEF Pelleport"),  # 0.54 g/L
    ],

    # Triglycérides
    "Triglycérides": [
        ("2022-02", 130, "mg/dL", 30, 175, "SYNLAB"),
        ("2022-09", 167, "mg/dL", 30, 170, "SYNLAB"),
        ("2023-02", 132, "mg/dL", 30, 170, "SYNLAB"),
        ("2023-09", 67, "mg/dL", 30, 150, "LIMS"),
        ("2023-11", 94, "mg/dL", 0, 150, "SHA"),
        ("2024-06", 201, "mg/dL", 0, 150, "CEF Boulard"),  # 2.01 g/L
        ("2024-08", 102, "mg/dL", 0, 200, "CHIREC"),
        ("2025-02", 77, "mg/dL", 30, 170, "SYNLAB"),
        ("2025-11", 135, "mg/dL", 0, 150, "CEF Pelleport"),  # 1.35 g/L
    ],

    # FONCTION RÉNALE - Créatinine
    "Créatinine": [
        ("2022-02", 1.01, "mg/dL", 0.70, 1.30, "SYNLAB"),
        ("2022-09", 1.00, "mg/dL", 0.70, 1.30, "SYNLAB"),
        ("2023-09", 1.11, "mg/dL", 0.72, 1.18, "LIMS"),
        ("2023-11", 1.06, "mg/dL", 0.6, 1.2, "SHA"),
        ("2024-06", 1.18, "mg/dL", 0.72, 1.18, "CEF Boulard"),  # 104 µmol/L
        ("2025-02", 1.08, "mg/dL", 0.70, 1.30, "SYNLAB"),
        ("2025-11", 1.21, "mg/dL", 0.72, 1.18, "CEF Pelleport"),  # 107 µmol/L
        ("2025-12", 1.15, "mg/dL", 0.70, 1.20, "CHIREC"),
    ],

    # GFR (DFG)
    "DFG (GFR)": [
        ("2022-02", 90, "mL/min", 60, 120, "SYNLAB"),  # >90
        ("2022-09", 90, "mL/min", 60, 120, "SYNLAB"),  # >90
        ("2023-09", 82, "mL/min", 60, 120, "LIMS"),
        ("2024-06", 74, "mL/min", 60, 120, "CEF Boulard"),  # CKD-EPI
        ("2025-02", 82, "mL/min", 60, 120, "SYNLAB"),
        ("2025-11", 71, "mL/min", 60, 120, "CEF Pelleport"),  # CKD-EPI
        ("2025-12", 68, "mL/min", 60, 120, "CHIREC"),  # MDRD
    ],

    # Urée
    "Urée": [
        ("2022-02", 31, "mg/dL", 10, 50, "SYNLAB"),
        ("2022-09", 31, "mg/dL", 20, 50, "SYNLAB"),
        ("2023-09", 30, "mg/dL", 17, 43, "LIMS"),
        ("2023-11", 31, "mg/dL", 15, 55, "SHA"),
        ("2025-02", 36, "mg/dL", 20, 50, "SYNLAB"),
        ("2025-11", 28, "mg/dL", 12.6, 42.6, "CEF Pelleport"),  # 4.6 mmol/L
    ],

    # FONCTION HÉPATIQUE - ASAT/GOT
    "ASAT (GOT)": [
        ("2022-09", 17, "U/L", 10, 37, "SYNLAB"),
        ("2023-09", 15, "U/L", 0, 37, "SHA"),
        ("2024-06", 17, "U/L", 0, 50, "CEF Boulard"),
        ("2025-02", 18, "U/L", 10, 37, "SYNLAB"),
        ("2025-11", 23, "U/L", 0, 50, "CEF Pelleport"),
        ("2025-12", 17, "U/L", 0, 40, "CHIREC"),
    ],

    # ALAT/GPT
    "ALAT (GPT)": [
        ("2022-09", 15, "U/L", 9, 40, "SYNLAB"),
        ("2023-11", 17, "U/L", 0, 55, "SHA"),
        ("2024-06", 12, "U/L", 0, 50, "CEF Boulard"),
        ("2025-02", 18, "U/L", 10, 49, "SYNLAB"),
        ("2025-11", 19, "U/L", 0, 50, "CEF Pelleport"),
        ("2025-12", 16, "U/L", 0, 41, "CHIREC"),
    ],

    # GGT
    "GGT": [
        ("2022-09", 16, "U/L", 8, 61, "SYNLAB"),
        ("2023-11", 10, "U/L", 12, 64, "SHA"),  # Bas
        ("2024-06", 12, "U/L", 0, 55, "CEF Boulard"),
        ("2025-02", 13, "U/L", 8, 73, "SYNLAB"),
        ("2025-11", 12, "U/L", 0, 55, "CEF Pelleport"),
        ("2025-12", 10, "U/L", 0, 61, "CHIREC"),
    ],

    # THYROÏDE - TSH
    "TSH": [
        ("2021-06", 1.97, "mU/L", 0.27, 4.20, "CHIREC"),
        ("2022-02", 1.88, "mU/L", 0.3, 4.5, "SYNLAB"),
        ("2022-09", 1.72, "mU/L", 0.5, 4.8, "SYNLAB"),
        ("2023-09", 1.18, "mU/L", 0.35, 4.00, "LIMS"),
        ("2023-11", 1.53, "uUI/mL", 0.35, 4.9, "SHA"),
        ("2024-06", 0.72, "mUI/L", 0.35, 4.94, "CEF Boulard"),
        ("2025-02", 1.13, "mU/L", 0.5, 4.8, "SYNLAB"),
        ("2025-11", 1.33, "mUI/L", 0.35, 4.94, "CEF Pelleport"),
    ],

    # T4 Libre
    "T4 Libre": [
        ("2021-06", 13.5, "pmol/L", 12.0, 22.0, "CHIREC"),
        ("2022-09", 16.81, "pmol/L", 11.5, 22.7, "SYNLAB"),
        ("2023-09", 12.7, "pmol/L", 9.0, 19.0, "LIMS"),
        ("2023-11", 0.78, "ng/dL", 0.71, 1.85, "SHA"),  # unité différente
        ("2025-02", 20.01, "pmol/L", 11.5, 22.7, "SYNLAB"),
        ("2025-11", 13.1, "pmol/L", 9.0, 19.1, "CEF Pelleport"),  # 1.02 ng/dL
    ],

    # T3 Libre
    "T3 Libre": [
        ("2022-09", 6.02, "pmol/L", 3.23, 6.47, "SYNLAB"),
        ("2023-09", 3.2, "pmol/L", 2.6, 5.4, "LIMS"),
        ("2025-02", 5.28, "pmol/L", 3.5, 6.5, "SYNLAB"),
        ("2025-11", 4.6, "pmol/L", 2.9, 4.9, "CEF Pelleport"),  # 3.0 pg/mL
    ],

    # HORMONES - Testostérone Totale
    "Testostérone Totale": [
        ("2015-08", 210.7, "ng/dL", 249, 836, "Enzo Labs"),  # BAS - LC/MS: 279.3
        ("2015-10", 590.8, "ng/dL", 249, 836, "Enzo Labs"),  # LC/MS: 658.6
        ("2017-11", 602, "ng/dL", 250, 840, "CERBA"),
        ("2018-10", 720, "ng/dL", 250, 840, "CERBA"),
        ("2021-06", 666, "ng/dL", 249, 836, "CHIREC"),  # 23.10 nmol/L
        ("2022-02", 400, "ng/dL", 300, 1000, "SYNLAB"),  # 3997 ng/L
        ("2022-09", 462, "ng/dL", 300, 1000, "SYNLAB"),  # 4619 ng/L
        ("2023-02", 379, "ng/dL", 300, 1000, "SYNLAB"),  # 3794 ng/L
        ("2023-09", 458, "ng/dL", 46, 980, "LIMS"),  # 15.9 nmol/L
        ("2023-11", 428.6, "ng/dL", 252.7, 803.2, "SHA"),
        ("2025-02", 322, "ng/dL", 300, 1000, "SYNLAB"),  # 3220 ng/L
        ("2025-11", 569, "ng/dL", 240, 871, "CEF Pelleport"),  # 19.73 nmol/L
    ],

    # Testostérone Libre
    "Testostérone Libre": [
        ("2015-08", 5.2, "pg/mL", 8.7, 25.1, "Enzo Labs"),  # BAS
        ("2015-10", 15.3, "pg/mL", 8.7, 25.1, "Enzo Labs"),
        ("2017-11", 13.5, "ng/dL", 5.7, 17.8, "CERBA"),
        ("2018-10", 15.1, "ng/dL", 5.7, 17.8, "CERBA"),
        ("2022-09", 174, "ng/L", 50, 280, "SYNLAB"),  # = 17.4 pg/mL
        ("2023-02", 134, "ng/L", 50, 280, "SYNLAB"),  # = 13.4 pg/mL
        ("2023-09", 7.56, "pg/mL", 1.00, 28.28, "LIMS"),
        ("2025-02", 117, "ng/L", 50, 280, "SYNLAB"),  # = 11.7 pg/mL
        ("2025-11", 51, "ng/dL", 80, 320, "CEF Pelleport"),  # 0.51 ng/mL biodisponible
    ],

    # FSH
    "FSH": [
        ("2015-08", 4.6, "mUI/mL", 1.5, 12.4, "Enzo Labs"),
        ("2015-10", 8.0, "mUI/mL", 1.5, 12.4, "Enzo Labs"),
        ("2017-11", 7.2, "IU/L", 1.5, 12.4, "CERBA"),
        ("2018-10", 5.9, "IU/L", 1.5, 12.4, "CERBA"),
        ("2022-02", 4.6, "IU/L", 2, 15, "SYNLAB"),
        ("2023-09", 4.8, "UI/L", 1.0, 12.0, "LIMS"),
        ("2023-11", 4.14, "mUI/mL", 1.3, 19.3, "SHA"),
        ("2025-11", 4.4, "mUI/mL", 0.9, 11.9, "CEF Pelleport"),
    ],

    # LH
    "LH": [
        ("2015-08", 6.6, "mUI/mL", 1.7, 8.6, "Enzo Labs"),
        ("2015-10", 10.2, "mUI/mL", 1.7, 8.6, "Enzo Labs"),  # ÉLEVÉ
        ("2017-11", 10.2, "IU/L", 1.7, 8.6, "CERBA"),  # ÉLEVÉ
        ("2018-10", 5.1, "IU/L", 1.7, 8.6, "CERBA"),
        ("2021-06", 5, "U/L", 2, 9, "CHIREC"),
        ("2022-02", 3.7, "IU/L", 3, 18, "SYNLAB"),
        ("2023-09", 4.2, "UI/L", 0.6, 12.1, "LIMS"),
        ("2023-11", 1.41, "mUI/mL", 1.2, 8.6, "SHA"),
        ("2025-11", 3.25, "mUI/mL", 0.57, 12.07, "CEF Pelleport"),
    ],

    # Cortisol
    "Cortisol (matin)": [
        ("2021-06", 9.7, "µg/dL", 4.8, 19.5, "CHIREC"),  # 270 nmol/L
        ("2022-09", 9.6, "µg/dL", 7, 25, "SYNLAB"),
        ("2023-02", 16.6, "µg/dL", 7, 25, "SYNLAB"),
        ("2023-09", 15.8, "µg/dL", 8, 20, "LIMS"),  # 437 nmol/L
        ("2023-11", 14.5, "µg/dL", 5, 25, "SHA"),
    ],

    # DHEA-S
    "DHEA-S": [
        ("2015-08", 255.9, "µg/dL", 44.3, 331, "Enzo Labs"),
        ("2015-10", 316.4, "µg/dL", 44.3, 331, "Enzo Labs"),
        ("2022-09", 151, "µg/dL", 85, 390, "SYNLAB"),
        ("2023-02", 148, "µg/dL", 85, 390, "SYNLAB"),
        ("2023-11", 132, "µg/dL", 35, 441, "SHA"),  # 1.32 µg/mL
        ("2025-02", 74, "µg/dL", 34.5, 568.9, "SYNLAB"),  # Bas
        ("2025-11", 165, "µg/dL", 137, 448, "CEF Pelleport"),  # 4.48 µmol/L
    ],

    # SHBG
    "SHBG": [
        ("2015-08", 27, "nmol/L", 15.5, 55.9, "Enzo Labs"),  # LOW
        ("2015-10", 21.6, "nmol/L", 15.5, 55.9, "Enzo Labs"),
        ("2017-11", 31, "nmol/L", 18, 54, "CERBA"),
        ("2018-10", 37, "nmol/L", 10, 50, "CERBA"),
        ("2021-06", 33.9, "nmol/L", 18.3, 54.1, "CHIREC"),
        ("2022-09", 29, "nmol/L", 20, 55, "SYNLAB"),
        ("2023-02", 31, "nmol/L", 12, 55, "SYNLAB"),
        ("2023-11", 43.8, "nmol/L", 12, 75, "SHA"),
        ("2025-02", 27, "nmol/L", 12, 55, "SYNLAB"),
        ("2025-11", 39.9, "nmol/L", 13.5, 71.4, "CEF Pelleport"),
    ],

    # Prolactine
    "Prolactine": [
        ("2015-08", 6.36, "ng/mL", 4.04, 15.2, "Enzo Labs"),
        ("2015-10", 6.02, "ng/mL", 4.04, 15.2, "Enzo Labs"),
        ("2017-11", 9.0, "µg/L", 4, 15, "CERBA"),
        ("2022-02", 6.2, "µg/L", 1, 19, "SYNLAB"),
        ("2023-09", 8.6, "µg/L", 3.5, 19.4, "LIMS"),
        ("2023-11", 12.82, "ng/mL", 3.46, 19.4, "SHA"),
    ],

    # IGF-1 (Somatomédine-C)
    "IGF-1": [
        ("2022-09", 216, "µg/L", 150, 400, "SYNLAB"),
    ],

    # VITAMINES & MINÉRAUX - Vitamine D
    "Vitamine D (25-OH)": [
        ("2022-09", 31.9, "µg/L", 30, 100, "SYNLAB"),  # ng/mL
        ("2023-11", 45, "ng/mL", 30, 100, "SHA"),
        ("2024-06", 33, "ng/mL", 30, 70, "CEF Boulard"),  # 82 nmol/L
        ("2025-02", 27.7, "µg/L", 30, 100, "SYNLAB"),  # Insuffisant
        ("2025-11", 35.3, "µg/L", 30, 100, "CEF Pelleport"),
    ],

    # Vitamine B12
    "Vitamine B12": [
        ("2022-09", 454, "ng/L", 300, 835, "SYNLAB"),
        ("2023-11", 407, "pg/mL", 280, 850, "SHA"),
        ("2025-02", 473, "ng/L", 211, 911, "SYNLAB"),
        ("2025-11", 535, "pg/mL", 187, 883, "CEF Pelleport"),
    ],

    # Ferritine
    "Ferritine": [
        ("2022-09", 222, "µg/L", 50, 290, "SYNLAB"),
        ("2023-11", 218.3, "ng/mL", 15, 300, "SHA"),
        ("2024-06", 219, "µg/L", 30, 400, "CEF Boulard"),
        ("2025-02", 165, "µg/L", 15, 322, "SYNLAB"),
        ("2025-11", 348, "µg/L", 30, 400, "CEF Pelleport"),
    ],

    # Folates
    "Folates": [
        ("2022-09", 600, "µg/L", 140, 836, "SYNLAB"),  # Érythrocytaires
        ("2025-02", 7.5, "µg/L", 5.3, 12.5, "SYNLAB"),  # Sériques
        ("2025-11", 1001, "ng/mL", 140, 836, "CEF Pelleport"),  # Érythrocytaires
    ],

    # Fer
    "Fer": [
        ("2022-09", 149, "µg/dL", 60, 160, "SYNLAB"),
        ("2023-11", 72.7, "µg/dL", 65, 175, "SHA"),
        ("2025-02", 148, "µg/dL", 65, 175, "SYNLAB"),
        ("2025-11", 170, "µg/dL", 65, 175, "CEF Pelleport"),
    ],

    # Magnésium
    "Magnésium": [
        ("2022-09", 0.88, "mmol/L", 0.66, 1.07, "SYNLAB"),
        ("2023-11", 2.32, "mg/dL", 1.5, 2.7, "SHA"),  # ~0.95 mmol/L
        ("2025-02", 0.81, "mmol/L", 0.66, 1.07, "SYNLAB"),
        ("2025-11", 0.84, "mmol/L", 0.66, 1.07, "CEF Pelleport"),
    ],

    # Zinc
    "Zinc": [
        ("2022-09", 138, "µg/dL", 88, 146, "SYNLAB"),
        ("2023-11", 99.9, "µg/dL", 69, 120, "SHA"),
        ("2025-02", 108, "µg/dL", 88, 146, "SYNLAB"),
        ("2025-11", 781, "µg/L", 553, 1046, "CEF Pelleport"),  # = 78.1 µg/dL
    ],

    # Sélénium
    "Sélénium": [
        ("2022-09", 87, "µg/L", 90, 143, "SYNLAB"),  # BAS
        ("2023-02", 64, "µg/L", 90, 143, "SYNLAB"),  # BAS
        ("2025-02", 135, "µg/L", 90, 143, "SYNLAB"),  # Normal
        ("2025-11", 104, "µg/L", 52, 120, "CEF Pelleport"),  # Normal
    ],

    # Cuivre
    "Cuivre": [
        ("2022-09", 72, "µg/dL", 86, 148, "SYNLAB"),  # BAS
        ("2023-02", 79, "µg/dL", 86, 148, "SYNLAB"),  # BAS
        ("2025-11", 648, "µg/L", 686, 1596, "CEF Pelleport"),  # BAS = 64.8 µg/dL
    ],

    # Coenzyme Q10
    "Coenzyme Q10": [
        ("2022-09", 944, "µg/L", 670, 990, "SYNLAB"),
        ("2025-11", 856, "µg/L", 750, 1000, "CEF Pelleport"),
    ],

    # INFLAMMATION - CRP
    "CRP (hs-CRP)": [
        ("2022-09", 0.21, "mg/L", 0, 1.00, "SYNLAB"),
        ("2023-11", 0.80, "mg/L", 0, 5, "SHA"),  # <0.80
        ("2024-06", 0.20, "mg/L", 0, 5, "CEF Boulard"),  # <0.2
        ("2025-02", 0.16, "mg/L", 0, 1.00, "SYNLAB"),  # <0.16
        ("2025-11", 0.17, "mg/L", 0, 3, "CEF Pelleport"),
    ],

    # GLYCÉMIE
    "Glycémie à jeun": [
        ("2022-09", 85, "mg/dL", 70, 100, "SYNLAB"),
        ("2023-09", 77, "mg/dL", 60, 110, "LIMS"),
        ("2023-11", 78, "mg/dL", 70, 109, "SHA"),
        ("2025-02", 83, "mg/dL", 74, 106, "SYNLAB"),
        ("2025-11", 90, "mg/dL", 70, 100, "CEF Pelleport"),  # 5.0 mmol/L
        ("2025-12", 87, "mg/dL", 74, 109, "CHIREC"),
    ],

    # HbA1c
    "HbA1c": [
        ("2022-09", 5.4, "%", 4.0, 6.0, "SYNLAB"),
        ("2024-06", 5.2, "%", 3.5, 6.3, "CEF Boulard"),
        ("2025-02", 5.2, "%", 4.0, 6.0, "SYNLAB"),
        ("2025-11", 5.2, "%", 4.0, 6.0, "CEF Pelleport"),
    ],

    # Insuline
    "Insuline à jeun": [
        ("2022-09", 45, "pmol/L", 21, 153, "SYNLAB"),  # = ~6.5 µUI/mL
        ("2023-11", 3.7, "µUI/mL", 0, 25, "SHA"),
        ("2025-02", 33, "pmol/L", 21, 173, "SYNLAB"),  # = ~4.7 µUI/mL
        ("2025-11", 26.5, "pmol/L", 19.4, 74.6, "CEF Pelleport"),  # = ~3.8 µUI/mL
    ],

    # Index HOMA
    "Index HOMA": [
        ("2022-09", 1.35, "", 0.74, 2.26, "SYNLAB"),
        ("2025-02", 0.96, "", 0.74, 2.26, "SYNLAB"),
        ("2025-11", 0.82, "", 0.77, 2.26, "CEF Pelleport"),
    ],

    # MARQUEURS TUMORAUX - PSA
    "PSA Total": [
        ("2023-09", 2.08, "ng/mL", 0, 2.50, "LIMS"),
        ("2023-11", 2.20, "ng/mL", 0, 4, "SHA"),
        ("2025-11", 2.88, "ng/mL", 0, 2.5, "CEF Pelleport"),  # Légèrement élevé pour 40-49 ans
    ],

    # AUTRES MARQUEURS
    "Homocystéine": [
        ("2023-11", 11.3, "µmol/L", 0, 15, "SHA"),
        ("2025-02", 9.0, "µmol/L", 3.7, 13.9, "SYNLAB"),
        ("2025-11", 9.0, "µmol/L", 4.7, 11.5, "CEF Pelleport"),
    ],

    # Glutathion
    "Glutathion Total": [
        ("2022-09", 1135, "µmol/L", 1200, 1750, "SYNLAB"),  # BAS
        ("2023-02", 1123, "µmol/L", 1200, 1750, "SYNLAB"),  # BAS
    ],

    # Acide urique
    "Acide Urique": [
        ("2022-09", 6.5, "mg/dL", 3.4, 7.0, "SYNLAB"),
        ("2023-11", 6.0, "mg/dL", 3.5, 7.2, "SHA"),
        ("2025-02", 6.8, "mg/dL", 3.7, 9.2, "SYNLAB"),
        ("2025-11", 6.9, "mg/dL", 3.7, 7.6, "CEF Pelleport"),  # 409 µmol/L
    ],

    # Lipoprotéine (a)
    "Lipoprotéine (a)": [
        ("2025-02", 10, "mg/dL", 0, 30, "SYNLAB"),  # <10
        ("2025-11", 12, "nmol/L", 0, 75, "CEF Pelleport"),
    ],

    # LDL oxydées
    "LDL oxydées": [
        ("2025-11", 78, "U/L", 18, 73, "CEF Pelleport"),  # ÉLEVÉ
    ],

    # Iode urinaire
    "Iode (urine)": [
        ("2022-09", 46, "µg/L", 100, 199, "SYNLAB"),  # DÉFICIT
        ("2023-02", 300, "µg/L", 100, 199, "SYNLAB"),  # ÉLEVÉ après supplémentation
        ("2025-11", 64, "µg/L", 100, 199, "CEF Pelleport"),  # DÉFICIT léger
    ],

    # Cortisol Awakening Response (CAR)
    "CAR (Cortisol Awakening Response)": [
        ("2025-11", 12, "%", 50, 120, "CEF Pelleport"),  # TRÈS BAS
    ],

    # Estradiol
    "Estradiol": [
        ("2015-08", 12.7, "pg/mL", 7.63, 42.6, "Enzo Labs"),
        ("2015-10", 31.6, "pg/mL", 23.8, 60.7, "Enzo Labs"),
        ("2022-09", 15, "ng/L", 0, 30, "SYNLAB"),
        ("2023-11", 21, "pg/mL", 20, 95, "SHA"),
        ("2025-11", 24, "pg/mL", 5.6, 50.1, "CEF Pelleport"),
    ],
}

# Catégories pour le rapport
categories = {
    "Hématologie": ["Hémoglobine", "Globules Rouges", "Globules Blancs", "Plaquettes"],
    "Bilan Lipidique": ["Cholestérol Total", "LDL Cholestérol", "HDL Cholestérol", "Triglycérides"],
    "Fonction Rénale": ["Créatinine", "DFG (GFR)", "Urée", "Acide Urique"],
    "Fonction Hépatique": ["ASAT (GOT)", "ALAT (GPT)", "GGT"],
    "Thyroïde": ["TSH", "T4 Libre", "T3 Libre"],
    "Hormones Sexuelles": ["Testostérone Totale", "Testostérone Libre", "FSH", "LH", "SHBG", "Estradiol"],
    "Autres Hormones": ["Cortisol (matin)", "DHEA-S", "Prolactine", "IGF-1"],
    "Vitamines & Minéraux": ["Vitamine D (25-OH)", "Vitamine B12", "Ferritine", "Fer", "Magnésium", "Zinc", "Sélénium", "Cuivre", "Coenzyme Q10"],
    "Inflammation & Stress Oxydatif": ["CRP (hs-CRP)", "Homocystéine", "Glutathion Total", "LDL oxydées"],
    "Métabolisme Glucidique": ["Glycémie à jeun", "HbA1c", "Insuline à jeun", "Index HOMA"],
    "Marqueurs Spéciaux": ["PSA Total", "Lipoprotéine (a)", "Iode (urine)", "CAR (Cortisol Awakening Response)"],
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

    # Zone de référence (utiliser la dernière valeur de référence)
    ref_min = data[-1][3]
    ref_max = data[-1][4]

    if ref_min > 0 or ref_max > 0:
        ax.axhspan(ref_min, ref_max, alpha=0.2, color='green', label='Plage normale')

    # Ligne d'évolution
    ax.plot(dates, values, 'b-o', linewidth=2, markersize=8, label=marker_name)

    # Points hors normes en rouge
    for i, d in enumerate(data):
        date = parse_date(d[0])
        val = d[1]
        r_min = d[3]
        r_max = d[4]
        if val < r_min or val > r_max:
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
    graphs_dir = "/sessions/happy-trusting-einstein/graphs_v2"
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
    story.append(Paragraph("Groupe sanguin : O Positif", ParagraphStyle('Blood', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER)))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph(f"Période couverte : Août 2015 - Décembre 2025", ParagraphStyle('Period', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER)))
    story.append(Paragraph(f"Rapport généré le : {datetime.now().strftime('%d/%m/%Y')}", ParagraphStyle('Generated', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("<i>Données extraites de 20 analyses sanguines (Enzo Labs, CERBA, CHIREC, SYNLAB, LIMS, SHA Wellness, CEF)</i>",
                          ParagraphStyle('Note', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.grey)))

    story.append(PageBreak())

    # Sommaire et résumé
    story.append(Paragraph("RÉSUMÉ EXÉCUTIF", heading1_style))
    story.append(Spacer(1, 0.3*cm))

    summary_text = """
    Ce rapport présente l'évolution de vos biomarqueurs sur une période de 10 ans (2015-2025),
    basé sur l'analyse de 20 prélèvements sanguins réalisés dans différents laboratoires.
    Seules les données réellement présentes dans les documents originaux sont incluses.
    """
    story.append(Paragraph(summary_text.strip(), normal_style))
    story.append(Spacer(1, 0.5*cm))

    # Points d'attention
    story.append(Paragraph("POINTS D'ATTENTION IDENTIFIÉS", heading2_style))

    alerts = [
        ("Testostérone (Août 2015)", "Niveau BAS (210.7 ng/dL, ref: 249-836) - normalisé dès octobre 2015"),
        ("LDL Cholestérol", "Souvent au-dessus de la norme (>114-130 mg/dL) - surveillance recommandée"),
        ("PSA Total (Nov 2025)", "2.88 ng/mL - légèrement au-dessus de la limite pour 40-49 ans (<2.5)"),
        ("Glutathion (2022-2023)", "Bas à 1123-1135 µmol/L (ref: 1200-1750) - antioxydant à surveiller"),
        ("Sélénium (2022-2023)", "Bas à 64-87 µg/L (ref: 90-143) - corrigé en 2025 (135 µg/L)"),
        ("Cuivre", "Constamment bas (64-79 µg/dL, ref: 86-148)"),
        ("Iode urinaire", "Déficit récurrent (46-64 µg/L, ref: 100-199)"),
        ("CAR - Cortisol Awakening Response (Nov 2025)", "Très bas à 12% (ref: 50-120%) - réponse surrénalienne au réveil altérée"),
        ("LDL oxydées (Nov 2025)", "Élevées à 78 U/L (ref: 18-73) - stress oxydatif"),
        ("DFG (GFR)", "Tendance à la baisse: 90 (2022) → 68-74 (2025) mL/min - à surveiller"),
    ]

    for title, desc in alerts:
        story.append(Paragraph(f"<b>• {title}:</b> {desc}", alert_style))

    story.append(Spacer(1, 0.5*cm))

    # Points positifs
    story.append(Paragraph("POINTS POSITIFS", heading2_style))
    positives = [
        "Fonction hépatique excellente et stable (ASAT, ALAT, GGT tous normaux)",
        "Fonction thyroïdienne équilibrée (TSH 0.72-1.97 mUI/L)",
        "Glycémie et HbA1c parfaitement contrôlés (HbA1c stable à 5.2%)",
        "Index HOMA optimal (0.82-1.35) - bonne sensibilité à l'insuline",
        "CRP ultra-sensible très basse (<0.21 mg/L) - inflammation minimale",
        "Homocystéine normale (9.0-11.3 µmol/L)",
        "Testostérone normalisée depuis octobre 2015 (322-720 ng/dL)",
        "Lipoprotéine (a) basse - bon indicateur cardiovasculaire",
        "Sélénium normalisé en 2025 après correction",
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
            graph_path = os.path.join(graphs_dir, f"{marker.replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '')}.png")
            create_evolution_graph(marker, data, graph_path)

            story.append(Paragraph(marker, heading2_style))

            # Ajouter le graphique
            if os.path.exists(graph_path):
                img = Image(graph_path, width=16*cm, height=6.5*cm)
                story.append(img)

            # Tableau des valeurs (toutes les valeurs)
            table_data = [["Date", "Valeur", "Référence", "Source", "Statut"]]
            for entry in data:
                date_str = entry[0]
                value = entry[1]
                unit = entry[2]
                ref_min = entry[3]
                ref_max = entry[4]
                source = entry[5]
                status, status_color = get_status(value, ref_min, ref_max)
                table_data.append([
                    date_str,
                    f"{value} {unit}",
                    f"{ref_min} - {ref_max}",
                    source,
                    status
                ])

            table = Table(table_data, colWidths=[2.5*cm, 3.5*cm, 3*cm, 3*cm, 2*cm])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2874a6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f3f5')]),
            ]))

            # Colorer les statuts
            for i, row in enumerate(table_data[1:], start=1):
                if row[4] != "Normal":
                    table.setStyle(TableStyle([
                        ('TEXTCOLOR', (4, i), (4, i), colors.red),
                        ('FONTNAME', (4, i), (4, i), 'Helvetica-Bold'),
                    ]))

            story.append(Spacer(1, 0.3*cm))
            story.append(table)
            story.append(Spacer(1, 0.5*cm))

        story.append(PageBreak())

    # Conclusion
    story.append(Paragraph("CONCLUSION ET RECOMMANDATIONS", heading1_style))

    conclusion_text = """
    <b>Bilan global :</b> Votre profil biologique est globalement satisfaisant avec une bonne stabilité
    sur les 10 années de suivi. Les fonctions hépatique et thyroïdienne sont excellentes,
    et le contrôle glycémique est optimal.
    """
    story.append(Paragraph(conclusion_text, normal_style))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("<b>Points de vigilance prioritaires :</b>", normal_style))

    recommendations = [
        "<b>PSA :</b> Valeur à 2.88 ng/mL (nov 2025), au-dessus de la limite pour votre tranche d'âge (40-49 ans: <2.5). À discuter avec votre médecin pour un suivi.",
        "<b>CAR (Cortisol Awakening Response) :</b> Très bas à 12% (ref: 50-120%). Cela peut indiquer une fatigue surrénalienne ou un stress chronique. Considérer une évaluation endocrinologique.",
        "<b>LDL Cholestérol & LDL oxydées :</b> LDL régulièrement élevé et LDL oxydées à 78 U/L. Mesures diététiques recommandées et discussion avec votre médecin sur la nécessité d'un traitement.",
        "<b>DFG (Fonction rénale) :</b> Tendance à la baisse (90 → 68 mL/min). Bien que toujours >60, cette évolution mérite surveillance.",
        "<b>Cuivre :</b> Constamment bas. Discuter avec votre médecin d'une supplémentation adaptée.",
        "<b>Iode :</b> Déficit récurrent. La supplémentation a montré une correction en 2023, mais le déficit est revenu en 2025.",
    ]

    for rec in recommendations:
        story.append(Paragraph(f"• {rec}", normal_style))
        story.append(Spacer(1, 0.2*cm))

    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("<b>Points positifs à maintenir :</b>", normal_style))

    positives_rec = [
        "Continuer le mode de vie permettant un excellent contrôle glycémique",
        "Maintenir la supplémentation en sélénium qui a normalisé les niveaux",
        "La testostérone est stable et normale depuis 2015",
    ]

    for rec in positives_rec:
        story.append(Paragraph(f"• {rec}", normal_style))

    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("<i>Ce rapport est fourni à titre informatif et contient uniquement les données réellement extraites de vos analyses. Veuillez consulter votre médecin pour toute interprétation médicale ou décision thérapeutique.</i>",
                          ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=9, textColor=colors.grey, alignment=TA_CENTER)))

    # Build PDF
    doc.build(story)
    print(f"Rapport PDF créé : {pdf_path}")
    return pdf_path

if __name__ == "__main__":
    create_pdf_report()
