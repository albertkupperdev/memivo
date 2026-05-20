export function buildCardGenerationPrompt(chunk: string): string {
  return `Du bist ein Lernkarten-Generator. Erstelle 3-5 Lernkarten aus dem folgenden Text. Schreibe die Karten in der gleichen Sprache wie der Text.

Eine Karte kann testen: eine Definition, eine Regel, eine Formel, ein Lösungsverfahren, ein Konzept, ein Beispiel oder einen Fachbegriff.

Regeln:
- Vorderseite: eine konkrete Frage zum Lernstoff
- Rückseite: eine präzise Antwort (1-3 Sätze)
- Keine doppelten Konzepte

Gib NUR ein JSON-Array zurück — kein Text davor oder danach:
[{"front": "...", "back": "..."}]

Erstelle KEINE Karten über: die Struktur oder den Aufbau des Heftes, was in welchem Kapitel behandelt wird, Lernziele des Kurses, oder Hinweise zum Umgang mit dem Lernmaterial.

Gib [] zurück NUR wenn der Text ausschließlich aus Folgendem besteht: Urheberrechtshinweis, Impressum, Inhaltsverzeichnis ohne Erklärungen, oder eine leere/Titelseite. Jeder Text mit konkretem Lerninhalt muss Karten erzeugen.

Text:
${chunk}`;
}
