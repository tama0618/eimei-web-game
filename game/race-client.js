(() => {
  "use strict";

  if (window.EimeiRace?.active) return;

  const config = window.EIMEI_RACE_CONFIG || {};
  const script = document.currentScript || document.querySelector('script[src*="race-client.js"]');
  const scriptUrl = new URL(script?.src || "./game/race-client.js", location.href);
  const staticRoot = new URL("../", scriptUrl);
  const arenaUrl = new URL("arena/index.html", staticRoot);
  const catalogUrl = new URL("game/race-catalog.json", staticRoot);
  if (scriptUrl.searchParams.get("v")) catalogUrl.searchParams.set("v", scriptUrl.searchParams.get("v"));
  const isArena = document.documentElement.hasAttribute("data-eimei-arena");
  const parameters = new URLSearchParams(location.search);
  const roomParameter = isArena ? "room" : "eimei-room";
  const nicknameStorageKey = "eimei-race-nickname-v1";
  const playerStorageKey = "eimei-race-player-v1";
  const roundStorageKey = "eimei-race-round-v1";
  const startPlacementStorageKey = "eimei-race-place-start-v1";
  const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const photoIntroMilliseconds = 3200;
  const playerPalettes = [
    { primary: "#164c7e", dark: "#092643", accent: "#f05b32", visor: "#6ee8ff", glow: "rgba(31,151,211,.24)" },
    { primary: "#a53e32", dark: "#4f1714", accent: "#f0a52f", visor: "#ffd38a", glow: "rgba(197,73,57,.24)" },
    { primary: "#267254", dark: "#103c2d", accent: "#e5a82f", visor: "#86f0c4", glow: "rgba(42,152,109,.24)" },
    { primary: "#694c96", dark: "#30214c", accent: "#e36b9d", visor: "#d8bdff", glow: "rgba(116,79,169,.24)" },
    { primary: "#9b661d", dark: "#4c300b", accent: "#d94a34", visor: "#ffe19a", glow: "rgba(185,119,27,.24)" },
    { primary: "#176f78", dark: "#09363c", accent: "#ef7247", visor: "#81eef0", glow: "rgba(21,143,151,.24)" },
    { primary: "#963f70", dark: "#4b1935", accent: "#f08e38", visor: "#ffc0e1", glow: "rgba(172,63,124,.24)" },
    { primary: "#3e4f9d", dark: "#1b2755", accent: "#ef5c42", visor: "#aebcff", glow: "rgba(62,79,177,.24)" },
    { primary: "#92502f", dark: "#462213", accent: "#e8b52d", visor: "#ffc39d", glow: "rgba(166,85,45,.24)" },
    { primary: "#5d7429", dark: "#2a3910", accent: "#e36839", visor: "#d8ee8a", glow: "rgba(104,139,42,.24)" },
    { primary: "#176690", dark: "#0a3048", accent: "#e04f77", visor: "#86dfff", glow: "rgba(22,119,168,.24)" },
    { primary: "#73364b", dark: "#381725", accent: "#dda72d", visor: "#f4aec5", glow: "rgba(132,55,81,.24)" }
  ];
  const race = {
    active: true,
    roomCode: (parameters.get(roomParameter) || "").toUpperCase(),
    playerId: "",
    nickname: "",
    socket: null,
    connected: false,
    joined: false,
    room: null,
    serverOffset: 0,
    reconnectTimer: 0,
    reconnectAttempt: 0,
    pingTimer: 0,
    tickTimer: 0,
    positionTimer: 0,
    catalogPromise: null,
    catalogData: null,
    configuredRoundId: null,
    finishSentRoundId: null,
    finishLastSentAt: -Infinity,
    navigationCourseKey: null,
    navigationCoursePromise: null,
    photo: null,
    hud: null,
    hudKey: null,
    hints: null,
    hintKey: null,
    countdown: null,
    result: null,
    ghosts: new Map(),
    warmedUrls: new Set(),
    warmControllers: new Set(),
    warmedRoundId: null,
    lastGrappleMessage: null,
    courseRetryCount: 0,
    lastError: null
  };

  function paletteFor(player) {
    const index = Number.isInteger(player?.colorIndex) ? player.colorIndex : 0;
    return playerPalettes[((index % playerPalettes.length) + playerPalettes.length) % playerPalettes.length];
  }

  function generateRoomCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return [...bytes].map((value) => roomAlphabet[value % roomAlphabet.length]).join("");
  }

  function ensureRoomCode() {
    if (/^[A-Z2-9]{6}$/.test(race.roomCode)) return true;
    if (!isArena) return false;
    race.roomCode = generateRoomCode();
    const url = new URL(location.href);
    url.searchParams.set("room", race.roomCode);
    history.replaceState(history.state, "", url.href);
    return true;
  }

  function graphemes(value) {
    const text = String(value ?? "").normalize("NFC");
    if (typeof Intl?.Segmenter === "function") {
      return [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(text)].map((part) => part.segment);
    }
    return Array.from(text);
  }

  function normalizeNickname(value) {
    const normalized = String(value ?? "")
      .normalize("NFC")
      .replace(/[\u0000-\u001f\u007f-\u009f]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    const length = graphemes(normalized).length;
    return length >= 1 && length <= 8 ? normalized : null;
  }

  function ensurePlayerId() {
    let playerId = sessionStorage.getItem(playerStorageKey) || "";
    if (!/^[a-zA-Z0-9_-]{12,80}$/.test(playerId)) {
      playerId = `p_${crypto.randomUUID().replaceAll("-", "")}`;
      sessionStorage.setItem(playerStorageKey, playerId);
    }
    race.playerId = playerId;
  }

  function pageIdentity(urlLike = location.href) {
    const url = urlLike instanceof URL ? urlLike : new URL(urlLike, location.href);
    let pathname = url.pathname;
    if (pathname.startsWith(staticRoot.pathname)) pathname = `/${pathname.slice(staticRoot.pathname.length)}`;
    pathname = pathname.replace(/\/{2,}/g, "/");
    if (pathname === "/" || pathname.endsWith("/")) pathname += "index.html";
    return pathname.toLowerCase();
  }

  function warmUrl(urlLike) {
    let url;
    try {
      url = new URL(urlLike, location.href);
    } catch {
      return Promise.resolve(false);
    }
    if (url.origin !== location.origin || race.warmedUrls.has(url.href) || race.warmedUrls.size >= 28) {
      return Promise.resolve(false);
    }
    race.warmedUrls.add(url.href);
    const controller = new AbortController();
    race.warmControllers.add(controller);
    return fetch(url.href, {
      cache: "force-cache",
      credentials: "same-origin",
      priority: "low",
      signal: controller.signal
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => race.warmControllers.delete(controller));
  }

  function cancelWarmRequests() {
    for (const controller of race.warmControllers) controller.abort();
    race.warmControllers.clear();
  }

  function warmRaceRoute(course) {
    if (!course?.routePages?.length || !race.room?.roundId || race.warmedRoundId === race.room.roundId) return;
    race.warmedRoundId = race.room.roundId;
    race.warmedUrls.clear();
    // Warming the whole route competes with the actual page transition on
    // low-memory Chromebooks. Only the immediately reachable page matters.
    const pages = course.routePages.slice(1, 2);
    const run = async () => {
      for (let index = 0; index < pages.length; index += 1) {
        const url = new URL(pages[index].replace(/^\//, ""), staticRoot);
        url.searchParams.set("eimei-route", "race");
        url.searchParams.set("eimei-room", race.roomCode);
        url.searchParams.set("eimei-round", race.room.roundId);
        url.searchParams.set("eimei-from", course.routePages[index]);
        await warmUrl(url);
      }
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => run(), { timeout: 800 });
    else window.setTimeout(run, 120);
  }

  function arenaRoomUrl() {
    const url = new URL(arenaUrl);
    url.searchParams.set("room", race.roomCode);
    return url;
  }

  function setArenaStatus(text, mode = "") {
    const status = document.querySelector("[data-race-status]");
    if (status) status.textContent = text;
    const container = status?.closest(".arena-status");
    container?.classList.toggle("is-online", mode === "online");
    container?.classList.toggle("is-error", mode === "error");
  }

  function errorText(code) {
    return ({
      invalid_profile: "ニックネームは1〜8文字で入力してください",
      room_full: "この部屋は4人で満員です",
      need_two_players: "対戦開始には2人以上必要です",
      host_only: "対戦を開始できるのは部屋の作成者です",
      round_active: "現在の対戦が終了するまで開始できません",
      not_everyone_ready: "全員の準備完了を待っています",
      invalid_course: "目的地の生成に失敗しました。もう一度開始してください",
      origin_denied: "この公開URLは対戦サーバーに許可されていません"
    })[code] || "通信エラーが発生しました";
  }

  function showProfileEditor({ force = false } = {}) {
    if (document.querySelector(".eimei-race-profile")) return;
    const stored = normalizeNickname(localStorage.getItem(nicknameStorageKey));
    if (stored && !force) {
      race.nickname = stored;
      connect();
      return;
    }

    const root = document.createElement("div");
    root.className = "eimei-race-profile";
    root.innerHTML = `
      <form class="eimei-race-profile-card">
        <h2>ニックネーム登録</h2>
        <p>対戦中に表示する名前です。8文字まで。</p>
        <label for="eimei-race-name">NICKNAME</label>
        <div class="eimei-race-profile-row">
          <input id="eimei-race-name" name="nickname" autocomplete="nickname" maxlength="16" required>
          <button type="submit">決定</button>
        </div>
        <p class="eimei-race-profile-error" aria-live="polite"></p>
      </form>`;
    document.documentElement.append(root);
    const input = root.querySelector("input");
    const error = root.querySelector(".eimei-race-profile-error");
    input.value = stored || race.nickname || "";
    root.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const nickname = normalizeNickname(input.value);
      if (!nickname) {
        error.textContent = "1〜8文字で入力してください";
        input.focus();
        return;
      }
      race.nickname = nickname;
      localStorage.setItem(nicknameStorageKey, nickname);
      root.remove();
      if (race.socket) {
        disconnect(false);
      }
      connect();
    });
    requestAnimationFrame(() => input.focus());
  }

  function workerWebSocketUrl() {
    const base = String(config.serverBase || "");
    if (!base || base.includes("REPLACE_WITH_WORKERS_SUBDOMAIN")) return null;
    const url = new URL("room", base.endsWith("/") ? base : `${base}/`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("room", race.roomCode);
    return url;
  }

  function send(message) {
    if (race.socket?.readyState !== WebSocket.OPEN) return false;
    race.socket.send(JSON.stringify(message));
    return true;
  }

  function connect() {
    if (!ensureRoomCode() || !race.nickname || race.socket?.readyState === WebSocket.OPEN || race.socket?.readyState === WebSocket.CONNECTING) return;
    const url = workerWebSocketUrl();
    if (!url) {
      setArenaStatus("対戦サーバーの公開設定待ちです", "error");
      race.lastError = "server_not_configured";
      return;
    }
    window.clearTimeout(race.reconnectTimer);
    setArenaStatus("対戦サーバーへ接続しています");
    const socket = new WebSocket(url);
    race.socket = socket;
    socket.addEventListener("open", () => {
      race.connected = true;
      race.reconnectAttempt = 0;
      setArenaStatus("接続しました", "online");
    });
    socket.addEventListener("message", (event) => receive(JSON.parse(event.data)));
    socket.addEventListener("close", () => {
      if (race.socket !== socket) return;
      race.connected = false;
      race.joined = false;
      if (race.room?.phase !== "finished") race.finishSentRoundId = null;
      setArenaStatus("再接続しています");
      const delay = Math.min(8000, 500 * 2 ** race.reconnectAttempt++);
      race.reconnectTimer = window.setTimeout(connect, delay);
    });
    socket.addEventListener("error", () => {
      race.lastError = "socket_error";
      setArenaStatus("対戦サーバーへ接続できません", "error");
    });
  }

  function disconnect(reconnect = false) {
    window.clearTimeout(race.reconnectTimer);
    const socket = race.socket;
    race.socket = null;
    socket?.close(1000, "profile_changed");
    race.connected = false;
    race.joined = false;
    if (reconnect) race.reconnectTimer = window.setTimeout(connect, 100);
  }

  function receive(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      race.serverOffset = Number(message.serverNow) - Date.now();
      send({ type: "join", playerId: race.playerId, nickname: race.nickname });
      return;
    }
    if (message.type === "joined") {
      race.joined = true;
      updateRoom(message.room);
      startNetworkLoops();
      return;
    }
    if (message.type === "state") {
      updateRoom(message.room);
      return;
    }
    if (message.type === "course_request") {
      if (race.room?.hostId === race.playerId) {
        race.courseRetryCount = 0;
        provideCourse(message);
      }
      return;
    }
    if (message.type === "position") {
      updateGhost(message);
      return;
    }
    if (message.type === "grapple") {
      applyRemoteGrapple(message);
      return;
    }
    if (message.type === "pong") {
      const receivedAt = Date.now();
      const sentAt = Number(message.clientNow) || receivedAt;
      race.serverOffset = Number(message.serverNow) - (sentAt + receivedAt) * 0.5;
      return;
    }
    if (message.type === "error") {
      race.lastError = message.code;
      setArenaStatus(errorText(message.code), "error");
      if (
        message.code === "invalid_course" &&
        race.room?.hostId === race.playerId &&
        race.room?.phase === "preparing" &&
        race.courseRetryCount < 3
      ) {
        race.courseRetryCount += 1;
        window.setTimeout(() => provideCourse({
          seed: Number(race.room.courseSeed) + race.courseRetryCount * 0x9e3779b1,
          recentGoalIds: race.room.recentGoalIds || []
        }), 180);
      }
    }
  }

  function serverNow() {
    return Date.now() + race.serverOffset;
  }

  function startNetworkLoops() {
    if (!race.pingTimer) race.pingTimer = window.setInterval(() => send({ type: "ping", clientNow: Date.now() }), 5000);
    if (!race.tickTimer) race.tickTimer = window.setInterval(tick, 100);
    if (!race.positionTimer) race.positionTimer = window.setInterval(sendPosition, Math.max(90, Number(config.positionIntervalMilliseconds) || 120));
  }

  function updateRoom(room) {
    if (!room || room.code !== race.roomCode) return;
    race.room = room;
    if (isArena) updateArena();
    else configureMapRound();
  }

  function currentPlayer() {
    return race.room?.players?.find((player) => player.id === race.playerId) || null;
  }

  function updateArena() {
    const room = race.room;
    if (!room) return;
    const roomCode = document.querySelector("[data-race-room-code]");
    if (roomCode) roomCode.textContent = room.code;
    const count = document.querySelector("[data-race-player-count]");
    const connectedPlayers = room.players.filter((player) => player.connected);
    if (count) count.textContent = `${connectedPlayers.length} / ${room.maxPlayers || 4}`;
    const list = document.querySelector("[data-race-player-list]");
    if (list) {
      list.replaceChildren(...room.players.map((player) => {
        const item = document.createElement("li");
        const palette = paletteFor(player);
        item.style.setProperty("--race-player-color", palette.primary);
        item.classList.toggle("is-ready", player.ready);
        item.classList.toggle("is-self", player.id === race.playerId);
        const name = document.createElement("span");
        name.className = "arena-player-name";
        name.textContent = player.nickname;
        const tags = document.createElement("span");
        tags.className = "arena-player-tags";
        if (player.id === room.hostId) {
          const host = document.createElement("span");
          host.textContent = "HOST";
          tags.append(host);
        }
        const state = document.createElement("span");
        state.textContent = player.connected ? (player.ready ? "READY" : "WAIT") : "OFFLINE";
        tags.append(state);
        item.append(name, tags);
        return item;
      }));
    }

    const self = currentPlayer();
    const ready = document.querySelector("[data-race-ready]");
    if (ready) {
      ready.disabled = !race.joined || !new Set(["lobby", "finished"]).has(room.phase);
      ready.classList.toggle("is-ready", Boolean(self?.ready));
      ready.textContent = self?.ready ? "準備解除" : room.phase === "finished" ? "再戦準備" : "準備OK";
    }
    const start = document.querySelector("[data-race-start]");
    if (start) {
      const isHost = room.hostId === race.playerId;
      const everyoneReady = connectedPlayers.length >= 2 && connectedPlayers.every((player) => player.ready);
      start.hidden = !isHost;
      start.disabled = !isHost || !everyoneReady || !new Set(["lobby", "finished"]).has(room.phase);
      start.textContent = room.phase === "finished" ? "再戦開始" : "対戦開始";
    }

    const winner = room.players.find((player) => player.id === room.winnerId);
    if (room.phase === "preparing") setArenaStatus("今回の目的地を選んでいます");
    else if (room.phase === "countdown" || room.phase === "running") setArenaStatus("対戦へ移動します", "online");
    else if (room.phase === "finished") setArenaStatus(`${winner?.nickname || "勝者"} の勝利　再戦できます`, "online");
    else setArenaStatus("参加者を待っています", "online");

    if (room.course && new Set(["countdown", "running"]).has(room.phase)) enterRound(room);
  }

  function seededRandom(seed) {
    let state = Number(seed) >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function shortestRoute(pageMap, start, goal, maximumDepth = 8) {
    if (start === goal) return [start];
    const queue = [[start]];
    const visited = new Set([start]);
    while (queue.length > 0) {
      const route = queue.shift();
      if (route.length > maximumDepth) continue;
      for (const next of pageMap.get(route.at(-1))?.links || []) {
        if (visited.has(next) || !pageMap.has(next)) continue;
        const candidate = [...route, next];
        if (next === goal) return candidate;
        visited.add(next);
        queue.push(candidate);
      }
    }
    return [];
  }

  function categoryKeyFor(page) {
    return page.split("/").filter(Boolean)[0] || "index";
  }

  function categoryFor(page) {
    const segment = categoryKeyFor(page);
    return ({
      information: "学校案内",
      news: "ニュース",
      club: "部活動",
      career: "進路指導",
      openschool: "入試・オープンスクール",
      entrance: "入試案内",
      schedule: "行事予定",
      payment: "在校生向け情報",
      proxy: "証明書案内",
      meiyu: "卒業生向け情報",
      restaurant: "英明レストラン",
      correspondencecourse: "通信制課程"
    })[segment] || "学校ホームページ";
  }

  async function loadCatalog() {
    race.catalogPromise ||= fetch(catalogUrl, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error(`catalog_${response.status}`);
      return response.json();
    }).then((catalog) => {
      race.catalogData = catalog;
      return catalog;
    });
    return race.catalogPromise;
  }

  async function provideCourse({ seed, recentGoalIds = [] }) {
    try {
      const catalog = await loadCatalog();
      const pageMap = new Map(catalog.pages.map((page) => [page.page, page]));
      const usableTarget = (target) => Boolean(
        target &&
        String(target.id || "").length > 0 && String(target.id).length <= 180 &&
        String(target.selector || "").length > 0 && String(target.selector).length <= 700 &&
        String(target.label || "").trim() &&
        Number.isFinite(Number(target.x)) && Number.isFinite(Number(target.y))
      );
      const playable = catalog.pages
        .map((page) => ({ ...page, targets: page.targets.filter(usableTarget) }))
        .filter((page) => page.targets.length > 0 && page.height >= 420);
      const recent = new Set(recentGoalIds);
      const random = seededRandom(seed);
      const pageBuckets = new Map();
      for (const page of playable) {
        const key = categoryKeyFor(page.page);
        if (!pageBuckets.has(key)) pageBuckets.set(key, []);
        pageBuckets.get(key).push(page);
      }
      const categories = [...pageBuckets.keys()];
      for (let index = categories.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [categories[index], categories[swap]] = [categories[swap], categories[index]];
      }
      const candidatesByGoalCategory = new Map();
      const maximumAttempts = Math.max(900, categories.length * categories.length * 12);
      for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
        const goalIndex = attempt % categories.length;
        const sweep = Math.floor(attempt / categories.length);
        const goalCategory = categories[goalIndex];
        const startCategory = categories[(goalIndex + 1 + sweep) % categories.length];
        const goalPages = pageBuckets.get(goalCategory) || [];
        const startPages = pageBuckets.get(startCategory) || playable;
        const startPage = startPages[Math.floor(random() * startPages.length)];
        const goalPage = goalPages[Math.floor(random() * goalPages.length)];
        if (!startPage || !goalPage || startPage.page === goalPage.page) continue;
        const goalPool = goalPage.targets.filter((target) => !recent.has(target.id));
        if (goalPool.length === 0) continue;
        const routePages = shortestRoute(pageMap, startPage.page, goalPage.page);
        if (routePages.length < 2 || routePages.length > 8) continue;
        const start = startPage.targets[Math.floor(random() * startPage.targets.length)];
        const goal = goalPool[Math.floor(random() * goalPool.length)];
        if (!start || !goal) continue;
        const identity = `${start.id}=>${goal.id}`;
        let identityHash = 2166136261;
        for (let index = 0; index < identity.length; index += 1) {
          identityHash ^= identity.charCodeAt(index);
          identityHash = Math.imul(identityHash, 16777619);
        }
        const candidate = {
          id: `race-${(Number(seed) >>> 0).toString(36)}-${(identityHash >>> 0).toString(36)}`,
          seed: Number(seed),
          start: { ...start, page: startPage.page, title: startPage.title },
          goal: { ...goal, page: goalPage.page, title: goalPage.title },
          routePages
        };
        // One candidate per section gives news one ticket in the draw instead
        // of one ticket for every news article (nearly half the old catalog).
        // Prefer a start in another section when the graph permits it.
        const previous = candidatesByGoalCategory.get(goalCategory);
        if (!previous || categoryKeyFor(startPage.page) !== goalCategory) {
          candidatesByGoalCategory.set(goalCategory, candidate);
        }
        if (candidatesByGoalCategory.size === categories.length && attempt >= categories.length * 2) break;
      }
      const balancedCandidates = [...candidatesByGoalCategory.values()];
      const selected = balancedCandidates[Math.floor(random() * balancedCandidates.length)] || null;
      if (!selected) throw new Error("no_course");
      send({ type: "course", course: selected });
    } catch (error) {
      race.lastError = error.message;
      if (race.courseRetryCount < 3) {
        race.courseRetryCount += 1;
        setArenaStatus("目的地を再抽選しています");
        window.setTimeout(() => provideCourse({
          seed: Number(seed) + race.courseRetryCount * 0x9e3779b1,
          recentGoalIds
        }), 180);
      } else {
        setArenaStatus("目的地を生成できませんでした。もう一度開始してください", "error");
      }
    }
  }

  function enterRound(room) {
    const activeRound = sessionStorage.getItem(roundStorageKey);
    if (activeRound === room.roundId && !isArena) return;
    sessionStorage.setItem(roundStorageKey, room.roundId);
    sessionStorage.setItem(startPlacementStorageKey, room.roundId);
    const target = new URL(room.course.start.page.replace(/^\//, ""), staticRoot);
    target.searchParams.set("eimei-room", room.code);
    target.searchParams.set("eimei-round", room.roundId);
    target.searchParams.set("eimei-route", "race");
    location.assign(target.href);
  }

  function hintStage(room = race.room) {
    if (!room?.startAt) return 0;
    const elapsed = Math.max(0, serverNow() - room.startAt);
    if (elapsed >= (Number(config.navigationHintMilliseconds) || 300000)) return 4;
    if (elapsed >= (Number(config.contextHintMilliseconds) || 270000)) return 3;
    if (elapsed >= (Number(config.titleHintMilliseconds) || 210000)) return 2;
    if (elapsed >= (Number(config.categoryHintMilliseconds) || 150000)) return 1;
    return 0;
  }

  async function waitForMap() {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (window.EimeiMap?.active && typeof EimeiMap.configureRaceRound === "function") return EimeiMap;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  async function configureMapRound() {
    const room = race.room;
    if (!room?.course || !new Set(["countdown", "running", "finished"]).has(room.phase)) return;
    const map = await waitForMap();
    if (!map) return;
    const firstConfiguration = race.configuredRoundId !== room.roundId;
    const stage = hintStage(room);
    const currentPage = pageIdentity();
    const course = stage >= 4 ? await navigationCourseForCurrentPage(room.course) : room.course;
    const isDirectRoundEntrance = parameters.get("eimei-route") === "race" &&
      !parameters.has("eimei-from");
    const shouldPlaceAtStart = firstConfiguration &&
      currentPage === room.course.start.page &&
      (sessionStorage.getItem(startPlacementStorageKey) === room.roundId || isDirectRoundEntrance);
    map.setPlayerPalette?.(paletteFor(currentPlayer()));
    map.configureRaceRound({
      roomCode: room.code,
      roundId: room.roundId,
      startAt: room.startAt,
      course,
      placeAtStart: shouldPlaceAtStart,
      navigationEnabled: stage >= 4,
      frozen: room.phase === "countdown" && serverNow() < room.startAt,
      finished: room.phase === "finished"
    });
    if (stage >= 4) race.navigationCourseKey = `${room.roundId}:${currentPage}`;
    if (shouldPlaceAtStart) sessionStorage.removeItem(startPlacementStorageKey);
    race.configuredRoundId = room.roundId;
    ensureRaceHud();
    ensureRacePhoto(room.course.goal);
    warmRaceRoute(room.course);
    updateHints();
    updateCountdown();
    if (firstConfiguration) {
      // Publish the post-placement position immediately. The regular timer is
      // deliberately conservative for Chromebooks, so a small startup burst
      // prevents one player remaining invisible while pages finish loading.
      sendPosition();
      window.setTimeout(() => {
        if (race.configuredRoundId === room.roundId) sendPosition();
      }, 240);
      window.setTimeout(() => {
        if (race.configuredRoundId === room.roundId) sendPosition();
      }, 900);
    }
    if (room.phase === "finished") showResult();
  }

  async function navigationCourseForCurrentPage(course) {
    if (!course?.goal) return course;
    const currentPage = pageIdentity();
    if (currentPage === course.goal.page) return { ...course, routePages: [currentPage] };
    try {
      const catalog = await loadCatalog();
      const pageMap = new Map(catalog.pages.map((page) => [page.page, page]));
      const routePages = shortestRoute(pageMap, currentPage, course.goal.page, 12);
      return routePages.length >= 2 ? { ...course, routePages } : course;
    } catch {
      return course;
    }
  }

  function ensureFinalNavigation() {
    const room = race.room;
    if (!room?.course || isArena || hintStage(room) < 4) return;
    const key = `${room.roundId}:${pageIdentity()}`;
    if (race.navigationCourseKey === key || race.navigationCoursePromise) {
      window.EimeiMap?.setRaceNavigationEnabled?.(true);
      return;
    }
    race.navigationCoursePromise = navigationCourseForCurrentPage(room.course)
      .then((course) => waitForMap().then((map) => map?.configureRaceRound({
        roomCode: room.code,
        roundId: room.roundId,
        startAt: room.startAt,
        course,
        placeAtStart: false,
        navigationEnabled: true,
        frozen: room.phase === "countdown" && serverNow() < room.startAt,
        finished: room.phase === "finished"
      })))
      .then(() => { race.navigationCourseKey = key; })
      .finally(() => { race.navigationCoursePromise = null; });
  }

  function ensureRaceHud() {
    if (race.hud) return;
    const root = document.createElement("aside");
    root.className = "eimei-race-hud";
    root.innerHTML = `<div class="eimei-race-hud-room"><span>ROOM ${race.roomCode}</span><span data-race-phase>RACE</span></div><ol></ol>`;
    document.documentElement.append(root);
    race.hud = root;
    const hints = document.createElement("div");
    hints.className = "eimei-race-hints";
    hints.setAttribute("aria-live", "polite");
    hints.innerHTML = `
      <div class="eimei-race-hint-card">
        <span class="eimei-race-hint-label"></span>
        <span class="eimei-race-hint-value"></span>
        <span class="eimei-race-hint-progress" aria-hidden="true"></span>
      </div>`;
    document.documentElement.append(hints);
    race.hints = hints;
    updateRaceHud();
  }

  function updateRaceHud() {
    if (!race.hud || !race.room) return;
    const visiblePlayers = race.room.players.filter((player) => player.connected || player.id === race.room.winnerId);
    const hudKey = visiblePlayers
      .map((player) => `${player.id}:${player.nickname}:${player.colorIndex}:${player.id === race.room.winnerId}`)
      .join("|");
    if (race.hudKey === hudKey) return;
    race.hudKey = hudKey;
    const list = race.hud.querySelector("ol");
    list.replaceChildren(...visiblePlayers.map((player) => {
      const item = document.createElement("li");
      item.style.setProperty("--race-player-color", paletteFor(player).primary);
      item.classList.toggle("is-self", player.id === race.playerId);
      item.classList.toggle("is-winner", player.id === race.room.winnerId);
      item.textContent = player.nickname;
      return item;
    }));
  }

  function updateHints() {
    if (!race.hints || !race.room?.course) return;
    const stage = hintStage();
    const goal = race.room.course.goal;
    if (stage >= 3 && !race.catalogData) {
      loadCatalog().then(() => {
        race.hintKey = null;
        updateHints();
      }).catch(() => {});
    }
    let label = "手掛かり 0 / 3";
    let value = "写真のみ｜時間経過でヒント解禁";
    if (stage === 1) {
      label = "手掛かり 1 / 3　大分類";
      value = categoryFor(goal.page);
    } else if (stage === 2) {
      label = "手掛かり 2 / 3　ページ種別";
      value = pageTypeHint(goal);
    } else if (stage === 3) {
      label = "手掛かり 3 / 3　ページ内の位置";
      value = positionHint(goal);
    } else if (stage >= 4) {
      label = "FINAL GUIDE　ナビ解禁";
      value = "黄色い光が旗まで案内中";
    }
    const key = `${stage}:${label}:${value}`;
    if (race.hintKey === key) {
      if (stage >= 4) ensureFinalNavigation();
      return;
    }
    race.hintKey = key;
    race.hints.querySelector(".eimei-race-hint-label").textContent = label;
    race.hints.querySelector(".eimei-race-hint-value").textContent = value;
    race.hints.querySelector(".eimei-race-hint-progress").textContent = [0, 1, 2, 3, 4]
      .map((index) => index <= stage ? "●" : "○")
      .join(" ");
    const card = race.hints.querySelector(".eimei-race-hint-card");
    card.classList.remove("is-updated");
    card.classList.toggle("is-first-hint", stage === 0);
    card.dataset.hintStage = String(stage);
    void card.offsetWidth;
    card.classList.add("is-updated");
    if (stage >= 4) ensureFinalNavigation();
    else window.EimeiMap?.setRaceNavigationEnabled?.(false);
  }

  function pageTypeHint(goal) {
    const parts = String(goal.page || "").split("/").filter(Boolean);
    const category = categoryFor(goal.page);
    const filename = parts.at(-1) || "";
    const year = parts.find((part) => /^20\d{2}$/.test(part));
    if (parts[0] === "news") {
      if (/^news20\d{2}\.html?$/i.test(filename)) return `${year || "年度別"}ニュースの一覧ページ`;
      return `${year ? `${year}年度・` : ""}ニュースの記事ページ`;
    }
    if (/^(?:index|top)\.html?$/i.test(filename)) return `${category}エリアの入口ページ`;
    if (parts.length >= 3) return `${category}エリアの詳しい記事ページ`;
    return `${category}エリアの情報ページ`;
  }

  function positionHint(goal) {
    const page = race.catalogData?.pages?.find((candidate) => candidate.page === goal.page);
    const height = Math.max(1, Number(page?.height) || Number(goal.y) * 2 || 1);
    const ratio = Number(goal.y) / height;
    const band = ratio < .34 ? "上の方" : ratio < .7 ? "中央付近" : "下の方";
    const selector = String(goal.selector || "").toLowerCase();
    const kind = /(?:^|>)a(?::|\[|$)/.test(selector)
      ? "リンク"
      : /(?:^|>)h[1-6](?::|\[|$)/.test(selector) ? "見出し" : "文字の足場";
    return `ページの${band}にある${kind}`;
  }

  function photoScale(photo, expanded) {
    if (expanded) {
      return Math.min(
        1,
        (window.innerWidth - 80) / photo.viewWidth,
        (window.innerHeight - 80) / photo.viewHeight
      );
    }
    const targetWidth = Math.max(220, Math.min(360, window.innerWidth * .3));
    return Math.min(
      .34,
      targetWidth / photo.viewWidth,
      window.innerHeight * .34 / photo.viewHeight
    );
  }

  function sizePhoto() {
    const photo = race.photo;
    if (!photo) return;
    photo.viewWidth = Math.max(1, window.innerWidth);
    photo.viewHeight = Math.max(1, window.innerHeight);
    photo.iframe.style.width = `${photo.viewWidth}px`;
    photo.iframe.style.height = `${photo.viewHeight}px`;
    const expanded = photo.root.classList.contains("is-expanded") || photo.root.classList.contains("is-intro");
    const scale = photoScale(photo, expanded);
    photo.scale = scale;
    photo.root.style.setProperty("--photo-scale", String(scale));
    photo.root.style.width = `${photo.viewWidth * scale + 12}px`;
    photo.root.style.height = `${photo.viewHeight * scale + 12}px`;
    positionPhotoMarker();
  }

  function positionPhotoMarker() {
    const photo = race.photo;
    if (!photo?.iframe.contentWindow || !photo.iframe.contentDocument) return;
    const view = photo.iframe.contentWindow;
    try {
      const previewDocument = photo.iframe.contentDocument;
      let goalX = Number(photo.goal.x);
      let goalY = Number(photo.goal.y);
      const targetElement = photo.goal.selector ? previewDocument.querySelector(photo.goal.selector) : null;
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          goalX = rect.left + view.scrollX + rect.width * .5;
          goalY = rect.top + view.scrollY;
        }
      }
      const documentWidth = Math.max(previewDocument.documentElement.scrollWidth, previewDocument.body?.scrollWidth || 0);
      const documentHeight = Math.max(previewDocument.documentElement.scrollHeight, previewDocument.body?.scrollHeight || 0);
      const targetX = Math.max(0, Math.min(documentWidth - photo.viewWidth, goalX - photo.viewWidth * .5));
      const targetY = Math.max(0, Math.min(documentHeight - photo.viewHeight, goalY - photo.viewHeight * .48));
      view.scrollTo(targetX, targetY);
      photo.marker.style.left = `${Math.max(10, Math.min(photo.viewWidth - 10, goalX - view.scrollX)) * photo.scale}px`;
      photo.marker.style.top = `${Math.max(20, Math.min(photo.viewHeight - 10, goalY - view.scrollY)) * photo.scale}px`;
      photo.marker.hidden = false;
    } catch {
      // The mirrored preview is same-origin; keep the frame usable if it is still loading.
    }
  }

  function ensureRacePhoto(goal) {
    if (race.photo?.goal.id === goal.id && race.photo.roundId === race.room?.roundId) return;
    window.clearTimeout(race.photo?.introTimer);
    race.photo?.root.remove();
    const root = document.createElement("div");
    root.className = "eimei-race-photo is-intro";
    root.setAttribute("aria-label", "目的地の写真。Cキーで拡大");
    const iframe = document.createElement("iframe");
    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
    const marker = document.createElement("span");
    marker.className = "eimei-race-photo-marker";
    marker.hidden = true;
    const key = document.createElement("span");
    key.className = "eimei-race-photo-key";
    key.textContent = "C";
    root.append(iframe, marker, key);
    document.documentElement.append(root);
    race.photo = {
      root,
      iframe,
      marker,
      goal,
      roundId: race.room?.roundId || null,
      scale: 1,
      viewWidth: Math.max(1, window.innerWidth),
      viewHeight: Math.max(1, window.innerHeight),
      introUntil: performance.now() + photoIntroMilliseconds,
      introTimer: 0
    };
    const currentPhoto = race.photo;
    currentPhoto.introTimer = window.setTimeout(() => {
      if (race.photo !== currentPhoto) return;
      currentPhoto.root.classList.remove("is-intro");
      sizePhoto();
    }, photoIntroMilliseconds);
    const url = new URL(goal.page.replace(/^\//, ""), staticRoot);
    url.searchParams.set("eimei-preview", "1");
    iframe.addEventListener("load", () => {
      positionPhotoMarker();
      window.setTimeout(positionPhotoMarker, 180);
      window.setTimeout(positionPhotoMarker, 600);
    });
    iframe.src = url.href;
    sizePhoto();
  }

  function togglePhoto() {
    if (!race.photo) return;
    if (race.photo.root.classList.contains("is-intro")) return;
    race.photo.root.classList.toggle("is-expanded");
    sizePhoto();
  }

  function updateCountdown() {
    const room = race.room;
    const remaining = room?.startAt ? room.startAt - serverNow() : 0;
    if (room?.phase !== "countdown" || remaining <= 0) {
      if (race.photo?.root.classList.contains("is-intro")) {
        race.photo.root.classList.remove("is-intro");
        sizePhoto();
      }
      race.countdown?.remove();
      race.countdown = null;
      window.EimeiMap?.setRaceFrozen?.(false);
      return;
    }
    const showingPhoto = Boolean(race.photo && performance.now() < race.photo.introUntil);
    if (race.photo) {
      const changed = race.photo.root.classList.toggle("is-intro", showingPhoto);
      if (changed) sizePhoto();
    }
    if (showingPhoto) {
      race.countdown?.remove();
      race.countdown = null;
      window.EimeiMap?.setRaceFrozen?.(true);
      return;
    }
    if (!race.countdown) {
      race.countdown = document.createElement("div");
      race.countdown.className = "eimei-race-countdown";
      document.documentElement.append(race.countdown);
    }
    race.countdown.textContent = String(Math.max(1, Math.ceil(remaining / 1000)));
    window.EimeiMap?.setRaceFrozen?.(true);
  }

  function tick() {
    if (!race.room) return;
    if (!isArena) {
      updateRaceHud();
      updateHints();
      updateCountdown();
      expireGhosts();
      if (window.EimeiMap?.race?.finishPending && race.room.phase !== "finished") {
        reportFinish({ detail: { page: pageIdentity() } });
      }
    }
  }

  function sendPosition() {
    const map = window.EimeiMap;
    const room = race.room;
    if (!map?.race?.active || !room?.roundId || room.phase === "finished") return;
    const width = Math.max(1, map.state.documentWidth);
    const height = Math.max(1, map.state.documentHeight);
    const message = {
      type: "position",
      roundId: room.roundId,
      page: pageIdentity(),
      x: (map.player.x + map.player.width * .5) / width,
      y: (map.player.y + map.player.height) / height,
      facing: map.player.facing
    };
    if (map.web.active && map.web.remotePlayerId) message.grappleTargetId = map.web.remotePlayerId;
    send(message);
  }

  function updateGhost(message) {
    if (isArena || message.roundId !== race.room?.roundId || message.playerId === race.playerId) return;
    if (message.page !== pageIdentity()) {
      race.ghosts.get(message.playerId)?.root.remove();
      race.ghosts.delete(message.playerId);
      window.EimeiMap?.removeRaceRemotePlayer?.(message.playerId);
      return;
    }
    const map = window.EimeiMap;
    if (!map?.race?.active) return;
    let ghost = race.ghosts.get(message.playerId);
    if (!ghost) {
      const root = document.createElement("div");
      root.className = "eimei-race-ghost";
      const name = race.room.players.find((player) => player.id === message.playerId)?.nickname || "PLAYER";
      root.innerHTML = `<span class="eimei-race-ghost-name"></span>`;
      root.querySelector(".eimei-race-ghost-name").textContent = name;
      root.style.setProperty("--race-player-color", paletteFor(
        race.room.players.find((player) => player.id === message.playerId)
      ).primary);
      document.documentElement.append(root);
      ghost = { root, lastAt: 0 };
      race.ghosts.set(message.playerId, ghost);
    }
    ghost.lastAt = performance.now();
    const remoteX = Number(message.x) * map.state.documentWidth;
    const remoteY = Number(message.y) * map.state.documentHeight - map.player.height * .55;
    const remoteLeft = remoteX - map.player.width * .5;
    const remoteTop = Number(message.y) * map.state.documentHeight - map.player.height;
    const localCenterX = map.player.x + map.player.width * .5;
    const localFeetY = map.player.y + map.player.height;
    const overlapsLocal = Math.abs(remoteX - localCenterX) < map.player.width * 1.15 &&
      Math.abs(Number(message.y) * map.state.documentHeight - localFeetY) < map.player.height * .8;
    const remotePlayer = race.room.players.find((player) => player.id === message.playerId);
    const colorIndex = Number(remotePlayer?.colorIndex) || 0;
    const overlapDirection = colorIndex % 2 === 0 ? -1 : 1;
    const overlapOffset = overlapsLocal ? overlapDirection * (20 + Math.floor(colorIndex / 2) * 3) : 0;
    ghost.root.classList.toggle("is-overlapping", overlapsLocal);
    ghost.root.style.setProperty("--race-overlap-offset", `${overlapOffset}px`);
    ghost.root.style.left = `${remoteLeft}px`;
    ghost.root.style.top = `${remoteTop}px`;
    map.setRaceRemotePlayer?.({
      id: message.playerId,
      x: remoteX,
      y: remoteY,
      facing: message.facing,
      visualOffsetX: overlapOffset,
      palette: paletteFor(race.room.players.find((player) => player.id === message.playerId))
    });
  }

  function applyRemoteGrapple(message) {
    if (
      isArena ||
      message.roundId !== race.room?.roundId ||
      message.targetPlayerId !== race.playerId ||
      message.page !== pageIdentity()
    ) return;
    const map = window.EimeiMap;
    if (!map?.race?.active) return;
    race.lastGrappleMessage = message;
    map.applyRaceGrapple?.({
      attackerId: message.attackerId,
      x: Number(message.x) * map.state.documentWidth,
      y: Number(message.y) * map.state.documentHeight - map.player.height * .55,
      palette: paletteFor(race.room.players.find((player) => player.id === message.attackerId))
    });
  }

  function expireGhosts() {
    const now = performance.now();
    for (const [id, ghost] of race.ghosts) {
      if (now - ghost.lastAt <= 2200) continue;
      ghost.root.remove();
      race.ghosts.delete(id);
      window.EimeiMap?.removeRaceRemotePlayer?.(id);
    }
  }

  function showResult() {
    if (race.result || !race.room) return;
    const winner = race.room.players.find((player) => player.id === race.room.winnerId);
    const roundPlayerIds = new Set(race.room.roundPlayerIds || []);
    const participants = race.room.players
      .filter((player) => roundPlayerIds.size === 0
        ? player.connected || player.currentPage || player.id === race.room.winnerId
        : roundPlayerIds.has(player.id))
      .toSorted((first, second) =>
        Number(second.id === race.room.winnerId) - Number(first.id === race.room.winnerId) ||
        (Number(second.points) || 0) - (Number(first.points) || 0) ||
        first.joinedAt - second.joinedAt
      );
    const root = document.createElement("div");
    root.className = "eimei-race-result";
    root.innerHTML = `<section class="eimei-race-result-card"><p class="eimei-race-result-kicker">RACE RESULT</p><h2></h2><p class="eimei-race-result-summary">この部屋の通算ポイント</p><div class="eimei-race-result-players"></div><button type="button">待機室へ戻る</button></section>`;
    root.querySelector("h2").textContent = `${winner?.nickname || "PLAYER"} の勝利`;
    const playerGrid = root.querySelector(".eimei-race-result-players");
    playerGrid.replaceChildren(...participants.map((participant) => {
      const palette = paletteFor(participant);
      const card = document.createElement("article");
      card.className = "eimei-race-result-player";
      card.classList.toggle("is-winner", participant.id === race.room.winnerId);
      card.classList.toggle("is-self", participant.id === race.playerId);
      card.style.setProperty("--race-player-color", palette.primary);
      card.style.setProperty("--race-player-visor", palette.visor);
      card.style.setProperty("--race-player-accent", palette.accent);
      card.innerHTML = `<span class="eimei-race-result-player-avatar" aria-hidden="true"></span><span class="eimei-race-result-player-copy"><span class="eimei-race-result-player-name"></span><span class="eimei-race-result-player-state"></span></span><span class="eimei-race-result-player-points"><strong></strong><span>PT</span></span>`;
      card.querySelector(".eimei-race-result-player-name").textContent = participant.nickname;
      card.querySelector(".eimei-race-result-player-state").textContent = participant.id === race.room.winnerId
        ? "WINNER"
        : participant.id === race.playerId ? "YOU" : "CHALLENGER";
      card.querySelector("strong").textContent = String(Math.max(0, Number.parseInt(participant.points, 10) || 0));
      return card;
    }));
    root.querySelector("button").addEventListener("click", () => location.assign(arenaRoomUrl().href));
    document.documentElement.append(root);
    race.result = root;
    window.setTimeout(() => root.querySelector("button")?.focus(), 100);
  }

  function reportFinish(event) {
    if (!race.room?.roundId || race.room.phase === "finished") return;
    const now = performance.now();
    if (race.finishSentRoundId === race.room.roundId && now - race.finishLastSentAt < 900) return;
    if (send({ type: "finish", roundId: race.room.roundId, page: event.detail?.page || pageIdentity() })) {
      race.finishSentRoundId = race.room.roundId;
      race.finishLastSentAt = now;
    }
  }

  function installArenaActions() {
    document.querySelector("[data-race-copy]")?.addEventListener("click", async (event) => {
      const text = arenaRoomUrl().href;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.append(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      event.currentTarget.textContent = "コピーしました";
      window.setTimeout(() => { event.currentTarget.textContent = "招待URLをコピー"; }, 1400);
    });
    document.querySelector("[data-race-ready]")?.addEventListener("click", () => send({ type: "ready", ready: !currentPlayer()?.ready }));
    document.querySelector("[data-race-start]")?.addEventListener("click", () => send({ type: "start" }));
    document.querySelector("[data-race-change-name]")?.addEventListener("click", () => showProfileEditor({ force: true }));
  }

  function boot() {
    if (!ensureRoomCode()) return;
    ensurePlayerId();
    if (isArena) {
      document.querySelector("[data-race-room-code]").textContent = race.roomCode;
      installArenaActions();
    }
    window.addEventListener("eimei-race-finish", reportFinish);
    window.addEventListener("eimei-race-route-missing", () => {
      race.navigationCourseKey = null;
      ensureFinalNavigation();
    });
    window.addEventListener("eimei-portal-warm", (event) => warmUrl(event.detail?.href));
    window.addEventListener("eimei-portal-entering", cancelWarmRequests);
    window.addEventListener("resize", sizePhoto);
    window.addEventListener("keydown", (event) => {
      if (event.code !== "KeyC" || event.repeat || event.target instanceof HTMLInputElement) return;
      togglePhoto();
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    const stored = normalizeNickname(localStorage.getItem(nicknameStorageKey));
    if (stored) {
      race.nickname = stored;
      connect();
    } else {
      showProfileEditor();
    }
  }

  race.sendPosition = sendPosition;
  race.updateHints = updateHints;
  window.EimeiRace = race;
  boot();
})();
