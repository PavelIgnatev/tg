function parseArgs(args) {
  const argArray = args.split(",");
  const params = {};

  for (let i = 0; i < argArray.length; i += 2) {
    const key = argArray[i];
    const value = argArray[i + 1];
    const cleanedKey = key.replace(/^--/, "");
    params[cleanedKey] = value;
  }

  return params;
}

module.exports = { parseArgs };
