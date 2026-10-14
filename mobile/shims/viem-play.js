function parseAbi(entries) {
  return entries;
}

function disabledTransaction() {
  throw new Error("Web3 value conversion is disabled in the Google Play release");
}

module.exports = {
  formatEther: () => "0",
  parseAbi,
  parseEther: disabledTransaction,
};
