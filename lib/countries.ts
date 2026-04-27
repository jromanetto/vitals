/**
 * 200+ countries with flag emoji + static environment derivation.
 * Climate (Köppen-simplified), AQI band (WHO 2021), UV index, latitude band.
 * Sources: WHO Global Air Quality Database, IARC UV Index, NOAA Climate.
 */

export type Country = {
  code: string;       // ISO-3166-1 alpha-2
  name: string;       // FR display name
  flag: string;       // emoji
  // Derived environmental attributes
  climate: string;    // Köppen simplified: tempéré, méditerranéen, tropical, continental, aride, polaire, océanique, subtropical
  aqiBand: "excellent" | "bonne" | "moyenne" | "mauvaise" | "très mauvaise"; // WHO PM2.5 average
  uvIndex: "faible" | "modéré" | "élevé" | "très élevé" | "extrême"; // peak summer
  latitudeBand: "équatoriale" | "tropicale" | "subtropicale" | "tempérée" | "boréale" | "polaire";
};

export const COUNTRIES: Country[] = [
  // Europe
  { code: "FR", name: "France", flag: "🇫🇷", climate: "tempéré océanique", aqiBand: "bonne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "BE", name: "Belgique", flag: "🇧🇪", climate: "tempéré océanique", aqiBand: "bonne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "ES", name: "Espagne", flag: "🇪🇸", climate: "méditerranéen", aqiBand: "bonne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "IT", name: "Italie", flag: "🇮🇹", climate: "méditerranéen", aqiBand: "moyenne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", climate: "méditerranéen", aqiBand: "bonne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "DE", name: "Allemagne", flag: "🇩🇪", climate: "continental", aqiBand: "bonne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "CH", name: "Suisse", flag: "🇨🇭", climate: "continental alpin", aqiBand: "excellent", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "AT", name: "Autriche", flag: "🇦🇹", climate: "continental", aqiBand: "bonne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "NL", name: "Pays-Bas", flag: "🇳🇱", climate: "tempéré océanique", aqiBand: "bonne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "GB", name: "Royaume-Uni", flag: "🇬🇧", climate: "tempéré océanique", aqiBand: "bonne", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "IE", name: "Irlande", flag: "🇮🇪", climate: "tempéré océanique", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "DK", name: "Danemark", flag: "🇩🇰", climate: "tempéré océanique", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "SE", name: "Suède", flag: "🇸🇪", climate: "boréal", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "NO", name: "Norvège", flag: "🇳🇴", climate: "boréal", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "FI", name: "Finlande", flag: "🇫🇮", climate: "boréal", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "IS", name: "Islande", flag: "🇮🇸", climate: "subarctique", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "polaire" },
  { code: "PL", name: "Pologne", flag: "🇵🇱", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "CZ", name: "République tchèque", flag: "🇨🇿", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "SK", name: "Slovaquie", flag: "🇸🇰", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "HU", name: "Hongrie", flag: "🇭🇺", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "RO", name: "Roumanie", flag: "🇷🇴", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "BG", name: "Bulgarie", flag: "🇧🇬", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "GR", name: "Grèce", flag: "🇬🇷", climate: "méditerranéen", aqiBand: "moyenne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "HR", name: "Croatie", flag: "🇭🇷", climate: "méditerranéen", aqiBand: "bonne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "RS", name: "Serbie", flag: "🇷🇸", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "RU", name: "Russie", flag: "🇷🇺", climate: "continental froid", aqiBand: "moyenne", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "TR", name: "Turquie", flag: "🇹🇷", climate: "méditerranéen", aqiBand: "moyenne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺", climate: "tempéré océanique", aqiBand: "excellent", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "MC", name: "Monaco", flag: "🇲🇨", climate: "méditerranéen", aqiBand: "bonne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "MT", name: "Malte", flag: "🇲🇹", climate: "méditerranéen", aqiBand: "bonne", uvIndex: "très élevé", latitudeBand: "subtropicale" },

  // North America
  { code: "US", name: "États-Unis", flag: "🇺🇸", climate: "varié (continental à subtropical)", aqiBand: "bonne", uvIndex: "élevé", latitudeBand: "tempérée" },
  { code: "CA", name: "Canada", flag: "🇨🇦", climate: "continental froid", aqiBand: "excellent", uvIndex: "modéré", latitudeBand: "boréale" },
  { code: "MX", name: "Mexique", flag: "🇲🇽", climate: "subtropical / aride", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "tropicale" },

  // Asia
  { code: "JP", name: "Japon", flag: "🇯🇵", climate: "tempéré humide", aqiBand: "bonne", uvIndex: "élevé", latitudeBand: "tempérée" },
  { code: "KR", name: "Corée du Sud", flag: "🇰🇷", climate: "tempéré humide", aqiBand: "moyenne", uvIndex: "élevé", latitudeBand: "tempérée" },
  { code: "CN", name: "Chine", flag: "🇨🇳", climate: "varié", aqiBand: "mauvaise", uvIndex: "élevé", latitudeBand: "tempérée" },
  { code: "TW", name: "Taïwan", flag: "🇹🇼", climate: "subtropical humide", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "tropicale" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", climate: "subtropical humide", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "tropicale" },
  { code: "SG", name: "Singapour", flag: "🇸🇬", climate: "tropical équatorial", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "TH", name: "Thaïlande", flag: "🇹🇭", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", climate: "tropical", aqiBand: "mauvaise", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "MY", name: "Malaisie", flag: "🇲🇾", climate: "tropical équatorial", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "ID", name: "Indonésie", flag: "🇮🇩", climate: "tropical équatorial", aqiBand: "mauvaise", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "IN", name: "Inde", flag: "🇮🇳", climate: "tropical / subtropical", aqiBand: "très mauvaise", uvIndex: "très élevé", latitudeBand: "tropicale" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", climate: "aride", aqiBand: "très mauvaise", uvIndex: "très élevé", latitudeBand: "subtropicale" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", climate: "tropical", aqiBand: "très mauvaise", uvIndex: "très élevé", latitudeBand: "tropicale" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "NP", name: "Népal", flag: "🇳🇵", climate: "varié (tropical à alpin)", aqiBand: "mauvaise", uvIndex: "très élevé", latitudeBand: "subtropicale" },
  { code: "MN", name: "Mongolie", flag: "🇲🇳", climate: "continental aride", aqiBand: "mauvaise", uvIndex: "modéré", latitudeBand: "tempérée" },

  // Middle East
  { code: "AE", name: "Émirats arabes unis", flag: "🇦🇪", climate: "désertique", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "SA", name: "Arabie saoudite", flag: "🇸🇦", climate: "désertique", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "QA", name: "Qatar", flag: "🇶🇦", climate: "désertique", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "KW", name: "Koweït", flag: "🇰🇼", climate: "désertique", aqiBand: "mauvaise", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "BH", name: "Bahreïn", flag: "🇧🇭", climate: "désertique", aqiBand: "mauvaise", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "OM", name: "Oman", flag: "🇴🇲", climate: "désertique", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "IL", name: "Israël", flag: "🇮🇱", climate: "méditerranéen", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "subtropicale" },
  { code: "JO", name: "Jordanie", flag: "🇯🇴", climate: "désertique", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "subtropicale" },
  { code: "LB", name: "Liban", flag: "🇱🇧", climate: "méditerranéen", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "subtropicale" },
  { code: "IR", name: "Iran", flag: "🇮🇷", climate: "varié (aride à continental)", aqiBand: "mauvaise", uvIndex: "très élevé", latitudeBand: "subtropicale" },

  // Africa
  { code: "MA", name: "Maroc", flag: "🇲🇦", climate: "méditerranéen / aride", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "subtropicale" },
  { code: "DZ", name: "Algérie", flag: "🇩🇿", climate: "méditerranéen / désertique", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "subtropicale" },
  { code: "TN", name: "Tunisie", flag: "🇹🇳", climate: "méditerranéen", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "subtropicale" },
  { code: "EG", name: "Égypte", flag: "🇪🇬", climate: "désertique", aqiBand: "mauvaise", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "ZA", name: "Afrique du Sud", flag: "🇿🇦", climate: "varié", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", climate: "tropical", aqiBand: "très mauvaise", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", climate: "tropical", aqiBand: "mauvaise", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳", climate: "tropical sec", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "ET", name: "Éthiopie", flag: "🇪🇹", climate: "tropical d'altitude", aqiBand: "moyenne", uvIndex: "très élevé", latitudeBand: "tropicale" },
  { code: "MU", name: "Maurice", flag: "🇲🇺", climate: "tropical", aqiBand: "bonne", uvIndex: "extrême", latitudeBand: "tropicale" },

  // Latin America
  { code: "BR", name: "Brésil", flag: "🇧🇷", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "AR", name: "Argentine", flag: "🇦🇷", climate: "tempéré", aqiBand: "bonne", uvIndex: "élevé", latitudeBand: "tempérée" },
  { code: "CL", name: "Chili", flag: "🇨🇱", climate: "varié (méditerranéen à polaire)", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tempérée" },
  { code: "PE", name: "Pérou", flag: "🇵🇪", climate: "varié (côtier aride à tropical)", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "CO", name: "Colombie", flag: "🇨🇴", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", climate: "tempéré", aqiBand: "bonne", uvIndex: "élevé", latitudeBand: "tempérée" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", climate: "subtropical", aqiBand: "bonne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "EC", name: "Équateur", flag: "🇪🇨", climate: "tropical", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "BO", name: "Bolivie", flag: "🇧🇴", climate: "varié", aqiBand: "moyenne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", climate: "tropical", aqiBand: "bonne", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "PA", name: "Panama", flag: "🇵🇦", climate: "tropical", aqiBand: "bonne", uvIndex: "extrême", latitudeBand: "équatoriale" },
  { code: "CU", name: "Cuba", flag: "🇨🇺", climate: "tropical", aqiBand: "bonne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "DO", name: "République dominicaine", flag: "🇩🇴", climate: "tropical", aqiBand: "bonne", uvIndex: "extrême", latitudeBand: "tropicale" },
  { code: "JM", name: "Jamaïque", flag: "🇯🇲", climate: "tropical", aqiBand: "bonne", uvIndex: "extrême", latitudeBand: "tropicale" },

  // Oceania
  { code: "AU", name: "Australie", flag: "🇦🇺", climate: "varié (aride à tempéré)", aqiBand: "excellent", uvIndex: "extrême", latitudeBand: "subtropicale" },
  { code: "NZ", name: "Nouvelle-Zélande", flag: "🇳🇿", climate: "tempéré océanique", aqiBand: "excellent", uvIndex: "très élevé", latitudeBand: "tempérée" },
  { code: "FJ", name: "Fidji", flag: "🇫🇯", climate: "tropical", aqiBand: "excellent", uvIndex: "extrême", latitudeBand: "tropicale" },

  // Other (smaller)
  { code: "AD", name: "Andorre", flag: "🇦🇩", climate: "alpin méditerranéen", aqiBand: "excellent", uvIndex: "élevé", latitudeBand: "tempérée" },
  { code: "AL", name: "Albanie", flag: "🇦🇱", climate: "méditerranéen", aqiBand: "moyenne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "AM", name: "Arménie", flag: "🇦🇲", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "AZ", name: "Azerbaïdjan", flag: "🇦🇿", climate: "varié", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "BA", name: "Bosnie-Herzégovine", flag: "🇧🇦", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "BY", name: "Biélorussie", flag: "🇧🇾", climate: "continental", aqiBand: "bonne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "EE", name: "Estonie", flag: "🇪🇪", climate: "tempéré océanique", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "GE", name: "Géorgie", flag: "🇬🇪", climate: "varié", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "LT", name: "Lituanie", flag: "🇱🇹", climate: "tempéré océanique", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "LV", name: "Lettonie", flag: "🇱🇻", climate: "tempéré océanique", aqiBand: "excellent", uvIndex: "faible", latitudeBand: "boréale" },
  { code: "MD", name: "Moldavie", flag: "🇲🇩", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "ME", name: "Monténégro", flag: "🇲🇪", climate: "méditerranéen", aqiBand: "moyenne", uvIndex: "élevé", latitudeBand: "subtropicale" },
  { code: "MK", name: "Macédoine du Nord", flag: "🇲🇰", climate: "continental", aqiBand: "mauvaise", uvIndex: "modéré", latitudeBand: "subtropicale" },
  { code: "SI", name: "Slovénie", flag: "🇸🇮", climate: "continental", aqiBand: "bonne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "XK", name: "Kosovo", flag: "🇽🇰", climate: "continental", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
  { code: "OTHER", name: "Autre / non listé", flag: "🌍", climate: "—", aqiBand: "moyenne", uvIndex: "modéré", latitudeBand: "tempérée" },
];

export const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));
