/** ISO 3166-1 alpha-2 codes. Names come from Intl so they are never hand-typed. */
const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";

export const COUNTRY_CODES: string[] = CODES.split(" ");
const CODE_SET = new Set(COUNTRY_CODES);

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  return displayNames.of(code.toUpperCase()) ?? code.toUpperCase();
}

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && CODE_SET.has(value.toUpperCase());
}

export function normalizeCountry(value: unknown): string | null {
  return isCountryCode(value) ? value.toUpperCase() : null;
}

export const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));

/** Regional-indicator flag emoji; decorative only (always paired with the country name). */
export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export const REGION_GROUPS: Record<string, { name: string; members: string[] }> = {
  EU: {
    name: "European Union",
    members: "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "),
  },
  EEA: {
    name: "European Economic Area",
    members: "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO".split(" "),
  },
};

export function regionsOfCountry(code: string): string[] {
  const upper = code.toUpperCase();
  return Object.entries(REGION_GROUPS)
    .filter(([, group]) => group.members.includes(upper))
    .map(([key]) => key);
}
