import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/supplements/from-url { url }
 * Fetches a product page, extracts og:title / og:image / og:site_name / title / brand hints.
 * Returns suggestions to pre-fill the supplement form.
 */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { url } = await req.json() as { url: string };
  if (!url || !/^https?:\/\//.test(url)) return NextResponse.json({ error: "URL invalide" }, { status: 400 });

  try {
    const u = new URL(url);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Vitals/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ error: `Page ${res.status}`, domain: u.hostname }, { status: 200 });
    const html = await res.text();

    function meta(name: string): string | null {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
      const m = html.match(re);
      if (m) return decode(m[1]);
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i");
      const m2 = html.match(re2);
      return m2 ? decode(m2[1]) : null;
    }
    function decode(s: string): string {
      return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
    }

    const ogTitle = meta("og:title");
    const ogImage = meta("og:image");
    const ogSiteName = meta("og:site_name");
    const ogDescription = meta("og:description");
    const productBrand = meta("product:brand") || meta("og:brand");
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitle || (titleMatch ? decode(titleMatch[1]) : "");

    // Heuristic name: take the title, remove the brand and store name suffixes/prefixes
    let suggestedName = title;
    if (productBrand) suggestedName = suggestedName.replace(new RegExp(productBrand, "gi"), "").trim();
    if (ogSiteName) suggestedName = suggestedName.replace(new RegExp(ogSiteName, "gi"), "").trim();
    // Strip common Amazon / iHerb / store boilerplate
    suggestedName = suggestedName
      .replace(/\bAmazon\.[a-z.]+\s*[:\-]?\s*/gi, "")
      .replace(/\biHerb[:\-]?\s*/gi, "")
      .replace(/\s*[\-–|]\s*Amazon.*/gi, "")
      .replace(/\s*[\-–|]\s*iHerb.*/gi, "")
      .replace(/^\W+|\W+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    return NextResponse.json({
      ok: true,
      domain: u.hostname.replace(/^www\./, ""),
      title,
      suggestedName: suggestedName || title,
      brand: productBrand || ogSiteName || null,
      image: ogImage,
      description: ogDescription,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
