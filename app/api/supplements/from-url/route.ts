import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Deep crawler: fetches product page, extracts main text + meta,
 * and passes everything to Claude for structured extraction.
 * Returns: name, brand, image, ingredients[], servingSize, suggestedUse, price.
 */

function stripHtml(html: string): string {
  // Remove scripts, styles, comments, nav/footer/aside semantically heavy regions
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, (m) => {
      // keep meta tags from head
      const metas = m.match(/<meta[^>]+>/gi) || [];
      const title = m.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return (title ? title[0] : "") + " " + metas.join(" ");
    });

  // Convert tables to text-friendly format with newlines
  s = s.replace(/<\/(?:tr|li|p|h[1-6]|div|section|article)>/gi, "\n");
  s = s.replace(/<\/(?:td|th)>/gi, " | ");
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // Extract meta values (preserve structure)
  s = s.replace(/<meta\s+([^>]+)>/gi, (_, attrs: string) => {
    const m = /(?:property|name)=["']([^"']+)["'][^"']*content=["']([^"']+)["']/i.exec(attrs)
      || /content=["']([^"']+)["'][^"']*(?:property|name)=["']([^"']+)["']/i.exec(attrs);
    if (m) {
      const isFirst = /(?:property|name)=/i.test(attrs.slice(0, 40));
      const k = isFirst ? m[1] : m[2];
      const v = isFirst ? m[2] : m[1];
      return `\nMETA[${k}]: ${v}\n`;
    }
    return " ";
  });

  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  s = s.replace(/\s+/g, " ").replace(/(\s*\n\s*){2,}/g, "\n");
  return s.trim();
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { url } = await req.json() as { url: string };
  if (!url || !/^https?:\/\//.test(url)) return NextResponse.json({ error: "URL invalide" }, { status: 400 });

  let html = "";
  let domain = "";
  try {
    const u = new URL(url);
    domain = u.hostname.replace(/^www\./, "");
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return NextResponse.json({ error: `Page HTTP ${res.status}`, domain }, { status: 200 });
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 500 });
  }

  // Quick parse for og:image so we always have one even if Claude fails
  const ogImageMatch = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
  const ogImage = ogImageMatch ? ogImageMatch[1] : null;

  // Strip + truncate to ~25k chars (room for prompt overhead)
  const text = stripHtml(html).slice(0, 25000);

  const apiKey = anthropicApiKey();
  if (!apiKey) {
    // Fallback: basic parse
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return NextResponse.json({
      ok: true, domain, image: ogImage,
      suggestedName: titleMatch ? titleMatch[1].trim() : "",
      ingredients: [], note: "Claude API non configurée — extraction basique uniquement.",
    });
  }

  const client = new Anthropic({ apiKey });
  const sys = `Tu es un extracteur structuré de produits de supplémentation. Tu lis le contenu d'une page produit (texte HTML brut + meta tags) et tu retournes UN UNIQUE objet JSON. Tu n'inventes jamais. Si une info manque, tu omets la clé.

Schéma de sortie:
{
  "name": "Nom du produit (sans marque)",
  "brand": "Marque",
  "image": "URL absolue de l'image principale du produit (utilise og:image en priorité)",
  "servingSize": "Ex: 5 capsules par jour, 1 sachet, 30 mL...",
  "suggestedUse": "Mode d'emploi recommandé en une phrase courte",
  "price": "Prix unitaire si visible, ex: 39 EUR",
  "ingredients": [
    { "name": "Nom de l'ingrédient en français quand possible", "dose": "126", "unit": "mg", "nrv": 34, "category": "Vitamine|Minéral|Acide aminé|Plante|Lipide|Antioxydant|Probiotique|Autre" },
    ...
  ]
}

Règles:
- Pour chaque ingrédient sur la fiche "Nutrients & Other Substances", extrais nom + dose + unité + %NRV (si présent)
- Si dose en mg mais le label dit μg, garde μg
- Catégorise grossièrement (Vitamine, Minéral, Acide aminé, Plante/Extrait, Lipide, Antioxydant, Probiotique, Autre)
- Convertis les noms anglais en français quand évident (Magnesium → Magnésium, Choline → Choline, Hyaluronic acid → Acide hyaluronique, L-leucine → L-leucine, Peppermint leaf extract → Extrait de feuille de menthe poivrée, Vitamin C → Vitamine C, Niacin → Vitamine B3 (niacine), Pantothenic acid → Vitamine B5 (acide pantothénique), Tomato fruit extract → Extrait de tomate, Marigold flower extract → Extrait de souci (lutéine), Folic acid → Folates B9, Chromium → Chrome, Selenium → Sélénium, Manganese → Manganèse, Zinc → Zinc, Iodine → Iode, Boron → Bore, Copper → Cuivre, Biotin → Biotine, etc.)
- Sors UNIQUEMENT le JSON, sans markdown, sans prose.`;

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 3000,
      system: sys,
      messages: [{ role: "user", content: `URL: ${url}\nDomain: ${domain}\n\nContenu de la page:\n\n${text}` }],
    });
    const content = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ ok: true, domain, image: ogImage, error: "Pas de JSON détecté", raw: content.slice(0, 500) });
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.image && ogImage) parsed.image = ogImage;
    parsed.ok = true;
    parsed.domain = domain;
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, domain, image: ogImage }, { status: 500 });
  }
}
