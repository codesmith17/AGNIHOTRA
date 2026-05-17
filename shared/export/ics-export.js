(() => {
  function escapeIcsText(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function toIcsLocalDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  }

  function parseLocalDateTime(dateText, timeText) {
    const [day, month, year] = String(dateText || "")
      .split(".")
      .map(Number);
    const [hours, minutes, seconds] = String(timeText || "")
      .trim()
      .split(/[ :]/)
      .slice(0, 3)
      .map(Number);
    return new Date(
      year || 1970,
      (month || 1) - 1,
      day || 1,
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0,
      Number.isFinite(seconds) ? seconds : 0
    );
  }

  function nowUtcStamp() {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function stableUid(kind, date, appDomain) {
    const key = `${kind}-${date}-${appDomain}`;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 33 + key.charCodeAt(i)) | 0;
    }
    return `${kind}-${date.replace(/\./g, "")}-${Math.abs(hash)}@${appDomain}`;
  }

  function buildIcsContent({
    rows,
    locationName,
    timezone,
    sunriseLabel = "SUNRISE",
    sunsetLabel = "SUNSET",
  }) {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const location = locationName || "Current Location";
    const appDomain = "eternalagni.app";
    const stamp = nowUtcStamp();
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//EternalAgni//Agnihotra Professional Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcsText(`EternalAgni - ${location} Agnihotra Timings`)}`,
      `X-WR-CALDESC:${escapeIcsText(
        "Professional Agnihotra sunrise/sunset calendar with 10-minute reminders."
      )}`,
      `X-WR-TIMEZONE:${escapeIcsText(tz)}`,
    ];

    rows.forEach((row) => {
      const sunriseAt = parseLocalDateTime(row.date, row.sunrise);
      const sunsetAt = parseLocalDateTime(row.date, row.sunset);
      const events = [
        {
          kind: "sunrise",
          title: sunriseLabel,
          startAt: sunriseAt,
        },
        {
          kind: "sunset",
          title: sunsetLabel,
          startAt: sunsetAt,
        },
      ];

      events.forEach((eventItem) => {
        const start = toIcsLocalDate(eventItem.startAt);
        const end = toIcsLocalDate(new Date(eventItem.startAt.getTime() + 60 * 1000));
        const uid = stableUid(eventItem.kind, row.date, appDomain);
        lines.push(
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${stamp}`,
          `DTSTART;TZID=${tz}:${start}`,
          `DTEND;TZID=${tz}:${end}`,
          `SUMMARY:${escapeIcsText(`${eventItem.title} - ${location}`)}`,
          `DESCRIPTION:${escapeIcsText(
            "Agnihotra event by EternalAgni. Includes a 10-minute pre-alert."
          )}`,
          `LOCATION:${escapeIcsText(location)}`,
          "STATUS:CONFIRMED",
          "TRANSP:OPAQUE",
          "CATEGORIES:SPIRITUAL,AGNIHOTRA",
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeIcsText(
            `${eventItem.title} starts in 10 minutes. Prepare for Agnihotra.`
          )}`,
          "TRIGGER:-PT10M",
          "END:VALARM",
          "END:VEVENT"
        );
      });
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  window.AgnihotraIcsExport = {
    buildIcsContent,
  };
})();
