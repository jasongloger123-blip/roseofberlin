# Rechnungen und Versand für Selesitina

## Bedienung

`https://roseofberlin.com/admin/invoices` führt zum geschützten Rechnungsbereich.
Die Anmeldung erfolgt mit dem freigeschalteten ChatGPT-Konto `wagloger@web.de`.
Die öffentliche Vercel-Website leitet Verwaltungsseiten zum bestehenden Sites-
Backend weiter. Dort liegen D1, Rechnungen und die bestätigte Identität.

1. Einmalig unter **Absender & Steuerangaben** Name, Anschrift, Steuernummer oder
   USt-IdNr. sowie den tatsächlich zutreffenden Steuerhinweis vervollständigen.
   Das aktuelle Preismodell weist keine Umsatzsteuer aus; dies muss bestätigt
   sein, bevor echte Rechnungen ausgestellt werden können.
2. Bestellung öffnen. Der Rechnungsentwurf übernimmt die gespeicherten Produkte,
   Preise und Kundendaten. Lieferadresse gegen die Anfrage prüfen.
3. Vorgeschlagene Versandvorlage prüfen und übernehmen oder den tatsächlichen
   Versandbetrag in EUR eingeben. Verfügbarkeit bestätigen und speichern.
4. Zahlungsanforderung erstellen. Lieferdatum angeben (bei Vorauszahlung das
   voraussichtliche Datum), Adresse bestätigen und Rechnung erstellen.
5. Im Rechnungsarchiv die Rechnung öffnen, drucken/als PDF speichern oder per
   E-Mail senden. Ein Wiederholungsklick erzeugt keine zweite Rechnung oder Mail.
6. Zahlungseingang und Versand weiterhin in der Bestellung bestätigen.

Rechnungen sind dauerhaft nummeriert: `ROB-RE-JAHR-SEQUENZ`. Eine ausgestellte
Rechnung friert Absender, Steuerhinweis, Kunde, Produkte, Preise, Versand,
Zahlungsdaten, Lieferdatum und Zahlungsziel ein. Interne Notizen erscheinen
nicht auf dem Beleg. Änderungen an Versand und Verfügbarkeit sind gesperrt,
solange eine aktive Rechnung existiert.

Eine Rechnung kann unter Angabe eines Grundes vollständig storniert werden.
Das Original bleibt erhalten, der negative Stornobeleg trägt die ursprüngliche
Nummer mit `-S`. Anschließend kann eine neue Rechnung mit neuer Nummer erstellt
werden. Stornieren erstattet keine Zahlung und storniert nicht automatisch die
Bestellung; das muss getrennt abgeglichen werden. Ein bereits versandtes Dokument
wird durch das Storno nicht aus dem Postfach des Kunden entfernt. Der öffentliche
Dokumentlink zeigt den Stornierungsstatus. Der Stornobeleg kann als PDF gespeichert
werden; sein Versand ist aktuell manuell.

## Grundlage der Versandvorlagen

Acht weitergeleitete E-Mail-Beispiele vom 10.11.2026 wurden ausgewertet. Ein
Beispiel ist doppelt enthalten. Historische Versandbeträge: USA 25,00 bzw.
33,68 USD, Australien 25,00 bzw. 33,38 AUD, Neuseeland 40,00 bzw. 59,75 NZD.
Die zugehörigen Umrechnungsverhältnisse sind aus den damaligen Produktpreisen
abgeleitet; sie sind ausdrücklich keine aktuellen Wechselkurse und keine
verbindlichen Tarife eines Versanddienstleisters.

Vorlagen unterscheiden Land und Warenkorb (ein Artikel, mehrere Artikel,
Geschenkset). Es gibt keine stillschweigende Übernahme auf unbekannte Länder
oder nicht belegte Kombinationen. Gewicht, Verpackung, Versicherung, Zoll,
Produktzulässigkeit und Zuschläge müssen vor der Freigabe geprüft werden.
Für Parfum ist insbesondere die tatsächliche Versandmöglichkeit zu prüfen.
Vorlagen lassen sich als direkte EUR-Beträge pflegen; dann ist der Kurs 1.

Die Rechnung bleibt wie der bestehende Shop in EUR zahlbar. So entstehen keine
widersprüchlichen Zahlungsbeträge durch manuell gerundete Fremdwährungen.
Alle Summen werden aus ganzzahligen Cents berechnet. In den Originalen wurden
unter anderem 49,32 + 40,00 als 89,66 und 119,67 + 59,75 als 170,02 angegeben.
Die tatsächlichen Summen sind 89,32 bzw. 179,42. Ein Beispiel enthält außerdem
abweichende Empfänger-/Adressangaben gegenüber der zitierten Kaufanfrage.
Diese Werte werden nicht als neue verbindliche Rechnungen übernommen.

## Historisches Archiv und Datenzugriff

Bestehende E-Mail-Rechnungen werden als unveränderte Textreferenzen archiviert,
ohne neue Rechnungsnummern, Zahlungseingänge oder ausgehende E-Mails auszulösen.
Ein identischer Inhalt wird nur einmal abgelegt. Private Importwerte liegen
in `INVOICE_ARCHIVE_1` bis `INVOICE_ARCHIVE_8`, nicht im öffentlichen Repository.
Der erste authentifizierte Aufruf des Rechnungsbereichs übernimmt sie idempotent
in D1. Unvollständige oder widersprüchliche Altbelege bleiben Referenzen.

Migration `0003_invoices.sql` ergänzt `invoice_settings`, `invoices` und
`invoice_archive`, eindeutige Nummern/aktive Rechnungen und unveränderliche
Beleg-Snapshots. Einstellungen besitzen eine Versionsprüfung gegen parallele
Änderungen. Originale und Stornos werden nicht gelöscht.

Rechnungs-E-Mails verwenden die bestehende Outbox mit Provider-Idempotenz,
Versandprotokoll und Wiederholschutz. Unklare Zustellungen werden weiterhin
manuell abgeglichen. E-Mail-Zustellung und Zahlungseingang sind unterschiedliche
Vorgänge. Die Druckansicht nutzt den Browser-PDF-Druck; es wird kein strukturiertes
E-Rechnungsformat erzeugt. Der CSV-Export ist eine Übersicht, kein DATEV-Export.

`WESTERN_UNION_NAME` und `MONEYGRAM_NAME` ergänzen die bestehenden Bank- und
PayPal-Zahlungsdaten. Werte werden für neue Zahlungsanforderungen eingefroren;
bereits verschickte Anforderungen bleiben unverändert.
