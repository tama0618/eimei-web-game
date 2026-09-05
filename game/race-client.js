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
  const privateHintStorageKey = "eimei-race-private-hints-v1";
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
    navigationRetryAt: 0,
    photo: null,
    hud: null,
    hudKey: null,
    hints: null,
    hintKey: null,
    privateHints: [],
    privateHintRoot: null,
    privateHintRoundId: null,
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
    return /^[A-Z2-9]{6}$/.test(race.roomCode);
  }

  function normalizeRoomCode(value) {
    const normalized = String(value ?? "")
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[\s-]+/gu, "");
    return /^[A-Z2-9]{6}$/.test(normalized) ? normalized : null;
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
    if (message.type === "wisp_hint") {
      receivePrivateHint(message);
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
          recentGoalIds: race.room.recentGoalIds || [],
          recentGoalCategories: race.room.recentGoalCategories || []
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
    window.EimeiMap?.setRaceWispClaims?.(room.claimedWispIds || []);
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
      list.replaceChildren(...connectedPlayers.map((player) => {
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
        state.textContent = player.ready ? "READY" : "WAIT";
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
      const everyoneReady = connectedPlayers.length >= 1 && connectedPlayers.every((player) => player.ready);
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

  function stableTextHash(value) {
    const text = String(value ?? "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function shuffled(values, random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function raceWispPages(playable, course, count = 8) {
    const random = seededRandom(stableTextHash(`${course.id}|${course.seed}|site-wide-wisps`));
    const eligible = playable.filter((page) => page.page !== course.goal.page);
    const buckets = new Map();
    for (const page of eligible) {
      const category = categoryKeyFor(page.page);
      if (!buckets.has(category)) buckets.set(category, []);
      buckets.get(category).push(page.page);
    }

    const selected = [];
    const selectedSet = new Set();
    for (const category of shuffled([...buckets.keys()], random)) {
      const page = shuffled(buckets.get(category), random)[0];
      if (!page || selectedSet.has(page)) continue;
      selected.push(page);
      selectedSet.add(page);
      if (selected.length === count) return selected;
    }

    for (const page of shuffled(eligible.map((candidate) => candidate.page), random)) {
      if (selectedSet.has(page)) continue;
      selected.push(page);
      selectedSet.add(page);
      if (selected.length === count) break;
    }
    return selected;
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

  function canonicalEntryForGoal(goal) {
    const goalPage = String(typeof goal === "string" ? goal : goal?.page || "");
    const parts = goalPage.split("/").filter(Boolean);
    if (parts[0] !== "info-course") return null;
    const section = parts[1] || "";
    const filename = parts.at(-1) || "";
    const entries = [
      ["/info-course/course/three-years.html", "3年間の学び方"],
      ["/info-course/story/admissions.html", "受験前に知っておきたいこと"],
      ["/info-course/course/common-learning.html", "授業・科目"],
      ["/info-course/course/system.html", "情報システム系"],
      ["/info-course/course/creative.html", "情報クリエイト系"],
      ["/info-course/campus/classrooms.html", "情報教室と授業支援"],
      ["/info-course/campus/tools.html", "制作・開発環境"],
      ["/info-course/campus/certifications.html", "資格・検定"],
      ["/info-course/campus/competitions.html", "大会・作品発表"],
      ["/info-course/future/voices.html", "在校生・卒業生の声"],
      ["/info-course/future/universities.html", "大学・短期大学への進学"],
      ["/info-course/future/vocational.html", "専門学校・職業教育への進学"],
      ["/info-course/future/employment.html", "就職と業界理解"],
      ["/info-course/story/history.html", "歩み"],
      ["/info-course/news/news.html", "過去のニュース"]
    ];
    const result = (page) => {
      const entry = entries.find(([candidate]) => candidate === page);
      return entry ? { page: entry[0], label: entry[1] } : null;
    };
    const exact = result(goalPage);
    if (exact) return exact;

    // A destination can be linked from several overview pages. Give every
    // destination one canonical entrance so route guidance and text hints can
    // never disagree merely because BFS found a different cross-link first.
    if (section === "news") return result("/info-course/news/news.html");
    if (section === "history") return result("/info-course/story/history.html");
    if (section === "admissions") return result("/info-course/story/admissions.html");
    if (section === "about") {
      if (filename === "system-track.html") return result("/info-course/course/system.html");
      if (filename === "creative-track.html") return result("/info-course/course/creative.html");
      return result("/info-course/course/three-years.html");
    }
    if (section === "learning") {
      if (new Set([
        "c-language.html", "java.html", "algorithms.html", "system-programming.html",
        "system-design.html", "database.html", "robot-programming.html"
      ]).has(filename)) return result("/info-course/course/system.html");
      if (new Set([
        "media-service.html", "web-production.html", "content-development.html",
        "information-design.html", "dtp.html", "three-d-graphics.html"
      ]).has(filename)) return result("/info-course/course/creative.html");
      return result("/info-course/course/common-learning.html");
    }
    if (section === "environment") {
      if (new Set([
        "two-rooms.html", "mm-room.html", "first-room.html", "intermediate-monitors.html"
      ]).has(filename)) return result("/info-course/campus/classrooms.html");
      return result("/info-course/campus/tools.html");
    }
    if (section === "qualifications") {
      if (new Set([
        "pc-koshien.html", "design-awards.html", "processing-championship.html"
      ]).has(filename)) return result("/info-course/campus/competitions.html");
      return result("/info-course/campus/certifications.html");
    }
    if (section === "career") {
      if (filename === "student-voices.html") return result("/info-course/future/voices.html");
      if (new Set([
        "universities.html", "junior-college.html", "destination-list.html", "choosing-next-step.html"
      ]).has(filename)) return result("/info-course/future/universities.html");
      if (new Set([
        "vocational.html", "game-field.html", "web-design.html", "creator.html"
      ]).has(filename)) return result("/info-course/future/vocational.html");
      return result("/info-course/future/employment.html");
    }
    return null;
  }

  function canonicalRoute(pageMap, start, goal, maximumDepth = 8) {
    if (start === goal) return [start];
    const entry = canonicalEntryForGoal(goal);
    if (entry && entry.page !== goal && pageMap.get(entry.page)?.links?.includes(goal)) {
      const routeToEntry = shortestRoute(pageMap, start, entry.page, maximumDepth - 1);
      const route = routeToEntry.length > 0 ? [...routeToEntry, goal] : [];
      if (route.length >= 2 && route.length <= maximumDepth) return route;
    }
    return shortestRoute(pageMap, start, goal, maximumDepth);
  }

  function categoryKeyFor(page) {
    const parts = page.split("/").filter(Boolean);
    if (parts[0] === "info-course") {
      return parts[1] && parts[1] !== "index.html" ? parts[1] : "about";
    }
    return parts[0] || "index";
  }

  function categoryFor(page) {
    const segment = categoryKeyFor(page);
    return ({
      information: "学校案内",
      news: "ニュース",
      club: "部活動",
      career: "進路",
      openschool: "入試・オープンスクール",
      entrance: "入試案内",
      schedule: "行事予定",
      payment: "在校生向け情報",
      proxy: "証明書案内",
      meiyu: "卒業生向け情報",
      restaurant: "英明レストラン",
      correspondencecourse: "通信制課程",
      about: "情報コース",
      learning: "学び",
      environment: "学習環境",
      qualifications: "資格・実績",
      activities: "活動記録",
      history: "コース史",
      "index.html": "学校トップ",
      "copyright.html": "サイト案内",
      "recruit.html": "採用情報",
      "recruit_r4t.html": "採用情報",
      "recruit_r6.html": "採用情報"
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

  async function provideCourse({ seed, recentGoalIds = [], recentGoalCategories = [] }) {
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
        .filter((page) => !page.page.endsWith("/index.html") && page.targets.length > 0 && page.height >= 420);
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
        const routePages = canonicalRoute(pageMap, startPage.page, goalPage.page);
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
          start: {
            ...start,
            page: startPage.page,
            title: startPage.title,
            pageWidth: startPage.width,
            pageHeight: startPage.height
          },
          goal: {
            ...goal,
            page: goalPage.page,
            title: goalPage.title,
            pageWidth: goalPage.width,
            pageHeight: goalPage.height
          },
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
      const recentlyUsedCategories = new Set(recentGoalCategories.slice(-3));
      const freshCategoryCandidates = balancedCandidates.filter((candidate) =>
        !recentlyUsedCategories.has(categoryKeyFor(candidate.goal.page))
      );
      const drawPool = freshCategoryCandidates.length > 0 ? freshCategoryCandidates : balancedCandidates;
      const selected = drawPool[Math.floor(random() * drawPool.length)] || null;
      if (!selected) throw new Error("no_course");
      selected.wispPages = raceWispPages(playable, selected);
      if (selected.wispPages.length !== 8 || new Set(selected.wispPages).size !== 8) {
        throw new Error("no_wisp_pages");
      }
      send({ type: "course", course: selected });
    } catch (error) {
      race.lastError = error.message;
      if (race.courseRetryCount < 3) {
        race.courseRetryCount += 1;
        setArenaStatus("目的地を再抽選しています");
        window.setTimeout(() => provideCourse({
          seed: Number(seed) + race.courseRetryCount * 0x9e3779b1,
          recentGoalIds,
          recentGoalCategories
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

  function arenaRoomUrl() {
    const target = new URL(arenaUrl.href);
    if (ensureRoomCode()) target.searchParams.set("room", race.roomCode);
    return target;
  }

  function hintStage(room = race.room) {
    if (!room?.startAt) return 0;
    const elapsed = Math.max(0, serverNow() - room.startAt);
    if (elapsed >= (Number(config.navigationHintMilliseconds) || 240000)) return 4;
    if (elapsed >= (Number(config.contextHintMilliseconds) || 180000)) return 3;
    if (elapsed >= (Number(config.titleHintMilliseconds) || 135000)) return 2;
    if (elapsed >= (Number(config.categoryHintMilliseconds) || 90000)) return 1;
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
    map.setRaceWispClaims?.(room.claimedWispIds || []);
    loadPrivateHints(room.roundId);
    race.navigationCourseKey = stage >= 4 && finalGuideReady(map)
      ? `${room.roundId}:${currentPage}`
      : null;
    if (stage < 4 || finalGuideReady(map)) race.navigationRetryAt = 0;
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
      const routePages = canonicalRoute(pageMap, currentPage, course.goal.page, 12);
      return routePages.length >= 2 ? { ...course, routePages } : course;
    } catch {
      return course;
    }
  }

  function finalGuideReady(map = window.EimeiMap) {
    return Boolean(
      map?.race?.configured &&
      map.race.navigationEnabled &&
      map.mission?.guideBody &&
      map.mission.guidePoint &&
      map.state?.bodies?.includes(map.mission.guideBody)
    );
  }

  function ensureFinalNavigation() {
    const room = race.room;
    if (!room?.course || isArena || hintStage(room) < 4) return;
    const key = `${room.roundId}:${pageIdentity()}`;
    const map = window.EimeiMap;
    if (finalGuideReady(map)) {
      race.navigationCourseKey = key;
      race.navigationRetryAt = 0;
      return;
    }
    map?.setRaceNavigationEnabled?.(true);
    if (finalGuideReady(map)) {
      race.navigationCourseKey = key;
      race.navigationRetryAt = 0;
      return;
    }
    const now = performance.now();
    if (race.navigationCoursePromise || now < race.navigationRetryAt) return;
    race.navigationRetryAt = now + 800;
    race.navigationCourseKey = null;
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
      .then(() => {
        race.navigationCourseKey = finalGuideReady() ? key : null;
        if (race.navigationCourseKey) race.navigationRetryAt = 0;
      })
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
    if (stage >= 1 && !race.catalogData) {
      loadCatalog().then(() => {
        race.hintKey = null;
        updateHints();
      }).catch(() => {});
    }
    let label = "手掛かり 0 / 3";
    let value = "写真のみ｜時間経過でヒント解禁";
    if (stage === 1) {
      label = "手掛かり 1 / 3　三択";
      const choices = firstHintChoices(goal, race.room.course);
      value = `入口候補　① ${choices[0]}　② ${choices[1]}　③ ${choices[2]}`;
    } else if (stage === 2) {
      label = "手掛かり 2 / 3　三択の答え";
      value = `正解は「${topMenuAreaHint(goal)}」`;
    } else if (stage === 3) {
      label = "手掛かり 3 / 3　次の一手";
      value = routeOrPositionHint(goal);
    } else if (stage >= 4) {
      label = "FINAL GUIDE　ナビ解禁";
      value = "黄色い光をたどって旗へ";
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

  function catalogGoalGeometry(goal) {
    const page = race.catalogData?.pages?.find((candidate) => candidate.page === goal.page);
    const target = page?.targets?.find((candidate) => candidate.id === goal.id) || goal;
    const width = Math.max(1, Number(page?.width) || Number(target?.pageWidth) || Number(target?.x) * 2 || 1);
    const height = Math.max(1, Number(page?.height) || Number(target?.pageHeight) || Number(target?.y) * 2 || 1);
    const x = Math.max(0, Math.min(width, Number(target?.x) || 0));
    const y = Math.max(0, Math.min(height, Number(target?.y) || 0));
    return { page, target, width, height, x, y, xRatio: x / width, yRatio: y / height };
  }

  function topMenuAreaHint(goal) {
    const parts = String(goal.page || "").split("/").filter(Boolean);
    const section = parts[1] || "";
    const filename = parts.at(-1) || "";
    const goalCopy = `${goal.label || ""} ${goal.context || ""}`;
    const canonicalEntry = canonicalEntryForGoal(goal);
    const canonicalLabel = canonicalEntry?.label || "";
    if (canonicalLabel === "授業・科目" || section === "learning" || (section === "course" && filename === "common-learning.html")) {
      return "授業・科目";
    }
    if (/^(?:情報システム系|情報クリエイト系)$/u.test(canonicalLabel) || (section === "course" && /^(?:system|creative)\.html?$/i.test(filename))) return "2つの系";
    if (/^(?:情報教室と授業支援|制作・開発環境)$/u.test(canonicalLabel) || section === "environment" || (section === "campus" && /^(?:classrooms|tools)\.html?$/i.test(filename))) {
      return "学習環境";
    }
    if (
      /^(?:資格・検定|大会・作品発表)$/u.test(canonicalLabel) ||
      section === "qualifications" ||
      (section === "campus" && /^(?:certifications|competitions)\.html?$/i.test(filename)) ||
      (section === "campus" && /(?:資格・検定|大会・作品発表)/u.test(goalCopy))
    ) {
      return "資格・実績";
    }
    if (/^(?:在校生・卒業生の声|大学・短期大学への進学|専門学校・職業教育への進学|就職と業界理解)$/u.test(canonicalLabel) || section === "future" || section === "career") return "進路・卒業生";
    if (canonicalLabel === "歩み" || section === "history" || (section === "story" && filename === "history.html")) return "歩み";
    if (canonicalLabel === "過去のニュース" || section === "news") return "過去のニュース";
    return "情報コース";
  }

  function firstHintChoices(goal, course = race.room?.course) {
    const answer = topMenuAreaHint(goal);
    const options = [
      "情報コース", "授業・科目", "2つの系", "学習環境",
      "資格・実績", "進路・卒業生", "歩み", "過去のニュース"
    ];
    const random = seededRandom(stableTextHash(
      `${course?.id || ""}|${course?.seed || ""}|${goal?.id || goal?.page || ""}|first-hint-three-choice`
    ));
    const decoys = shuffled(options.filter((option) => option !== answer), random).slice(0, 2);
    return shuffled([answer, ...decoys], random);
  }

  function goalPageTitle(goal) {
    const { page, target } = catalogGoalGeometry(goal);
    return String(page?.title || target?.title || "")
      .replace(/\s*[-｜|]\s*英明高等学校(?:\s+情報コース)?\s*$/u, "")
      .trim();
  }

  function tabPositionHint(goal) {
    const { xRatio, yRatio } = catalogGoalGeometry(goal);
    const vertical = yRatio < .34 ? "上の方" : yRatio < .7 ? "中央付近" : "下の方";
    const horizontal = xRatio < .34 ? "左寄り" : xRatio < .67 ? "中央寄り" : "右寄り";
    return `そのタブの${vertical}・${horizontal}`;
  }

  function routeOrPositionHint(goal) {
    const topMenu = topMenuAreaHint(goal);
    const entry = canonicalEntryForGoal(goal);
    const portalNames = [];
    if (entry?.label && entry.label !== topMenu) portalNames.push(entry.label);
    if (entry?.page && entry.page !== String(goal.page || "")) {
      const destinationName = goalPageTitle(goal);
      if (destinationName && destinationName !== topMenu && !portalNames.includes(destinationName)) {
        portalNames.push(destinationName);
      }
    }
    if (portalNames.length > 0) {
      return `派生ポータル　${portalNames.map((name) => `「${name}」`).join("→")}`;
    }
    return tabPositionHint(goal);
  }

  function privateHintChoices(goal) {
    const { xRatio, yRatio, y } = catalogGoalGeometry(goal);
    const verticalHalf = yRatio < .5 ? "上半分" : "下半分";
    const horizontalThird = xRatio < 1 / 3 ? "左側" : xRatio < 2 / 3 ? "中央付近" : "右側";
    const verticalThird = Math.min(3, Math.floor(yRatio * 3) + 1);
    const horizontalQuarter = Math.min(4, Math.floor(xRatio * 4) + 1);
    const verticalPercent = Math.max(5, Math.min(95, Math.round(yRatio * 20) * 5));
    const horizontalPercent = Math.max(5, Math.min(95, Math.round(xRatio * 20) * 5));
    const screenDistance = Math.max(.5, Math.round((y / Math.max(560, window.innerHeight || 720)) * 2) / 2);
    return [
      `旗はページの${verticalHalf}にある`,
      `旗はページ幅の${horizontalThird}にある`,
      `上から3分割すると、第${verticalThird}区画に旗がある`,
      `左から4分割すると、第${horizontalQuarter}区画に旗がある`,
      `旗の高さは上端から約${verticalPercent}%地点`,
      `旗の横位置は左端から約${horizontalPercent}%地点`,
      `ページ上端から約${screenDistance}画面ぶん下に旗がある`,
      `旗は上から約${verticalPercent}%・左から約${horizontalPercent}%付近`
    ];
  }

  function isPositionPrivateHintText(value) {
    return /^(?:旗はページの|旗はページ幅の|上から3分割すると|左から4分割すると|旗の高さは|旗の横位置は|ページ上端から)/u.test(String(value || ""));
  }

  function loadPrivateHints(roundId) {
    if (race.privateHintRoundId === roundId) return;
    race.privateHintRoundId = roundId;
    race.privateHints = [];
    try {
      const stored = JSON.parse(sessionStorage.getItem(privateHintStorageKey) || "null");
      if (stored?.roundId === roundId && Array.isArray(stored.hints)) {
        race.privateHints = stored.hints
          .filter((hint) =>
            hint &&
            typeof hint.wispId === "string" &&
            typeof hint.text === "string" &&
            isPositionPrivateHintText(hint.text)
          )
          .slice(-8);
      }
    } catch {
      sessionStorage.removeItem(privateHintStorageKey);
    }
    renderPrivateHints(false);
  }

  function savePrivateHints() {
    if (!race.privateHintRoundId) return;
    sessionStorage.setItem(privateHintStorageKey, JSON.stringify({
      roundId: race.privateHintRoundId,
      hints: race.privateHints.slice(-8)
    }));
  }

  function ensurePrivateHintPanel() {
    if (race.privateHintRoot?.isConnected) return race.privateHintRoot;
    const root = document.createElement("aside");
    root.className = "eimei-race-private-hints";
    root.hidden = true;
    root.setAttribute("aria-live", "polite");
    root.innerHTML = `<p><span>BLUE HAZE</span> 自分だけの位置情報</p><ol></ol>`;
    document.documentElement.append(root);
    race.privateHintRoot = root;
    return root;
  }

  function renderPrivateHints(animate = false) {
    const root = ensurePrivateHintPanel();
    root.hidden = race.privateHints.length === 0;
    const list = root.querySelector("ol");
    list.replaceChildren(...race.privateHints.map((hint, index) => {
      const item = document.createElement("li");
      item.textContent = hint.text;
      item.classList.toggle("is-latest", animate && index === race.privateHints.length - 1);
      return item;
    }));
    if (animate && race.privateHints.length > 0) {
      root.classList.remove("is-updated");
      void root.offsetWidth;
      root.classList.add("is-updated");
    }
  }

  async function receivePrivateHint(message) {
    if (!race.room?.course?.goal || message.roundId !== race.room.roundId) return;
    loadPrivateHints(message.roundId);
    if (race.privateHints.some((hint) => hint.wispId === message.wispId)) return;
    const choices = privateHintChoices(race.room.course.goal);
    const hintNumber = Math.max(1, Number.parseInt(message.hintNumber, 10) || 1);
    race.privateHints.push({
      wispId: String(message.wispId || ""),
      text: choices[(hintNumber - 1) % choices.length]
    });
    race.privateHints = race.privateHints.slice(-8);
    savePrivateHints();
    renderPrivateHints(true);
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

  function positionPhotoMarker(photo = race.photo) {
    if (!photo?.iframe.contentWindow || !photo.iframe.contentDocument) return;
    const view = photo.iframe.contentWindow;
    try {
      const previewDocument = photo.iframe.contentDocument;
      previewDocument.documentElement.style.setProperty("scroll-behavior", "auto", "important");
      previewDocument.body?.style.setProperty("scroll-behavior", "auto", "important");
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
      view.scrollTo({ left: targetX, top: targetY, behavior: "auto" });
      photo.marker.style.left = `${Math.max(10, Math.min(photo.viewWidth - 10, goalX - view.scrollX)) * photo.scale}px`;
      photo.marker.style.top = `${Math.max(20, Math.min(photo.viewHeight - 10, goalY - view.scrollY)) * photo.scale}px`;
      photo.marker.hidden = false;
      return {
        goalX,
        goalY,
        targetX,
        targetY,
        scrollX: view.scrollX,
        scrollY: view.scrollY
      };
    } catch {
      // The mirrored preview is same-origin; keep the frame usable if it is still loading.
      return null;
    }
  }

  function prepareRacePhoto(photo) {
    window.clearTimeout(photo?.preparationTimer);
    const startedAt = performance.now();
    let previousSignature = "";
    let stablePasses = 0;
    const settle = () => {
      if (race.photo !== photo) return;
      const position = positionPhotoMarker(photo);
      const signature = position
        ? [position.goalX, position.goalY, position.targetX, position.targetY, position.scrollX, position.scrollY]
          .map((value) => Math.round(value))
          .join(":")
        : "";
      stablePasses = signature && signature === previousSignature ? stablePasses + 1 : 0;
      previousSignature = signature;
      const elapsed = performance.now() - startedAt;
      if ((stablePasses >= 2 && elapsed >= 360) || elapsed >= 1200) {
        positionPhotoMarker(photo);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (race.photo !== photo) return;
          positionPhotoMarker(photo);
          photo.prepared = true;
          photo.root.classList.remove("is-preparing");
        }));
        return;
      }
      photo.preparationTimer = window.setTimeout(settle, 90);
    };
    settle();
  }

  function ensureRacePhoto(goal) {
    if (race.photo?.goal.id === goal.id && race.photo.roundId === race.room?.roundId) return;
    window.clearTimeout(race.photo?.introTimer);
    window.clearTimeout(race.photo?.preparationTimer);
    race.photo?.root.remove();
    const root = document.createElement("div");
    root.className = "eimei-race-photo is-intro is-preparing";
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
      introTimer: 0,
      preparationTimer: 0,
      prepared: false
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
      prepareRacePhoto(currentPhoto);
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

  function unit(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function traversalAction(map, width, height) {
    const pack = (kind, phase, elapsed, duration, extra = {}) => ({
      kind,
      phase,
      progress: unit(Number(elapsed) / Math.max(0.01, Number(duration) || 0.01)),
      duration: Math.max(0.01, Math.min(3, Number(duration) || 0.01)),
      ...extra
    });
    const surface = (topY, bottomY, centerX, actionWidth) => ({
      topY: unit(Number(topY) / height),
      bottomY: unit(Number(bottomY) / height),
      centerX: unit(Number(centerX) / width),
      width: unit(Number(actionWidth) / width)
    });

    if (map.grappleInterruption?.phase === "staggering") {
      return pack(
        "grapple-fail",
        "staggering",
        map.grappleInterruption.time,
        map.config.raceGrappleInterruptionSeconds,
        { side: map.grappleInterruption.directionX < 0 ? -1 : 1 }
      );
    }

    if (map.web.hatchPhase !== "none") {
      const phase = map.web.hatchPhase;
      const duration = phase === "opening"
        ? 0.46
        : phase === "entering"
          ? map.web.hatchEntryDuration
          : phase === "traversing"
            ? map.web.hatchTraverseDuration
            : map.web.hatchPassageDuration;
      return pack("web-hatch", phase, map.web.hatchTime, duration, surface(
        map.web.hatchTopY,
        map.web.hatchBottomY,
        map.web.hatchCenterX,
        map.web.hatchWidth
      ));
    }

    if (map.dropHatch.phase !== "none") {
      const phase = map.dropHatch.phase;
      const duration = phase === "kicking"
        ? map.config.dropHatchKickSeconds
        : phase === "readying"
          ? map.config.dropHatchReadySeconds
          : phase === "jumping"
            ? map.config.dropHatchJumpSeconds
            : phase === "diving"
              ? map.config.dropHatchDiveSeconds
              : phase === "traversing"
                ? map.dropHatch.traverseDuration
                : map.config.dropHatchBurstSeconds;
      return pack("drop-hatch", phase, map.dropHatch.time, duration, {
        ...surface(map.dropHatch.topY, map.dropHatch.bottomY, map.dropHatch.centerX, map.dropHatch.width),
        side: map.player.facing < 0 ? -1 : 1
      });
    }

    if (map.ladderTraversal.phase !== "none") {
      const phase = map.ladderTraversal.phase;
      const ladder = map.ladderTraversal.ladder;
      const duration = phase === "gripping"
        ? map.config.ladderGripSeconds
        : phase === "threading"
          ? map.config.ladderThreadSeconds
          : phase === "burrowing"
            ? map.config.ladderTraverseSeconds
            : phase === "rolling"
              ? map.config.ladderRollSeconds
              : 3;
      return pack("ladder", phase, phase === "climbing" ? 0 : map.ladderTraversal.time, duration, {
        topY: unit(Number(ladder?.topY) / height),
        bottomY: unit(Number(ladder?.bottomY) / height),
        cycle: Math.max(-1, Math.min(1, Math.sin(Number(map.ladderTraversal.climbCycle) || 0)))
      });
    }

    if (map.web.mantlePhase !== "none") {
      const phase = map.web.mantlePhase;
      const duration = phase === "approaching"
        ? map.config.webMantleApproachSeconds
        : map.config.webMantleVaultSeconds;
      return pack("mantle", phase, map.web.mantleTime, duration, {
        side: map.web.mantleSide < 0 ? -1 : 1
      });
    }

    if (map.interaction.portal?.entering) {
      return pack("portal", "entering", map.interaction.portal.enterProgress, 1);
    }

    const airJumpElapsed = performance.now() / 1000 - Number(map.player.airJumpAt);
    if (Number.isFinite(airJumpElapsed) && airJumpElapsed >= 0 && airJumpElapsed < map.config.airJumpSpinSeconds) {
      return pack("air-jump", "spinning", airJumpElapsed, map.config.airJumpSpinSeconds, {
        side: map.player.facing < 0 ? -1 : 1
      });
    }
    return null;
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
    if (map.web.active && Number.isFinite(map.web.anchorX + map.web.anchorY)) {
      message.web = {
        x: unit(map.web.anchorX / width),
        y: unit(map.web.anchorY / height)
      };
    }
    message.action = traversalAction(map, width, height);
    if (map.web.active && map.web.remotePlayerId) {
      message.grappleTargetId = map.web.remotePlayerId;
      message.grappleLength = unit(map.web.length / Math.max(width, height));
    }
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
    ghost.root.classList.toggle("is-traversing", Boolean(
      message.action && (
        (message.action.kind === "web-hatch" && message.action.phase === "traversing") ||
        (message.action.kind === "drop-hatch" && message.action.phase === "traversing") ||
        (message.action.kind === "ladder" && message.action.phase === "burrowing")
      )
    ));
    ghost.root.style.setProperty("--race-overlap-offset", `${overlapOffset}px`);
    ghost.root.style.left = `${remoteLeft}px`;
    ghost.root.style.top = `${remoteTop}px`;
    map.setRaceRemotePlayer?.({
      id: message.playerId,
      x: remoteX,
      y: remoteY,
      facing: message.facing,
      visualOffsetX: overlapOffset,
      palette: paletteFor(race.room.players.find((player) => player.id === message.playerId)),
      web: message.web ? {
        x: Number(message.web.x) * map.state.documentWidth,
        y: Number(message.web.y) * map.state.documentHeight
      } : null,
      action: message.action ? {
        ...message.action,
        topY: Number.isFinite(Number(message.action.topY)) ? Number(message.action.topY) * map.state.documentHeight : null,
        bottomY: Number.isFinite(Number(message.action.bottomY)) ? Number(message.action.bottomY) * map.state.documentHeight : null,
        centerX: Number.isFinite(Number(message.action.centerX)) ? Number(message.action.centerX) * map.state.documentWidth : null,
        width: Number.isFinite(Number(message.action.width)) ? Number(message.action.width) * map.state.documentWidth : null
      } : null
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
      length: Number.isFinite(Number(message.length))
        ? Number(message.length) * Math.max(map.state.documentWidth, map.state.documentHeight)
        : null,
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
    root.innerHTML = `<section class="eimei-race-result-card"><p class="eimei-race-result-kicker">RACE RESULT</p><h2></h2><p class="eimei-race-result-summary">到着タイム / この部屋の自己ベスト / 通算ポイント</p><div class="eimei-race-result-players"></div><button type="button">待機室へ戻る</button></section>`;
    root.querySelector("h2").textContent = participants.length === 1
      ? `${winner?.nickname || "PLAYER"} ゴール`
      : `${winner?.nickname || "PLAYER"} の勝利`;
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
      card.innerHTML = `<span class="eimei-race-result-player-avatar" aria-hidden="true"></span><span class="eimei-race-result-player-copy"><span class="eimei-race-result-player-name"></span><span class="eimei-race-result-player-state"></span><span class="eimei-race-result-player-time"></span><span class="eimei-race-result-player-best"></span></span><span class="eimei-race-result-player-points"><strong></strong><span>PT</span></span>`;
      card.querySelector(".eimei-race-result-player-name").textContent = participant.nickname;
      card.querySelector(".eimei-race-result-player-state").textContent = participant.id === race.room.winnerId
        ? "WINNER"
        : participant.id === race.playerId ? "YOU" : "CHALLENGER";
      card.querySelector(".eimei-race-result-player-time").textContent = Number.isFinite(participant.finishDurationMs)
        ? `今回 ${formatRaceTime(participant.finishDurationMs)}`
        : "今回 未到達";
      card.querySelector(".eimei-race-result-player-best").textContent = Number.isFinite(participant.bestDurationMs)
        ? `BEST ${formatRaceTime(participant.bestDurationMs)}`
        : "BEST --:--.---";
      card.querySelector(".eimei-race-result-player-points strong").textContent = String(Math.max(0, Number.parseInt(participant.points, 10) || 0));
      return card;
    }));
    root.querySelector("button").addEventListener("click", () => location.assign(arenaRoomUrl().href));
    document.documentElement.append(root);
    race.result = root;
    window.setTimeout(() => root.querySelector("button")?.focus(), 100);
  }

  function formatRaceTime(milliseconds) {
    const total = Math.max(0, Math.round(Number(milliseconds) || 0));
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor(total % 60000 / 1000);
    const millis = total % 1000;
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
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
    const entry = document.querySelector("[data-race-entry]");
    const lobby = document.querySelector("[data-race-lobby]");
    const roomInput = document.querySelector("[data-race-join-form] input[name='room']");
    const entryError = document.querySelector("[data-race-entry-error]");

    const showEntry = () => {
      disconnect(false);
      race.roomCode = "";
      race.room = null;
      race.lastError = null;
      const url = new URL(location.href);
      url.searchParams.delete("room");
      history.replaceState(history.state, "", url.href);
      if (entry) entry.hidden = false;
      if (lobby) lobby.hidden = true;
      document.querySelector("[data-race-player-list]")?.replaceChildren();
      const count = document.querySelector("[data-race-player-count]");
      if (count) count.textContent = "0 / 4";
      if (entryError) entryError.textContent = "";
      if (roomInput) {
        roomInput.value = "";
        requestAnimationFrame(() => roomInput.focus());
      }
    };

    const enterRoom = (code) => {
      const normalized = normalizeRoomCode(code);
      if (!normalized) {
        if (entryError) entryError.textContent = "英字と数字の6文字で入力してください";
        roomInput?.focus();
        return false;
      }
      disconnect(false);
      race.roomCode = normalized;
      race.room = null;
      race.lastError = null;
      const url = new URL(location.href);
      url.searchParams.set("room", normalized);
      history.replaceState(history.state, "", url.href);
      const roomCode = document.querySelector("[data-race-room-code]");
      if (roomCode) roomCode.textContent = normalized;
      if (entry) entry.hidden = true;
      if (lobby) lobby.hidden = false;
      if (entryError) entryError.textContent = "";
      const stored = normalizeNickname(localStorage.getItem(nicknameStorageKey));
      if (stored) {
        race.nickname = stored;
        connect();
      } else {
        showProfileEditor();
      }
      return true;
    };

    document.querySelector("[data-race-create]")?.addEventListener("click", () => enterRoom(generateRoomCode()));
    document.querySelector("[data-race-join-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      enterRoom(roomInput?.value);
    });
    roomInput?.addEventListener("input", () => {
      roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z2-9]/gu, "").slice(0, 6);
      if (entryError) entryError.textContent = "";
    });
    document.querySelector("[data-race-change-room]")?.addEventListener("click", showEntry);
    document.querySelector("[data-race-ready]")?.addEventListener("click", () => send({ type: "ready", ready: !currentPlayer()?.ready }));
    document.querySelector("[data-race-start]")?.addEventListener("click", () => send({ type: "start" }));
    document.querySelector("[data-race-change-name]")?.addEventListener("click", () => showProfileEditor({ force: true }));
  }

  function boot() {
    ensurePlayerId();
    if (isArena) {
      installArenaActions();
      const entry = document.querySelector("[data-race-entry]");
      const lobby = document.querySelector("[data-race-lobby]");
      if (!ensureRoomCode()) {
        if (entry) entry.hidden = false;
        if (lobby) lobby.hidden = true;
        requestAnimationFrame(() => document.querySelector("[data-race-join-form] input")?.focus());
        return;
      }
      document.querySelector("[data-race-room-code]").textContent = race.roomCode;
      if (entry) entry.hidden = true;
      if (lobby) lobby.hidden = false;
    } else if (!ensureRoomCode()) {
      return;
    }
    window.addEventListener("eimei-race-finish", reportFinish);
    window.addEventListener("eimei-race-route-missing", () => {
      race.navigationCourseKey = null;
      race.navigationRetryAt = 0;
      ensureFinalNavigation();
    });
    window.addEventListener("eimei-race-wisp", (event) => {
      const detail = event.detail || {};
      if (!send({
        type: "wisp",
        roundId: detail.roundId,
        page: detail.page,
        wispId: detail.wispId,
        index: detail.index
      })) event.preventDefault();
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
  race.canonicalEntryForGoal = canonicalEntryForGoal;
  race.canonicalRoute = canonicalRoute;
  race.topMenuAreaHint = topMenuAreaHint;
  race.firstHintChoices = firstHintChoices;
  race.routeOrPositionHint = routeOrPositionHint;
  window.EimeiRace = race;
  boot();
})();
