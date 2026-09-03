(() => {
  "use strict";

  const local = /^(?:127\.0\.0\.1|localhost)$/i.test(location.hostname);
  const saved = localStorage.getItem("eimei-race-server-v1") || "";
  window.EIMEI_RACE_CONFIG = Object.freeze({
    serverBase: saved || (local
      ? "http://127.0.0.1:8787"
      : "https://eimei-race.eimei-race-worker.workers.dev"),
    noHintMilliseconds: 90_000,
    categoryHintMilliseconds: 150_000,
    titleHintMilliseconds: 210_000,
    contextHintMilliseconds: 270_000,
    navigationHintMilliseconds: 300_000,
    positionIntervalMilliseconds: 180
  });
})();
