// Regenerate comuni geodata + SQL seed for the italian_comuni reference table.
// Sources (join on ISTAT code):
//   - matteocontrini/comuni-json  → name, ISTAT codice, province, sigla, region
//   - MatteoHenryChinaski/Comuni-Italiani-2018 italy_geo.json → lat/lng by ISTAT
// Province names are normalized to the app's PROVINCE_OPTIONS canonical labels.
const fs = require("fs");
const path = require("path");

const comuni = require(process.argv[2] || "/tmp/comuni.json");
const geo = require(process.argv[3] || "/tmp/italy_geo.json");

// Must match normalizeLookupValue in apps/mobile/src/features/profiles/profile-form-utils.ts
function norm(v) {
  return String(v || "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// dataset province label -> app canonical (PROVINCE_OPTIONS) label
const PROVINCE_ALIAS = {
  "Bolzano/Bozen": "Bolzano",
  "Monza e della Brianza": "Monza e Brianza",
  "Reggio nell'Emilia": "Reggio Emilia",
  "Valle d'Aosta/Vallée d'Aoste": "Aosta",
};

const geoByIstat = new Map();
const geoByName = new Map();
for (const g of geo) {
  geoByIstat.set(parseInt(g.istat, 10), g);
  const k = norm(g.comune);
  if (!geoByName.has(k)) geoByName.set(k, g);
}

const out = [];
for (const c of comuni) {
  let g = geoByIstat.get(parseInt(c.codice, 10)) || geoByName.get(norm(c.nome));
  const province = PROVINCE_ALIAS[c.provincia.nome] || c.provincia.nome;
  out.push({
    name: c.nome,
    name_norm: norm(c.nome),
    province,
    province_code: c.sigla,
    region: c.regione.nome,
    lat: g ? Number(g.lat) : null,
    lng: g ? Number(g.lng) : null,
  });
}

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, "comuni-geo.json"), JSON.stringify(out));

// SQL seed VALUES rows
const esc = (s) => String(s).replace(/'/g, "''");
const rows = out.map((o) => {
  const lat = o.lat == null ? "null" : o.lat;
  const lng = o.lng == null ? "null" : o.lng;
  return `  ('${esc(o.name)}', '${esc(o.name_norm)}', '${esc(o.province)}', '${esc(o.province_code)}', '${esc(o.region)}', ${lat}, ${lng})`;
});
fs.writeFileSync(path.join(outDir, "seed-values.sql"), rows.join(",\n") + "\n");

console.log("comuni:", out.length, "| with coords:", out.filter((o) => o.lat != null).length);
console.log("distinct provinces:", new Set(out.map((o) => o.province)).size);
console.log("wrote comuni-geo.json and seed-values.sql to", outDir);
