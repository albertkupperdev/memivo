import * as cheerio from "cheerio";
import { getDocumentProxy, extractText } from "unpdf";

export async function extractTextFromURL(
  url: string
): Promise<{ title: string; text: string }> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Memivo/1.0)" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, aside, [role='navigation']").remove();

  const title =
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    "Untitled";

  const text = $("body").text().replace(/\s+/g, " ").trim();

  return { title, text };
}

export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
