// Liste ICD-10 simplifiée FR — pathologies chroniques les plus communes
// Pour autocomplete dans le composant chronic-conditions
export const ICD10_FR: { code: string; label: string; category: string }[] = [
  // Cardio-métabolique
  { code: 'I10', label: 'Hypertension artérielle (HTA)', category: 'Cardio' },
  { code: 'E10', label: 'Diabète type 1', category: 'Métabolique' },
  { code: 'E11', label: 'Diabète type 2', category: 'Métabolique' },
  { code: 'E78.0', label: 'Hypercholestérolémie pure', category: 'Métabolique' },
  { code: 'E78.5', label: 'Dyslipidémie', category: 'Métabolique' },
  { code: 'E78.01', label: 'Hypercholestérolémie familiale', category: 'Métabolique' },
  { code: 'E66', label: 'Obésité', category: 'Métabolique' },
  { code: 'E88.81', label: 'Syndrome métabolique', category: 'Métabolique' },
  { code: 'I25', label: 'Maladie coronarienne chronique', category: 'Cardio' },
  { code: 'I48', label: 'Fibrillation auriculaire', category: 'Cardio' },
  { code: 'I50', label: 'Insuffisance cardiaque', category: 'Cardio' },
  { code: 'I82', label: 'Thrombose veineuse', category: 'Cardio' },
  { code: 'I83', label: 'Varices', category: 'Cardio' },

  // Endocrinien
  { code: 'E03', label: 'Hypothyroïdie', category: 'Endocrinien' },
  { code: 'E05', label: 'Hyperthyroïdie', category: 'Endocrinien' },
  { code: 'E06.3', label: 'Thyroïdite de Hashimoto', category: 'Endocrinien' },
  { code: 'E05.0', label: 'Maladie de Basedow', category: 'Endocrinien' },
  { code: 'E28.2', label: 'Syndrome des ovaires polykystiques (SOPK)', category: 'Endocrinien' },
  { code: 'E27', label: 'Insuffisance surrénalienne', category: 'Endocrinien' },
  { code: 'E83.110', label: 'Hémochromatose héréditaire', category: 'Endocrinien' },

  // Respiratoire
  { code: 'J45', label: 'Asthme', category: 'Respiratoire' },
  { code: 'J44', label: 'BPCO', category: 'Respiratoire' },
  { code: 'J30', label: 'Rhinite allergique', category: 'Respiratoire' },
  { code: 'G47.33', label: 'Apnée obstructive du sommeil', category: 'Respiratoire' },
  { code: 'J84', label: 'Fibrose pulmonaire', category: 'Respiratoire' },

  // Digestif
  { code: 'K21', label: 'Reflux gastro-œsophagien (RGO)', category: 'Digestif' },
  { code: 'K58', label: 'Syndrome du côlon irritable (SII)', category: 'Digestif' },
  { code: 'K50', label: 'Maladie de Crohn', category: 'Digestif' },
  { code: 'K51', label: 'Rectocolite hémorragique', category: 'Digestif' },
  { code: 'K90.0', label: 'Maladie cœliaque', category: 'Digestif' },
  { code: 'K29', label: 'Gastrite chronique', category: 'Digestif' },
  { code: 'K80', label: 'Calculs biliaires (vésicule)', category: 'Digestif' },
  { code: 'K76.0', label: 'Stéatose hépatique (NAFLD)', category: 'Digestif' },
  { code: 'B18.1', label: 'Hépatite B chronique', category: 'Digestif' },
  { code: 'B18.2', label: 'Hépatite C chronique', category: 'Digestif' },
  { code: 'K57', label: 'Diverticulose', category: 'Digestif' },

  // Rénal / urinaire
  { code: 'N20', label: 'Calculs rénaux', category: 'Rénal' },
  { code: 'N18', label: 'Maladie rénale chronique', category: 'Rénal' },
  { code: 'N40', label: 'Hyperplasie bénigne de la prostate', category: 'Rénal' },
  { code: 'N39.0', label: 'Infections urinaires récurrentes', category: 'Rénal' },

  // Neuro
  { code: 'G43', label: 'Migraine', category: 'Neuro' },
  { code: 'G44', label: 'Céphalées de tension', category: 'Neuro' },
  { code: 'G40', label: 'Épilepsie', category: 'Neuro' },
  { code: 'G35', label: 'Sclérose en plaques', category: 'Neuro' },
  { code: 'G20', label: 'Maladie de Parkinson', category: 'Neuro' },
  { code: 'G30', label: 'Maladie d\'Alzheimer', category: 'Neuro' },
  { code: 'G47.0', label: 'Insomnie chronique', category: 'Neuro' },
  { code: 'G47.4', label: 'Narcolepsie', category: 'Neuro' },

  // Santé mentale
  { code: 'F32', label: 'Dépression', category: 'Mental' },
  { code: 'F33', label: 'Trouble dépressif récurrent', category: 'Mental' },
  { code: 'F41.1', label: 'Anxiété généralisée', category: 'Mental' },
  { code: 'F41.0', label: 'Trouble panique', category: 'Mental' },
  { code: 'F42', label: 'TOC (trouble obsessionnel compulsif)', category: 'Mental' },
  { code: 'F43.1', label: 'TSPT (stress post-traumatique)', category: 'Mental' },
  { code: 'F31', label: 'Trouble bipolaire', category: 'Mental' },
  { code: 'F90', label: 'TDAH', category: 'Mental' },
  { code: 'F84.0', label: 'Trouble du spectre autistique', category: 'Mental' },
  { code: 'F50', label: 'Trouble du comportement alimentaire', category: 'Mental' },

  // Musculo-squelettique / rhumato
  { code: 'M19', label: 'Arthrose', category: 'Rhumato' },
  { code: 'M06', label: 'Polyarthrite rhumatoïde', category: 'Rhumato' },
  { code: 'M10', label: 'Goutte', category: 'Rhumato' },
  { code: 'M79.7', label: 'Fibromyalgie', category: 'Rhumato' },
  { code: 'M81', label: 'Ostéoporose', category: 'Rhumato' },
  { code: 'M54', label: 'Lombalgie chronique', category: 'Rhumato' },
  { code: 'M45', label: 'Spondylarthrite ankylosante', category: 'Rhumato' },
  { code: 'M32', label: 'Lupus érythémateux disséminé', category: 'Rhumato' },

  // Dermato
  { code: 'L40', label: 'Psoriasis', category: 'Dermato' },
  { code: 'L20', label: 'Eczéma / dermatite atopique', category: 'Dermato' },
  { code: 'L70', label: 'Acné', category: 'Dermato' },
  { code: 'L71', label: 'Rosacée', category: 'Dermato' },
  { code: 'L80', label: 'Vitiligo', category: 'Dermato' },

  // Gynéco
  { code: 'N80', label: 'Endométriose', category: 'Gynéco' },
  { code: 'N92', label: 'Règles abondantes / irrégulières', category: 'Gynéco' },
  { code: 'N95', label: 'Troubles de la ménopause', category: 'Gynéco' },
  { code: 'D25', label: 'Fibrome utérin', category: 'Gynéco' },

  // Infectieux / immunité
  { code: 'A69.2', label: 'Maladie de Lyme', category: 'Infectieux' },
  { code: 'B27', label: 'Mononucléose (EBV)', category: 'Infectieux' },
  { code: 'U09.9', label: 'COVID long', category: 'Infectieux' },
  { code: 'B20', label: 'VIH', category: 'Infectieux' },
  { code: 'D84.9', label: 'Déficit immunitaire', category: 'Infectieux' },

  // Cancer (historique)
  { code: 'Z85', label: 'Antécédent personnel de cancer', category: 'Oncologie' },

  // Yeux / ORL
  { code: 'H40', label: 'Glaucome', category: 'Yeux/ORL' },
  { code: 'H25', label: 'Cataracte', category: 'Yeux/ORL' },
  { code: 'H93.1', label: 'Acouphènes', category: 'Yeux/ORL' },
  { code: 'H81', label: 'Vertiges (Ménière, VPPB)', category: 'Yeux/ORL' },
];

export const ICD10_LABELS = ICD10_FR.map((c) => c.label);
