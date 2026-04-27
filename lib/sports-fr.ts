export type SportRef = {
  id: string;
  name: string;
  category: string;
};

export const SPORTS: SportRef[] = [
  { id: "running", name: "Course à pied", category: "Endurance" },
  { id: "cycling", name: "Cyclisme (route)", category: "Endurance" },
  { id: "mtb", name: "VTT", category: "Endurance" },
  { id: "swimming", name: "Natation", category: "Endurance" },
  { id: "rowing", name: "Aviron / Rameur", category: "Endurance" },
  { id: "triathlon", name: "Triathlon", category: "Endurance" },
  { id: "hiking", name: "Randonnée", category: "Endurance" },
  { id: "walking", name: "Marche", category: "Endurance" },
  { id: "weight_lifting", name: "Musculation", category: "Force" },
  { id: "powerlifting", name: "Powerlifting", category: "Force" },
  { id: "crossfit", name: "Crossfit", category: "Mixte" },
  { id: "hiit", name: "HIIT", category: "Mixte" },
  { id: "calisthenics", name: "Calisthénie", category: "Force" },
  { id: "kettlebell", name: "Kettlebell", category: "Force" },
  { id: "boxing", name: "Boxe", category: "Combat" },
  { id: "mma", name: "MMA", category: "Combat" },
  { id: "bjj", name: "Brazilian Jiu-Jitsu", category: "Combat" },
  { id: "judo", name: "Judo", category: "Combat" },
  { id: "karate", name: "Karaté", category: "Combat" },
  { id: "muaythai", name: "Muay Thai", category: "Combat" },
  { id: "tennis", name: "Tennis", category: "Raquette" },
  { id: "padel", name: "Padel", category: "Raquette" },
  { id: "squash", name: "Squash", category: "Raquette" },
  { id: "badminton", name: "Badminton", category: "Raquette" },
  { id: "tabletennis", name: "Ping-pong", category: "Raquette" },
  { id: "football", name: "Football", category: "Collectif" },
  { id: "basketball", name: "Basketball", category: "Collectif" },
  { id: "volleyball", name: "Volleyball", category: "Collectif" },
  { id: "rugby", name: "Rugby", category: "Collectif" },
  { id: "handball", name: "Handball", category: "Collectif" },
  { id: "yoga", name: "Yoga", category: "Mind-body" },
  { id: "pilates", name: "Pilates", category: "Mind-body" },
  { id: "meditation", name: "Méditation (formelle)", category: "Mind-body" },
  { id: "qigong", name: "Qi Gong / Tai Chi", category: "Mind-body" },
  { id: "climbing", name: "Escalade (salle)", category: "Force-Endurance" },
  { id: "bouldering", name: "Bloc", category: "Force-Endurance" },
  { id: "alpinisme", name: "Alpinisme", category: "Endurance" },
  { id: "skiing", name: "Ski alpin", category: "Saisonnier" },
  { id: "snowboard", name: "Snowboard", category: "Saisonnier" },
  { id: "surf", name: "Surf", category: "Aquatique" },
  { id: "kitesurf", name: "Kitesurf", category: "Aquatique" },
  { id: "paddleboard", name: "Paddleboard", category: "Aquatique" },
  { id: "sailing", name: "Voile", category: "Aquatique" },
  { id: "horseriding", name: "Équitation", category: "Autre" },
  { id: "dancing", name: "Danse", category: "Mind-body" },
  { id: "golf", name: "Golf", category: "Autre" },
];

export const SPORT_BY_ID: Record<string, SportRef> = Object.fromEntries(
  SPORTS.map((s) => [s.id, s]),
);

/** Durée moyenne d'une séance en heures, par intensité. */
export const SESSION_HOURS: Record<"low" | "moderate" | "high", number> = {
  low: 1.0,
  moderate: 1.5,
  high: 2.0,
};
