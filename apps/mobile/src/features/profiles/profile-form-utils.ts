import italianCities from "./italian-cities.json";
import {
  isSeasonLabelValid as isPlayerSeasonLabelValid,
  normalizeSeasonLabelInput as normalizePlayerSeasonLabelInput,
} from "./player-sports";

export type SelectOption<T extends string = string> = {
  disabled?: boolean;
  label: string;
  value: T;
};

export type ItalianCityOption = {
  name: string;
  region: string;
};

export type CountryOption = {
  code: string;
  flag: string;
  name: string;
  phoneCountryCode: string;
};

export type PhoneCountryCodeOption = {
  countryCode: string;
  countryName: string;
  flag: string;
  value: string;
};

export const PROFILE_BIO_MIN_LENGTH = 20;
export const PROFILE_BIO_MAX_LENGTH = 400;
export const PROFILE_BIO_WARNING_THRESHOLD = 360;

export const REGION_OPTIONS: SelectOption[] = [
  { label: "Abruzzo", value: "Abruzzo" },
  { label: "Basilicata", value: "Basilicata" },
  { label: "Calabria", value: "Calabria" },
  { label: "Campania", value: "Campania" },
  { label: "Emilia-Romagna", value: "Emilia-Romagna" },
  { label: "Friuli-Venezia Giulia", value: "Friuli-Venezia Giulia" },
  { label: "Lazio", value: "Lazio" },
  { label: "Liguria", value: "Liguria" },
  { label: "Lombardia", value: "Lombardia" },
  { label: "Marche", value: "Marche" },
  { label: "Molise", value: "Molise" },
  { label: "Piemonte", value: "Piemonte" },
  { label: "Puglia", value: "Puglia" },
  { label: "Sardegna", value: "Sardegna" },
  { label: "Sicilia", value: "Sicilia" },
  { label: "Toscana", value: "Toscana" },
  { label: "Trentino-Alto Adige", value: "Trentino-Alto Adige" },
  { label: "Umbria", value: "Umbria" },
  { label: "Valle d'Aosta", value: "Valle d'Aosta" },
  { label: "Veneto", value: "Veneto" },
];

const SPECIAL_FLAG_EMOJI: Record<string, string> = {
  "GB-SCT": "🏴",
};

function countryCodeToFlagEmoji(countryCode: string) {
  if (SPECIAL_FLAG_EMOJI[countryCode]) {
    return SPECIAL_FLAG_EMOJI[countryCode];
  }

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return "🏳️";
  }

  return countryCode
    .split("")
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join("");
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "AF", flag: countryCodeToFlagEmoji("AF"), name: "Afghanistan", phoneCountryCode: "+93" },
  { code: "AL", flag: countryCodeToFlagEmoji("AL"), name: "Albania", phoneCountryCode: "+355" },
  { code: "DZ", flag: countryCodeToFlagEmoji("DZ"), name: "Algeria", phoneCountryCode: "+213" },
  { code: "AD", flag: countryCodeToFlagEmoji("AD"), name: "Andorra", phoneCountryCode: "+376" },
  { code: "AO", flag: countryCodeToFlagEmoji("AO"), name: "Angola", phoneCountryCode: "+244" },
  { code: "AG", flag: countryCodeToFlagEmoji("AG"), name: "Antigua e Barbuda", phoneCountryCode: "+1268" },
  { code: "SA", flag: countryCodeToFlagEmoji("SA"), name: "Arabia Saudita", phoneCountryCode: "+966" },
  { code: "AR", flag: countryCodeToFlagEmoji("AR"), name: "Argentina", phoneCountryCode: "+54" },
  { code: "AM", flag: countryCodeToFlagEmoji("AM"), name: "Armenia", phoneCountryCode: "+374" },
  { code: "AU", flag: countryCodeToFlagEmoji("AU"), name: "Australia", phoneCountryCode: "+61" },
  { code: "AT", flag: countryCodeToFlagEmoji("AT"), name: "Austria", phoneCountryCode: "+43" },
  { code: "AZ", flag: countryCodeToFlagEmoji("AZ"), name: "Azerbaigian", phoneCountryCode: "+994" },
  { code: "BS", flag: countryCodeToFlagEmoji("BS"), name: "Bahamas", phoneCountryCode: "+1242" },
  { code: "BH", flag: countryCodeToFlagEmoji("BH"), name: "Bahrein", phoneCountryCode: "+973" },
  { code: "BD", flag: countryCodeToFlagEmoji("BD"), name: "Bangladesh", phoneCountryCode: "+880" },
  { code: "BB", flag: countryCodeToFlagEmoji("BB"), name: "Barbados", phoneCountryCode: "+1246" },
  { code: "BE", flag: countryCodeToFlagEmoji("BE"), name: "Belgio", phoneCountryCode: "+32" },
  { code: "BZ", flag: countryCodeToFlagEmoji("BZ"), name: "Belize", phoneCountryCode: "+501" },
  { code: "BJ", flag: countryCodeToFlagEmoji("BJ"), name: "Benin", phoneCountryCode: "+229" },
  { code: "BT", flag: countryCodeToFlagEmoji("BT"), name: "Bhutan", phoneCountryCode: "+975" },
  { code: "BY", flag: countryCodeToFlagEmoji("BY"), name: "Bielorussia", phoneCountryCode: "+375" },
  { code: "MM", flag: countryCodeToFlagEmoji("MM"), name: "Birmania (Myanmar)", phoneCountryCode: "+95" },
  { code: "BO", flag: countryCodeToFlagEmoji("BO"), name: "Bolivia", phoneCountryCode: "+591" },
  { code: "BA", flag: countryCodeToFlagEmoji("BA"), name: "Bosnia ed Erzegovina", phoneCountryCode: "+387" },
  { code: "BW", flag: countryCodeToFlagEmoji("BW"), name: "Botswana", phoneCountryCode: "+267" },
  { code: "BR", flag: countryCodeToFlagEmoji("BR"), name: "Brasile", phoneCountryCode: "+55" },
  { code: "BN", flag: countryCodeToFlagEmoji("BN"), name: "Brunei", phoneCountryCode: "+673" },
  { code: "BG", flag: countryCodeToFlagEmoji("BG"), name: "Bulgaria", phoneCountryCode: "+359" },
  { code: "BF", flag: countryCodeToFlagEmoji("BF"), name: "Burkina Faso", phoneCountryCode: "+226" },
  { code: "BI", flag: countryCodeToFlagEmoji("BI"), name: "Burundi", phoneCountryCode: "+257" },
  { code: "KH", flag: countryCodeToFlagEmoji("KH"), name: "Cambogia", phoneCountryCode: "+855" },
  { code: "CM", flag: countryCodeToFlagEmoji("CM"), name: "Camerun", phoneCountryCode: "+237" },
  { code: "CA", flag: countryCodeToFlagEmoji("CA"), name: "Canada", phoneCountryCode: "+1" },
  { code: "CV", flag: countryCodeToFlagEmoji("CV"), name: "Capo Verde", phoneCountryCode: "+238" },
  { code: "TD", flag: countryCodeToFlagEmoji("TD"), name: "Ciad", phoneCountryCode: "+235" },
  { code: "CL", flag: countryCodeToFlagEmoji("CL"), name: "Cile", phoneCountryCode: "+56" },
  { code: "CN", flag: countryCodeToFlagEmoji("CN"), name: "Cina", phoneCountryCode: "+86" },
  { code: "CY", flag: countryCodeToFlagEmoji("CY"), name: "Cipro", phoneCountryCode: "+357" },
  { code: "VA", flag: countryCodeToFlagEmoji("VA"), name: "Città del Vaticano", phoneCountryCode: "+379" },
  { code: "CO", flag: countryCodeToFlagEmoji("CO"), name: "Colombia", phoneCountryCode: "+57" },
  { code: "KM", flag: countryCodeToFlagEmoji("KM"), name: "Comore", phoneCountryCode: "+269" },
  { code: "CG", flag: countryCodeToFlagEmoji("CG"), name: "Congo", phoneCountryCode: "+242" },
  { code: "CD", flag: countryCodeToFlagEmoji("CD"), name: "Congo (Rep. Dem.)", phoneCountryCode: "+243" },
  { code: "KP", flag: countryCodeToFlagEmoji("KP"), name: "Corea del Nord", phoneCountryCode: "+850" },
  { code: "KR", flag: countryCodeToFlagEmoji("KR"), name: "Corea del Sud", phoneCountryCode: "+82" },
  { code: "CI", flag: countryCodeToFlagEmoji("CI"), name: "Costa d'Avorio", phoneCountryCode: "+225" },
  { code: "CR", flag: countryCodeToFlagEmoji("CR"), name: "Costa Rica", phoneCountryCode: "+506" },
  { code: "HR", flag: countryCodeToFlagEmoji("HR"), name: "Croazia", phoneCountryCode: "+385" },
  { code: "CU", flag: countryCodeToFlagEmoji("CU"), name: "Cuba", phoneCountryCode: "+53" },
  { code: "DK", flag: countryCodeToFlagEmoji("DK"), name: "Danimarca", phoneCountryCode: "+45" },
  { code: "DM", flag: countryCodeToFlagEmoji("DM"), name: "Dominica", phoneCountryCode: "+1767" },
  { code: "EC", flag: countryCodeToFlagEmoji("EC"), name: "Ecuador", phoneCountryCode: "+593" },
  { code: "EG", flag: countryCodeToFlagEmoji("EG"), name: "Egitto", phoneCountryCode: "+20" },
  { code: "SV", flag: countryCodeToFlagEmoji("SV"), name: "El Salvador", phoneCountryCode: "+503" },
  { code: "AE", flag: countryCodeToFlagEmoji("AE"), name: "Emirati Arabi Uniti", phoneCountryCode: "+971" },
  { code: "ER", flag: countryCodeToFlagEmoji("ER"), name: "Eritrea", phoneCountryCode: "+291" },
  { code: "EE", flag: countryCodeToFlagEmoji("EE"), name: "Estonia", phoneCountryCode: "+372" },
  { code: "SZ", flag: countryCodeToFlagEmoji("SZ"), name: "Eswatini", phoneCountryCode: "+268" },
  { code: "ET", flag: countryCodeToFlagEmoji("ET"), name: "Etiopia", phoneCountryCode: "+251" },
  { code: "FJ", flag: countryCodeToFlagEmoji("FJ"), name: "Figi", phoneCountryCode: "+679" },
  { code: "PH", flag: countryCodeToFlagEmoji("PH"), name: "Filippine", phoneCountryCode: "+63" },
  { code: "FI", flag: countryCodeToFlagEmoji("FI"), name: "Finlandia", phoneCountryCode: "+358" },
  { code: "FR", flag: countryCodeToFlagEmoji("FR"), name: "Francia", phoneCountryCode: "+33" },
  { code: "GA", flag: countryCodeToFlagEmoji("GA"), name: "Gabon", phoneCountryCode: "+241" },
  { code: "GM", flag: countryCodeToFlagEmoji("GM"), name: "Gambia", phoneCountryCode: "+220" },
  { code: "GE", flag: countryCodeToFlagEmoji("GE"), name: "Georgia", phoneCountryCode: "+995" },
  { code: "DE", flag: countryCodeToFlagEmoji("DE"), name: "Germania", phoneCountryCode: "+49" },
  { code: "GH", flag: countryCodeToFlagEmoji("GH"), name: "Ghana", phoneCountryCode: "+233" },
  { code: "JM", flag: countryCodeToFlagEmoji("JM"), name: "Giamaica", phoneCountryCode: "+1876" },
  { code: "JP", flag: countryCodeToFlagEmoji("JP"), name: "Giappone", phoneCountryCode: "+81" },
  { code: "DJ", flag: countryCodeToFlagEmoji("DJ"), name: "Gibuti", phoneCountryCode: "+253" },
  { code: "JO", flag: countryCodeToFlagEmoji("JO"), name: "Giordania", phoneCountryCode: "+962" },
  { code: "GR", flag: countryCodeToFlagEmoji("GR"), name: "Grecia", phoneCountryCode: "+30" },
  { code: "GD", flag: countryCodeToFlagEmoji("GD"), name: "Grenada", phoneCountryCode: "+1473" },
  { code: "GT", flag: countryCodeToFlagEmoji("GT"), name: "Guatemala", phoneCountryCode: "+502" },
  { code: "GN", flag: countryCodeToFlagEmoji("GN"), name: "Guinea", phoneCountryCode: "+224" },
  { code: "GQ", flag: countryCodeToFlagEmoji("GQ"), name: "Guinea Equatoriale", phoneCountryCode: "+240" },
  { code: "GW", flag: countryCodeToFlagEmoji("GW"), name: "Guinea-Bissau", phoneCountryCode: "+245" },
  { code: "GY", flag: countryCodeToFlagEmoji("GY"), name: "Guyana", phoneCountryCode: "+592" },
  { code: "HT", flag: countryCodeToFlagEmoji("HT"), name: "Haiti", phoneCountryCode: "+509" },
  { code: "HN", flag: countryCodeToFlagEmoji("HN"), name: "Honduras", phoneCountryCode: "+504" },
  { code: "IN", flag: countryCodeToFlagEmoji("IN"), name: "India", phoneCountryCode: "+91" },
  { code: "ID", flag: countryCodeToFlagEmoji("ID"), name: "Indonesia", phoneCountryCode: "+62" },
  { code: "GB", flag: countryCodeToFlagEmoji("GB"), name: "Inghilterra", phoneCountryCode: "+44" },
  { code: "IR", flag: countryCodeToFlagEmoji("IR"), name: "Iran", phoneCountryCode: "+98" },
  { code: "IQ", flag: countryCodeToFlagEmoji("IQ"), name: "Iraq", phoneCountryCode: "+964" },
  { code: "IE", flag: countryCodeToFlagEmoji("IE"), name: "Irlanda", phoneCountryCode: "+353" },
  { code: "IS", flag: countryCodeToFlagEmoji("IS"), name: "Islanda", phoneCountryCode: "+354" },
  { code: "MH", flag: countryCodeToFlagEmoji("MH"), name: "Isole Marshall", phoneCountryCode: "+692" },
  { code: "SB", flag: countryCodeToFlagEmoji("SB"), name: "Isole Salomone", phoneCountryCode: "+677" },
  { code: "IL", flag: countryCodeToFlagEmoji("IL"), name: "Israele", phoneCountryCode: "+972" },
  { code: "IT", flag: countryCodeToFlagEmoji("IT"), name: "Italia", phoneCountryCode: "+39" },
  { code: "KZ", flag: countryCodeToFlagEmoji("KZ"), name: "Kazakistan", phoneCountryCode: "+7" },
  { code: "KE", flag: countryCodeToFlagEmoji("KE"), name: "Kenya", phoneCountryCode: "+254" },
  { code: "KG", flag: countryCodeToFlagEmoji("KG"), name: "Kirghizistan", phoneCountryCode: "+996" },
  { code: "KI", flag: countryCodeToFlagEmoji("KI"), name: "Kiribati", phoneCountryCode: "+686" },
  { code: "XK", flag: countryCodeToFlagEmoji("XK"), name: "Kosovo", phoneCountryCode: "+383" },
  { code: "KW", flag: countryCodeToFlagEmoji("KW"), name: "Kuwait", phoneCountryCode: "+965" },
  { code: "LA", flag: countryCodeToFlagEmoji("LA"), name: "Laos", phoneCountryCode: "+856" },
  { code: "LS", flag: countryCodeToFlagEmoji("LS"), name: "Lesotho", phoneCountryCode: "+266" },
  { code: "LV", flag: countryCodeToFlagEmoji("LV"), name: "Lettonia", phoneCountryCode: "+371" },
  { code: "LB", flag: countryCodeToFlagEmoji("LB"), name: "Libano", phoneCountryCode: "+961" },
  { code: "LR", flag: countryCodeToFlagEmoji("LR"), name: "Liberia", phoneCountryCode: "+231" },
  { code: "LY", flag: countryCodeToFlagEmoji("LY"), name: "Libia", phoneCountryCode: "+218" },
  { code: "LI", flag: countryCodeToFlagEmoji("LI"), name: "Liechtenstein", phoneCountryCode: "+423" },
  { code: "LT", flag: countryCodeToFlagEmoji("LT"), name: "Lituania", phoneCountryCode: "+370" },
  { code: "LU", flag: countryCodeToFlagEmoji("LU"), name: "Lussemburgo", phoneCountryCode: "+352" },
  { code: "MK", flag: countryCodeToFlagEmoji("MK"), name: "Macedonia del Nord", phoneCountryCode: "+389" },
  { code: "MG", flag: countryCodeToFlagEmoji("MG"), name: "Madagascar", phoneCountryCode: "+261" },
  { code: "MW", flag: countryCodeToFlagEmoji("MW"), name: "Malawi", phoneCountryCode: "+265" },
  { code: "MY", flag: countryCodeToFlagEmoji("MY"), name: "Malesia", phoneCountryCode: "+60" },
  { code: "MV", flag: countryCodeToFlagEmoji("MV"), name: "Maldive", phoneCountryCode: "+960" },
  { code: "ML", flag: countryCodeToFlagEmoji("ML"), name: "Mali", phoneCountryCode: "+223" },
  { code: "MT", flag: countryCodeToFlagEmoji("MT"), name: "Malta", phoneCountryCode: "+356" },
  { code: "MA", flag: countryCodeToFlagEmoji("MA"), name: "Marocco", phoneCountryCode: "+212" },
  { code: "MR", flag: countryCodeToFlagEmoji("MR"), name: "Mauritania", phoneCountryCode: "+222" },
  { code: "MU", flag: countryCodeToFlagEmoji("MU"), name: "Mauritius", phoneCountryCode: "+230" },
  { code: "MX", flag: countryCodeToFlagEmoji("MX"), name: "Messico", phoneCountryCode: "+52" },
  { code: "FM", flag: countryCodeToFlagEmoji("FM"), name: "Micronesia", phoneCountryCode: "+691" },
  { code: "MD", flag: countryCodeToFlagEmoji("MD"), name: "Moldavia", phoneCountryCode: "+373" },
  { code: "MC", flag: countryCodeToFlagEmoji("MC"), name: "Monaco", phoneCountryCode: "+377" },
  { code: "MN", flag: countryCodeToFlagEmoji("MN"), name: "Mongolia", phoneCountryCode: "+976" },
  { code: "ME", flag: countryCodeToFlagEmoji("ME"), name: "Montenegro", phoneCountryCode: "+382" },
  { code: "MZ", flag: countryCodeToFlagEmoji("MZ"), name: "Mozambico", phoneCountryCode: "+258" },
  { code: "NA", flag: countryCodeToFlagEmoji("NA"), name: "Namibia", phoneCountryCode: "+264" },
  { code: "NR", flag: countryCodeToFlagEmoji("NR"), name: "Nauru", phoneCountryCode: "+674" },
  { code: "NP", flag: countryCodeToFlagEmoji("NP"), name: "Nepal", phoneCountryCode: "+977" },
  { code: "NI", flag: countryCodeToFlagEmoji("NI"), name: "Nicaragua", phoneCountryCode: "+505" },
  { code: "NE", flag: countryCodeToFlagEmoji("NE"), name: "Niger", phoneCountryCode: "+227" },
  { code: "NG", flag: countryCodeToFlagEmoji("NG"), name: "Nigeria", phoneCountryCode: "+234" },
  { code: "NO", flag: countryCodeToFlagEmoji("NO"), name: "Norvegia", phoneCountryCode: "+47" },
  { code: "NZ", flag: countryCodeToFlagEmoji("NZ"), name: "Nuova Zelanda", phoneCountryCode: "+64" },
  { code: "OM", flag: countryCodeToFlagEmoji("OM"), name: "Oman", phoneCountryCode: "+968" },
  { code: "NL", flag: countryCodeToFlagEmoji("NL"), name: "Paesi Bassi", phoneCountryCode: "+31" },
  { code: "PK", flag: countryCodeToFlagEmoji("PK"), name: "Pakistan", phoneCountryCode: "+92" },
  { code: "PW", flag: countryCodeToFlagEmoji("PW"), name: "Palau", phoneCountryCode: "+680" },
  { code: "PS", flag: countryCodeToFlagEmoji("PS"), name: "Palestina", phoneCountryCode: "+970" },
  { code: "PA", flag: countryCodeToFlagEmoji("PA"), name: "Panama", phoneCountryCode: "+507" },
  { code: "PG", flag: countryCodeToFlagEmoji("PG"), name: "Papua Nuova Guinea", phoneCountryCode: "+675" },
  { code: "PY", flag: countryCodeToFlagEmoji("PY"), name: "Paraguay", phoneCountryCode: "+595" },
  { code: "PE", flag: countryCodeToFlagEmoji("PE"), name: "Perù", phoneCountryCode: "+51" },
  { code: "PL", flag: countryCodeToFlagEmoji("PL"), name: "Polonia", phoneCountryCode: "+48" },
  { code: "PT", flag: countryCodeToFlagEmoji("PT"), name: "Portogallo", phoneCountryCode: "+351" },
  { code: "QA", flag: countryCodeToFlagEmoji("QA"), name: "Qatar", phoneCountryCode: "+974" },
  { code: "GB-ENG", flag: countryCodeToFlagEmoji("GB"), name: "Regno Unito", phoneCountryCode: "+44" },
  { code: "CF", flag: countryCodeToFlagEmoji("CF"), name: "Repubblica Centrafricana", phoneCountryCode: "+236" },
  { code: "CZ", flag: countryCodeToFlagEmoji("CZ"), name: "Repubblica Ceca", phoneCountryCode: "+420" },
  { code: "DO", flag: countryCodeToFlagEmoji("DO"), name: "Repubblica Dominicana", phoneCountryCode: "+1809" },
  { code: "RO", flag: countryCodeToFlagEmoji("RO"), name: "Romania", phoneCountryCode: "+40" },
  { code: "RW", flag: countryCodeToFlagEmoji("RW"), name: "Ruanda", phoneCountryCode: "+250" },
  { code: "RU", flag: countryCodeToFlagEmoji("RU"), name: "Russia", phoneCountryCode: "+7" },
  { code: "KN", flag: countryCodeToFlagEmoji("KN"), name: "Saint Kitts e Nevis", phoneCountryCode: "+1869" },
  { code: "VC", flag: countryCodeToFlagEmoji("VC"), name: "Saint Vincent e Grenadine", phoneCountryCode: "+1784" },
  { code: "LC", flag: countryCodeToFlagEmoji("LC"), name: "Santa Lucia", phoneCountryCode: "+1758" },
  { code: "WS", flag: countryCodeToFlagEmoji("WS"), name: "Samoa", phoneCountryCode: "+685" },
  { code: "SM", flag: countryCodeToFlagEmoji("SM"), name: "San Marino", phoneCountryCode: "+378" },
  { code: "ST", flag: countryCodeToFlagEmoji("ST"), name: "São Tomé e Príncipe", phoneCountryCode: "+239" },
  { code: "GB-SCT", flag: countryCodeToFlagEmoji("GB-SCT"), name: "Scozia", phoneCountryCode: "+44" },
  { code: "SN", flag: countryCodeToFlagEmoji("SN"), name: "Senegal", phoneCountryCode: "+221" },
  { code: "RS", flag: countryCodeToFlagEmoji("RS"), name: "Serbia", phoneCountryCode: "+381" },
  { code: "SC", flag: countryCodeToFlagEmoji("SC"), name: "Seychelles", phoneCountryCode: "+248" },
  { code: "SL", flag: countryCodeToFlagEmoji("SL"), name: "Sierra Leone", phoneCountryCode: "+232" },
  { code: "SG", flag: countryCodeToFlagEmoji("SG"), name: "Singapore", phoneCountryCode: "+65" },
  { code: "SY", flag: countryCodeToFlagEmoji("SY"), name: "Siria", phoneCountryCode: "+963" },
  { code: "SK", flag: countryCodeToFlagEmoji("SK"), name: "Slovacchia", phoneCountryCode: "+421" },
  { code: "SI", flag: countryCodeToFlagEmoji("SI"), name: "Slovenia", phoneCountryCode: "+386" },
  { code: "SO", flag: countryCodeToFlagEmoji("SO"), name: "Somalia", phoneCountryCode: "+252" },
  { code: "ES", flag: countryCodeToFlagEmoji("ES"), name: "Spagna", phoneCountryCode: "+34" },
  { code: "LK", flag: countryCodeToFlagEmoji("LK"), name: "Sri Lanka", phoneCountryCode: "+94" },
  { code: "US", flag: countryCodeToFlagEmoji("US"), name: "Stati Uniti", phoneCountryCode: "+1" },
  { code: "ZA", flag: countryCodeToFlagEmoji("ZA"), name: "Sudafrica", phoneCountryCode: "+27" },
  { code: "SD", flag: countryCodeToFlagEmoji("SD"), name: "Sudan", phoneCountryCode: "+249" },
  { code: "SS", flag: countryCodeToFlagEmoji("SS"), name: "Sudan del Sud", phoneCountryCode: "+211" },
  { code: "SR", flag: countryCodeToFlagEmoji("SR"), name: "Suriname", phoneCountryCode: "+597" },
  { code: "SE", flag: countryCodeToFlagEmoji("SE"), name: "Svezia", phoneCountryCode: "+46" },
  { code: "CH", flag: countryCodeToFlagEmoji("CH"), name: "Svizzera", phoneCountryCode: "+41" },
  { code: "TJ", flag: countryCodeToFlagEmoji("TJ"), name: "Tagikistan", phoneCountryCode: "+992" },
  { code: "TW", flag: countryCodeToFlagEmoji("TW"), name: "Taiwan", phoneCountryCode: "+886" },
  { code: "TZ", flag: countryCodeToFlagEmoji("TZ"), name: "Tanzania", phoneCountryCode: "+255" },
  { code: "TH", flag: countryCodeToFlagEmoji("TH"), name: "Thailandia", phoneCountryCode: "+66" },
  { code: "TL", flag: countryCodeToFlagEmoji("TL"), name: "Timor Est", phoneCountryCode: "+670" },
  { code: "TG", flag: countryCodeToFlagEmoji("TG"), name: "Togo", phoneCountryCode: "+228" },
  { code: "TO", flag: countryCodeToFlagEmoji("TO"), name: "Tonga", phoneCountryCode: "+676" },
  { code: "TT", flag: countryCodeToFlagEmoji("TT"), name: "Trinidad e Tobago", phoneCountryCode: "+1868" },
  { code: "TN", flag: countryCodeToFlagEmoji("TN"), name: "Tunisia", phoneCountryCode: "+216" },
  { code: "TR", flag: countryCodeToFlagEmoji("TR"), name: "Turchia", phoneCountryCode: "+90" },
  { code: "TM", flag: countryCodeToFlagEmoji("TM"), name: "Turkmenistan", phoneCountryCode: "+993" },
  { code: "TV", flag: countryCodeToFlagEmoji("TV"), name: "Tuvalu", phoneCountryCode: "+688" },
  { code: "UA", flag: countryCodeToFlagEmoji("UA"), name: "Ucraina", phoneCountryCode: "+380" },
  { code: "UG", flag: countryCodeToFlagEmoji("UG"), name: "Uganda", phoneCountryCode: "+256" },
  { code: "HU", flag: countryCodeToFlagEmoji("HU"), name: "Ungheria", phoneCountryCode: "+36" },
  { code: "UY", flag: countryCodeToFlagEmoji("UY"), name: "Uruguay", phoneCountryCode: "+598" },
  { code: "UZ", flag: countryCodeToFlagEmoji("UZ"), name: "Uzbekistan", phoneCountryCode: "+998" },
  { code: "VU", flag: countryCodeToFlagEmoji("VU"), name: "Vanuatu", phoneCountryCode: "+678" },
  { code: "VE", flag: countryCodeToFlagEmoji("VE"), name: "Venezuela", phoneCountryCode: "+58" },
  { code: "VN", flag: countryCodeToFlagEmoji("VN"), name: "Vietnam", phoneCountryCode: "+84" },
  { code: "YE", flag: countryCodeToFlagEmoji("YE"), name: "Yemen", phoneCountryCode: "+967" },
  { code: "ZM", flag: countryCodeToFlagEmoji("ZM"), name: "Zambia", phoneCountryCode: "+260" },
  { code: "ZW", flag: countryCodeToFlagEmoji("ZW"), name: "Zimbabwe", phoneCountryCode: "+263" },
];

export const NATIONALITY_OPTIONS: SelectOption[] = COUNTRY_OPTIONS.map((country) => ({
  label: country.name,
  value: country.code,
}));

export const LANGUAGE_OPTIONS: SelectOption[] = [
  { label: "Italiano", value: "it" },
  { label: "Inglese", value: "en" },
  { label: "Spagnolo", value: "es" },
  { label: "Francese", value: "fr" },
  { label: "Tedesco", value: "de" },
  { label: "Portoghese", value: "pt" },
  { label: "Olandese", value: "nl" },
  { label: "Russo", value: "ru" },
  { label: "Arabo", value: "ar" },
  { label: "Cinese", value: "zh" },
  { label: "Giapponese", value: "ja" },
  { label: "Coreano", value: "ko" },
  { label: "Turco", value: "tr" },
  { label: "Polacco", value: "pl" },
  { label: "Rumeno", value: "ro" },
  { label: "Greco", value: "el" },
  { label: "Ceco", value: "cs" },
  { label: "Ungherese", value: "hu" },
  { label: "Svedese", value: "sv" },
  { label: "Norvegese", value: "nb" },
  { label: "Danese", value: "da" },
  { label: "Finlandese", value: "fi" },
  { label: "Croato", value: "hr" },
  { label: "Serbo", value: "sr" },
  { label: "Bulgaro", value: "bg" },
  { label: "Slovacco", value: "sk" },
  { label: "Sloveno", value: "sl" },
  { label: "Albanese", value: "sq" },
  { label: "Bosniaco", value: "bs" },
  { label: "Macedone", value: "mk" },
  { label: "Ucraino", value: "ua" },
  { label: "Georgiano", value: "ka" },
  { label: "Ebraico", value: "he" },
  { label: "Hindi", value: "hi" },
  { label: "Bengali", value: "bn" },
  { label: "Urdu", value: "ur" },
  { label: "Persiano", value: "fa" },
  { label: "Thai", value: "th" },
  { label: "Vietnamita", value: "vi" },
  { label: "Indonesiano", value: "id" },
  { label: "Malese", value: "ms" },
  { label: "Swahili", value: "sw" },
  { label: "Amarico", value: "am" },
  { label: "Catalano", value: "ca" },
  { label: "Basco", value: "eu" },
  { label: "Gallese", value: "cy" },
  { label: "Irlandese", value: "ga" },
  { label: "Islandese", value: "is" },
  { label: "Lituano", value: "lt" },
  { label: "Lettone", value: "lv" },
  { label: "Estone", value: "et" },
  { label: "Maltese", value: "mt" },
  { label: "Lussemburghese", value: "lb" },
  { label: "Afrikaans", value: "af" },
];

export const PHONE_COUNTRY_CODE_OPTIONS: PhoneCountryCodeOption[] = COUNTRY_OPTIONS.map(
  (country) => ({
    countryCode: country.code,
    countryName: country.name,
    flag: country.flag,
    value: country.phoneCountryCode,
  }),
);

export const BIRTH_MONTH_OPTIONS: SelectOption[] = [
  { label: "Gennaio", value: "01" },
  { label: "Febbraio", value: "02" },
  { label: "Marzo", value: "03" },
  { label: "Aprile", value: "04" },
  { label: "Maggio", value: "05" },
  { label: "Giugno", value: "06" },
  { label: "Luglio", value: "07" },
  { label: "Agosto", value: "08" },
  { label: "Settembre", value: "09" },
  { label: "Ottobre", value: "10" },
  { label: "Novembre", value: "11" },
  { label: "Dicembre", value: "12" },
];

// The current mobile MVP targets adult and senior amateur football profiles, so
// we cap the picker to a conservative historical range without introducing UX noise.
export const FIRST_BIRTH_YEAR = 1940;
const italianCityOptions = italianCities as ItalianCityOption[];
const normalizedItalianCityOptions = italianCityOptions.map((entry) => ({
  ...entry,
  normalizedName: normalizeLookupValue(entry.name),
}));
const normalizedCountryOptions = COUNTRY_OPTIONS.map((entry) => ({
  ...entry,
  normalizedCode: normalizeLookupValue(entry.code),
  normalizedName: normalizeLookupValue(entry.name),
  normalizedPhoneCountryCode: entry.phoneCountryCode.replace(/\D/g, ""),
}));

export function ensureOption<T extends string>(
  options: SelectOption<T>[],
  value: T | "" | null | undefined,
) {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [{ label: value, value }, ...options];
}

export function getOptionLabel<T extends string>(
  options: SelectOption<T>[],
  value: T | "" | null | undefined,
  fallback = "Da completare",
) {
  if (!value) {
    return fallback;
  }

  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatOptionalSummary(
  value: string | null | undefined,
  fallback = "Da completare",
) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function normalizeProfileBioInput(value: string) {
  return value.replace(/\r\n?/g, "\n").slice(0, PROFILE_BIO_MAX_LENGTH);
}

function hasRepeatedBioPattern(value: string) {
  const compactValue = value.toLowerCase().replace(/\s+/g, " ").trim();

  if (!compactValue) {
    return false;
  }

  // Se l'utente ripete lo stesso carattere 6+ volte di fila, trattiamo il testo
  // come riempitivo/spam e lo blocchiamo prima del salvataggio.
  if (/([a-zà-ù0-9!?.,])\1{5,}/i.test(compactValue)) {
    return true;
  }

  const compactNoSpaces = compactValue.replace(/\s+/g, "");

  // Blocca pattern ultra-ripetitivi come "abababababab" o "123412341234":
  // almeno 12 caratteri composti dalla stessa sequenza da 1 a 4 caratteri.
  if (compactNoSpaces.length >= 12 && /^(.{1,4})\1+$/.test(compactNoSpaces)) {
    return true;
  }

  const words = compactValue.split(" ").filter(Boolean);

  return words.length >= 4 && new Set(words).size === 1;
}

export function validateProfileBio(value: string) {
  const normalizedValue = normalizeProfileBioInput(value);
  const trimmedValue = normalizedValue.trim();

  if (!normalizedValue.length) {
    return {
      isValid: true,
      message: null,
      normalizedValue,
    };
  }

  if (!trimmedValue) {
    return {
      isValid: false,
      message: "Inserisci una descrizione valida del tuo profilo.",
      normalizedValue,
    };
  }

  if (trimmedValue.length < PROFILE_BIO_MIN_LENGTH) {
    return {
      isValid: false,
      message: `La bio deve contenere almeno ${PROFILE_BIO_MIN_LENGTH} caratteri.`,
      normalizedValue,
    };
  }

  if (trimmedValue.length > PROFILE_BIO_MAX_LENGTH) {
    return {
      isValid: false,
      message: `La bio non può superare ${PROFILE_BIO_MAX_LENGTH} caratteri.`,
      normalizedValue,
    };
  }

  if (hasRepeatedBioPattern(trimmedValue)) {
    return {
      isValid: false,
      message: "Inserisci una descrizione valida del tuo profilo.",
      normalizedValue,
    };
  }

  return {
    isValid: true,
    message: null,
    normalizedValue,
  };
}

export function formatListSummary(
  values: string[] | null | undefined,
  fallback = "Da completare",
) {
  const normalized = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join(", ") : fallback;
}

export function formatBirthDate(value: string | null | undefined) {
  const parts = getBirthDateParts(value);

  if (!parts.day || !parts.month || !parts.year) {
    return "Da completare";
  }

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatBirthDateInputValue(value: string | null | undefined) {
  const formattedValue = formatBirthDate(value);
  return formattedValue === "Da completare" ? "" : formattedValue;
}

export function getBirthDateParts(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return {
    day: match?.[3] ?? "",
    month: match?.[2] ?? "",
    year: match?.[1] ?? "",
  };
}

export function createBirthYearOptions(currentYear = new Date().getFullYear()) {
  return Array.from({ length: currentYear - FIRST_BIRTH_YEAR + 1 }, (_, index) => {
    const year = String(currentYear - index);
    return { label: year, value: year };
  });
}

export function createBirthDayOptions(year: string, month: string) {
  const daysInMonth =
    year && month
      ? new Date(Number(year), Number(month), 0).getDate()
      : 31;

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return { label: day, value: day };
  });
}

export function composeBirthDate(parts: {
  day: string;
  month: string;
  year: string;
}) {
  if (!parts.year || !parts.month || !parts.day) {
    return "";
  }

  const candidate = `${parts.year}-${parts.month}-${parts.day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
}

export function parseBirthDate(value: string | null | undefined) {
  const parts = getBirthDateParts(value);

  if (!parts.year || !parts.month || !parts.day) {
    return null;
  }

  const candidate = new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate;
}

export function formatBirthDateValue(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeBirthDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseBirthDateInput(
  value: string | null | undefined,
  currentDate = new Date(),
) {
  const normalizedValue = normalizeBirthDateInput(value ?? "");
  const match = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);

  if (
    numericYear < FIRST_BIRTH_YEAR ||
    numericYear > currentDate.getFullYear() ||
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1
  ) {
    return null;
  }

  const candidate = new Date(numericYear, numericMonth - 1, numericDay);

  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== numericYear ||
    candidate.getMonth() !== numericMonth - 1 ||
    candidate.getDate() !== numericDay
  ) {
    return null;
  }

  if (candidate > currentDate) {
    return null;
  }

  return {
    date: candidate,
    isoValue: formatBirthDateValue(candidate),
    normalizedValue,
  };
}

export function validateBirthDateInput(
  value: string | null | undefined,
  currentDate = new Date(),
) {
  const normalizedValue = normalizeBirthDateInput(value ?? "");

  if (!normalizedValue) {
    return {
      isValid: true,
      isoValue: null,
      message: null,
    };
  }

  const parsedValue = parseBirthDateInput(normalizedValue, currentDate);

  if (!parsedValue) {
    return {
      isValid: false,
      isoValue: null,
      message:
        "Inserisci una data valida in formato GG/MM/AAAA senza usare date future.",
    };
  }

  return {
    isValid: true,
    isoValue: parsedValue.isoValue,
    message: null,
  };
}

export function calculateAge(
  value: Date | string | null | undefined,
  currentDate = new Date(),
) {
  const parsedValue =
    value instanceof Date
      ? value
      : parseBirthDate(value) ?? parseBirthDateInput(value, currentDate)?.date ?? null;

  if (!parsedValue) {
    return null;
  }

  let age = currentDate.getFullYear() - parsedValue.getFullYear();
  const currentMonth = currentDate.getMonth();
  const birthMonth = parsedValue.getMonth();

  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDate.getDate() < parsedValue.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function formatProfileDisplayName(fullName: string, age: number | null | undefined) {
  const trimmedName = fullName.trim();

  if (!trimmedName) {
    return "Da completare";
  }

  return age === null || age === undefined ? trimmedName : `${trimmedName}, ${age}`;
}

export function formatLocationSummary(
  city: string | null | undefined,
  region: string | null | undefined,
) {
  const normalizedValues = [city, region].map((value) => value?.trim()).filter(Boolean);
  return normalizedValues.length > 0 ? normalizedValues.join(", ") : "Da completare";
}

export function formatName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (match) => match.toUpperCase());
}

export function getCountryByCode(countryCode: string | null | undefined) {
  if (!countryCode) {
    return null;
  }

  return COUNTRY_OPTIONS.find((entry) => entry.code === countryCode) ?? null;
}

export function getPhoneCountryCodeOption(phoneCountryCode: string | null | undefined) {
  if (!phoneCountryCode) {
    return null;
  }

  return PHONE_COUNTRY_CODE_OPTIONS.find((entry) => entry.value === phoneCountryCode) ?? null;
}

export function searchCountries(query: string, limit = 8) {
  const normalizedQuery = normalizeLookupValue(query);
  const numericQuery = query.replace(/\D/g, "");

  if (!normalizedQuery && !numericQuery) {
    return [];
  }

  const startsWithMatches: CountryOption[] = [];
  const includesMatches: CountryOption[] = [];

  for (const entry of normalizedCountryOptions) {
    const matchesName = normalizedQuery
      ? entry.normalizedName.startsWith(normalizedQuery) || entry.normalizedCode.startsWith(normalizedQuery)
      : false;
    const includesName = normalizedQuery
      ? entry.normalizedName.includes(normalizedQuery) || entry.normalizedCode.includes(normalizedQuery)
      : false;
    const matchesPhoneCode = numericQuery
      ? entry.normalizedPhoneCountryCode.startsWith(numericQuery)
      : false;

    if (matchesName || matchesPhoneCode) {
      startsWithMatches.push(entry);
      continue;
    }

    if (includesName) {
      includesMatches.push(entry);
    }
  }

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}

const normalizedRegionOptions = REGION_OPTIONS.map((entry) => ({
  ...entry,
  normalizedValue: normalizeLookupValue(entry.value),
}));

export function searchRegions(query: string, exclude: string[] = [], limit = 6) {
  const normalizedQuery = normalizeLookupValue(query);

  if (!normalizedQuery) {
    return [];
  }

  const excludeSet = new Set(exclude);
  const startsWithMatches: SelectOption[] = [];
  const includesMatches: SelectOption[] = [];

  for (const entry of normalizedRegionOptions) {
    if (excludeSet.has(entry.value)) {
      continue;
    }

    if (entry.normalizedValue.startsWith(normalizedQuery)) {
      startsWithMatches.push({ label: entry.label, value: entry.value });
      continue;
    }

    if (entry.normalizedValue.includes(normalizedQuery)) {
      includesMatches.push({ label: entry.label, value: entry.value });
    }
  }

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}

export function isValidRegion(value: string) {
  return REGION_OPTIONS.some((option) => option.value === value);
}

// ---------------------------------------------------------------------------
// Italian provinces — 107 provinces grouped by region
// ---------------------------------------------------------------------------

export const PROVINCE_OPTIONS: SelectOption[] = [
  { label: "Agrigento", value: "Agrigento" },
  { label: "Alessandria", value: "Alessandria" },
  { label: "Ancona", value: "Ancona" },
  { label: "Arezzo", value: "Arezzo" },
  { label: "Ascoli Piceno", value: "Ascoli Piceno" },
  { label: "Asti", value: "Asti" },
  { label: "Avellino", value: "Avellino" },
  { label: "Bari", value: "Bari" },
  { label: "Barletta-Andria-Trani", value: "Barletta-Andria-Trani" },
  { label: "Belluno", value: "Belluno" },
  { label: "Benevento", value: "Benevento" },
  { label: "Bergamo", value: "Bergamo" },
  { label: "Biella", value: "Biella" },
  { label: "Bologna", value: "Bologna" },
  { label: "Bolzano", value: "Bolzano" },
  { label: "Brescia", value: "Brescia" },
  { label: "Brindisi", value: "Brindisi" },
  { label: "Cagliari", value: "Cagliari" },
  { label: "Caltanissetta", value: "Caltanissetta" },
  { label: "Campobasso", value: "Campobasso" },
  { label: "Caserta", value: "Caserta" },
  { label: "Catania", value: "Catania" },
  { label: "Catanzaro", value: "Catanzaro" },
  { label: "Chieti", value: "Chieti" },
  { label: "Como", value: "Como" },
  { label: "Cosenza", value: "Cosenza" },
  { label: "Cremona", value: "Cremona" },
  { label: "Crotone", value: "Crotone" },
  { label: "Cuneo", value: "Cuneo" },
  { label: "Enna", value: "Enna" },
  { label: "Fermo", value: "Fermo" },
  { label: "Ferrara", value: "Ferrara" },
  { label: "Firenze", value: "Firenze" },
  { label: "Foggia", value: "Foggia" },
  { label: "Forlì-Cesena", value: "Forlì-Cesena" },
  { label: "Frosinone", value: "Frosinone" },
  { label: "Genova", value: "Genova" },
  { label: "Gorizia", value: "Gorizia" },
  { label: "Grosseto", value: "Grosseto" },
  { label: "Imperia", value: "Imperia" },
  { label: "Isernia", value: "Isernia" },
  { label: "L'Aquila", value: "L'Aquila" },
  { label: "La Spezia", value: "La Spezia" },
  { label: "Latina", value: "Latina" },
  { label: "Lecce", value: "Lecce" },
  { label: "Lecco", value: "Lecco" },
  { label: "Livorno", value: "Livorno" },
  { label: "Lodi", value: "Lodi" },
  { label: "Lucca", value: "Lucca" },
  { label: "Macerata", value: "Macerata" },
  { label: "Mantova", value: "Mantova" },
  { label: "Massa-Carrara", value: "Massa-Carrara" },
  { label: "Matera", value: "Matera" },
  { label: "Messina", value: "Messina" },
  { label: "Milano", value: "Milano" },
  { label: "Modena", value: "Modena" },
  { label: "Monza e Brianza", value: "Monza e Brianza" },
  { label: "Napoli", value: "Napoli" },
  { label: "Novara", value: "Novara" },
  { label: "Nuoro", value: "Nuoro" },
  { label: "Oristano", value: "Oristano" },
  { label: "Padova", value: "Padova" },
  { label: "Palermo", value: "Palermo" },
  { label: "Parma", value: "Parma" },
  { label: "Pavia", value: "Pavia" },
  { label: "Perugia", value: "Perugia" },
  { label: "Pesaro e Urbino", value: "Pesaro e Urbino" },
  { label: "Pescara", value: "Pescara" },
  { label: "Piacenza", value: "Piacenza" },
  { label: "Pisa", value: "Pisa" },
  { label: "Pistoia", value: "Pistoia" },
  { label: "Pordenone", value: "Pordenone" },
  { label: "Potenza", value: "Potenza" },
  { label: "Prato", value: "Prato" },
  { label: "Ragusa", value: "Ragusa" },
  { label: "Ravenna", value: "Ravenna" },
  { label: "Reggio Calabria", value: "Reggio Calabria" },
  { label: "Reggio Emilia", value: "Reggio Emilia" },
  { label: "Rieti", value: "Rieti" },
  { label: "Rimini", value: "Rimini" },
  { label: "Roma", value: "Roma" },
  { label: "Rovigo", value: "Rovigo" },
  { label: "Salerno", value: "Salerno" },
  { label: "Sassari", value: "Sassari" },
  { label: "Savona", value: "Savona" },
  { label: "Siena", value: "Siena" },
  { label: "Siracusa", value: "Siracusa" },
  { label: "Sondrio", value: "Sondrio" },
  { label: "Sud Sardegna", value: "Sud Sardegna" },
  { label: "Taranto", value: "Taranto" },
  { label: "Teramo", value: "Teramo" },
  { label: "Terni", value: "Terni" },
  { label: "Torino", value: "Torino" },
  { label: "Trapani", value: "Trapani" },
  { label: "Trento", value: "Trento" },
  { label: "Treviso", value: "Treviso" },
  { label: "Trieste", value: "Trieste" },
  { label: "Udine", value: "Udine" },
  { label: "Varese", value: "Varese" },
  { label: "Venezia", value: "Venezia" },
  { label: "Verbano-Cusio-Ossola", value: "Verbano-Cusio-Ossola" },
  { label: "Vercelli", value: "Vercelli" },
  { label: "Verona", value: "Verona" },
  { label: "Vibo Valentia", value: "Vibo Valentia" },
  { label: "Vicenza", value: "Vicenza" },
  { label: "Viterbo", value: "Viterbo" },
];

const normalizedProvinceOptions = PROVINCE_OPTIONS.map((entry) => ({
  ...entry,
  normalizedValue: normalizeLookupValue(entry.value),
}));

export function searchProvinces(query: string, exclude: string[] = [], limit = 6) {
  const normalizedQuery = normalizeLookupValue(query);

  if (!normalizedQuery) {
    return [];
  }

  const excludeSet = new Set(exclude);
  const startsWithMatches: SelectOption[] = [];
  const includesMatches: SelectOption[] = [];

  for (const entry of normalizedProvinceOptions) {
    if (excludeSet.has(entry.value)) {
      continue;
    }

    if (entry.normalizedValue.startsWith(normalizedQuery)) {
      startsWithMatches.push({ label: entry.label, value: entry.value });
      continue;
    }

    if (entry.normalizedValue.includes(normalizedQuery)) {
      includesMatches.push({ label: entry.label, value: entry.value });
    }
  }

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}

export function isValidProvince(value: string) {
  return PROVINCE_OPTIONS.some((option) => option.value === value);
}

export function getRegionFromCity(cityName: string) {
  return (
    normalizedItalianCityOptions.find(
      (entry) => entry.normalizedName === normalizeLookupValue(cityName),
    )?.region ?? ""
  );
}

export function getRegionsFromCity(cityName: string) {
  const normalizedName = normalizeLookupValue(cityName);
  const regions = normalizedItalianCityOptions
    .filter((entry) => entry.normalizedName === normalizedName)
    .map((entry) => entry.region);

  return Array.from(new Set(regions));
}

export function isRegionConsistentWithCity(cityName: string, region: string) {
  const normalizedRegion = region.trim();

  if (!cityName.trim() || !normalizedRegion) {
    return true;
  }

  return getRegionsFromCity(cityName).includes(normalizedRegion);
}

export function searchItalianCities(query: string, limit = 8) {
  const normalizedQuery = normalizeLookupValue(query);

  if (!normalizedQuery) {
    return [];
  }

  const startsWithMatches: ItalianCityOption[] = [];
  const includesMatches: ItalianCityOption[] = [];

  for (const entry of normalizedItalianCityOptions) {
    if (entry.normalizedName.startsWith(normalizedQuery)) {
      startsWithMatches.push({ name: entry.name, region: entry.region });
      continue;
    }

    if (entry.normalizedName.includes(normalizedQuery)) {
      includesMatches.push({ name: entry.name, region: entry.region });
    }
  }

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}

export function isItalianCity(cityName: string) {
  return Boolean(getRegionFromCity(cityName));
}

export function normalizeSeasonLabelInput(value: string) {
  return normalizePlayerSeasonLabelInput(value);
}

export function isSeasonLabelValid(value: string) {
  return isPlayerSeasonLabelValid(value);
}

export function normalizeInstagramInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const normalizedValue = trimmed.replace(/^@+/, "");

  if (/^https?:\/\//i.test(normalizedValue)) {
    const match = normalizedValue.match(
      /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?(?:\?.*)?$/i,
    );

    return match?.[1] ? `https://instagram.com/${match[1]}` : "";
  }

  return /^[A-Za-z0-9._]+$/.test(normalizedValue)
    ? `https://instagram.com/${normalizedValue}`
    : "";
}

export function normalizeFacebookInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const match = trimmed.match(
      /^https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9.\-]+)\/?(?:\?.*)?$/i,
    );

    return match?.[1] ? `https://facebook.com/${match[1]}` : "";
  }

  return /^[A-Za-z0-9.\-]+$/.test(trimmed) ? `https://facebook.com/${trimmed}` : "";
}

export function normalizeContactEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizePhoneInput(value: string) {
  const compactValue = value.replace(/[^\d+]/g, "");

  if (!compactValue) {
    return "";
  }

  if (compactValue.startsWith("00")) {
    return `+${compactValue.slice(2).replace(/[^\d]/g, "")}`;
  }

  if (compactValue.startsWith("+")) {
    return `+${compactValue.slice(1).replace(/[^\d]/g, "")}`;
  }

  return compactValue.replace(/[^\d]/g, "");
}

export function normalizePhoneLocalNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function composePhoneNumber(
  phoneCountryCode: string | null | undefined,
  phoneNumber: string | null | undefined,
) {
  const normalizedCountryCode = normalizePhoneInput(phoneCountryCode ?? "");
  const normalizedPhoneNumber = normalizePhoneLocalNumber(phoneNumber ?? "");

  if (!normalizedPhoneNumber) {
    return "";
  }

  if (!normalizedCountryCode) {
    return normalizedPhoneNumber;
  }

  return normalizePhoneInput(`${normalizedCountryCode}${normalizedPhoneNumber}`);
}

export function splitPhoneNumber(
  value: string | null | undefined,
  fallbackCountryCode = "+39",
) {
  const normalizedValue = normalizePhoneInput(value ?? "");
  const normalizedFallbackCountryCode = normalizePhoneInput(fallbackCountryCode) || "+39";

  if (!normalizedValue) {
    return {
      phoneCountryCode: normalizedFallbackCountryCode,
      phoneNumber: "",
    };
  }

  if (!normalizedValue.startsWith("+")) {
    return {
      phoneCountryCode: normalizedFallbackCountryCode,
      phoneNumber: normalizePhoneLocalNumber(normalizedValue),
    };
  }

  const matchingCountry = [...PHONE_COUNTRY_CODE_OPTIONS]
    .sort((left, right) => right.value.length - left.value.length)
    .find((entry) => normalizedValue.startsWith(entry.value));

  if (!matchingCountry) {
    return {
      phoneCountryCode: normalizedFallbackCountryCode,
      phoneNumber: normalizePhoneLocalNumber(normalizedValue),
    };
  }

  return {
    phoneCountryCode: matchingCountry.value,
    phoneNumber: normalizePhoneLocalNumber(normalizedValue.slice(matchingCountry.value.length)),
  };
}

export function isPhoneNumberValid(value: string) {
  const normalizedValue = normalizePhoneInput(value);
  // Prefer strict E.164 semantics for stored phone numbers so chat sharing can
  // always generate stable tel: links and avoid ambiguous local formats.
  return /^\+[1-9]\d{6,14}$/.test(normalizedValue);
}

export function getSocialDisplayValue(
  platform: "facebook" | "instagram",
  value: string | null | undefined,
) {
  const normalizedValue =
    platform === "instagram"
      ? normalizeInstagramInput(value ?? "")
      : normalizeFacebookInput(value ?? "");

  if (!normalizedValue) {
    return "";
  }

  const username = normalizedValue.split("/").filter(Boolean).at(-1) ?? "";
  return platform === "instagram" ? `@${username}` : username;
}

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Nationality category classification (Italy / EU / non-EU)
// ---------------------------------------------------------------------------

export type NationalityCategory = "italy" | "eu" | "non_eu";

/**
 * ISO 3166-1 alpha-2 codes for the 27 EU member states (excluding Italy,
 * which is classified as "italy").
 */
const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "LV", "LT", "LU", "MT", "NL", "PL",
  "PT", "RO", "SK", "SI", "ES", "SE",
]);

/**
 * Classifies a nationality code into one of three categories:
 * - "italy" — the user is Italian
 * - "eu"    — the user is from another EU member state
 * - "non_eu" — the user is from outside the EU (or code is empty/unknown)
 */
export function getNationalityCategory(code: string | null | undefined): NationalityCategory {
  if (!code) return "non_eu";
  if (code === "IT") return "italy";
  if (EU_COUNTRY_CODES.has(code)) return "eu";
  return "non_eu";
}
