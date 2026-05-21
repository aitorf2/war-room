// War Room, Electron main process.
//
// Two windows:
//   - Main window: the dashboard. Boots the bundled Next.js server in prod
//     and points the webview at it (dev points at the externally-running
//     dev server).
//   - Mini window: a frameless always-on-top control strip. Hidden by
//     default; shown by the main window via IPC whenever the user is in a
//     meeting AND the main window is not in focus. Lets users mute/leave
//     and re-expand the main window from any other app.

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");


const net = require("net");

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:3000";
const PORT_RANGE_START = 33773;
const PORT_RANGE_END = 33799;

let prodPort = PORT_RANGE_START;
let mainWindow = null;
let miniWindow = null;
let nextProcess = null;
let inMeeting = false;
let userClosedMini = false;

// Walk a range of localhost ports until we find one nothing else is listening
// on. Prevents EADDRINUSE crashes when a stranded server from a previous
// install/update still holds the default port.
function findFreePort(start, end) {
  return new Promise((resolve, reject) => {
    let port = start;
    const tryNext = () => {
      if (port > end) {
        reject(new Error(`no free port in range ${start}-${end}`));
        return;
      }
      const tester = net.createServer();
      tester.once("error", () => {
        port += 1;
        tryNext();
      });
      tester.once("listening", () => {
        const found = port;
        tester.close(() => resolve(found));
      });
      tester.listen(port, "127.0.0.1");
    };
    tryNext();
  });
}

function targetUrl() {
  return isDev ? DEV_URL : `http://127.0.0.1:${prodPort}`;
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve();
          else reject(new Error(`status ${res.statusCode}`));
          res.resume();
        });
        req.on("error", reject);
        req.setTimeout(1000, () => req.destroy(new Error("timeout")));
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Server at ${url} did not come up within ${timeoutMs}ms`);
}

function startBundledServer() {
  const standaloneDir = path.join(process.resourcesPath, "app", ".next", "standalone");
  const serverScript = path.join(standaloneDir, "server.js");
  const env = {
    ...process.env,
    PORT: String(prodPort),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
  };
  nextProcess = spawn(process.execPath, [serverScript], {
    cwd: standaloneDir,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  nextProcess.stdout.on("data", (d) => console.log("[next]", d.toString().trim()));
  nextProcess.stderr.on("data", (d) => console.error("[next:err]", d.toString().trim()));
  nextProcess.on("exit", (code) => {
    console.log(`[next] exited with code ${code}`);
    if (!app.isQuitting) app.quit();
  });
}

async function createMainWindow() {
  if (!isDev) {
    try {
      prodPort = await findFreePort(PORT_RANGE_START, PORT_RANGE_END);
    } catch (e) {
      console.error("Could not find a free port:", e.message);
      prodPort = PORT_RANGE_START;
    }
    startBundledServer();
  }

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    title: "War Room",
    accessibleTitle: "War Room — panel de equipo",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(targetUrl())) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Show / hide the mini window based on main window focus + meeting state.
  const evaluateMini = () => {
    if (!miniWindow || miniWindow.isDestroyed()) return;
    const focused = mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused();
    const minimized = mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized();
    const shouldShow = inMeeting && !userClosedMini && (!focused || minimized);
    if (shouldShow && !miniWindow.isVisible()) miniWindow.showInactive();
    if (!shouldShow && miniWindow.isVisible()) miniWindow.hide();
  };

  mainWindow.on("focus", evaluateMini);
  mainWindow.on("blur", evaluateMini);
  mainWindow.on("minimize", evaluateMini);
  mainWindow.on("restore", () => {
    userClosedMini = false;
    evaluateMini();
  });
  mainWindow.on("show", evaluateMini);
  mainWindow.on("hide", evaluateMini);
  mainWindow._evaluateMini = evaluateMini;

  try {
    await waitForServer(targetUrl());
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(targetUrl());
    }
  } catch (e) {
    console.error("Failed to reach Next.js server:", e);
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        await mainWindow.loadURL(
          "data:text/html,<h1 style='font-family:sans-serif;color:#eee;background:#0a0a0a;padding:2rem'>War Room could not start its local server.<br><small>" +
            (e && e.message ? e.message.replace(/[<>]/g, "") : "unknown error") +
            "</small></h1>",
        );
        mainWindow.show();
      } catch {
        // window died during the fallback, nothing to do, app will close
      }
    }
  }

  // Allow F12 / Ctrl+Shift+I to toggle DevTools even in production builds , 
  // we don't ship a menu bar, so without this users have no diagnostic path
  // when something goes wrong.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrlShiftI = input.control && input.shift && input.key.toLowerCase() === "i";
    if (input.key === "F12" || ctrlShiftI) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

async function createMiniWindow() {
  miniWindow = new BrowserWindow({
    width: 340,
    height: 76,
    x: 60,
    y: 60,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#0a0a0a",
    show: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  miniWindow.setAlwaysOnTop(true, "floating", 1);
  miniWindow.setVisibleOnAllWorkspaces(true);

  try {
    await waitForServer(targetUrl());
    await miniWindow.loadURL(`${targetUrl()}/mini`);
  } catch (e) {
    console.error("Mini load failed:", e);
  }
}

// ─── IPC plumbing ───────────────────────────────────────────────────────────

ipcMain.on("main:set-in-meeting", (_evt, value) => {
  inMeeting = !!value;
  if (!inMeeting) userClosedMini = false;
  if (mainWindow && mainWindow._evaluateMini) mainWindow._evaluateMini();
});

ipcMain.on("meeting:state", (_evt, payload) => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send("meeting:state", payload);
  }
});

ipcMain.on("meeting:action", (_evt, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("meeting:action", payload);
  }
});

ipcMain.on("mini:show", () => {
  if (miniWindow && !miniWindow.isDestroyed() && !miniWindow.isVisible()) {
    miniWindow.showInactive();
  }
});

ipcMain.on("mini:hide", () => {
  if (miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()) {
    userClosedMini = true;
    miniWindow.hide();
  }
});

// ─── Autonomous heartbeat ─────────────────────────────────────────────────
// Polls every 10 minutes to check if any channel has been idle long enough
// to warrant an autonomous Claude turn. When the server reports a trigger,
// fires a POST to /api/chat and drains the streaming response so the turn
// completes fully. The 2-hour idle threshold is enforced server-side in
// checkAutonomousTrigger (autonomy_freq_secs on the active phase, default 7200 s).

let _heartbeatTimer = null;

function _httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }),
      );
    });
    req.on("error", reject);
  });
}

function _httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parseInt(parsed.port, 10),
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        // Drain the SSE stream so the connection stays open until Claude finishes.
        // The chat route logs the reply to the DB automatically — we don't need the text.
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
        });
        res.on("end", () => resolve({ status: res.statusCode, bytes }));
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function _fireChatTurn(baseUrl, channelId, projectPath, prompt) {
  console.log(
    `[heartbeat] autonomous turn channel=${channelId} path=${projectPath}`,
  );
  try {
    const { status, bytes } = await _httpPost(`${baseUrl}/api/chat`, {
      channelId,
      projectPath,
      prompt,
    });
    console.log(
      `[heartbeat] turn done channel=${channelId} status=${status} bytes=${bytes}`,
    );
  } catch (e) {
    console.error(`[heartbeat] turn failed channel=${channelId}:`, e.message);
  }
}

async function _runHeartbeat(baseUrl) {
  try {
    const { status, body } = await _httpGet(`${baseUrl}/api/autonomous/heartbeat`);
    if (status !== 200) {
      console.warn(`[heartbeat] unexpected status ${status}`);
      return;
    }
    const { triggers } = JSON.parse(body);
    if (!Array.isArray(triggers) || triggers.length === 0) return;
    console.log(`[heartbeat] ${triggers.length} trigger(s)`);
    for (const { channelId, projectPath, prompt } of triggers) {
      // Fire each turn without blocking the heartbeat loop.
      _fireChatTurn(baseUrl, channelId, projectPath, prompt);
    }
  } catch (e) {
    console.warn("[heartbeat] poll error:", e.message);
  }
}

function startAutonomousHeartbeat(baseUrl) {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  const POLL_MS = 10 * 60 * 1000; // 10 minutes
  // Give the Next.js server a 5 s grace period before the first check.
  setTimeout(() => _runHeartbeat(baseUrl), 5000);
  _heartbeatTimer = setInterval(() => _runHeartbeat(baseUrl), POLL_MS);
  console.log("[heartbeat] started — polling every 10 min, idle threshold 2 h");
}

// ─── Auto-update ────────────────────────────────────────────────────────────
// Updates download in the background, but instead of silently restarting we
// surface a popup in the renderer. The user clicks "Restart" → IPC fires
// `update:restart` → we call quitAndInstall(). If they ignore it, the update
// also lands on the next normal app quit via autoInstallOnAppQuit.

let cachedAutoUpdater = null;
function getAutoUpdater() {
  if (cachedAutoUpdater !== null) return cachedAutoUpdater;
  try {
    cachedAutoUpdater = require("electron-updater").autoUpdater;
  } catch (e) {
    console.warn("electron-updater not bundled:", e.message);
    cachedAutoUpdater = false;
  }
  return cachedAutoUpdater;
}

function broadcastUpdateState(state) {
  for (const w of [mainWindow, miniWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send("update:state", state);
  }
}

function wireAutoUpdater() {
  // Auto-updater is opt-in. Forkers must point WAR_ROOM_UPDATE_URL at a
  // host they control before the updater does anything. Without it we
  // skip wiring entirely so the installer doesn't ping a placeholder
  // domain that returns 404 for every user.
  if (!process.env.WAR_ROOM_UPDATE_URL) {
    console.log("auto-updater disabled: WAR_ROOM_UPDATE_URL not set");
    return;
  }
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    broadcastUpdateState({ phase: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    broadcastUpdateState({ phase: "downloading", version: info?.version ?? null, percent: 0 });
  });
  autoUpdater.on("update-not-available", () => {
    broadcastUpdateState({ phase: "idle" });
  });
  autoUpdater.on("download-progress", (p) => {
    broadcastUpdateState({
      phase: "downloading",
      percent: Math.round(p?.percent ?? 0),
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    broadcastUpdateState({ phase: "ready", version: info?.version ?? null });
  });
  autoUpdater.on("error", (err) => {
    broadcastUpdateState({ phase: "error", error: err?.message ?? String(err) });
  });

  autoUpdater.checkForUpdates().catch((e) => {
    console.warn("update check failed:", e.message);
  });
}

ipcMain.on("update:check", () => {
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;
  autoUpdater.checkForUpdates().catch((e) => {
    broadcastUpdateState({ phase: "error", error: e?.message ?? String(e) });
  });
});

ipcMain.on("update:restart", () => {
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;
  try {
    autoUpdater.quitAndInstall(false, true);
  } catch (e) {
    console.error("quitAndInstall failed:", e);
  }
});

ipcMain.on("mini:expand-main", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

// ─── App lifecycle ──────────────────────────────────────────────────────────

// Single-instance lock: a second launch (whether user double-clicks the icon
// again or an auto-update relaunches before the old PID is gone) just focuses
// the existing window instead of trying to spawn a duplicate. Avoids the
// EADDRINUSE crash on the bundled server's port.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    // WHY: must be called after ready. Without this, Chromium only builds the
    // accessibility tree when a screen reader is already running at launch.
    // VoiceOver started after the app would see an empty tree.
    app.setAccessibilitySupportEnabled(true);

    await createMainWindow();
    await createMiniWindow();

    if (!isDev) wireAutoUpdater();
    startAutonomousHeartbeat(targetUrl());

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (nextProcess && !nextProcess.killed) nextProcess.kill();
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
});
