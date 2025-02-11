const { spawn } = require("child_process");
const path = require("path");

class WebpackBuildMonitorPlugin {
  constructor(options = {}) {
    this.devServerStarted = false;
    this.options = options;
    this.interval = options.interval || 1000; // Capture every second
    this.monitoring = false;
    this.childProcess = null;
    this.globalDefines = options.globalDefines;
    // Generate log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = path.join(
      process.cwd(),
      `web-app_${timestamp}.log`
    );
  }

  apply(compiler) {
    // Start monitoring when the build starts
    compiler.hooks.run.tap("WebpackBuildMonitorPlugin", () => {
      console.log(
        `[systemResourceLoggerPlugin] Build started... Logging to ${this.logFile}`
      );
      this.startChildProcess(process.pid); // Pass Webpack's PID
    });

    //start monitoring when the dev-server starts
    compiler.hooks.watchRun.tap("WebpackBuildMonitorPlugin", () => {
      if (this.devServerStarted === false) {
        this.devServerStarted = true;
        console.log(
          `[systemResourceLoggerPlugin] Watching for changes... Logging to ${this.logFile}`
        );
        this.startChildProcess(process.pid);
      }
    });

    // Stop monitoring when the build is done
    compiler.hooks.done.tap("WebpackBuildMonitorPlugin", () => {
      // in order to stop the hook from stopping devserver analysis
      if (!this.devServerStarted) {
        console.log(
          "[systemResourceLoggerPlugin] Build finished, stopping monitor."
        );
        this.stopChildProcess();
      }
    });

    // Stop monitoring when the build fails
    compiler.hooks.failed.tap("WebpackBuildMonitorPlugin", error => {
      console.error("[systemResourceLoggerPlugin] Build failed!", error);
      this.stopChildProcess();
    });

    process.on("SIGINT", () => {
      console.log("[systemResourceLoggerPlugin] Webpack process interrupted.");
      this.stopChildProcess();
      process.exit();
    });

    process.on("exit", () => {
      // console.log("[systemResourceLoggerPlugin] Webpack process exited.");
      this.stopChildProcess();
    });
  }

  startChildProcess(parentPid) {
    if (this.monitoring) return;
    this.monitoring = true;

    // ✅ Pass Webpack's PID to the child process
    this.childProcess = spawn(
      "node",
      [require.resolve("./monitorChild.js"), parentPid],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          LOG_FILE: this.logFile,
          INTERVAL: this.interval,
        },
      }
    );

    this.childProcess.stdout.on("data", data =>
      console.log("[systemResourceLoggerPlugin Child]:", data.toString().trim())
    );

    this.childProcess.stderr.on("data", err =>
      console.error(
        "[systemResourceLoggerPlugin Error]:",
        err.toString().trim()
      )
    );

    this.childProcess.on("exit", code => {
      if (code !== 0)
        console.error(
          `[systemResourceLoggerPlugin] Child exited with code ${code}`
        );
      this.monitoring = false;
      this.childProcess = null;
    });

    // console.log(
    //   `[systemResourceLoggerPlugin] Monitoring started for PID: ${parentPid}...`
    // );
  }

  stopChildProcess() {
    if (!this.childProcess) return;
    this.childProcess.kill();
    this.monitoring = false;
    this.childProcess = null;
    // console.log("[systemResourceLoggerPlugin] Monitoring stopped.");
  }
}

module.exports = WebpackBuildMonitorPlugin;