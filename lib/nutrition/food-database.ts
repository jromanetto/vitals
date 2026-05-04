import type { Food } from "./types";

// ~150 foods curated for actionable nutrition recommendations.
// Tags are intentional: each food can be referenced by biomarker/SNP rules via slug.

export const FOODS: Food[] = [
  // === Protein animal ===
  { slug: "beef-grass-fed", label: "Bœuf nourri à l'herbe", emoji: "🥩", category: "protein-animal", tags: ["iron-heme", "vitamin-b12", "zinc", "saturated-fat"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "beef-conventional", label: "Bœuf industriel", emoji: "🥩", category: "protein-animal", tags: ["iron-heme", "saturated-fat"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "lamb", label: "Agneau", emoji: "🐑", category: "protein-animal", tags: ["iron-heme", "vitamin-b12", "zinc", "saturated-fat"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "veal", label: "Veau", emoji: "🥩", category: "protein-animal", tags: ["iron-heme", "vitamin-b12"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "pork", label: "Porc", emoji: "🐖", category: "protein-animal", tags: ["saturated-fat"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "chicken-pasture", label: "Poulet fermier", emoji: "🍗", category: "protein-animal", tags: [], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "turkey", label: "Dinde", emoji: "🦃", category: "protein-animal", tags: [], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "liver-beef", label: "Foie de bœuf", emoji: "🫀", category: "protein-animal", tags: ["iron-heme", "vitamin-b12", "folate", "choline"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "liver-chicken", label: "Foie de volaille", emoji: "🫀", category: "protein-animal", tags: ["iron-heme", "vitamin-b12", "folate", "choline"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "bone-broth", label: "Bouillon d'os", emoji: "🍲", category: "protein-animal", tags: [], excludedFor: ["vegan", "vegetarian"] },
  { slug: "egg-pasture", label: "Œufs plein air", emoji: "🥚", category: "protein-animal", tags: ["choline", "vitamin-b12", "vitamin-d"], excludedFor: ["vegan"] },
  { slug: "egg-yolk", label: "Jaune d'œuf", emoji: "🟡", category: "protein-animal", tags: ["choline", "vitamin-d", "saturated-fat"], excludedFor: ["vegan"] },

  // === Fish & seafood ===
  { slug: "salmon-wild", label: "Saumon sauvage", emoji: "🐟", category: "fish", tags: ["omega-3", "vitamin-d", "vitamin-b12", "selenium"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "sardines", label: "Sardines", emoji: "🐟", category: "fish", tags: ["omega-3", "vitamin-d", "vitamin-b12", "calcium"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "mackerel", label: "Maquereau", emoji: "🐟", category: "fish", tags: ["omega-3", "vitamin-d", "vitamin-b12", "selenium"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "anchovies", label: "Anchois", emoji: "🐟", category: "fish", tags: ["omega-3", "vitamin-b12"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "herring", label: "Hareng", emoji: "🐟", category: "fish", tags: ["omega-3", "vitamin-d", "vitamin-b12"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "trout", label: "Truite", emoji: "🐟", category: "fish", tags: ["omega-3", "vitamin-d"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "cod", label: "Cabillaud", emoji: "🐟", category: "fish", tags: ["selenium", "iodine"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "tuna-bluefin", label: "Thon rouge", emoji: "🐟", category: "fish", tags: ["omega-3", "vitamin-d"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "shrimp", label: "Crevettes", emoji: "🦐", category: "fish", tags: ["selenium", "iodine"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "oysters", label: "Huîtres", emoji: "🦪", category: "fish", tags: ["zinc", "vitamin-b12", "selenium", "iodine"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "mussels", label: "Moules", emoji: "🦪", category: "fish", tags: ["iron-nonheme", "vitamin-b12", "selenium"], excludedFor: ["vegan", "vegetarian"] },
  { slug: "seaweed-nori", label: "Algues nori/wakame", emoji: "🌿", category: "fish", tags: ["iodine"] },

  // === Vegetables ===
  { slug: "broccoli", label: "Brocoli", emoji: "🥦", category: "vegetable", tags: ["sulforaphane", "fiber-high", "antioxidant", "low-fodmap"] },
  { slug: "broccoli-sprouts", label: "Pousses de brocoli", emoji: "🌱", category: "vegetable", tags: ["sulforaphane", "antioxidant"] },
  { slug: "cauliflower", label: "Chou-fleur", emoji: "🥦", category: "vegetable", tags: ["sulforaphane", "low-fodmap"] },
  { slug: "brussels-sprouts", label: "Choux de Bruxelles", emoji: "🥬", category: "vegetable", tags: ["sulforaphane", "fiber-high", "vitamin-k2"] },
  { slug: "cabbage-red", label: "Chou rouge", emoji: "🥬", category: "vegetable", tags: ["antioxidant", "polyphenol", "fiber-high"] },
  { slug: "kale", label: "Kale", emoji: "🥬", category: "leafy-green", tags: ["folate", "vitamin-k2", "antioxidant", "fiber-high"] },
  { slug: "spinach", label: "Épinards", emoji: "🥬", category: "leafy-green", tags: ["iron-nonheme", "folate", "magnesium", "potassium"] },
  { slug: "swiss-chard", label: "Bettes / blettes", emoji: "🥬", category: "leafy-green", tags: ["folate", "magnesium", "potassium"] },
  { slug: "arugula", label: "Roquette", emoji: "🥗", category: "leafy-green", tags: ["folate", "antioxidant", "low-fodmap"] },
  { slug: "watercress", label: "Cresson", emoji: "🥬", category: "leafy-green", tags: ["folate", "antioxidant"] },
  { slug: "romaine", label: "Salade romaine", emoji: "🥬", category: "leafy-green", tags: ["folate", "low-fodmap"] },
  { slug: "asparagus", label: "Asperges", emoji: "🌱", category: "vegetable", tags: ["folate", "fiber-high"] },
  { slug: "beetroot", label: "Betterave", emoji: "🍠", category: "vegetable", tags: ["folate", "polyphenol", "high-glycemic"] },
  { slug: "carrot", label: "Carotte", emoji: "🥕", category: "vegetable", tags: ["antioxidant", "low-fodmap"] },
  { slug: "sweet-potato", label: "Patate douce", emoji: "🍠", category: "vegetable", tags: ["fiber-high", "antioxidant"] },
  { slug: "pumpkin", label: "Courge / potimarron", emoji: "🎃", category: "vegetable", tags: ["antioxidant", "fiber-high"] },
  { slug: "zucchini", label: "Courgette", emoji: "🥒", category: "vegetable", tags: ["low-fodmap"] },
  { slug: "tomato", label: "Tomate", emoji: "🍅", category: "vegetable", tags: ["antioxidant", "polyphenol", "histamine-high"] },
  { slug: "bell-pepper", label: "Poivron", emoji: "🫑", category: "vegetable", tags: ["antioxidant"] },
  { slug: "eggplant", label: "Aubergine", emoji: "🍆", category: "vegetable", tags: ["fiber-high", "histamine-high"] },
  { slug: "onion", label: "Oignon", emoji: "🧅", category: "vegetable", tags: ["polyphenol", "high-fodmap"] },
  { slug: "garlic", label: "Ail", emoji: "🧄", category: "herb-spice", tags: ["polyphenol", "anti-inflammatory", "high-fodmap"] },
  { slug: "leek", label: "Poireau", emoji: "🌿", category: "vegetable", tags: ["high-fodmap", "fiber-high"] },
  { slug: "fennel", label: "Fenouil", emoji: "🌿", category: "vegetable", tags: ["fiber-high"] },
  { slug: "artichoke", label: "Artichaut", emoji: "🌿", category: "vegetable", tags: ["fiber-high", "high-fodmap"] },
  { slug: "mushroom-shiitake", label: "Shiitake", emoji: "🍄", category: "vegetable", tags: ["vitamin-d", "selenium"] },
  { slug: "mushroom-button", label: "Champignons de Paris", emoji: "🍄", category: "vegetable", tags: ["vitamin-d", "selenium"] },

  // === Fruits ===
  { slug: "blueberry", label: "Myrtilles", emoji: "🫐", category: "berry", tags: ["antioxidant", "polyphenol", "low-glycemic"] },
  { slug: "raspberry", label: "Framboises", emoji: "🍓", category: "berry", tags: ["antioxidant", "fiber-high", "low-glycemic"] },
  { slug: "blackberry", label: "Mûres", emoji: "🍇", category: "berry", tags: ["antioxidant", "fiber-high"] },
  { slug: "strawberry", label: "Fraises", emoji: "🍓", category: "berry", tags: ["antioxidant", "low-glycemic", "salicylate"] },
  { slug: "pomegranate", label: "Grenade", emoji: "🍎", category: "fruit", tags: ["polyphenol", "antioxidant"] },
  { slug: "apple", label: "Pomme", emoji: "🍎", category: "fruit", tags: ["polyphenol", "fiber-high"] },
  { slug: "pear", label: "Poire", emoji: "🍐", category: "fruit", tags: ["fiber-high", "high-fodmap"] },
  { slug: "kiwi", label: "Kiwi", emoji: "🥝", category: "fruit", tags: ["antioxidant"] },
  { slug: "citrus-orange", label: "Orange", emoji: "🍊", category: "fruit", tags: ["antioxidant", "folate"] },
  { slug: "citrus-lemon", label: "Citron", emoji: "🍋", category: "fruit", tags: ["antioxidant"] },
  { slug: "grapefruit", label: "Pamplemousse", emoji: "🍊", category: "fruit", tags: ["antioxidant"] },
  { slug: "avocado", label: "Avocat", emoji: "🥑", category: "fat-oil", tags: ["potassium", "magnesium", "fiber-high"] },
  { slug: "banana", label: "Banane", emoji: "🍌", category: "fruit", tags: ["potassium", "high-glycemic"] },
  { slug: "grape-red", label: "Raisin rouge", emoji: "🍇", category: "fruit", tags: ["polyphenol", "high-glycemic"] },
  { slug: "cherry", label: "Cerises", emoji: "🍒", category: "fruit", tags: ["antioxidant", "polyphenol"] },
  { slug: "fig-fresh", label: "Figue fraîche", emoji: "🟣", category: "fruit", tags: ["fiber-high", "high-glycemic"] },
  { slug: "date", label: "Datte", emoji: "🟤", category: "fruit", tags: ["high-glycemic", "potassium"] },

  // === Grains ===
  { slug: "oats-steel-cut", label: "Flocons d'avoine", emoji: "🌾", category: "grain", tags: ["fiber-high", "low-glycemic"] },
  { slug: "buckwheat", label: "Sarrasin", emoji: "🌾", category: "grain", tags: ["fiber-high"] },
  { slug: "quinoa", label: "Quinoa", emoji: "🌾", category: "grain", tags: ["fiber-high"] },
  { slug: "brown-rice", label: "Riz complet", emoji: "🍚", category: "grain", tags: ["fiber-high", "magnesium"] },
  { slug: "white-rice", label: "Riz blanc", emoji: "🍚", category: "grain", tags: ["high-glycemic", "low-fodmap"] },
  { slug: "wheat-bread-white", label: "Pain blanc industriel", emoji: "🍞", category: "grain", tags: ["gluten", "high-glycemic"] },
  { slug: "wheat-pasta", label: "Pâtes blanches", emoji: "🍝", category: "grain", tags: ["gluten", "high-glycemic"] },
  { slug: "sourdough-bread", label: "Pain au levain", emoji: "🍞", category: "grain", tags: ["gluten", "fermented"] },
  { slug: "rye-bread", label: "Pain de seigle", emoji: "🍞", category: "grain", tags: ["gluten", "fiber-high"] },
  { slug: "barley", label: "Orge", emoji: "🌾", category: "grain", tags: ["gluten", "fiber-high", "high-fodmap"] },

  // === Legumes ===
  { slug: "lentils-green", label: "Lentilles vertes", emoji: "🟢", category: "legume", tags: ["iron-nonheme", "folate", "fiber-high", "high-fodmap"] },
  { slug: "lentils-red", label: "Lentilles corail", emoji: "🟠", category: "legume", tags: ["iron-nonheme", "folate", "fiber-high"] },
  { slug: "chickpeas", label: "Pois chiches", emoji: "🟡", category: "legume", tags: ["folate", "fiber-high", "high-fodmap"] },
  { slug: "black-beans", label: "Haricots noirs", emoji: "⚫", category: "legume", tags: ["folate", "fiber-high", "high-fodmap"] },
  { slug: "white-beans", label: "Haricots blancs", emoji: "⚪", category: "legume", tags: ["folate", "fiber-high"] },
  { slug: "tofu", label: "Tofu", emoji: "🟦", category: "protein-plant", tags: ["calcium"] },
  { slug: "tempeh", label: "Tempeh", emoji: "🟫", category: "fermented", tags: ["fermented"] },
  { slug: "natto", label: "Natto", emoji: "🟫", category: "fermented", tags: ["vitamin-k2", "fermented"] },
  { slug: "edamame", label: "Edamame", emoji: "🟢", category: "legume", tags: ["folate"] },

  // === Nuts & seeds ===
  { slug: "walnuts", label: "Noix", emoji: "🌰", category: "nut-seed", tags: ["omega-3", "polyphenol"] },
  { slug: "almonds", label: "Amandes", emoji: "🌰", category: "nut-seed", tags: ["magnesium", "vitamin-k2"] },
  { slug: "brazil-nuts", label: "Noix du Brésil", emoji: "🌰", category: "nut-seed", tags: ["selenium"] },
  { slug: "hazelnuts", label: "Noisettes", emoji: "🌰", category: "nut-seed", tags: ["folate"] },
  { slug: "pistachios", label: "Pistaches", emoji: "🌰", category: "nut-seed", tags: ["potassium", "fiber-high"] },
  { slug: "pumpkin-seeds", label: "Graines de courge", emoji: "🟢", category: "nut-seed", tags: ["zinc", "magnesium"] },
  { slug: "sunflower-seeds", label: "Graines de tournesol", emoji: "🌻", category: "nut-seed", tags: ["selenium", "magnesium"] },
  { slug: "flax-seeds", label: "Graines de lin", emoji: "🌾", category: "nut-seed", tags: ["omega-3", "fiber-high"] },
  { slug: "chia-seeds", label: "Graines de chia", emoji: "⚫", category: "nut-seed", tags: ["omega-3", "fiber-high", "calcium"] },
  { slug: "hemp-seeds", label: "Graines de chanvre", emoji: "🌿", category: "nut-seed", tags: ["omega-3"] },

  // === Fats & oils ===
  { slug: "olive-oil-evoo", label: "Huile d'olive vierge extra", emoji: "🫒", category: "fat-oil", tags: ["polyphenol", "anti-inflammatory"] },
  { slug: "olive-fruit", label: "Olives", emoji: "🫒", category: "fat-oil", tags: ["polyphenol"] },
  { slug: "coconut-oil", label: "Huile de coco", emoji: "🥥", category: "fat-oil", tags: ["saturated-fat"] },
  { slug: "butter-grass-fed", label: "Beurre de pâturage", emoji: "🧈", category: "dairy", tags: ["saturated-fat", "vitamin-k2"], excludedFor: ["vegan"] },
  { slug: "ghee", label: "Ghee", emoji: "🧈", category: "dairy", tags: ["saturated-fat", "vitamin-k2"], excludedFor: ["vegan"] },
  { slug: "lard", label: "Saindoux", emoji: "🥓", category: "fat-oil", tags: ["saturated-fat"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "avocado-oil", label: "Huile d'avocat", emoji: "🥑", category: "fat-oil", tags: ["anti-inflammatory"] },
  { slug: "seed-oils-industrial", label: "Huiles de graines industrielles", emoji: "🛢️", category: "fat-oil", tags: ["trans-fat"] },

  // === Dairy & fermented ===
  { slug: "yogurt-greek", label: "Yaourt grec", emoji: "🥛", category: "dairy", tags: ["calcium", "lactose", "fermented"], excludedFor: ["vegan"] },
  { slug: "kefir", label: "Kéfir", emoji: "🥛", category: "fermented", tags: ["fermented", "lactose"], excludedFor: ["vegan"] },
  { slug: "cheese-aged", label: "Fromages affinés", emoji: "🧀", category: "dairy", tags: ["calcium", "vitamin-k2", "saturated-fat", "histamine-high"], excludedFor: ["vegan"] },
  { slug: "cheese-fresh", label: "Fromages frais", emoji: "🧀", category: "dairy", tags: ["calcium", "lactose"], excludedFor: ["vegan"] },
  { slug: "milk-cow", label: "Lait de vache", emoji: "🥛", category: "dairy", tags: ["calcium", "lactose"], excludedFor: ["vegan"] },
  { slug: "sauerkraut", label: "Choucroute crue", emoji: "🥬", category: "fermented", tags: ["fermented", "vitamin-k2"] },
  { slug: "kimchi", label: "Kimchi", emoji: "🌶️", category: "fermented", tags: ["fermented"] },
  { slug: "miso", label: "Miso", emoji: "🟫", category: "fermented", tags: ["fermented"] },

  // === Herbs & spices ===
  { slug: "turmeric", label: "Curcuma", emoji: "🟡", category: "herb-spice", tags: ["anti-inflammatory", "polyphenol"] },
  { slug: "ginger", label: "Gingembre", emoji: "🫚", category: "herb-spice", tags: ["anti-inflammatory"] },
  { slug: "cinnamon", label: "Cannelle", emoji: "🟫", category: "herb-spice", tags: ["polyphenol", "anti-inflammatory"] },
  { slug: "rosemary", label: "Romarin", emoji: "🌿", category: "herb-spice", tags: ["polyphenol", "antioxidant"] },
  { slug: "thyme", label: "Thym", emoji: "🌿", category: "herb-spice", tags: ["antioxidant"] },
  { slug: "basil", label: "Basilic", emoji: "🌿", category: "herb-spice", tags: ["antioxidant"] },
  { slug: "parsley", label: "Persil", emoji: "🌿", category: "herb-spice", tags: ["folate", "antioxidant"] },
  { slug: "cilantro", label: "Coriandre", emoji: "🌿", category: "herb-spice", tags: ["antioxidant"] },

  // === Drinks ===
  { slug: "green-tea", label: "Thé vert", emoji: "🍵", category: "drink", tags: ["polyphenol", "antioxidant", "caffeine"] },
  { slug: "matcha", label: "Matcha", emoji: "🍵", category: "drink", tags: ["polyphenol", "antioxidant", "caffeine"] },
  { slug: "coffee-black", label: "Café noir", emoji: "☕", category: "drink", tags: ["polyphenol", "caffeine"] },
  { slug: "hibiscus-tea", label: "Infusion d'hibiscus", emoji: "🌺", category: "drink", tags: ["polyphenol"] },
  { slug: "water-mineral", label: "Eau minérale", emoji: "💧", category: "drink", tags: [] },
  { slug: "kombucha", label: "Kombucha", emoji: "🍶", category: "fermented", tags: ["fermented"] },
  { slug: "wine-red", label: "Vin rouge", emoji: "🍷", category: "drink", tags: ["polyphenol", "alcohol", "histamine-high"] },
  { slug: "beer", label: "Bière", emoji: "🍺", category: "drink", tags: ["alcohol", "gluten", "high-glycemic"] },
  { slug: "spirits", label: "Spiritueux", emoji: "🥃", category: "drink", tags: ["alcohol"] },
  { slug: "soda-sugary", label: "Sodas sucrés", emoji: "🥤", category: "drink", tags: ["high-glycemic", "fructose-high"] },
  { slug: "fruit-juice", label: "Jus de fruits", emoji: "🧃", category: "drink", tags: ["high-glycemic", "fructose-high"] },

  // === Sweeteners ===
  { slug: "honey-raw", label: "Miel cru", emoji: "🍯", category: "sweetener", tags: ["high-glycemic", "polyphenol"] },
  { slug: "maple-syrup", label: "Sirop d'érable", emoji: "🍁", category: "sweetener", tags: ["high-glycemic"] },
  { slug: "sugar-white", label: "Sucre blanc", emoji: "🍬", category: "sweetener", tags: ["high-glycemic", "fructose-high"] },
  { slug: "high-fructose-corn-syrup", label: "Sirop de glucose-fructose", emoji: "🍭", category: "sweetener", tags: ["high-glycemic", "fructose-high"] },
  { slug: "stevia", label: "Stévia", emoji: "🌱", category: "sweetener", tags: ["low-glycemic"] },

  // === Ultra-processed ===
  { slug: "ultraprocessed-snacks", label: "Snacks industriels", emoji: "🍿", category: "ultra-processed", tags: ["trans-fat", "high-glycemic"] },
  { slug: "fast-food", label: "Fast-food / friture", emoji: "🍔", category: "ultra-processed", tags: ["trans-fat", "saturated-fat"] },
  { slug: "processed-meat", label: "Charcuterie industrielle", emoji: "🥓", category: "ultra-processed", tags: ["saturated-fat"], excludedFor: ["vegan", "vegetarian", "pescatarian"] },
  { slug: "margarine", label: "Margarine", emoji: "🧈", category: "ultra-processed", tags: ["trans-fat"] },
  { slug: "white-flour", label: "Farine blanche raffinée", emoji: "🌾", category: "ultra-processed", tags: ["gluten", "high-glycemic"] },

  // === Misc actionable ===
  { slug: "dark-chocolate", label: "Chocolat noir 85%+", emoji: "🍫", category: "fat-oil", tags: ["polyphenol", "magnesium"] },
  { slug: "cocoa-raw", label: "Cacao cru", emoji: "🍫", category: "herb-spice", tags: ["polyphenol", "magnesium"] },
  { slug: "folate-fortified-cereals", label: "Céréales enrichies acide folique synth.", emoji: "🥣", category: "ultra-processed", tags: ["folate"] },
  { slug: "supplemented-folic-acid", label: "Compléments d'acide folique synthétique", emoji: "💊", category: "ultra-processed", tags: ["folate"] },
];

export const FOOD_BY_SLUG: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.slug, f]));
