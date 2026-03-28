(async function () {
  var url =
    "https://api.open-meteo.com/v1/forecast?" +
    "forecast_days=2&latitude=43.70&longitude=-79.42" +
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

  // --- Now ---
  var t = Math.round(h.temperature_2m[now]);
  var fl = Math.round(h.apparent_temperature[now]);
  var cl = h.cloudcover[now];
  var pr = h.precipitation[now];
  var sn = h.snowfall ? h.snowfall[now] : 0;
  var wi = Math.round(h.windspeed_10m[now]);
  var hu = h.relative_humidity_2m[now];
  var hiToday = Math.round(d.temperature_2m_max[0]);
  var loToday = Math.round(d.temperature_2m_min[0]);

  document.getElementById("now-temp").textContent = t + "\u00B0";
  document.getElementById("now-feels").textContent = "Feels " + fl + "\u00B0";
  document.getElementById("now-emoji").textContent = emoji(cl, pr, t, sn);
  document.getElementById("now-desc").textContent = desc(cl, pr, t, sn);

  // Range
  var rangeEl = document.getElementById("now-range");
  rangeEl.innerHTML = '<span class="lo">' + loToday + '\u00B0</span> / <span class="hi">' + hiToday + '\u00B0</span>';
  if (hiToday >= 30 || loToday <= -5) rangeEl.classList.add("sig-range");

  // Wind
  var windEl = document.getElementById("now-wind");
  windEl.textContent = wi + " km/h";
  if (wi >= 18) windEl.classList.add("sig-wind");

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
    var label = isNow ? "Now" : (i % 24) + ":00";

    var windClass = (isToday && wi >= 18) ? " wind-sig" : "";
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

    div.innerHTML =
      '<div class="hour-time">' + label + '</div>' +
      '<div class="hour-emoji">' + emoji(cl, pr, t, sn) + '</div>' +
      '<div class="hour-temp' + tempClass + '">' + t + '\u00B0</div>' +
      '<div class="hour-detail">feels ' + fl + '\u00B0</div>' +
      '<div class="hour-detail' + windClass + '">' + wi + ' km/h</div>' +
      rain;

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

  // --- Tomorrow ---
  document.getElementById("tmr-summary").textContent =
    Math.round(d.temperature_2m_max[1]) + "\u00B0 / " + Math.round(d.temperature_2m_min[1]) + "\u00B0";

  var tmrEl = document.getElementById("tmr-scroll");
  for (var i = 24; i < 48 && i < h.temperature_2m.length; i++) {
    tmrEl.appendChild(makeCard(i, false, false));
  }
})();
