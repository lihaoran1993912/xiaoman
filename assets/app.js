import {
  DUE_DATE,
  STORAGE_KEY,
  createProfile,
  deriveGestationalDaysFromDueDate,
  diffCalendarDays,
  formatChineseDate,
  formatShortChineseDate,
  getPregnancySnapshot,
  localTodayIso,
  normalizeStoredProfile,
  splitGestationalDays,
  toGestationalDays,
  weekdayName,
} from "./date.js";

const DAILY_NOTES = [
  "今天也要好好吃饭，慢慢走路。你和宝宝，都不必着急。",
  "不必做满分的妈妈，做个舒服的自己就很好。",
  "宝宝在悄悄长大，你也可以安心地慢一点。",
  "累了就歇一会儿，世界不会因为你发呆五分钟而变糟。",
  "把今天过成喜欢的样子，就是很好的胎教。",
  "每一次心跳，都在靠近见面的那天。",
  "想吃什么就说出来，让家人好好宠你一下。",
  "今天也记得抬头看看天，呼吸一口新鲜空气。",
  "你已经走了很远，剩下的路，我们一起慢慢走。",
  "偶尔偷懒没关系，妈妈开心最重要。",
  "宝宝会记得你的声音，也记得你温柔的心情。",
  "等待不是空白，是爱在一天天长出来。",
  "睡个好觉，是今天最重要的待办。",
  "春天正在赶来，宝宝也是。",
  "慢一点没关系，你们有自己的节奏。",
];

const els = {
  boot: document.querySelector("#boot"),
  onboarding: document.querySelector("#onboarding"),
  setupForm: document.querySelector("#setup-form"),
  setupWeeks: document.querySelector("#setup-weeks"),
  setupDays: document.querySelector("#setup-days"),
  setupError: document.querySelector("#setup-error"),
  onboardingTitle: document.querySelector("#onboarding-title"),
  app: document.querySelector("#app"),
  greeting: document.querySelector("#greeting"),
  greetingNote: document.querySelector(".greeting-block__note"),
  todayLabel: document.querySelector("#today-label"),
  countdownNumber: document.querySelector("#countdown-number"),
  countdownUnit: document.querySelector("#countdown-unit"),
  countdownLabel: document.querySelector("#countdown-label-text"),
  countdownCaption: document.querySelector("#countdown-caption"),
  seasonTag: document.querySelector("#season-tag"),
  dueDate: document.querySelector("#due-date"),
  dueWeekday: document.querySelector("#due-weekday"),
  gestationalWeeks: document.querySelector("#gestational-weeks"),
  gestationalDays: document.querySelector("#gestational-days"),
  stageName: document.querySelector("#stage-name"),
  daysPregnant: document.querySelector("#days-pregnant"),
  progressPercent: document.querySelector("#progress-percent"),
  weekRail: document.querySelector("#week-rail"),
  stageLegend: document.querySelector(".stage-legend"),
  nextTitle: document.querySelector("#next-title"),
  nextNote: document.querySelector("#next-note"),
  dailyQuote: document.querySelector("#daily-quote"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsClose: document.querySelector("#settings-close"),
  settingsForm: document.querySelector("#settings-form"),
  settingsWeeks: document.querySelector("#settings-weeks"),
  settingsDays: document.querySelector("#settings-days"),
  settingsError: document.querySelector("#settings-error"),
  installTitle: document.querySelector("#install-title"),
  installCopy: document.querySelector("#install-copy"),
  clearButton: document.querySelector("#clear-button"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  clearCancel: document.querySelector("#clear-cancel"),
  clearConfirm: document.querySelector("#clear-confirm"),
  toast: document.querySelector("#toast"),
};

let currentProfile = null;
let latestSnapshot = null;
let lastRenderedDate = "";
let midnightTimer = null;
let toastTimer = null;
let lastFocusedElement = null;
let suppressSettingsRestore = false;

/* ------------------------------ 初始化 ------------------------------ */

function initialize() {
  buildWeekRail();
  bindStepButtons();
  bindEditors();
  bindSettings();
  bindClearFlow();
  bindMidnightRefresh();
  resetSetupInputs();

  currentProfile = readStoredProfile();

  if (currentProfile) {
    render();
    showApp({ focus: false });
  } else {
    showOnboarding({ focus: false });
  }

  populateInstallCopy();
  dismissBoot();
  registerServiceWorker();
}

/* ------------------------------ 存储 ------------------------------ */

function readStoredProfile() {
  try {
    return normalizeStoredProfile(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistProfile(profile) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

function clearStoredProfile() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 清理失败也不阻断当前页面回到初始状态。
  }
}

/* ------------------------------ 视图切换 ------------------------------ */

function showApp({ focus = true } = {}) {
  els.onboarding.hidden = true;
  els.app.hidden = false;
  window.scrollTo(0, 0);

  if (focus) {
    focusHeading(els.greeting);
  }
}

function showOnboarding({ focus = true } = {}) {
  els.app.hidden = true;
  els.onboarding.hidden = false;
  resetSetupInputs();
  window.scrollTo(0, 0);

  if (focus) {
    focusHeading(els.onboardingTitle);
  }
}

function focusHeading(element) {
  element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
}

function dismissBoot() {
  requestAnimationFrame(() => {
    els.boot.classList.add("boot--leaving");
    window.setTimeout(() => {
      els.boot.hidden = true;
    }, 280);
  });
}

/* ------------------------------ 渲染 ------------------------------ */

function buildWeekRail() {
  const fragment = document.createDocumentFragment();

  for (let week = 1; week <= 40; week += 1) {
    const segment = document.createElement("span");
    segment.setAttribute("aria-hidden", "true");
    segment.dataset.week = String(week);
    fragment.append(segment);
  }

  els.weekRail.append(fragment);
}

function render(now = new Date()) {
  if (!currentProfile) return;

  const todayIso = localTodayIso(now);
  const snapshot = getPregnancySnapshot(currentProfile, todayIso);
  latestSnapshot = snapshot;

  els.todayLabel.textContent = `${formatShortChineseDate(todayIso)} · ${weekdayName(todayIso)}`;
  renderGreeting(now);
  renderCountdown(snapshot);
  renderWeek(snapshot);
  renderDailyNote(todayIso);

  lastRenderedDate = todayIso;
}

function renderGreeting(now) {
  const hour = now.getHours();
  let greeting = "早安，妈妈";
  let note = "今天也和宝宝一起，慢慢长大。";

  if (hour >= 11 && hour < 14) {
    greeting = "午安，妈妈";
    note = "记得好好吃饭，也好好休息。";
  } else if (hour >= 14 && hour < 18) {
    greeting = "下午好，妈妈";
    note = "累了就歇一会儿，今天不用赶。";
  } else if (hour >= 18 && hour < 23) {
    greeting = "晚上好，妈妈";
    note = "今天辛苦了，慢慢收个尾吧。";
  } else if (hour >= 23 || hour < 5) {
    greeting = "夜深了，妈妈";
    note = "被窝和宝宝，都在等你休息。";
  }

  els.greeting.textContent = greeting;
  els.greetingNote.textContent = note;
}

function renderCountdown(snapshot) {
  if (snapshot.isDueToday) {
    els.countdownLabel.textContent = "今天就是预产期";
    els.countdownNumber.textContent = "0";
    els.countdownUnit.textContent = "天";
    els.countdownCaption.textContent = "宝宝随时可能来和你见面";
  } else if (snapshot.isOverdue) {
    els.countdownLabel.textContent = "宝宝已经超过预产期";
    els.countdownNumber.textContent = String(snapshot.daysOverdue);
    els.countdownUnit.textContent = "天";
    els.countdownCaption.textContent = "宝宝有自己的节奏，别着急";
  } else {
    els.countdownLabel.textContent = "距离预产期";
    els.countdownNumber.textContent = String(snapshot.countdownDays);
    els.countdownUnit.textContent = "天";

    if (snapshot.countdownDays <= 14) {
      els.countdownCaption.textContent = "就快见面了，慢慢准备好心情";
    } else if (snapshot.countdownDays <= 45) {
      els.countdownCaption.textContent = "春天正在赶来，你们也是";
    } else {
      els.countdownCaption.textContent = "宝宝会在春天，和你见面";
    }
  }

  els.seasonTag.textContent = snapshot.isDueToday
    ? "就是今天"
    : snapshot.isOverdue
      ? "静候佳音"
      : "春日见";

  els.dueDate.textContent = formatChineseDate(DUE_DATE);
  els.dueDate.dateTime = DUE_DATE;
  els.dueWeekday.textContent = weekdayName(DUE_DATE);
}

function renderWeek(snapshot) {
  els.gestationalWeeks.textContent = String(snapshot.gestationalWeeks);
  els.gestationalDays.textContent = String(snapshot.gestationalRemainderDays);
  els.stageName.textContent = snapshot.stage.label;
  els.daysPregnant.textContent = `已走过 ${snapshot.gestationalDays} 天`;
  els.progressPercent.textContent = `${snapshot.progressPercent}%`;

  els.weekRail.setAttribute("aria-valuenow", String(snapshot.progressPercent));
  els.weekRail.setAttribute(
    "aria-valuetext",
    `孕期进度 ${snapshot.progressPercent}%，${snapshot.gestationalWeeks}周${snapshot.gestationalRemainderDays}天`,
  );

  const completedWeeks = Math.min(
    40,
    Math.floor(snapshot.gestationalDays / 7),
  );
  const partialWeek = Math.min(1, (snapshot.gestationalDays % 7) / 7);

  Array.from(els.weekRail.children).forEach((segment, index) => {
    segment.classList.remove("is-filled", "is-current");
    segment.style.removeProperty("--week-fill");

    if (index < completedWeeks) {
      segment.classList.add("is-filled");
    } else if (index === completedWeeks && partialWeek > 0) {
      segment.classList.add("is-current");
      segment.style.setProperty("--week-fill", `${partialWeek * 100}%`);
    }
  });

  els.stageLegend.querySelectorAll("[data-stage]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.stage === snapshot.stage.key);
  });

  els.nextTitle.textContent = snapshot.nextMilestone.title;
  els.nextNote.textContent = snapshot.nextMilestone.note;
}

function renderDailyNote(todayIso) {
  const daysSinceReference = Math.max(
    0,
    diffCalendarDays("2026-01-01", todayIso),
  );
  els.dailyQuote.textContent = DAILY_NOTES[daysSinceReference % DAILY_NOTES.length];
}

/* ------------------------------ 首次设置 ------------------------------ */

function resetSetupInputs() {
  const todayIso = localTodayIso();
  const gaDays = deriveGestationalDaysFromDueDate(todayIso);
  const { weeks, days } = splitGestationalDays(gaDays);

  els.setupWeeks.value = String(weeks);
  els.setupDays.value = String(days);
  clearFormError("setup");
}

function bindEditors() {
  document.querySelectorAll(".ga-editor").forEach((editor) => {
    const key = editor.dataset.editor;
    const inputs = editor.querySelectorAll("input");

    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        const leadingDigits = (input.value.match(/^\d{0,3}/) || [""])[0];
        if (leadingDigits !== input.value) input.value = leadingDigits;

        inputs.forEach((item) => item.setAttribute("aria-invalid", "false"));
        clearFormError(key);
      });

      input.addEventListener("focus", () => {
        input.select();
      });
    });
  });
}

function bindStepButtons() {
  document.querySelectorAll("[data-step-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(
        `#${CSS.escape(button.dataset.stepTarget)}`,
      );
      if (!target) return;

      const min = Number(target.min);
      const max = Number(target.max);
      const delta = Number(button.dataset.stepDelta);
      const current = Number.isInteger(Number.parseInt(target.value, 10))
        ? Number.parseInt(target.value, 10)
        : min;
      const next = Math.min(max, Math.max(min, current + delta));

      target.value = String(next);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

function readEditor(prefix) {
  const isSettings = prefix === "settings";
  const weeksInput = isSettings ? els.settingsWeeks : els.setupWeeks;
  const daysInput = isSettings ? els.settingsDays : els.setupDays;
  const errorElement = isSettings ? els.settingsError : els.setupError;
  const weekRaw = weeksInput.value.trim();
  const dayRaw = daysInput.value.trim();

  [weeksInput, daysInput].forEach((input) =>
    input.setAttribute("aria-invalid", "false"),
  );

  if (!/^\d{1,3}$/.test(weekRaw) || !/^\d{1,3}$/.test(dayRaw)) {
    setFormError(
      errorElement,
      "请填写完整的孕周和孕天，例如 25 周 + 2 天。",
    );
    weeksInput.setAttribute("aria-invalid", "true");
    daysInput.setAttribute("aria-invalid", "true");
    const focusTarget = /^\d{1,3}$/.test(weekRaw) ? daysInput : weeksInput;
    focusTarget.focus({ preventScroll: false });
    return null;
  }

  const weeks = Number(weekRaw);
  const days = Number(dayRaw);

  if (weeks < 0 || weeks > 42) {
    setFormError(errorElement, "孕周请填写 0–42 周之间。");
    weeksInput.setAttribute("aria-invalid", "true");
    weeksInput.focus({ preventScroll: false });
    return null;
  }

  if (days < 0 || days > 6) {
    setFormError(errorElement, "孕天请填写 0–6 天之间。");
    daysInput.setAttribute("aria-invalid", "true");
    daysInput.focus({ preventScroll: false });
    return null;
  }

  try {
    toGestationalDays(weeks, days);
  } catch {
    setFormError(errorElement, "这组孕周不太对，请再检查一下。");
    return null;
  }

  clearFormError(prefix);
  return { weeks, days };
}

function setFormError(errorElement, message) {
  errorElement.textContent = message;
  errorElement.hidden = false;
}

function clearFormError(prefix) {
  const errorElement = prefix === "settings" ? els.settingsError : els.setupError;
  errorElement.textContent = "";
  errorElement.hidden = true;
}

function handleSetupSubmit(event) {
  event.preventDefault();
  const values = readEditor("setup");
  if (!values) return;

  const now = new Date();
  const todayIso = localTodayIso(now);
  const profile = createProfile({
    weeks: values.weeks,
    days: values.days,
    anchorDate: todayIso,
    now,
  });

  currentProfile = profile;
  const persisted = persistProfile(profile);

  render(now);
  showApp({ focus: true });

  if (!persisted) {
    showToast("浏览器未能保存记录，关闭后可能需要重新填写");
  }
}

/* ------------------------------ 设置 ------------------------------ */

function bindSettings() {
  els.dueDate.textContent = formatChineseDate(DUE_DATE);
  els.dueWeekday.textContent = weekdayName(DUE_DATE);

  els.settingsButton.addEventListener("click", openSettings);
  els.settingsClose.addEventListener("click", () => closeDialog(els.settingsDialog));
  els.settingsForm.addEventListener("submit", handleSettingsSubmit);

  [els.settingsDialog, els.confirmDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        if (dialog === els.confirmDialog) {
          cancelClearFlow();
        } else {
          closeDialog(dialog);
        }
      }
    });

    dialog.addEventListener("close", () => {
      document.body.classList.toggle(
        "has-dialog",
        Boolean(document.querySelector("dialog[open]")),
      );
    });
  });

  els.settingsDialog.addEventListener("cancel", () => {
    document.body.classList.remove("has-dialog");
  });
}

function openSettings() {
  if (!currentProfile) return;

  suppressSettingsRestore = false;
  render();
  lastFocusedElement = document.activeElement;
  populateSettingsInputs();
  openDialog(els.settingsDialog);
}

function populateSettingsInputs() {
  const todayIso = localTodayIso();
  const snapshot = currentProfile
    ? getPregnancySnapshot(currentProfile, todayIso)
    : null;
  const totalDays = snapshot?.gestationalDays ?? deriveGestationalDaysFromDueDate(todayIso);
  const { weeks, days } = splitGestationalDays(Math.min(totalDays, 42 * 7 + 6));

  els.settingsWeeks.value = String(weeks);
  els.settingsDays.value = String(days);
  clearFormError("settings");
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const values = readEditor("settings");
  if (!values) return;

  const now = new Date();
  const todayIso = localTodayIso(now);
  const previousCreatedAt = currentProfile?.createdAt;
  const profile = createProfile({
    weeks: values.weeks,
    days: values.days,
    anchorDate: todayIso,
    now,
  });

  if (previousCreatedAt) profile.createdAt = previousCreatedAt;

  currentProfile = profile;
  const persisted = persistProfile(profile);

  closeDialog(els.settingsDialog);
  render(now);
  showToast(persisted ? "孕周已更新" : "孕周已更新，但未能保存到本机");
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  document.body.classList.add("has-dialog");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }

  document.body.classList.toggle(
    "has-dialog",
    Boolean(document.querySelector("dialog[open]")),
  );

  if (
    dialog === els.settingsDialog &&
    lastFocusedElement &&
    typeof lastFocusedElement.focus === "function" &&
    !suppressSettingsRestore
  ) {
    lastFocusedElement.focus({ preventScroll: true });
  }
}

function populateInstallCopy() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (!isStandalone) return;

  els.installTitle.textContent = "已添加到主屏幕";
  els.installCopy.textContent = "小满也能离线打开，孕周会继续跟着日历长大。";
}

/* ------------------------------ 清除记录 ------------------------------ */

function bindClearFlow() {
  els.clearButton.addEventListener("click", () => {
    suppressSettingsRestore = true;
    closeDialog(els.settingsDialog);
    window.setTimeout(() => {
      openDialog(els.confirmDialog);
    }, 40);
  });

  els.clearCancel.addEventListener("click", cancelClearFlow);
  els.clearConfirm.addEventListener("click", confirmClearFlow);

  els.confirmDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    cancelClearFlow();
  });
}

function cancelClearFlow() {
  closeDialog(els.confirmDialog);
  window.setTimeout(() => {
    suppressSettingsRestore = false;
    openDialog(els.settingsDialog);
  }, 40);
}

function confirmClearFlow() {
  clearStoredProfile();
  currentProfile = null;
  latestSnapshot = null;
  lastRenderedDate = "";
  suppressSettingsRestore = true;
  closeDialog(els.confirmDialog);
  showOnboarding({ focus: true });
  showToast("记录已清除");
}

/* ------------------------------ 日期刷新 ------------------------------ */

function renderIfDateChanged() {
  if (!currentProfile) return;

  const todayIso = localTodayIso();
  if (todayIso !== lastRenderedDate) {
    render();
  } else {
    renderGreeting(new Date());
  }
}

function scheduleMidnightRefresh() {
  window.clearTimeout(midnightTimer);
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    2,
  );
  const delay = Math.max(1_000, nextMidnight.getTime() - now.getTime());

  midnightTimer = window.setTimeout(() => {
    renderIfDateChanged();
    scheduleMidnightRefresh();
  }, delay);
}

function bindMidnightRefresh() {
  scheduleMidnightRefresh();
  window.addEventListener("focus", renderIfDateChanged);
  window.addEventListener("pageshow", () => {
    renderIfDateChanged();
    scheduleMidnightRefresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      renderIfDateChanged();
      scheduleMidnightRefresh();
    }
  });
}

/* ------------------------------ 轻提示 ------------------------------ */

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2_600);
}

/* ------------------------------ Service Worker ------------------------------ */

function registerServiceWorker() {
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname,
  );
  const canUseServiceWorker =
    "serviceWorker" in navigator &&
    (window.isSecureContext || isLocalhost);

  if (!canUseServiceWorker) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // 离线能力不可用时，App 仍然可以正常在线使用。
    });
  });
}

/* ------------------------------ 启动 ------------------------------ */

els.setupForm.addEventListener("submit", handleSetupSubmit);

try {
  initialize();
} catch (error) {
  console.error("小满启动失败：", error);
  if (els.boot) {
    els.boot.textContent = "小满暂时没能打开，请刷新再试";
    els.boot.classList.add("boot--error");
  }
}
