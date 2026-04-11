const requiredMajor = 24;
const currentVersion = process.versions.node;
const currentMajor = Number.parseInt(currentVersion.split(".")[0] ?? "0", 10);

if (currentMajor !== requiredMajor) {
  console.warn(
    `[atlas] Node ${requiredMajor}.x is the target runtime. Current version is ${currentVersion}.`
  );
} else {
  console.log(`[atlas] Node ${currentVersion} matches the repo target.`);
}
