import assert from "node:assert/strict";
import test from "node:test";

import {
  DUE_DATE,
  MAX_GESTATIONAL_DAYS,
  STORAGE_KEY,
  addCalendarDays,
  createProfile,
  deriveGestationalDaysFromDueDate,
  diffCalendarDays,
  formatChineseDate,
  getPregnancySnapshot,
  localTodayIso,
  normalizeStoredProfile,
  splitGestationalDays,
  toGestationalDays,
  weekdayName,
} from "../assets/date.js";

const TODAY = "2026-11-22";
const DUE_DAYS = 103;

function makeProfile({
  weeks = 25,
  days = 2,
  anchorDate = TODAY,
} = {}) {
  return createProfile({
    weeks,
    days,
    anchorDate,
    now: new Date(2026, 10, 22, 10, 0, 0),
  });
}

test("fixed due date is Friday, 2027-03-05", () => {
  assert.equal(DUE_DATE, "2027-03-05");
  assert.equal(formatChineseDate(DUE_DATE), "2027年3月5日");
  assert.equal(weekdayName(DUE_DATE), "星期五");
});

test("localTodayIso uses the local calendar day rather than UTC", () => {
  assert.equal(localTodayIso(new Date(2026, 10, 22, 0, 0, 1)), "2026-11-22");
  assert.equal(localTodayIso(new Date(2026, 10, 22, 23, 59, 59)), "2026-11-22");
});

test("calendar arithmetic crosses months, years and leap days", () => {
  assert.equal(diffCalendarDays("2026-11-30", "2026-12-01"), 1);
  assert.equal(diffCalendarDays("2026-12-31", "2027-01-01"), 1);
  assert.equal(diffCalendarDays("2027-02-28", "2027-03-01"), 1);
  assert.equal(diffCalendarDays("2028-02-28", "2028-02-29"), 1);
  assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addCalendarDays("2027-03-05", -280), "2026-05-29");
});

test("default gestational age is derived from the fixed due date", () => {
  const gaDays = deriveGestationalDaysFromDueDate(TODAY);
  assert.equal(gaDays, 177);
  assert.deepEqual(splitGestationalDays(gaDays), { weeks: 25, days: 2 });
  assert.equal(diffCalendarDays(TODAY, DUE_DATE), DUE_DAYS);
});

test("initial snapshot is coherent for 2026-11-22", () => {
  const snapshot = getPregnancySnapshot(makeProfile(), TODAY);

  assert.equal(snapshot.gestationalDays, 177);
  assert.equal(snapshot.gestationalWeeks, 25);
  assert.equal(snapshot.gestationalRemainderDays, 2);
  assert.equal(snapshot.countdownDays, DUE_DAYS);
  assert.equal(snapshot.daysToDue, DUE_DAYS);
  assert.equal(snapshot.progressPercent, 63);
  assert.equal(snapshot.completedWeeks, 25);
  assert.equal(snapshot.stage.key, "second");
  assert.equal(snapshot.stage.label, "孕中期");
  assert.equal(snapshot.nextMilestone.title, "下一站 · 孕28周");
  assert.equal(snapshot.nextMilestone.note, "还有 19 天，进入孕晚期");
  assert.equal(snapshot.isDueToday, false);
  assert.equal(snapshot.isOverdue, false);
});

test("gestational days and countdown both advance with calendar days", () => {
  const profile = makeProfile();
  const nextDay = getPregnancySnapshot(profile, "2026-11-23");
  const fifthDay = getPregnancySnapshot(profile, "2026-11-27");
  const nextWeek = getPregnancySnapshot(profile, "2026-12-01");

  assert.equal(nextDay.gestationalDays, 178);
  assert.equal(nextDay.gestationalWeeks, 25);
  assert.equal(nextDay.gestationalRemainderDays, 3);
  assert.equal(nextDay.countdownDays, DUE_DAYS - 1);

  // 25周+2天，过 5 天正好进入 26周+0天。
  assert.equal(fifthDay.gestationalWeeks, 26);
  assert.equal(fifthDay.gestationalRemainderDays, 0);

  assert.equal(nextWeek.gestationalWeeks, 26);
  assert.equal(nextWeek.gestationalRemainderDays, 4);
  assert.equal(nextWeek.countdownDays, 94);
});

test("due date shows zero days and 40 weeks without premature 100 percent", () => {
  const dayBefore = getPregnancySnapshot(makeProfile(), "2027-03-04");
  const dueDay = getPregnancySnapshot(makeProfile(), "2027-03-05");

  assert.equal(dayBefore.countdownDays, 1);
  assert.equal(dayBefore.gestationalWeeks, 39);
  assert.equal(dayBefore.gestationalRemainderDays, 6);
  assert.equal(dayBefore.progressPercent, 99);

  assert.equal(dueDay.countdownDays, 0);
  assert.equal(dueDay.daysToDue, 0);
  assert.equal(dueDay.gestationalWeeks, 40);
  assert.equal(dueDay.gestationalRemainderDays, 0);
  assert.equal(dueDay.progressPercent, 100);
  assert.equal(dueDay.isDueToday, true);
  assert.equal(dueDay.nextMilestone.key, "ready");
});

test("overdue days are represented without negative countdown", () => {
  const snapshot = getPregnancySnapshot(makeProfile(), "2027-03-08");

  assert.equal(snapshot.isOverdue, true);
  assert.equal(snapshot.daysOverdue, 3);
  assert.equal(snapshot.daysToDue, -3);
  assert.equal(snapshot.countdownDays, 0);
  assert.equal(snapshot.gestationalWeeks, 40);
  assert.equal(snapshot.gestationalRemainderDays, 3);
});

test("stage boundaries use 14 and 28 completed weeks", () => {
  const at97 = getPregnancySnapshot(makeProfile({ weeks: 13, days: 6 }), TODAY);
  const at98 = getPregnancySnapshot(makeProfile({ weeks: 14, days: 0 }), TODAY);
  const at195 = getPregnancySnapshot(makeProfile({ weeks: 27, days: 6 }), TODAY);
  const at196 = getPregnancySnapshot(makeProfile({ weeks: 28, days: 0 }), TODAY);

  assert.equal(at97.stage.key, "first");
  assert.equal(at98.stage.key, "second");
  assert.equal(at195.stage.key, "second");
  assert.equal(at196.stage.key, "third");
  assert.equal(at196.nextMilestone.title, "下一站 · 37周");
});

test("a backwards device clock cannot reduce gestational age", () => {
  const profile = makeProfile();

  assert.equal(
    getPregnancySnapshot(profile, "2026-11-20").gestationalDays,
    177,
  );
});

test("profile creation and storage normalization reject malformed data", () => {
  const profile = makeProfile();
  assert.equal(STORAGE_KEY, "xiaoman.profile.v1");
  assert.deepEqual(normalizeStoredProfile(JSON.stringify(profile)), profile);

  assert.equal(normalizeStoredProfile("not json"), null);
  assert.equal(normalizeStoredProfile(null), null);
  assert.equal(
    normalizeStoredProfile({ ...profile, schemaVersion: 99 }),
    null,
  );
  assert.equal(
    normalizeStoredProfile({ ...profile, dueDate: "2027-03-06" }),
    null,
  );
  assert.equal(
    normalizeStoredProfile({ ...profile, anchorDate: "2026-02-31" }),
    null,
  );
  assert.equal(
    normalizeStoredProfile({
      ...profile,
      anchorGestationalDays: MAX_GESTATIONAL_DAYS + 1,
    }),
    null,
  );
});

test("gestational input validation is explicit", () => {
  assert.equal(toGestationalDays(25, 2), 177);
  assert.equal(toGestationalDays(0, 0), 0);
  assert.equal(toGestationalDays(42, 6), MAX_GESTATIONAL_DAYS);

  assert.throws(() => toGestationalDays(-1, 0), RangeError);
  assert.throws(() => toGestationalDays(43, 0), RangeError);
  assert.throws(() => toGestationalDays(25, 7), RangeError);
  assert.throws(() => toGestationalDays(25.5, 0), RangeError);
  assert.throws(() => toGestationalDays("25", 0), RangeError);
});

test("editing today's week re-anchors from today", () => {
  const edited = getPregnancySnapshot(makeProfile({ weeks: 26, days: 0 }), TODAY);
  const tomorrow = getPregnancySnapshot(
    makeProfile({ weeks: 26, days: 0 }),
    "2026-11-23",
  );

  assert.equal(edited.gestationalDays, 182);
  assert.equal(edited.gestationalWeeks, 26);
  assert.equal(tomorrow.gestationalWeeks, 26);
  assert.equal(tomorrow.gestationalRemainderDays, 1);
  assert.equal(tomorrow.countdownDays, DUE_DAYS - 1);
});
