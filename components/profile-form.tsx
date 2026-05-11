"use client";
import { EnvironmentSection } from "@/components/environment-section";
import { VaccinationsList, type VaccinationEntry } from "@/components/vaccinations-list";
import { SportsStructured, type SportEntry } from "@/components/sports-structured";
import { SpecialistsList, type SpecialistEntry } from "@/components/specialists-list";
import { SliderRating } from "@/components/slider-rating";
import { CompletionProgress } from "@/components/completion-progress";
import { AgeSexSuggestions } from "@/components/age-sex-suggestions";
import { FrequencyChips } from "@/components/profile/frequency-chips";
import { ScaleButtons } from "@/components/profile/scale-buttons";
import { YesNoUnknownChips } from "@/components/profile/yes-no-unknown";
import { WearablesChips } from "@/components/profile/wearables-chips";
import { FamilyDiseaseGrid } from "@/components/profile/family-disease-grid";
import { SymptomChecklist } from "@/components/profile/symptom-checklist";
import { ScreeningSchedule } from "@/components/profile/screening-schedule";
import type { FrequencyBucket, YesNoUnknown, WearableId } from "@/lib/medical/types";
import {
  MedicationList, AllergyList,
  migrateMedications, migrateAllergies,
  type MedRow, type AllergyRow,
} from "@/components/medical-autocomplete";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Save, Sparkles } from "lucide-react";
import Link from "next/link";

export type Section = {
  id: string; title: string; description?: string;
  fields: Field[];
  /** When set, the wizard / long-form view will defer rendering to a dedicated component. */
  customRenderer?: "environment" | "family" | "symptoms" | "screening";
};
export type Field =
  | { id: string; label: string; type: "text" | "email" | "number" | "date" | "tel" | "url"; placeholder?: string; suffix?: string; col?: 1 | 2 }
  | { id: string; label: string; type: "textarea"; placeholder?: string; rows?: number }
  | { id: string; label: string; type: "select"; options: string[]; col?: 1 | 2 }
  | { id: string; label: string; type: "multi"; options: string[] }
  | { id: string; label: string; type: "chipsSingle"; options: string[]; col?: 1 | 2 }
  | { id: string; label: string; type: "checkbox" }
  | { id: string; label: string; type: "frequency" }
  | { id: string; label: string; type: "scale10"; minLabel?: string; maxLabel?: string }
  | { id: string; label: string; type: "yesNoUnknown" }
  | { id: string; label: string; type: "wearables" }
  | { id: string; label: string; type: "medications" }
  | { id: string; label: string; type: "allergies" }
  | { id: string; label: string; type: "vaccinationsStructured" }
  | { id: string; label: string; type: "sportsStructured" }
  | { id: string; label: string; type: "specialistsStructured" };

export const SECTIONS: Section[] = [
  { id: "identity", title: "Identité", description: "Identification de base.", fields: [
    { id: "firstName", label: "Prénom", type: "text", col: 1 },
    { id: "lastName", label: "Nom", type: "text", col: 1 },
    { id: "email", label: "Email", type: "email", col: 1 },
    { id: "phone", label: "Téléphone", type: "tel", col: 1 },
    { id: "birthDate", label: "Date de naissance", type: "date", col: 1 },
    { id: "birthPlace", label: "Lieu de naissance", type: "text", col: 1 },
    { id: "sex", label: "Sexe biologique", type: "chipsSingle", options: ["Homme", "Femme", "Intersexe"] },
    { id: "gender", label: "Genre", type: "chipsSingle", options: ["Homme cis", "Femme cis", "Homme trans", "Femme trans", "Non-binaire", "Genderfluid", "Agender", "Autre", "Préfère ne pas répondre"] },
  ]},
  { id: "anthro", title: "Anthropométrie", fields: [
    { id: "height", label: "Taille", type: "number", suffix: "cm", col: 1 },
    { id: "weight", label: "Poids", type: "number", suffix: "kg", col: 1 },
    { id: "bodyFat", label: "% masse grasse", type: "number", suffix: "%", col: 1 },
    { id: "muscleMass", label: "Masse musculaire", type: "number", suffix: "kg", col: 1 },
    { id: "waist", label: "Tour de taille", type: "number", suffix: "cm", col: 1 },
    { id: "neck", label: "Tour de cou", type: "number", suffix: "cm", col: 1 },
    { id: "bloodType", label: "Groupe sanguin", type: "chipsSingle", options: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Je ne sais pas"] },
    { id: "ethnicity", label: "Origine ethnique", type: "select", options: ["", "Européenne (Caucasienne)", "Africaine subsaharienne", "Nord-Africaine / Maghrébine", "Moyen-Orient", "Asiatique de l'Est", "Asiatique du Sud", "Asiatique du Sud-Est", "Hispanique / Latino-Américaine", "Amérindienne", "Océanienne / Pacifique", "Ashkénaze", "Séfarade", "Mixte / multi-ethnique", "Autre", "Préfère ne pas répondre"], col: 1 },
  ]},
  { id: "lifestyle", title: "Mode de vie", fields: [
    { id: "activityLevel", label: "Niveau d'activité", type: "chipsSingle", options: ["Sédentaire", "Léger (1-2x/sem)", "Modéré (3-4x/sem)", "Intense (5-6x/sem)", "Athlète"] },
    { id: "sportsList", label: "Sports pratiqués", type: "sportsStructured" },
    { id: "trainingHoursWeek", label: "Heures de sport / semaine", type: "chipsSingle", options: ["0", "1-3", "4-6", "7-10", "10+"] },
    { id: "sleepHours", label: "Sommeil moyen / nuit", type: "chipsSingle", options: ["<5", "5-6", "6-7", "7-8", "8-9", "9+"] },
    { id: "sleepQuality", label: "Qualité de sommeil", type: "chipsSingle", options: ["Excellente", "Bonne", "Moyenne", "Mauvaise"] },
    { id: "wakeTime", label: "Heure de réveil habituelle", type: "chipsSingle", options: ["avant 5h", "5h-6h", "6h-7h", "7h-8h", "8h-9h", "après 9h"] },
    { id: "stressLevel", label: "Niveau de stress (0-10)", type: "number", col: 1 },
    { id: "screenTime", label: "Temps d'écran / jour", type: "chipsSingle", options: ["<1h", "1-3h", "3-5h", "5-7h", "7h+"] },
    { id: "meditation", label: "Méditation", type: "chipsSingle", options: ["Jamais", "Occasionnel", "Hebdo", "Quotidien"] },
    { id: "hrv", label: "HRV moyenne (ms)", type: "number", suffix: "ms", col: 1 },
    { id: "restingHr", label: "FC repos", type: "number", suffix: "bpm", col: 1 },
    { id: "vo2max", label: "VO2max", type: "number", suffix: "ml/kg/min", col: 1 },
  ]},
  { id: "diet", title: "Alimentation", fields: [
    { id: "dietType", label: "Type d'alimentation", type: "chipsSingle", options: ["Omnivore", "Flexitarien", "Pescetarien", "Végétarien", "Vegan", "Carnivore", "Cétogène", "Paléo", "Méditerranéen"] },
    { id: "intermittentFasting", label: "Jeûne intermittent", type: "chipsSingle", options: ["Non", "12h", "14h", "16h", "18h", "20h+", "OMAD"] },
    { id: "mealsPerDay", label: "Repas / jour", type: "chipsSingle", options: ["1", "2", "3", "4", "5+"] },
    { id: "waterLiters", label: "Eau / jour", type: "chipsSingle", options: ["<0.5L", "0.5-1L", "1-1.5L", "1.5-2L", "2-2.5L", "2.5L+"] },
    { id: "alcoholDrinksWeek", label: "Verres d'alcool / semaine", type: "chipsSingle", options: ["0", "1-2", "3-5", "6-10", "10+"] },
    { id: "coffeesPerDay", label: "Cafés / jour", type: "chipsSingle", options: ["0", "1", "2", "3", "4", "5+"] },
    { id: "smoker", label: "Tabac / vapotage", type: "chipsSingle", options: ["Non", "Occasionnel", "Régulier", "Vapoteur", "Ex-fumeur"] },
    { id: "vaperNicotineMg", label: "Taux de nicotine (si vapoteur)", type: "chipsSingle", options: ["0 mg/mL", "3 mg/mL", "6 mg/mL", "9 mg/mL", "12 mg/mL", "18 mg/mL", "20 mg/mL", ">20 (sels)"] },
    { id: "recreationalDrugs", label: "Substances récréatives", type: "multi", options: ["Aucune", "Cannabis", "Nicotine vaping", "Cocaïne", "MDMA", "Psychédéliques", "Kétamine", "Opiacés", "Autres"] },
    { id: "allergiesFood", label: "Allergies / intolérances alimentaires", type: "textarea", rows: 2 },
    { id: "foodsAvoided", label: "Aliments évités volontairement", type: "textarea", rows: 2 },
  ]},
  { id: "medical", title: "Antécédents médicaux", fields: [
    { id: "chronicConditions", label: "Maladies chroniques", type: "textarea", rows: 2 },
    { id: "surgeries", label: "Opérations chirurgicales", type: "textarea", rows: 2 },
    { id: "hospitalizations", label: "Hospitalisations notables", type: "textarea", rows: 2 },
    { id: "allergies", label: "Allergies (médicaments, alimentaires, environnement, contact)", type: "allergies" },
    { id: "medications", label: "Médicaments actuels", type: "medications" },
    { id: "supplements", label: "Compléments alimentaires", type: "textarea", rows: 3 },
    { id: "vaccinationsList", label: "Vaccinations à jour", type: "vaccinationsStructured" },
    { id: "lastCheckup", label: "Dernier checkup complet", type: "date", col: 1 },
    { id: "lastDental", label: "Dernier dentiste", type: "date", col: 1 },
    { id: "lastEye", label: "Dernier ophtalmo", type: "date", col: 1 },
  ]},
  { id: "family", title: "Antécédents familiaux", description: "Histoire de santé de la famille.", fields: [
    { id: "fatherHealth", label: "Père — santé / pathologies", type: "textarea", rows: 2 },
    { id: "motherHealth", label: "Mère — santé / pathologies", type: "textarea", rows: 2 },
    { id: "grandparentsHealth", label: "Grands-parents — pathologies notables", type: "textarea", rows: 3 },
    { id: "siblingsHealth", label: "Frères et sœurs", type: "textarea", rows: 2 },
    { id: "familyDiseases", label: "Maladies familiales", type: "multi", options: ["Cancer", "Diabète T1", "Diabète T2", "Hypertension", "AVC", "Infarctus", "Alzheimer", "Parkinson", "Cholestérol familial", "Thrombose", "Maladie auto-immune", "Dépression", "Schizophrénie"] },
  ]},
  { id: "mental", title: "Santé mentale & cognition", fields: [
    { id: "moodAvg", label: "Humeur moyenne (0-10)", type: "number", col: 1 },
    { id: "anxietyLevel", label: "Anxiété (0-10)", type: "number", col: 1 },
    { id: "depressionHistory", label: "Antécédents de dépression", type: "textarea", rows: 2 },
    { id: "therapy", label: "Suivi psy actuel ou passé", type: "textarea", rows: 2 },
    { id: "cognitiveConcerns", label: "Concerns cognitives (mémoire, focus…)", type: "textarea", rows: 2 },
  ]},
  { id: "reproductive", title: "Santé sexuelle & reproduction", fields: [
    { id: "sexualActivity", label: "Activité sexuelle", type: "textarea", rows: 2 },
    { id: "contraception", label: "Contraception", type: "text", col: 1 },
    { id: "stiTests", label: "Date du dernier test IST complet", type: "date", col: 1 },
    { id: "fertility", label: "Projet enfant / fertilité", type: "textarea", rows: 2 },
  ]},
  { id: "environment", title: "Environnement & exposition", fields: [] as Field[] },
  { id: "goals", title: "Objectifs & priorités santé", fields: [
    { id: "primaryGoals", label: "Objectifs principaux", type: "multi", options: ["Longévité", "Performance physique", "Perte de masse grasse", "Prise de muscle", "Meilleur sommeil", "Réduction stress", "Optimisation cognitive", "Énergie", "Hormones", "Immunité", "Santé cardiaque", "Microbiote"] },
    { id: "currentChallenges", label: "Défis actuels", type: "textarea", rows: 3 },
    { id: "targetWeight", label: "Poids cible", type: "number", suffix: "kg", col: 1 },
    { id: "longevityTarget", label: "Objectif d'âge en bonne santé", type: "number", suffix: "ans", col: 1 },
    { id: "openToHrt", label: "Ouvert à hormones / peptides / TRT", type: "checkbox" },
    { id: "openToBiohacking", label: "Ouvert au biohacking", type: "checkbox" },
  ]},
  { id: "providers", title: "Praticiens & suivi", fields: [
    { id: "primaryDoctor", label: "Médecin traitant", type: "text" },
    { id: "specialistsList", label: "Spécialistes consultés", type: "specialistsStructured" },
    { id: "preferredLab", label: "Labo de prédilection", type: "text", col: 1 },
    { id: "insurance", label: "Mutuelle / assurance", type: "text", col: 1 },
  ]},
  { id: "freeform", title: "Notes libres", fields: [
    { id: "notes", label: "Tout ce que tu juges utile que l'IA sache de toi", type: "textarea", rows: 6 },
  ]},

  // ===== Extended sections (onboarding exhaustif v2) =====

  { id: "familyHistory", title: "Antécédents familiaux structurés", description: "Maladies par parent / grand-parent. Sert au scoring du risque héréditaire.", customRenderer: "family", fields: [] as Field[] },

  { id: "symptomsActive", title: "Symptômes ressentis", description: "Coche tout ce que tu ressens en ce moment ou de manière récurrente.", customRenderer: "symptoms", fields: [] as Field[] },

  { id: "screeningSchedule", title: "Suivi médical périodique", description: "Date du dernier examen pour chaque dépistage. Adapté à ton âge et ton sexe.", customRenderer: "screening", fields: [] as Field[] },

  { id: "sleep", title: "Sommeil & circadien", fields: [
    { id: "bedtime", label: "Heure de coucher habituelle", type: "text", col: 1, placeholder: "23h00" },
    { id: "wakeRegularity", label: "Régularité réveil/coucher", type: "chipsSingle", options: ["Très régulier", "Régulier", "Variable", "Chaotique"] },
    { id: "morningLight", label: "Lumière du matin (yeux + extérieur 10 min)", type: "frequency" },
    { id: "blueLightEvening", label: "Écrans dans l'heure avant le coucher", type: "frequency" },
    { id: "snoringSuspected", label: "Ronflement / apnée suspectée", type: "yesNoUnknown" },
    { id: "restlessLegs", label: "Jambes sans repos", type: "yesNoUnknown" },
    { id: "dayNaps", label: "Sieste", type: "frequency" },
    { id: "shiftWork", label: "Travail posté / horaires décalés", type: "yesNoUnknown" },
  ]},

  { id: "digestion", title: "Digestion & intestin", fields: [
    { id: "stoolFrequencyDay", label: "Selles par jour", type: "chipsSingle", options: ["0-1/jour", "1-2/jour", "2-3/jour", "3+/jour"] },
    { id: "bristolType", label: "Forme dominante (Bristol)", type: "chipsSingle", options: ["1 — billes dures", "2 — saucisse grumeleuse", "3 — saucisse craquelée", "4 — saucisse lisse (idéal)", "5 — morceaux mous", "6 — bouillie", "7 — liquide"] },
    { id: "bloating", label: "Ballonnements", type: "frequency" },
    { id: "reflux", label: "Reflux / brûlures gastriques", type: "frequency" },
    { id: "ibsSuspected", label: "Suspicion SIBO / IBS / sensibilité", type: "yesNoUnknown" },
    { id: "lactoseSensitivity", label: "Sensibilité au lactose", type: "yesNoUnknown" },
    { id: "glutenSensitivity", label: "Sensibilité au gluten", type: "yesNoUnknown" },
    { id: "lastColonoscopy", label: "Dernière coloscopie", type: "date", col: 1 },
  ]},

  { id: "womens", title: "Cycle & santé reproductive (femme)", description: "S'affiche uniquement si sexe biologique = Femme.", fields: [
    { id: "menarcheAge", label: "Âge des premières règles", type: "number", suffix: "ans", col: 1 },
    { id: "cycleStatus", label: "Statut du cycle", type: "chipsSingle", options: ["Régulier", "Irrégulier", "Absent (ménopause)", "Sous contraception hormonale", "Préfère ne pas répondre"] },
    { id: "cycleLength", label: "Durée du cycle (j)", type: "number", suffix: "j", col: 1 },
    { id: "periodLength", label: "Durée des règles (j)", type: "number", suffix: "j", col: 1 },
    { id: "pms", label: "Syndrome prémenstruel (SPM)", type: "scale10", minLabel: "Aucun", maxLabel: "Sévère" },
    { id: "dysmenorrhea", label: "Douleurs de règles", type: "scale10", minLabel: "Aucune", maxLabel: "Invalidantes" },
    { id: "contraceptionType", label: "Contraception (type)", type: "chipsSingle", options: ["Aucune", "Pilule combinée", "Pilule progestative", "Stérilet cuivre", "Stérilet hormonal", "Implant", "Anneau", "Patch", "Préservatif", "Méthode naturelle", "Vasectomie partenaire", "Stérilisation", "Autre"] },
    { id: "pregnanciesG", label: "Grossesses (G)", type: "number", col: 1, placeholder: "0" },
    { id: "pregnanciesP", label: "Accouchements (P)", type: "number", col: 1, placeholder: "0" },
    { id: "miscarriages", label: "Fausses couches", type: "number", col: 1, placeholder: "0" },
    { id: "breastfeeding", label: "Allaitement (mois total)", type: "number", suffix: "mois", col: 1 },
    { id: "menopauseStatus", label: "Statut ménopause", type: "chipsSingle", options: ["Pré-ménopause", "Péri-ménopause", "Ménopause", "Non concernée"] },
    { id: "menopauseAge", label: "Âge ménopause (si applicable)", type: "number", suffix: "ans", col: 1 },
    { id: "hrtFemale", label: "Traitement hormonal substitutif (THS)", type: "yesNoUnknown" },
    { id: "lastPap", label: "Dernier frottis", type: "date", col: 1 },
    { id: "lastMammo", label: "Dernière mammographie", type: "date", col: 1 },
  ]},

  { id: "mens", title: "Santé reproductive (homme)", description: "S'affiche uniquement si sexe biologique = Homme.", fields: [
    { id: "libidoMale", label: "Libido", type: "scale10", minLabel: "Très basse", maxLabel: "Très haute" },
    { id: "erectileFunction", label: "Qualité érections", type: "scale10", minLabel: "Difficiles", maxLabel: "Excellentes" },
    { id: "morningErections", label: "Érections matinales", type: "frequency" },
    { id: "fertilityTested", label: "Spermogramme déjà fait", type: "yesNoUnknown" },
    { id: "vasectomy", label: "Vasectomie", type: "yesNoUnknown" },
    { id: "lastPsa", label: "Dernier PSA", type: "date", col: 1 },
    { id: "lastProstateExam", label: "Dernier toucher rectal / écho prostate", type: "date", col: 1 },
    { id: "trtMale", label: "TRT (testostérone)", type: "yesNoUnknown" },
  ]},

  { id: "dentalVision", title: "Dentaire / vision / audition", fields: [
    { id: "wearsGlasses", label: "Port de lunettes / lentilles", type: "yesNoUnknown" },
    { id: "visionCorrection", label: "Correction (D)", type: "text", col: 1, placeholder: "ex: -2.5 / -3.0" },
    { id: "lastEyeExam", label: "Dernier ophtalmo", type: "date", col: 1 },
    { id: "tinnitus", label: "Acouphènes", type: "frequency" },
    { id: "hearingLossSuspected", label: "Baisse d'audition suspectée", type: "yesNoUnknown" },
    { id: "lastHearingTest", label: "Dernier audiogramme", type: "date", col: 1 },
    { id: "bruxism", label: "Grincements / serrements (bruxisme)", type: "frequency" },
    { id: "dentalImplants", label: "Couronnes / implants / appareils", type: "text", col: 2 },
    { id: "lastDentalCleaning", label: "Dernier détartrage", type: "date", col: 1 },
  ]},

  { id: "skin", title: "Peau & exposition solaire", fields: [
    { id: "skinType", label: "Type de peau (Fitzpatrick)", type: "chipsSingle", options: ["I — très claire", "II — claire", "III — intermédiaire", "IV — mate", "V — foncée", "VI — très foncée"] },
    { id: "sunHoursWeek", label: "Heures de soleil / semaine", type: "chipsSingle", options: ["<2h", "2-5h", "5-10h", "10-20h", "20h+"] },
    { id: "sunscreenUse", label: "Crème solaire", type: "frequency" },
    { id: "severeBurns", label: "Coups de soleil sévères dans la vie", type: "chipsSingle", options: ["0", "1-2", "3-5", "6+"] },
    { id: "newMoles", label: "Nouveaux grains de beauté ou changements", type: "yesNoUnknown" },
    { id: "lastDermatoCheck", label: "Dernier check dermato", type: "date", col: 1 },
    { id: "skinConcerns", label: "Préoccupations cutanées", type: "multi", options: ["Acné", "Eczéma", "Psoriasis", "Rosacée", "Vitiligo", "Démangeaisons", "Sécheresse", "Sensibilité", "Aucune"] },
  ]},

  { id: "pain", title: "Douleur chronique", fields: [
    { id: "hasChronicPain", label: "Douleur chronique présente", type: "yesNoUnknown" },
    { id: "painIntensity", label: "Intensité actuelle", type: "scale10", minLabel: "Aucune", maxLabel: "Insupportable" },
    { id: "painLocations", label: "Localisations", type: "multi", options: ["Tête", "Cou / nuque", "Épaules", "Dos haut", "Dos bas", "Lombaires", "Hanches", "Genoux", "Chevilles", "Mains / poignets", "Coudes", "Abdomen", "Pelvis"] },
    { id: "painDurationYears", label: "Depuis combien d'années", type: "number", suffix: "ans", col: 1 },
    { id: "painTreatments", label: "Traitements en cours", type: "textarea", rows: 2 },
  ]},

  { id: "energy", title: "Énergie & vitalité", fields: [
    { id: "energyMorning", label: "Énergie matin", type: "scale10", minLabel: "Épuisé", maxLabel: "Au top" },
    { id: "energyAfternoon", label: "Énergie après-midi", type: "scale10", minLabel: "Épuisé", maxLabel: "Au top" },
    { id: "energyEvening", label: "Énergie soir", type: "scale10", minLabel: "Épuisé", maxLabel: "Au top" },
    { id: "postMealCrash", label: "Coup de barre post-repas", type: "frequency" },
    { id: "libidoGeneral", label: "Libido (en général)", type: "scale10", minLabel: "Très basse", maxLabel: "Très haute" },
    { id: "motivation", label: "Motivation / drive", type: "scale10", minLabel: "Très bas", maxLabel: "Très haut" },
  ]},

  { id: "recovery", title: "Récupération & exposition thermique", fields: [
    { id: "saunaSessions", label: "Séances de sauna", type: "frequency" },
    { id: "saunaDurationMin", label: "Durée moyenne (min)", type: "chipsSingle", options: ["<10", "10-15", "15-20", "20-30", "30+"] },
    { id: "coldExposure", label: "Bain froid / douche froide", type: "frequency" },
    { id: "massage", label: "Massage / kiné / ostéo", type: "frequency" },
    { id: "stretching", label: "Étirements / mobilité", type: "frequency" },
    { id: "breathwork", label: "Respiration / breathwork", type: "frequency" },
    { id: "mobilitySelfRating", label: "Mobilité auto-évaluée", type: "scale10", minLabel: "Très raide", maxLabel: "Très souple" },
    { id: "balanceFalls", label: "Chutes dans les 12 derniers mois", type: "chipsSingle", options: ["0", "1", "2", "3+"] },
  ]},

  { id: "substances", title: "Substances détaillées", fields: [
    { id: "tobaccoPackYears", label: "Tabac — pack-years (paquets/jour × années)", type: "chipsSingle", options: ["0", "<5", "5-10", "10-20", "20+"] },
    { id: "alcoholBingeWeek", label: "Épisodes binge (4+ verres) / semaine", type: "chipsSingle", options: ["0", "1-2", "3-5", "6+"] },
    { id: "cannabisFreq", label: "Cannabis", type: "frequency" },
    { id: "nicotineVaping", label: "Nicotine vaping", type: "frequency" },
    { id: "psychedelicsHistory", label: "Historique psychédéliques (optionnel)", type: "textarea", rows: 2, placeholder: "Pour contexte santé mentale uniquement" },
    { id: "caffeineLastTime", label: "Heure de la dernière caféine habituelle", type: "chipsSingle", options: ["matin", "midi", "14h", "16h", "18h", "soir"] },
  ]},

  { id: "socialWork", title: "Travail & vie sociale", fields: [
    { id: "occupationDetail", label: "Métier", type: "text", col: 2 },
    { id: "remoteWorkPct", label: "% télétravail", type: "chipsSingle", options: ["0%", "<25%", "25-50%", "50-75%", "75-100%", "100%"] },
    { id: "workStressLevel", label: "Stress professionnel", type: "scale10", minLabel: "Aucun", maxLabel: "Maximal" },
    { id: "workHoursWeek", label: "Heures de travail / semaine", type: "chipsSingle", options: ["<30", "30-40", "40-50", "50-60", "60+"] },
    { id: "relationshipStatus", label: "Statut relationnel", type: "chipsSingle", options: ["Célibataire", "En couple", "Marié·e", "Divorcé·e", "Veuf·ve", "Préfère ne pas répondre"] },
    { id: "householdComposition", label: "Foyer", type: "chipsSingle", options: ["Seul·e", "Couple", "Couple + enfants", "Famille élargie", "Coloc"] },
    { id: "lonelinessScale", label: "Sentiment de solitude", type: "scale10", minLabel: "Jamais", maxLabel: "Très souvent" },
    { id: "socialInteractionsWeek", label: "Interactions sociales hors travail / semaine", type: "chipsSingle", options: ["0-1", "2-3", "4-6", "7+"] },
    { id: "purposeFeel", label: "Sentiment de sens / purpose", type: "scale10", minLabel: "Aucun", maxLabel: "Très fort" },
  ]},

  { id: "envExposure", title: "Environnement & expositions", description: "Domicile, eau, air, animaux, nuisances. Détail au-delà de la section géographique.", fields: [
    { id: "waterSource", label: "Source eau de boisson", type: "chipsSingle", options: ["Robinet", "Robinet filtré", "Bouteille verre", "Bouteille plastique", "Mixte"] },
    { id: "airQualityHome", label: "Qualité air domicile (perçue)", type: "scale10", minLabel: "Mauvaise", maxLabel: "Excellente" },
    { id: "moldHistory", label: "Historique moisissures dans logement", type: "yesNoUnknown" },
    { id: "gasCooking", label: "Cuisson au gaz", type: "yesNoUnknown" },
    { id: "petsOwned", label: "Animaux domestiques", type: "multi", options: ["Chien", "Chat", "Oiseau", "Reptile", "Rongeur", "Poisson", "Autre"] },
    { id: "housingType", label: "Type de logement", type: "chipsSingle", options: ["Appartement", "Maison", "Loft", "Colocation"] },
    { id: "urbanRural", label: "Zone", type: "chipsSingle", options: ["Hyper-urbain", "Urbain", "Périurbain", "Rural"] },
    { id: "noiseExposure", label: "Exposition au bruit (domicile/travail)", type: "scale10", minLabel: "Calme", maxLabel: "Très bruyant" },
    { id: "occupationalHazards", label: "Expositions professionnelles", type: "multi", options: ["Produits chimiques", "Solvants", "Métaux", "Poussières", "Amiante", "Pesticides", "Radiations", "Bruit fort", "Aucune"] },
  ]},

  { id: "topical", title: "Cosmétiques & expositions topiques", fields: [
    { id: "sunscreenDaily", label: "Crème solaire quotidienne", type: "yesNoUnknown" },
    { id: "hairDyeFreq", label: "Coloration cheveux", type: "frequency" },
    { id: "makeupDaily", label: "Maquillage quotidien", type: "yesNoUnknown" },
    { id: "fragrancesFreq", label: "Parfums / déodorants parfumés", type: "frequency" },
    { id: "cleanCosmeticsPref", label: "Préférence cosmétiques 'clean'", type: "yesNoUnknown" },
  ]},

  { id: "geneticsExtra", title: "Tests génétiques approfondis", description: "Hors 23andMe / Ancestry. Panels cliniques.", fields: [
    { id: "brca", label: "Test BRCA1/BRCA2 (sein/ovaire)", type: "yesNoUnknown" },
    { id: "lynch", label: "Test syndrome de Lynch (colon/utérus)", type: "yesNoUnknown" },
    { id: "cardiomyopathyPanel", label: "Panel cardiomyopathies héréditaires", type: "yesNoUnknown" },
    { id: "geneticPanelOther", label: "Autres panels", type: "textarea", rows: 2 },
    { id: "wantsCarrierScreening", label: "Souhaite un dépistage génétique pré-conception", type: "yesNoUnknown" },
  ]},

  { id: "wearablesOwned", title: "Wearables & devices", fields: [
    { id: "wearables", label: "Devices possédés", type: "wearables" },
    { id: "wearableMain", label: "Principal porté en continu", type: "chipsSingle", options: ["Whoop", "Oura", "Apple Watch", "Garmin", "Fitbit", "Polar", "Aucun"] },
  ]},

  { id: "advanceDirectives", title: "Directives & contacts d'urgence", fields: [
    { id: "emergencyContactName", label: "Contact urgence (nom)", type: "text", col: 1 },
    { id: "emergencyContactPhone", label: "Contact urgence (tél.)", type: "tel", col: 1 },
    { id: "preferredPharmacy", label: "Pharmacie habituelle", type: "text", col: 2 },
    { id: "organDonor", label: "Donneur d'organes", type: "yesNoUnknown" },
    { id: "bloodDonor", label: "Donneur de sang", type: "yesNoUnknown" },
    { id: "advanceDirectivesWritten", label: "Directives anticipées rédigées", type: "yesNoUnknown" },
  ]},
];

export function completion(section: Section, data: Record<string, unknown>): number {
  if (section.id === "environment") {
    let filled = 0; const max = 5;
    const cur = data.currentLocation as { countryCode?: string; city?: string } | undefined;
    if (cur?.countryCode) filled++;
    if (cur?.city) filled++;
    if (data.occupation) filled++;
    if (data.workEnvironment) filled++;
    if (data.toxicExposure) filled++;
    return Math.round((filled / max) * 100);
  }
  if (section.customRenderer === "family") {
    const fh = data.familyHistory as Record<string, unknown> | undefined;
    if (!fh) return 0;
    // Count distinct relatives that have at least one entry with status set.
    const seenRelatives = new Set<string>();
    for (const k of Object.keys(fh)) {
      const rel = k.split(".")[0];
      const e = fh[k] as { status?: string } | undefined;
      if (e?.status && e.status !== "unknown") seenRelatives.add(rel);
    }
    // 6 core relatives (parents + 4 grandparents) is the practical max for this scoring.
    return Math.min(100, Math.round((seenRelatives.size / 6) * 100));
  }
  if (section.customRenderer === "symptoms") {
    const arr = data.activeSymptoms as string[] | undefined;
    // Symptoms is opt-in: filled-or-empty both count as 100% (the user has actively engaged
    // by reaching the section and has either declared symptoms or none).
    return Array.isArray(arr) ? 100 : 0;
  }
  if (section.customRenderer === "screening") {
    const sh = data.screeningHistory as Record<string, { lastDate?: string }> | undefined;
    if (!sh) return 0;
    const filled = Object.values(sh).filter((e) => e?.lastDate).length;
    // 8 routine screenings = "good enough" baseline.
    return Math.min(100, Math.round((filled / 8) * 100));
  }
  if (section.fields.length === 0) return 0;
  let filled = 0;
  for (const f of section.fields) {
    const v = data[f.id];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      // Structured medication/allergy rows: count as filled only if at least one row has a name
      if (typeof v[0] === "object" && v[0] !== null) {
        const hasName = v.some((r: { name?: string }) => r && typeof r.name === "string" && r.name.trim().length > 0);
        if (!hasName) continue;
      }
    }
    filled++;
  }
  return Math.round((filled / section.fields.length) * 100);
}

export function ProfileForm({ initial }: { initial: Record<string, unknown> }) {
  const [data, setData] = useState<Record<string, unknown>>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  function set<K extends string>(k: K, v: unknown) { setData((d) => ({ ...d, [k]: v })); }
  function toggleMulti(k: string, opt: string) {
    const cur = (data[k] as string[]) || [];
    set(k, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  }

  // Auto-save (debounced 1.5s)
  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify(initial)) return;
    const t = setTimeout(async () => {
      setSaving(true);
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setSaving(false);
      if (res.ok) setSavedAt(new Date());
    }, 1500);
    return () => clearTimeout(t);
  }, [data, initial]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      <nav className="md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-6rem)] md:overflow-auto scrollbar-thin">
        <Link href="/profile/import" className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald/10 border border-emerald/30 text-sm text-emerald hover:bg-emerald/20 mb-3 transition">
          <Sparkles className="h-3.5 w-3.5" /> Import IA (texte → form)
        </Link>
        <ul className="space-y-0.5 text-sm">
          {SECTIONS.map((s) => {
            const pct = completion(s, data);
            return (
              <li key={s.id}>
                <a href={`#${s.id}`} onClick={() => setActiveSection(s.id)}
                   className={`flex items-center justify-between px-3 py-1.5 rounded-md transition ${activeSection === s.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <span>{s.title}</span>
                  <span className={`text-[10px] tabular-nums ${pct === 100 ? "text-emerald" : pct >= 50 ? "text-amber-400" : "text-muted-foreground"}`}>{pct}%</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-6">
        <CompletionProgress data={data} totalPct={Math.round(SECTIONS.reduce((a,s)=>a+completion(s as Section,data),0)/SECTIONS.length)} />
        <AgeSexSuggestions data={data} />
        {SECTIONS.map((section) => {
          if (section.id === "environment") {
            return (
              <EnvironmentSection
                key={section.id}
                current={((data as Record<string, unknown>).currentLocation as { countryCode: string; city: string }) || { countryCode: "", city: "" }}
                history={((data as Record<string, unknown>).residenceHistory as { countryCode: string; city: string }[]) || []}
                occupation={((data as Record<string, unknown>).occupation as string) || ""}
                workEnvironment={((data as Record<string, unknown>).workEnvironment as string) || ""}
                toxicExposure={((data as Record<string, unknown>).toxicExposure as string) || ""}
                onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
              />
            );
          }
          if (section.customRenderer === "family") {
            return (
              <motion.section key={section.id} id={section.id}
                initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.3 }}
                className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
                {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
                <div className="mt-5">
                  <FamilyDiseaseGrid value={data.familyHistory as Record<string, { status: "yes" | "no" | "unknown"; ageOfDiagnosis?: number; causeOfDeath?: boolean; ageAtDeath?: number; notes?: string }> | undefined} onChange={(v) => set("familyHistory", v)} />
                </div>
              </motion.section>
            );
          }
          if (section.customRenderer === "symptoms") {
            return (
              <motion.section key={section.id} id={section.id}
                initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.3 }}
                className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
                {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
                <div className="mt-5">
                  <SymptomChecklist value={data.activeSymptoms as string[] | undefined} onChange={(v) => set("activeSymptoms", v)} />
                </div>
              </motion.section>
            );
          }
          if (section.customRenderer === "screening") {
            const sex = data.sex === "Femme" ? "female" : data.sex === "Homme" ? "male" : undefined;
            return (
              <motion.section key={section.id} id={section.id}
                initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.3 }}
                className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
                {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
                <div className="mt-5">
                  <ScreeningSchedule
                    value={data.screeningHistory as Record<string, { lastDate?: string }> | undefined}
                    onChange={(v) => set("screeningHistory", v)}
                    birthDate={data.birthDate as string | undefined}
                    sex={sex}
                  />
                </div>
              </motion.section>
            );
          }
          return (
          <motion.section
            key={section.id} id={section.id}
            initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.3 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
              <span className="text-xs text-muted-foreground">{completion(section, data)}% rempli</span>
            </div>
            {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((f) => (
                <FieldRow key={f.id} field={f} value={data[f.id]} onChange={(v) => set(f.id, v)} onMulti={(opt) => toggleMulti(f.id, opt)} />
              ))}
            </div>
          </motion.section>
          );
        })}

        <div className="sticky bottom-4 z-10 flex justify-end">
          <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg flex items-center gap-2 text-xs">
            <AnimatePresence mode="wait">
              {saving ? (
                <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-muted-foreground">
                  <Save className="h-3 w-3 animate-pulse" /> Enregistrement…
                </motion.span>
              ) : savedAt ? (
                <motion.span key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-emerald">
                  <Check className="h-3 w-3" /> Enregistré il y a {Math.max(1, Math.round((Date.now() - savedAt.getTime()) / 1000))}s
                </motion.span>
              ) : (
                <span className="text-muted-foreground">Auto-save activé</span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FieldRow({ field, value, onChange, onMulti }: {
  field: Field; value: unknown; onChange: (v: unknown) => void; onMulti: (opt: string) => void;
}) {
  // Sliders for 0-10 emotional ratings
  if (field.id === "stressLevel" || field.id === "moodAvg" || field.id === "anxietyLevel") {
    const variant = field.id === "stressLevel" ? "stress" : field.id === "moodAvg" ? "mood" : "anxiety";
    return (
      <div className="md:col-span-2">
        <SliderRating label={field.label} value={typeof value === "number" ? value : 5} onChange={(v) => onChange(v)} variant={variant} />
      </div>
    );
  }
  if (field.type === "vaccinationsStructured") {
    return (
      <VaccinationsList
        value={(Array.isArray(value) ? value : []) as VaccinationEntry[]}
        onChange={(v) => onChange(v)}
      />
    );
  }
  if (field.type === "sportsStructured") {
    return (
      <SportsStructured
        value={(Array.isArray(value) ? value : []) as SportEntry[]}
        onChange={(v) => onChange(v)}
      />
    );
  }
  if (field.type === "specialistsStructured") {
    return (
      <SpecialistsList
        value={(Array.isArray(value) ? value : []) as SpecialistEntry[]}
        onChange={(v) => onChange(v)}
      />
    );
  }
  const colSpan = (field as { col?: 1 | 2 }).col === 2 ? "md:col-span-2" : (field as { col?: 1 | 2 }).col === 1 ? "" : "md:col-span-2";
  if (field.type === "medications") {
    const rows: MedRow[] = migrateMedications(value);
    const wasLegacyString = typeof value === "string" && value.trim().length > 0;
    return (
      <div className="md:col-span-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
          {wasLegacyString && (
            <span className="text-[10px] uppercase tracking-wider text-amber-400/80">Migré depuis texte libre — vérifie les entrées</span>
          )}
        </div>
        <MedicationList value={rows} onChange={(r) => onChange(r)} />
      </div>
    );
  }
  if (field.type === "allergies") {
    const rows: AllergyRow[] = migrateAllergies(value);
    const wasLegacyString = typeof value === "string" && value.trim().length > 0;
    return (
      <div className="md:col-span-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
          {wasLegacyString && (
            <span className="text-[10px] uppercase tracking-wider text-amber-400/80">Migré depuis texte libre — vérifie les entrées</span>
          )}
        </div>
        <AllergyList value={rows} onChange={(r) => onChange(r)} />
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} rows={field.rows ?? 3}
                  className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition" />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className={`space-y-1.5 ${colSpan}`}>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition">
          {field.options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === "multi") {
    const selected = (value as string[]) ?? [];
    return (
      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const active = selected.includes(o);
            return (
              <button key={o} type="button" onClick={() => onMulti(o)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${active ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"}`}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="md:col-span-2 flex items-center gap-2.5 cursor-pointer text-sm">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border bg-secondary accent-emerald" />
        {field.label}
      </label>
    );
  }
  if (field.type === "chipsSingle") {
    const cur = (value as string) ?? "";
    return (
      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const active = cur === o;
            return (
              <button key={o} type="button" onClick={() => onChange(active ? "" : o)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${active ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"}`}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.type === "frequency") {
    return <FrequencyChips label={field.label} value={value as FrequencyBucket | undefined} onChange={(v) => onChange(v)} />;
  }
  if (field.type === "scale10") {
    return (
      <ScaleButtons
        label={field.label}
        value={typeof value === "number" ? value : undefined}
        onChange={(v) => onChange(v)}
        minLabel={field.minLabel}
        maxLabel={field.maxLabel}
      />
    );
  }
  if (field.type === "yesNoUnknown") {
    return <YesNoUnknownChips label={field.label} value={value as YesNoUnknown | undefined} onChange={(v) => onChange(v)} />;
  }
  if (field.type === "wearables") {
    return <WearablesChips label={field.label} value={value as WearableId[] | undefined} onChange={(v) => onChange(v)} />;
  }
  return (
    <div className={`space-y-1.5 ${colSpan}`}>
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
      <div className="relative">
        <input type={field.type}
               value={(value as string | number | undefined) ?? ""}
               onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
               placeholder={(field as { placeholder?: string }).placeholder}
               className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition" />
        {(field as { suffix?: string }).suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{(field as { suffix?: string }).suffix}</span>
        )}
      </div>
    </div>
  );
}
