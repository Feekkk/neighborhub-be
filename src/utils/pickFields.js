function pickFields(data, fields) {
  const picked = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return picked;
  }
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(data, field) && data[field] !== undefined) {
      picked[field] = data[field];
    }
  }
  return picked;
}

module.exports = pickFields;
