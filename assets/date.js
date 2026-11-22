/**
 * 小满 · 日期计算内核
 *
 * 全部按“本地日历日”计算，不按 24 小时毫秒差计算，
 * 因此跨月、跨年和夏令时都不会少一天或多一天。
 */

export const DUE_DATE = "2027-03-05";
export const PREGNANCY_DAYS = 280; // 40 周
export const MIN_WEEKS = 0;
export const MAX_WEEKS = 42;
export const MAX_GESTATIONAL_DAYS = MAX_WEEKS * 7 + 6;

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = "xiaoman.profile.v1";

const MS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
];

/** 把 ISO 日历日转为自 1970-01-01 起的天数（用 UTC 仅作日历运算）。 */
function parseIsoDate(isoDate) {
  if (typeof isoDate !== "string") {
    throw new TypeError("日期必须是 YYYY-MM-DD 字符串");
  }

  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) {
    throw new RangeError(`日期格式不正确：${isoDate}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`日期不存在：${isoDate}`);
  }

  return { year, month, day, date };
}

function epochDay(isoDate) {
  return Math.round(parseIsoDate(isoDate).date.getTime() / MS_PER_DAY);
}

function isoFromEpochDay(dayNumber) {
  const date = new Date(dayNumber * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value) {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

/** 用本机日期，而不是 toISOString()（后者会按 UTC 切日）。 */
export function localTodayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(isoDate, amount) {
  if (!Number.isInteger(amount)) {
    throw new TypeError("天数必须是整数");
  }
  return isoFromEpochDay(epochDay(isoDate) + amount);
}

/** to - from，单位：日历天。 */
export function diffCalendarDays(fromIso, toIso) {
  return epochDay(toIso) - epochDay(fromIso);
}

export function weekdayName(isoDate) {
  const { date } = parseIsoDate(isoDate);
  return WEEKDAYS[date.getUTCDay()];
}

export function formatChineseDate(isoDate) {
  const { year, month, day } = parseIsoDate(isoDate);
  return `${year}年${month}月${day}日`;
}

export function formatShortChineseDate(isoDate) {
  const { month, day } = parseIsoDate(isoDate);
  return `${month}月${day}日`;
}

export function splitGestationalDays(totalDays) {
  const safeDays = Math.max(0, Math.trunc(totalDays));
  return {
    weeks: Math.floor(safeDays / 7),
    days: safeDays % 7,
  };
}

export function toGestationalDays(weeks, days = 0) {
  if (!Number.isInteger(weeks) || weeks < MIN_WEEKS || weeks > MAX_WEEKS) {
    throw new RangeError(`孕周需在 ${MIN_WEEKS}–${MAX_WEEKS} 周之间`);
  }
  if (!Number.isInteger(days) || days < 0 || days > 6) {
    throw new RangeError("孕天需在 0–6 天之间");
  }
  return weeks * 7 + days;
}

/**
 * 首次打开时按固定预产期给出一个合理的预填值。
 * 用户仍可按产检单上的实际孕周手动调整。
 */
export function deriveGestationalDaysFromDueDate(
  todayIso,
  dueDate = DUE_DATE,
) {
  const days = PREGNANCY_DAYS - diffCalendarDays(todayIso, dueDate);
  return Math.min(MAX_GESTATIONAL_DAYS, Math.max(0, days));
}

export function createProfile({
  weeks,
  days = 0,
  anchorDate,
  now = new Date(),
}) {
  const anchorGestationalDays = toGestationalDays(Number(weeks), Number(days));
  if (!isValidIsoDate(anchorDate)) {
    throw new RangeError("校准日期不正确");
  }

  const timestamp = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    dueDate: DUE_DATE,
    anchorDate,
    anchorGestationalDays,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** 读取旧数据时做防御式校验，坏数据会安全地回到设置页。 */
export function normalizeStoredProfile(rawValue) {
  let data = rawValue;

  if (typeof rawValue === "string") {
    try {
      data = JSON.parse(rawValue);
    } catch {
      return null;
    }
  }

  if (!data || typeof data !== "object") return null;
  if (data.schemaVersion !== SCHEMA_VERSION) return null;
  if (data.dueDate !== DUE_DATE) return null;
  if (!isValidIsoDate(data.anchorDate)) return null;
  if (
    !Number.isInteger(data.anchorGestationalDays) ||
    data.anchorGestationalDays < 0 ||
    data.anchorGestationalDays > MAX_GESTATIONAL_DAYS
  ) {
    return null;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    dueDate: DUE_DATE,
    anchorDate: data.anchorDate,
    anchorGestationalDays: data.anchorGestationalDays,
    createdAt:
      typeof data.createdAt === "string" ? data.createdAt : new Date(0).toISOString(),
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date(0).toISOString(),
  };
}

function stageFor(gestationalDays) {
  if (gestationalDays < 14 * 7) {
    return { key: "first", label: "孕早期" };
  }
  if (gestationalDays < 28 * 7) {
    return { key: "second", label: "孕中期" };
  }
  return { key: "third", label: "孕晚期" };
}

function nextMilestoneFor(gestationalDays, daysToDue) {
  if (gestationalDays < 28 * 7) {
    const remaining = 28 * 7 - gestationalDays;
    return {
      key: "third-trimester",
      title: "下一站 · 孕28周",
      note: `还有 ${remaining} 天，进入孕晚期`,
    };
  }

  if (gestationalDays < 37 * 7) {
    const remaining = 37 * 7 - gestationalDays;
    return {
      key: "term",
      title: "下一站 · 37周",
      note: `还有 ${remaining} 天，宝宝就足月了`,
    };
  }

  if (daysToDue > 0) {
    return {
      key: "due-date",
      title: "下一站 · 预产期",
      note: `还有 ${daysToDue} 天，就要见面了`,
    };
  }

  return {
    key: "ready",
    title: "宝宝已经足月啦",
    note: "随时准备见面，保持好心情",
  };
}

/**
 * 根据“校准日孕周 + 已经过去的日历天”计算今天的状态。
 * 即使手机日期被临时调早，孕周也不会倒退。
 */
export function getPregnancySnapshot(profile, todayIso) {
  const elapsedSinceAnchor = Math.max(
    0,
    diffCalendarDays(profile.anchorDate, todayIso),
  );
  const gestationalDays = profile.anchorGestationalDays + elapsedSinceAnchor;
  const { weeks, days } = splitGestationalDays(gestationalDays);
  const daysToDue = diffCalendarDays(todayIso, DUE_DATE);
  const progressRatio = Math.min(gestationalDays / PREGNANCY_DAYS, 1);
  const progressPercent = Math.min(100, Math.floor(progressRatio * 100));

  return {
    todayIso,
    dueDate: DUE_DATE,
    gestationalDays,
    gestationalWeeks: weeks,
    gestationalRemainderDays: days,
    stage: stageFor(gestationalDays),
    daysToDue,
    isDueToday: daysToDue === 0,
    isOverdue: daysToDue < 0,
    daysOverdue: Math.max(0, -daysToDue),
    countdownDays: Math.max(0, daysToDue),
    completedWeeks: Math.min(40, Math.floor(gestationalDays / 7)),
    progressRatio,
    progressPercent,
    nextMilestone: nextMilestoneFor(gestationalDays, daysToDue),
  };
}
