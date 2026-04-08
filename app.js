(async function () {
  const LAT = 43.70;
  const LON = -79.42;
  const TZ = "America%2FNew_York";
  const HOURLY_PARAMS = "&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,snowfall,relative_humidity_2m,windspeed_10m,wind_gusts_10m,cloudcover,uv_index";

  // Initial Fetch: 10 days of daily (for labels) + 2 days of hourly (for today/tomorrow)
  var dailyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&forecast_days=10&daily=temperature_2m_max,temperature_2m_min&timezone=${TZ}`;
  var hourlyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&forecast_days=2${HOURLY_PARAMS}&current=temperature_2m,apparent_temperature,precipitation,snowfall,wind_speed_10m,cloud_cover&timezone=${TZ}`;

  var h, d, curr;
  var now = new Date().getHours();

  try {
    const [dRes, hRes] = await Promise.all([fetch(dailyUrl), fetch(hourlyUrl)]);
    const [dData, hData] = await Promise.all([dRes.json(), hRes.json()]);
    d = dData.daily;
    h = hData.hourly;
    curr = hData.current;
  } catch (e) {
    console.error("Initial fetch failed:", e);
    document.getElementById("app").innerHTML = '<div class="card" style="text-align:center;padding:40px">Failed to load weather data.</div>';
    return;
  }

  function emoji(cloud, precip, temp, snow) {
    if (snow > 0 || (precip > 0 && temp < 1)) return "\u2744\uFE0F";
    if (precip > 0) return "\uD83C\uDF27\uFE0F";
    if (cloud > 80) return "\u2601\uFE0F";
    if (cloud > 50) return "\uD83C\uDF25\uFE0F";
    if (cloud > 20) return "\u26C5";
    return "\u2600\uFE0F";
  }

  function desc(cloud, precip, temp, snow) {
    if (snow > 0 || (precip > 0 && temp < 1)) return "Snow";
    if (precip > 0) return "Rain";
    if (cloud > 80) return "Cloudy";
    if (cloud > 50) return "Mostly Cloudy";
    if (cloud > 20) return "Partly Cloudy";
    return "Clear";
  }

  function isRainOrSnow(i, hourlyData) {
    var sn = hourlyData.snowfall ? hourlyData.snowfall[i] : 0;
    return sn > 0 || hourlyData.precipitation[i] > 0;
  }

  function isSnow(i, hourlyData) {
    var sn = hourlyData.snowfall ? hourlyData.snowfall[i] : 0;
    return sn > 0 || (hourlyData.precipitation[i] > 0 && hourlyData.temperature_2m[i] < 1);
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
  var t = Math.round(curr.temperature_2m);
  var fl = Math.round(curr.apparent_temperature);
  var cl = curr.cloud_cover;
  var pr = curr.precipitation;
  var sn = curr.snowfall;
  var wi = Math.round(curr.wind_speed_10m);
  var uvNow = Math.round(h.uv_index[now]);
  
  var todayHours = h.temperature_2m.slice(7, 23);
  var hiToday = Math.round(Math.max(...todayHours));
  var loToday = Math.round(Math.min(...todayHours));

  document.getElementById("now-temp").textContent = t + "\u00B0";
  document.getElementById("now-feels").textContent = fl + "\u00B0";
  document.getElementById("now-emoji").textContent = emoji(cl, pr, t, sn);
  document.getElementById("now-desc").textContent = desc(cl, pr, t, sn);

  var rangeEl = document.getElementById("now-range");
  rangeEl.innerHTML = loToday + '\u00B0 / ' + hiToday + '\u00B0';

  var windEl = document.getElementById("now-wind");
  windEl.textContent = wi + " km/h";

  var uvEl = document.getElementById("now-uv");
  uvEl.textContent = uvNow;

  function makeCard(i, isNow, isToday, hourlyData) {
    var div = document.createElement("div");
    div.className = "hour-card" + (isNow ? " is-now" : "");

    var t = Math.round(hourlyData.temperature_2m[i]);
    var fl = Math.round(hourlyData.apparent_temperature[i]);
    var cl = hourlyData.cloudcover[i];
    var pr = hourlyData.precipitation[i];
    var sn = hourlyData.snowfall ? hourlyData.snowfall[i] : 0;
    var wi = Math.round(hourlyData.windspeed_10m[i]);
    var pp = hourlyData.precipitation_probability[i];
    var uv = hourlyData.uv_index[i];
    
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
      rain + uvHtml;

    div.onclick = function() {
      showModal(i, label, hourlyData);
    };

    return div;
  }

  function showModal(i, timeLabel, data) {
    const overlay = document.getElementById("modal-overlay");
    const t = Math.round(data.temperature_2m[i]);
    const fl = Math.round(data.apparent_temperature[i]);
    const cl = data.cloudcover[i];
    const pr = data.precipitation[i];
    const sn = data.snowfall ? data.snowfall[i] : 0;
    const wi = Math.round(data.windspeed_10m[i]);
    const gu = Math.round(data.wind_gusts_10m[i]);
    const pp = data.precipitation_probability[i];
    const hu = data.relative_humidity_2m[i];
    const uv = data.uv_index[i];

    document.getElementById("modal-time").textContent = timeLabel;
    document.getElementById("modal-temp").textContent = t + "\u00B0";
    document.getElementById("modal-emoji").textContent = emoji(cl, pr, t, sn);
    document.getElementById("modal-desc").textContent = desc(cl, pr, t, sn);

    const stats = [
      { lab: "Feels Like", val: fl + "\u00B0" },
      { lab: "Precip Prob", val: pp + "%" },
      { lab: "Precip Amount", val: pr + " mm" },
      { lab: "Wind Speed", val: wi + " km/h" },
      { lab: "Wind Gusts", val: gu + " km/h" },
      { lab: "Humidity", val: hu + "%" },
      { lab: "Cloud Cover", val: cl + "%" },
      { lab: "UV Index", val: Math.round(uv) }
    ];

    document.getElementById("modal-grid").innerHTML = stats.map(s => `
      <div class="modal-stat">
        <div class="modal-stat-lab">${s.lab}</div>
        <div class="modal-stat-val">${s.val}</div>
      </div>
    `).join("");

    overlay.style.display = "flex";
  }

  document.getElementById("modal-close").onclick = () => {
    document.getElementById("modal-overlay").style.display = "none";
  };
  
  document.getElementById("modal-overlay").onclick = (e) => {
    document.getElementById("modal-overlay").style.display = "none";
  };

  // --- Today ---
  var todayEl = document.getElementById("today-scroll");
  for (var i = now; i < 24; i++) {
    todayEl.appendChild(makeCard(i, i === now, true, h));
  }

  // --- Notes (simplified for 2-day hourly) ---
  var notes = [];
  var allWindy = true, calmHour = -1;
  for (var i = now; i < 24; i++) {
    if (Math.round(h.windspeed_10m[i]) < 16) { allWindy = false; if (calmHour === -1) calmHour = i; break; }
  }
  if (allWindy && now < 23) notes.push("Windy all day.");
  else if (calmHour !== -1 && wi >= 18) notes.push("Wind eases around " + calmHour + ":00.");

  var currentlyPrecip = isRainOrSnow(now, h);
  if (currentlyPrecip) {
    var stopHour = -1;
    for (var i = now + 1; i < 24; i++) { if (!isRainOrSnow(i, h)) { stopHour = i; break; } }
    if (stopHour !== -1) notes.push((isSnow(now, h) ? "Snow" : "Rain") + " stops around " + stopHour + ":00.");
  }

  if (notes.length > 0) {
    document.getElementById("notes-card").style.display = "";
    document.getElementById("notes").innerHTML = notes.map(n => `<div class="note">${n}</div>`).join("");
  }

  // --- Future Days ---
  function renderDay(dayIdx, container, expanded) {
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
    label.style.cursor = "pointer";
    label.innerHTML = `<span style="flex:1;text-align:left;color:var(--text-sec);text-transform:none;font-weight:400">${getDayName(dateStr)}</span>
                       <span style="flex:1;text-align:right">${lo} / ${hi}</span>`;
    section.appendChild(label);

    var scroll = document.createElement("div");
    scroll.className = "hour-scroll";
    scroll.style.display = expanded ? "flex" : "none";
    
    if (expanded) {
      // Tomorrow's data is already in 'h' (indices 24-47)
      for (var i = 24; i < 48; i++) scroll.appendChild(makeCard(i, false, false, h));
    }

    label.onclick = async function(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      try {
        if (scroll.style.display === "none") {
          scroll.style.display = "flex";
          if (scroll.children.length === 0) {
            scroll.innerHTML = '<div style="padding:15px;font-size:12px;opacity:0.7">Loading hourly data...</div>';
            var dayUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&start_date=${dateStr}&end_date=${dateStr}${HOURLY_PARAMS}&timezone=${TZ}`;
            var res = await fetch(dayUrl);
            if (!res.ok) throw new Error("Fetch failed");
            var dayData = await res.json();
            scroll.innerHTML = "";
            if (dayData && dayData.hourly) {
              for (var i = 0; i < 24; i++) {
                scroll.appendChild(makeCard(i, false, false, dayData.hourly));
              }
            } else {
              throw new Error("Invalid data");
            }
          }
        } else {
          scroll.style.display = "none";
        }
      } catch (err) {
        console.error("Day fetch error:", err);
        scroll.innerHTML = '<div style="padding:15px;font-size:12px;color:#ffcdd2">Failed to load. Tap to retry.</div>';
        // Ensure it stays visible so user sees the error
        scroll.style.display = "flex";
      }
    };
    
    section.appendChild(scroll);
    container.appendChild(section);
  }

  var futureContainer = document.getElementById("future-days");
  for (var i = 1; i < 10; i++) renderDay(i, futureContainer, i === 1);
})();
