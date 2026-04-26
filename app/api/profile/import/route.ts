import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 60;

const SCHEMA = `{
  "firstName": "string", "lastName": "string", "email": "string", "phone": "string",
  "birthDate": "YYYY-MM-DD", "birthPlace": "string", "sex": "Homme|Femme|Intersexe", "gender": "string",
  "height": "number cm", "weight": "number kg", "bodyFat": "number %", "muscleMass": "number kg",
  "waist": "number cm", "neck": "number cm", "bloodType": "O+|O-|A+|A-|B+|B-|AB+|AB-", "ethnicity": "string",
  "activityLevel": "Sédentaire|Léger (1-2x/sem)|Modéré (3-4x/sem)|Intense (5-6x/sem)|Athlète",
  "sportsPracticed": "string[]", "trainingHoursWeek": "number h", "sleepHours": "number h",
  "sleepQuality": "Excellente|Bonne|Moyenne|Mauvaise", "wakeTime": "string", "stressLevel": "number 0-10",
  "screenTime": "number h", "meditation": "Jamais|Occasionnel|Hebdo|Quotidien",
  "hrv": "number ms", "restingHr": "number bpm", "vo2max": "number ml/kg/min",
  "dietType": "Omnivore|Flexitarien|Pescetarien|Végétarien|Vegan|Carnivore|Cétogène|Paléo|Méditerranéen",
  "intermittentFasting": "Non|12h|14h|16h|18h|20h+|OMAD", "mealsPerDay": "number", "waterLiters": "number L",
  "alcoholDrinksWeek": "number", "caffeineMg": "number mg",
  "smoker": "Non|Occasionnel|Régulier|Ex-fumeur", "recreationalDrugs": "string",
  "allergiesFood": "string", "foodsAvoided": "string",
  "chronicConditions": "string", "surgeries": "string", "hospitalizations": "string",
  "allergies": "string", "medications": "string", "supplements": "string", "vaccinations": "string",
  "lastCheckup": "YYYY-MM-DD", "lastDental": "YYYY-MM-DD", "lastEye": "YYYY-MM-DD",
  "fatherHealth": "string", "motherHealth": "string", "grandparentsHealth": "string", "siblingsHealth": "string",
  "familyDiseases": "string[] (cancer, diabète, AVC, etc.)",
  "moodAvg": "number 0-10", "anxietyLevel": "number 0-10", "depressionHistory": "string", "therapy": "string",
  "cognitiveConcerns": "string", "sexualActivity": "string", "contraception": "string",
  "stiTests": "YYYY-MM-DD", "fertility": "string",
  "city": "string", "climate": "string", "occupation": "string", "workEnvironment": "string",
  "toxicExposure": "string", "sunExposure": "string", "airQuality": "string",
  "primaryGoals": "string[]", "currentChallenges": "string", "targetWeight": "number kg",
  "longevityTarget": "number ans", "openToHrt": "boolean", "openToBiohacking": "boolean",
  "primaryDoctor": "string", "specialists": "string", "preferredLab": "string", "insurance": "string",
  "notes": "string"
}`;

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { text } = await req.json() as { text: string };
  if (!text || text.length < 30) return NextResponse.json({ error: "text trop court" }, { status: 400 });

  const apiKey = anthropicApiKey();
  if (!apiKey) return NextResponse.json({ error: "Clé Anthropic manquante" }, { status: 500 });

  const client = new Anthropic({ apiKey });
  const sys = `Tu extrais des informations santé d'un texte (lettre de médecin, résumé bilan, notes perso) et tu remplis un profil JSON. Tu retournes UNIQUEMENT du JSON valide, sans markdown, sans explication. Si une info n'est pas présente, omets la clé. Aucune invention. Format des dates: YYYY-MM-DD. Tableaux pour multi-valeurs. Booléens: true/false.

SCHEMA cible (clés disponibles, à utiliser uniquement si pertinent):
${SCHEMA}`;

  const resp = await client.messages.create({
    model: "claude-sonnet-4-5-20250929", max_tokens: 2500, system: sys,
    messages: [{ role: "user", content: `Extraits du texte suivant les infos pour le profil. Retourne juste le JSON.\n\nTEXTE:\n${text}` }],
  });
  const content = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Pas de JSON détecté", raw: content }, { status: 500 });
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ extracted: parsed });
  } catch (e) {
    return NextResponse.json({ error: "JSON invalide", raw: content, detail: (e as Error).message }, { status: 500 });
  }
}
