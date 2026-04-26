const STORAGE_KEY = "ninho-playroom-data-v1";

const state = loadState();

const tabButtons = [...document.querySelectorAll(".tab")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];
const eventForm = document.getElementById("event-form");
const profileForm = document.getElementById("profile-form");
const eventTypeSelect = document.getElementById("event-type");
const startInput = document.getElementById("start-input");
const endInput = document.getElementById("end-input");
const recentEventsEl = document.getElementById("recent-events");
const historyEventsEl = document.getElementById("history-events");
const feedChartEl = document.getElementById("feed-chart");
const clearButton = document.getElementById("clear-data");

const feedTypes = new Set(["feed"]);
const timedTypes = new Set(["sleep"]);
const amountTypes = new Set(["feed", "pump"]);
const doseTypes = new Set(["medicine"]);

initialize();

function initialize() {
  const now = new Date();
  const localIso = toLocalInputValue(now);
  startInput.value = localIso;
  endInput.value = localIso;

  bindEvents();
  render();
  updateConditionalFields();
}

function bindEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
  });

  eventTypeSelect.addEventListener("change", updateConditionalFields);
  eventForm.addEventListener("submit", handleEventSubmit);
  profileForm.addEventListener("submit", handleProfileSubmit);
  clearButton.addEventListener("click", clearData);
}

function activateTab(tabName) {
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tabTarget === tabName));
  tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === tabName));
}

function updateConditionalFields() {
  const type = eventTypeSelect.value;

  document.querySelectorAll(".conditional").forEach((field) => {
    field.classList.add("hidden");
  });

  document.querySelectorAll(`.field-${type}`).forEach((field) => field.classList.remove("hidden"));
}

function handleEventSubmit(event) {
  event.preventDefault();
  const formData = new FormData(eventForm);
  const type = formData.get("type");
  const start = formData.get("start");
  const end = formData.get("end");

  const newEvent = {
    id: crypto.randomUUID(),
    type,
    caregiver: formData.get("caregiver") || "Cuidado",
    start,
    end: end || "",
    amount: Number(formData.get("amount")) || 0,
    diaperKind: formData.get("diaperKind") || "",
    dose: Number(formData.get("dose")) || 0,
    note: (formData.get("note") || "").toString().trim(),
    createdAt: new Date().toISOString()
  };

  state.events.unshift(newEvent);
  persistState();
  render();
  eventForm.reset();
  const now = toLocalInputValue(new Date());
  startInput.value = now;
  endInput.value = now;
  eventTypeSelect.value = "feed";
  updateConditionalFields();
  activateTab("hoje");
}

function handleProfileSubmit(event) {
  event.preventDefault();
  const formData = new FormData(profileForm);

  state.profile = {
    babyName: (formData.get("babyName") || "").toString().trim(),
    birthDate: formData.get("birthDate") || "",
    dailyGoalMl: Number(formData.get("dailyGoalMl")) || 0
  };

  persistState();
  render();
}

function render() {
  hydrateProfileForm();
  renderDashboard();
  renderTrendBoard();
  renderHistory();
}

function hydrateProfileForm() {
  profileForm.elements.babyName.value = state.profile.babyName || "";
  profileForm.elements.birthDate.value = state.profile.birthDate || "";
  profileForm.elements.dailyGoalMl.value = state.profile.dailyGoalMl || "";
}

function renderDashboard() {
  const events = normalizedEvents();
  const recentEvents = events.slice(0, 6);
  const todayFeedEvents = events.filter((item) => isWithinHours(item.startDate, 24) && item.type === "feed");
  const todaySleepEvents = events.filter((item) => isWithinHours(item.startDate, 24) && item.type === "sleep");
  const todayPumpEvents = events.filter((item) => isWithinHours(item.startDate, 24) && item.type === "pump");
  const todayDiaperEvents = events.filter((item) => isWithinHours(item.startDate, 24) && item.type === "diaper");

  const intakeMl = sum(todayFeedEvents.map((item) => item.amount));
  const sleepMinutes = sum(todaySleepEvents.map((item) => getDurationMinutes(item)));
  const pumpMl = sum(todayPumpEvents.map((item) => item.amount));

  setText("today-intake", `${intakeMl} ml`);
  setText("today-sleep", formatMinutes(sleepMinutes));
  setText("today-diapers", String(todayDiaperEvents.length));
  setText("today-pump", `${pumpMl} ml`);
  setText("avg-feed-gap", formatAverageFeedGap(todayFeedEvents));
  setText("avg-awake-window", formatAverageAwakeWindow(events));
  setText("longest-nap", formatLongestNap(todaySleepEvents));

  const suggestion = buildNextAction(events);
  setText("next-action-title", suggestion.title);
  setText("next-action-copy", suggestion.copy);

  renderEventList(recentEventsEl, recentEvents);
}

function renderTrendBoard() {
  const events = normalizedEvents();
  const last24h = events.filter((item) => isWithinHours(item.startDate, 24));
  const feedEvents = last24h.filter((item) => item.type === "feed");
  const sleepEvents = last24h.filter((item) => item.type === "sleep");

  setText("feeds-count", String(feedEvents.length));
  setText("avg-feed-volume", feedEvents.length ? `${Math.round(average(feedEvents.map((item) => item.amount)))} ml` : "-");
  setText("trend-longest-sleep", formatLongestNap(sleepEvents));
  setText("caregiver-share", caregiverShare(last24h));

  const headline = buildTrendHeadline(feedEvents, sleepEvents);
  setText("trend-headline", headline.title);
  setText("trend-summary", headline.summary);
  renderFeedChart(feedEvents);
}

function renderHistory() {
  renderEventList(historyEventsEl, normalizedEvents());
}

function renderEventList(container, events) {
  if (!events.length) {
    container.className = "event-list empty-state";
    container.textContent = "Nenhum evento registrado ainda.";
    return;
  }

  container.className = "event-list";
  container.innerHTML = events.map(renderEventItem).join("");
}

function renderEventItem(item) {
  const meta = getEventMeta(item);
  return `
    <article class="event-item">
      <div class="event-badge badge-${item.type}">${meta.badge}</div>
      <div class="event-meta">
        <h3>${meta.title}</h3>
        <p>${meta.description}</p>
      </div>
      <div class="event-side">
        <p>${formatDateTime(item.startDate)}</p>
        <p>${item.caregiver}</p>
      </div>
    </article>
  `;
}

function getEventMeta(item) {
  if (item.type === "feed") {
    return {
      badge: "Leite",
      title: `${item.amount || 0} ml registrados`,
      description: item.note || "Mamadeira ou leite registrado."
    };
  }

  if (item.type === "sleep") {
    return {
      badge: "Sono",
      title: `Sono de ${formatMinutes(getDurationMinutes(item))}`,
      description: item.note || "Período de sono registrado."
    };
  }

  if (item.type === "diaper") {
    return {
      badge: "Fralda",
      title: `Troca: ${capitalize(item.diaperKind || "sem tipo")}`,
      description: item.note || "Troca de fralda registrada."
    };
  }

  if (item.type === "pump") {
    return {
      badge: "Bomba",
      title: `${item.amount || 0} ml extraídos`,
      description: item.note || "Sessão de bomba registrada."
    };
  }

  if (item.type === "medicine") {
    return {
      badge: "Remédio",
      title: `${item.dose || 0} ml administrados`,
      description: item.note || "Medicamento registrado."
    };
  }

  return {
    badge: "Nota",
    title: "Anotação rápida",
    description: item.note || "Sem observação detalhada."
  };
}

function buildNextAction(events) {
  const lastFeed = events.find((item) => item.type === "feed");
  const lastSleep = events.find((item) => item.type === "sleep");

  if (!lastFeed && !lastSleep) {
    return {
      title: "Comece registrando a próxima mamada",
      copy: "Com 3 ou 4 eventos já dá para mostrar tendências úteis."
    };
  }

  const now = Date.now();
  const feedGapMin = lastFeed ? Math.round((now - lastFeed.startDate.getTime()) / 60000) : null;
  const awakeGapMin = lastSleep && lastSleep.endDate ? Math.round((now - lastSleep.endDate.getTime()) / 60000) : null;

  if (awakeGapMin !== null && awakeGapMin >= 90) {
    return {
      title: "Pode estar chegando a hora de novo cochilo",
      copy: `Já faz ${formatMinutes(awakeGapMin)} desde o último sono encerrado.`
    };
  }

  if (feedGapMin !== null && feedGapMin >= 150) {
    return {
      title: "Vale checar a próxima mamada",
      copy: `Já passaram ${formatMinutes(feedGapMin)} desde a última alimentação.`
    };
  }

  return {
    title: "Rotina dentro do esperado",
    copy: "Os últimos registros não indicam urgência imediata."
  };
}

function buildTrendHeadline(feedEvents, sleepEvents) {
  if (!feedEvents.length && !sleepEvents.length) {
    return {
      title: "Sem dados suficientes ainda",
      summary: "Registre alguns eventos para gerar um resumo automático do dia."
    };
  }

  const intake = sum(feedEvents.map((item) => item.amount));
  const longestNap = longestDuration(sleepEvents);

  return {
    title: `Hoje já foram ${intake} ml e o maior cochilo foi de ${formatMinutes(longestNap)}.`,
    summary: "Esse tipo de resumo costuma ajudar bastante na conversa entre cuidadores e em consultas."
  };
}

function formatAverageFeedGap(events) {
  if (events.length < 2) {
    return "-";
  }

  const sorted = [...events].sort((a, b) => a.startDate - b.startDate);
  const gaps = [];

  for (let index = 1; index < sorted.length; index += 1) {
    gaps.push(Math.round((sorted[index].startDate - sorted[index - 1].startDate) / 60000));
  }

  return formatMinutes(Math.round(average(gaps)));
}

function formatAverageAwakeWindow(events) {
  const sleepEvents = events
    .filter((item) => item.type === "sleep" && item.endDate)
    .sort((a, b) => a.startDate - b.startDate);

  if (sleepEvents.length < 2) {
    return "-";
  }

  const windows = [];

  for (let index = 1; index < sleepEvents.length; index += 1) {
    const previous = sleepEvents[index - 1];
    const current = sleepEvents[index];
    if (previous.endDate && current.startDate > previous.endDate) {
      windows.push(Math.round((current.startDate - previous.endDate) / 60000));
    }
  }

  if (!windows.length) {
    return "-";
  }

  return formatMinutes(Math.round(average(windows)));
}

function formatLongestNap(events) {
  const longest = longestDuration(events);
  return longest ? formatMinutes(longest) : "-";
}

function longestDuration(events) {
  return events.reduce((max, item) => Math.max(max, getDurationMinutes(item)), 0);
}

function caregiverShare(events) {
  if (!events.length) {
    return "-";
  }

  const counts = events.reduce((accumulator, item) => {
    accumulator[item.caregiver] = (accumulator[item.caregiver] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([name, count]) => `${name}: ${count}`)
    .join(" | ");
}

function renderFeedChart(feedEvents) {
  const buckets = [
    { label: "Madrugada", start: 0, end: 6, total: 0 },
    { label: "Manhã", start: 6, end: 12, total: 0 },
    { label: "Tarde", start: 12, end: 18, total: 0 },
    { label: "Noite", start: 18, end: 24, total: 0 }
  ];

  feedEvents.forEach((event) => {
    const hour = event.startDate.getHours();
    const bucket = buckets.find((item) => hour >= item.start && hour < item.end);
    if (bucket) {
      bucket.total += event.amount || 0;
    }
  });

  const maxTotal = Math.max(...buckets.map((item) => item.total), 0);

  if (maxTotal === 0) {
    feedChartEl.innerHTML = '<div class="chart-empty">Adicione mamadas para visualizar o gráfico.</div>';
    return;
  }

  feedChartEl.innerHTML = buckets.map((bucket) => {
    const height = Math.max(16, Math.round((bucket.total / maxTotal) * 180));
    return `
      <article class="chart-bar-card">
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height: ${height}px"></div>
        </div>
        <div class="chart-meta">
          <strong>${bucket.total} ml</strong>
          <span>${bucket.label}</span>
        </div>
      </article>
    `;
  }).join("");
}

function clearData() {
  if (!window.confirm("Apagar todos os registros salvos neste navegador?")) {
    return;
  }

  state.events = [];
  state.profile = defaultProfile();
  persistState();
  render();
}

function seedSampleData() {
  const now = Date.now();
  state.events = [
    sampleEvent("feed", now - 45 * 60000, 0, { amount: 180, caregiver: "Esposa", note: "Mamou bem e arrotou rápido." }),
    sampleEvent("diaper", now - 95 * 60000, 0, { diaperKind: "xixi", caregiver: "Filipe" }),
    sampleEvent("sleep", now - 3.2 * 3600000, now - 1.4 * 3600000, { caregiver: "Esposa", note: "Dormiu sozinho no berço." }),
    sampleEvent("feed", now - 4.1 * 3600000, 0, { amount: 210, caregiver: "Filipe" }),
    sampleEvent("pump", now - 6.2 * 3600000, now - 5.9 * 3600000, { amount: 150, caregiver: "Esposa" }),
    sampleEvent("sleep", now - 8.5 * 3600000, now - 7.1 * 3600000, { caregiver: "Filipe" }),
    sampleEvent("diaper", now - 8.9 * 3600000, 0, { diaperKind: "mista", caregiver: "Esposa" }),
    sampleEvent("medicine", now - 11 * 3600000, 0, { dose: 2.5, caregiver: "Filipe", note: "Vitamina D." })
  ];
  state.profile = {
    babyName: "Theo",
    birthDate: "",
    dailyGoalMl: 800
  };
  persistState();
  render();
}

function sampleEvent(type, startMs, endMs, extra = {}) {
  return {
    id: crypto.randomUUID(),
    type,
    caregiver: extra.caregiver || "Filipe",
    start: toLocalInputValue(new Date(startMs)),
    end: endMs ? toLocalInputValue(new Date(endMs)) : "",
    amount: extra.amount || 0,
    diaperKind: extra.diaperKind || "",
    dose: extra.dose || 0,
    note: extra.note || "",
    createdAt: new Date().toISOString()
  };
}

function normalizedEvents() {
  return [...state.events]
    .map((item) => ({
      ...item,
      startDate: new Date(item.start),
      endDate: item.end ? new Date(item.end) : null
    }))
    .sort((a, b) => b.startDate - a.startDate);
}

function getDurationMinutes(item) {
  if (!item.endDate || Number.isNaN(item.endDate.getTime())) {
    return 0;
  }

  return Math.max(0, Math.round((item.endDate - item.startDate) / 60000));
}

function sum(values) {
  return values.reduce((total, current) => total + current, 0);
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return sum(values) / values.length;
}

function isWithinHours(date, hours) {
  return Date.now() - date.getTime() <= hours * 3600000;
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toLocalInputValue(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function capitalize(value) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { profile: defaultProfile(), events: [] };
    }

    const parsed = JSON.parse(raw);
    return {
      profile: parsed.profile || defaultProfile(),
      events: Array.isArray(parsed.events) ? parsed.events : []
    };
  } catch {
    return { profile: defaultProfile(), events: [] };
  }
}

function persistState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function defaultProfile() {
  return {
    babyName: "",
    birthDate: "",
    dailyGoalMl: 0
  };
}
