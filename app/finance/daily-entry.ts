const businessDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lusaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const entryDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function businessDate(at = new Date()) {
  const parts = businessDateFormatter.formatToParts(at);
  const year = parts.find((part) => part.type === "year")!.value.padStart(4, "0");
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

export function isEntryDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000") || date > businessDate()) {
    return false;
  }
  const parsed = new Date(date + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function formatEntryDate(date: string) {
  return entryDateFormatter.format(new Date(date + "T00:00:00Z"));
}

export function parseAmount(input: string): number | string {
  const amount = input.trim();
  if (!amount) return "Enter an amount. Type 0 if it is zero.";
  if (!/^-?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(amount)) {
    return "Enter a number with up to two decimal places, such as 25.50.";
  }

  // Build the integer ngwee value directly from the digits.
  const [kwacha, fraction = ""] = amount.replace(/^-/, "").split(".");
  const minor = Number(kwacha + fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) return "Enter an amount up to K90,071,992,547,409.91 in magnitude.";
  return amount.startsWith("-") && minor !== 0 ? -minor : minor;
}

export function formatAmount(minor: number) {
  const digits = Math.abs(minor).toString().padStart(3, "0");
  const sign = minor < 0 ? "-" : "";
  return sign + digits.slice(0, -2) + "." + digits.slice(-2);
}
