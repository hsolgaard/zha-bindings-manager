// Device answers (zigbee-capabilities data/questions.json): how a device
// behaves in real use, answered by people who own one. The questions and the
// summary of everyone's answers (data/answers.json) live in the community
// database, so any tool can ask and show them. Pure logic only; the card
// shows them in the device side panel.

import { CAPABILITY_DB_REPO } from "./capexplorer-constants.js";
import { slugify } from "./capexplorer.js";

export const QUESTIONS_URL = `https://raw.githubusercontent.com/${CAPABILITY_DB_REPO}/main/data/questions.json`;
export const ANSWERS_URL = `https://raw.githubusercontent.com/${CAPABILITY_DB_REPO}/main/data/answers.json`;
export const ISSUE_FORM_URL = `https://github.com/${CAPABILITY_DB_REPO}/issues/new?template=device-answers.yml`;

const ids = (clusters, type) =>
  new Set((clusters || []).filter((c) => c && c.type === type).map((c) => Number(c.id)));

/**
 * Best guess at the device type from its ZHA clusters ({id, type: "in"|"out",
 * endpoint_id}) and power source. The person can change it before answering.
 */
export function detectDeviceType(clusters, powerSource = "") {
  const inn = ids(clusters, "in");
  const out = ids(clusters, "out");
  const battery = /battery/i.test(String(powerSource || ""));
  if (inn.has(0x0102)) return "cover";
  if (inn.has(0x0300) || (inn.has(0x0008) && inn.has(0x0006) && !out.has(0x0006))) return "light";
  const sends = [0x0006, 0x0008, 0x0005, 0x0102, 0x0300].some((id) => out.has(id));
  if (inn.has(0x0006) && sends) return "wall_switch";
  if (sends && !inn.has(0x0006)) return battery || !inn.size || inn.size < 6 ? "remote" : "wall_switch";
  if (inn.has(0x0006)) return "plug";
  if ([0x0500, 0x0406, 0x0402, 0x0405, 0x0400, 0x0403, 0x040d, 0x042a].some((id) => inn.has(id))) return "sensor";
  return "other";
}

/** The use answers for a device type. */
export function useAnswers(q, deviceType) {
  return ((q && q.use && q.use.answers_by_type) || {})[deviceType] || [];
}

/**
 * Questions to ask for a device type and use. update_changed only when the
 * person answered before on another firmware.
 */
export function questionsFor(q, deviceType, use, { firmwareChanged = false } = {}) {
  return ((q && q.questions) || []).filter(
    (x) =>
      (x.types || []).includes(deviceType) &&
      (!x.uses || !use || use === "other" || x.uses.includes(use)) &&
      (!x.after_firmware_change || firmwareChanged)
  );
}

/**
 * Orders questions for the form: those written for this use first (they
 * matter most for it), then the general ones, keeping questions.json's
 * order within each. Battery questions are left out for mains devices.
 * Returns { main, more }: the first `limit` to show, the rest behind
 * "More questions".
 */
export function formQuestions(q, deviceType, use, { firmwareChanged = false, battery = null, limit = 8 } = {}) {
  let list = questionsFor(q, deviceType, use, { firmwareChanged });
  if (battery === false) list = list.filter((x) => x.topic !== "battery");
  const specific = list.filter((x) => x.uses);
  const general = list.filter((x) => !x.uses);
  const ordered = [...specific, ...general];
  return { main: ordered.slice(0, limit), more: ordered.slice(limit) };
}

/** Same rules as the database's ingest (device-answers.cjs cleanText). */
export function cleanText(value, max = 280) {
  if (typeof value !== "string") return "";
  let s = value
    .replace(/\b[0-9a-f]{2}(?::[0-9a-f]{2}){7}\b/gi, "[address]")
    .replace(/\b0x[0-9a-f]{9,}\b/gi, "[address]")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[address]")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]")
    .replace(/\bhttps?:\/\/\S+/gi, "[link]")
    .replace(/\bwww\.\S+/gi, "[link]")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}

export function firmwareKey(fw) {
  if (!fw) return "unknown";
  return String(fw.sw_build_id || fw.registry_sw_version || "unknown");
}

/**
 * The submission record (kind device_answers). draft: {deviceType, use,
 * answers: {qid: aid|"other"}, other: {qid|use: text}, rating, tip, context}.
 * Only answers to questions that apply are kept; empty Other answers dropped.
 */
export function buildRecord(q, device, firmware, draft, cardVersion, nowIso = new Date().toISOString()) {
  const max = (q && q.free_text_max) || 280;
  const applicable = new Set(questionsFor(q, draft.deviceType, draft.use, { firmwareChanged: !!draft.firmwareChanged }).map((x) => x.id));
  const answers = {};
  const other = {};
  for (const [qid, aid] of Object.entries(draft.answers || {})) {
    if (!applicable.has(qid) || !aid) continue;
    if (aid === "other") {
      const t = cleanText((draft.other || {})[qid], max);
      if (!t) continue;
      other[qid] = t;
    }
    answers[qid] = aid;
  }
  if (draft.use === "other") {
    const t = cleanText((draft.other || {}).use, max);
    if (t) other.use = t;
  }
  const fw = {};
  if (firmware && firmware.sw_build_id) fw.sw_build_id = String(firmware.sw_build_id);
  if (firmware && firmware.registry_sw_version) fw.registry_sw_version = String(firmware.registry_sw_version);
  const record = {
    kind: "device_answers",
    schema: 1,
    questions_version: (q && q.version) || 1,
    manufacturer: device.manufacturer || "",
    model: device.model || "",
    firmware: fw,
    device_type: draft.deviceType,
    use: draft.use,
    answers,
  };
  if (Object.keys(other).length) record.other = other;
  if (Number.isInteger(draft.rating)) record.rating = draft.rating;
  const tip = cleanText(draft.tip, max);
  if (tip) record.tip = tip;
  const context = {};
  for (const [k, v] of Object.entries(draft.context || {})) if (v) context[k] = v;
  if (Object.keys(context).length) record.context = context;
  record.card_version = cardVersion;
  record.provenance = { submitted_at: nowIso };
  return record;
}

/** What's missing before it can be submitted ("" when ready). */
export function draftProblem(q, firmware, draft) {
  if (!firmware || (!firmware.sw_build_id && !firmware.registry_sw_version)) return "The firmware version isn't known yet.";
  if (!draft.deviceType) return "Choose what kind of device it is.";
  if (!draft.use) return "Choose what you use it for.";
  if (draft.use === "other" && !cleanText((draft.other || {}).use)) return 'Say what you use it for (you chose "Other").';
  const answered = Object.values(draft.answers || {}).filter(Boolean).length;
  if (!answered && !Number.isInteger(draft.rating)) return "Answer at least one question, or rate it.";
  return "";
}

/** GitHub "new issue" link with the record as a json block (like scans). */
export function issueUrl(record) {
  const title = `[Device Answers] ${record.manufacturer} ${record.model} (fw ${firmwareKey(record.firmware)})`;
  const body =
    "Shared from ZHA Bindings Manager's device panel. Answers are kept per firmware; free text is reviewed before it's shown.\n\n```json\n" +
    JSON.stringify(record, null, 2) +
    "\n```";
  return `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(
    body
  )}&labels=${encodeURIComponent("device-answers")}`;
}

export function deviceKey(device) {
  return `${slugify(device && device.manufacturer)}/${slugify(device && device.model)}`;
}

/** The firmware entry in answers.json for this device's firmware (matched
 *  on either version string), and the other firmwares answered. */
export function answersForFirmware(answersDoc, device, firmware) {
  const dev = answersDoc && answersDoc[deviceKey(device)];
  if (!dev) return { here: null, hereKey: null, others: [], total: 0 };
  const keys = Object.keys(dev.by_firmware || {});
  const want = [firmware && firmware.sw_build_id, firmware && firmware.registry_sw_version].filter(Boolean).map(String);
  const hereKey = keys.find((k) => want.includes(k)) || null;
  return {
    here: hereKey ? dev.by_firmware[hereKey] : null,
    hereKey,
    others: keys.filter((k) => k !== hereKey).map((k) => ({ firmware: k, total: dev.by_firmware[k].total || 0 })),
    total: dev.total || 0,
  };
}

/**
 * Display lines for one firmware's answers: per use, the rating and the
 * questions with the most common answer first. Labels come from
 * questions.json; unknown ids are shown as they are.
 */
export function summaryLines(q, fwEntry) {
  if (!fwEntry) return [];
  const labelOf = (list, id) => ((list || []).find((a) => a.id === id) || {}).label || id;
  const allUses = Object.values((q && q.use && q.use.answers_by_type) || {}).flat();
  return Object.entries(fwEntry.by_use || {})
    .sort((a, b) => b[1].count - a[1].count)
    .map(([use, u]) => {
      const ratingCount = Object.values(u.ratings || {}).reduce((a, b) => a + b, 0);
      const questions = ((q && q.questions) || [])
        .filter((x) => u.answers && u.answers[x.id])
        .map((x) => {
          const counts = Object.entries(u.answers[x.id]).sort((a, b) => b[1] - a[1]);
          const n = counts.reduce((a, [, c]) => a + c, 0);
          return {
            id: x.id,
            text: x.text,
            n,
            answers: counts.map(([aid, c]) => ({ label: aid === "other" ? (x.other_label || "Other").replace(/\s*\(tell us\)/i, "") : labelOf(x.answers, aid), count: c })),
          };
        });
      return {
        use,
        useLabel: use === "other" ? "Something else" : labelOf(allUses, use),
        count: u.count,
        rating: u.rating_average,
        ratingCount,
        ratings: u.ratings || {},
        questions,
        tips: (u.tips || []).slice(0, 5),
      };
    });
}

/** "2 of 3: Sometimes missed · 1: Always" */
export function answerCountsText(question) {
  return question.answers.map((a, i) => (i === 0 ? `${a.count} of ${question.n}: ${a.label}` : `${a.count}: ${a.label}`)).join(" · ");
}

// --- Fetching (cached for 6 hours, like the capability index) ------------------

const TTL = 6 * 60 * 60 * 1000;
const _memory = {};

async function fetchCached(url, cacheKey, { force = false, fallback = null } = {}) {
  if (!force && _memory[cacheKey]) return _memory[cacheKey];
  if (!force) {
    try {
      const raw = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (raw && raw.doc && typeof raw.at === "number" && Date.now() - raw.at < TTL) return (_memory[cacheKey] = raw.doc);
    } catch (e) {
      /* fetch below */
    }
  }
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404 && fallback) return (_memory[cacheKey] = fallback);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const doc = await res.json();
  _memory[cacheKey] = doc;
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), doc }));
  } catch (e) {
    /* storage full or blocked: memory only */
  }
  return doc;
}

/** data/questions.json (null if the database doesn't have it yet). */
export async function fetchQuestions(opts = {}) {
  const q = await fetchCached(QUESTIONS_URL, "zha-capability-explorer:questions", { ...opts, fallback: { none: true } });
  return q && q.none ? null : q;
}

/** data/answers.json ({} until anyone has answered). */
export async function fetchAnswersDoc(opts = {}) {
  return fetchCached(ANSWERS_URL, "zha-capability-explorer:answers", { ...opts, fallback: {} });
}
