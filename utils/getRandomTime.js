function generateRandomTime() {
  const minTime = 7200000 * 3; // 6 hours in milliseconds
  const maxTime = 14400000 * 2; // 8 hours in milliseconds

  const randomTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return randomTime;
}

module.exports = { generateRandomTime };
