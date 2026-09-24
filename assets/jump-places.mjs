/** City and county jumps. No parcel, campus, MW, or owner claims. */

export const JUMP_PLACES = [
  { id: "usa", name: "USA overview", detail: "National view.", center: [-98.5, 39.5], zoom: 3.8 },
  { id: "ashburn", name: "Ashburn and Loudoun County, VA", detail: "Largest data center cluster.", center: [-77.49, 39.04], zoom: 9.5 },
  { id: "abilene", name: "Abilene, TX", detail: "West Texas AI campus area.", center: [-99.73, 32.45], zoom: 9.5 },
  { id: "dallas", name: "Dallas and Fort Worth, TX", detail: "", center: [-97.04, 32.9], zoom: 9.5 },
  { id: "permian", name: "Permian Basin and SE New Mexico", detail: "Gas and power.", center: [-103.7, 32.4], zoom: 9 },
  { id: "ohio", name: "Central Ohio, New Albany", detail: "", center: [-82.81, 40.08], zoom: 9.5 },
  { id: "phoenix", name: "Phoenix, AZ", detail: "", center: [-112.07, 33.45], zoom: 9.5 },
  { id: "atlanta", name: "Atlanta, GA", detail: "", center: [-84.39, 33.75], zoom: 9.5 },
  { id: "memphis", name: "Memphis, TN", detail: "", center: [-90.05, 35.15], zoom: 9.5 },
  { id: "richland", name: "Richland Parish, LA", detail: "", center: [-91.76, 32.42], zoom: 9.5 },
  { id: "cameron", name: "Cameron County, TX", detail: "Sample well data.", center: [-97.66, 26.19], zoom: 10 },
];

export function jumpPlace(id) {
  return JUMP_PLACES.find((place) => place.id === id) || null;
}

/**
 * Replace whatever is in the pane with one jump list.
 * Safe to call on every open, tab switch, or tray rebuild.
 */
export function renderJumpList(pane) {
  const want = JUMP_PLACES.map((place) => place.id).join(",");
  const existing = pane.querySelector?.("#sl-jump-list");
  const have = existing
    ? [...existing.querySelectorAll("[data-jump]")].map((row) => row.dataset.jump).join(",")
    : "";
  if (existing && pane.childElementCount === 1 && have === want) return existing;
  const doc = pane.ownerDocument;
  const list = doc.createElement("div");
  list.id = "sl-jump-list";
  list.className = "sl-jump-list";
  list.setAttribute("role", "list");
  list.setAttribute("aria-label", "Jump");
  for (const place of JUMP_PLACES) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "sl-jump-place";
    btn.dataset.jump = place.id;
    btn.setAttribute("role", "listitem");
    const name = doc.createElement("span");
    name.className = "sl-jump-name";
    name.textContent = place.name;
    btn.append(name);
    if (place.detail) {
      const detail = doc.createElement("span");
      detail.className = "sl-jump-detail";
      detail.textContent = place.detail;
      btn.append(detail);
    }
    list.append(btn);
  }
  pane.replaceChildren(list);
  return list;
}
