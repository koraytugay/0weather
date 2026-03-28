(async function () {
  var url =
    "https://api.open-meteo.com/v1/forecast?" +
    "forecast_days=10&latitude=43.70&longitude=-79.42" +
    "&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,snowfall,relative_humidity_2m,windspeed_10m,wind_gusts_10m,cloudcover,uv_index" +
    "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset" +
    "&timezone=America%2FNew_York";

  var res = await fetch(url);
  var w = await res.json();
  var h = w.hourly;
  var d = w.daily;
  var now = new Date().getHours();

  function emoji(cloud, precip, temp, snow) {
    if (snow > 0 || (precip > 0.1 && temp < 1)) return "\u2744\uFE0F";
    if (precip > 0.1) return "\uD83C\uDF27\uFE0F";
    if (cloud > 80) return "\u2601\uFE0F";
    if (cloud > 50) return "\uD83C\uDF25\uFE0F";
    if (cloud > 20) return "\u26C5";
    return "\u2600\uFE0F";
  }

  function desc(cloud, precip, temp, snow) {
    if (snow > 0 || (precip > 0.1 && temp < 1)) return "Snow";
    if (precip > 0.1) return "Rain";
    if (cloud > 80) return "Cloudy";
    if (cloud > 50) return "Mostly Cloudy";
    if (cloud > 20) return "Partly Cloudy";
    return "Clear";
  }

  function isRainOrSnow(i) {
    var sn = h.snowfall ? h.snowfall[i] : 0;
    return sn > 0 || h.precipitation[i] > 0.1;
  }

  function isSnow(i) {
    var sn = h.snowfall ? h.snowfall[i] : 0;
    return sn > 0 || (h.precipitation[i] > 0.1 && h.temperature_2m[i] < 1);
  }

  function formatDate(dateStr) {
    var date = new Date(dateStr + "T00:00:00");
    var d = String(date.getDate()).padStart(2, "0");
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var y = date.getFullYear();
    return d + "." + m + "." + y;
  }

  function getDayName(dateStr) {
    var date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  // --- Now ---
  var t = Math.round(h.temperature_2m[now]);
  var fl = Math.round(h.apparent_temperature[now]);
  var cl = h.cloudcover[now];
  var pr = h.precipitation[now];
  var sn = h.snowfall ? h.snowfall[now] : 0;
  var wi = Math.round(h.windspeed_10m[now]);
  var hu = h.relative_humidity_2m[now];
  var uvNow = Math.round(h.uv_index[now]);
  var hiToday = Math.round(d.temperature_2m_max[0]);
  var loToday = Math.round(d.temperature_2m_min[0]);

  document.getElementById("now-temp").textContent = t + "\u00B0";
  document.getElementById("now-feels").textContent = fl + "\u00B0";
  document.getElementById("now-emoji").textContent = emoji(cl, pr, t, sn);
  document.getElementById("now-desc").textContent = desc(cl, pr, t, sn);

  // Range
  var rangeEl = document.getElementById("now-range");
  rangeEl.innerHTML = '<span class="lo">' + loToday + '\u00B0</span> / <span class="hi">' + hiToday + '\u00B0</span>';
  if (hiToday >= 30 || loToday <= -5) rangeEl.classList.add("sig-text");

  // Wind
  var windEl = document.getElementById("now-wind");
  windEl.textContent = wi + " km/h";
  if (wi >= 20) windEl.classList.add("sig-text");

  // UV
  var uvEl = document.getElementById("now-uv");
  uvEl.textContent = uvNow;
  if (uvNow >= 3) uvEl.style.color = "#ffcdd2";

  // --- Build hour card ---
  function makeCard(i, isNow, isToday) {
    var div = document.createElement("div");
    div.className = "hour-card" + (isNow ? " is-now" : "");

    var t = Math.round(h.temperature_2m[i]);
    var fl = Math.round(h.apparent_temperature[i]);
    var cl = h.cloudcover[i];
    var pr = h.precipitation[i];
    var sn = h.snowfall ? h.snowfall[i] : 0;
    var wi = Math.round(h.windspeed_10m[i]);
    var pp = h.precipitation_probability[i];
    var uv = h.uv_index[i];
    var nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    var hourPadded = String(i % 24).padStart(2, "0") + ":00";
    var label = isNow ? nowTime : hourPadded;

    var windClass = (wi >= 20) ? " wind-sig" : "";
    var tempClass = (isToday && t <= -5) ? " cold-sig" : "";

    var rain = "";
    if (pp > 0) {
      if (sn > 0) {
        rain = '<div class="hour-rain">' + pp + '% ' + sn.toFixed(1) + 'cm</div>';
      } else if (pr > 0) {
        rain = '<div class="hour-rain">' + pp + '% ' + pr.toFixed(1) + 'mm</div>';
      } else if (pp >= 20) {
        rain = '<div class="hour-rain">' + pp + '%</div>';
      }
    }

    var uvClass = uv >= 3 ? " uv-sig" : "";
    var uvHtml = uv > 0 ? '<div class="hour-uv' + uvClass + '">UV ' + Math.round(uv) + '</div>' : "";

    div.innerHTML =
      '<div class="hour-time">' + label + '</div>' +
      '<div class="hour-emoji">' + emoji(cl, pr, t, sn) + '</div>' +
      '<div class="hour-temp' + tempClass + '">' + t + '\u00B0</div>' +
      '<div class="hour-detail">feels ' + fl + '\u00B0</div>' +
      '<div class="hour-detail' + windClass + '">' + wi + ' km/h</div>' +
      rain +
      uvHtml;

    return div;
  }

  // --- Today ---
  var todayEl = document.getElementById("today-scroll");
  for (var i = now; i < 24; i++) {
    todayEl.appendChild(makeCard(i, i === now, true));
  }

  // --- Today notes ---
  var notes = [];

  // Wind note: check if all remaining hours are windy or if wind calms down
  var allWindy = true;
  var calmHour = -1;
  for (var i = now; i < 24; i++) {
    if (Math.round(h.windspeed_10m[i]) < 16) {
      allWindy = false;
      if (calmHour === -1) calmHour = i;
      break;
    }
  }
  if (allWindy && now < 23) {
    notes.push("Windy all day. No calm hours ahead.");
  } else if (calmHour !== -1 && wi >= 18) {
    notes.push("Wind eases around " + calmHour + ":00 (below 16 km/h).");
  }

  // Rain/snow note
  var currentlyPrecip = isRainOrSnow(now);
  if (currentlyPrecip) {
    // Find when it stops
    var stopHour = -1;
    for (var i = now + 1; i < 24; i++) {
      if (!isRainOrSnow(i)) { stopHour = i; break; }
    }
    var what = isSnow(now) ? "Snow" : "Rain";
    if (stopHour !== -1) {
      notes.push(what + " expected to stop around " + stopHour + ":00.");
    } else {
      notes.push(what + " for the rest of the day.");
    }
  } else {
    // Find when rain/snow starts
    var startHour = -1;
    for (var i = now + 1; i < 24; i++) {
      if (isRainOrSnow(i)) { startHour = i; break; }
    }
    if (startHour !== -1) {
      var what = isSnow(startHour) ? "Snow" : "Rain";
      // Find when it stops after starting
      var stopHour = -1;
      for (var i = startHour + 1; i < 24; i++) {
        if (!isRainOrSnow(i)) { stopHour = i; break; }
      }
      if (stopHour !== -1) {
        notes.push(what + " expected " + startHour + ":00 \u2013 " + stopHour + ":00.");
      } else {
        notes.push(what + " expected from " + startHour + ":00 through the evening.");
      }
    }
  }

  if (notes.length > 0) {
    var notesCard = document.getElementById("notes-card");
    notesCard.style.display = "";
    var notesEl = document.getElementById("notes");
    notesEl.innerHTML = notes.map(function (n) { return '<div class="note">' + n + '</div>'; }).join("");
  }

  // --- Future Days ---
  var futureContainer = document.getElementById("future-days");
  for (var dayIdx = 1; dayIdx < 10; dayIdx++) {
    var dateStr = d.time[dayIdx];
    var hi = Math.round(d.temperature_2m_max[dayIdx]);
    var lo = Math.round(d.temperature_2m_min[dayIdx]);

    var section = document.createElement("section");
    section.className = "card";
    section.style.marginTop = "10px";

    var label = document.createElement("div");
    label.className = "section-label";
    label.style.display = "flex";
    label.style.justifyContent = "space-between";
    
    var leftLabel = document.createElement("span");
    leftLabel.innerHTML = formatDate(dateStr) + " &mdash; " + hi + "\u00B0 / " + lo + "\u00B0";
    
    var rightLabel = document.createElement("span");
    rightLabel.textContent = getDayName(dateStr);
    rightLabel.style.color = "var(--text-sec)";
    rightLabel.style.textTransform = "none";
    rightLabel.style.fontWeight = "400";

    label.appendChild(leftLabel);
    label.appendChild(rightLabel);
    section.appendChild(label);

    var scroll = document.createElement("div");
    scroll.className = "hour-scroll";
    
    for (var i = dayIdx * 24; i < (dayIdx + 1) * 24 && i < h.temperature_2m.length; i++) {
      scroll.appendChild(makeCard(i, false, false));
    }
    
    section.appendChild(scroll);
    futureContainer.appendChild(section);
  }
})();
