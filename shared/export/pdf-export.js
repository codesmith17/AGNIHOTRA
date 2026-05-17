(() => {
  const PAGE_TIPS = [
    "Offer exactly at sunrise/sunset.",
    "Use cow dung cakes, ghee & whole rice.",
    "Keep mantra chanting calm and focused.",
    "Prepare materials at least 10 minutes earlier.",
    "Sit with gratitude and steady breath.",
  ];

  const PDF_TEXTS = {
    locationLabel: "Location",
    rangeLabel: "Range",
    generatedLabel: "Generated",
    mantraLine: "Om Suryaya Swaha, Prajapataye Swaha",
    coverTitle: "Agnihotra Sunrise & Sunset Timings",
    coverSubTitle: "Sacred Rhythm for Daily Practice",
    coverDescription:
      "Use this handbook for exact sunrise/sunset offerings, monthly planning, and consistent sadhana discipline.",
    coverDescription2:
      "Includes complete material guide, monthly ritual timings, and spiritual practice notes.",
    scanLabel: "Scan for app/site",
    prepTitle: "Preparation Discipline",
    prepLine1:
      "Prepare all materials at least 10 minutes in advance and keep your ritual place clean.",
    prepLine2:
      "Perform exactly at listed sunrise/sunset and sit silently for a few minutes after offering.",
    prepLine3:
      "Keep mantra pronunciation steady and your intention peaceful throughout the ritual.",
    ingredientsTitle: "Ingredients & Sacred Materials",
    offeringsLabel: "Offerings",
    setupLabel: "Vessel & Setup",
    mantraPrepLabel: "Mantra Preparation",
    ritualFlowTitle: "5-Step Ritual Flow",
    timingRuleTitle: "Exact Timing Rule",
    timingRuleLine: "Do not perform before/after exact time.",
    timingRuleDesc:
      "The offering must happen exactly at sunrise and sunset as listed in this schedule.",
    coreMantrasTitle: "Core Mantras",
    tableDate: "Date",
    tableSunrise: "Sunrise",
    tableSunset: "Sunset",
    reflectionTitle: "Traditional Benefits of Agnihotra",
  };

  async function ensureJsPdfReady() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    const cdnUrls = [
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
      "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
    ];
    for (const url of cdnUrls) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = url;
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
      } catch (_) {}
    }
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
    const url = String(targetUrl || "").trim();
    if (!url) return null;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
    try {
      const response = await fetch(qrApi);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch (_) {
      return null;
    }
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
    doc.text(pdfText.mantraLine, pageWidth - 242, 168);
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

    doc.setFillColor(255, 249, 239);
    doc.roundedRect(42, 326, pageWidth - 84, 170, 12, 12, "F");
    doc.setDrawColor(210, 171, 125);
    doc.roundedRect(42, 326, pageWidth - 84, 170, 12, 12);

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
    doc.text("- Whole unbroken rice grains (2 pinches)", 60, 394);
    doc.text("- Pure cow ghee for charging each offering", 60, 410);
    doc.text("- Clean, dry cow dung cakes as fuel", 60, 426);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.2);
    doc.setTextColor(166, 104, 43);
    doc.text(pdfText.setupLabel, pageWidth / 2 + 6, 376);
    doc.setTextColor(62, 46, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.6);
    doc.text("- Copper Agnihotra pyramid (proper size)", pageWidth / 2 + 10, 394);
    doc.text("- Fire source, clean tray, and ash container", pageWidth / 2 + 10, 410);
    doc.text("- Sit calmly with east/west facing discipline", pageWidth / 2 + 10, 426);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.2);
    doc.setTextColor(166, 104, 43);
    doc.text(pdfText.mantraPrepLabel, 56, 452);
    doc.setTextColor(62, 46, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.6);
    doc.text("- Keep sunrise and sunset mantras ready before ignition.", 60, 470);
    doc.text("- Do all preparation 10 minutes before listed timing.", 60, 486);

    const materialCardsY = 502;
    const cardW = 118;
    const cardH = 94;
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
      if (imageData) {
        try {
          doc.addImage(imageData, "JPEG", x + 6, materialCardsY + 6, cardW - 12, 58);
        } catch (_) {
          doc.setFillColor(244, 230, 202);
          doc.rect(x + 6, materialCardsY + 6, cardW - 12, 58, "F");
        }
      } else {
        doc.setFillColor(244, 230, 202);
        doc.rect(x + 6, materialCardsY + 6, cardW - 12, 58, "F");
      }
      doc.setTextColor(88, 64, 45);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.text(card.label, x + cardW / 2, materialCardsY + 80, { align: "center" });
    });

    doc.setFont("times", "bold");
    doc.setTextColor(62, 46, 34);
    doc.setFontSize(13.2);
    doc.text(pdfText.ritualFlowTitle, 42, 610);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.9);
    doc.text(
      "1) Prepare fire setup 10 min early  2) Face east/west  3) Offer ghee rice at exact second",
      56,
      626,
      { maxWidth: pageWidth - 98 }
    );
    doc.text(
      "4) Chant sunrise/sunset mantra with two oblations  5) Sit silently in gratitude.",
      56,
      640,
      { maxWidth: pageWidth - 98 }
    );

    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(62, 46, 34);
    doc.text(pdfText.timingRuleTitle, 42, 666);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(156, 67, 38);
    doc.setFontSize(12.3);
    doc.text(pdfText.timingRuleLine, 56, 688);
    doc.setTextColor(62, 46, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.2);
    doc.text(
      pdfText.timingRuleDesc,
      56,
      706,
      { maxWidth: pageWidth - 98 }
    );

    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text(pdfText.coreMantrasTitle, 42, 732);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Sunrise: Suryaya Swaha | Suryaya Idam Na Mama", 56, 752);
    doc.text("Sunset: Agnaye Swaha | Agnaye Idam Na Mama", 56, 770);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(98, 72, 50);
    doc.text("After ritual: preserve ash respectfully for garden/healing traditional use.", 56, 786);
  }

  function drawScheduleTableHeader(doc, startX, startY, columnWidths, pdfText) {
    doc.setFillColor(241, 230, 209);
    doc.roundedRect(
      startX,
      startY,
      columnWidths[0] + columnWidths[1] + columnWidths[2],
      28,
      5,
      5,
      "F"
    );
    doc.setDrawColor(197, 159, 112);
    doc.setLineWidth(0.8);
    doc.roundedRect(
      startX,
      startY,
      columnWidths[0] + columnWidths[1] + columnWidths[2],
      28,
      5,
      5
    );
    doc.line(startX + columnWidths[0], startY, startX + columnWidths[0], startY + 28);
    doc.line(
      startX + columnWidths[0] + columnWidths[1],
      startY,
      startX + columnWidths[0] + columnWidths[1],
      startY + 28
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(56, 41, 30);
    doc.setFontSize(12.5);
    doc.text(pdfText.tableDate, startX + 12, startY + 19);
    doc.text(pdfText.tableSunrise, startX + columnWidths[0] + 12, startY + 19);
    doc.text(pdfText.tableSunset, startX + columnWidths[0] + columnWidths[1] + 12, startY + 19);
  }

  function drawMonthHeader(doc, label, startX, y, totalWidth) {
    doc.setFillColor(249, 240, 224);
    doc.roundedRect(startX, y, totalWidth, 24, 4, 4, "F");
    doc.setDrawColor(210, 171, 126);
    doc.roundedRect(startX, y, totalWidth, 24, 4, 4);
    doc.setFont("times", "bold");
    doc.setTextColor(120, 73, 42);
    doc.setFontSize(13.2);
    doc.text(label, startX + 10, y + 16);
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

  function drawSpiritualPage(doc, pageWidth, pageHeight, meta, assets, pdfText) {
    doc.addPage();
    drawPaperBackground(doc, pageWidth, pageHeight);
    drawMandalaBorder(doc, pageWidth, pageHeight);
    drawSacredWatermark(doc, pageWidth, pageHeight);
    drawBrandHeader(
      doc,
      meta,
      pageWidth,
      assets.logoDataUrl,
      "Spiritual Reflection",
      pdfText
    );

    doc.setFont("times", "bold");
    doc.setTextColor(62, 46, 34);
    doc.setFontSize(20);
    doc.text(pdfText.reflectionTitle, 42, 218);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    const points = [
      "Atmosphere purification through disciplined fire ritual and mantra vibration.",
      "Strengthens daily discipline by aligning life with sunrise and sunset.",
      "Creates a mindful pause that supports gratitude, steadiness, and meditation.",
      "Encourages family and community practice with shared sacred routine.",
      "Supports a sattvic environment through intention, order, and offering.",
    ];
    points.forEach((line, idx) => {
      doc.text(`- ${line}`, 52, 248 + idx * 28, { maxWidth: pageWidth - 104 });
    });

    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("Gratitude & Meditation", 42, 432);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.2);
    doc.text(
      "After each offering, sit quietly for a few minutes. Observe the breath, the flame's memory, and the silence that follows. This pause deepens the effect of the ritual in daily life.",
      52,
      454,
      { maxWidth: pageWidth - 104, lineHeightFactor: 1.35 }
    );

    doc.setFont("times", "italic");
    doc.setFontSize(12.2);
    doc.setTextColor(124, 84, 53);
    doc.text(
      '"May the fire of right action bring harmony to mind, home, and atmosphere."',
      pageWidth / 2,
      pageHeight - 132,
      { align: "center", maxWidth: pageWidth - 120 }
    );
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
    const tableStartX = 42;
    const tableStartY = 190;
    const tableTotalWidth = pageWidth - 84;
    const columnWidths = [170, 152, tableTotalWidth - 322];
    const rowHeight = 28;
    const bottomLimit = pageHeight - 92;

    drawCoverPage(doc, meta, pageWidth, pageHeight, assets, pdfText);
    let pageNumber = 1;
    drawFooter(doc, pageNumber, pageWidth, pageHeight);

    doc.addPage();
    pageNumber += 1;
    drawHowToPage(doc, pageWidth, pageHeight, meta, assets, pdfText);
    drawFooter(doc, pageNumber, pageWidth, pageHeight);

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
    drawScheduleTableHeader(doc, tableStartX, tableStartY, columnWidths, pdfText);
    let y = tableStartY + 36;
    let currentMonthKey = "";

    rows.forEach((row, index) => {
      const rowDate = parseRowDate(row.date);
      const monthLabel = formatMonthHeading(rowDate);
      const monthKey = rowDate
        ? `${rowDate.getFullYear()}-${rowDate.getMonth()}`
        : `unknown-${String(row.date || index)}`;

      if (monthKey !== currentMonthKey) {
        if (y + 28 + rowHeight > bottomLimit) {
          drawFooter(doc, pageNumber, pageWidth, pageHeight);
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
          drawScheduleTableHeader(doc, tableStartX, tableStartY, columnWidths, pdfText);
          y = tableStartY + 36;
        }
        drawMonthHeader(doc, monthLabel, tableStartX, y, tableTotalWidth);
        y += 30;
        currentMonthKey = monthKey;
      }

      if (y + rowHeight > bottomLimit) {
        drawFooter(doc, pageNumber, pageWidth, pageHeight);
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
        drawScheduleTableHeader(doc, tableStartX, tableStartY, columnWidths, pdfText);
        y = tableStartY + 36;
      }

      if (index % 2 === 0) {
        doc.setFillColor(251, 246, 237);
        doc.rect(tableStartX, y, tableTotalWidth, rowHeight, "F");
      }
      doc.setFillColor(255, 239, 201);
      doc.rect(tableStartX + columnWidths[0], y, columnWidths[1], rowHeight, "F");
      doc.setFillColor(244, 214, 195);
      doc.rect(tableStartX + columnWidths[0] + columnWidths[1], y, columnWidths[2], rowHeight, "F");

      doc.setDrawColor(214, 194, 162);
      doc.setLineWidth(0.45);
      doc.rect(tableStartX, y, tableTotalWidth, rowHeight);
      doc.line(tableStartX + columnWidths[0], y, tableStartX + columnWidths[0], y + rowHeight);
      doc.line(
        tableStartX + columnWidths[0] + columnWidths[1],
        y,
        tableStartX + columnWidths[0] + columnWidths[1],
        y + rowHeight
      );

      doc.setTextColor(55, 43, 33);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.8);
      doc.text(formatDateIndian(row.date), tableStartX + 10, y + 16);
      doc.setTextColor(173, 112, 36);
      doc.text(String(row.sunrise || "-"), tableStartX + columnWidths[0] + 10, y + 17);
      doc.setTextColor(148, 75, 45);
      doc.text(
        String(row.sunset || "-"),
        tableStartX + columnWidths[0] + columnWidths[1] + 10,
        y + 17
      );
      doc.setTextColor(55, 43, 33);
      y += rowHeight;
    });

    drawFooter(doc, pageNumber, pageWidth, pageHeight);
    drawSpiritualPage(doc, pageWidth, pageHeight, meta, assets, pdfText);
    pageNumber += 1;
    drawFooter(doc, pageNumber, pageWidth, pageHeight);
    return doc.output("blob");
  }

  window.AgnihotraPdfExport = {
    exportToPdf,
  };
})();
