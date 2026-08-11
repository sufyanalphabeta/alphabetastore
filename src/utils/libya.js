export const LIBYA_PHONE_PREFIX = "+218";

export const LIBYAN_CITIES = [
  "\u0637\u0631\u0627\u0628\u0644\u0633",
  "\u0628\u0646\u063a\u0627\u0632\u064a",
  "\u0645\u0635\u0631\u0627\u062a\u0629",
  "\u0627\u0644\u0632\u0627\u0648\u064a\u0629",
  "\u0632\u0644\u064a\u062a\u0646",
  "\u0633\u0628\u0647\u0627",
  "\u0633\u0631\u062a",
  "\u0627\u0644\u0628\u064a\u0636\u0627\u0621",
  "\u0623\u062c\u062f\u0627\u0628\u064a\u0627",
  "\u062f\u0631\u0646\u0629",
  "\u0627\u0644\u062e\u0645\u0633",
  "\u062a\u0631\u0647\u0648\u0646\u0629",
  "\u063a\u0631\u064a\u0627\u0646",
  "\u0635\u0628\u0631\u0627\u062a\u0629",
  "\u0637\u0628\u0631\u0642",
  "\u063a\u062f\u0627\u0645\u0633",
  "\u064a\u0641\u0631\u0646",
  "\u0645\u0631\u0632\u0642",
  "\u0627\u0644\u0643\u0641\u0631\u0629",
  "\u0634\u062d\u0627\u062a"
];

export const CITY_ALIASES = {
  tripoli: "\u0637\u0631\u0627\u0628\u0644\u0633",
  benghazi: "\u0628\u0646\u063a\u0627\u0632\u064a",
  misrata: "\u0645\u0635\u0631\u0627\u062a\u0629",
  zawiya: "\u0627\u0644\u0632\u0627\u0648\u064a\u0629",
  sabha: "\u0633\u0628\u0647\u0627",
  sirte: "\u0633\u0631\u062a"
};

export function normalizeLibyanCity(value = "") {
  const city = String(value).trim();
  return CITY_ALIASES[city.toLowerCase()] || city;
}

const LIBYA_PHONE_LOCAL_LENGTH = 9;

function toDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

export function stripLibyaPhonePrefix(value = "") {
  let digits = toDigits(value);
  if (digits.startsWith("218")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, LIBYA_PHONE_LOCAL_LENGTH);
}

export function formatLibyaPhone(value = "") {
  const localNumber = stripLibyaPhonePrefix(value);
  return localNumber ? `${LIBYA_PHONE_PREFIX}${localNumber}` : "";
}

export function isValidLibyaPhone(value = "") {
  return stripLibyaPhonePrefix(value).length === LIBYA_PHONE_LOCAL_LENGTH;
}
