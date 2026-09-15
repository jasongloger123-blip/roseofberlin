# Rose of Berlin: Bestellungen und Zahlungsanforderungen

## Architektur und Hosting

Die öffentliche Website sendet ausschließlich an `POST /api/interesse`. Eingaben,
Produktvarianten und Mengen werden serverseitig geprüft; Preis-/Währungs-/Statusfelder
im Request werden zurückgewiesen. Der Katalog in `lib/orders/domain.ts` ist die
verbindliche Preisquelle. Alle gespeicherten Beträge sind Integer-Cents in EUR.
Die anderen Währungen auf der Website dienen ausschließlich der Orientierung.

`worker/index.ts` stellt die echten Cloudflare-Bindings requestgebunden über
AsyncLocalStorage bereit. `lib/orders/runtime.ts` liest DB und Umgebungswerte;
`lib/orders/service.ts` enthält Geschäftslogik, `repository.ts` vorbereitete
D1-Abfragen, `mail.ts` den Versand und `templates.ts` die Dokumente.
Es werden keine Zahlungsdaten in Client-Komponenten oder Client-Konfiguration übernommen.

**Produktionsziel ist der vorhandene Cloudflare/Sites-Worker mit D1-Binding `DB`.**
Die Manifest-ID in `.openai/hosting.json` bleibt erhalten. Das Repository enthält
zusätzlich eine ältere `vercel.json` mit `next build`. Ein gewöhnliches Vercel-
Deployment besitzt weder die D1-Bindings noch die verifizierte Sites-Identität:
Bestell-APIs verweigern dort die Verarbeitung, statt Daten scheinbar erfolgreich
anzunehmen. Ein Push auf GitHub allein verbindet keine Custom Domain mit Sites.
`roseofberlin.de` muss tatsächlich auf diesen Worker zeigen. Eine `.com`-Domain
kann am Domainanbieter auf dieselbe kanonische `.de`-Domain weiterleiten. Kein
DNS-/Domainwechsel wird durch diese Codeänderung vorgenommen.

Kunden benötigen kein Konto. `/admin/orders` nutzt die vorhandene, von Sites
verwaltete ChatGPT-Anmeldung. Jeder Admin-Endpunkt kontrolliert die vom Dispatcher
bestätigte Identität und zusätzlich `ORDER_ADMIN_EMAILS`. Ohne Allowlist erhält
niemand Zugriff. Bloß vom Client gesetzte Identitätsheader auf Node/Vercel werden
abgewiesen. Direkten Zugriff auf den Worker außerhalb des Sites-Dispatchers nicht
öffentlich freigeben; bei einer Migration der Hosting-Infrastruktur muss diese
Vertrauensgrenze neu implementiert werden. Auch JSON-Schreibzugriffe benötigen
den passenden Origin. Admin- und Zahlungsantworten sind `private, no-store`.

## Migrationen

Bestehende `purchase_interests` bleiben unverändert; es gibt keine automatische
Umwandlung unvollständiger Altanfragen zu neuen Bestellungen.

- `0001_dizzy_vivisector.sql`: `orders`, `order_items`, `order_email_events`,
  `order_email_attempts`, `order_rate_limits` plus eindeutige Schlüssel und Indizes.
- `0002_order_snapshot_guards.sql`: Datenbank-Trigger verhindern Änderungen an
  Preis-Snapshots sowie ungültige Mengen und Versand-/Gesamtsummen.

Die Drizzle-Snapshots und Journal-Einträge liegen unter `drizzle/meta`.
Sites wendet die mitgelieferten Migrationen bei der Veröffentlichung an.
Bei eigener Cloudflare-Verwaltung die SQL-Dateien in Reihenfolge mit dem bestehenden
Migrationsverfahren auf dieselbe D1-Datenbank anwenden; keine Tabellen im laufenden
Request erstellen. Bereits angewandte Migrationen nicht nachträglich ändern.

Eine D1-`batch()`-Transaktion legt Bestellung, unveränderliche Positionen,
Bestellnummer und beide Eingangs-Mailereignisse zusammen an. Die interne ID ist
eine UUID; die Bestellnummer ist `ROB-JAHR-SEQUENZ`. Die Sequenz ist global
aufsteigend, nicht jährlich zurückgesetzt; Lücken durch konkurrierende Einfügungen
sind möglich. Eine Bestellnummer wird nie als öffentlicher Zugangsschlüssel verwendet.

## Environment Variables

In Sites unter Laufzeitvariablen/Secrets hinterlegen. Keine `NEXT_PUBLIC_`-
oder `VITE_`-Präfixe verwenden. `.env.example` enthält keine Zugangsdaten.

| Variable | Bedeutung |
| --- | --- |
| `RESEND_API_KEY` | Resend-Schlüssel mit Sendeberechtigung für die verifizierte Absenderdomain; Secret |
| `ORDER_FROM_EMAIL` | Verifizierter Absender, z. B. `Rose of Berlin <bestellungen@roseofberlin.de>` |
| `ORDER_NOTIFICATION_EMAIL` | Interne Empfängeradresse für Selesitina; bisher `wagloger@web.de` |
| `PUBLIC_BASE_URL` | Produktionsbasis `https://roseofberlin.de`, HTTPS-Origin ohne Pfad/Parameter |
| `ORDER_ADMIN_EMAILS` | Kommagetrennte, tatsächlich für ChatGPT verwendete Admin-E-Mail-Adressen |
| `BANK_ACCOUNT_NAME` | Kontoinhaber; nur serverseitig |
| `BANK_IBAN` | IBAN; nur serverseitig |
| `BANK_BIC` | BIC; nur serverseitig |
| `PAYPAL_ADDRESS` | PayPal-E-Mail-Adresse; nur serverseitig |

Mindestens eine vollständige Bankverbindung oder PayPal-Adresse muss vorhanden
sein, bevor eine Zahlungsanforderung erzeugt werden kann. Teilweise ausgefüllte
Bankdaten werden abgewiesen. Absender und Benachrichtigungsadresse müssen ebenfalls
konfiguriert sein. Der API-Key wird erst beim Mailversand gebraucht: Ein Ausfall
oder fehlender Key kann gespeicherte Bestellungen und Statuswechsel nicht löschen.

## Resend und DNS einrichten

1. Im Resend-Konto eine eigene Absenderdomain oder Subdomain hinzufügen.
2. Die **konkret von Resend angezeigten** DKIM-, SPF- und gegebenenfalls MX-Einträge
   beim DNS-Anbieter eintragen. Keine generischen DNS-Werte aus Beispielen übernehmen.
3. Domainverifizierung abwarten und einen passend eingeschränkten API-Key anlegen.
4. `ORDER_FROM_EMAIL` auf eine Adresse dieser verifizierten Domain setzen;
   `ORDER_NOTIFICATION_EMAIL` auf Selesitinas überwachte Adresse setzen.
5. DMARC für die Absenderdomain passend zur übrigen Mail-Infrastruktur konfigurieren.
   Keine vorhandenen SPF-Einträge durch einen zweiten SPF-Record duplizieren.
6. Schlüssel als Secret hinterlegen und mit einer ausdrücklich dafür bestimmten
   Testadresse Eingangsbestätigung, Zahlungsanforderung, Zahlungsbestätigung und
   Versandbestätigung prüfen. In diesen automatisierten Tests wird kein echter
   Empfänger kontaktiert.
7. Cloudflare-/Resend-Auftragsverarbeitung und tatsächliche Domain-/Provider-
   Konfiguration mit der veröffentlichten Datenschutzerklärung abstimmen.

Quellen: [Resend-Domainverifizierung](https://resend.com/docs/dashboard/domains/introduction),
[Resend-DPA](https://resend.com/legal/dpa),
[DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).

## Ablauf für Kunden

Produkt, Größe, Menge, Name, E-Mail und Lieferadresse eingeben; Adresszusatz und
Telefon bleiben freiwillig. Deutschland ist vorausgewählt. Absenden erzeugt eine
unverbindliche Kaufanfrage mit Bestellnummer. Eine Eingangsbestätigung nennt den
Warenwert; Versand und Verfügbarkeit sind ausdrücklich noch offen.

Nach Prüfung folgt die Zahlungsanforderung mit EUR-Endbetrag, Versandkosten,
Zahlungsdaten und Bestellnummer als Verwendungszweck. Der zufällige Link unter
`/order/[secureToken]/payment` zeigt eine druckbare Übersicht. Über „Drucken / als
PDF speichern“ wird der Browserdruck verwendet. Das Dokument ist eine
Zahlungsübersicht, keine automatisierte steuerliche Rechnung.

## Ablauf für Selesitina

1. `/admin/orders` öffnen, mit der freigeschalteten ChatGPT-Adresse anmelden.
2. Bestellung öffnen und Produkte, Lieferadresse und Verfügbarkeit prüfen.
3. Versandkosten in EUR eintragen (auch `0,00` erlaubt), „Verfügbarkeit bestätigt“
   aktivieren und speichern. Interne Notizen erscheinen nicht beim Kunden.
4. „Zahlungsanforderung senden“. Der Server prüft die gespeicherten Preise und
   berechnet den Endbetrag. Bank-/PayPal-Daten werden für diese Anforderung eingefroren.
5. Tatsächlichen Eingang auf Bank-/PayPal-Konto prüfen, dann
   „Zahlungseingang bestätigen“. Zeitpunkt und Kundenmail werden gespeichert.
6. „Vorbereitung starten“, danach optional Trackingnummer eintragen und
   „Als versendet markieren“. Der Kunde erhält eine Versandbestätigung.

| Status | Erlaubter nächster Schritt |
| --- | --- |
| `received` | Prüfung beginnen / Verfügbarkeit und Versand speichern / stornieren |
| `needs_review` | Zahlungsanforderung senden nach vollständiger Prüfung / stornieren |
| `awaiting_payment` | Zahlung bestätigen / Konditionen vor Zahlung korrigieren / stornieren |
| `paid` | Vorbereitung starten |
| `processing` | Versand bestätigen |
| `shipped` | Abgeschlossen |
| `cancelled` | Abgeschlossen |

Ein erneuter Klick auf denselben Status-/Versandschritt ist wirkungslos.
Veraltete Bearbeitungsstände werden über `version` abgefangen. Bei Änderung der
Versandkosten/Verfügbarkeit vor Zahlung wird die alte Anforderung aufgehoben und
bei erneuter Freigabe eine neue Revision erstellt. Der alte öffentliche Link ist
dann ungültig; die neue E-Mail erklärt, dass sie vorherige Anforderungen ersetzt.
Während ein Zahlungsversand unklar oder im Gange ist, sind solche Änderungen gesperrt.
Nach Zahlung sind Preis-/Versandänderungen gesperrt. Erstattung und Wiedereröffnung
sind bewusst kein automatischer Statuswechsel.

## Idempotenz, Versandfehler und Wiederholungen

Der Browser hält einen zufälligen Idempotenzschlüssel für denselben Formularinhalt.
Im HTTPS-Sitzungsspeicher stehen nur Schlüssel und SHA-256-Fingerprint, keine
Adressdaten. Bei blockiertem Sitzungsspeicher oder HTTP-Vorschau gilt derselbe
Schutz für die offene Seite über ihren Arbeitsspeicher. Der Server prüft den
Schlüssel und den normalisierten Inhalt. Parallele Versuche erzeugen genau eine
Bestellung; ein Schlüssel mit anderem Inhalt liefert HTTP 409.

Mailereignisse haben dauerhafte eindeutige Deduplizierungsschlüssel. Der Inhalt
wird eingefroren. Eine atomare D1-Lease verhindert paralleles Senden. Resend erhält
denselben `Idempotency-Key` bei sicheren Wiederholungen. Erfolgreich an den Provider
übergebene Ereignisse werden dauerhaft nicht wieder gesendet. „An Mailanbieter
übergeben“ bedeutet keine garantierte Zustellung im Postfach; Bounces sind im
Resend-Dashboard zu prüfen.

Fehler werden als `failed` mit unkritischem Fehlercode und Versuch protokolliert.
Die Bestellung bleibt gespeichert. In der Verwaltung „Ausstehende / fehlgeschlagene
E-Mails erneut versuchen“ verwenden, nachdem die Ursache behoben ist. Es läuft
kein zusätzlicher Cron-Dienst: unbearbeitete Ereignisse werden beim initialen
Request, bei Adminaktionen oder durch diesen Retry-Button verarbeitet.

Ein abgebrochener Request kann einen abgelaufenen `sending`-Status hinterlassen;
der nächste Versuch übernimmt ihn nach Ablauf der 60-Sekunden-Lease. Resend bewahrt
Idempotenzschlüssel 24 Stunden auf. Bei unklaren Ergebnissen blockieren wir schon
nach 23 Stunden weitere automatische Versuche (`manual_review`). Dann:

- Im Resend-Dashboard anhand Empfänger, Bestellnummer und Zeit prüfen.
- Bereits gesendet: Resend-E-Mail-ID in der Verwaltung eintragen und bestätigen.
- Sicher nicht gesendet: „Im Anbieter geprüft: nicht versendet – erneut senden“.
  Erst die ausdrückliche Bestätigung erzeugt einen neuen Provider-Schlüssel.
- Ist das Ergebnis weiter unklar, nicht erneut versenden.

Details: [Resend-Idempotenz](https://resend.com/docs/dashboard/emails/idempotency-keys),
[D1-Transaktionen mit batch](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## Datenschutz und Betrieb

Kundendaten, Adressen, Bankdaten, Tokens und Providerantworten werden nicht in
Anwendungslogs geschrieben. Mail-Payloads in D1 enthalten notwendige Empfänger-
und Bestelldaten und müssen beim Lösch-/Aufbewahrungsprozess mit berücksichtigt
werden. Die Verwaltung listet diese Payloads nicht im Client auf. Öffentliche
Dokumente verwenden 256-Bit-Zufallstokens, `noindex`, `no-store`, `no-referrer`, eine
restriktive CSP und keine externen Schrift-/Bildaufrufe. Links vertraulich behandeln;
bei Preisrevision werden sie rotiert. Keine öffentlichen Bestelllisten.

Rate-Limit-Kennungen sind stundenweise gehasht. Bereinigung entfernt abgelaufene
Kennungen beim nächsten Bestellrequest. Fünf neue Anfragen pro E-Mail/Stunde und
30 pro IP/Stunde; sichere Wiederholungen sind ausgenommen. Das ist ein Basisschutz,
kein Ersatz für das Hosting-eigene Bot-/Abuse-Management.

## Spätere E-Mail-Importe und Zahlungsanbieter

`lib/orders/import.ts` ist die begrenzte Import-Schnittstelle: Extraktionen ergeben
nur einen unbestätigten `EmailOrderDraft`; Beträge werden verworfen. Es gibt noch
keinen Postfachzugriff, Webhook, Draft-Speicher oder Kunden-Bestätigungslink.
Eine spätere Erweiterung muss Drafts isoliert speichern, Links sicher tokenisieren
und erst nach expliziter Kundenbestätigung mit `parseOrder` + `createOrder` in den
normalen Ablauf überführen. Freitext oder KI-Ausgabe darf niemals Zahlung auslösen.

Für spätere PayPal-/Stripe-Webhooks: Signatur serverseitig überprüfen, Provider-
Event-ID eindeutig speichern, Bestellung anhand einer vom Server vergebenen
Referenz zuordnen, Währung und eingegangenen Betrag mit der Zahlungsrevision
vergleichen. Nur bestätigte vollständige Zahlungen atomar zu `paid` überführen;
nie den Browser-Redirect als Zahlungsnachweis verwenden. Teilzahlungen,
Rückerstattungen und überholte Revisionen separat zur Prüfung markieren.

## Prüfung

- `npm run test:orders`: Validierung, echte lokale D1-Migrationen und Transaktionen,
  parallele Bestellungen, immutable Snapshots, Versandberechnung, Zahlungsrevisionen,
  Statuswechsel, Mailfehler/-leases, sichere Dokumentlinks und Adminzugriff.
- `npm test`: dieselben Tests, Produktionsbuild/Artefaktprüfung, HTML-Smoke-Test
  und vollständiger Ablauf gegen den kompilierten Worker mit echter lokaler D1.
- `npm run lint`, `npx tsc --noEmit --incremental false`.
- Responsive Kaufanfrage und Dokument bei 390 px sowie Desktop im Browser prüfen.

Der frühere HTML-Test verlangte ein im bestehenden Produkt bereits nicht mehr
vorhandenes Starter-Metatag `codex-preview=development`. Er kontrolliert jetzt den
Produktions-Canonical, die Lieferadressfelder und das Fehlen von FormSubmit und
Vercel-Previewlinks im gerenderten HTML. Die bisherigen HTTP-/HTML-Prüfungen bleiben.
