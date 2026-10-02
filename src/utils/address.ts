export function residenceCityFromAddress(address: string): string {
  const segments = address.split(",").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length < 2) return "";
  const candidate = segments.at(-1) ?? "";
  return /^[\p{L}][\p{L}\s'’-]{1,79}$/u.test(candidate) ? candidate : "";
}
