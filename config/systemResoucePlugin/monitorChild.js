const { execSync } = require("child_process");
const fs = require("fs");
const pidusage = require("pidusage");

// Get Webpack's PID from command-line argument
const parentPid = process.argv[2]; // Webpack's PID
const logFile = process.env.LOG_FILE;
const interval = parseInt(process.env.INTERVAL, 10);
let elapsedTime = 0;

const startTime = Date.now();
let sumCpu = 0; // Sum of CPU usage readings (percentage)
let sumMem = 0; // Sum of memory usage (MB)
let count = 0; // Number of samples
let maxCpu = 0; // Track highest CPU usage observed
let maxMem = 0; // Track highest memory usage observed

// Write CSV column headers
fs.writeFileSync(logFile, "Elapsed Time (s),CPU (%),Total Mem (MB) \n");

function parseMemoryString(memStr) {
  // Extract the numeric part
  const numericValue = parseFloat(memStr);
  if (isNaN(numericValue)) return 0; // fallback if something unexpected

  // Check the last character for K/M/G
  const unitChar = memStr[memStr.length - 1].toUpperCase();

  switch (unitChar) {
    case "K":
      // K = kilobytes -> MB
      return numericValue / 1024;
    case "G":
      // G = gigabytes -> MB
      return numericValue * 1024;
    case "M":
      // M = megabytes -> MB
      return numericValue;
    default:
      // If there's no suffix (or something else),
      return numericValue;
  }
}

async function captureMetrics() {
  elapsedTime += 1;
  let cpuUsed = 0,
    totalMemMB = 0;

  try {
    // if the platform is macos
    if (process.platform === "darwin") {
      //get CPU from ps command line tool (still inaccurate)
      // const cpuOutput = execSync(`ps -p ${parentPid} -o %cpu`)
      //   .toString()
      //   .trim()
      //   .split("\n")[1];

      //get CPU usage from pidUsage (Highly accurate)
      const stats = await pidusage(parentPid);
      cpuUsed = parseFloat(stats.cpu.toFixed(2)) || 0;

      // get memory stats from top command line tool
      const memOutput = execSync(
        `top -l 1 -stats pid,command,mem | grep ${parentPid}`
      )
        .toString()
        .trim();
      const values = memOutput.split(/\s+/);
      totalMemMB = parseMemoryString(values[2]);
    } else if (process.platform === "linux") {
      // if the platform is linux

      /**
       * This boolean changes mode on how total memory consumed is calculated
       *  useRealMemory  = true --> RssAnon + VmSwap (same as activity monitor total memory usage)
       *  useRealMemory  = false --> VmRSS + VmSwap (Total memory used by the process RssAnon + RssFile + RssShmem + VmSwap)
       */
      const useRealMemory = true;

      //get CPU usage from pidUsage (Highly accurate)
      const stats = await pidusage(parentPid);
      cpuUsed = parseFloat(stats.cpu.toFixed(2)) || 0;

      // Read the process status file from /proc
      const status = execSync(`cat /proc/${parentPid}/status`)
        .toString()
        .trim();

      let vmrss = 0,
        rssAnon = 0,
        vmswap = 0;
      // Process each line to extract the memory metrics (all in kilobytes)
      status.split("\n").forEach(line => {
        if (line.startsWith("VmRSS:")) {
          // VmRSS: resident memory (includes both anonymous and shared pages)
          vmrss = parseFloat(line.split(/\s+/)[1]);
        } else if (line.startsWith("RssAnon:")) {
          // RssAnon: anonymous (private) memory portion of VmRSS
          rssAnon = parseFloat(line.split(/\s+/)[1]);
        } else if (line.startsWith("VmSwap:")) {
          // VmSwap: memory that has been swapped out
          vmswap = parseFloat(line.split(/\s+/)[1]);
        }
      });

      // Calculate total memory usage based on the chosen mode.
      // (Both values are in kilobytes; convert to megabytes by dividing by 1024.)
      if (useRealMemory) {
        // "Real" memory: only the private (anonymous) resident memory plus swapped-out memory.
        totalMemMB = (rssAnon + vmswap) / 1024;
      } else {
        // "Total" memory: full resident memory plus swapped-out memory.
        totalMemMB = (vmrss + vmswap) / 1024;
      }
    } else if (process.platform === "win32") {
      console.log("trace Not supported in Windows!");
    }
  } catch (err) {
    console.error("[Child Process Error] Fetching system metrics:", err);
  }

  // === Update aggregator stats ===
  sumCpu += cpuUsed;
  sumMem += totalMemMB;
  count += 1;
  if (cpuUsed > maxCpu) maxCpu = cpuUsed;
  if (totalMemMB > maxMem) maxMem = totalMemMB;

  // Write data to the log file
  const logEntry = `${elapsedTime},${cpuUsed},${totalMemMB.toFixed(2)}\n`;
  fs.appendFileSync(logFile, logEntry);
}
// This function calculates final stats & writes them to another file
function finalizeStats() {
  const endTime = Date.now();
  const totalTimeSec = (endTime - startTime) / 1000;

  // If we never gathered any stats
  if (count === 0) {
    console.log("[Child] No data collected, skipping final stats.");
    return;
  }

  const avgCpu = sumCpu / count; // average CPU % across all samples
  const avgMem = sumMem / count; // average memory usage (MB)

  // We'll create a second file named summary of that file
  const summaryFile = logFile.replace(".log", "_summary.log");

  // We can write a header row, then a single row of data:
  const header =
    "Total Time (s),Avg CPU (%),Avg Mem (MB),Max CPU (%),Max Mem (MB)\n";
  const row =
    [
      totalTimeSec.toFixed(2),
      avgCpu.toFixed(2),
      avgMem.toFixed(2),
      maxCpu,
      maxMem,
    ].join(",") + "\n";

  fs.writeFileSync(summaryFile, header + row);
}

// Start the interval for monitoring
const timer = setInterval(captureMetrics, interval);

// When the child is killed (SIGTERM) or exits, finalize & write summary
process.on("SIGTERM", () => {
  clearInterval(timer);
  finalizeStats();
  process.exit(0);
});

// Also handle normal exit (in case plugin or environment calls process.exit)
process.on("exit", () => {
  // If we haven't finalized, do so. But watch out for double calls.
  clearInterval(timer);
  finalizeStats();
});