export function omitRowKeys(row = {}, keys = []) {
  const omit = new Set(keys);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !omit.has(key)));
}

export function missingColumnFromPostgrestError(message) {
  const text = String(message || "");
  const explicit = text.match(/Could not find the '([^']+)' column/i);
  if (explicit) return explicit[1];
  if (/PGRST204/i.test(text)) {
    const quoted = text.match(/'([^']+)'/);
    return quoted?.[1] || null;
  }
  return null;
}

export function stripTenantIdFromUpdate(row = {}) {
  const { tenant_id: _ignored, ...fields } = row;
  return fields;
}

export function firstRepresentationRow(data) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}
