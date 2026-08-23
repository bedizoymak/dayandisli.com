# Cari Hesap Ekstresi print — operator notes

The printed statement now includes an application footer ("Sayfa X / Y" and
"<date> tarihinde hazırlanmıştır.") built into the document itself.

**Before printing a customer statement, uncheck "Headers and footers" in the
browser's print dialog** (Chrome/Edge: More settings → Headers and footers).
If left on, the browser adds its own footer line — page URL and print
date/time — alongside the application's footer, producing two footers on
the page. This is the browser's own print setting, not an application
defect, and cannot be overridden from the page itself.

If "Cari Hesabı Yazdır" is disabled with the tooltip "Paraşüt mutabakatı
tamamlanana kadar ekstre yazdırılamaz.", the statement's Paraşüt
reconciliation has not completed yet — printing is blocked deliberately so
a customer never receives a document built from data known to be stale or
mismatched. This normally clears on its own within a few minutes as the
background sync catches up; retry shortly.
