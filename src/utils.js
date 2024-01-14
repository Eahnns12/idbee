/**
 * Checks if the value has the expected type.
 * @param {*} value - The value to check.
 * @param {string} expected - The expected type as a string.
 * @returns {boolean} - True if the value matches the expected type, false otherwise.
 */
function isType(value, expected) {
  const type = Object.prototype.toString.call(value);
  const result = type === "[object " + expected + "]";
  return result;
}

export { isType };
