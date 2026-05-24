(() => {
  const PAGE_TIPS = [
    "Use the listed local sunrise/sunset time.",
    "Confirm your location before exporting.",
    "Keep your device clock accurate.",
    "Follow your teacher/tradition for ritual details.",
  ];

  const PDF_TEXTS = {
    locationLabel: "Location",
    rangeLabel: "Range",
    generatedLabel: "Generated",
    coverTitle: "Agnihotra Sunrise & Sunset Timings",
    coverSubTitle: "GPS-Based Local Timing Schedule",
    coverDescription:
      "Timings are generated from the selected coordinates using the Agnihotra definition: centre of the solar disc on the horizon.",
    coverDescription2:
      "Reference sources for timing definition, mantras, and common materials are listed in this PDF.",
    scanLabel: "Scan for app/site",
    prepTitle: "Before the Exact Time",
    prepLine1:
      "Prepare the fire and offerings before the listed sunrise/sunset time.",
    prepLine2:
      "Use the local time shown in this schedule for your selected coordinates.",
    prepLine3:
      "Follow your teacher, family tradition, or trusted Homa Therapy instructions for ritual details.",
    ingredientsTitle: "Ingredients & Common Materials",
    offeringsLabel: "Offerings",
    setupLabel: "Vessel & Setup",
    mantraPrepLabel: "Mantra Preparation",
    ritualFlowTitle: "5-Step Ritual Flow",
    timingRuleTitle: "Exact Timing Rule",
    timingRuleLine: "Do not perform before/after exact time.",
    timingRuleDesc:
      "Homatherapy/Homa Therapy define Agnihotra sunrise/sunset as the middle of the solar disc at the horizon.",
    coreMantrasTitle: "Core Mantras",
    tableDate: "Date",
    tableSunrise: "Sunrise",
    tableSunset: "Sunset",
  };

  let qrDataUrlCache = null;
  let qrDataUrlInFlight = null;

  async function ensureJsPdfReady() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    const localPath = "vendor/jspdf.umd.min.js";
    try {
      await new Promise((resolve, reject) => {
        const existing = document.querySelector(
          `script[src="${localPath}"], script[src$="/${localPath}"]`
        );
        if (existing) {
          if (window.jspdf?.jsPDF) {
            resolve();
          } else {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener(
              "error",
              () => reject(new Error("local-jspdf-load-failed")),
              { once: true }
            );
          }
          return;
        }

        const script = document.createElement("script");
        script.src = localPath;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("local-jspdf-load-failed"));
        document.head.appendChild(script);
      });
      if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    } catch (_) {}
    return null;
  }

  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    });
  }

  async function loadImageDataUrl(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch (_) {
      return null;
    }
  }

  async function loadFirstAvailableImageDataUrl(paths) {
    for (const path of paths) {
      const image = await loadImageDataUrl(path);
      if (image) return image;
    }
    return null;
  }

  async function loadQrCodeDataUrl(targetUrl) {
    if (qrDataUrlCache) return qrDataUrlCache;
    if (qrDataUrlInFlight) return qrDataUrlInFlight;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return null;
    }

    const url = String(targetUrl || "").trim();
    if (!url) return null;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
    qrDataUrlInFlight = (async () => {
      try {
        const response = await fetch(qrApi);
        if (!response.ok) return null;
        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl) qrDataUrlCache = dataUrl;
        return dataUrl;
      } catch (_) {
        return null;
      } finally {
        qrDataUrlInFlight = null;
      }
    })();
    return qrDataUrlInFlight;
  }

  function parseDateInputToDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    if (text.includes(".")) {
      const [dd, mm, yyyy] = text.split(".").map(Number);
      if (dd && mm && yyyy) return new Date(yyyy, mm - 1, dd);
    }
    if (text.includes("-")) {
      const [yyyy, mm, dd] = text.split("-").map(Number);
      if (dd && mm && yyyy) return new Date(yyyy, mm - 1, dd);
    }
    return null;
  }

  function formatDateIndian(value) {
    const dateObj = value instanceof Date ? value : parseDateInputToDate(value);
    if (!dateObj || Number.isNaN(dateObj.getTime())) return String(value || "-");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const yyyy = dateObj.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  function formatRangeIndian(rangeLabel) {
    const raw = String(rangeLabel || "");
    if (!raw.includes(" to ")) return raw;
    const [startRaw, endRaw] = raw.split(" to ");
    return `${formatDateIndian(startRaw)} to ${formatDateIndian(endRaw)}`;
  }

  function formatGeneratedStamp() {
    const now = new Date();
    const datePart = formatDateIndian(now);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${datePart} ${hh}:${mm} IST`;
  }

  function formatMonthHeading(dateObj) {
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "Month";
    return dateObj.toLocaleString("en-IN", { month: "long", year: "numeric" });
  }

  function parseRowDate(dateValue) {
    return parseDateInputToDate(dateValue);
  }

  function drawPaperBackground(doc, pageWidth, pageHeight) {
    doc.setFillColor(253, 248, 236);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFillColor(247, 238, 221);
    doc.rect(0, 0, pageWidth, 38, "F");
    doc.rect(0, pageHeight - 38, pageWidth, 38, "F");
  }

  function drawDecorativeCorner(doc, x, y, flip = false, scale = 1) {
    const arc = flip ? -1 : 1;
    doc.setDrawColor(230, 196, 150);
    doc.setLineWidth(0.8);
    doc.line(x, y, x + 34 * arc * scale, y);
    doc.line(x, y, x, y + 34 * scale);
    doc.setLineWidth(0.5);
    doc.circle(x + 14 * arc * scale, y + 14 * scale, 5 * scale);
    doc.circle(x + 23 * arc * scale, y + 23 * scale, 2.8 * scale);
  }

  function drawMandalaBorder(doc, pageWidth, pageHeight) {
    doc.setDrawColor(210, 170, 120);
    doc.setLineWidth(0.9);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48);
    doc.setLineWidth(0.4);
    doc.setDrawColor(230, 199, 157);
    doc.rect(31, 31, pageWidth - 62, pageHeight - 62);
    drawDecorativeCorner(doc, 36, 36, false, 0.9);
    drawDecorativeCorner(doc, pageWidth - 36, 36, true, 0.9);
    drawDecorativeCorner(doc, 36, pageHeight - 68, false, 0.9);
    drawDecorativeCorner(doc, pageWidth - 36, pageHeight - 68, true, 0.9);
  }

  function drawSacredWatermark(doc, pageWidth, pageHeight) {
    const cx = pageWidth / 2;
    const cy = pageHeight / 2 + 18;
    doc.setDrawColor(232, 221, 202);
    doc.setLineWidth(0.7);
    doc.circle(cx, cy, 114);
    doc.circle(cx, cy, 92);
    doc.circle(cx, cy, 70);
    doc.setLineWidth(0.45);
    doc.line(cx - 122, cy, cx + 122, cy);
    doc.line(cx, cy - 122, cx, cy + 122);
    doc.setTextColor(205, 189, 165);
    doc.setFont("times", "italic");
    doc.setFontSize(18);
    doc.text("Sacred Agni", cx, cy + 6, { align: "center" });
    doc.setTextColor(70, 56, 44);
  }

  function drawBrandHeader(
    doc,
    meta,
    pageWidth,
    logoDataUrl,
    headingText = "Agnihotra Sunrise & Sunset Timings",
    pdfText = PDF_TEXTS
  ) {
    doc.setFillColor(32, 24, 19);
    doc.rect(24, 24, pageWidth - 48, 92, "F");
    doc.setFillColor(224, 123, 38);
    doc.rect(24, 112, pageWidth - 48, 4, "F");
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", 42, 42, 46, 46);
      } catch (_) {}
    }
    doc.setTextColor(255, 253, 248);
    doc.setFont("times", "bold");
    doc.setFontSize(24);
    doc.text("EternalAgni", 102, 63);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12.5);
    doc.text(headingText, 102, 83);

    doc.setTextColor(78, 59, 44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${pdfText.locationLabel}: ${meta.locationName}`, 42, 136);
    doc.text(`${pdfText.rangeLabel}: ${meta.rangeLabel}`, 42, 152);
    doc.setFont("helvetica", "normal");
    doc.text(`${pdfText.generatedLabel}: ${meta.generatedAt}`, 42, 168);
  }

  function drawCoverPage(doc, meta, pageWidth, pageHeight, assets, pdfText) {
    drawPaperBackground(doc, pageWidth, pageHeight);
    drawMandalaBorder(doc, pageWidth, pageHeight);
    drawSacredWatermark(doc, pageWidth, pageHeight);

    drawBrandHeader(
      doc,
      meta,
      pageWidth,
      assets.logoDataUrl,
      "Ritual Handbook & Timings",
      pdfText
    );

    doc.setTextColor(58, 43, 31);
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text(pdfText.coverTitle, pageWidth / 2, 220, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(
      `${meta.locationName} | ${meta.yearLabel}`,
      pageWidth / 2,
      242,
      { align: "center" }
    );

    if (assets.fireDataUrl) {
      try {
        doc.addImage(assets.fireDataUrl, "JPEG", 52, 266, pageWidth - 104, 232);
      } catch (_) {
        doc.setFillColor(242, 224, 188);
        doc.rect(52, 266, pageWidth - 104, 232, "F");
      }
    } else {
      doc.setFillColor(242, 224, 188);
      doc.rect(52, 266, pageWidth - 104, 232, "F");
    }

    doc.setFillColor(253, 248, 236);
    doc.roundedRect(52, 516, pageWidth - 84, 82, 10, 10, "F");
    doc.setDrawColor(210, 170, 120);
    doc.roundedRect(52, 516, pageWidth - 84, 82, 10, 10);
    doc.setTextColor(68, 50, 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text(pdfText.coverSubTitle, 70, 546);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.8);
    doc.text(
      pdfText.coverDescription,
      70,
      566,
      { maxWidth: pageWidth - 120 }
    );
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.8);
    doc.text(
      pdfText.coverDescription2,
      70,
      586,
      { maxWidth: pageWidth - 120 }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(92, 74, 58);
    doc.text(
      "Timing source: homatherapie.de/en/agnihotra-timings.html",
      70,
      616,
      { maxWidth: pageWidth - 260 }
    );

    if (assets.qrDataUrl) {
      try {
        doc.setFillColor(255, 252, 246);
        doc.roundedRect(pageWidth - 196, 596, 128, 144, 10, 10, "F");
        doc.setDrawColor(207, 168, 123);
        doc.roundedRect(pageWidth - 196, 596, 128, 144, 10, 10);
        doc.addImage(assets.qrDataUrl, "PNG", pageWidth - 184, 608, 104, 104);
        doc.setTextColor(92, 74, 58);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(pdfText.scanLabel, pageWidth - 132, 730, { align: "center" });
      } catch (_) {}
    }
  }

  function drawHowToPage(doc, pageWidth, pageHeight, meta, assets, pdfText) {
    drawPaperBackground(doc, pageWidth, pageHeight);
    drawMandalaBorder(doc, pageWidth, pageHeight);
    drawBrandHeader(
      doc,
      meta,
      pageWidth,
      assets.logoDataUrl,
      "How to Perform Agnihotra",
      pdfText
    );
    doc.setFillColor(255, 249, 238);
    doc.roundedRect(42, 190, pageWidth - 84, 118, 12, 12, "F");
    doc.setDrawColor(208, 166, 117);
    doc.roundedRect(42, 190, pageWidth - 84, 118, 12, 12);
    doc.setTextColor(62, 47, 34);
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text(pdfText.prepTitle, 56, 220);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.2);
    doc.text(
      pdfText.prepLine1,
      56,
      244,
      { maxWidth: pageWidth - 112 }
    );
    doc.text(
      pdfText.prepLine2,
      56,
      264,
      { maxWidth: pageWidth - 112 }
    );
    doc.text(
      pdfText.prepLine3,
      56,
      284,
      { maxWidth: pageWidth - 112 }
    );

    const ingredientsBoxY = 326;
    const ingredientsBoxH = 182;
    doc.setFillColor(255, 249, 239);
    doc.roundedRect(42, ingredientsBoxY, pageWidth - 84, ingredientsBoxH, 12, 12, "F");
    doc.setDrawColor(210, 171, 125);
    doc.roundedRect(42, ingredientsBoxY, pageWidth - 84, ingredientsBoxH, 12, 12);

    doc.setFont("times", "bold");
    doc.setTextColor(62, 46, 34);
    doc.setFontSize(16);
    doc.text(pdfText.ingredientsTitle, 56, 354);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.2);
    doc.setTextColor(166, 104, 43);
    doc.text(pdfText.offeringsLabel, 56, 376);
    doc.setTextColor(62, 46, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.6);
    doc.text("- Whole raw rice grains for the offerings", 60, 394);
    doc.text("- Cow ghee for the rice offerings", 60, 410);
    doc.text("- Clean, dry cow dung cakes as fuel", 60, 426);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.2);
    doc.setTextColor(166, 104, 43);
    doc.text(pdfText.setupLabel, pageWidth / 2 + 6, 376);
    doc.setTextColor(62, 46, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.6);
    doc.text("- Copper Agnihotra pyramid of accepted size", pageWidth / 2 + 10, 394, {
      maxWidth: pageWidth / 2 - 64,
    });
    doc.text("- Fire should be burning before the exact time", pageWidth / 2 + 10, 410, {
      maxWidth: pageWidth / 2 - 64,
    });
    doc.text("- Use your tradition's setup and handling rules", pageWidth / 2 + 10, 426, {
      maxWidth: pageWidth / 2 - 64,
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.2);
    doc.setTextColor(166, 104, 43);
    doc.text(pdfText.mantraPrepLabel, 56, 454);
    doc.setTextColor(62, 46, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.4);
    doc.text("- Keep sunrise and sunset mantras ready before the time.", 60, 472);
    doc.text("- Do all preparation 10 minutes before listed timing.", 60, 488);

    const materialCardsY = ingredientsBoxY + ingredientsBoxH + 12;
    const cardW = 118;
    const cardH = 76;
    const cardGap = 10;
    const cards = [
      { key: "copperDataUrl", label: "Copper Pyramid" },
      { key: "gheeDataUrl", label: "Cow Ghee" },
      { key: "dungDataUrl", label: "Cow Dung Cakes" },
      { key: "riceDataUrl", label: "Whole Rice" },
    ];
    cards.forEach((card, idx) => {
      const x = 56 + idx * (cardW + cardGap);
      doc.setFillColor(255, 252, 245);
      doc.roundedRect(x, materialCardsY, cardW, cardH, 8, 8, "F");
      doc.setDrawColor(210, 171, 125);
      doc.roundedRect(x, materialCardsY, cardW, cardH, 8, 8);
      const imageData = assets[card.key];
      const imageH = 46;
      if (imageData) {
        try {
          doc.addImage(imageData, "JPEG", x + 6, materialCardsY + 5, cardW - 12, imageH);
        } catch (_) {
          doc.setFillColor(244, 230, 202);
          doc.rect(x + 6, materialCardsY + 5, cardW - 12, imageH, "F");
        }
      } else {
        doc.setFillColor(244, 230, 202);
        doc.rect(x + 6, materialCardsY + 5, cardW - 12, imageH, "F");
      }
      doc.setTextColor(88, 64, 45);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.6);
      doc.text(card.label, x + cardW / 2, materialCardsY + 66, { align: "center" });
    });

    // Wrap Practice Flow / Timing Rule / Core Mantras / Sources inside one
    // padded container so nothing crosses the visible page-border lines.
    const bottomBoxX = 42;
    const bottomBoxY = materialCardsY + cardH + 10;
    const bottomBoxW = pageWidth - 84;
    const bottomBoxH = pageHeight - 64 - bottomBoxY;
    doc.setFillColor(255, 250, 240);
    doc.roundedRect(bottomBoxX, bottomBoxY, bottomBoxW, bottomBoxH, 12, 12, "F");
    doc.setDrawColor(210, 171, 125);
    doc.roundedRect(bottomBoxX, bottomBoxY, bottomBoxW, bottomBoxH, 12, 12);

    const innerX = bottomBoxX + 14;
    const innerMaxW = bottomBoxW - 28;
    let cursorY = bottomBoxY + 14;

    doc.setFont("times", "bold");
    doc.setTextColor(62, 46, 34);
    doc.setFontSize(11.6);
    doc.text(pdfText.ritualFlowTitle || "Simple Practice Flow", innerX, cursorY);
    cursorY += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.text(
      "1) Prepare materials before the time  2) Keep the fire ready  3) Offer ghee rice at the exact time",
      innerX,
      cursorY,
      { maxWidth: innerMaxW }
    );
    cursorY += 11;
    doc.text(
      "4) Chant the sunrise/sunset mantras  5) Continue according to your tradition.",
      innerX,
      cursorY,
      { maxWidth: innerMaxW }
    );
    cursorY += 14;

    doc.setFont("times", "bold");
    doc.setFontSize(11.6);
    doc.setTextColor(62, 46, 34);
    doc.text(pdfText.timingRuleTitle, innerX, cursorY);
    cursorY += 13;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(156, 67, 38);
    doc.setFontSize(10.2);
    doc.text(pdfText.timingRuleLine, innerX, cursorY);
    cursorY += 12;
    doc.setTextColor(62, 46, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.text(
      pdfText.timingRuleDesc,
      innerX,
      cursorY,
      { maxWidth: innerMaxW }
    );
    cursorY += 16;

    doc.setFont("times", "bold");
    doc.setFontSize(11.6);
    doc.text(pdfText.coreMantrasTitle, innerX, cursorY);
    cursorY += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.text("Sunrise: Suryaya Swaha | Suryaya Idam Na Mama", innerX, cursorY);
    cursorY += 10;
    doc.text("         Prajapataye Swaha | Prajapataye Idam Na Mama", innerX, cursorY);
    cursorY += 10;
    doc.text("Sunset:  Agnaye Swaha | Agnaye Idam Na Mama", innerX, cursorY);
    cursorY += 10;
    doc.text("         Prajapataye Swaha | Prajapataye Idam Na Mama", innerX, cursorY);

    const sourcesY = bottomBoxY + bottomBoxH - 10;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.4);
    doc.setTextColor(92, 72, 54);
    doc.text(
      "Sources: Homatherapy timings; Homa Therapy International timings; Agnihotra.org instructions and pyramid guidance.",
      innerX,
      sourcesY,
      { maxWidth: innerMaxW }
    );
  }

  const SCHEDULE_HEADER_HEIGHT = 16;
  const SCHEDULE_MONTH_HEIGHT = 13;
  const SCHEDULE_ROW_HEIGHT = 13;

  function drawScheduleMiniHeader(doc, startX, startY, columnWidths, pdfText) {
    const headerHeight = SCHEDULE_HEADER_HEIGHT;
    const totalW = columnWidths[0] + columnWidths[1] + columnWidths[2];
    doc.setFillColor(241, 230, 209);
    doc.roundedRect(startX, startY, totalW, headerHeight, 3, 3, "F");
    doc.setDrawColor(197, 159, 112);
    doc.setLineWidth(0.5);
    doc.roundedRect(startX, startY, totalW, headerHeight, 3, 3);
    doc.line(startX + columnWidths[0], startY, startX + columnWidths[0], startY + headerHeight);
    doc.line(
      startX + columnWidths[0] + columnWidths[1],
      startY,
      startX + columnWidths[0] + columnWidths[1],
      startY + headerHeight
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(56, 41, 30);
    doc.setFontSize(8.6);
    const labelY = startY + 11;
    doc.text(pdfText.tableDate, startX + columnWidths[0] / 2, labelY, { align: "center" });
    doc.text(
      pdfText.tableSunrise,
      startX + columnWidths[0] + columnWidths[1] / 2,
      labelY,
      { align: "center" }
    );
    doc.text(
      pdfText.tableSunset,
      startX + columnWidths[0] + columnWidths[1] + columnWidths[2] / 2,
      labelY,
      { align: "center" }
    );
  }

  function drawMiniMonthHeader(doc, label, startX, y, width) {
    doc.setFillColor(249, 240, 224);
    doc.roundedRect(startX, y, width, SCHEDULE_MONTH_HEIGHT, 3, 3, "F");
    doc.setDrawColor(210, 171, 126);
    doc.setLineWidth(0.4);
    doc.roundedRect(startX, y, width, SCHEDULE_MONTH_HEIGHT, 3, 3);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 73, 42);
    doc.setFontSize(8.4);
    doc.text(label, startX + 7, y + 9);
  }

  function drawScheduleRow(doc, startX, y, columnWidths, row, zebra) {
    const totalW = columnWidths[0] + columnWidths[1] + columnWidths[2];
    const rowHeight = SCHEDULE_ROW_HEIGHT;
    if (zebra) {
      doc.setFillColor(251, 246, 237);
      doc.rect(startX, y, totalW, rowHeight, "F");
    }
    doc.setFillColor(255, 239, 201);
    doc.rect(startX + columnWidths[0], y, columnWidths[1], rowHeight, "F");
    doc.setFillColor(244, 214, 195);
    doc.rect(startX + columnWidths[0] + columnWidths[1], y, columnWidths[2], rowHeight, "F");
    doc.setDrawColor(214, 194, 162);
    doc.setLineWidth(0.35);
    doc.rect(startX, y, totalW, rowHeight);
    doc.line(startX + columnWidths[0], y, startX + columnWidths[0], y + rowHeight);
    doc.line(
      startX + columnWidths[0] + columnWidths[1],
      y,
      startX + columnWidths[0] + columnWidths[1],
      y + rowHeight
    );
    doc.setTextColor(55, 43, 33);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    const textY = y + 9;
    doc.text(formatDateIndian(row.date), startX + columnWidths[0] / 2, textY, {
      align: "center",
    });
    doc.setTextColor(173, 112, 36);
    doc.text(
      String(row.sunrise || "-"),
      startX + columnWidths[0] + columnWidths[1] / 2,
      textY,
      { align: "center" }
    );
    doc.setTextColor(148, 75, 45);
    doc.text(
      String(row.sunset || "-"),
      startX + columnWidths[0] + columnWidths[1] + columnWidths[2] / 2,
      textY,
      { align: "center" }
    );
  }

  function drawFooter(doc, pageNumber, pageWidth, pageHeight) {
    const tip = PAGE_TIPS[(pageNumber - 1) % PAGE_TIPS.length];
    doc.setDrawColor(214, 173, 124);
    doc.setLineWidth(0.7);
    doc.line(36, pageHeight - 52, pageWidth - 36, pageHeight - 52);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(84, 70, 58);
    doc.setFontSize(9.8);
    doc.text(tip, 40, pageHeight - 34, { maxWidth: pageWidth - 190 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.4);
    doc.text(`Page ${pageNumber}`, pageWidth - 86, pageHeight - 34);
  }

  function truncateLocationName(value) {
    const text = String(value || "").trim();
    if (text.length <= 58) return text;
    return `${text.slice(0, 55)}...`;
  }

  async function exportToPdf({ rows, filename, locationName, rangeLabel }) {
    const JsPdfCtor = await ensureJsPdfReady();
    if (!JsPdfCtor) {
      throw new Error("jsPDF not available for PDF export.");
    }

    const doc = new JsPdfCtor({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const logoDataUrl = await loadImageDataUrl("assets/images/app-icon.png");
    const fireDataUrl = await loadFirstAvailableImageDataUrl([
      "assets/images/agnihotra-timing-reference.jpg",
      "assets/images/cow-dung-cakes.webp",
      "assets/images/eternalagni-icon.png",
    ]);
    const copperDataUrl = await loadFirstAvailableImageDataUrl([
      "assets/images/copper-pyramid.jpg",
      "assets/images/eternalagni-icon.png",
    ]);
    const gheeDataUrl = await loadFirstAvailableImageDataUrl([
      "assets/images/cow-ghee.jpg",
      "assets/images/eternalagni-icon.png",
    ]);
    const dungDataUrl = await loadFirstAvailableImageDataUrl([
      "assets/images/cow-dung-cakes.webp",
      "assets/images/eternalagni-icon.png",
    ]);
    const riceDataUrl = await loadFirstAvailableImageDataUrl([
      "assets/images/unpolished-rice-grains.jpg",
      "assets/images/eternalagni-icon.png",
    ]);
    const qrDataUrl = await loadQrCodeDataUrl("https://agnihotra-eternal-agni.vercel.app/");

    const meta = {
      filename,
      locationName: truncateLocationName(locationName || "Current Location"),
      rangeLabel: formatRangeIndian(rangeLabel),
      generatedAt: formatGeneratedStamp(),
      yearLabel: String(new Date().getFullYear()),
    };
    const pdfText = PDF_TEXTS;

    const assets = {
      logoDataUrl,
      fireDataUrl,
      copperDataUrl,
      gheeDataUrl,
      dungDataUrl,
      riceDataUrl,
      qrDataUrl,
    };
    const tableStartX = 36;
    const tableStartY = 178;
    const tableTotalWidth = pageWidth - 72;
    const columnGap = 14;
    const miniWidth = Math.floor((tableTotalWidth - columnGap) / 2);
    const dateColWidth = 64;
    const timeColWidth = Math.floor((miniWidth - dateColWidth) / 2);
    const miniColumnWidths = [
      dateColWidth,
      timeColWidth,
      miniWidth - dateColWidth - timeColWidth,
    ];
    const leftX = tableStartX;
    const rightX = tableStartX + miniWidth + columnGap;
    const scheduleBodyStartY = tableStartY + SCHEDULE_HEADER_HEIGHT + 6;
    const scheduleBottomLimit = pageHeight - 64;

    drawCoverPage(doc, meta, pageWidth, pageHeight, assets, pdfText);
    let pageNumber = 1;
    drawFooter(doc, pageNumber, pageWidth, pageHeight);

    doc.addPage();
    pageNumber += 1;
    drawHowToPage(doc, pageWidth, pageHeight, meta, assets, pdfText);
    drawFooter(doc, pageNumber, pageWidth, pageHeight);

    // We only draw the left mini-header up front. The right mini-header is
    // drawn lazily the first time we actually advance into the right column —
    // this keeps the page clean (no empty "Date | Sunrise | Sunset" strip on
    // the right) for short ranges that fit entirely in the left column.
    let rightHeaderDrawnOnThisPage = false;
    const beginSchedulePage = () => {
      doc.addPage();
      pageNumber += 1;
      drawPaperBackground(doc, pageWidth, pageHeight);
      drawMandalaBorder(doc, pageWidth, pageHeight);
      drawBrandHeader(
        doc,
        meta,
        pageWidth,
        logoDataUrl,
        "Ritual Timings Schedule",
        pdfText
      );
      drawScheduleMiniHeader(doc, leftX, tableStartY, miniColumnWidths, pdfText);
      rightHeaderDrawnOnThisPage = false;
    };

    beginSchedulePage();

    let currentCol = "left";
    let cursorY = scheduleBodyStartY;
    let currentMonthKey = "";
    let rowZebraCounter = 0;
    const colX = () => (currentCol === "left" ? leftX : rightX);
    const advanceColumnOrPage = () => {
      if (currentCol === "left") {
        if (!rightHeaderDrawnOnThisPage) {
          drawScheduleMiniHeader(
            doc,
            rightX,
            tableStartY,
            miniColumnWidths,
            pdfText
          );
          rightHeaderDrawnOnThisPage = true;
        }
        currentCol = "right";
      } else {
        drawFooter(doc, pageNumber, pageWidth, pageHeight);
        beginSchedulePage();
        currentCol = "left";
      }
      cursorY = scheduleBodyStartY;
    };

    rows.forEach((row, index) => {
      const rowDate = parseRowDate(row.date);
      const monthLabel = formatMonthHeading(rowDate);
      const monthKey = rowDate
        ? `${rowDate.getFullYear()}-${rowDate.getMonth()}`
        : `unknown-${String(row.date || index)}`;

      // A month transition needs its label + at least one row of context to
      // avoid an orphaned heading at the end of a column.
      if (monthKey !== currentMonthKey) {
        if (
          cursorY + SCHEDULE_MONTH_HEIGHT + SCHEDULE_ROW_HEIGHT >
          scheduleBottomLimit
        ) {
          advanceColumnOrPage();
        }
        drawMiniMonthHeader(doc, monthLabel, colX(), cursorY, miniWidth);
        cursorY += SCHEDULE_MONTH_HEIGHT + 1;
        currentMonthKey = monthKey;
      }

      // If this row doesn't fit, advance and replay the month header in the
      // new column so the user keeps the month context.
      if (cursorY + SCHEDULE_ROW_HEIGHT > scheduleBottomLimit) {
        advanceColumnOrPage();
        if (
          cursorY + SCHEDULE_MONTH_HEIGHT + SCHEDULE_ROW_HEIGHT <=
          scheduleBottomLimit
        ) {
          drawMiniMonthHeader(doc, monthLabel, colX(), cursorY, miniWidth);
          cursorY += SCHEDULE_MONTH_HEIGHT + 1;
        }
      }

      drawScheduleRow(
        doc,
        colX(),
        cursorY,
        miniColumnWidths,
        row,
        rowZebraCounter % 2 === 0
      );
      cursorY += SCHEDULE_ROW_HEIGHT;
      rowZebraCounter += 1;
    });

    drawFooter(doc, pageNumber, pageWidth, pageHeight);
    return doc.output("blob");
  }

  window.AgnihotraPdfExport = {
    exportToPdf,
  };
})();
