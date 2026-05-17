import { PDFDocument, rgb, PDFFont } from "pdf-lib";
import * as fontkit from "fontkit";

type CustomerData = {
  name: string;
  short_name: string;
  address: string;
  phone?: string;
};

type LinePart = {
  text: string;
  bold?: boolean;
};

type Line = {
  parts: LinePart[];
};

async function loadFont(pdfDoc: PDFDocument, file: string): Promise<PDFFont> {
  const url = `/fonts/${file}`;
  const fontBytes = await fetch(url).then(res => res.arrayBuffer());
  return await pdfDoc.embedFont(fontBytes);
}

export async function generateKargoPdf(data: CustomerData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 50;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const regularFont = await loadFont(pdfDoc, "Roboto-Regular.ttf");
  const boldFont = await loadFont(pdfDoc, "Roboto-Bold.ttf");

  // --- MAIN TITLE ---
  const titleText = "KARGO GÖNDERİM FORMU";
  const titleFontSize = 28;

  const titleWidth = boldFont.widthOfTextAtSize(titleText, titleFontSize);
  const titleX = (pageWidth - titleWidth) / 2;
  let y = pageHeight - margin;

  page.drawText(titleText, {
    x: titleX,
    y,
    size: titleFontSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  y -= titleFontSize + 20;

  const lines: Line[] = [
    { parts: [{ text: "GÖNDERİCİ ÜNVAN-ADRES:", bold: true }] },
    { parts: [{ text: "DAYAN DİŞLİ SANAYİ" }] },
    { parts: [{ text: "İkitelli O.S.B. Çevre Sanayi Sitesi" }] },
    { parts: [{ text: "8. Blok No: 45/47" }] },
    { parts: [{ text: "Başakşehir / İstanbul, 34490" }] },
    {
      parts: [
        { text: "Telefon: ", bold: true },
        { text: "0 536 583 74 20", bold: false },
      ],
    },

    { parts: [{ text: "" }] },

    { parts: [{ text: "ALICI ÜNVAN-ADRES:", bold: true }] },
    {
      parts: [
        { text: "Alıcı: ", bold: true },
        { text: data.name, bold: false },
      ],
    },
    {
      parts: [
        { text: "İsim: ", bold: true },
        { text: data.short_name, bold: false },
      ],
    },
    {
      parts: [
        { text: "Adres: ", bold: true },
        { text: data.address, bold: false },
      ],
    },
    {
      parts: [
        { text: "Telefon: ", bold: true },
        { text: data.phone ?? "-", bold: false },
      ],
    },
  ];

  let fontSize = 18;
  const minFontSize = 8;

  while (fontSize > minFontSize) {
    const lineHeight = fontSize + 6;
    const totalHeight = lines.length * lineHeight;

    if (y - totalHeight >= margin) break;
    fontSize--;
  }

  const lineHeight = fontSize + 6;

  for (const line of lines) {
    let x = margin;

    for (const p of line.parts) {
      const txt = p.text ?? "";
      const isBold = p.bold === true;
      const font = isBold ? boldFont : regularFont;
      const textWidth = font.widthOfTextAtSize(txt, fontSize);

      page.drawText(txt, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      x += textWidth;
    }

    y -= lineHeight;
  }

  return await pdfDoc.save();
}
