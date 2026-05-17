import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fontRobotoRegular, fontRobotoBold } from "@/lib/pdfAssets/font-roboto";
import { QuotationFormData, ProductRow } from "../types";

export const createQuotationPDF = (
  teklifNo: string,
  formData: QuotationFormData,
  calculateRowTotal: (row: ProductRow) => number,
  calculateSubtotal: () => number,
  calculateKDV: () => number,
  calculateTotal: () => number,
  formatCurrencyFn: (amount: number, currency?: string) => string,
  issueDate?: Date | string
) => {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const dateToUse = issueDate 
    ? (typeof issueDate === 'string' ? new Date(issueDate) : issueDate).toLocaleDateString("tr-TR")
    : new Date().toLocaleDateString("tr-TR");

  // ---- Fonts ----
  doc.addFileToVFS("Roboto-Regular.ttf", fontRobotoRegular);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

  doc.addFileToVFS("Roboto-Bold.ttf", fontRobotoBold);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  doc.setFont("Roboto", "normal");
  doc.setTextColor(55, 65, 81); // text-gray-700

  // ===================================================================
  // HEADER
  // ===================================================================
  const drawHeader = (pageNumber: number, totalPages: number) => {
    // Üst ince çizgi
    doc.setDrawColor(55, 65, 81);
    doc.setLineWidth(0.6);
    doc.line(0, 28, pageWidth, 28);

    // Logo
    const logoImg = new Image();
    logoImg.src = "/logo-header.png";
    doc.addImage(logoImg, "PNG", marginX, 6, 40, 17);

    // Başlık
    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.setTextColor(55, 65, 81);

    const titleText = "SİPARİŞ FİYAT TEKLİFİ";
    const titleWidth = doc.getTextWidth(titleText);
    const titleX = (pageWidth - titleWidth) / 2;
    const titleY = 17;
    doc.text(titleText, titleX, titleY);

    // Sağ bilgi kutusu
    const fontSize = 7;
    const rightMargin = 5;
    const paddingX = 3;
    const paddingY = 2;
    const lineGap = 4;

    const teklifSuffix = teklifNo.slice(-3).trim();
    const documentNo = `D ${teklifSuffix}-1`;

    const labelDate = "Tarih: ";
    const valueDate = dateToUse;

    const labelDoc = "Dosya No: ";
    const valueDoc = documentNo;

    const labelOffer = "Teklif No: ";
    const valueOffer = teklifNo;

    // En geniş etiket
    doc.setFont("Roboto", "bold");
    doc.setFontSize(fontSize);
    const labelMaxWidth = Math.max(
      doc.getTextWidth(labelDate),
      doc.getTextWidth(labelDoc),
      doc.getTextWidth(labelOffer)
    );

    // En geniş değer
    doc.setFont("Roboto", "normal");
    const valueWidths = [
      doc.getTextWidth(valueDate),
      doc.getTextWidth(valueDoc),
      doc.getTextWidth(valueOffer),
    ];
    const maxValueWidth = Math.max(...valueWidths);

    const boxTextWidth = labelMaxWidth + 3 + maxValueWidth;
    const boxWidth = boxTextWidth + paddingX * 2;
    const boxHeight = paddingY * 2 + 3 * lineGap;

    const boxY = 9;
    const boxX = pageWidth - rightMargin - boxWidth;

    // Kutu çizimi
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 1.5, 1.5, "FD");

    let y = boxY + paddingY + 3;
    const x = boxX + paddingX;

    const rows: [string, string][] = [
      [labelDate, valueDate],
      [labelDoc, valueDoc],
      [labelOffer, valueOffer],
    ];

    rows.forEach(([label, value]) => {
      doc.setFont("Roboto", "bold");
      doc.setTextColor(107, 114, 128);
      doc.text(label, x, y);

      doc.setFont("Roboto", "normal");
      doc.setTextColor(55, 65, 81);
      doc.text(value, x + labelMaxWidth + 3, y);

      y += lineGap;
    });
  };

  // ===================================================================
  // FOOTER
  // ===================================================================
  const drawFooter = (pageNumber: number, totalPages: number) => {
    const footerHeight = 7;

    doc.setFillColor(243, 244, 246);
    doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, "F");

    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);

    const currentYear = new Date().getFullYear();
    const line1 = `© ${currentYear} DAYAN DİŞLİ SANAYİ | İkitelli O.S.B. Çevre Sanayi Sitesi 8. Blok No:45/47 Başakşehir / İstanbul`;

    // Metin (adres) — alt barın ortasında
    doc.text(line1, pageWidth / 2, pageHeight - footerHeight + 4.5, {
      align: "center",
    });

    // Sayfa numarası
    doc.setFontSize(7).setTextColor(120, 120, 120);
    doc.text(
      `Sayfa ${pageNumber} / ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 2.5,
      { align: "right" }
    );
  };

  // ===================================================================
  // GÖVDE İÇERİK
  // ===================================================================
  let y = 32;

  // --- SATICI - ALICI Kartları ---
  const cardGap = 6;
  const sellerCardWidth = (pageWidth - 2 * marginX - cardGap) / 2;
  const buyerX = marginX + sellerCardWidth + cardGap;
  const maxValueWidth = sellerCardWidth - 35;

  const sellerRows: [string, string][] = [
    ["Firma Adı:", "DAYAN DİŞLİ & PROFİL TAŞLAMA"],
    ["İlgili Kişi:", "Hayrettin Dayan"],
    ["Telefon:", "+90 536 583 74 20"],
    ["Email:", "info@dayandisli.com"],
  ];

  const buyerRows: [string, string][] = [
    ["Firma Adı:", formData.firma || "-"],
    ["İlgili Kişi:", formData.ilgiliKisi || "-"],
    ["Telefon:", formData.tel || "-"],
    ["Email:", formData.email || "-"],
  ];

  const rowHeights = sellerRows.map((row, i) => {
    const sLines = doc.splitTextToSize(row[1], maxValueWidth).length;
    const bLines = doc.splitTextToSize(buyerRows[i][1], maxValueWidth).length;
    const maxLines = Math.max(sLines, bLines);

    if (i === 0) return maxLines * 2; // Firma Adı
    return maxLines * 5;
  });

  const cardHeight = 5 + rowHeights.reduce((sum, h) => sum + h, 0);

  // Kart Çerçeveleri
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.rect(marginX, y, sellerCardWidth, cardHeight, "FD");
  doc.rect(buyerX, y, sellerCardWidth, cardHeight, "FD");

  // Başlıklar
  doc.setFont("Roboto", "bold").setFontSize(9).setTextColor(31, 41, 55);
  doc.text("TEDARİKÇİ BİLGİLERİ", marginX + 3, y + 6);
  doc.text("MÜŞTERİ BİLGİLERİ", buyerX + 3, y + 6);

  // İçerik
  doc.setFont("Roboto", "normal").setFontSize(8);
  let offsetY = y + 12;

  sellerRows.forEach(([label, sValue], i) => {
    const bValue = buyerRows[i][1];
    const sText = doc.splitTextToSize(sValue, maxValueWidth);
    const bText = doc.splitTextToSize(bValue, maxValueWidth);

    doc.setTextColor(107, 114, 128);
    doc.text(label, marginX + 3, offsetY);
    doc.text(label, buyerX + 3, offsetY);

    doc.setTextColor(55, 65, 81);
    doc.text(sText, marginX + 28, offsetY);
    doc.text(bText, buyerX + 28, offsetY);

    offsetY += rowHeights[i];
  });

  y = y + cardHeight + 10;

  // --- AÇIKLAMA KUTUSU ---
  const descBoxHeight = 34;
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(252, 252, 253);
  doc.rect(marginX, y, pageWidth - 2 * marginX, descBoxHeight, "FD");

  const ilgili = formData.ilgiliKisi ? formData.ilgiliKisi : "";
  const descX = marginX + 3;
  let descY = y + 6;

  doc.setFont("Roboto", "bold");
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.text(`Sayın ${ilgili},`, descX, descY);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(
    "Aşağıda özellikleri ve istenen şartları tanımlanmış ürünlerin/hizmetlerin sipariş teklif formudur.",
    descX,
    descY + 9
  );

  doc.text("İyi çalışmalar dileriz.", descX, descY + 14);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(9);
  doc.text("Saygılarımızla,", descX, descY + 21);
  doc.text("Hayrettin DAYAN", descX, descY + 25);

  y = y + descBoxHeight + 8;

  // ===================================================================
  // ÜRÜN TABLOSU
  // ===================================================================
  const tableStartY = y + 6;

  const tableHead = [
    ["No", "Ürün", "Hizmet", "Malzeme", "Miktar", "Birim", "Birim Fiyat", "KDV", "Toplam"],
  ];

  const tableBody = formData.products.map((p: ProductRow, index) => [
    index + 1,
    p.kod || "",
    p.cins || "",
    p.malzeme || "",
    p.miktar.toString(),
    p.birim || "",
    formatCurrencyFn(p.birimFiyat, formData.activeCurrency),
    "%20",
    formatCurrencyFn(calculateRowTotal(p), formData.activeCurrency),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    margin: { left: marginX, right: marginX },
    styles: {
      font: "Roboto",
      fontSize: 8,
      textColor: [75, 85, 99],
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [75, 85, 99],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { halign: "center" },
      2: { cellWidth: 40 },
      4: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY;

  // ===================================================================
  // TOPLAM KUTUSU
  // ===================================================================
  const totalsCardWidth = 60;
  const totalsX = pageWidth - marginX - totalsCardWidth;
  let totalsY = finalTableY + 6;

  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(255, 255, 255);
  doc.rect(totalsX, totalsY, totalsCardWidth, 24, "S");

  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);

  const labelColX = totalsX + 3;
  const valueColX = totalsX + totalsCardWidth - 3;

  const araToplam = calculateSubtotal();
  const kdv = calculateKDV();
  const genelToplam = calculateTotal();

  // Ara Toplam
  doc.text("Ara Toplam", labelColX, totalsY + 7);
  doc.setTextColor(55, 65, 81);
  doc.text(
    formatCurrencyFn(araToplam, formData.activeCurrency),
    valueColX,
    totalsY + 7,
    { align: "right" }
  );

  // KDV
  doc.setTextColor(107, 114, 128);
  doc.text("KDV (%20)", labelColX, totalsY + 13);
  doc.setTextColor(55, 65, 81);
  doc.text(
    formatCurrencyFn(kdv, formData.activeCurrency),
    valueColX,
    totalsY + 13,
    { align: "right" }
  );

  // Genel Toplam
  doc.setFont("Roboto", "bold");
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.text("Genel Toplam", labelColX, totalsY + 20);
  doc.text(
    formatCurrencyFn(genelToplam, formData.activeCurrency),
    valueColX,
    totalsY + 20,
    { align: "right" }
  );

  // ===================================================================
  // TEKLİF ŞARTLARI - TEK GENİŞ KART
  // ===================================================================
  const cardMarginBottom = 10;
  const termsCardWidth = pageWidth - 2 * marginX;

  const padX2 = 4;
  const padY2 = 3;
  const lineH = 4;
  const titleH = 7;

  const termsLabeled: [string, string][] = [
    ["Notlar:", formData.notlar || "Belirtilmemiş"],
    ["Opsiyon:", formData.opsiyon || "Opsiyon belirtilmedi."],
    ["Öngörülen Teslim:", formData.teslimSuresi || "4 hafta"],
    ["Ödeme Şekli:", formData.odemeSekli || "%70 peşin %30 teslimde"],
    ["Teslim Yeri:", formData.teslimYeri || "İkitelli O.S.B."],
  ];

  let termsEstimatedLines = 0;
  termsLabeled.forEach(([_, val]) => {
    termsEstimatedLines += doc.splitTextToSize(
      val,
      termsCardWidth - padX2 * 2 - 32
    ).length;
  });

  const termsCardHeight = padY2 * 2 + titleH + termsEstimatedLines * lineH;

  const cardY = Math.max(
    finalTableY + 10,
    pageHeight - cardMarginBottom - termsCardHeight
  );

  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(marginX, cardY, termsCardWidth, termsCardHeight, 2, 2, "FD");

    // Başlık
    doc.setFont("Roboto", "bold")
    .setFontSize(11)
    .setTextColor(31, 41, 55);

  const termsTitle = "TEKLİF ŞARTLARI";

  // Başlık font ayarları
  doc.setFont("Roboto", "bold")
    .setFontSize(11)
    .setTextColor(31, 41, 55);
  
  // ✔ Gerçek ortalama
  const titleWidth = doc.getTextWidth(termsTitle);
  const titleCenterX = marginX + (termsCardWidth - titleWidth) / 2;
  const titleY = cardY + padY2 + 6;
  
  // Başlık Yaz
  doc.text(termsTitle, titleCenterX, titleY);
  
  // İçerik başlangıcı
  let ty = titleY + 7;
  
  termsLabeled.forEach(([label, value]) => {
    doc.setFont("Roboto", "bold")
       .setFontSize(9)
       .setTextColor(90, 100, 110);
  
    doc.text(label, marginX + padX2, ty);
  
    doc.setFont("Roboto", "normal")
       .setFontSize(8)
       .setTextColor(55, 65, 81);
  
    const wrapped = doc.splitTextToSize(
      value,
      termsCardWidth - padX2 * 2 - 32
    );
  
    wrapped.forEach((line, i) =>
      // ✔ Daha doğru hizalama
      doc.text(line, marginX + padX2 + 32, ty + i * lineH)
    );
  
    ty += wrapped.length * lineH;
  });
  


  // ===================================================================
  // HEADER & FOOTER TÜM SAYFALARA UYGULA
  // ===================================================================
  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    doc.setPage(pageNumber);
    drawHeader(pageNumber, totalPages);
    drawFooter(pageNumber, totalPages);
  }

  return doc;
};
