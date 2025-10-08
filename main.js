import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.8/+esm";

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const links = JSON.parse(localStorage.getItem("chatLinks") || "[]");

const groupColors = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
];

const groupColorMap = new Map();
let groupIndex = 0;

links.forEach((d) => {
  if (!groupColorMap.has(d.group)) {
    groupColorMap.set(d.group, groupColors[groupIndex % groupColors.length]);
    groupIndex++;
  }
});

function getToxicColor(baseColor, tossicita) {
  const hsl = d3.hsl(baseColor);
  hsl.s = 1;
  // Tossicità 0 → l = 30%, Tossicità 1 → l = 65%
  const safeTox = Math.max(0, Math.min(1, tossicita ?? 0));
  // hsl.l = 0.3 + 0.35 * safeTox; più tossico, più chiaro
  hsl.l = 0.65 - 0.35 * safeTox; // più tossico, più scuro
  return hsl.formatHex();
}

const lang = localStorage.getItem("lingua") || "it";
const temaScuro = localStorage.getItem("tema") === "scuro";

const contextDiv = document.getElementById("context");
const focusDiv = document.getElementById("focus");
const dailyDiv = document.getElementById("daily");

const monthlyDiv = document.createElement("div");
monthlyDiv.id = "monthly";
monthlyDiv.style.marginTop = "20px";
focusDiv.after(monthlyDiv); // Inserito dopo il grafico settimanale

let currentChartIndex = -1;
let miniChartsOrdered = []; // verrà popolato dopo il rendering dei mini chart

links.forEach((d) => {
  if (typeof d.timeSlot === "string") {
    d.timeSlot = new Date(d.timeSlot);
  }
});

const colorRanges = {
  nessuno: ["#fee5d9", "#fcae91", "#fb6a4a", "#cb181d"],
  protanopia: ["#f3cccc", "#f7b0a2", "#f3745e", "#a7302f"],
  deuteranopia: ["#f5d0d0", "#f7b49b", "#f27a6c", "#a33333"],
  tritanopia: ["#e5c7c7", "#f5a996", "#ee715f", "#a23228"],
  acromatopsia: ["#999", "#bbb", "#888", "#666"],
};

const roleColors = {
  nessuno: {
    source: "#e66101",
    target: "#7b3294",
  },
  protanopia: {
    source: "#d95f02",
    target: "#7570b3",
  },
  deuteranopia: {
    source: "#e6550d",
    target: "#636363",
  },
  tritanopia: {
    source: "#d95f0e",
    target: "#6a51a3",
  },
  acromatopsia: {
    source: "#bbb",
    target: "#777",
  },
};

const filtro = localStorage.getItem("daltonismo") || "nessuno";
const currentColors = roleColors[filtro] || roleColors["nessuno"];

const colorScale = {
  type: "linear",
  domain: [0, 0.25, 0.75, 1],
  range: colorRanges[filtro] || colorRanges["nessuno"],
};

const scale = d3
  .scaleLinear()
  .domain(colorScale.domain)
  .range(colorScale.range);

function getWeeksInMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  let startWeek = startOfISOWeek(firstDay);
  const endWeek = startOfISOWeek(lastDay);
  const weeks = [];
  let current = startWeek;
  while (current <= endWeek) {
    weeks.push(current);
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return weeks;
}

function startOfISOWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getISOWeek(dt) {
  const d = new Date(dt);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const thursday = d.valueOf();
  d.setMonth(0, 1);
  if (d.getDay() !== 4) {
    d.setMonth(0, 1 + ((4 - d.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((thursday - d) / 604800000);
}

function getMonthInitial(date) {
  const months = ["G", "F", "M", "A", "M", "G", "L", "A", "S", "O", "N", "D"];
  return months[date.getMonth()];
}

function groupByYearAndMonth(links) {
  const m = new Map();
  links.forEach((l) => {
    const y = l.timeSlot.getFullYear();
    const mo = l.timeSlot.getMonth() + 1;
    const wstart = startOfISOWeek(l.timeSlot);
    const wkey = wstart.getTime();

    if (!m.has(y)) m.set(y, new Map());
    const ym = m.get(y);
    if (!ym.has(mo)) ym.set(mo, new Map());
    const mw = ym.get(mo);
    if (!mw.has(wkey)) mw.set(wkey, []);
    mw.get(wkey).push(l);
  });
  return m;
}

function renderMiniChart(week) {
  const data = week.data;
  const start = week.start;

  const container = document.createElement("div");
  container.className = "mini-chart";
  // container.style.border = "1px solid #ccc";
  container.style.margin = "2px";
  container.style.padding = "2px";
  container.style.boxSizing = "border-box";
  container.style.position = "relative";

  const weekLabel = document.createElement("div");
  weekLabel.className = "week-label";
  weekLabel.textContent = getISOWeek(start);
  weekLabel.style.position = "absolute";
  weekLabel.style.top = "2px";
  weekLabel.style.right = "4px";
  weekLabel.style.fontSize = "10px";
  weekLabel.style.color = temaScuro ? "#fff" : "#000";
  container.appendChild(weekLabel);

  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (data.length === 0) {
    container.style.border = "1px solid #ccc"; // BORDO GRIGIO PER VUOTI
    const emptyBox = document.createElement("div");
    emptyBox.style.width = "100%";
    emptyBox.style.height = "100%";
    emptyBox.style.backgroundColor = temaScuro ? "#2c2c2c" : "#f5f5f5";
    container.appendChild(emptyBox);
  } else {
    container.style.border = "1px solid #333"; // BORDO SCURO PER PIENI
    const chart = Plot.plot({
      width: 90,
      height: 100,
      inset: 5,
      margin: 0,
      insetTop: 6,
      insetBottom: 12,
      x: { type: "time", domain: [start, end], axis: null },
      y: { axis: null },
      color: colorScale,
      style: {
        background: temaScuro ? "#1e1e1e" : "#fff",
        color: temaScuro ? "#e0e0e0" : "#000",
      },
      marks: [
        Plot.link(data, {
          x: "timeSlot",
          y1: "source",
          y2: "target",
          stroke: (d) =>
            getToxicColor(groupColorMap.get(d.group) || "#999", d.tossicita),
          strokeWidth: 0.3,
          opacity: 0.7,
        }),
        Plot.dot(data, {
          x: "timeSlot",
          y: "source",
          r: 4,
          fill: currentColors.source,
          stroke: currentColors.source,
          symbol: "triangle",
        }),
        Plot.dot(data, {
          x: "timeSlot",
          y: "target",
          r: 2,
          fill: currentColors.target,
          stroke: currentColors.target,
          symbol: "circle",
        }),
      ],
    });

    chart.style.width = "100%";
    chart.style.height = "100%";
    container.append(chart);
  }

  container.addEventListener("click", () => {
    dailyDiv.innerHTML = "";
    focusDiv.innerHTML = "";
    monthlyDiv.innerHTML = ""; // rimozione grafici settimanali multipli
    currentChartIndex = miniChartsOrdered.findIndex((el) => el === container); //nuova
    renderFocusChart(data, focusDiv, start); // passa start come weekStart
    container.style.border = "2px solid #f03b20";
    weekLabel.style.color = "#f03b20";
    document.querySelectorAll(".mini-chart").forEach((c, i) => {
      if (c === container) {
        currentChartIndex = i;
      }

      if (c !== container) {
        const cData = c.__data__;
        const newBorder =
          cData && cData.data?.length > 0 ? "1px solid #333" : "1px solid #ccc";
        c.style.border = newBorder;
        const label = c.querySelector(".week-label");
        if (label) label.style.color = "#000";
      }
    });
  });

  container.__data__ = week;
  return container;
}

function renderMonthRow(year, month, weeks) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.marginBottom = "6px";

  const label = document.createElement("div");
  label.textContent = getMonthInitial(new Date(year, month - 1));
  label.style.width = "20px";
  label.style.fontWeight = "bold";
  label.style.textAlign = "center";
  label.style.cursor = "pointer";
  label.style.userSelect = "none";
  label.style.color = temaScuro ? "#ccc" : "#222";

  label.addEventListener("click", () => {
    // Pulizia completa prima di mostrare i grafici del mese selezionato
    dailyDiv.innerHTML = "";
    focusDiv.innerHTML = "";
    monthlyDiv.innerHTML = "";

    // Ordina le settimane in ordine crescente
    const sortedWeeks = [...weeks].sort((a, b) => a.start - b.start);

    sortedWeeks.forEach((w) => {
      if (w.data.length === 0) return;

      const weekTitle = document.createElement("h4");
      const weekNum = getISOWeek(w.start);
      const startStr = w.start.toLocaleDateString(lang);
      const endStr = new Date(
        w.start.getTime() + 6 * 86400000
      ).toLocaleDateString(lang);
      weekTitle.textContent =
        lang === "it"
          ? `Settimana ${weekNum} (${startStr} - ${endStr})`
          : `Week ${weekNum} (${startStr} - ${endStr})`;
      weekTitle.style.marginTop = "20px";
      weekTitle.style.fontSize = "16px";
      weekTitle.style.textAlign = "center";

      const container = document.createElement("div");
      const tempDiv = document.createElement("div");
      document.body.appendChild(tempDiv); // lo inseriamo temporaneamente nel DOM

      renderFocusChart(w.data, tempDiv); // modifica: passiamo il contenitore dove disegnare

      container.appendChild(tempDiv.firstElementChild); // copia il grafico vero
      document.body.removeChild(tempDiv); // rimuove il div temporaneo

      monthlyDiv.appendChild(weekTitle);
      monthlyDiv.appendChild(container);
    });
  });

  row.append(label);

  weeks.forEach((w) => row.append(renderMiniChart(w)));

  return row;
}

function renderYearBlock(year, yearMap) {
  // contextDiv.innerHTML = "";
  // contextDiv.style.marginLeft = "100px";

  const title = document.createElement("h4");
  title.textContent = year;
  title.style.textAlign = "left";
  title.style.marginLeft = "calc(-80px + 50%)";
  title.style.fontWeight = "bold";
  title.style.marginTop = "8px";
  title.style.marginBottom = "8px";
  contextDiv.append(title);

  // Trova mese minimo e massimo nell'anno
  const mesiPresenti = Array.from(yearMap.keys()).sort((a, b) => a - b);
  const meseMin = mesiPresenti[0];
  const meseMax = mesiPresenti[mesiPresenti.length - 1];

  // Cicla tutti i mesi compresi, anche se mancanti nei dati
  for (let month = meseMin; month <= meseMax; month++) {
    const weeksMap = yearMap.get(month) || new Map(); // Map vuota se il mese manca
    const weeksInMonth = getWeeksInMonth(year, month);
    const weekDataArray = weeksInMonth.map((weekStart) => {
      const key = weekStart.getTime();
      return {
        start: weekStart,
        data: weeksMap.get(key) || [],
      };
    });
    contextDiv.append(renderMonthRow(year, month, weekDataArray));
  }
}

function navigateWeek(direction) {
  if (miniChartsOrdered.length === 0) return;

  const newIndex = currentChartIndex + direction;
  if (newIndex >= 0 && newIndex < miniChartsOrdered.length) {
    miniChartsOrdered[newIndex].click(); // simula il click sul mini-chart
  }
}

function renderFocusChart(data, targetDiv = focusDiv, weekStart = null) {
  targetDiv.innerHTML = "";

  const lang = localStorage.getItem("lingua") || "it";
  const TITOLO_TOOLTIP = {
    it: (d) => `Messaggio: ${d.message}\nTossicità: ${d.tossicita}`,
    en: (d) => `Message: ${d.message}\nToxicity: ${d.tossicita}`,
  };

  const start =
    weekStart ??
    (data.length > 0
      ? startOfISOWeek(data[0].timeSlot)
      : startOfISOWeek(new Date()));

  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekLabel = lang === "it" ? "Settimana" : "Week";
  const isoWeek = getISOWeek(start);

  // Titolo e pulsanti solo se targetDiv è il focus principale
  if (targetDiv === focusDiv) {
    const navRow = document.createElement("div");
    navRow.style.display = "flex";
    navRow.style.alignItems = "center";
    navRow.style.justifyContent = "center";
    navRow.style.margin = "8px 0";
    navRow.style.gap = "16px";
    navRow.style.flexWrap = "wrap";

    const prevBtn = document.createElement("button");
    prevBtn.textContent = lang === "it" ? "←" : "←";
    prevBtn.disabled = currentChartIndex <= 0;
    prevBtn.classList.toggle("disabled-btn", currentChartIndex <= 0);
    prevBtn.onclick = () => {
      if (currentChartIndex > 0) navigateWeek(-1);
    };

    const nextBtn = document.createElement("button");
    nextBtn.textContent = lang === "it" ? "→" : "→";
    nextBtn.disabled = currentChartIndex >= miniChartsOrdered.length - 1;
    nextBtn.classList.toggle(
      "disabled-btn",
      currentChartIndex >= miniChartsOrdered.length - 1
    );
    nextBtn.onclick = () => {
      if (currentChartIndex < miniChartsOrdered.length - 1) navigateWeek(1);
    };

    const h3 = document.createElement("h3");
    h3.textContent = `${weekLabel} ${isoWeek} (${start.toLocaleDateString(
      lang
    )} - ${end.toLocaleDateString(lang)})`;
    h3.style.textAlign = "center";
    h3.style.margin = "0";
    // h3.style.flex = "1";

    navRow.appendChild(prevBtn);
    navRow.appendChild(h3);
    navRow.appendChild(nextBtn);
    targetDiv.appendChild(navRow);
  }

  if (data.length === 0) {
    const msg = document.createElement("p");
    msg.textContent =
      lang === "it"
        ? "Nessun messaggio in questa settimana."
        : "No messages in this week.";
    msg.style.textAlign = "center";
    msg.style.marginTop = "20px";
    msg.style.fontSize = "1.2rem";
    targetDiv.appendChild(msg);
    return;
  }

  const width = 600;
  const marginLeft = 80;
  const marginRight = 50;
  const offset = 10;

  const rangeStart = offset - 5;
  const rangeEnd = width - marginLeft - marginRight - offset + 5;
  const xScale = d3
    .scaleTime()
    .domain([start, end])
    .range([rangeStart, rangeEnd]);

  const chart = Plot.plot({
    width: width,
    height: 400,
    marginLeft: marginLeft,
    marginRight: marginRight,
    x: {
      type: "time",
      domain: [start, end],
      label: "Data",
      grid: true,
    },
    y: {
      label: lang === "it" ? "Utenti" : "Users",
      grid: true,
    },
    color: colorScale,
    style: {
      background: temaScuro ? "#1e1e1e" : "#fff",
      color: temaScuro ? "#e0e0e0" : "#000",
    },
    marks: [
      Plot.link(data, {
        x: "timeSlot",
        y1: "source",
        y2: "target",
        stroke: (d) =>
          getToxicColor(groupColorMap.get(d.group) || "#999", d.tossicita),
        strokeWidth: 1,
        title: TITOLO_TOOLTIP[lang],
      }),
      Plot.dot(data, {
        x: "timeSlot",
        y: "source",
        r: 4,
        fill: currentColors.source,
        stroke: currentColors.source,
        symbol: "triangle",
      }),
      Plot.dot(data, {
        x: "timeSlot",
        y: "target",
        r: 2,
        fill: currentColors.target,
        stroke: currentColors.target,
        symbol: "circle",
      }),
    ],
  });

  chart.addEventListener("click", (event) => {
    const boundingRect = chart.getBoundingClientRect();
    const clickX = event.clientX - boundingRect.left;
    const relativeX = clickX - marginLeft;

    const timeClicked = xScale.invert(relativeX);
    const dayStart = new Date(timeClicked);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const dayData = data.filter(
      (d) => d.timeSlot >= dayStart && d.timeSlot < dayEnd
    );

    renderDailyChart(dayData, dayStart);
  });

  chart.style.display = "block";
  chart.style.margin = "0 auto";

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = `${width}px`;
  wrapper.style.margin = "auto";
  wrapper.appendChild(chart);

  targetDiv.appendChild(wrapper);
}

function evidenziaSettimanaMiniGrafico(dataInizioSettimana) {
  // Rimuove evidenziazione esistente
  d3.select("#context").selectAll(".highlight-week").remove();

  // Calcola inizio e fine settimana
  const start = new Date(dataInizioSettimana);
  const end = new Date(start.getTime() + 6 * 86400000 + 86399999); // fino a domenica 23:59:59

  // Aggiunge rettangolo evidenziato nel mini-grafico
  d3.select("#context svg g")
    .append("rect")
    .attr("class", "highlight-week")
    .attr("x", x2(start))
    .attr("y", 0)
    .attr("width", x2(end) - x2(start))
    .attr("height", contextHeight) // usa l’altezza reale del contesto
    .attr("fill", "rgba(0, 123, 255, 0.2)")
    .attr("stroke", "#007bff")
    .attr("stroke-width", 1);
}

function renderDailyChart(dayData, date) {
  dailyDiv.innerHTML = "";

  const h4 = document.createElement("h4");
  const dayName = date.toLocaleDateString(lang === "it" ? "it-IT" : "en-US", {
    weekday: "long",
  });
  h4.textContent = `${dayName} (${date.toLocaleDateString("it-IT")})`;
  h4.style.fontSize = "18px";
  h4.style.textAlign = "center";
  dailyDiv.append(h4);

  /* const coloriGruppo = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
  ];

  const groupColorMap = new Map();
  let groupIndex = 0;
  for (const d of dayData) {
    if (!groupColorMap.has(d.group)) {
      groupColorMap.set(
        d.group,
        coloriGruppo[groupIndex % coloriGruppo.length]
      );
      groupIndex++;
    }
  } */

  if (dayData.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Nessun dato in questo giorno.";
    p.style.fontSize = "16px";
    p.style.textAlign = "center";
    dailyDiv.append(p);
    return;
  }

  const width = 575;
  const heightFocus = 350;
  const heightContext = 100;
  const margin = { top: 30, right: 40, bottom: 40, left: 70 };

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);

  const users = [
    ...new Set(dayData.flatMap((d) => [d.source, d.target])),
  ].sort();

  const xFocus = d3
    .scaleTime()
    .domain([dayStart, dayEnd])
    .range([margin.left, width - margin.right]);
  const yFocus = d3
    .scalePoint()
    .domain(users)
    .range([margin.top, heightFocus - margin.bottom])
    .padding(0.5);
  const xContext = d3
    .scaleTime()
    .domain([dayStart, dayEnd])
    .range([margin.left, width - margin.right]);
  const yContext = d3
    .scalePoint()
    .domain(users)
    .range([margin.top, heightContext - margin.bottom])
    .padding(0.5);

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", heightFocus + heightContext + margin.top + margin.bottom)
    .style("background", temaScuro ? "#1e1e1e" : "#f8f9fa");

  const tooltip = d3
    .select(dailyDiv)
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", temaScuro ? "#333" : "rgba(255, 255, 255, 0.9)")
    .style("color", temaScuro ? "#fff" : "#000")
    .style("padding", "8px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("font-size", "12px");

  svg
    .append("defs")
    .append("clipPath")
    .attr("id", "clip-focus")
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", width - margin.left - margin.right)
    .attr("height", heightFocus - margin.top - margin.bottom);

  const xAxisFocus = svg
    .append("g")
    .attr("transform", `translate(0,${heightFocus - margin.bottom})`)
    .attr("class", "axis")
    .call(
      d3
        .axisBottom(xFocus)
        .ticks(d3.timeHour.every(2))
        .tickFormat(d3.timeFormat("%H:%M"))
    );

  xAxisFocus
    .selectAll("text")
    .attr("transform", "rotate(45)")
    .style("text-anchor", "start")
    .style("font-size", "10px");

  const yLabel = lang === "it" ? "Utenti" : "Users";
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .attr("class", "axis")
    .call(d3.axisLeft(yFocus).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "8px");

  svg
    .append("text")
    .attr("transform", `rotate(-90)`)
    .attr("x", -heightFocus / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text(yLabel);

  const focusGroup = svg.append("g").attr("clip-path", "url(#clip-focus)");

  focusGroup
    .selectAll("line")
    .data(dayData)
    .join("line")
    .attr("x1", (d) => xFocus(d.timeSlot))
    .attr("y1", (d) => yFocus(d.source))
    .attr("x2", (d) => xFocus(d.timeSlot))
    .attr("y2", (d) => yFocus(d.target))
    .attr("stroke", (d) =>
      getToxicColor(groupColorMap.get(d.group) || "#999", d.tossicita)
    )
    .attr("stroke-width", 2)
    .attr("opacity", 0.85)
    .attr("stroke-linecap", "round")
    .on("mouseover", function (event, d) {
      const lang = localStorage.getItem("lingua") || "it";
      const LABELS = {
        it: {
          ora: "Ora messaggio",
          mittente: "Mittente",
          destinatario: "Destinatario",
          parole: "Numero parole",
          messaggio: "Messaggio",
          tossicita: "Tossicità",
        },
        en: {
          ora: "Message time",
          mittente: "Sender",
          destinatario: "Recipient",
          parole: "Word count",
          messaggio: "Message",
          tossicita: "Toxicity",
        },
      };
      const L = LABELS[lang];

      const timeStr = new Date(d.timeSlot).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      tooltip.transition().duration(200).style("opacity", 1);
      tooltip.html(`
    <strong>${L.ora}:</strong> ${timeStr}<br/>
    <strong>${L.mittente}:</strong> ${d.source}<br/>
    <strong>${L.destinatario}:</strong> ${d.target}<br/>
    <strong>${L.parole}:</strong> ${d.number_of_words}<br/>
    <strong>${L.messaggio}:</strong> ${d.message}<br/>
    <strong>${L.tossicita}:</strong> ${d.tossicita.toFixed(2)}
  `);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", function () {
      tooltip.transition().duration(200).style("opacity", 0);
    });

  focusGroup
    .selectAll("path")
    .data(dayData)
    .join("path")
    .attr(
      "transform",
      (d) => `translate(${xFocus(d.timeSlot)},${yFocus(d.source)})`
    )
    .attr("d", d3.symbol().type(d3.symbolTriangle).size(80))
    .attr("fill", currentColors.source)
    .attr("opacity", 0.9);

  focusGroup
    .selectAll("circle")
    .data(dayData)
    .join("circle")
    .attr("cx", (d) => xFocus(d.timeSlot))
    .attr("cy", (d) => yFocus(d.target))
    .attr("r", 3)
    .attr("fill", currentColors.target)
    .attr("opacity", 0.9);

  // --- CONTEXT ---
  const contextGroup = svg
    .append("g")
    .attr("transform", `translate(0,${heightFocus + margin.top})`);
  const contextContent = contextGroup.append("g");

  contextContent
    .selectAll("line")
    .data(dayData)
    .join("line")
    .attr("x1", (d) => xContext(d.timeSlot))
    .attr("y1", (d) => yContext(d.source))
    .attr("x2", (d) => xContext(d.timeSlot))
    .attr("y2", (d) => yContext(d.target))
    .attr("stroke", (d) =>
      getToxicColor(groupColorMap.get(d.group) || "#999", d.tossicita)
    )
    .attr("stroke-width", 1)
    .attr("opacity", 0.5)
    .attr("stroke-linecap", "round");

  contextContent
    .selectAll("path")
    .data(dayData)
    .join("path")
    .attr(
      "transform",
      (d) => `translate(${xContext(d.timeSlot)},${yContext(d.source)})`
    )
    .attr("d", d3.symbol().type(d3.symbolTriangle).size(48))
    .attr("fill", currentColors.source)
    .attr("opacity", 0.6);

  contextContent
    .selectAll("circle")
    .data(dayData)
    .join("circle")
    .attr("cx", (d) => xContext(d.timeSlot))
    .attr("cy", (d) => yContext(d.target))
    .attr("r", 2)
    .attr("fill", currentColors.target)
    .attr("opacity", 0.5);

  // Brush
  const brush = d3
    .brushX()
    .extent([
      [margin.left, margin.top],
      [width - margin.right, heightContext - margin.bottom],
    ])
    .on("brush end", (event) => {
      if (event.selection) {
        const [x0, x1] = event.selection.map(xContext.invert);
        xFocus.domain([x0, x1]);
      } else {
        xFocus.domain([dayStart, dayEnd]);
      }

      xAxisFocus.call(
        d3.axisBottom(xFocus).ticks(12).tickFormat(d3.timeFormat("%H:%M"))
      );
      xAxisFocus
        .selectAll("text")
        .attr("transform", "rotate(45)")
        .style("text-anchor", "start");

      focusGroup
        .selectAll("line")
        .attr("x1", (d) => xFocus(d.timeSlot))
        .attr("x2", (d) => xFocus(d.timeSlot));

      focusGroup
        .selectAll("path")
        .attr(
          "transform",
          (d) => `translate(${xFocus(d.timeSlot)},${yFocus(d.source)})`
        );

      focusGroup.selectAll("circle").attr("cx", (d) => xFocus(d.timeSlot));
    });

  contextGroup.append("g").attr("class", "brush").call(brush);

  svg
    .append("g")
    .attr("transform", `translate(0,${heightFocus + heightContext})`)
    .call(d3.axisBottom(xContext).ticks(6).tickFormat(d3.timeFormat("%H:%M")));
  svg.selectAll("text").attr("fill", temaScuro ? "#e0e0e0" : "#000");

  dailyDiv.append(svg.node());
}

const grouped = groupByYearAndMonth(links);
const years = Array.from(grouped.keys()).sort();

if (years.length > 0) {
  contextDiv.innerHTML = ""; // Pulisce UNA sola volta prima di ciclare
  contextDiv.style.marginLeft = "100px";

  for (const year of years) {
    renderYearBlock(year, grouped.get(year));
  }

  miniChartsOrdered = Array.from(document.querySelectorAll(".mini-chart"));
}

// Rende dinamico il cambio di filtro anche nella pagina visualizzazione
document.querySelectorAll(".dalton-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    const nuovoFiltro = btn.dataset.dalton;
    localStorage.setItem("daltonismo", nuovoFiltro);
    // Ricarica la pagina dei grafici senza ricaricare tutto
    location.reload();
  });
});
