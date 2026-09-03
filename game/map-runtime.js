(() => {
  "use strict";

  if (window.EimeiMap?.active) return;

  const CONFIG = Object.freeze({
    worldScale: 1.4,
    gapEm: 0.72,
    minGapPx: 2,
    maxGapPx: 20,
    rowTolerancePx: 4,
    minLineWidthPx: 24,
    lineThicknessPx: 3,
    playerWidth: 18,
    playerHeight: 25,
    runAcceleration: 2200,
    airAcceleration: 1320,
    groundFriction: 2500,
    maxRunSpeed: 310,
    gravity: 1800,
    maxFallSpeed: 1050,
    jumpSpeed: 625,
    airJumpSpeed: 515,
    airJumpSpinSeconds: 0.58,
    coyoteSeconds: 0.11,
    jumpBufferSeconds: 0.13,
    hoverHoldSeconds: 5,
    portalWidth: 38,
    portalHeight: 52,
    portalGrowSeconds: 0.28,
    webRange: 640,
    webMinimumRise: 38,
    webMaximumCharges: 2,
    webMinimumLength: 72,
    webPumpAcceleration: 520,
    webReelSpeed: 265,
    webReleaseSpeed: 510,
    webMantleMaximumEdgeDistance: 210,
    webMantleApproachSeconds: 0.28,
    webMantleVaultSeconds: 0.4,
    raceGrappleMinimumLength: 28,
    raceGrappleAcceleration: 3400,
    raceGrappleMaximumSpeed: 720,
    raceGrappleHoldSeconds: 0.42,
    hatchMinimumSurfaceWidth: 300,
    navigationFlightSpeed: 760,
    navigationMinimumRise: 30,
    navigationMaximumRiseViewport: 0.68,
    navigationArrivalHorizontalPx: 68,
    navigationArrivalVerticalPx: 84,
    navigationTargetLockSeconds: 1.35,
    navigationMinimumDisplaySeconds: 0.72,
    navigationNearConfirmSeconds: 0.18,
    navigationReplanDelaySeconds: 0.62,
    navigationAdvanceCooldownSeconds: 0.48,
    navigationAdvanceMinimumTravelPx: 30,
    navigationHorizontalTolerancePx: 9,
    navigationOvertakeVerticalPx: 108,
    navigationOvertakeDelaySeconds: 0.3,
    missionMinimumVerticalViewport: 0.85,
    missionMinimumSteps: 12,
    missionMaximumSteps: 42,
    missionMinimumTravelViewport: 5.4,
    missionMaximumTravelViewport: 10.8,
    missionMinimumDirectViewport: 2.4,
    missionFinalMinimumDirectViewport: 2.2,
    missionMaximumSegments: 12,
    missionPortalChance: 0.58,
    missionTargetMinimumViewport: 18,
    missionTargetMaximumViewport: 24.5,
    missionPlanningMaximumPortals: 10,
    missionMaximumConsecutiveHeaderPortals: 2,
    missionMaximumHeaderPortals: 1,
    missionPlanningCompletionRatio: .9,
    missionPlanningMinimumAcceptRatio: .55,
    missionStartMaximumAttempts: 3,
    scoreAttackSeconds: 4 * 60,
    scorePickupPauseSeconds: 1.08,
    scoreLocalMinimumTravelViewport: 2.15,
    scoreLocalMaximumTravelViewport: 7.4,
    scoreRecentGoalLimit: 18,
    scoreRecentPageLimit: 16,
    goalCelebrationSeconds: 3.4,
    goalFreezeSeconds: 1.25,
    dropThroughMaximumThickness: 30,
    dropThroughSeconds: 1.3,
    dropThroughSpeed: 520,
    dropHatchKickSeconds: 0.44,
    dropHatchReadySeconds: 0.18,
    dropHatchJumpSeconds: 0.56,
    dropHatchDiveSeconds: 0.21,
    dropHatchBurstSeconds: 0.28,
    ladderClimbSpeed: 205,
    ladderGrabHorizontalPx: 28,
    ladderMinimumHeight: 64,
    ladderMaximumHeightViewport: 0.82,
    ladderGripSeconds: 0.26,
    ladderThreadSeconds: 0.4,
    ladderTraverseSeconds: 0.18,
    ladderRollSeconds: 0.54,
    canvasPixelRatioMaximum: 1,
    canvasPixelRatioLowPower: 1,
    physicsStepSeconds: 1 / 60,
    renderStepSeconds: isLowPowerDevice() ? 1 / 30 : 1 / 60,
    portalInspectionSeconds: 1 / 12,
    maxFrameSeconds: 1 / 20
  });

  const initialRouteParameters = new URLSearchParams(location.search);
  function scaleDocumentBody() {
    if (!document.body) return;
    if (CSS.supports?.("zoom", "1")) {
      document.body.style.transform = "none";
      document.body.style.zoom = String(CONFIG.worldScale);
      return;
    }
    document.body.style.transform = `scale(${CONFIG.worldScale})`;
    document.body.style.transformOrigin = "0 0";
  }

  if (initialRouteParameters.get("eimei-preview") === "1") {
    const preparePreviewDocument = () => {
      document.documentElement.classList.add("eimei-preview-document");
      if (!document.body) return;
      scaleDocumentBody();
    };
    preparePreviewDocument();
    if (!document.body) document.addEventListener("DOMContentLoaded", preparePreviewDocument, { once: true });
    return;
  }
  const isPlanningDocument = initialRouteParameters.get("eimei-route") === "plan";
  const isCatalogDocument = initialRouteParameters.get("eimei-route") === "catalog";
  const isTutorialDocument = document.documentElement.hasAttribute("data-eimei-tutorial");
  const initialRaceRoom = (initialRouteParameters.get("eimei-room") || "").toUpperCase();
  const isRaceDocument = initialRouteParameters.get("eimei-route") === "race" &&
    /^[A-Z2-9]{6}$/.test(initialRaceRoom);

  const ignoredTags = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "OPTION",
    "SELECT",
    "TEMPLATE"
  ]);

  // These two upstream pages are only zero-second redirect stubs for an
  // external-style brochure viewer. The viewer directories are not part of
  // the mirrored game map, so treating the stubs as portals lands on a 404.
  const unsupportedStagePages = new Set([
    "/entrance/pamphlet.html",
    "/entrance/recruit.html",
    "/entrance/pamphlet_2027/index.html",
    "/entrance/recruit_2027/index.html"
  ]);

  function isLowPowerDevice() {
    const memory = Number(navigator.deviceMemory);
    const cores = Number(navigator.hardwareConcurrency);
    return (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
  }

  const state = {
    active: true,
    bodies: [],
    textBodies: [],
    lineBodies: [],
    ladders: [],
    menuLadders: [],
    webPoints: [],
    baseCharacters: [],
    baseLineBodies: [],
    upwardTraversalCache: new Map(),
    downwardTraversalCache: new Map(),
    normalRouteCache: new Map(),
    hatchCandidate: null,
    hatchSupportBody: null,
    hatchCandidateSetAt: -Infinity,
    hatchCandidateCheckedAt: -Infinity,
    debug: false,
    needsRebuild: false,
    rebuildFull: false,
    rebuildTimer: 0,
    hoverLayoutChangingUntil: -Infinity,
    lastTime: performance.now(),
    lastRenderAt: -Infinity,
    lastPortalInspectionAt: -Infinity,
    accumulator: 0,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentWidth: 0,
    documentHeight: 0,
    particleDensity: isLowPowerDevice() ? 0.28 : 0.4,
    performance: {
      samples: 0,
      averageFrameMs: 16.7,
      averageRenderMs: 0,
      rebuilds: 0,
      lastRebuildMs: 0,
      maximumRebuildMs: 0,
      hoverRebuilds: 0,
      lastHoverRebuildMs: 0,
      maximumHoverRebuildMs: 0,
      quality: isLowPowerDevice() ? "low-power" : "standard"
    }
  };

  const input = {
    left: false,
    right: false,
    jump: false,
    space: false,
    jumpPressedAt: -Infinity,
    up: false,
    down: false,
    downPressedAt: -Infinity,
    web: false
  };

  const player = {
    x: 0,
    y: 0,
    width: CONFIG.playerWidth,
    height: CONFIG.playerHeight,
    velocityX: 0,
    velocityY: 0,
    grounded: false,
    groundedAt: -Infinity,
    standingBody: null,
    navigationBody: null,
    facing: 1,
    spawnX: 0,
    spawnY: 0,
    airJumpsRemaining: 1,
    airJumpAt: -Infinity,
    dropThroughBody: null,
    dropThroughSurfaceY: -Infinity,
    dropThroughUntil: -Infinity,
    palette: {
      primary: "#082447",
      dark: "#071a37",
      accent: "#ff4d21",
      visor: "#63e7ff",
      glow: "rgba(0, 173, 224, 0.2)"
    }
  };

  const dropHatch = {
    phase: "none",
    time: 0,
    body: null,
    startX: 0,
    startY: 0,
    targetX: 0,
    centerX: 0,
    topY: 0,
    bottomY: 0,
    width: 0,
    traverseDuration: 0.14,
    visualY: null,
    started: 0,
    completed: 0
  };

  const ladderTraversal = {
    phase: "none",
    time: 0,
    ladder: null,
    startX: 0,
    startY: 0,
    targetX: 0,
    visualY: null,
    climbCycle: 0,
    sideDismountArmed: false,
    graceUntil: -Infinity,
    started: 0,
    completed: 0
  };

  const interaction = {
    activeElements: new Map(),
    sourceElement: null,
    holdUntil: -Infinity,
    portal: null
  };

  const web = {
    active: false,
    anchorX: 0,
    anchorY: 0,
    length: 0,
    charges: CONFIG.webMaximumCharges,
    candidate: null,
    anchorBody: null,
    remotePlayerId: null,
    hatchPhase: "none",
    hatchTime: 0,
    hatchStartX: 0,
    hatchStartY: 0,
    hatchTargetX: 0,
    hatchCenterX: 0,
    hatchTopY: 0,
    hatchBottomY: 0,
    hatchWidth: 0,
    hatchEntryDuration: 1.08,
    hatchTraverseDuration: 0.24,
    hatchPassageDuration: 0.62,
    hatchGraceUntil: -Infinity,
    hatchDeniedUntil: -Infinity,
    mantlePhase: "none",
    mantleTime: 0,
    mantleBody: null,
    mantleStartX: 0,
    mantleStartY: 0,
    mantleOutsideX: 0,
    mantleOutsideY: 0,
    mantleTargetX: 0,
    mantleTargetY: 0,
    mantleSide: 0,
    mantlesStarted: 0,
    mantlesCompleted: 0,
    hatchesStarted: 0,
    hatchesCompleted: 0
  };

  const mission = {
    initialized: false,
    spawnBody: null,
    goalBody: null,
    goalElement: null,
    goalPoint: null,
    goalKind: "text",
    portalAnchor: null,
    portalDestination: null,
    continuationMode: null,
    continuationPortals: 0,
    runId: null,
    segmentIndex: 0,
    visitedPaths: [],
    routeDistance: 0,
    route: [],
    routePhysicalAtPlan: false,
    routeIndex: 0,
    guideBody: null,
    guidePoint: null,
    guideSetAt: -Infinity,
    guideNearSince: -Infinity,
    guideLockUntil: -Infinity,
    guideOriginY: -Infinity,
    lostGuideSince: -Infinity,
    overtookGuideSince: -Infinity,
    nextAdvanceAllowedAt: -Infinity,
    lastAdvanceX: -Infinity,
    lastAdvanceY: -Infinity,
    lastStandingBody: null,
    needsReplan: false,
    lastReplanAt: -Infinity,
    completed: false,
    completedAt: -Infinity,
    wispX: 0,
    wispY: 0,
    wispFromX: 0,
    wispFromY: 0,
    wispAnchored: false,
    trail: [],
    trailClock: 0,
    previewStartedAt: -Infinity,
    previewUntil: -Infinity,
    previewAwaitingPhoto: false,
    previewFallbackTimer: 0,
    previewScrollX: 0,
    previewScrollY: 0,
    previewShownAt: -Infinity,
    previewPhotoLoadedAt: -Infinity,
    previewRenderedImages: 0,
    previewGuidePending: false,
    startPageRandomized: false,
    startPageKey: null,
    finalGoalPage: null,
    finalGoalX: null,
    finalGoalY: null,
    finalGoalReady: false,
    plannedPortalTransitions: 0,
    plannedPortalPages: [],
    headerPortalStreak: 0,
    headerPortalTotal: 0,
    planningTrace: [],
    recoveringFromDetour: false,
    targetRouteDistance: 0,
    plannedRouteDistance: 0,
    plannerFrame: null,
    plannerToken: null,
    scoreAttack: false,
    score: 0,
    scoreTimeRemaining: 4 * 60,
    scoreClockStarted: false,
    scoreFinished: false,
    scoreRound: 0,
    scoreRoundsOnPage: 0,
    scoreNextRoundAt: -Infinity,
    scoreRecentGoals: [],
    scoreRecentPages: [],
    scoreTargetKey: null,
    scorePlanningPortal: false,
    scorePickupAt: -Infinity
  };

  const race = {
    active: isRaceDocument,
    roomCode: initialRaceRoom,
    roundId: initialRouteParameters.get("eimei-round") || "",
    startAt: null,
    course: null,
    configured: false,
    navigationEnabled: false,
    frozen: isRaceDocument,
    finished: false,
    finishPending: false,
    finishReportedAt: -Infinity,
    missingRoutePage: null,
    remotePlayers: new Map(),
    incomingGrapples: new Map()
  };

  const tutorial = {
    active: isTutorialDocument,
    step: 0,
    transitioning: false,
    actions: {
      left: false,
      right: false,
      jump: false,
      doubleJump: false,
      swing: false,
      reel: false,
      ladderClimb: false,
      ladderDismount: false,
      drop: false
    },
    reelDistance: 0,
    lastWebLength: 0,
    webStartX: null,
    ladderStartY: null,
    completedSteps: []
  };

  function captureFixedWorldPlacements() {
    if (isPlanningDocument) return [];
    return [...document.querySelectorAll("header, header img, section, .fixbana, #side, #side-wide, #tabbed")]
      .filter((element) => getComputedStyle(element).position === "fixed")
      .map((element) => {
        const rect = element.getBoundingClientRect();
        element.classList.add("eimei-world-fixed");
        return {
          element,
          left: rect.left,
          top: rect.top
        };
      });
  }

  // Measure viewport-pinned school UI before the game class turns it into
  // world geometry. `position:absolute` alone keeps it from following the
  // camera, but an auto-positioned sidebar can jump into the header and lose
  // all of its physical link rows. A small translate preserves the exact
  // pre-game location while allowing the element to scroll with the stage.
  const fixedWorldPlacements = captureFixedWorldPlacements();

  const canvas = document.createElement("canvas");
  canvas.id = "eimei-game-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.eimeiGame = "true";
  if (!isPlanningDocument) {
    document.documentElement.classList.add("eimei-game-active");
    for (const placement of fixedWorldPlacements) {
      const rect = placement.element.getBoundingClientRect();
      const deltaX = placement.left - rect.left;
      const deltaY = placement.top - rect.top;
      placement.element.style.setProperty("translate", `${deltaX}px ${deltaY}px`, "important");
    }
    document.documentElement.append(canvas);
  }
  let missionPreviewPhoto = null;
  let scorePickupOverlay = null;
  let scorePickupTimer = 0;
  let scoreResultOverlay = null;
  let scoreResultFocusTimer = 0;
  let gameResetting = false;

  const worldSpacer = document.createElement("div");
  worldSpacer.dataset.eimeiGame = "world-spacer";
  worldSpacer.setAttribute("aria-hidden", "true");
  Object.assign(worldSpacer.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none"
  });
  document.documentElement.append(worldSpacer);

  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const range = document.createRange();
  const runtimeScript = document.currentScript || document.querySelector('script[data-eimei-game="map"][src]');
  const runtimeUrl = runtimeScript?.src ? new URL(runtimeScript.src) : new URL("./game/map-runtime.js", location.href);
  const staticSiteRoot = new URL("../", runtimeUrl);

  function prepareWorld() {
    scaleDocumentBody();
  }

  function mirroredHoverCss() {
    const mirrored = [];
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText.includes(":hover")) {
          mirrored.push(`${rule.selectorText.replaceAll(":hover", ".eimei-player-hover")} { ${rule.style.cssText} }`);
          continue;
        }
        if (rule.cssRules) visit(rule.cssRules);
      }
    };

    for (const sheet of document.styleSheets) {
      try {
        visit(sheet.cssRules);
      } catch {
        // A remote stylesheet can be rendered but not inspected. The mirrored
        // school pages use local CSS, so this is only a defensive fallback.
      }
    }
    return mirrored.join("\n");
  }

  function installPlayerHoverRules() {
    const style = document.createElement("style");
    style.dataset.eimeiGame = "hover-rules";
    style.textContent = mirroredHoverCss();
    document.head.append(style);
  }

  function isGameNode(element) {
    return Boolean(element?.closest?.("[data-eimei-game], #eimei-game-canvas"));
  }

  function isElementVisible(element) {
    if (!element || isGameNode(element)) return false;
    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }
    return element.getClientRects().length > 0;
  }

  function createTextWalker(root = document.body) {
    return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ignoredTags.has(parent.tagName) || isGameNode(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue || !/\S/u.test(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
  }

  function visibleHoverOverlays() {
    // Only the navigation dropdowns are overlays whose visibility is created
    // by the mirrored hover state. Treating every visible <ul> below a hovered
    // ancestor as a popup produced stray ladders beside ordinary page lists.
    return [...document.querySelectorAll("#main-nav .menu > li.eimei-player-hover > ul")]
      .filter((element) => isElementVisible(element))
      .map((element) => ({
        element,
        owner: element.parentElement,
        rect: element.getBoundingClientRect()
      }))
      .filter(({ rect }) => rect.width > 1 && rect.height > 1);
  }

  function characterRectIsExposed(element, rect, hoverOverlays) {
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    if (hoverOverlays.some((overlay) =>
      !overlay.element.contains(element) &&
      centerX >= overlay.rect.left &&
      centerX <= overlay.rect.right &&
      centerY >= overlay.rect.top &&
      centerY <= overlay.rect.bottom
    )) return false;

    const viewportLeft = Math.max(0, rect.left);
    const viewportRight = Math.min(window.innerWidth, rect.right);
    const viewportTop = Math.max(0, rect.top);
    const viewportBottom = Math.min(window.innerHeight, rect.bottom);
    if (viewportRight <= viewportLeft || viewportBottom <= viewportTop) return true;

    const sampleY = viewportTop + (viewportBottom - viewportTop) * 0.55;
    const sampleXs = [0.25, 0.5, 0.75].map((ratio) =>
      viewportLeft + (viewportRight - viewportLeft) * ratio
    );
    return sampleXs.some((sampleX) => {
      const topElement = document.elementFromPoint(sampleX, sampleY);
      return Boolean(
        topElement &&
        (topElement === element || element.contains(topElement) || topElement.contains(element))
      );
    });
  }

  function collectCharacterRects(root = document.body, hoverOverlays = visibleHoverOverlays()) {
    const characters = [];
    const walker = createTextWalker(root);
    let node;

    while ((node = walker.nextNode())) {
      const style = getComputedStyle(node.parentElement);
      const fontSize = Number.parseFloat(style.fontSize) || 16;
      let offset = 0;

      for (const character of node.nodeValue) {
        const length = character.length;
        if (/\S/u.test(character)) {
          range.setStart(node, offset);
          range.setEnd(node, offset + length);

          for (const rect of range.getClientRects()) {
            if (rect.width < 0.25 || rect.height < 0.5) continue;
            // Dropdowns are drawn over the page without hiding the text below
            // them. Only the top visible layer should remain solid; otherwise
            // the covered page copy becomes an invisible wall inside the menu.
            if (!characterRectIsExposed(node.parentElement, rect, hoverOverlays)) continue;
            // Range rectangles include half of CSS line-height leading. That
            // empty padding used to become a floating floor and web anchor.
            // Keep the collision surface on the visible glyph-height instead.
            const visualHeight = Math.min(rect.height, fontSize);
            const verticalInset = Math.max(0, (rect.height - visualHeight) * 0.5);
            characters.push({
              left: rect.left + window.scrollX,
              right: rect.right + window.scrollX,
              top: rect.top + window.scrollY + verticalInset,
              bottom: rect.bottom + window.scrollY - verticalInset,
              width: rect.width,
              height: visualHeight,
              fontSize,
              element: node.parentElement,
              character
            });
          }
        }
        offset += length;
      }
    }

    return characters;
  }

  function collectPlanningLineRects(root = document.body) {
    const lines = [];
    const walker = createTextWalker(root);
    let node;

    // Goal planning only needs the page's broad route shape. Measuring every
    // glyph here repeated thousands of Range/layout queries in each hidden
    // iframe. One Range rectangle per rendered line preserves links, floors
    // and vertical spacing while making planning cheap enough for weak CPUs.
    while ((node = walker.nextNode())) {
      const style = getComputedStyle(node.parentElement);
      const fontSize = Number.parseFloat(style.fontSize) || 16;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width < 0.25 || rect.height < 0.5) continue;
        const visualHeight = Math.min(rect.height, fontSize);
        const verticalInset = Math.max(0, (rect.height - visualHeight) * 0.5);
        const segmentCount = Math.max(1, Math.min(72, Math.ceil(rect.width / Math.max(9, fontSize * 0.72))));
        for (let index = 0; index < segmentCount; index += 1) {
          const left = rect.left + rect.width * (index / segmentCount);
          const right = rect.left + rect.width * ((index + 1) / segmentCount);
          lines.push({
            left: left + window.scrollX,
            right: right + window.scrollX,
            top: rect.top + window.scrollY + verticalInset,
            bottom: rect.bottom + window.scrollY - verticalInset,
            width: right - left,
            height: visualHeight,
            fontSize,
            element: node.parentElement,
            character: "line-segment"
          });
        }
      }
    }
    return lines;
  }

  function rowsForCharacters(characters) {
    const rows = [];
    const rowBuckets = new Map();
    const bucketSize = 8;
    const sorted = characters.toSorted((a, b) => a.bottom - b.bottom || a.left - b.left);

    for (const character of sorted) {
      let bestRow = null;
      let bestDistance = Infinity;
      const centerBucket = Math.floor(character.bottom / bucketSize);
      const nearbyRows = new Set();
      for (let bucket = centerBucket - 3; bucket <= centerBucket + 3; bucket += 1) {
        for (const row of rowBuckets.get(bucket) || []) nearbyRows.add(row);
      }
      for (const row of nearbyRows) {
        const tolerance = Math.max(
          CONFIG.rowTolerancePx,
          Math.min(character.fontSize, row.fontSize) * 0.18
        );
        const distance = Math.abs(row.baseline - character.bottom);
        const overlap = Math.min(row.bottom, character.bottom) - Math.max(row.top, character.top);
        if (distance <= tolerance && overlap > Math.min(row.height, character.height) * 0.45 && distance < bestDistance) {
          bestRow = row;
          bestDistance = distance;
        }
      }

      if (!bestRow) {
        const row = {
          baseline: character.bottom,
          top: character.top,
          bottom: character.bottom,
          height: character.height,
          fontSize: character.fontSize,
          characters: [character]
        };
        rows.push(row);
        const bucket = Math.floor(row.baseline / bucketSize);
        if (!rowBuckets.has(bucket)) rowBuckets.set(bucket, []);
        rowBuckets.get(bucket).push(row);
        continue;
      }

      bestRow.characters.push(character);
      bestRow.top = Math.min(bestRow.top, character.top);
      bestRow.bottom = Math.max(bestRow.bottom, character.bottom);
      bestRow.height = bestRow.bottom - bestRow.top;
      bestRow.fontSize = Math.max(bestRow.fontSize, character.fontSize);
      // Keep the first measured baseline as the spatial-index key. Every
      // accepted glyph is already within tolerance, so averaging it only
      // forces expensive bucket maintenance without changing the platform.
    }

    return rows;
  }

  function gapThreshold(current, next) {
    return Math.max(
      CONFIG.minGapPx,
      Math.min(CONFIG.maxGapPx, Math.max(current.fontSize, next.fontSize) * CONFIG.gapEm)
    );
  }

  function bodyFromRun(run, id) {
    const left = Math.min(...run.map((item) => item.left));
    const right = Math.max(...run.map((item) => item.right));
    const top = Math.min(...run.map((item) => item.top));
    const bottom = Math.max(...run.map((item) => item.bottom));
    const regions = new Map();
    for (const item of run) {
      const existing = regions.get(item.element);
      if (existing) {
        existing.left = Math.min(existing.left, item.left);
        existing.right = Math.max(existing.right, item.right);
      } else {
        regions.set(item.element, {
          element: item.element,
          left: item.left,
          right: item.right
        });
      }
    }
    return {
      id: `text-${id}`,
      kind: "text",
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(2, bottom - top),
      visualColor: getComputedStyle(run[0].element).color || "#333333",
      sourceCount: run.length,
      sourceRegions: [...regions.values()],
      anchorPoints: run.map((item) => ({ x: (item.left + item.right) * 0.5, y: item.top }))
    };
  }

  function mergeCharactersIntoBodies(characters) {
    const bodies = [];
    let id = 0;

    for (const row of rowsForCharacters(characters)) {
      const sorted = row.characters.toSorted((a, b) => a.left - b.left || a.right - b.right);
      let run = [];
      let rightEdge = -Infinity;
      let previous = null;

      for (const character of sorted) {
        const gap = character.left - rightEdge;
        if (run.length > 0 && gap > gapThreshold(previous, character)) {
          bodies.push(bodyFromRun(run, id++));
          run = [];
          rightEdge = -Infinity;
        }
        run.push(character);
        rightEdge = Math.max(rightEdge, character.right);
        previous = character;
      }

      if (run.length > 0) bodies.push(bodyFromRun(run, id++));
    }

    return bodies;
  }

  function validHorizontalLine(rect, width) {
    return rect.width >= CONFIG.minLineWidthPx && width >= 1 && rect.height >= 0;
  }

  function collectLineBodies() {
    const lines = [];
    let id = 0;

    for (const element of document.body.querySelectorAll("*")) {
      if (ignoredTags.has(element.tagName) || !isElementVisible(element) || isGameNode(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < CONFIG.minLineWidthPx) continue;
      const style = getComputedStyle(element);

      if (element.tagName === "HR") {
        lines.push({
          id: `line-${id++}`,
          kind: "line",
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: Math.max(CONFIG.lineThicknessPx, rect.height),
          visualColor: style.borderTopColor || style.color || "#333333",
          sourceElement: element
        });
        continue;
      }

      const topWidth = Number.parseFloat(style.borderTopWidth) || 0;
      if (style.borderTopStyle !== "none" && validHorizontalLine(rect, topWidth)) {
        lines.push({
          id: `line-${id++}`,
          kind: "line",
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: Math.max(CONFIG.lineThicknessPx, topWidth),
          visualColor: style.borderTopColor || style.color || "#333333",
          sourceElement: element
        });
      }

      const bottomWidth = Number.parseFloat(style.borderBottomWidth) || 0;
      if (style.borderBottomStyle !== "none" && validHorizontalLine(rect, bottomWidth)) {
        lines.push({
          id: `line-${id++}`,
          kind: "line",
          x: rect.left + window.scrollX,
          y: rect.bottom + window.scrollY - Math.max(CONFIG.lineThicknessPx, bottomWidth),
          width: rect.width,
          height: Math.max(CONFIG.lineThicknessPx, bottomWidth),
          visualColor: style.borderBottomColor || style.color || "#333333",
          sourceElement: element
        });
      }
    }

    return deduplicateLines(lines);
  }

  function deduplicateLines(lines) {
    const accepted = [];
    for (const line of lines.toSorted((a, b) => a.y - b.y || a.x - b.x || b.width - a.width)) {
      const duplicate = accepted.some((other) =>
        Math.abs(other.y - line.y) <= 1 &&
        Math.abs(other.x - line.x) <= 1 &&
        Math.abs(other.width - line.width) <= 2
      );
      if (!duplicate) accepted.push(line);
    }
    return accepted;
  }

  function collectWebPoints(characters, lineBodies) {
    const points = characters.map((character) => ({
      x: (character.left + character.right) * 0.5,
      y: character.top,
      kind: "text"
    }));

    for (const line of lineBodies) {
      const count = Math.max(1, Math.floor(line.width / 58));
      for (let index = 0; index <= count; index += 1) {
        points.push({
          x: line.x + line.width * (index / count),
          y: line.y,
          kind: "line"
        });
      }
    }

    const unique = new Map();
    for (const point of points) {
      const key = `${Math.round(point.x / 10)}:${Math.round(point.y / 10)}`;
      if (!unique.has(key)) unique.set(key, point);
    }
    return [...unique.values()];
  }

  function documentSize() {
    const root = document.documentElement;
    const body = document.body;
    return {
      width: Math.max(root.scrollWidth, root.offsetWidth, body.scrollWidth, body.offsetWidth, window.innerWidth),
      height: Math.max(root.scrollHeight, root.offsetHeight, body.scrollHeight, body.offsetHeight, window.innerHeight)
    };
  }

  function buildCollisionMap({ preservePlayer = true } = {}) {
    const rebuildStartedAt = performance.now();
    const previous = { x: player.x, y: player.y };
    const previousSurfaceElement = preservePlayer && player.standingBody
      ? sourceElementAt(player.standingBody, player.x + player.width * 0.5)
      : null;
    const previousSurface = previousSurfaceElement ? {
      element: previousSurfaceElement,
      x: player.standingBody.x,
      y: player.standingBody.y,
      height: player.standingBody.height
    } : null;
    const previousGoal = mission.goalBody ? {
      element: mission.goalElement,
      x: mission.goalPoint?.x ?? mission.goalBody.x + mission.goalBody.width * 0.5,
      y: mission.goalBody.y
    } : null;
    const previousGuide = mission.guideBody ? {
      ...bodyDescriptor(mission.guideBody),
      pointX: mission.guidePoint?.x,
      pointY: mission.guidePoint?.y
    } : null;
    const previousRoute = mission.initialized
      ? mission.route.slice(mission.routeIndex).map(bodyDescriptor)
      : [];
    const hoverOverlays = visibleHoverOverlays();
    // Race pages must rebuild quickly after a door transition, including on
    // 2-core school Chromebooks. A rendered-line Range gives the same visible
    // floor silhouette with tens of layout reads instead of one read per glyph.
    const characters = (isPlanningDocument || isRaceDocument || isLowPowerDevice())
      ? collectPlanningLineRects(document.body)
      : collectCharacterRects(document.body, hoverOverlays);
    state.textBodies = mergeCharactersIntoBodies(characters);
    const pageLineBodies = collectLineBodies();
    state.lineBodies = [
      ...lineSegmentsOutsideOverlays(pageLineBodies, hoverOverlays),
      ...collectMenuLedges(hoverOverlays, state.textBodies)
    ];
    if (hoverOverlays.length === 0) {
      state.baseCharacters = characters;
      state.baseLineBodies = pageLineBodies;
    }
    state.bodies = [...state.textBodies, ...state.lineBodies];
    state.upwardTraversalCache.clear();
    state.downwardTraversalCache.clear();
    state.normalRouteCache.clear();
    prepareNavigationSurfaces();
    state.webPoints = collectWebPoints(characters, state.lineBodies);

    const size = documentSize();
    const geometryWidth = Math.max(0, ...state.bodies.map((body) => body.x + body.width)) + 40;
    const geometryHeight = Math.max(0, ...state.bodies.map((body) => body.y + body.height)) + 90;
    state.documentWidth = Math.max(size.width, geometryWidth);
    state.documentHeight = Math.max(size.height, geometryHeight);
    state.ladders = collectLadders();
    state.menuLadders = collectMenuLadders(hoverOverlays);
    worldSpacer.style.width = `${Math.ceil(state.documentWidth)}px`;
    worldSpacer.style.height = `${Math.ceil(state.documentHeight)}px`;

    if (!preservePlayer || state.bodies.length === 0) {
      startMission();
    } else {
      player.x = previous.x;
      player.y = previous.y;
      if (!Number.isFinite(player.x + player.y)) {
        placeAtSpawn();
      } else if (previousSurface) {
        // Hover UIs can reveal menus and change the collision map. Keep the
        // player attached to the same DOM surface instead of letting the new
        // geometry drop them onto an unrelated label underneath.
        const matchingBody = state.textBodies
          .filter((body) =>
            body.sourceRegions?.some((region) => region.element === previousSurface.element) &&
            Math.abs(body.y - previousSurface.y) <= Math.max(8, previousSurface.height * 0.55)
          )
          .toSorted((a, b) =>
            Math.abs(a.y - previousSurface.y) * 100 + Math.abs(a.x - previousSurface.x) -
            (Math.abs(b.y - previousSurface.y) * 100 + Math.abs(b.x - previousSurface.x))
          )[0];
        if (matchingBody) {
          const region = matchingBody.sourceRegions.find((item) => item.element === previousSurface.element);
          const desiredCenter = previous.x + player.width * 0.5;
          player.x = Math.max(
            region.left - player.width * 0.35,
            Math.min(desiredCenter - player.width * 0.5, region.right - player.width * 0.65)
          );
          player.y = matchingBody.y - player.height - 1;
          player.velocityY = 0;
          player.grounded = true;
          player.airJumpsRemaining = 1;
          player.airJumpAt = -Infinity;
          player.standingBody = matchingBody;
        }
      }
      remapMission(previousGoal, previousRoute, previousGuide);
    }
    refreshHatchCandidate({ force: true });
    if (!isPlanningDocument && mission.initialized && mission.goalKind === "portal" && mission.portalAnchor) {
      // Image/layout rebuilds can coincide with opening a guided dropdown.
      // A full rebuild must hand the proxy marker to the real child row just
      // like the cheaper hover-only rebuild does.
      revealGuidedPortalMenu(player.navigationBody || supportingMapBody(), performance.now() / 1000);
    }

    state.needsRebuild = false;
    const rebuildMilliseconds = performance.now() - rebuildStartedAt;
    state.performance.rebuilds += 1;
    state.performance.lastRebuildMs = rebuildMilliseconds;
    state.performance.maximumRebuildMs = Math.max(state.performance.maximumRebuildMs, rebuildMilliseconds);
    window.dispatchEvent(new CustomEvent("eimei-map-built", {
      detail: {
        textBodies: state.textBodies.length,
        lineBodies: state.lineBodies.length,
        totalBodies: state.bodies.length
      }
    }));
  }

  function characterCoveredByOverlay(character, overlays) {
    return overlays.some((overlay) => {
      if (overlay.element.contains(character.element)) return false;
      const left = overlay.rect.left + window.scrollX;
      const right = overlay.rect.right + window.scrollX;
      const top = overlay.rect.top + window.scrollY;
      const bottom = overlay.rect.bottom + window.scrollY;
      // Remove even edge-touching glyphs from the covered layer. Keeping half
      // a glyph at the popup boundary lets it merge with menu text and restores
      // the hidden platform as one long collision body.
      return character.right > left && character.left < right && character.bottom > top && character.top < bottom;
    });
  }

  function lineSegmentsOutsideOverlays(lines, overlays) {
    let segments = lines.map((line) => ({ ...line }));
    for (const overlay of overlays) {
      const left = overlay.rect.left + window.scrollX;
      const right = overlay.rect.right + window.scrollX;
      const top = overlay.rect.top + window.scrollY;
      const bottom = overlay.rect.bottom + window.scrollY;
      segments = segments.flatMap((line) => {
        if (
          overlay.element.contains(line.sourceElement) ||
          line.y + line.height <= top ||
          line.y >= bottom ||
          line.x + line.width <= left ||
          line.x >= right
        ) return [line];
        const pieces = [];
        const leftWidth = Math.max(0, left - line.x);
        const rightStart = Math.max(line.x, right);
        const rightWidth = Math.max(0, line.x + line.width - rightStart);
        if (leftWidth >= 1) pieces.push({ ...line, id: `${line.id}-left`, width: leftWidth });
        if (rightWidth >= 1) pieces.push({ ...line, id: `${line.id}-right`, x: rightStart, width: rightWidth });
        return pieces;
      });
    }
    return segments;
  }

  function rebuildHoverCollisionMap() {
    if (state.baseCharacters.length === 0) {
      buildCollisionMap({ preservePlayer: true });
      return;
    }
    const rebuildStartedAt = performance.now();
    const previousSurfaceElement = player.standingBody
      ? sourceElementAt(player.standingBody, player.x + player.width * 0.5)
      : null;
    const previousGoal = mission.goalBody ? {
      element: mission.goalElement,
      x: mission.goalPoint?.x ?? mission.goalBody.x + mission.goalBody.width * 0.5,
      y: mission.goalBody.y
    } : null;
    const previousGuide = mission.guideBody ? {
      ...bodyDescriptor(mission.guideBody),
      pointX: mission.guidePoint?.x,
      pointY: mission.guidePoint?.y
    } : null;
    const previousRoute = mission.initialized
      ? mission.route.slice(mission.routeIndex).map(bodyDescriptor)
      : [];
    const overlays = visibleHoverOverlays();
    const overlayRoots = overlays.filter((candidate) =>
      !overlays.some((other) => other !== candidate && other.element.contains(candidate.element))
    );
    const characters = state.baseCharacters.filter((character) => !characterCoveredByOverlay(character, overlays));
    for (const overlay of overlayRoots) {
      characters.push(...collectCharacterRects(overlay.element, overlays));
    }
    state.textBodies = mergeCharactersIntoBodies(characters);
    state.lineBodies = [
      ...lineSegmentsOutsideOverlays(state.baseLineBodies, overlays),
      ...collectMenuLedges(overlays, state.textBodies)
    ];
    state.bodies = [...state.textBodies, ...state.lineBodies];
    state.upwardTraversalCache.clear();
    state.downwardTraversalCache.clear();
    state.normalRouteCache.clear();
    prepareNavigationSurfaces();
    state.webPoints = collectWebPoints(characters, state.lineBodies);
    state.menuLadders = collectMenuLadders(overlays);

    const matchingSurface = previousSurfaceElement
      ? state.textBodies
        .filter((body) => body.sourceRegions?.some((region) => region.element === previousSurfaceElement))
        .toSorted((a, b) => Math.abs(a.y - (player.y + player.height)) - Math.abs(b.y - (player.y + player.height)))[0]
      : null;
    if (matchingSurface) {
      player.y = matchingSurface.y - player.height - 1;
      player.velocityY = 0;
      player.grounded = true;
      player.airJumpsRemaining = 1;
      player.airJumpAt = -Infinity;
      player.standingBody = matchingSurface;
    }
    player.navigationBody = supportingMapBody();
    if (mission.initialized) remapMission(previousGoal, previousRoute, previousGuide, { preservePlannedRoute: true });
    refreshHatchCandidate({ force: true });
    if (mission.initialized && mission.goalKind === "portal" && mission.portalAnchor) {
      // A dropdown rebuild replaces the parent-tab proxy and its body objects.
      // Re-anchor in this same task so the guide cannot spend even one frame
      // pointing at a removed proxy (or disappear there permanently).
      revealGuidedPortalMenu(player.navigationBody, performance.now() / 1000);
    }
    state.needsRebuild = false;
    const rebuildMilliseconds = performance.now() - rebuildStartedAt;
    state.performance.hoverRebuilds += 1;
    state.performance.lastHoverRebuildMs = rebuildMilliseconds;
    state.performance.maximumHoverRebuildMs = Math.max(state.performance.maximumHoverRebuildMs, rebuildMilliseconds);
    window.dispatchEvent(new CustomEvent("eimei-map-built", {
      detail: {
        textBodies: state.textBodies.length,
        lineBodies: state.lineBodies.length,
        totalBodies: state.bodies.length,
        hoverOnly: true
      }
    }));
  }

  function pickSpawnBody() {
    const candidates = state.textBodies.filter((body) =>
      body.width >= 42 &&
      body.y >= 45 &&
      body.y <= Math.min(state.documentHeight - 80, window.innerHeight * 0.72) &&
      body.x >= 8 &&
      body.x + body.width <= state.documentWidth - 8
    );

    const centerX = window.innerWidth * 0.5;
    const centerY = window.innerHeight * 0.34;
    return candidates.toSorted((a, b) => {
      const scoreA = Math.abs(a.x + a.width * 0.5 - centerX) + Math.abs(a.y - centerY) * 0.45 - Math.min(a.width, 300) * 0.12;
      const scoreB = Math.abs(b.x + b.width * 0.5 - centerX) + Math.abs(b.y - centerY) * 0.45 - Math.min(b.width, 300) * 0.12;
      return scoreA - scoreB;
    })[0] || state.bodies[0];
  }

  function bodyCenterX(body) {
    return body.x + body.width * 0.5;
  }

  const recentSpawnStorageKey = "eimei-recent-spawns-v1";

  function pageIdentity(urlLike = location.href) {
    try {
      const url = urlLike instanceof URL ? urlLike : new URL(urlLike, location.href);
      let pathname = url.pathname;
      const sitePath = staticSiteRoot.pathname;
      if (pathname.startsWith(sitePath)) pathname = `/${pathname.slice(sitePath.length)}`;
      if (url.protocol === "file:" && /\/site\//i.test(pathname)) {
        pathname = `/${pathname.split(/\/site\//i).at(-1)}`;
      }
      pathname = pathname.replace(/\/{2,}/g, "/");
      if (pathname === "/" || pathname.endsWith("/")) pathname += "index.html";
      return pathname.toLowerCase();
    } catch {
      return location.pathname.toLowerCase();
    }
  }

  function allRecentSpawnRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(recentSpawnStorageKey) || "[]");
      return Array.isArray(records) ? records.filter((record) => Number.isFinite(record?.x + record?.y)) : [];
    } catch {
      return [];
    }
  }

  function spawnRecordPage(record) {
    if (typeof record?.page === "string") return record.page;
    if (typeof record?.pathname !== "string") return "";
    try {
      return pageIdentity(new URL(record.pathname, staticSiteRoot));
    } catch {
      return record.pathname.toLowerCase();
    }
  }

  function recentSpawnRecords() {
    const currentPage = pageIdentity();
    return allRecentSpawnRecords()
      .filter((record) => spawnRecordPage(record) === currentPage)
      .slice(0, 6);
  }

  function preferUnusedSpawnAreas(candidates, recentSpawns) {
    if (candidates.length < 2 || recentSpawns.length === 0) return candidates;
    const radius = Math.max(320, Math.min(520, window.innerWidth * 0.3));
    const scored = candidates.map((body) => ({
      body,
      distance: Math.max(...(body.navigationXs?.length ? body.navigationXs : [bodyCenterX(body) - player.width * 0.5]).map((x) =>
        Math.min(...recentSpawns.map((record) =>
          Math.hypot(x + player.width * 0.5 - record.x, body.y - record.y)
        ))
      ))
    }));
    const unused = scored.filter((item) => item.distance >= radius).map((item) => item.body);
    if (unused.length > 0) return unused;
    return scored
      .toSorted((a, b) => b.distance - a.distance)
      .slice(0, Math.max(1, Math.ceil(scored.length * 0.45)))
      .map((item) => item.body);
  }

  function rememberSpawnPoint() {
    const record = {
      pathname: location.pathname,
      page: pageIdentity(),
      x: player.x + player.width * 0.5,
      y: player.y + player.height
    };
    try {
      const existing = JSON.parse(localStorage.getItem(recentSpawnStorageKey) || "[]");
      const records = Array.isArray(existing) ? existing : [];
      const separated = records.filter((item) =>
        item?.pathname !== record.pathname || Math.hypot(item.x - record.x, item.y - record.y) >= 80
      );
      localStorage.setItem(recentSpawnStorageKey, JSON.stringify([record, ...separated].slice(0, 30)));
    } catch {
      // Private browsing can disable storage; random selection still works.
    }
  }

  function startPageCandidates() {
    const candidates = [...document.querySelectorAll("#main-nav a[href]")]
      .map((anchor) => portalTarget(anchor))
      .filter(Boolean);
    const unique = new Map();
    for (const target of candidates) {
      const key = pageIdentity(target);
      if (!unique.has(key)) unique.set(key, target);
    }
    return [...unique.entries()].map(([key, target]) => ({ key, target }));
  }

  function redirectToRandomStartPage({ force = false, startAttempt = null, triedPageKeys = [] } = {}) {
    if (race.active) return false;
    const parameters = new URLSearchParams(location.search);
    if (parameters.has("eimei-route") && !force) return false;

    const currentPage = pageIdentity();
    const triedPages = new Set([
      ...(parameters.get("eimei-start-tried") || "").split("|").filter(Boolean),
      ...triedPageKeys
    ]);
    triedPages.add(currentPage);
    const allAlternatives = startPageCandidates().filter((candidate) => candidate.key !== currentPage);
    const untriedAlternatives = allAlternatives.filter((candidate) => !triedPages.has(candidate.key));
    const alternatives = untriedAlternatives.length > 0 ? untriedAlternatives : allAlternatives;
    if (alternatives.length === 0) return false;

    // Every mirrored navigation destination gets the same draw weight. Route
    // quality is checked after the page loads, so favouring showcase pages here
    // only made otherwise-random runs begin in the same kinds of layout.
    const capableAlternatives = alternatives;
    const recentPages = new Set(allRecentSpawnRecords().slice(0, 24).map(spawnRecordPage));
    const unused = capableAlternatives.filter((candidate) => !recentPages.has(candidate.key));
    const pool = unused.length > 0 ? unused : capableAlternatives;
    const selected = pool[randomIndex(pool.length)];
    const target = new URL(selected.target.href);
    target.hash = "";
    target.searchParams.set("eimei-route", "start");
    const previousAttempt = Number.isFinite(startAttempt)
      ? startAttempt
      : Number.parseInt(parameters.get("eimei-start-attempt") || "0", 10) || 0;
    target.searchParams.set("eimei-start-attempt", String(previousAttempt + 1));
    target.searchParams.set("eimei-start-tried", [...triedPages, selected.key].join("|"));
    location.replace(target.href);
    return true;
  }

  function redirectToTutorialStart() {
    if (isPlanningDocument || isCatalogDocument || isTutorialDocument || race.active) return false;
    const parameters = new URLSearchParams(location.search);
    // The final tutorial door and every in-progress page transition carry a
    // route parameter. A clean load has no run context, so it is always a new
    // entrance—even if the address happens to be a deep mirrored page left
    // over from the previous game.
    if (parameters.get("eimei-tutorial") === "done") return false;
    if (parameters.has("eimei-route")) return false;
    location.replace(new URL("tutorial/index.html", staticSiteRoot).href);
    return true;
  }

  function resetGame() {
    if (gameResetting) return;
    gameResetting = true;
    clearScorePickupFeedback();
    clearScoreResult();
    for (const key of Object.keys(input)) {
      if (typeof input[key] === "boolean") input[key] = false;
    }
    if (race.active) {
      respawn();
      gameResetting = false;
      return;
    }
    try {
      sessionStorage.removeItem("eimei-pending-transition");
    } catch {
      // Query parameters still start a clean run when storage is unavailable.
    }
    if (tutorial.active) {
      location.replace(new URL("tutorial/index.html", staticSiteRoot).href);
      return;
    }
    if (redirectToRandomStartPage({ force: true })) return;
    const target = new URL(location.href);
    target.hash = "";
    for (const key of [...target.searchParams.keys()]) {
      if (key.startsWith("eimei-")) target.searchParams.delete(key);
    }
    target.searchParams.set("eimei-route", "start");
    target.searchParams.set("eimei-start-attempt", "0");
    location.replace(target.href);
  }

  function horizontalGap(a, b) {
    if (a.x + a.width < b.x) return b.x - (a.x + a.width);
    if (b.x + b.width < a.x) return a.x - (b.x + b.width);
    return 0;
  }

  function verticalBodyIndex(bodies, bucketSize = 96) {
    const buckets = new Map();
    for (const body of bodies) {
      const first = Math.floor(body.y / bucketSize);
      const last = Math.floor((body.y + Math.max(1, body.height)) / bucketSize);
      for (let bucket = first; bucket <= last; bucket += 1) {
        if (!buckets.has(bucket)) buckets.set(bucket, []);
        buckets.get(bucket).push(body);
      }
    }
    return {
      query(top, bottom) {
        const found = new Set();
        const first = Math.floor(top / bucketSize);
        const last = Math.floor(bottom / bucketSize);
        for (let bucket = first; bucket <= last; bucket += 1) {
          for (const body of buckets.get(bucket) || []) found.add(body);
        }
        return [...found];
      }
    };
  }

  function prepareNavigationSurfaces() {
    const obstacleIndex = verticalBodyIndex(state.bodies);
    for (const body of state.bodies) {
      body.navigationXs = [];
      if (body.width < player.width + 3) continue;
      const left = body.x + 2;
      const right = body.x + body.width - player.width - 2;
      if (right < left) continue;
      const sampleCount = Math.max(2, Math.min(12, Math.ceil(body.width / 34)));
      const samples = [];
      for (let index = 0; index < sampleCount; index += 1) {
        samples.push(left + (right - left) * (index / Math.max(1, sampleCount - 1)));
      }
      for (const point of body.anchorPoints || []) {
        samples.push(Math.max(left, Math.min(point.x - player.width * 0.5, right)));
      }

      for (const x of samples) {
        const standingBox = {
          x,
          y: body.y - player.height - 2,
          width: player.width,
          height: player.height + 1
        };
        const blocked = obstacleIndex.query(standingBox.y, standingBox.y + standingBox.height)
          .some((other) => other !== body && intersects(standingBox, other));
        if (!blocked && !body.navigationXs.some((accepted) => Math.abs(accepted - x) < 3)) {
          body.navigationXs.push(x);
        }
      }
    }
  }

  function ladderCandidateBetween(lowerBody, upperBody, obstacleIndex = null) {
    const topY = upperBody.y + upperBody.height;
    const bottomY = lowerBody.y;
    const height = bottomY - topY;
    const maximumHeight = Math.min(CONFIG.webRange * 0.94, window.innerHeight * CONFIG.ladderMaximumHeightViewport);
    if (height < CONFIG.ladderMinimumHeight || height > maximumHeight) return null;

    const directLeft = lowerBody.x + player.width * 0.5 - 2;
    const directRight = lowerBody.x + lowerBody.width - player.width * 0.5 + 2;
    const lowerLeft = lowerBody.x - CONFIG.ladderGrabHorizontalPx;
    const lowerRight = lowerBody.x + lowerBody.width + CONFIG.ladderGrabHorizontalPx;
    const exitXs = (upperBody.navigationXs || [])
      .filter((x) => x + player.width * 0.5 >= lowerLeft && x + player.width * 0.5 <= lowerRight)
      .toSorted((a, b) => {
        const directA = a + player.width * 0.5 >= directLeft && a + player.width * 0.5 <= directRight;
        const directB = b + player.width * 0.5 >= directLeft && b + player.width * 0.5 <= directRight;
        if (directA !== directB) return directA ? -1 : 1;
        const lowerCenter = bodyCenterX(lowerBody);
        return Math.abs(a + player.width * 0.5 - lowerCenter) - Math.abs(b + player.width * 0.5 - lowerCenter);
      });

    for (const playerX of exitXs) {
      const corridor = {
        x: playerX - 2,
        y: topY + 2,
        width: player.width + 4,
        height: Math.max(0, height - 4)
      };
      const obstacles = obstacleIndex?.query(corridor.y, corridor.y + corridor.height) || state.bodies;
      const blocked = obstacles.some((body) =>
        body !== lowerBody &&
        body !== upperBody &&
        intersects(corridor, body)
      );
      if (blocked) continue;
      return {
        id: "",
        x: playerX + player.width * 0.5,
        width: 22,
        topY,
        bottomY,
        height,
        playerX,
        lowerBody,
        upperBody,
        directAccess: playerX + player.width * 0.5 >= directLeft && playerX + player.width * 0.5 <= directRight,
        rescue: false,
        visualColor: "#111111"
      };
    }
    return null;
  }

  function hasClearWebRiseFrom(body) {
    const startXs = (body.navigationXs || []).filter((_, index, all) =>
      index === 0 || index === all.length - 1 || index === Math.floor(all.length * 0.5)
    );
    const startY = body.y - player.height * 0.56;
    return startXs.some((playerX) => {
      const startX = playerX + player.width * 0.5;
      return state.webPoints.some((point) => {
        const rise = startY - point.y;
        const distance = Math.hypot(point.x - startX, point.y - startY);
        if (rise < CONFIG.webMinimumRise || distance < CONFIG.webMinimumLength || distance > CONFIG.webRange) return false;
        const anchorBody = webBodyAtPoint(point);
        return Boolean(
          anchorBody &&
          normalWebMantleBetween(body, anchorBody) &&
          webLineIsClear(startX, startY, point.x, point.y, anchorBody)
        );
      });
    });
  }

  function tutorialBodyForElement(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + window.scrollX + rect.width * 0.5;
    const centerY = rect.top + window.scrollY + rect.height * 0.5;
    return state.textBodies
      .filter((body) => body.sourceRegions?.some((region) =>
        region.element === element || element.contains(region.element)
      ))
      .toSorted((a, b) =>
        Math.abs(bodyCenterX(a) - centerX) + Math.abs(a.y - centerY) * 3 -
        (Math.abs(bodyCenterX(b) - centerX) + Math.abs(b.y - centerY) * 3)
      )[0] || null;
  }

  function collectTutorialLadders() {
    return [...document.querySelectorAll("[data-eimei-tutorial-ladder]")]
      .map((element, index) => {
        const upperElement = document.getElementById(element.dataset.upper || "");
        const lowerElement = document.getElementById(element.dataset.lower || "");
        const upperBody = tutorialBodyForElement(upperElement);
        const lowerBody = tutorialBodyForElement(lowerElement);
        if (!upperBody || !lowerBody || upperBody.y >= lowerBody.y) return null;
        const rect = element.getBoundingClientRect();
        const x = rect.left + window.scrollX + rect.width * 0.5;
        return {
          id: `tutorial-ladder-${index}`,
          x,
          width: Math.max(18, rect.width),
          topY: upperBody.y,
          bottomY: lowerBody.y,
          height: lowerBody.y - upperBody.y,
          playerX: x - player.width * 0.5,
          lowerBody,
          upperBody,
          directAccess: true,
          rescue: false,
          tutorial: true,
          visualColor: "#111111"
        };
      })
      .filter(Boolean);
  }

  function collectLadders() {
    if (isTutorialDocument) return collectTutorialLadders();
    const bodies = state.bodies.filter((body) =>
      body.navigationXs?.length > 0 &&
      body.y >= 36 &&
      body.y <= state.documentHeight - 12
    );
    const candidates = [];
    const obstacleIndex = verticalBodyIndex(state.bodies);
    const maximumHeight = Math.min(CONFIG.webRange * 0.94, window.innerHeight * CONFIG.ladderMaximumHeightViewport);
    for (const lowerBody of bodies) {
      const potentialUppers = obstacleIndex.query(
        lowerBody.y - maximumHeight - 96,
        lowerBody.y - CONFIG.ladderMinimumHeight
      );
      for (const upperBody of potentialUppers) {
        if (
          upperBody === lowerBody ||
          upperBody.y >= lowerBody.y ||
          horizontalGap(lowerBody, upperBody) > CONFIG.ladderGrabHorizontalPx + player.width + 12
        ) continue;
        const candidate = ladderCandidateBetween(lowerBody, upperBody, obstacleIndex);
        if (candidate) candidates.push(candidate);
      }
    }
    if (candidates.length === 0) return [];

    const baseScore = (candidate) =>
      (candidate.directAccess ? -180 : 0) +
      Math.abs(candidate.height - 190) +
      Math.abs(candidate.x - state.documentWidth * 0.5) * 0.035;
    const analysisPool = (isRaceDocument || isLowPowerDevice())
      ? candidates.toSorted((a, b) => baseScore(a) - baseScore(b)).slice(0, 64)
      : candidates;
    const webRiseCache = new Map();
    for (const candidate of analysisPool) {
      if (!webRiseCache.has(candidate.lowerBody)) {
        webRiseCache.set(candidate.lowerBody, hasClearWebRiseFrom(candidate.lowerBody));
      }
      candidate.rescue = !webRiseCache.get(candidate.lowerBody);
    }
    for (const candidate of candidates) candidate.rescue = Boolean(candidate.rescue);

    const desiredCount = Math.max(2, Math.min(6, Math.round(state.documentHeight / 1600) + 1));
    const score = (candidate) =>
      (candidate.rescue ? -1000 : 0) +
      (candidate.directAccess ? -180 : 0) +
      Math.abs(candidate.height - 190) +
      Math.abs(candidate.x - state.documentWidth * 0.5) * 0.035;
    const sorted = candidates.toSorted((a, b) => score(a) - score(b) || a.bottomY - b.bottomY || a.x - b.x);
    const bandChoices = new Map();
    for (const candidate of sorted) {
      const key = Math.floor((candidate.topY + candidate.bottomY) * 0.5 / 540);
      if (!bandChoices.has(key)) bandChoices.set(key, candidate);
    }

    const selected = [];
    const addCandidate = (candidate) => {
      if (!candidate || selected.length >= desiredCount) return;
      const tooClose = selected.some((other) =>
        Math.abs(other.x - candidate.x) < 92 &&
        Math.abs((other.topY + other.bottomY) * 0.5 - (candidate.topY + candidate.bottomY) * 0.5) < 170
      );
      if (!tooClose) selected.push(candidate);
    };
    for (const candidate of sorted.filter((item) => item.rescue)) addCandidate(candidate);
    for (const candidate of [...bandChoices.entries()].toSorted((a, b) => a[0] - b[0]).map((entry) => entry[1])) {
      addCandidate(candidate);
    }
    for (const candidate of sorted) addCandidate(candidate);

    return selected.map((ladder, index) => ({
      ...ladder,
      id: `ladder-${index}`
    }));
  }

  function collectMenuLadders(overlays = visibleHoverOverlays()) {
    return overlays
      .filter(({ rect }) => rect.height >= Math.max(110, player.height * 3.5))
      .map(({ element, owner, rect }, index) => {
        const ownerRect = owner?.getBoundingClientRect?.() || rect;
        const visualLeft = Math.min(rect.left, ownerRect.left);
        const visualRight = Math.max(rect.right, ownerRect.right);
        const roomRight = window.innerWidth - visualRight;
        const roomLeft = visualLeft;
        const placeRight = roomRight >= 46 || roomRight >= roomLeft;
        // Keep the ladder close enough that a side dismount naturally overlaps
        // the menu floor. A 16px offset plus the narrow player sprite demanded
        // near pixel-perfect timing to reach submenu portals.
        const centerX = (placeRight ? visualRight + 9 : visualLeft - 9) + window.scrollX;
        // Include the parent tab itself. Previously the ladder began below the
        // tab, leaving the top row awkwardly out of reach.
        const topY = Math.min(rect.top, ownerRect.top) + window.scrollY - 2;
        const bottomY = rect.bottom + window.scrollY - 2;
        return {
          id: `menu-ladder-${index}`,
          x: centerX,
          width: 22,
          topY,
          bottomY,
          height: Math.max(0, bottomY - topY),
          playerX: centerX - player.width * 0.5,
          lowerBody: null,
          upperBody: null,
          directAccess: true,
          rescue: false,
          menu: true,
          menuSide: placeRight ? 1 : -1,
          overlayElement: element,
          overlayOwner: owner,
          visualColor: "#111111"
        };
      });
  }

  function collectMenuLedges(overlays, textBodies) {
    const ledges = [];
    let id = 0;
    for (const { element, rect } of overlays) {
      const left = rect.left + window.scrollX;
      const width = rect.width;
      const rowYs = textBodies
        .filter((body) =>
          body.y >= rect.top + window.scrollY - 3 &&
          body.y <= rect.bottom + window.scrollY + 3 &&
          body.sourceRegions?.some((region) => element.contains(region.element))
        )
        .map((body) => body.y)
        .toSorted((a, b) => a - b)
        .filter((y, index, all) => index === 0 || Math.abs(y - all[index - 1]) > 4);
      for (const y of rowYs) {
        ledges.push({
          id: `menu-ledge-${id++}`,
          kind: "line",
          x: left,
          y,
          width,
          height: CONFIG.lineThicknessPx,
          visualColor: "transparent",
          menuLedge: true,
          overlayElement: element
        });
      }
    }
    return ledges;
  }

  function activeLadders() {
    // An expanded navigation menu gets one purpose-built full-height ladder.
    // Hiding unrelated route ladders during that short state prevents a
    // second, apparently ownerless ladder from appearing beside every menu.
    return state.menuLadders.length > 0 ? state.menuLadders : state.ladders;
  }

  function isContentGoalBody(body) {
    if (body.kind !== "text" || !body.anchorPoints?.length || !body.navigationXs?.length) return false;
    return body.sourceRegions.some((region) => !region.element.closest("header, footer"));
  }

  function navigationBodies() {
    return state.bodies.filter((body) =>
      body.navigationXs?.length > 0 &&
      body.y >= 36 &&
      body.y <= state.documentHeight - 12
    );
  }

  function sampledNavigationCenters(body, maximum = 5) {
    const positions = body.navigationXs || [];
    if (positions.length <= maximum) return positions.map((x) => x + player.width * 0.5);
    return Array.from({ length: maximum }, (_, index) => {
      const sourceIndex = Math.round(index * (positions.length - 1) / Math.max(1, maximum - 1));
      return positions[sourceIndex] + player.width * 0.5;
    });
  }

  function cachedTraversalResult(cache, from, to, calculate) {
    let fromCache = cache.get(from);
    if (!fromCache) {
      fromCache = new Map();
      cache.set(from, fromCache);
    }
    if (!fromCache.has(to)) fromCache.set(to, calculate());
    return fromCache.get(to);
  }

  function upwardTraversalIsClear(from, to) {
    return cachedTraversalResult(state.upwardTraversalCache, from, to, () => {
      const startY = from.y - player.height * 0.56;
      const anchors = state.webPoints.filter((point) =>
        point.x >= to.x - 2 &&
        point.x <= to.x + to.width + 2 &&
        point.y >= to.y - 4 &&
        point.y <= to.y + to.height + 4
      );
      const sampledAnchors = anchors.length <= 6
        ? anchors
        : Array.from({ length: 6 }, (_, index) => anchors[Math.round(index * (anchors.length - 1) / 5)]);
      for (const startX of sampledNavigationCenters(from)) {
        for (const anchor of sampledAnchors) {
          const rise = startY - anchor.y;
          const distance = Math.hypot(anchor.x - startX, anchor.y - startY);
          if (rise < CONFIG.webMinimumRise || distance < CONFIG.webMinimumLength || distance > CONFIG.webRange) continue;
          if (webLineIsClear(startX, startY, anchor.x, anchor.y, to)) return true;
        }
      }
      return false;
    });
  }

  function downwardTraversalIsClear(from, to) {
    return cachedTraversalResult(state.downwardTraversalCache, from, to, () => {
      const sourceCenters = sampledNavigationCenters(from);
      return sampledNavigationCenters(to).some((targetX) => {
        if (!sourceCenters.some((sourceX) => Math.abs(sourceX - targetX) <= Math.min(190, window.innerWidth * 0.16))) return false;
        return !state.bodies.some((obstacle) =>
          obstacle !== from &&
          obstacle !== to &&
          obstacle.y > from.y + CONFIG.navigationHorizontalTolerancePx &&
          obstacle.y < to.y - CONFIG.navigationHorizontalTolerancePx &&
          targetX >= obstacle.x - player.width * 0.35 &&
          targetX <= obstacle.x + obstacle.width + player.width * 0.35
        );
      });
    });
  }

  function upwardNeighbors(body, bodies = navigationBodies()) {
    const maximumRise = Math.min(
      CONFIG.webRange - CONFIG.webMinimumLength,
      window.innerHeight * CONFIG.navigationMaximumRiseViewport
    );
    const maximumHorizontalGap = Math.min(CONFIG.webRange * 0.74, window.innerWidth * 0.44);

    const natural = bodies
      .filter((candidate) => {
        if (candidate === body) return false;
        const rise = body.y - candidate.y;
        const gap = horizontalGap(body, candidate);
        return (
          rise >= Math.max(CONFIG.navigationMinimumRise, CONFIG.webMinimumRise) &&
          rise <= maximumRise &&
          gap <= maximumHorizontalGap &&
          Math.hypot(gap, rise) <= CONFIG.webRange * 0.9 &&
          upwardTraversalIsClear(body, candidate)
        );
      });
    const ladderTargets = state.ladders
      .filter((ladder) => bodiesDescribeSamePlatform(ladder.lowerBody, body))
      .map((ladder) => bodies.find((candidate) => bodiesDescribeSamePlatform(candidate, ladder.upperBody)))
      .filter(Boolean);
    return [...natural, ...ladderTargets]
      .filter((candidate, index, all) => all.indexOf(candidate) === index)
      .toSorted((a, b) => {
        const scoreA = (body.y - a.y) * 0.35 + horizontalGap(body, a) - Math.min(a.width, 180) * 0.12;
        const scoreB = (body.y - b.y) * 0.35 + horizontalGap(body, b) - Math.min(b.width, 180) * 0.12;
        return scoreA - scoreB;
      });
  }

  function downwardNeighbors(body, bodies = navigationBodies()) {
    const maximumDrop = Math.min(
      CONFIG.webRange - CONFIG.webMinimumLength,
      window.innerHeight * CONFIG.navigationMaximumRiseViewport
    );
    const maximumHorizontalGap = Math.min(CONFIG.webRange * 0.74, window.innerWidth * 0.44);
    const natural = bodies
      .filter((candidate) => {
        if (candidate === body) return false;
        const drop = candidate.y - body.y;
        const gap = horizontalGap(body, candidate);
        return (
          drop >= CONFIG.navigationMinimumRise &&
          drop <= maximumDrop &&
          gap <= maximumHorizontalGap &&
          Math.hypot(gap, drop) <= CONFIG.webRange * 0.9 &&
          downwardTraversalIsClear(body, candidate)
        );
      });
    const ladderTargets = state.ladders
      .filter((ladder) => bodiesDescribeSamePlatform(ladder.upperBody, body))
      .map((ladder) => bodies.find((candidate) => bodiesDescribeSamePlatform(candidate, ladder.lowerBody)))
      .filter(Boolean);
    return [...natural, ...ladderTargets]
      .filter((candidate, index, all) => all.indexOf(candidate) === index)
      .toSorted((a, b) => {
        const scoreA = (a.y - body.y) * 0.35 + horizontalGap(body, a) - Math.min(a.width, 180) * 0.12;
        const scoreB = (b.y - body.y) * 0.35 + horizontalGap(body, b) - Math.min(b.width, 180) * 0.12;
        return scoreA - scoreB;
      });
  }

  function horizontalNeighbors(body, bodies = navigationBodies()) {
    const maximumGap = Math.min(190, window.innerWidth * 0.16);
    return bodies
      .filter((candidate) => {
        if (candidate === body) return false;
        const verticalDifference = Math.abs(candidate.y - body.y);
        const gap = horizontalGap(body, candidate);
        return verticalDifference <= CONFIG.navigationHorizontalTolerancePx && gap <= maximumGap;
      })
      .toSorted((a, b) => {
        const scoreA = horizontalGap(body, a) + Math.abs(a.y - body.y) * 2;
        const scoreB = horizontalGap(body, b) + Math.abs(b.y - body.y) * 2;
        return scoreA - scoreB;
      });
  }

  function routeNeighbors(body, bodies = navigationBodies()) {
    return [...upwardNeighbors(body, bodies), ...downwardNeighbors(body, bodies), ...horizontalNeighbors(body, bodies)]
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
  }

  function routeFromTo(start, goal, bodies = navigationBodies()) {
    if (!start || !goal) return [];
    if (start === goal) return [start];
    const queue = [start];
    const parent = new Map([[start, null]]);

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of upwardNeighbors(current, bodies)) {
        if (parent.has(next)) continue;
        parent.set(next, current);
        if (next === goal) {
          const route = [goal];
          let step = current;
          while (step) {
            route.push(step);
            step = parent.get(step);
          }
          return route.reverse();
        }
        queue.push(next);
      }
    }
    return [];
  }

  function downwardRouteFromTo(start, goal, bodies = navigationBodies()) {
    if (!start || !goal) return [];
    if (start === goal) return [start];
    const queue = [start];
    const parent = new Map([[start, null]]);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of downwardNeighbors(current, bodies)) {
        if (parent.has(next)) continue;
        parent.set(next, current);
        if (next === goal) {
          const route = [goal];
          let step = current;
          while (step) {
            route.push(step);
            step = parent.get(step);
          }
          return route.reverse();
        }
        queue.push(next);
      }
    }
    return [];
  }

  function generalRouteFromTo(start, goal, bodies = navigationBodies()) {
    if (!start || !goal) return [];
    if (start === goal) return [start];
    const queue = [start];
    const parent = new Map([[start, null]]);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of routeNeighbors(current, bodies)) {
        if (parent.has(next)) continue;
        parent.set(next, current);
        if (next === goal) return reconstructRoute(parent, goal);
        queue.push(next);
      }
    }
    return [];
  }

  function bodiesHaveLadderConnection(from, to) {
    return state.ladders.some((ladder) =>
      (bodiesDescribeSamePlatform(ladder.lowerBody, from) && bodiesDescribeSamePlatform(ladder.upperBody, to)) ||
      (bodiesDescribeSamePlatform(ladder.upperBody, from) && bodiesDescribeSamePlatform(ladder.lowerBody, to))
    );
  }

  function doubleJumpTraversalIsClear(from, to) {
    const rise = from.y - to.y;
    if (rise < CONFIG.navigationMinimumRise || rise > 185) return false;
    const fromCenters = sampledNavigationCenters(from);
    const toCenters = sampledNavigationCenters(to);
    const leftEdge = to.x;
    const rightEdge = to.x + to.width;
    const canRoundAnEdge = fromCenters.some((fromX) => toCenters.some((toX) => {
      if (Math.abs(fromX - toX) > 185) return false;
      const leftApproach = fromX <= leftEdge + 5 && toX <= leftEdge + player.width + 18;
      const rightApproach = fromX >= rightEdge - 5 && toX >= rightEdge - player.width - 18;
      return leftApproach || rightApproach;
    }));
    return canRoundAnEdge && downwardTraversalIsClear(to, from);
  }

  function normalWebMantleBetween(from, to) {
    const rise = from.y - to.y;
    if (
      rise < Math.max(CONFIG.navigationMinimumRise, CONFIG.webMinimumRise) ||
      rise > CONFIG.webRange - CONFIG.webMinimumLength ||
      !upwardTraversalIsClear(from, to)
    ) return false;
    const edgeCenters = [to.x, to.x + to.width];
    const safeTopCenters = sampledNavigationCenters(to).filter((centerX) =>
      edgeCenters.some((edgeX) => Math.abs(centerX - edgeX) <= player.width + 24)
    );
    if (safeTopCenters.length === 0) return false;
    return sampledNavigationCenters(from).some((centerX) =>
      edgeCenters.some((edgeX) => Math.abs(centerX - edgeX) <= CONFIG.webMantleMaximumEdgeDistance)
    );
  }

  function bodiesHaveNormalNavigationEdge(from, to) {
    if (!from || !to || from === to) return from === to;
    const verticalDifference = to.y - from.y;
    if (Math.abs(verticalDifference) <= CONFIG.navigationHorizontalTolerancePx) {
      return horizontalGap(from, to) <= Math.min(190, window.innerWidth * 0.16);
    }
    if (bodiesHaveLadderConnection(from, to)) return true;
    if (verticalDifference > 0) return bodiesHaveNavigationEdge(from, to);
    return doubleJumpTraversalIsClear(from, to) || normalWebMantleBetween(from, to);
  }

  function normalRouteFromTo(start, goal, bodies = navigationBodies()) {
    if (!start || !goal) return [];
    if (start === goal) return [start];
    let goalCache = state.normalRouteCache.get(start);
    if (!goalCache) {
      goalCache = new Map();
      state.normalRouteCache.set(start, goalCache);
    }
    if (goalCache.has(goal)) return goalCache.get(goal);
    const queue = [start];
    const parent = new Map([[start, null]]);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of bodies) {
        if (parent.has(next) || !bodiesHaveNormalNavigationEdge(current, next)) continue;
        parent.set(next, current);
        if (next === goal) {
          const route = reconstructRoute(parent, goal);
          goalCache.set(goal, route);
          return route;
        }
        queue.push(next);
      }
    }
    goalCache.set(goal, []);
    return [];
  }

  function clearHatchCandidate(support = null) {
    state.hatchCandidate = null;
    state.hatchSupportBody = support;
  }

  function hatchSurfaceIsEligible(body) {
    if (
      !body ||
      (body.kind !== "text" && body.kind !== "line") ||
      body.width < CONFIG.hatchMinimumSurfaceWidth ||
      body.menuLedge
    ) return false;
    const sources = body.kind === "text"
      ? (body.sourceRegions || []).map((region) => region.element)
      : [body.sourceElement].filter(Boolean);
    return !sources.some((element) => element.closest?.("header, footer, #main-nav, .menu"));
  }

  function refreshHatchCandidate({ force = false } = {}) {
    if (!mission.initialized || mission.completed || !mission.goalBody) {
      clearHatchCandidate();
      return null;
    }
    const nowSeconds = performance.now() / 1000;
    const support = player.navigationBody || supportingMapBody();
    if (!support) return state.hatchCandidate;
    const tutorialCheckpoint = tutorialCurrentCheckpoint();
    if (tutorial.active && tutorialCheckpoint?.dataset.require === "reel") {
      const authoredSurface = tutorialCheckpoint.closest("[data-eimei-tutorial-stage]")
        ?.querySelector("[data-eimei-tutorial-hatch]");
      const hatchBody = tutorialBodyForElement(authoredSurface);
      if (hatchBody) {
        const preferredCenterX = Math.max(
          hatchBody.x + player.width * 0.5 + 1,
          Math.min(player.x + player.width * 0.5, hatchBody.x + hatchBody.width - player.width * 0.5 - 1)
        );
        const exitX = hatchExitPlayerX(hatchBody, preferredCenterX);
        if (Number.isFinite(exitX)) {
          const previousBody = state.hatchCandidate?.body;
          state.hatchCandidate = {
            body: hatchBody,
            fromBody: support,
            centerX: exitX + player.width * 0.5,
            width: Math.max(player.width, Math.min(38, hatchBody.width - 2))
          };
          state.hatchSupportBody = support;
          state.hatchCandidateCheckedAt = nowSeconds;
          if (!bodiesDescribeSamePlatform(previousBody, hatchBody)) state.hatchCandidateSetAt = nowSeconds;
          return state.hatchCandidate;
        }
      }
    }
    if (
      !force &&
      bodiesDescribeSamePlatform(support, state.hatchSupportBody) &&
      nowSeconds - state.hatchCandidateCheckedAt < 0.55
    ) return state.hatchCandidate;
    state.hatchCandidateCheckedAt = nowSeconds;

    const fullRoute = generalRouteFromTo(support, mission.goalBody);
    const upwardSteps = fullRoute.slice(1).map((to, index) => ({
      from: fullRoute[index],
      to
    })).filter(({ from, to }) =>
      to.y < from.y - CONFIG.navigationHorizontalTolerancePx &&
      hatchSurfaceIsEligible(to)
    );
    const blockedStep = upwardSteps.find(({ from, to }) =>
      bodiesDescribeSamePlatform(from, support) &&
      to.y < from.y - CONFIG.navigationHorizontalTolerancePx &&
      !bodiesHaveNormalNavigationEdge(from, to)
    );
    // Width only makes a surface eligible; it does not place a hatch by itself.
    // Grow one solely on the immediate mission step that cannot be crossed by
    // ordinary jump/double-jump/ladder navigation. This keeps long copy and
    // separator lines mostly untouched while retaining hatches where they matter.
    const fallbackStep = blockedStep;
    if (!fallbackStep) {
      clearHatchCandidate(support);
      return null;
    }

    const preferredCenterX = Math.max(
      fallbackStep.to.x + player.width * 0.5 + 1,
      Math.min(player.x + player.width * 0.5, fallbackStep.to.x + fallbackStep.to.width - player.width * 0.5 - 1)
    );
    const exitX = hatchExitPlayerX(fallbackStep.to, preferredCenterX);
    if (!Number.isFinite(exitX)) {
      clearHatchCandidate(support);
      return null;
    }
    const previousBody = state.hatchCandidate?.body;
    state.hatchCandidate = {
      body: fallbackStep.to,
      fromBody: fallbackStep.from,
      centerX: exitX + player.width * 0.5,
      width: Math.max(player.width, Math.min(38, fallbackStep.to.width - 2))
    };
    state.hatchSupportBody = support;
    if (!bodiesDescribeSamePlatform(previousBody, fallbackStep.to)) state.hatchCandidateSetAt = nowSeconds;
    return state.hatchCandidate;
  }

  function hatchIsAvailableFor(body) {
    return Boolean(body && state.hatchCandidate?.body && bodiesDescribeSamePlatform(body, state.hatchCandidate.body));
  }

  function randomIndex(length) {
    if (length <= 1) return 0;
    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      crypto.getRandomValues(value);
      return value[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function reachableRoutes(start, bodies, neighbors = routeNeighbors) {
    const queue = [start];
    const parent = new Map([[start, null]]);
    const depth = new Map([[start, 0]]);

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of neighbors(current, bodies)) {
        if (parent.has(next)) continue;
        parent.set(next, current);
        depth.set(next, depth.get(current) + 1);
        queue.push(next);
      }
    }
    return { queue, parent, depth };
  }

  function reconstructRoute(parent, goal) {
    const route = [];
    for (let step = goal; step; step = parent.get(step)) route.push(step);
    return route.reverse();
  }

  function routeTravelDistance(route) {
    let distance = 0;
    for (let index = 1; index < route.length; index += 1) {
      distance += Math.hypot(
        bodyCenterX(route[index]) - bodyCenterX(route[index - 1]),
        route[index].y - route[index - 1].y
      );
    }
    return distance;
  }

  function bodiesHaveNavigationEdge(from, to) {
    if (!from || !to || from === to) return from === to;
    const verticalDifference = to.y - from.y;
    const gap = horizontalGap(from, to);
    const horizontalMaximum = Math.min(190, window.innerWidth * 0.16);
    if (Math.abs(verticalDifference) <= CONFIG.navigationHorizontalTolerancePx) {
      return gap <= horizontalMaximum;
    }
    if (bodiesHaveLadderConnection(from, to)) return true;
    const maximumVertical = Math.min(
      CONFIG.webRange - CONFIG.webMinimumLength,
      window.innerHeight * CONFIG.navigationMaximumRiseViewport
    );
    const maximumGap = Math.min(CONFIG.webRange * 0.74, window.innerWidth * 0.44);
    if (gap > maximumGap || Math.hypot(gap, verticalDifference) > CONFIG.webRange * 0.9) return false;
    if (verticalDifference < 0) {
      return -verticalDifference >= Math.max(CONFIG.navigationMinimumRise, CONFIG.webMinimumRise) &&
        -verticalDifference <= maximumVertical &&
        upwardTraversalIsClear(from, to);
    }
    return verticalDifference >= CONFIG.navigationMinimumRise &&
      verticalDifference <= maximumVertical &&
      downwardTraversalIsClear(from, to);
  }

  function routeIsPhysicallyConnected(route) {
    if (route.length < 2) return route.length === 1;
    return route.slice(1).every((body, index) => bodiesHaveNavigationEdge(route[index], body));
  }

  function navigationEdgeDiagnostics(from, to) {
    const ladder = state.ladders.find((candidate) =>
      (bodiesDescribeSamePlatform(candidate.lowerBody, from) && bodiesDescribeSamePlatform(candidate.upperBody, to)) ||
      (bodiesDescribeSamePlatform(candidate.upperBody, from) && bodiesDescribeSamePlatform(candidate.lowerBody, to))
    );
    return {
      physical: bodiesHaveNavigationEdge(from, to),
      ladder: Boolean(ladder),
      fromKind: from?.kind || null,
      toKind: to?.kind || null,
      fromSources: from?.sourceRegions?.map((region) => region.element.textContent.trim().slice(0, 24)) || [],
      toSources: to?.sourceRegions?.map((region) => region.element.textContent.trim().slice(0, 24)) || []
    };
  }

  function directBodyDistance(start, goal) {
    if (!start || !goal) return 0;
    return Math.hypot(bodyCenterX(goal) - bodyCenterX(start), goal.y - start.y);
  }

  function bodyRepresentsPortalTrigger(body, hoverTrigger, submenu) {
    return Boolean(
      body &&
      hoverTrigger &&
      submenu &&
      body.sourceRegions?.some((region) =>
        (region.element === hoverTrigger || hoverTrigger.contains(region.element)) &&
        !submenu.contains(region.element)
      )
    );
  }

  function portalBodyForAnchor(anchor, bodies = navigationBodies()) {
    const visibleBody = state.textBodies.find((candidate) =>
      bodies.includes(candidate) &&
      candidate.navigationXs?.length &&
      candidate.sourceRegions?.some((region) => region.element.closest("a[href]") === anchor)
    );
    if (visibleBody) return visibleBody;

    const submenu = anchor.closest(".menu > li > ul");
    const hoverTrigger = submenu?.parentElement;
    // Once the menu is open, its parent tab is no longer a legitimate stand-in
    // for a child link. Returning that proxy here is what allowed the guide to
    // remain at an empty/stale coordinate instead of the visible portal row.
    if (!hoverTrigger || isElementVisible(submenu)) return null;
    return state.textBodies.find((candidate) =>
      bodies.includes(candidate) &&
      candidate.navigationXs?.length &&
      bodyRepresentsPortalTrigger(candidate, hoverTrigger, submenu)
    ) || null;
  }

  function routeDirectionChanges(route) {
    let previousDirection = 0;
    let changes = 0;
    for (let index = 1; index < route.length; index += 1) {
      const delta = route[index].y - route[index - 1].y;
      if (Math.abs(delta) < CONFIG.navigationMinimumRise) continue;
      const direction = Math.sign(delta);
      if (previousDirection && direction !== previousDirection) changes += 1;
      previousDirection = direction;
    }
    return changes;
  }

  function isGlobalNavigationAnchor(anchor) {
    return Boolean(anchor?.closest?.("#main-nav .menu"));
  }

  function portalMissionCandidates(bodies, excludedPaths = new Set()) {
    const candidates = [];
    for (const anchor of document.querySelectorAll("a[href]")) {
      // Fixed section navigation can overlap the desktop header on the source
      // site itself. Players may still use its visible links, but mission
      // planning must never choose one as the required portal.
      if (anchor.closest("#side, #side-wide, #tabbed")) continue;
      // Portals need a physical text row after a hidden menu opens. Image-only
      // and empty utility links can borrow their parent tab during planning but
      // have nowhere real to place a door, which strands the guide in mid-air.
      if (!/\S/u.test(anchor.textContent || "")) continue;
      const target = portalTarget(anchor);
      const targetPage = target ? pageIdentity(target) : "";
      if (
        !target ||
        targetPage === pageIdentity() ||
        excludedPaths.has(targetPage)
      ) continue;
      const body = portalBodyForAnchor(anchor, bodies);
      if (!body) continue;
      const region = anchorRegion(body, anchor);
      let hasSafeDoorway = body.navigationXs.some((x) =>
        x + player.width * 0.5 >= region.left && x + player.width * 0.5 <= region.right
      );
      if (!hasSafeDoorway) {
        const doorwayX = Math.max(
          body.x + 2,
          Math.min((region.left + region.right - player.width) * .5, body.x + body.width - player.width - 2)
        );
        const standingBox = {
          x: doorwayX,
          y: body.y - player.height - 2,
          width: player.width,
          height: player.height + 1
        };
        const blocked = state.bodies.some((other) => other !== body && intersects(standingBox, other));
        if (!blocked) {
          body.navigationXs.push(doorwayX);
          hasSafeDoorway = true;
        }
      }
      if (hasSafeDoorway) candidates.push({
        anchor,
        target,
        body,
        globalNavigation: isGlobalNavigationAnchor(anchor)
      });
    }
    return candidates;
  }

  function pickPortalMission(bodies, spawnCandidates, minimumTravel, maximumTravel, excludedPaths = new Set()) {
    const portals = portalMissionCandidates(bodies, excludedPaths);
    if (portals.length === 0) return null;
    const starts = spawnCandidates
      .map((body) => ({ body, order: Math.random() }))
      .toSorted((a, b) => a.order - b.order)
      .map((item) => item.body);
    const options = [];
    for (const spawn of starts.slice(0, 36)) {
      const reachable = reachableRoutes(spawn, bodies);
      for (const portal of portals) {
        const depth = reachable.depth.get(portal.body) || 0;
        if (
          depth < Math.max(5, Math.ceil(CONFIG.missionMinimumSteps * 0.65)) ||
          depth > Math.max(8, Math.ceil(CONFIG.missionMaximumSteps * 0.65))
        ) continue;
        const route = reconstructRoute(reachable.parent, portal.body);
        const distance = routeTravelDistance(route);
        if (distance < Math.max(900, minimumTravel * 0.42) || distance > maximumTravel * 0.62) continue;
        options.push({
          spawn,
          goal: portal.body,
          route,
          routeDistance: distance,
          goalKind: "portal",
          portalAnchor: portal.anchor,
          portalDestination: portal.target,
          globalNavigation: portal.globalNavigation,
          continuationMode: ["ascent", "descent", "mixed"][randomIndex(3)]
        });
      }
    }
    // Pick the starting platform first and the portal second. Sampling the flat
    // option list made a handful of platforms with many nearby links dominate
    // the draw, so "random" starts repeatedly meant the same three places.
    const optionsBySpawn = new Map();
    for (const option of options) {
      if (!optionsBySpawn.has(option.spawn)) optionsBySpawn.set(option.spawn, []);
      optionsBySpawn.get(option.spawn).push(option);
    }
    const spawnGroups = [...optionsBySpawn.values()];
    const selectedGroup = spawnGroups[randomIndex(spawnGroups.length)];
    return selectedGroup?.[randomIndex(selectedGroup.length)] || null;
  }

  function pickMixedMission(bodies, spawnCandidates, minimumTravel, maximumTravel, minimumVertical, minimumDirect, minimumSteps, maximumSteps) {
    const starts = spawnCandidates
      .map((body) => ({ body, order: Math.random() }))
      .toSorted((a, b) => a.order - b.order)
      .map((item) => item.body);
    for (const spawn of starts.slice(0, 18)) {
      const firstReach = reachableRoutes(spawn, bodies);
      const waypoints = firstReach.queue
        .filter((body) =>
          (firstReach.depth.get(body) || 0) >= 3 &&
          Math.abs(body.y - spawn.y) >= minimumVertical * 0.7
        )
        .map((body) => ({ body, order: Math.random() }))
        .toSorted((a, b) => a.order - b.order)
        .map((item) => item.body);
      for (const waypoint of waypoints.slice(0, 12)) {
        const firstDirection = Math.sign(waypoint.y - spawn.y);
        const secondReach = reachableRoutes(waypoint, bodies);
        const goals = secondReach.queue.filter((goal) =>
          isContentGoalBody(goal) &&
          goal !== spawn &&
          Math.sign(goal.y - waypoint.y) === -firstDirection &&
          (secondReach.depth.get(goal) || 0) >= 3
        );
        for (const goal of goals.slice(0, 16)) {
          const route = [
            ...reconstructRoute(firstReach.parent, waypoint),
            ...reconstructRoute(secondReach.parent, goal).slice(1)
          ];
          const distance = routeTravelDistance(route);
          if (
            route.length - 1 >= minimumSteps &&
            route.length - 1 <= maximumSteps &&
            distance >= minimumTravel &&
            distance <= maximumTravel &&
            directBodyDistance(spawn, goal) >= minimumDirect
          ) {
            return { spawn, goal, route, routeDistance: distance, goalKind: "text" };
          }
        }
      }
    }
    return null;
  }

  function pickMissionPair(forcedMode = null, excludedPaths = new Set(), fixedSpawn = null, limits = {}) {
    const bodies = navigationBodies();
    const allSpawnCandidates = fixedSpawn
      ? [fixedSpawn]
      : bodies.filter((body) => body.width >= Math.max(70, player.width * 3));
    const spawnCandidates = fixedSpawn
      ? allSpawnCandidates
      : preferUnusedSpawnAreas(allSpawnCandidates, limits.recentSpawns || []);
    const minimumSteps = limits.minimumSteps ?? CONFIG.missionMinimumSteps;
    const maximumSteps = limits.maximumSteps ?? CONFIG.missionMaximumSteps;
    const minimumVertical = Math.max(260, window.innerHeight * CONFIG.missionMinimumVerticalViewport * 0.55);
    const minimumTravel = limits.minimumTravel ?? Math.max(1250, window.innerHeight * CONFIG.missionMinimumTravelViewport);
    const maximumTravel = limits.maximumTravel ?? Math.max(minimumTravel + 900, window.innerHeight * CONFIG.missionMaximumTravelViewport);
    const minimumDirect = limits.minimumDirect ?? Math.max(720, window.innerHeight * CONFIG.missionMinimumDirectViewport);
    if (forcedMode === "portal" || (!forcedMode && Math.random() < CONFIG.missionPortalChance)) {
      let portalMission = pickPortalMission(bodies, spawnCandidates, minimumTravel, maximumTravel, excludedPaths);
      if (portalMission) return portalMission;
    }

    const mode = forcedMode && forcedMode !== "portal"
      ? forcedMode
      : ["ascent", "descent", "mixed", "any"][randomIndex(4)];
    if (mode === "mixed") {
      const mixedMission = pickMixedMission(
        bodies,
        spawnCandidates,
        minimumTravel,
        maximumTravel,
        minimumVertical,
        minimumDirect,
        minimumSteps,
        maximumSteps
      );
      if (mixedMission) return mixedMission;
    }
    const shuffledStarts = spawnCandidates
      .map((body) => ({ body, order: Math.random() }))
      .toSorted((a, b) => a.order - b.order)
      .map((item) => item.body);
    const fallbackOptions = [];

    for (const spawn of shuffledStarts.slice(0, 48)) {
      const reachable = reachableRoutes(spawn, bodies);
      const goals = reachable.queue.map((goal) => {
        const route = reconstructRoute(reachable.parent, goal);
        return { goal, route, distance: routeTravelDistance(route), changes: routeDirectionChanges(route) };
      }).filter(({ goal, route, distance, changes }) => {
        if (
          !isContentGoalBody(goal) ||
          route.length - 1 < minimumSteps ||
          route.length - 1 > maximumSteps ||
          distance < minimumTravel ||
          distance > maximumTravel ||
          directBodyDistance(spawn, goal) < minimumDirect
        ) return false;
        if (mode === "ascent") return spawn.y - goal.y >= minimumVertical;
        if (mode === "descent") return goal.y - spawn.y >= minimumVertical;
        if (mode === "mixed") return changes >= 1;
        return true;
      });
      if (goals.length > 0) {
        const selected = goals[randomIndex(goals.length)];
        return { spawn, goal: selected.goal, route: selected.route, routeDistance: selected.distance, goalKind: "text" };
      }

      const farthest = reachable.queue
        .filter((body) => isContentGoalBody(body))
        .map((goal) => ({ goal, route: reconstructRoute(reachable.parent, goal) }))
        .map((item) => ({ ...item, distance: routeTravelDistance(item.route) }))
        .filter((item) => item.route.length - 1 <= maximumSteps && item.distance <= maximumTravel)
        .toSorted((a, b) =>
          directBodyDistance(spawn, b.goal) + b.distance * 0.35 -
          (directBodyDistance(spawn, a.goal) + a.distance * 0.35)
        )[0];
      if (farthest) fallbackOptions.push({
        spawn,
        goal: farthest.goal,
        route: farthest.route,
        routeDistance: farthest.distance,
        goalKind: "text"
      });
    }
    const usefulFallbacks = fallbackOptions.filter((option) =>
      option.route.length > 1 &&
      option.routeDistance >= Math.max(420, minimumTravel * 0.24) &&
      directBodyDistance(option.spawn, option.goal) >= Math.max(420, minimumDirect * 0.5)
    );
    const fallbackPool = usefulFallbacks.length > 0 ? usefulFallbacks : fallbackOptions;
    return fallbackPool[randomIndex(fallbackPool.length)] || null;
  }

  function bodyForPortalAnchor(anchor, bodies = navigationBodies()) {
    return portalBodyForAnchor(anchor, bodies);
  }

  function incomingPortalSpawn(fromPath) {
    const bodies = navigationBodies();
    const reciprocal = [...document.querySelectorAll("a[href]")]
      .map((anchor) => ({ anchor, target: portalTarget(anchor) }))
      .filter(({ target }) => target && pageIdentity(target) === pageIdentity(fromPath))
      .map(({ anchor }) => bodyForPortalAnchor(anchor, bodies))
      .filter(Boolean);
    // The planner iframe and the real arrival must choose the same reciprocal
    // foothold. Random selection here could make a distant planned goal appear
    // right beside the player after the actual page transition.
    if (reciprocal.length > 0) {
      return reciprocal.toSorted((a, b) =>
        a.y - b.y || bodyCenterX(a) - bodyCenterX(b)
      )[0];
    }

    const linked = portalMissionCandidates(bodies, new Set([pageIdentity()])).map((item) => item.body);
    const candidates = linked.length > 0 ? linked : bodies;
    return candidates.toSorted((a, b) =>
      a.y + Math.abs(bodyCenterX(a) - window.innerWidth * 0.5) * 0.2 -
      (b.y + Math.abs(bodyCenterX(b) - window.innerWidth * 0.5) * 0.2)
    )[0] || null;
  }

  function bridgePortalMissionOptions(spawn, excludedPaths, continuationMode) {
    if (!spawn) return null;
    const bodies = navigationBodies();
    const portals = portalMissionCandidates(bodies, excludedPaths);
    const reachable = reachableRoutes(spawn, bodies);
    const maximumSegmentDistance = Math.max(5600, window.innerHeight * 8.8);
    const maximumPortalDepth = Math.max(8, Math.floor(CONFIG.missionMaximumSteps * 0.62));
    const options = portals.map((portal) => {
      const depth = reachable.depth.get(portal.body) || 0;
      if (!reachable.parent.has(portal.body) || depth > maximumPortalDepth) return null;
      // Use the real path to the portal. The former detour deliberately went
      // deep into a page and then returned to the same header link, which made
      // the guide reverse direction for no player-visible reason.
      const route = reconstructRoute(reachable.parent, portal.body);
      const distance = routeTravelDistance(route);
      if (distance > maximumSegmentDistance) return null;
      return {
        spawn,
        goal: portal.body,
        route,
        routeDistance: distance,
        goalKind: "portal",
        portalAnchor: portal.anchor,
        portalDestination: portal.target,
        globalNavigation: portal.globalNavigation,
        continuationMode: continuationMode || ["ascent", "descent", "mixed"][randomIndex(3)]
      };
    }).filter(Boolean);
    const useful = options.filter((option) => option.route.length > 1 && option.routeDistance >= 80);
    const ranked = (useful.length > 0 ? useful : options)
      .toSorted((a, b) => b.routeDistance - a.routeDistance);
    return ranked;
  }

  function pickBridgePortalMission(spawn, excludedPaths, continuationMode) {
    const options = bridgePortalMissionOptions(spawn, excludedPaths, continuationMode) || [];
    const variedFarPool = options.slice(0, Math.max(1, Math.ceil(options.length * 0.55)));
    return variedFarPool[randomIndex(variedFarPool.length)] || null;
  }

  function planningDestinationPriority(destination) {
    const path = pageIdentity(destination);
    if (path === "/openschool/top.html" || path === "/information/c-onestep.html") return 5;
    if (path === "/information/course.html") return 4;
    if (/^\/information\/c-[^/]+course\.html$/.test(path) || path === "/information/i-event.html") return 3;
    if (path.startsWith("/news/")) return 2;
    return 0;
  }

  function finalGoalSpecFromParameters(parameters) {
    const page = parameters.get("eimei-final-page");
    const x = Number.parseFloat(parameters.get("eimei-final-x") || "");
    const y = Number.parseFloat(parameters.get("eimei-final-y") || "");
    return page?.startsWith("/") && Number.isFinite(x + y) ? { page, x, y } : null;
  }

  function routePairToFixedGoal(spawn, specification) {
    if (!spawn || !specification || pageIdentity() !== specification.page) return null;
    const bodies = navigationBodies();
    const reachable = reachableRoutes(spawn, bodies);
    const candidates = reachable.queue
      .filter((body) => body !== spawn && isContentGoalBody(body))
      .map((goal) => {
        const route = reconstructRoute(reachable.parent, goal);
        const xDistance = Math.abs(bodyCenterX(goal) - specification.x);
        const yDistance = Math.abs(goal.y - specification.y);
        return { goal, route, score: yDistance * 4 + xDistance };
      })
      .filter((item) => item.route.length > 1)
      .toSorted((a, b) => a.score - b.score);
    const selected = candidates[0];
    if (!selected) return null;
    return {
      spawn,
      goal: selected.goal,
      route: selected.route,
      routeDistance: routeTravelDistance(selected.route),
      goalKind: "text"
    };
  }

  function pickPlannedFinalMission(spawn, minimumDistance = 0) {
    if (!spawn) return null;
    const bodies = navigationBodies();
    const reachable = reachableRoutes(spawn, bodies);
    const allOptions = reachable.queue
      .filter((goal) => goal !== spawn && isContentGoalBody(goal))
      .map((goal) => {
        const route = reconstructRoute(reachable.parent, goal);
        return {
          goal,
          route,
          distance: routeTravelDistance(route),
          directDistance: directBodyDistance(spawn, goal)
        };
      })
      .filter((item) => item.route.length > 1)
      .toSorted((a, b) => b.distance - a.distance);
    const minimumDirect = Math.max(1100, window.innerHeight * CONFIG.missionFinalMinimumDirectViewport);
    const visiblyDistant = allOptions.filter((item) => item.directDistance >= minimumDirect);
    const goalOptions = visiblyDistant.length > 0 ? visiblyDistant : allOptions;
    const longRoutes = goalOptions.filter((item) => item.route.length >= 4);
    const useful = longRoutes.filter((item) => item.distance >= Math.max(900, window.innerHeight * 1.8));
    const requiredDistance = Math.max(minimumDistance, Math.max(900, window.innerHeight * 1.8));
    const distanceQualified = goalOptions
      .filter((item) => item.distance >= requiredDistance)
      .toSorted((a, b) => a.distance - b.distance);
    const ranked = distanceQualified.length > 0
      ? distanceQualified
      : useful.length > 0 ? useful : longRoutes.length > 0 ? longRoutes : goalOptions;
    const pool = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.35)));
    const selected = pool[randomIndex(pool.length)];
    if (!selected) return null;
    return {
      spawn,
      goal: selected.goal,
      route: selected.route,
      routeDistance: selected.distance,
      goalKind: "text"
    };
  }

  function pickPortalTowardFinalPage(spawn, finalPage, excludedPaths, {
    allowGlobalNavigation = true,
    allowFallback = true
  } = {}) {
    if (!spawn || !finalPage) return null;
    const allOptions = bridgePortalMissionOptions(spawn, excludedPaths, "any") || [];
    const options = allowGlobalNavigation
      ? allOptions
      : allOptions.filter((option) => !option.globalNavigation);
    const direct = options.filter((option) => pageIdentity(option.portalDestination) === finalPage);
    if (direct.length > 0) return direct[randomIndex(Math.max(1, Math.ceil(direct.length * 0.25)))];
    if (!allowFallback) return null;
    const variedFarPool = options.slice(0, Math.max(1, Math.ceil(options.length * 0.55)));
    return variedFarPool[randomIndex(variedFarPool.length)] || null;
  }

  function pickPortalTowardAnyPlannedPage(spawn, pages, excludedPaths, {
    allowGlobalNavigation = true
  } = {}) {
    if (!spawn || !Array.isArray(pages) || pages.length === 0) return null;
    const orderedPages = pages.filter((page, index, all) =>
      page && page !== pageIdentity() && all.indexOf(page) === index
    );
    if (orderedPages.length === 0) return null;
    const allOptions = bridgePortalMissionOptions(spawn, excludedPaths, "any") || [];
    const options = allowGlobalNavigation
      ? allOptions
      : allOptions.filter((option) => !option.globalNavigation);
    for (const page of orderedPages) {
      const direct = options.filter((option) => pageIdentity(option.portalDestination) === page);
      if (direct.length > 0) {
        return direct[randomIndex(Math.max(1, Math.ceil(direct.length * 0.25)))];
      }
    }
    return null;
  }

  function bodiesDescribeSamePlatform(first, second) {
    if (!first || !second || first.kind !== second.kind) return false;
    if (first === second) return true;
    if (first.kind === "text") {
      const firstElements = new Set((first.sourceRegions || []).map((region) => region.element));
      const sharesElement = (second.sourceRegions || []).some((region) => firstElements.has(region.element));
      const verticalTolerance = Math.max(8, Math.min(18, Math.max(first.height, second.height) * 0.55));
      const horizontalGap = Math.max(0, Math.max(first.x, second.x) - Math.min(first.x + first.width, second.x + second.width));
      if (sharesElement && Math.abs(first.y - second.y) <= verticalTolerance && horizontalGap <= 18) return true;
    }
    const overlap = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
    const minimumWidth = Math.max(1, Math.min(first.width, second.width));
    return Math.abs(first.y - second.y) <= 8 && overlap / minimumWidth >= 0.55;
  }

  function setGuideBody(body, { launchFromPlayer = true, preferredX = null, preserveTarget = false } = {}) {
    const previousBody = mission.guideBody;
    const previousPoint = mission.guidePoint;
    const samePlatform = preserveTarget || bodiesDescribeSamePlatform(previousBody, body);
    mission.guideBody = body || null;
    const targetX = body === mission.goalBody && mission.goalPoint
      ? mission.goalPoint.x
      : Number.isFinite(preferredX)
        ? preferredX
        : samePlatform && Number.isFinite(previousPoint?.x)
          ? previousPoint.x
          : player.x + player.width * 0.5;
    const safeCenterX = body?.navigationXs?.length
      ? body.navigationXs
        .map((x) => x + player.width * 0.5)
        .toSorted((a, b) => Math.abs(a - targetX) - Math.abs(b - targetX))[0]
      : null;
    mission.guidePoint = body ? {
      x: Number.isFinite(safeCenterX)
        ? safeCenterX
        : Math.max(body.x + 7, Math.min(targetX, body.x + body.width - 7)),
      y: body.y - 9
    } : null;
    const nowSeconds = performance.now() / 1000;
    if (!samePlatform) {
      mission.guideSetAt = nowSeconds;
      mission.guideNearSince = -Infinity;
      mission.guideLockUntil = nowSeconds + CONFIG.navigationTargetLockSeconds;
      mission.guideOriginY = player.y + player.height;
      mission.lostGuideSince = -Infinity;
      mission.overtookGuideSince = -Infinity;
    }
    if (samePlatform && previousPoint && mission.guidePoint) {
      const dx = mission.guidePoint.x - previousPoint.x;
      const dy = mission.guidePoint.y - previousPoint.y;
      if (Number.isFinite(mission.wispX + mission.wispY)) {
        mission.wispX += dx;
        mission.wispY += dy;
        mission.wispFromX += dx;
        mission.wispFromY += dy;
        for (const point of mission.trail) {
          point.x += dx;
          point.y += dy;
        }
      }
      return;
    }
    mission.wispAnchored = false;
    mission.trail.length = 0;
    mission.trailClock = 0;
    if (launchFromPlayer || !Number.isFinite(mission.wispX + mission.wispY)) {
      mission.wispX = player.x + player.width * 0.5;
      mission.wispY = player.y + player.height * 0.35;
    }
    mission.wispFromX = mission.wispX;
    mission.wispFromY = mission.wispY;
  }

  function setKeypointGuide({ launchFromPlayer = true, preserveTarget = false } = {}) {
    // The route remains useful for reachability checks, but showing every node
    // made the swarm look indecisive. Only the page's decisive interaction is
    // visible: its required portal, or the final goal itself.
    mission.routeIndex = Math.max(0, mission.route.length - 1);
    setGuideBody(mission.goalBody, {
      launchFromPlayer,
      preferredX: mission.goalPoint?.x,
      preserveTarget
    });
  }

  function placePlayerOnBody(body, { randomizeX = false, recentSpawns = [] } = {}) {
    const safeXs = body.navigationXs || [];
    const insetXs = safeXs.filter((x) => x >= body.x + 7 && x + player.width <= body.x + body.width - 7);
    const spawnXs = insetXs.length > 0 ? insetXs : safeXs;
    const centeredX = body.x + Math.max(0, (body.width - player.width) * 0.5);
    const scoredSpawnXs = spawnXs.map((x) => ({
      x,
      distance: recentSpawns.length > 0
        ? Math.min(...recentSpawns.map((record) => Math.hypot(x + player.width * 0.5 - record.x, body.y - record.y)))
        : Infinity
    }));
    const separation = Math.max(180, Math.min(360, window.innerWidth * 0.22));
    const unusedSpawnXs = scoredSpawnXs.filter((item) => item.distance >= separation).map((item) => item.x);
    const distantSpawnXs = scoredSpawnXs
      .toSorted((a, b) => b.distance - a.distance)
      .slice(0, Math.max(1, Math.ceil(scoredSpawnXs.length * 0.4)))
      .map((item) => item.x);
    const randomizedSpawnXs = unusedSpawnXs.length > 0 ? unusedSpawnXs : distantSpawnXs;
    player.x = spawnXs.length > 0
      ? randomizeX
        ? randomizedSpawnXs[randomIndex(randomizedSpawnXs.length)]
        : spawnXs.toSorted((a, b) => Math.abs(a - centeredX) - Math.abs(b - centeredX))[0]
      : centeredX;
    player.y = body.y - player.height - 1;
    player.spawnX = player.x;
    player.spawnY = player.y;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.airJumpsRemaining = 1;
    player.airJumpAt = -Infinity;
    player.dropThroughBody = null;
    player.dropThroughUntil = -Infinity;
    cancelDropHatch();
    cancelLadderTraversal();
    player.standingBody = body.kind === "text" ? body : null;
    player.navigationBody = body;
    web.active = false;
    web.mantlePhase = "none";
    web.mantleBody = null;
    web.charges = CONFIG.webMaximumCharges;
  }

  function clearScorePickupFeedback() {
    if (scorePickupTimer) window.clearTimeout(scorePickupTimer);
    scorePickupTimer = 0;
    scorePickupOverlay?.remove();
    scorePickupOverlay = null;
  }

  function showScorePickupFeedback() {
    clearScorePickupFeedback();
    const root = document.createElement("div");
    root.className = "eimei-score-pickup";
    root.dataset.eimeiGame = "score-pickup";
    root.setAttribute("aria-hidden", "true");
    const flag = document.createElement("span");
    flag.className = "eimei-score-pickup-flag";
    const label = document.createElement("strong");
    label.textContent = "GET";
    root.append(flag, label);
    document.documentElement.append(root);
    scorePickupOverlay = root;
    scorePickupTimer = window.setTimeout(() => {
      if (scorePickupOverlay === root) clearScorePickupFeedback();
    }, Math.max(360, (CONFIG.scorePickupPauseSeconds - 0.04) * 1000));
  }

  function clearScoreResult() {
    if (scoreResultFocusTimer) window.clearTimeout(scoreResultFocusTimer);
    scoreResultFocusTimer = 0;
    scoreResultOverlay?.remove();
    scoreResultOverlay = null;
  }

  function showScoreResult() {
    clearScoreResult();
    const root = document.createElement("div");
    root.className = "eimei-score-result";
    root.dataset.eimeiGame = "score-result";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", `リザルト、旗 ${mission.score} 個`);
    const card = document.createElement("section");
    card.className = "eimei-score-result-card";
    const heading = document.createElement("p");
    heading.className = "eimei-score-result-heading";
    heading.textContent = "RESULT";
    const score = document.createElement("p");
    score.className = "eimei-score-result-score";
    const flag = document.createElement("span");
    flag.className = "eimei-score-result-flag";
    flag.setAttribute("aria-hidden", "true");
    const value = document.createElement("strong");
    value.textContent = String(mission.score);
    score.append(flag, value);
    const next = document.createElement("button");
    next.className = "eimei-score-result-next";
    next.type = "button";
    next.textContent = "次のゲーム";
    next.addEventListener("click", resetGame);
    next.addEventListener("keydown", (event) => {
      if (event.code !== "Enter" && event.code !== "Space") return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) resetGame();
    });
    card.append(heading, score, next);
    root.append(card);
    document.documentElement.append(root);
    scoreResultOverlay = root;
    scoreResultFocusTimer = window.setTimeout(() => {
      if (scoreResultOverlay === root) next.focus({ preventScroll: true });
    }, 1180);
  }

  function scoreTargetKey(page, x, y) {
    // Nearby words count as one area. This stops successive flags from
    // hopping between two lines that look like the same destination.
    return `${pageIdentity(page)}@${Math.round(x / 150)}@${Math.round(y / 90)}`;
  }

  function parseScoreList(parameters, key, maximum = 12) {
    return (parameters.get(key) || "")
      .split("|")
      .filter(Boolean)
      .slice(-maximum);
  }

  function rememberScoreTarget(page, x, y) {
    const key = scoreTargetKey(page, x, y);
    mission.scoreTargetKey = key;
    mission.scoreRecentGoals = [
      ...mission.scoreRecentGoals.filter((item) => item !== key),
      key
    ].slice(-CONFIG.scoreRecentGoalLimit);
  }

  function rememberScorePage(page) {
    const key = pageIdentity(page);
    mission.scoreRecentPages = [
      ...mission.scoreRecentPages.filter((item) => item !== key),
      key
    ].slice(-CONFIG.scoreRecentPageLimit);
  }

  function pickScoreLocalMission(spawn, { minimumDistance = null } = {}) {
    if (!spawn) return null;
    const bodies = navigationBodies();
    const reachable = reachableRoutes(spawn, bodies);
    const minimumTravel = minimumDistance ?? Math.max(
      980,
      window.innerHeight * CONFIG.scoreLocalMinimumTravelViewport
    );
    const maximumTravel = Math.max(
      minimumTravel + 900,
      window.innerHeight * CONFIG.scoreLocalMaximumTravelViewport
    );
    const recent = new Set(mission.scoreRecentGoals || []);
    const options = reachable.queue
      .filter((goal) => goal !== spawn && isContentGoalBody(goal))
      .map((goal) => {
        const route = reconstructRoute(reachable.parent, goal);
        const distance = routeTravelDistance(route);
        const directDistance = directBodyDistance(spawn, goal);
        const key = scoreTargetKey(pageIdentity(), bodyCenterX(goal), goal.y);
        return { goal, route, distance, directDistance, key };
      })
      .filter((item) =>
        item.route.length > 1 &&
        item.route.length <= Math.min(34, CONFIG.missionMaximumSteps) &&
        item.distance <= maximumTravel
      );
    if (options.length === 0) return null;

    const fresh = options.filter((item) => !recent.has(item.key));
    const pool = fresh.length > 0 ? fresh : options;
    const distant = pool.filter((item) =>
      item.distance >= minimumTravel &&
      item.directDistance >= Math.max(660, window.innerHeight * 0.9)
    );
    const useful = distant.length > 0
      ? distant
      : pool.filter((item) => item.distance >= Math.max(620, minimumTravel * 0.68));
    const ranked = (useful.length > 0 ? useful : pool).toSorted((a, b) => {
      const ideal = Math.max(1900, Math.min(maximumTravel * 0.78, window.innerHeight * 4.4));
      const scoreA = Math.abs(a.distance - ideal) - a.directDistance * 0.28;
      const scoreB = Math.abs(b.distance - ideal) - b.directDistance * 0.28;
      return scoreA - scoreB;
    });
    const varied = ranked.slice(0, Math.max(1, Math.min(10, Math.ceil(ranked.length * 0.45))));
    const selected = varied[randomIndex(varied.length)];
    return selected ? {
      spawn,
      goal: selected.goal,
      route: selected.route,
      routeDistance: selected.distance,
      goalKind: "text"
    } : null;
  }

  function pickScorePortalMission(spawn) {
    if (!spawn) return null;
    const currentPage = pageIdentity();
    const recentPages = new Set((mission.scoreRecentPages || []).slice(-CONFIG.scoreRecentPageLimit));
    recentPages.add(currentPage);
    const options = bridgePortalMissionOptions(spawn, recentPages, "any") || [];
    if (options.length === 0) return null;

    const meaningful = options.filter((option) =>
      option.route.length > 1 &&
      option.routeDistance >= Math.max(560, window.innerHeight * 0.75)
    );
    const pool = meaningful.length > 0 ? meaningful : options;
    const ranked = pool.toSorted((a, b) => {
      const pageA = pageIdentity(a.portalDestination);
      const pageB = pageIdentity(b.portalDestination);
      const scoreA = Math.min(a.routeDistance, 2600) +
        (a.globalNavigation ? 0 : 950) +
        (pageA.startsWith("/news/") ? 380 : 0);
      const scoreB = Math.min(b.routeDistance, 2600) +
        (b.globalNavigation ? 0 : 950) +
        (pageB.startsWith("/news/") ? 380 : 0);
      return scoreB - scoreA;
    });
    const varied = ranked.slice(0, Math.max(1, Math.min(5, Math.ceil(ranked.length * 0.38))));
    return varied[randomIndex(varied.length)] || null;
  }

  function scorePairGoalPoint(pair, fixedGoal = null) {
    if (pair.goalKind === "portal" && pair.portalAnchor) {
      const region = anchorRegion(pair.goal, pair.portalAnchor);
      const matchingXs = pair.goal.navigationXs.filter((x) => {
        const center = x + player.width * 0.5;
        return center >= region.left && center <= region.right;
      });
      const positions = matchingXs.length > 0 ? matchingXs : pair.goal.navigationXs;
      const nearest = positions.toSorted((a, b) =>
        Math.abs(a + player.width * 0.5 - (player.x + player.width * 0.5)) -
        Math.abs(b + player.width * 0.5 - (player.x + player.width * 0.5))
      )[0];
      return { x: nearest + player.width * 0.5, y: pair.goal.y };
    }
    const positions = pair.goal.navigationXs || [];
    const targetX = fixedGoal?.x ?? bodyCenterX(pair.goal);
    const selected = positions.toSorted((a, b) =>
      Math.abs(a + player.width * 0.5 - targetX) - Math.abs(b + player.width * 0.5 - targetX)
    )[0];
    return { x: Number.isFinite(selected) ? selected + player.width * 0.5 : bodyCenterX(pair.goal), y: pair.goal.y };
  }

  function applyScoreMissionPair(pair, { placePlayer = false, randomizeSpawn = false, fixedGoal = null } = {}) {
    if (!pair?.spawn || !pair?.goal) return false;
    if (placePlayer) {
      placePlayerOnBody(pair.spawn, {
        randomizeX: randomizeSpawn,
        recentSpawns: recentSpawnRecords()
      });
      if (randomizeSpawn) rememberSpawnPoint();
    }
    const point = scorePairGoalPoint(pair, fixedGoal);
    mission.initialized = true;
    mission.spawnBody = mission.spawnBody || pair.spawn;
    mission.goalBody = pair.goal;
    mission.goalElement = pair.portalAnchor || sourceElementAt(pair.goal, point.x);
    mission.goalPoint = point;
    mission.goalKind = pair.goalKind || "text";
    mission.portalAnchor = pair.portalAnchor || null;
    mission.portalDestination = pair.portalDestination || null;
    mission.continuationMode = "score";
    mission.routeDistance = pair.routeDistance || routeTravelDistance(pair.route);
    mission.route = pair.route;
    mission.routePhysicalAtPlan = routeIsPhysicallyConnected(pair.route);
    mission.routeIndex = Math.max(0, pair.route.length - 1);
    mission.guideBody = null;
    mission.guidePoint = null;
    mission.completed = false;
    mission.completedAt = -Infinity;
    mission.scoreNextRoundAt = -Infinity;
    mission.needsReplan = false;
    mission.lostGuideSince = -Infinity;
    mission.overtookGuideSince = -Infinity;
    mission.nextAdvanceAllowedAt = -Infinity;
    mission.guideNearSince = -Infinity;
    mission.lastAdvanceX = -Infinity;
    mission.lastAdvanceY = -Infinity;
    mission.lastStandingBody = pair.spawn;
    mission.scorePlanningPortal = false;
    interaction.portal = null;
    setKeypointGuide();
    refreshHatchCandidate({ force: true });
    return true;
  }

  function initialScorePair(spawn = null) {
    if (spawn) return pickScoreLocalMission(spawn, {
      minimumDistance: Math.max(1250, window.innerHeight * 1.9)
    });
    const bodies = navigationBodies();
    const starts = preferUnusedSpawnAreas(
      bodies.filter((body) => body.width >= Math.max(70, player.width * 3)),
      recentSpawnRecords()
    ).map((body) => ({ body, order: Math.random() }))
      .toSorted((a, b) => a.order - b.order)
      .map((item) => item.body);
    for (const candidate of starts.slice(0, 36)) {
      const pair = pickScoreLocalMission(candidate, {
        minimumDistance: Math.max(1250, window.innerHeight * 1.9)
      });
      if (pair) return pair;
    }
    return null;
  }

  function cleanScoreRouteUrl() {
    const cleanUrl = new URL(location.href);
    for (const key of [...cleanUrl.searchParams.keys()]) {
      if (key.startsWith("eimei-")) cleanUrl.searchParams.delete(key);
    }
    history.replaceState(history.state, "", cleanUrl.href);
  }

  function startScoreAttackMission({
    routeParameters,
    routeStage,
    requestedRouteStage,
    requestedRunId,
    requestedSegment,
    fromPath,
    arrivalSpawn,
    fixedFinalGoal,
    visitedPaths
  }) {
    clearScorePickupFeedback();
    clearScoreResult();
    const continued = routeStage === "continue" && Boolean(requestedRunId);
    mission.scoreAttack = true;
    mission.score = continued
      ? Math.max(0, Number.parseInt(routeParameters.get("eimei-score") || "0", 10) || 0)
      : 0;
    mission.scoreTimeRemaining = continued
      ? Math.max(0, Math.min(CONFIG.scoreAttackSeconds, Number.parseFloat(routeParameters.get("eimei-score-time") || String(CONFIG.scoreAttackSeconds))))
      : CONFIG.scoreAttackSeconds;
    mission.scoreClockStarted = continued;
    mission.scoreFinished = false;
    mission.scoreRound = continued
      ? Math.max(0, Number.parseInt(routeParameters.get("eimei-score-round") || "0", 10) || 0)
      : 0;
    mission.scoreRoundsOnPage = continued
      ? Math.max(0, Number.parseInt(routeParameters.get("eimei-score-page-rounds") || "0", 10) || 0)
      : 0;
    mission.scoreRecentGoals = continued
      ? parseScoreList(routeParameters, "eimei-score-goals", CONFIG.scoreRecentGoalLimit)
      : [];
    mission.scoreRecentPages = continued
      ? parseScoreList(routeParameters, "eimei-score-pages", CONFIG.scoreRecentPageLimit)
      : [];
    rememberScorePage(location.href);
    mission.runId = continued && requestedRunId
      ? requestedRunId
      : `${Date.now().toString(36)}-${randomIndex(0x100000).toString(36)}`;
    mission.segmentIndex = continued ? Math.max(0, requestedSegment) : 0;
    mission.visitedPaths = [...visitedPaths].slice(-CONFIG.missionMaximumSegments);
    mission.headerPortalStreak = 0;
    mission.headerPortalTotal = 0;
    mission.plannedPortalTransitions = 0;
    mission.plannedPortalPages = [];
    mission.planningTrace = [];
    mission.recoveringFromDetour = false;
    mission.targetRouteDistance = 0;
    mission.plannedRouteDistance = 0;
    mission.startPageRandomized = requestedRouteStage === "start";
    mission.startPageKey = pageIdentity();

    const fixedHere = continued && fixedFinalGoal?.page === pageIdentity();
    let pair = fixedHere ? routePairToFixedGoal(arrivalSpawn, fixedFinalGoal) : null;
    if (!pair) pair = initialScorePair(arrivalSpawn);
    if (!pair) {
      placeAtSpawn();
      mission.initialized = false;
      cleanScoreRouteUrl();
      return;
    }
    applyScoreMissionPair(pair, {
      placePlayer: true,
      randomizeSpawn: !arrivalSpawn,
      fixedGoal: fixedHere ? fixedFinalGoal : null
    });
    mission.finalGoalPage = pageIdentity();
    mission.finalGoalX = mission.goalPoint.x;
    mission.finalGoalY = mission.goalBody.y;
    mission.finalGoalReady = true;
    rememberScoreTarget(mission.finalGoalPage, mission.finalGoalX, mission.finalGoalY);

    if (!fixedHere) {
      beginMissionPreview({
        pageUrl: location.href,
        goalX: mission.finalGoalX,
        goalY: mission.finalGoalY
      });
    } else {
      mission.previewStartedAt = -Infinity;
      mission.previewUntil = -Infinity;
      mission.previewGuidePending = false;
    }
    if (mission.scoreTimeRemaining <= 0) finishScoreAttack(performance.now() / 1000);
    cleanScoreRouteUrl();
  }

  function fallbackToLocalScoreRound() {
    const support = player.navigationBody || supportingMapBody() || nearestSupportingBody();
    const pair = initialScorePair(support);
    mission.scorePlanningPortal = false;
    if (!pair || !applyScoreMissionPair(pair)) {
      mission.completed = true;
      mission.scoreNextRoundAt = performance.now() / 1000 + 0.5;
      mission.previewUntil = -Infinity;
      mission.previewGuidePending = false;
      return false;
    }
    mission.finalGoalPage = pageIdentity();
    mission.finalGoalX = mission.goalPoint.x;
    mission.finalGoalY = mission.goalBody.y;
    mission.finalGoalReady = true;
    mission.plannedPortalPages = [];
    rememberScoreTarget(mission.finalGoalPage, mission.finalGoalX, mission.finalGoalY);
    beginMissionPreview({ pageUrl: location.href, goalX: mission.finalGoalX, goalY: mission.finalGoalY });
    return true;
  }

  function startNextScoreRound() {
    if (!mission.scoreAttack || mission.scoreFinished) return false;
    clearScorePickupFeedback();
    const support = player.navigationBody || supportingMapBody() || nearestSupportingBody();
    if (!support) return false;
    mission.completed = false;
    mission.completedAt = -Infinity;
    mission.scoreNextRoundAt = -Infinity;
    const portalPair = pickScorePortalMission(support);
    const shouldUsePortal = Boolean(
      portalPair &&
      mission.scoreRoundsOnPage >= 1
    );
    if (shouldUsePortal && applyScoreMissionPair(portalPair)) {
      mission.finalGoalPage = pageIdentity(portalPair.portalDestination);
      mission.finalGoalX = null;
      mission.finalGoalY = null;
      mission.finalGoalReady = false;
      mission.plannedPortalTransitions = 1;
      mission.plannedPortalPages = [mission.finalGoalPage];
      mission.scorePlanningPortal = true;
      rememberScorePage(portalPair.portalDestination);
      planFinalGoal(portalPair.portalDestination, {
        remainingDistance: Math.max(1200, window.innerHeight * 1.8),
        hopsLeft: 0,
        headerPortalStreak: portalPair.globalNavigation ? 1 : 0,
        headerPortalTotal: portalPair.globalNavigation ? 1 : 0
      });
      return true;
    }
    return fallbackToLocalScoreRound();
  }

  function collectScoreFlag(nowSeconds) {
    if (!mission.scoreAttack || mission.scoreFinished || mission.completed) return;
    mission.score += 1;
    mission.scoreRound += 1;
    mission.scoreRoundsOnPage += 1;
    mission.scorePickupAt = nowSeconds;
    mission.completed = true;
    mission.completedAt = nowSeconds;
    mission.scoreNextRoundAt = nowSeconds + CONFIG.scorePickupPauseSeconds;
    mission.guideBody = null;
    mission.guidePoint = null;
    mission.wispAnchored = false;
    mission.trail.length = 0;
    mission.previewGuidePending = false;
    mission.previewStartedAt = -Infinity;
    mission.previewUntil = -Infinity;
    player.velocityX = 0;
    player.velocityY = 0;
    detachWeb({ force: true });
    showScorePickupFeedback();
  }

  function finishScoreAttack(nowSeconds) {
    if (mission.scoreFinished) return;
    mission.scoreTimeRemaining = 0;
    mission.scoreFinished = true;
    mission.completed = true;
    mission.completedAt = nowSeconds;
    mission.scoreNextRoundAt = Infinity;
    mission.guideBody = null;
    mission.guidePoint = null;
    mission.wispAnchored = false;
    mission.trail.length = 0;
    mission.previewGuidePending = false;
    mission.previewStartedAt = -Infinity;
    mission.previewUntil = -Infinity;
    player.velocityX = 0;
    player.velocityY = 0;
    detachWeb({ force: true });
    clearScorePickupFeedback();
    clearMissionPreviewPhoto();
    showScoreResult();
  }

  function updateScoreAttackState(frameSeconds, nowSeconds) {
    if (!mission.scoreAttack || !mission.initialized || mission.scoreFinished) return;
    if (mission.completed) {
      if (nowSeconds >= mission.scoreNextRoundAt) startNextScoreRound();
      return;
    }
    if (missionPreviewActive(nowSeconds) || mission.scorePlanningPortal) return;
    if (!mission.scoreClockStarted) {
      mission.scoreClockStarted = true;
      return;
    }
    mission.scoreTimeRemaining = Math.max(0, mission.scoreTimeRemaining - frameSeconds);
    if (mission.scoreTimeRemaining <= 0) finishScoreAttack(nowSeconds);
  }

  function syncScoreAttackPortalTarget(portal) {
    if (!mission.scoreAttack || !portal?.target) return;
    const target = portal.target;
    const followsGuide = portal.anchor === mission.portalAnchor && mission.finalGoalReady;
    target.searchParams.set("eimei-mode", "score");
    target.searchParams.set("eimei-score", String(mission.score));
    target.searchParams.set("eimei-score-time", mission.scoreTimeRemaining.toFixed(3));
    target.searchParams.set("eimei-score-round", String(mission.scoreRound));
    target.searchParams.set("eimei-score-page-rounds", "0");
    target.searchParams.set("eimei-score-goals", mission.scoreRecentGoals.join("|"));
    target.searchParams.set("eimei-score-pages", mission.scoreRecentPages.join("|"));
    target.searchParams.delete("eimei-route-pages");
    if (followsGuide) {
      target.searchParams.set("eimei-final-page", mission.finalGoalPage);
      target.searchParams.set("eimei-final-x", String(mission.finalGoalX));
      target.searchParams.set("eimei-final-y", String(mission.finalGoalY));
    } else {
      target.searchParams.delete("eimei-final-page");
      target.searchParams.delete("eimei-final-x");
      target.searchParams.delete("eimei-final-y");
    }
  }

  function tutorialCheckpoints() {
    return [...document.querySelectorAll("[data-eimei-tutorial-checkpoint]")];
  }

  function tutorialCurrentCheckpoint() {
    return tutorialCheckpoints()[tutorial.step] || null;
  }

  function resetTutorialActions() {
    for (const key of Object.keys(tutorial.actions)) tutorial.actions[key] = false;
    tutorial.reelDistance = 0;
    tutorial.lastWebLength = web.length;
    tutorial.webStartX = null;
    tutorial.ladderStartY = null;
  }

  function tutorialGoalPoint(body, element) {
    const regions = body.sourceRegions?.filter((region) =>
      region.element === element || element.contains(region.element)
    ) || [];
    const left = regions.length > 0 ? Math.min(...regions.map((region) => region.left)) : body.x;
    const right = regions.length > 0 ? Math.max(...regions.map((region) => region.right)) : body.x + body.width;
    const preferred = (left + right) * 0.5;
    const centers = (body.navigationXs || [])
      .map((x) => x + player.width * 0.5)
      .filter((x) => x >= left && x <= right);
    const x = (centers.length > 0 ? centers : (body.navigationXs || []).map((item) => item + player.width * 0.5))
      .toSorted((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0];
    return { x: Number.isFinite(x) ? x : preferred, y: body.y };
  }

  function setTutorialStep(index, { launchFromPlayer = true } = {}) {
    const checkpoints = tutorialCheckpoints();
    const checkpoint = checkpoints[index];
    if (!checkpoint) return false;
    const goalBody = tutorialBodyForElement(checkpoint);
    if (!goalBody) return false;

    tutorial.step = index;
    tutorial.transitioning = false;
    resetTutorialActions();
    for (const element of checkpoints) element.classList.remove("is-current");
    checkpoint.classList.add("is-current");

    const anchor = checkpoint.closest("a[href]");
    const support = player.navigationBody || supportingMapBody() || mission.spawnBody || goalBody;
    const route = support === goalBody ? [goalBody] : [support, goalBody].filter(Boolean);
    const point = tutorialGoalPoint(goalBody, checkpoint);
    mission.initialized = true;
    mission.scoreAttack = false;
    mission.scoreFinished = false;
    mission.goalBody = goalBody;
    mission.goalElement = anchor || checkpoint;
    mission.goalPoint = point;
    mission.goalKind = anchor ? "portal" : "text";
    mission.portalAnchor = anchor || null;
    mission.portalDestination = anchor ? portalTarget(anchor) : null;
    mission.continuationMode = "tutorial";
    mission.runId = "tutorial";
    mission.route = route;
    mission.routeDistance = routeTravelDistance(route);
    mission.routePhysicalAtPlan = false;
    mission.routeIndex = Math.max(0, route.length - 1);
    mission.guideBody = null;
    mission.guidePoint = null;
    mission.completed = false;
    mission.completedAt = -Infinity;
    mission.needsReplan = false;
    mission.lostGuideSince = -Infinity;
    mission.overtookGuideSince = -Infinity;
    mission.nextAdvanceAllowedAt = -Infinity;
    mission.guideNearSince = -Infinity;
    mission.lastAdvanceX = -Infinity;
    mission.lastAdvanceY = -Infinity;
    mission.finalGoalPage = anchor ? pageIdentity(mission.portalDestination) : pageIdentity();
    mission.finalGoalX = point.x;
    mission.finalGoalY = point.y;
    mission.finalGoalReady = true;
    interaction.portal = null;
    setKeypointGuide({ launchFromPlayer });
    refreshHatchCandidate({ force: true });
    document.documentElement.dataset.eimeiTutorialStep = String(index);
    window.dispatchEvent(new CustomEvent("eimei-tutorial-step", {
      detail: { index, requirement: checkpoint.dataset.require || "reach" }
    }));
    return true;
  }

  function tutorialRequirementMet(checkpoint = tutorialCurrentCheckpoint()) {
    switch (checkpoint?.dataset.require || "reach") {
      case "move": return tutorial.actions.left && tutorial.actions.right;
      case "jump": return tutorial.actions.jump;
      case "double": return tutorial.actions.doubleJump;
      case "swing": return tutorial.actions.swing;
      case "reel": return tutorial.actions.reel && web.hatchesCompleted > 0;
      case "ladder": return tutorial.actions.ladderClimb && tutorial.actions.ladderDismount;
      case "drop": return tutorial.actions.drop;
      case "follow":
      case "flag":
      case "reach": return true;
      default: return false;
    }
  }

  function completeTutorialStep(nowSeconds = performance.now() / 1000) {
    const checkpoint = tutorialCurrentCheckpoint();
    if (!checkpoint || tutorial.transitioning || !tutorialRequirementMet(checkpoint)) return false;
    const completedIndex = tutorial.step;
    tutorial.transitioning = true;
    tutorial.completedSteps.push(checkpoint.dataset.require || "reach");
    checkpoint.classList.remove("is-current");
    checkpoint.classList.add("is-complete");
    const release = document.querySelector(`[data-eimei-tutorial-release="${completedIndex}"]`);
    if (release) {
      release.hidden = true;
      release.setAttribute("aria-hidden", "true");
    }
    clearHatchCandidate();
    player.spawnX = player.x;
    player.spawnY = player.y;
    // Select the next visible checkpoint before rebuilding. Waiting for a
    // resize/rebuild callback left a tiny but real state where no destination
    // existed; on slow devices that state could persist for seconds.
    setTutorialStep(completedIndex + 1, { launchFromPlayer: true });
    scheduleRebuild();
    window.dispatchEvent(new CustomEvent("eimei-tutorial-complete", {
      detail: { index: completedIndex, completedAt: nowSeconds }
    }));
    return true;
  }

  function startTutorialMission() {
    const spawnElement = document.querySelector("[data-eimei-tutorial-spawn]");
    const spawnBody = tutorialBodyForElement(spawnElement) || pickSpawnBody();
    if (!spawnBody || tutorialCheckpoints().length === 0) {
      placeAtSpawn();
      mission.initialized = false;
      return;
    }
    tutorial.active = true;
    tutorial.step = 0;
    tutorial.transitioning = false;
    tutorial.completedSteps.length = 0;
    mission.spawnBody = spawnBody;
    mission.visitedPaths = [pageIdentity()];
    placePlayerOnBody(spawnBody, { randomizeX: false });
    setTutorialStep(0, { launchFromPlayer: true });
  }

  function raceTargetElement(target) {
    if (!target?.selector) return null;
    try {
      return document.querySelector(target.selector);
    } catch {
      return null;
    }
  }

  function elementMatchesRaceTarget(element, targetElement) {
    return Boolean(
      element &&
      targetElement &&
      (element === targetElement || targetElement.contains(element) || element.contains(targetElement))
    );
  }

  function raceTargetBody(target) {
    const targetElement = raceTargetElement(target);
    const eligible = state.textBodies.filter((body) =>
      body.navigationXs?.length &&
      body.sourceRegions?.some((region) => elementMatchesRaceTarget(region.element, targetElement))
    );
    const pool = eligible.length > 0
      ? eligible
      : state.textBodies.filter((body) => body.navigationXs?.length);
    if (pool.length === 0) return null;
    const targetX = Number(target?.x);
    const targetY = Number(target?.y);
    return pool.toSorted((a, b) => {
      const score = (body) =>
        Math.abs(body.y - (Number.isFinite(targetY) ? targetY : body.y)) * 8 +
        Math.abs(bodyCenterX(body) - (Number.isFinite(targetX) ? targetX : bodyCenterX(body))) +
        (eligible.includes(body) ? 0 : 100000);
      return score(a) - score(b);
    })[0] || null;
  }

  function raceTargetCenter(body, target) {
    if (!body) return null;
    const targetElement = raceTargetElement(target);
    const matchingRegions = body.sourceRegions?.filter((region) =>
      elementMatchesRaceTarget(region.element, targetElement)
    ) || [];
    const left = matchingRegions.length > 0
      ? Math.min(...matchingRegions.map((region) => region.left))
      : body.x;
    const right = matchingRegions.length > 0
      ? Math.max(...matchingRegions.map((region) => region.right))
      : body.x + body.width;
    const centers = (body.navigationXs || [])
      .map((x) => x + player.width * 0.5)
      .filter((x) => x >= left && x <= right);
    const pool = centers.length > 0
      ? centers
      : (body.navigationXs || []).map((x) => x + player.width * 0.5);
    const preferredX = Number.isFinite(Number(target?.x)) ? Number(target.x) : (left + right) * 0.5;
    return pool.toSorted((a, b) => Math.abs(a - preferredX) - Math.abs(b - preferredX))[0] ??
      Math.max(body.x + player.width * 0.5, Math.min(preferredX, body.x + body.width - player.width * 0.5));
  }

  function setPlayerPalette(value = {}) {
    const fallback = player.palette;
    player.palette = {
      primary: String(value.primary || fallback.primary),
      dark: String(value.dark || fallback.dark),
      accent: String(value.accent || fallback.accent),
      visor: String(value.visor || fallback.visor),
      glow: String(value.glow || fallback.glow)
    };
  }

  function setRaceRemotePlayer({ id, x, y, facing = 1, palette = null } = {}) {
    if (!race.active || !id || !Number.isFinite(Number(x) + Number(y))) return false;
    const existing = race.remotePlayers.get(String(id)) || {};
    race.remotePlayers.set(String(id), {
      ...existing,
      id: String(id),
      x: Number(x),
      y: Number(y),
      facing: Number(facing) < 0 ? -1 : 1,
      palette: palette || existing.palette || null,
      expiresAt: performance.now() / 1000 + 2.2
    });
    return true;
  }

  function removeRaceRemotePlayer(id) {
    const key = String(id || "");
    race.remotePlayers.delete(key);
    if (web.remotePlayerId === key) detachWeb({ force: true });
  }

  function applyRaceGrapple({ attackerId, x, y, palette = null } = {}) {
    if (!race.active || !attackerId || !Number.isFinite(Number(x) + Number(y))) return false;
    race.incomingGrapples.set(String(attackerId), {
      attackerId: String(attackerId),
      x: Number(x),
      y: Number(y),
      palette,
      expiresAt: performance.now() / 1000 + CONFIG.raceGrappleHoldSeconds
    });
    return true;
  }

  function expireRacePlayerEffects(nowSeconds = performance.now() / 1000) {
    for (const [id, remote] of race.remotePlayers) {
      if (remote.expiresAt >= nowSeconds) continue;
      removeRaceRemotePlayer(id);
    }
    for (const [id, grapple] of race.incomingGrapples) {
      if (grapple.expiresAt < nowSeconds) race.incomingGrapples.delete(id);
    }
  }

  function applyIncomingRaceGrapples(dt, nowSeconds) {
    if (!race.active) return;
    expireRacePlayerEffects(nowSeconds);
    const centerX = player.x + player.width * 0.5;
    const centerY = player.y + player.height * 0.45;
    for (const grapple of race.incomingGrapples.values()) {
      const dx = grapple.x - centerX;
      const dy = grapple.y - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance <= CONFIG.raceGrappleMinimumLength) continue;
      const normalX = dx / distance;
      const normalY = dy / distance;
      const acceleration = Math.min(
        CONFIG.raceGrappleAcceleration,
        CONFIG.raceGrappleAcceleration * 0.55 + distance * 4.2
      );
      player.velocityX += normalX * acceleration * dt;
      player.velocityY += normalY * acceleration * dt;
      const speed = Math.hypot(player.velocityX, player.velocityY);
      if (speed > CONFIG.raceGrappleMaximumSpeed) {
        player.velocityX *= CONFIG.raceGrappleMaximumSpeed / speed;
        player.velocityY *= CONFIG.raceGrappleMaximumSpeed / speed;
      }
      if (normalY < -0.08) {
        player.grounded = false;
        player.groundedAt = -Infinity;
      }
    }
  }

  function syncRemoteWebAnchor(nowSeconds = performance.now() / 1000) {
    if (!web.active || !web.remotePlayerId) return true;
    expireRacePlayerEffects(nowSeconds);
    const remote = race.remotePlayers.get(web.remotePlayerId);
    if (!remote) {
      detachWeb({ force: true });
      return false;
    }
    web.anchorX = remote.x;
    web.anchorY = remote.y;
    const distance = Math.hypot(
      player.x + player.width * 0.5 - web.anchorX,
      player.y + player.height * 0.45 - web.anchorY
    );
    if (distance > CONFIG.webRange * 1.15) {
      detachWeb({ force: true });
      return false;
    }
    return true;
  }

  function clearRaceMissionTarget() {
    mission.goalBody = null;
    mission.goalElement = null;
    mission.goalPoint = null;
    mission.goalKind = "text";
    mission.portalAnchor = null;
    mission.portalDestination = null;
    mission.continuationMode = null;
    mission.route = [];
    mission.routeIndex = 0;
    mission.routeDistance = 0;
    mission.finalGoalPage = race.course?.goal?.page || null;
    mission.finalGoalX = race.course?.goal?.x ?? null;
    mission.finalGoalY = race.course?.goal?.y ?? null;
    mission.finalGoalReady = Boolean(race.course?.goal);
    setGuideBody(null, { launchFromPlayer: false });
  }

  function setRaceGoalTarget({ launchFromPlayer = true } = {}) {
    const target = race.course?.goal;
    if (!target || pageIdentity() !== target.page) return false;
    const body = raceTargetBody(target);
    const centerX = raceTargetCenter(body, target);
    if (!body || !Number.isFinite(centerX)) return false;
    mission.goalBody = body;
    mission.goalElement = raceTargetElement(target) || sourceElementAt(body, centerX);
    mission.goalPoint = { x: centerX, y: body.y };
    mission.goalKind = "text";
    mission.portalAnchor = null;
    mission.portalDestination = null;
    mission.continuationMode = null;
    mission.route = [body];
    mission.routeIndex = 0;
    mission.routeDistance = 0;
    mission.finalGoalPage = target.page;
    mission.finalGoalX = centerX;
    mission.finalGoalY = body.y;
    mission.finalGoalReady = true;
    if (race.navigationEnabled) {
      setGuideBody(body, { launchFromPlayer, preferredX: centerX });
    } else {
      setGuideBody(null, { launchFromPlayer: false });
    }
    return true;
  }

  function racePortalForPage(destinationPage) {
    if (!destinationPage) return null;
    const support = player.navigationBody || supportingMapBody() || nearestSupportingBody();
    return [...document.querySelectorAll("a[href]")]
      .filter((anchor) => !anchor.closest("#side, #side-wide, #tabbed"))
      .map((anchor) => {
        const destination = portalTarget(anchor);
        if (!destination || pageIdentity(destination) !== destinationPage) return null;
        const body = portalBodyForAnchor(anchor);
        const centerX = portalStandingCenter(body, anchor);
        if (
          !body ||
          !Number.isFinite(centerX) ||
          centerX < player.width * 0.5 + 2 ||
          centerX > state.documentWidth - player.width * 0.5 - 2 ||
          body.y < player.height + 2
        ) return null;
        const route = support
          ? bodiesDescribeSamePlatform(support, body)
            ? [support]
            : navigationRouteBetween(support, body)
          : [body];
        const visible = isElementVisible(anchor);
        const score = (route.length > 0 ? 0 : 100000) +
          (visible ? 0 : 180) +
          (isGlobalNavigationAnchor(anchor) ? 120 : 0) +
          Math.hypot(centerX - (player.x + player.width * 0.5), body.y - (player.y + player.height));
        return { anchor, destination, body, centerX, route, score };
      })
      .filter(Boolean)
      .toSorted((a, b) => a.score - b.score)[0] || null;
  }

  function setRacePortalTarget({ launchFromPlayer = true } = {}) {
    const currentPage = pageIdentity();
    const routePages = race.course?.routePages || [];
    const currentIndex = routePages.indexOf(currentPage);
    const destinationPage = currentIndex >= 0
      ? routePages[currentIndex + 1]
      : race.course?.goal?.page;
    if (!destinationPage || destinationPage === currentPage) return setRaceGoalTarget({ launchFromPlayer });
    const pair = racePortalForPage(destinationPage);
    if (!pair) {
      clearRaceMissionTarget();
      if (race.missingRoutePage !== currentPage) {
        race.missingRoutePage = currentPage;
        window.dispatchEvent(new CustomEvent("eimei-race-route-missing", {
          detail: { page: currentPage, destinationPage }
        }));
      }
      return false;
    }
    race.missingRoutePage = null;
    mission.goalBody = pair.body;
    mission.goalElement = pair.anchor;
    mission.goalPoint = { x: pair.centerX, y: pair.body.y };
    mission.goalKind = "portal";
    mission.portalAnchor = pair.anchor;
    mission.portalDestination = pair.destination;
    mission.continuationMode = "any";
    mission.route = [pair.body];
    mission.routeIndex = 0;
    mission.routeDistance = 0;
    mission.finalGoalPage = race.course.goal.page;
    mission.finalGoalX = race.course.goal.x;
    mission.finalGoalY = race.course.goal.y;
    mission.finalGoalReady = true;
    setGuideBody(pair.body, { launchFromPlayer, preferredX: pair.centerX });
    ensureGuidedPortalDoor(pair.body, performance.now() / 1000);
    return true;
  }

  function configureRaceMissionTarget({ launchFromPlayer = true } = {}) {
    if (!race.active || !race.course) return false;
    if (pageIdentity() === race.course.goal.page) return setRaceGoalTarget({ launchFromPlayer });
    if (race.navigationEnabled) return setRacePortalTarget({ launchFromPlayer });
    clearRaceMissionTarget();
    return true;
  }

  function placePlayerAtRaceTarget(target) {
    const body = raceTargetBody(target);
    if (!body) return false;
    placePlayerOnBody(body, { randomizeX: false });
    const centerX = raceTargetCenter(body, target);
    if (Number.isFinite(centerX)) {
      player.x = Math.max(body.x, Math.min(centerX - player.width * 0.5, body.x + body.width - player.width));
      player.spawnX = player.x;
      player.spawnY = player.y;
    }
    mission.spawnBody = body;
    return true;
  }

  function startRaceMission() {
    const routeParameters = new URLSearchParams(location.search);
    const fromPage = routeParameters.get("eimei-from");
    const isDirectRoundEntrance = !fromPage && race.course?.start &&
      pageIdentity() === race.course.start.page;
    const placedAtSharedStart = isDirectRoundEntrance &&
      placePlayerAtRaceTarget(race.course.start);
    let spawn = placedAtSharedStart ? mission.spawnBody || player.navigationBody : null;
    if (!placedAtSharedStart) {
      const arrivalSpawn = incomingPortalSpawn(fromPage);
      spawn = arrivalSpawn || pickSpawnBody();
      if (spawn) placePlayerOnBody(spawn, { randomizeX: false });
      else placeAtSpawn();
    }
    mission.initialized = true;
    mission.spawnBody = mission.spawnBody || spawn || player.navigationBody || null;
    mission.runId = race.roundId || `race-${race.roomCode}`;
    mission.segmentIndex = 0;
    mission.visitedPaths = [pageIdentity()];
    mission.scoreAttack = false;
    mission.scoreFinished = false;
    mission.completed = false;
    mission.completedAt = -Infinity;
    mission.previewUntil = -Infinity;
    mission.previewAwaitingPhoto = false;
    clearRaceMissionTarget();
  }

  function configureRaceRound({
    roomCode,
    roundId,
    startAt = null,
    course,
    placeAtStart = false,
    navigationEnabled = false,
    frozen = false,
    finished = false
  } = {}) {
    if (!race.active || !course?.start || !course?.goal || !roundId) return false;
    const roundChanged = race.roundId !== roundId || race.course?.id !== course.id;
    race.roomCode = String(roomCode || race.roomCode).toUpperCase();
    race.roundId = String(roundId);
    race.startAt = Number(startAt) || null;
    race.course = course;
    race.configured = true;
    race.navigationEnabled = Boolean(navigationEnabled);
    race.frozen = Boolean(frozen);
    race.finished = Boolean(finished);
    race.missingRoutePage = null;
    mission.initialized = true;
    mission.runId = race.roundId;
    mission.scoreAttack = false;
    mission.scoreFinished = false;
    if (roundChanged) {
      race.finishPending = false;
      race.finishReportedAt = -Infinity;
      mission.completed = false;
      mission.completedAt = -Infinity;
    }
    const initialRaceEntry = !initialRouteParameters.get("eimei-from");
    if (
      pageIdentity() === course.start.page &&
      (placeAtStart || (roundChanged && initialRaceEntry))
    ) {
      placePlayerAtRaceTarget(course.start);
      window.scrollTo({
        left: Math.max(0, player.x - window.innerWidth * 0.5),
        top: Math.max(0, player.y - window.innerHeight * 0.44),
        behavior: "instant"
      });
    } else if (!mission.spawnBody || !state.bodies.includes(mission.spawnBody)) {
      mission.spawnBody = player.navigationBody || supportingMapBody() || nearestSupportingBody();
      player.spawnX = player.x;
      player.spawnY = player.y;
    }
    configureRaceMissionTarget({ launchFromPlayer: true });
    window.dispatchEvent(new CustomEvent("eimei-race-map-ready", {
      detail: { roundId: race.roundId, page: pageIdentity() }
    }));
    return true;
  }

  function setRaceNavigationEnabled(value) {
    const enabled = Boolean(value);
    if (!race.active || race.navigationEnabled === enabled) return;
    race.navigationEnabled = enabled;
    configureRaceMissionTarget({ launchFromPlayer: true });
  }

  function setRaceFrozen(value) {
    if (!race.active) return;
    race.frozen = Boolean(value);
    if (race.frozen) {
      player.velocityX = 0;
      player.velocityY = 0;
      detachWeb({ force: true });
    }
  }

  function startMission() {
    if (isTutorialDocument) {
      startTutorialMission();
      return;
    }
    if (race.active) {
      startRaceMission();
      return;
    }
    if (isCatalogDocument) {
      placeAtSpawn();
      mission.initialized = false;
      return;
    }
    const routeParameters = new URLSearchParams(location.search);
    const requestedRouteStage = routeParameters.get("eimei-route");
    const requestedStartAttempt = Number.parseInt(routeParameters.get("eimei-start-attempt") || "0", 10) || 0;
    const requestedStartTriedPages = (routeParameters.get("eimei-start-tried") || "")
      .split("|")
      .filter((path) => path.startsWith("/"));
    const requestedRunId = routeParameters.get("eimei-run");
    const requestedSegment = Number.parseInt(routeParameters.get("eimei-segment") || "0", 10) || 0;
    const planningMode = requestedRouteStage === "plan";
    const planningDistance = planningMode
      ? Math.max(0, Number.parseFloat(routeParameters.get("eimei-plan-distance") || "0") || 0)
      : 0;
    const planningHopsLeft = planningMode
      ? Math.max(0, Math.min(CONFIG.missionPlanningMaximumPortals, Number.parseInt(routeParameters.get("eimei-plan-hops") || "0", 10) || 0))
      : 0;
    const planningHeaderPortalStreak = planningMode
      ? Math.max(0, Number.parseInt(routeParameters.get("eimei-plan-header-streak") || "0", 10) || 0)
      : 0;
    const planningHeaderPortalTotal = planningMode
      ? Math.max(0, Number.parseInt(routeParameters.get("eimei-plan-header-total") || "0", 10) || 0)
      : 0;
    const requestedHeaderPortalStreak = requestedRouteStage === "continue"
      ? Math.max(0, Math.min(
        CONFIG.missionMaximumConsecutiveHeaderPortals,
        Number.parseInt(routeParameters.get("eimei-header-streak") || "0", 10) || 0
      ))
      : 0;
    const requestedHeaderPortalTotal = requestedRouteStage === "continue"
      ? Math.max(0, Number.parseInt(routeParameters.get("eimei-header-total") || "0", 10) || 0)
      : 0;
    const requestedPortalPages = (requestedRouteStage === "continue"
      ? routeParameters.get("eimei-route-pages") || ""
      : "")
      .split("|")
      .filter((path) => path.startsWith("/"))
      .slice(0, CONFIG.missionMaximumSegments - 1);
    let pendingTransition = null;
    let transitionStorageAvailable = true;
    try {
      pendingTransition = JSON.parse(sessionStorage.getItem("eimei-pending-transition") || "null");
    } catch {
      transitionStorageAvailable = false;
    }
    const validPendingTransition = Boolean(
      pendingTransition &&
      pendingTransition.runId === requestedRunId &&
      pendingTransition.segment === requestedSegment &&
      pendingTransition.pathname === location.pathname
    );
    const staleHttpContinuation = requestedRouteStage === "continue" &&
      location.protocol !== "file:" &&
      transitionStorageAvailable &&
      !validPendingTransition;
    const routeStage = staleHttpContinuation ? null : requestedRouteStage;
    if (validPendingTransition) {
      try {
        sessionStorage.removeItem("eimei-pending-transition");
      } catch {
        // Query parameters remain a safe fallback when storage is unavailable.
      }
    }
    const fromPath = routeStage === "continue" || routeStage === "plan" ? routeParameters.get("eimei-from") : null;
    const arrivedFromPath = routeStage === "arrival" ? routeParameters.get("eimei-from") : fromPath;
    const segmentIndex = routeStage === "continue" ? Math.max(0, Math.min(
      CONFIG.missionMaximumSegments - 1,
      requestedSegment
    )) : 0;
    const visitedPaths = new Set(
      (routeStage === "continue" || routeStage === "plan" ? routeParameters.get("eimei-visited") || "" : "")
        .split("|")
        .filter((path) => path.startsWith("/"))
    );
    visitedPaths.add(pageIdentity());
    const forcedMode = routeStage === "continue"
      ? routeParameters.get("eimei-mode") || "any"
      : routeStage === "portal" ? "portal" : null;
    const arrivalSpawn = routeStage === "continue" || routeStage === "arrival" || routeStage === "plan"
      ? incomingPortalSpawn(arrivedFromPath)
      : null;
    const continuationLimits = routeStage === "continue" ? {
      minimumSteps: 7,
      maximumSteps: 12,
      minimumTravel: Math.max(1500, window.innerHeight * 2.6),
      maximumTravel: Math.max(3600, window.innerHeight * 7.2),
      minimumDirect: Math.max(900, window.innerHeight * CONFIG.missionMinimumDirectViewport)
    } : { recentSpawns: recentSpawnRecords() };
    let fixedFinalGoal = finalGoalSpecFromParameters(routeParameters);
    const currentPage = pageIdentity();
    if (!planningMode) {
      startScoreAttackMission({
        routeParameters,
        routeStage,
        requestedRouteStage,
        requestedRunId,
        requestedSegment,
        fromPath,
        arrivalSpawn,
        fixedFinalGoal,
        visitedPaths
      });
      return;
    }
    const plannedArrivalIndex = requestedPortalPages.indexOf(currentPage);
    const arrivedOffPlan = routeStage === "continue" &&
      Boolean(fixedFinalGoal) &&
      fixedFinalGoal.page !== currentPage &&
      plannedArrivalIndex < 0;
    // Entering a later valid portal is a shortcut, not a reason to navigate
    // backwards through earlier stages. Consume the skipped prefix as well.
    if (plannedArrivalIndex >= 0) requestedPortalPages.splice(0, plannedArrivalIndex + 1);
    const plannedNextPage = requestedPortalPages[0] || null;
    const targetMinimum = Math.max(12000, window.innerHeight * CONFIG.missionTargetMinimumViewport);
    const targetMaximum = Math.max(targetMinimum + 4500, window.innerHeight * CONFIG.missionTargetMaximumViewport);
    const targetRouteDistance = !planningMode && !fixedFinalGoal && routeStage !== "continue"
      ? targetMinimum + Math.random() * (targetMaximum - targetMinimum)
      : 0;
    const selectionLimits = targetRouteDistance > 0
      ? {
        ...continuationLimits,
        minimumTravel: targetRouteDistance,
        maximumTravel: Math.max(targetRouteDistance + 3000, window.innerHeight * CONFIG.missionTargetMaximumViewport)
      }
      : continuationLimits;
    const plannedText = planningMode ? pickPlannedFinalMission(arrivalSpawn, planningDistance) : null;
    const plannedTextMeetsDistance = Boolean(
      plannedText && plannedText.routeDistance >= planningDistance * CONFIG.missionPlanningCompletionRatio
    );
    const planningBridgeOptions = planningMode && !plannedTextMeetsDistance && planningHopsLeft > 0
      ? (bridgePortalMissionOptions(arrivalSpawn, visitedPaths, "any") || []).filter((candidate) =>
        !candidate.globalNavigation ||
        (
          planningHeaderPortalStreak < CONFIG.missionMaximumConsecutiveHeaderPortals &&
          planningHeaderPortalTotal < CONFIG.missionMaximumHeaderPortals
        )
      )
      : [];
    // A short header click must not outrank a portal reached after meaningful
    // play merely because its destination is a showcase page. Prefer a useful
    // stretch inside the current page; page changes then happen only when they
    // actually contribute to the requested course distance.
    const meaningfulPlanningBridges = planningBridgeOptions.filter((candidate) =>
      candidate.routeDistance >= Math.max(520, window.innerHeight * 0.72)
    );
    const planningBridgePool = meaningfulPlanningBridges.length > 0
      ? meaningfulPlanningBridges
      : planningBridgeOptions;
    const planningBridgeScore = (candidate) =>
      candidate.routeDistance +
      planningDestinationPriority(candidate.portalDestination) * 60 +
      (candidate.globalNavigation ? 0 : 720);
    const rankedPlanningBridges = planningBridgePool.toSorted((a, b) =>
      planningBridgeScore(b) - planningBridgeScore(a)
    );
    // Branch among genuinely strong options instead of always following the
    // same high-priority page chain. The quality floor keeps variety from
    // turning into needless extra transitions, and visited pages stay banned.
    const bestPlanningScore = rankedPlanningBridges[0]
      ? planningBridgeScore(rankedPlanningBridges[0])
      : -Infinity;
    const variedPlanningBridges = rankedPlanningBridges
      .filter((candidate) => planningBridgeScore(candidate) >= bestPlanningScore - 360)
      .slice(0, 3);
    const planningBridge = variedPlanningBridges[randomIndex(variedPlanningBridges.length)] || null;
    // Compare only a few strong branches. Loading every menu link would turn
    // route generation into its own (very slow) game.
    const planningBridges = planningBridge
      ? [planningBridge, ...rankedPlanningBridges.filter((candidate) => candidate !== planningBridge)].slice(0, 3)
      : [];
    const remainingPlannedPages = fixedFinalGoal
      ? [...requestedPortalPages, fixedFinalGoal.page]
      : [];
    const plannedContinuationPair = fixedFinalGoal && fixedFinalGoal.page !== currentPage
      ? pickPortalTowardAnyPlannedPage(arrivalSpawn, remainingPlannedPages, visitedPaths, {
        allowGlobalNavigation:
          requestedHeaderPortalStreak < CONFIG.missionMaximumConsecutiveHeaderPortals &&
          requestedHeaderPortalTotal < CONFIG.missionMaximumHeaderPortals
      })
      : null;
    // Only an actual wrong turn may use a hub as a one-hop recovery. Normal
    // route following never receives this arbitrary fallback, which preserves
    // the no-detour rule without allowing the guide to disappear when a player
    // deliberately explores another portal.
    const offRouteRecoveryPair = arrivedOffPlan && !plannedContinuationPair
      ? pickBridgePortalMission(arrivalSpawn, visitedPaths, "any")
      : null;
    let pair = planningMode
      ? (plannedTextMeetsDistance ? plannedText : planningBridge || plannedText)
        : fixedFinalGoal && fixedFinalGoal.page === currentPage
        ? routePairToFixedGoal(arrivalSpawn, fixedFinalGoal)
        : fixedFinalGoal
          ? plannedContinuationPair || offRouteRecoveryPair
          : pickMissionPair(forcedMode, visitedPaths, arrivalSpawn, selectionLimits);
    if (
      pair?.goalKind === "text" &&
      targetRouteDistance > 0 &&
      pair.routeDistance < targetRouteDistance
    ) {
      pair = pickBridgePortalMission(pair.spawn, visitedPaths, forcedMode) || pair;
    }
    const pairIsDistantFinal = pair?.goalKind === "text" &&
      pair.route.length - 1 >= (selectionLimits.minimumSteps || CONFIG.missionMinimumSteps) &&
      pair.routeDistance >= (selectionLimits.minimumTravel || Math.max(1250, window.innerHeight * CONFIG.missionMinimumTravelViewport)) &&
      directBodyDistance(pair.spawn, pair.goal) >= (selectionLimits.minimumDirect || Math.max(720, window.innerHeight * CONFIG.missionMinimumDirectViewport));
    if (
      pair?.goalKind === "text" &&
      !pairIsDistantFinal &&
      !planningMode &&
      !fixedFinalGoal &&
      segmentIndex < CONFIG.missionMaximumSegments - 1
    ) {
      pair = pickBridgePortalMission(pair.spawn, visitedPaths, forcedMode) || pair;
    }
    if (!pair?.spawn || !pair?.goal) {
      if (planningMode) {
        window.parent.postMessage({
          type: "eimei-final-goal-plan",
          token: routeParameters.get("eimei-plan-token"),
          ok: false
        }, "*");
      }
      if (routeStage === "start" && requestedStartAttempt < CONFIG.missionStartMaximumAttempts && redirectToRandomStartPage({
        force: true,
        startAttempt: requestedStartAttempt,
        triedPageKeys: requestedStartTriedPages
      })) return;
      placeAtSpawn();
      mission.initialized = false;
      return;
    }

    placePlayerOnBody(pair.spawn, {
      randomizeX: routeStage !== "continue" && routeStage !== "arrival" && routeStage !== "plan",
      recentSpawns: continuationLimits.recentSpawns || []
    });
    if (routeStage !== "continue" && routeStage !== "plan") rememberSpawnPoint();
    let safeGoalPlayerX;
    if (pair.goalKind === "portal" && pair.portalAnchor) {
      const region = anchorRegion(pair.goal, pair.portalAnchor);
      const matchingXs = pair.goal.navigationXs.filter((x) =>
        x + player.width * 0.5 >= region.left && x + player.width * 0.5 <= region.right
      );
      safeGoalPlayerX = (matchingXs.length ? matchingXs : pair.goal.navigationXs)[randomIndex((matchingXs.length ? matchingXs : pair.goal.navigationXs).length)];
    } else if (fixedFinalGoal) {
      safeGoalPlayerX = pair.goal.navigationXs
        .toSorted((a, b) =>
          Math.abs(a + player.width * 0.5 - fixedFinalGoal.x) -
          Math.abs(b + player.width * 0.5 - fixedFinalGoal.x)
        )[0];
    } else {
      safeGoalPlayerX = pair.goal.navigationXs[randomIndex(pair.goal.navigationXs.length)];
    }
    const safeGoalX = safeGoalPlayerX + player.width * 0.5;
    const goalPoint = { x: safeGoalX, y: pair.goal.y };
    mission.initialized = true;
    mission.spawnBody = pair.spawn;
    mission.goalBody = pair.goal;
    mission.goalElement = pair.portalAnchor || sourceElementAt(pair.goal, goalPoint.x);
    mission.goalPoint = { x: goalPoint.x, y: pair.goal.y };
    mission.goalKind = pair.goalKind || "text";
    mission.portalAnchor = pair.portalAnchor || null;
    mission.portalDestination = pair.portalDestination || null;
    mission.continuationMode = pair.continuationMode || null;
    mission.continuationPortals = 0;
    mission.runId = (routeStage === "continue" || routeStage === "plan") && requestedRunId
      ? requestedRunId
      : `${Date.now().toString(36)}-${randomIndex(0x100000).toString(36)}`;
    mission.segmentIndex = segmentIndex;
    mission.visitedPaths = [...visitedPaths].slice(-CONFIG.missionMaximumSegments);
    mission.routeDistance = pair.routeDistance || routeTravelDistance(pair.route);
    mission.route = pair.route;
    mission.routePhysicalAtPlan = routeIsPhysicallyConnected(pair.route);
    mission.routeIndex = Math.max(0, pair.route.length - 1);
    mission.lastStandingBody = pair.spawn;
    mission.completed = false;
    mission.completedAt = -Infinity;
    mission.needsReplan = false;
    mission.lostGuideSince = -Infinity;
    mission.overtookGuideSince = -Infinity;
    mission.nextAdvanceAllowedAt = -Infinity;
    mission.guideNearSince = -Infinity;
    mission.lastAdvanceX = -Infinity;
    mission.lastAdvanceY = -Infinity;
    mission.finalGoalPage = fixedFinalGoal?.page || (pair.goalKind === "text" ? pageIdentity() : pageIdentity(pair.portalDestination));
    mission.finalGoalX = fixedFinalGoal?.x ?? (pair.goalKind === "text" ? mission.goalPoint.x : null);
    mission.finalGoalY = fixedFinalGoal?.y ?? (pair.goalKind === "text" ? mission.goalBody.y : null);
    mission.finalGoalReady = Boolean(fixedFinalGoal || pair.goalKind === "text");
    mission.plannedPortalTransitions = pair.goalKind === "portal" ? 1 : 0;
    mission.headerPortalStreak = routeStage === "continue" ? requestedHeaderPortalStreak : 0;
    mission.headerPortalTotal = routeStage === "continue" ? requestedHeaderPortalTotal : 0;
    mission.plannedPortalPages = routeStage === "continue"
      ? requestedPortalPages
      : pair.goalKind === "portal" && pair.portalDestination
        ? [pageIdentity(pair.portalDestination)]
        : [];
    mission.planningTrace = [];
    mission.recoveringFromDetour = Boolean(offRouteRecoveryPair && pair === offRouteRecoveryPair);
    mission.startAttempt = requestedStartAttempt;
    mission.startTriedPages = requestedStartTriedPages;
    mission.targetRouteDistance = targetRouteDistance || planningDistance;
    mission.plannedRouteDistance = pair.routeDistance || 0;
    setKeypointGuide();
    if (planningMode) {
      mission.previewStartedAt = -Infinity;
      mission.previewUntil = -Infinity;
      const parentToken = routeParameters.get("eimei-plan-token");
      const localGoal = plannedText ? {
        page: pageIdentity(),
        x: plannedText.goal.navigationXs
          .map((x) => x + player.width * .5)
          .toSorted((a, b) => Math.abs(a - bodyCenterX(plannedText.goal)) - Math.abs(b - bodyCenterX(plannedText.goal)))[0],
        y: plannedText.goal.y,
        distance: plannedText.routeDistance
      } : null;
      window.parent.postMessage({
        type: "eimei-final-goal-plan",
        token: parentToken,
        ok: Boolean(localGoal || planningBridges.length > 0),
        scan: true,
        page: pageIdentity(),
        headerPortalStreak: planningHeaderPortalStreak,
        headerPortalTotal: planningHeaderPortalTotal,
        localGoal,
        bridges: planningBridges.map((bridge) => ({
          href: bridge.portalDestination.href,
          page: pageIdentity(bridge.portalDestination),
          distance: bridge.routeDistance,
          globalNavigation: bridge.globalNavigation
        }))
      }, "*");
      return;
    }
    if (routeStage !== "continue" && segmentIndex === 0) {
      if (mission.finalGoalReady) {
        beginMissionPreview({
          pageUrl: location.href,
          goalX: mission.finalGoalX,
          goalY: mission.finalGoalY
        });
      } else {
        planFinalGoal(pair.portalDestination, {
          remainingDistance: Math.max(0, targetRouteDistance - pair.routeDistance),
          hopsLeft: CONFIG.missionPlanningMaximumPortals,
          headerPortalStreak: pair.globalNavigation ? 1 : 0,
          headerPortalTotal: pair.globalNavigation ? 1 : 0
        });
      }
    }
    mission.startPageRandomized = requestedRouteStage === "start";
    mission.startPageKey = pageIdentity();
    if (requestedRouteStage) {
      const cleanUrl = new URL(location.href);
      for (const key of [
        "eimei-route",
        "eimei-mode",
        "eimei-run",
        "eimei-segment",
        "eimei-from",
        "eimei-visited",
        "eimei-portals",
        "eimei-start-attempt",
        "eimei-start-tried",
        "eimei-final-page",
        "eimei-final-x",
        "eimei-final-y",
        "eimei-plan-token",
        "eimei-plan-distance",
        "eimei-plan-hops",
        "eimei-plan-header-streak",
        "eimei-plan-header-total",
        "eimei-header-streak",
        "eimei-header-total",
        "eimei-route-pages"
      ]) cleanUrl.searchParams.delete(key);
      history.replaceState(history.state, "", cleanUrl.href);
    }
  }

  function bodyDescriptor(body) {
    if (!body) return null;
    return {
      kind: body.kind,
      x: body.x,
      y: body.y,
      reference: body,
      element: body.kind === "text" ? sourceElementAt(body, bodyCenterX(body)) : null
    };
  }

  function remappedRouteBody(descriptor) {
    if (!descriptor) return null;
    const candidates = state.bodies.filter((body) =>
      body.kind === descriptor.kind &&
      body.navigationXs?.length &&
      (!descriptor.element || body.sourceRegions?.some((region) => region.element === descriptor.element))
    );
    const pool = candidates.length > 0
      ? candidates
      : state.bodies.filter((body) => body.kind === descriptor.kind && body.navigationXs?.length);
    return pool.toSorted((a, b) =>
      Math.abs(a.y - descriptor.y) * 6 + Math.abs(bodyCenterX(a) - descriptor.x) -
      (Math.abs(b.y - descriptor.y) * 6 + Math.abs(bodyCenterX(b) - descriptor.x))
    )[0] || null;
  }

  function remappedGoal(previousGoal) {
    if (!previousGoal) return null;
    const eligible = state.textBodies.filter((body) => {
      if (!body.navigationXs?.length) return false;
      if (mission.goalKind !== "portal") return isContentGoalBody(body);
      if (!mission.portalAnchor) return false;
      const region = anchorRegion(body, mission.portalAnchor);
      const containsAnchor = body.sourceRegions?.some((item) => item.element.closest("a[href]") === mission.portalAnchor);
      const safeAtAnchor = body.navigationXs.some((x) => {
        const centerX = x + player.width * 0.5;
        return centerX >= region.left && centerX <= region.right;
      });
      return containsAnchor && safeAtAnchor;
    });
    // A dropdown link disappears from the collision map as soon as its menu
    // closes. Use the visible parent tab only while the real link is hidden.
    // Once the menu opens, retaining both candidates makes the nearby proxy
    // win the distance sort and leaves the goal swarm floating on the tab.
    if (mission.goalKind === "portal" && mission.portalAnchor && eligible.length === 0) {
      const proxy = portalBodyForAnchor(mission.portalAnchor);
      if (proxy) eligible.push(proxy);
    }
    const byElement = previousGoal.element ? eligible.filter((body) =>
      body.sourceRegions?.some((region) =>
        region.element === previousGoal.element ||
        (mission.goalKind === "portal" && region.element.closest("a[href]") === mission.portalAnchor)
      )
    ) : [];
    return [...byElement, ...eligible]
      .filter((body, index, all) => all.indexOf(body) === index)
      .toSorted((a, b) =>
        Math.abs(a.y - previousGoal.y) * 8 + Math.abs(bodyCenterX(a) - previousGoal.x) -
        (Math.abs(b.y - previousGoal.y) * 8 + Math.abs(bodyCenterX(b) - previousGoal.x))
      )[0] || null;
  }

  function nearestSupportingBody() {
    const centerX = player.x + player.width * 0.5;
    const feet = player.y + player.height;
    return navigationBodies()
      .filter((body) => body.y >= feet - 8)
      .toSorted((a, b) =>
        Math.abs(a.y - feet) + Math.abs(bodyCenterX(a) - centerX) * 0.28 -
        (Math.abs(b.y - feet) + Math.abs(bodyCenterX(b) - centerX) * 0.28)
      )[0] || null;
  }

  function navigationRouteBetween(fromBody, targetBody) {
    let route = fromBody.y <= targetBody.y
      ? downwardRouteFromTo(fromBody, targetBody)
      : routeFromTo(fromBody, targetBody);
    if (route.length === 0) route = generalRouteFromTo(fromBody, targetBody);
    return route;
  }

  function replanNavigation(fromBody = player.navigationBody || nearestSupportingBody()) {
    if (race.active) {
      configureRaceMissionTarget({ launchFromPlayer: false });
      return;
    }
    if (!mission.initialized || mission.completed || !mission.goalBody || !fromBody) return;
    let route = [];
    const remainingRoute = mission.route.slice(mission.routeIndex);
    // Falling off a platform should reconnect to the earliest reachable point
    // in the planned course. Going straight to the final goal made a long run
    // collapse into two or three markers and made the swarm appear indecisive.
    for (let index = 0; index < remainingRoute.length; index += 1) {
      const waypoint = remainingRoute[index];
      const connector = bodiesDescribeSamePlatform(fromBody, waypoint)
        ? [fromBody]
        : navigationRouteBetween(fromBody, waypoint);
      if (connector.length === 0) continue;
      const candidate = [...connector, ...remainingRoute.slice(index + 1)]
        .filter((body, routeIndex, all) => routeIndex === 0 || body !== all[routeIndex - 1]);
      if (!routeIsPhysicallyConnected(candidate)) continue;
      route = candidate;
      break;
    }
    if (route.length === 0) route = navigationRouteBetween(fromBody, mission.goalBody);
    if (route.length === 0) {
      // Never invent a one-step route when the graph cannot reach the goal.
      // That old fallback made the marker jump to whichever nearby row happened
      // to sort first, then finally point through solid text. Keep the last
      // truthful target until a menu/layout rebuild provides a real connection.
      mission.needsReplan = false;
      mission.lostGuideSince = -Infinity;
      mission.lastReplanAt = performance.now() / 1000;
      setKeypointGuide({ launchFromPlayer: false, preserveTarget: true });
      return;
    }
    mission.route = route;
    mission.routePhysicalAtPlan = routeIsPhysicallyConnected(route);
    mission.lastReplanAt = performance.now() / 1000;
    setKeypointGuide();
  }

  function remapMission(previousGoal, previousRoute = [], previousGuide = null, { preservePlannedRoute = false } = {}) {
    if (race.active && race.course) {
      configureRaceMissionTarget({ launchFromPlayer: false });
      return;
    }
    if (!mission.initialized || !previousGoal) return;
    const goal = remappedGoal(previousGoal);
    if (!goal) return;
    mission.goalBody = goal;
    mission.goalElement = mission.goalKind === "portal"
      ? mission.portalAnchor
      : sourceElementAt(goal, previousGoal.x);
    if (mission.goalKind === "portal" && mission.portalAnchor) {
      const region = anchorRegion(goal, mission.portalAnchor);
      const matchingXs = (goal.navigationXs || []).filter((x) =>
        x + player.width * 0.5 >= region.left && x + player.width * 0.5 <= region.right
      );
      const portalX = matchingXs
        .toSorted((a, b) =>
          Math.abs(a + player.width * 0.5 - previousGoal.x) -
          Math.abs(b + player.width * 0.5 - previousGoal.x)
        )[0];
      mission.goalPoint = {
        x: Number.isFinite(portalX) ? portalX + player.width * 0.5 : Math.max(region.left, Math.min(previousGoal.x, region.right)),
        y: goal.y
      };
    } else {
      const safeCenterX = (goal.navigationXs || [])
        .map((x) => x + player.width * 0.5)
        .toSorted((a, b) => Math.abs(a - previousGoal.x) - Math.abs(b - previousGoal.x))[0];
      mission.goalPoint = { x: safeCenterX ?? bodyCenterX(goal), y: goal.y };
    }
    player.navigationBody = supportingMapBody();
    if (preservePlannedRoute && previousRoute.length > 0) {
      const support = player.navigationBody || nearestSupportingBody();
      const stableTargets = previousRoute.map((descriptor) => {
        if (!descriptor.element) return remappedRouteBody(descriptor);
        return state.bodies
          .filter((body) =>
            body.kind === descriptor.kind &&
            body.navigationXs?.length &&
            body.sourceRegions?.some((region) => region.element === descriptor.element)
          )
          .toSorted((a, b) =>
            Math.abs(a.y - descriptor.y) * 6 + Math.abs(bodyCenterX(a) - descriptor.x) -
            (Math.abs(b.y - descriptor.y) * 6 + Math.abs(bodyCenterX(b) - descriptor.x))
          )[0] || null;
      }).filter(Boolean);
      // The last step is the only one allowed to move with an opening menu:
      // the parent tab becomes the actual link row, and returns to the tab
      // when the dropdown closes. All earlier course steps stay untouched.
      if (stableTargets.length > 0) stableTargets[stableTargets.length - 1] = goal;
      if (support && stableTargets.length > 0 && bodiesDescribeSamePlatform(support, stableTargets[0])) {
        stableTargets.shift();
      }
      const proposedRoute = (support ? [support, ...stableTargets] : stableTargets)
        .filter((body, index, all) => index === 0 || !bodiesDescribeSamePlatform(body, all[index - 1]));
      let physicalRoute = routeIsPhysicallyConnected(proposedRoute) ? proposedRoute : [];
      if (physicalRoute.length === 0 && support) {
        physicalRoute = [support];
        for (const target of stableTargets) {
          const from = physicalRoute.at(-1);
          if (from === target || bodiesDescribeSamePlatform(from, target)) continue;
          const connector = bodiesHaveNavigationEdge(from, target)
            ? [from, target]
            : navigationRouteBetween(from, target);
          if (connector.length === 0) {
            physicalRoute = [];
            break;
          }
          physicalRoute.push(...connector.slice(1));
        }
      }
      if (physicalRoute.length === 0 && support) physicalRoute = generalRouteFromTo(support, goal);
      if (physicalRoute.length === 0) {
        replanNavigation(support || nearestSupportingBody());
        return;
      }
      if (physicalRoute.at(-1) !== goal) {
        const from = physicalRoute.at(-1);
        const connector = bodiesHaveNavigationEdge(from, goal)
          ? [from, goal]
          : navigationRouteBetween(from, goal);
        if (connector.length > 0) physicalRoute.push(...connector.slice(1));
      }
      mission.route = physicalRoute;
      mission.routePhysicalAtPlan = routeIsPhysicallyConnected(physicalRoute);
      const mappedPreviousGuide = previousGuide ? remappedRouteBody(previousGuide) : null;
      const preservesGuide = Boolean(
        mappedPreviousGuide && bodiesDescribeSamePlatform(mappedPreviousGuide, goal)
      );
      setKeypointGuide({
        launchFromPlayer: false,
        preserveTarget: preservesGuide
      });
      mission.lastRemapDiagnostics = {
        support: Boolean(support),
        proposedLength: proposedRoute.length,
        proposedPhysical: routeIsPhysicallyConnected(proposedRoute),
        replacementLength: mission.route.length,
        replacementPhysical: routeIsPhysicallyConnected(mission.route),
        transient: true
      };
      return;
    }
    const mapped = previousRoute
      .map(remappedRouteBody)
      .filter(Boolean)
      .filter((body, index, all) => index === 0 || body !== all[index - 1]);
    if (mapped.at(-1) !== goal) mapped.push(goal);
    const support = player.navigationBody || nearestSupportingBody();
    if (support && mapped[0] === support) mapped.shift();
    if (mapped.length > 0) {
      const proposedRoute = support ? [support, ...mapped] : mapped;
      const proposedPhysical = routeIsPhysicallyConnected(proposedRoute);
      const physicalRoute = proposedPhysical
        ? proposedRoute
        : support
          ? generalRouteFromTo(support, goal)
          : [];
      mission.lastRemapDiagnostics = {
        support: Boolean(support),
        proposedLength: proposedRoute.length,
        proposedPhysical,
        replacementLength: physicalRoute.length,
        replacementPhysical: routeIsPhysicallyConnected(physicalRoute)
      };
      if (physicalRoute.length === 0) {
        replanNavigation(support || nearestSupportingBody());
        return;
      }
      mission.route = physicalRoute;
      mission.routePhysicalAtPlan = routeIsPhysicallyConnected(physicalRoute);
      const mappedPreviousGuide = previousGuide ? remappedRouteBody(previousGuide) : null;
      const preservesGuide = Boolean(mappedPreviousGuide && bodiesDescribeSamePlatform(mappedPreviousGuide, goal));
      setKeypointGuide({
        launchFromPlayer: false,
        preserveTarget: preservesGuide
      });
    } else {
      replanNavigation(support || nearestSupportingBody());
    }
  }

  function placeAtSpawn() {
    const body = pickSpawnBody();
    if (!body) {
      player.x = window.innerWidth * 0.5;
      player.y = 20;
    } else {
      player.x = Math.max(body.x + 2, Math.min(body.x + body.width * 0.5 - player.width * 0.5, body.x + body.width - player.width - 2));
      player.y = body.y - player.height - 1;
    }
    player.spawnX = player.x;
    player.spawnY = player.y;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.airJumpsRemaining = 1;
    player.airJumpAt = -Infinity;
    player.dropThroughBody = null;
    player.dropThroughUntil = -Infinity;
    cancelDropHatch();
    cancelLadderTraversal();
    web.active = false;
    web.anchorBody = null;
    web.remotePlayerId = null;
    web.hatchPhase = "none";
    web.mantlePhase = "none";
    web.mantleBody = null;
    web.charges = CONFIG.webMaximumCharges;
  }

  function respawn() {
    player.x = player.spawnX;
    player.y = player.spawnY;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.airJumpsRemaining = 1;
    player.airJumpAt = -Infinity;
    player.dropThroughBody = null;
    player.dropThroughUntil = -Infinity;
    cancelDropHatch();
    cancelLadderTraversal();
    web.active = false;
    web.anchorBody = null;
    web.remotePlayerId = null;
    web.hatchPhase = "none";
    web.mantlePhase = "none";
    web.mantleBody = null;
    web.charges = CONFIG.webMaximumCharges;
    interaction.portal = null;
    if (mission.initialized) {
      mission.lastStandingBody = mission.spawnBody;
      mission.needsReplan = false;
      mission.lostGuideSince = -Infinity;
      mission.overtookGuideSince = -Infinity;
      mission.nextAdvanceAllowedAt = -Infinity;
      mission.guideNearSince = -Infinity;
      mission.lastAdvanceX = -Infinity;
      mission.lastAdvanceY = -Infinity;
      if (race.active) configureRaceMissionTarget({ launchFromPlayer: true });
      else replanNavigation(mission.spawnBody);
    }
    window.scrollTo({ top: Math.max(0, player.y - window.innerHeight * 0.42), behavior: "instant" });
  }

  function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function overlappingBodies(box) {
    const nowSeconds = performance.now() / 1000;
    return state.bodies.filter((body) => {
      if (!intersects(box, body)) return false;
      if (
        nowSeconds < player.dropThroughUntil &&
        (body === player.dropThroughBody || Math.abs(body.y - player.dropThroughSurfaceY) <= 3)
      ) return false;
      return true;
    });
  }

  function isThinPlatform(body) {
    return Boolean(body && body.height <= CONFIG.dropThroughMaximumThickness);
  }

  function cancelDropHatch() {
    dropHatch.phase = "none";
    dropHatch.time = 0;
    dropHatch.body = null;
    dropHatch.visualY = null;
  }

  function portalAtFeet() {
    const body = standingTextBody();
    const element = sourceElementAt(body, player.x + player.width * 0.5);
    return Boolean(portalTarget(element?.closest?.("a[href]") || null));
  }

  function tryDropThrough(nowSeconds) {
    if (
      nowSeconds - input.downPressedAt > 0.18 ||
      !player.grounded ||
      web.hatchPhase !== "none" ||
      web.active ||
      dropHatch.phase !== "none" ||
      ladderTraversal.phase !== "none" ||
      interaction.portal?.entering ||
      portalAtFeet()
    ) return false;
    const support = player.navigationBody || supportingMapBody();
    if (!isThinPlatform(support)) return false;
    if (tutorial.active && support.sourceElement?.matches?.("[data-eimei-tutorial-release]")) return false;
    input.downPressedAt = -Infinity;
    player.dropThroughBody = support;
    player.dropThroughSurfaceY = support.y;
    player.dropThroughUntil = nowSeconds + CONFIG.dropThroughSeconds;
    dropHatch.phase = "kicking";
    dropHatch.time = 0;
    dropHatch.body = support;
    dropHatch.startX = player.x;
    dropHatch.startY = player.y;
    dropHatch.topY = support.y;
    dropHatch.bottomY = support.y + support.height;
    dropHatch.width = Math.max(player.width, Math.min(support.width - 2, player.width * 2.05));
    const playerCenterX = player.x + player.width * 0.5;
    const minimumCenterX = support.x + dropHatch.width * 0.5 + 1;
    const maximumCenterX = support.x + support.width - dropHatch.width * 0.5 - 1;
    const preferredOffset = dropHatch.width * 0.5 + player.width * 0.5 + 6;
    const facing = player.facing || 1;
    const preferredCenterX = Math.max(minimumCenterX, Math.min(playerCenterX + facing * preferredOffset, maximumCenterX));
    const oppositeCenterX = Math.max(minimumCenterX, Math.min(playerCenterX - facing * preferredOffset, maximumCenterX));
    dropHatch.centerX = Math.abs(preferredCenterX - playerCenterX) >= Math.abs(oppositeCenterX - playerCenterX)
      ? preferredCenterX
      : oppositeCenterX;
    player.facing = dropHatch.centerX >= playerCenterX ? 1 : -1;
    dropHatch.targetX = dropHatch.centerX - player.width * 0.5;
    // Crossing the hidden interior is not a dramatic beat. Keep only enough
    // time for one to five physics frames so the visible dive flows directly
    // into the underside emergence without changing its exit speed.
    dropHatch.traverseDuration = Math.min(0.04, Math.max(0.016, support.height * 0.0014));
    dropHatch.visualY = player.y;
    dropHatch.started += 1;
    if (tutorial.active) tutorial.actions.drop = true;
    player.velocityX = 0;
    player.velocityY = 0;
    return true;
  }

  function updateDropHatch(dt, nowSeconds) {
    if (dropHatch.phase === "none" || !dropHatch.body) return false;
    dropHatch.time += dt;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.groundedAt = -Infinity;
    player.airJumpsRemaining = 1;
    player.airJumpAt = -Infinity;
    player.standingBody = null;
    player.navigationBody = null;

    if (dropHatch.phase === "kicking") {
      const progress = Math.min(1, dropHatch.time / CONFIG.dropHatchKickSeconds);
      player.x = dropHatch.startX;
      player.y = dropHatch.startY + Math.sin(progress * Math.PI) * 1.6;
      dropHatch.visualY = player.y;
      if (progress >= 1) {
        dropHatch.phase = "readying";
        dropHatch.time = 0;
        player.y = dropHatch.startY;
      }
      return true;
    }

    if (dropHatch.phase === "readying") {
      const progress = Math.min(1, dropHatch.time / CONFIG.dropHatchReadySeconds);
      const crouch = progress * progress * (3 - 2 * progress);
      player.x = dropHatch.startX;
      player.y = dropHatch.startY + crouch * 4.5;
      dropHatch.visualY = player.y;
      if (progress >= 1) {
        dropHatch.phase = "jumping";
        dropHatch.time = 0;
        dropHatch.startX = player.x;
        dropHatch.startY = player.y;
      }
      return true;
    }

    if (dropHatch.phase === "jumping") {
      const progress = Math.min(1, dropHatch.time / CONFIG.dropHatchJumpSeconds);
      const eased = progress * progress * (3 - 2 * progress);
      const landingY = dropHatch.topY - player.height - 5;
      player.x = dropHatch.startX + (dropHatch.targetX - dropHatch.startX) * eased;
      player.y = dropHatch.startY + (landingY - dropHatch.startY) * eased - Math.sin(progress * Math.PI) * 34;
      dropHatch.visualY = player.y;
      if (progress >= 1) {
        dropHatch.phase = "diving";
        dropHatch.time = 0;
        dropHatch.startY = player.y;
      }
      return true;
    }

    if (dropHatch.phase === "diving") {
      const progress = Math.min(1, dropHatch.time / CONFIG.dropHatchDiveSeconds);
      // Keep the character upright and carry the downward speed from the jump.
      // The feet cross the opening first; there is no slow head-first pivot at
      // the lip of the platform.
      const eased = progress;
      player.x = dropHatch.targetX;
      player.y = dropHatch.startY + (dropHatch.topY + 2 - dropHatch.startY) * eased;
      dropHatch.visualY = player.y;
      if (progress >= 1) {
        dropHatch.phase = "traversing";
        dropHatch.time = 0;
        dropHatch.startY = player.y;
        dropHatch.visualY = null;
      }
      return true;
    }

    if (dropHatch.phase === "traversing") {
      const progress = Math.min(1, dropHatch.time / dropHatch.traverseDuration);
      const eased = progress * progress * (3 - 2 * progress);
      player.x = dropHatch.targetX;
      player.y = dropHatch.startY + (dropHatch.bottomY + 1 - dropHatch.startY) * eased;
      if (progress >= 1) {
        dropHatch.phase = "bursting";
        dropHatch.time = 0;
        dropHatch.startY = player.y;
        dropHatch.visualY = dropHatch.bottomY - player.height + 1;
      }
      return true;
    }

    const progress = Math.min(1, dropHatch.time / CONFIG.dropHatchBurstSeconds);
    const eased = 1 - Math.pow(1 - progress, 3);
    const exitY = dropHatch.bottomY + 9;
    player.x = dropHatch.targetX;
    player.y = dropHatch.startY + (exitY - dropHatch.startY) * eased;
    dropHatch.visualY = dropHatch.bottomY - player.height + 1 +
      (exitY - (dropHatch.bottomY - player.height + 1)) * eased;
    if (progress >= 1) {
      player.y = exitY;
      player.velocityY = CONFIG.dropThroughSpeed;
      player.dropThroughUntil = nowSeconds + 0.24;
      dropHatch.phase = "none";
      dropHatch.time = 0;
      dropHatch.body = null;
      dropHatch.visualY = null;
      dropHatch.completed += 1;
    }
    return true;
  }

  function cancelLadderTraversal() {
    ladderTraversal.phase = "none";
    ladderTraversal.time = 0;
    ladderTraversal.ladder = null;
    ladderTraversal.visualY = null;
    ladderTraversal.sideDismountArmed = false;
  }

  function ladderInReach({ menuOnly = false } = {}) {
    const centerX = player.x + player.width * 0.5;
    const feet = player.y + player.height;
    return activeLadders()
      .filter((ladder) =>
        (!menuOnly || ladder.menu) &&
        Math.abs(centerX - ladder.x) <= CONFIG.ladderGrabHorizontalPx &&
        feet >= ladder.topY - 8 &&
        player.y <= ladder.bottomY + 12
      )
      .toSorted((a, b) => {
        const verticalA = feet < a.topY ? a.topY - feet : feet > a.bottomY ? feet - a.bottomY : 0;
        const verticalB = feet < b.topY ? b.topY - feet : feet > b.bottomY ? feet - b.bottomY : 0;
        return Math.abs(centerX - a.x) + verticalA * 0.35 - (Math.abs(centerX - b.x) + verticalB * 0.35);
      })[0] || null;
  }

  function keepMenuLadderOpen(ladder, nowSeconds) {
    if (!ladder?.menu || !ladder.overlayOwner) return;
    const expiry = nowSeconds + CONFIG.hoverHoldSeconds;
    for (const element of hoverChain(ladder.overlayOwner)) {
      element.classList.add("eimei-player-hover");
      interaction.activeElements.set(element, expiry);
    }
    interaction.sourceElement = ladder.overlayOwner;
    interaction.holdUntil = expiry;
  }

  function ladderSideLanding(ladder, direction) {
    const feet = player.y + player.height;
    // Dropdown rows are commonly about 70px apart. A 56px menu window lets
    // the player leave at any visual row without having to align one exact
    // character-height, while ordinary ladders retain the tighter feel.
    const maximumVerticalSnap = ladder.menu ? 56 : 28;
    const maximumHorizontalReach = CONFIG.ladderGrabHorizontalPx + player.width + 8;
    const candidates = [];
    for (const body of state.bodies) {
      if (
        (ladder.menu && !body.menuLedge) ||
        !body.navigationXs?.length ||
        body.y < feet - 4 ||
        body.y - feet > maximumVerticalSnap
      ) continue;
      for (const x of body.navigationXs) {
        const centerX = x + player.width * 0.5;
        if (Math.sign(centerX - ladder.x) !== direction) continue;
        const horizontalReach = Math.abs(centerX - ladder.x);
        if (horizontalReach > maximumHorizontalReach) continue;
        candidates.push({
          body,
          x,
          y: body.y - player.height,
          score: Math.abs(body.y - feet) * 3 + horizontalReach
        });
      }
    }
    return candidates.toSorted((a, b) => a.score - b.score)[0] || null;
  }

  function tryStartLadder() {
    if (
      (!input.up && !input.down) ||
      ladderTraversal.phase !== "none" ||
      performance.now() / 1000 < ladderTraversal.graceUntil ||
      dropHatch.phase !== "none" ||
      web.active ||
      web.hatchPhase !== "none" ||
      interaction.portal?.entering
    ) return false;
    const ladder = ladderInReach({ menuOnly: input.down && !input.up });
    if (!ladder) return false;
    ladderTraversal.phase = "climbing";
    ladderTraversal.time = 0;
    ladderTraversal.ladder = ladder;
    ladderTraversal.startX = player.x;
    ladderTraversal.startY = player.y;
    ladderTraversal.targetX = ladder.playerX;
    ladderTraversal.visualY = player.y;
    ladderTraversal.climbCycle = 0;
    ladderTraversal.sideDismountArmed = !input.left && !input.right;
    ladderTraversal.started += 1;
    if (tutorial.active) tutorial.ladderStartY = player.y;
    input.jump = false;
    input.jumpPressedAt = -Infinity;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.groundedAt = -Infinity;
    player.standingBody = null;
    player.navigationBody = null;
    return true;
  }

  function finishLadderAtBottom(ladder, nowSeconds) {
    player.x = ladder.playerX;
    player.y = ladder.bottomY - player.height;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = true;
    player.groundedAt = nowSeconds;
    player.airJumpsRemaining = 1;
    player.airJumpAt = -Infinity;
    player.standingBody = ladder.lowerBody?.kind === "text" ? ladder.lowerBody : null;
    player.navigationBody = ladder.lowerBody || null;
    ladderTraversal.graceUntil = nowSeconds + 0.2;
    cancelLadderTraversal();
  }

  function updateLadderTraversal(dt, nowSeconds) {
    const ladder = ladderTraversal.ladder;
    if (!ladder || ladderTraversal.phase === "none") return false;
    // Climbing a long dropdown ladder can take longer than the normal five
    // second hover hold. Keep its owner active through the climb and leave a
    // fresh hold window after dismount so the selected portal does not vanish.
    keepMenuLadderOpen(ladder, nowSeconds);
    ladderTraversal.time += dt;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.groundedAt = -Infinity;
    player.standingBody = null;
    player.navigationBody = null;

    if (ladderTraversal.phase === "climbing") {
      player.x = approach(player.x, ladder.playerX, 760 * dt);
      if (
        tutorial.active &&
        Number.isFinite(tutorial.ladderStartY) &&
        Math.abs(player.y - tutorial.ladderStartY) >= 64
      ) tutorial.actions.ladderClimb = true;
      if (input.space) {
        const jumpDirection = Number(input.right) - Number(input.left) || player.facing || 1;
        cancelLadderTraversal();
        player.velocityX = jumpDirection * CONFIG.maxRunSpeed * 0.72;
        player.velocityY = -CONFIG.jumpSpeed * 0.72;
        input.jumpPressedAt = -Infinity;
        return true;
      }
      const horizontalDirection = Number(input.right) - Number(input.left);
      if (horizontalDirection === 0) ladderTraversal.sideDismountArmed = true;
      if (
        ladderTraversal.sideDismountArmed &&
        horizontalDirection !== 0 &&
        ladderTraversal.time >= 0.08
      ) {
        const landing = ladderSideLanding(ladder, horizontalDirection);
        if (landing) {
          player.x = landing.x;
          player.y = landing.y;
          player.velocityX = horizontalDirection * CONFIG.maxRunSpeed * 0.22;
          player.velocityY = 0;
          player.facing = horizontalDirection;
          player.grounded = true;
          player.groundedAt = nowSeconds;
          player.airJumpsRemaining = 1;
          player.airJumpAt = -Infinity;
          player.standingBody = landing.body.kind === "text" ? landing.body : null;
          player.navigationBody = landing.body;
          ladderTraversal.graceUntil = nowSeconds + 0.28;
          if (tutorial.active) tutorial.actions.ladderDismount = true;
          cancelLadderTraversal();
          return true;
        }
        // Leave from the exact height currently chosen on the ladder. A large
        // forced offset plus an upward hop could start inside a text body; the
        // next collision pass then ejected the player to a distant edge.
        const tentativeX = ladder.playerX + horizontalDirection * 2;
        const tentativeBox = {
          x: tentativeX,
          y: player.y,
          width: player.width,
          height: player.height
        };
        const clearToLeave = !state.bodies.some((body) => intersects(tentativeBox, body));
        player.x = clearToLeave ? tentativeX : ladder.playerX;
        player.velocityX = horizontalDirection * CONFIG.maxRunSpeed * 0.58;
        player.velocityY = 0;
        player.facing = horizontalDirection;
        ladderTraversal.graceUntil = nowSeconds + 0.18;
        if (tutorial.active) tutorial.actions.ladderDismount = true;
        cancelLadderTraversal();
        return true;
      }
      const climbDirection = Number(input.down) - Number(input.up);
      // Advance the pose from actual climb input instead of wall-clock time.
      // Releasing both keys now holds the current hand and foot positions.
      ladderTraversal.climbCycle += climbDirection * CONFIG.ladderClimbSpeed * dt * 0.11;
      player.y += climbDirection * CONFIG.ladderClimbSpeed * dt;
      const bottomY = ladder.bottomY - player.height;
      if (player.y >= bottomY) {
        if (ladder.menu) {
          player.y = bottomY;
          ladderTraversal.visualY = player.y;
        } else if (climbDirection > 0) finishLadderAtBottom(ladder, nowSeconds);
        else player.y = bottomY;
        return true;
      }
      const gripY = ladder.topY + 1;
      if (player.y <= gripY) {
        player.y = gripY;
        if (!ladder.menu && climbDirection < 0) {
          ladderTraversal.phase = "gripping";
          ladderTraversal.time = 0;
          ladderTraversal.startY = player.y;
        }
      }
      ladderTraversal.visualY = player.y;
      return true;
    }

    player.x = ladder.playerX;
    if (ladderTraversal.phase === "gripping") {
      const progress = Math.min(1, ladderTraversal.time / CONFIG.ladderGripSeconds);
      player.y = ladder.topY + 1 + Math.sin(progress * Math.PI * 2) * 1.2;
      ladderTraversal.visualY = player.y;
      if (progress >= 1) {
        ladderTraversal.phase = "threading";
        ladderTraversal.time = 0;
        ladderTraversal.startY = player.y;
      }
      return true;
    }

    if (ladderTraversal.phase === "threading") {
      const progress = Math.min(1, ladderTraversal.time / CONFIG.ladderThreadSeconds);
      const eased = progress * progress * (3 - 2 * progress);
      const hiddenY = ladder.topY - player.height;
      player.y = ladderTraversal.startY + (hiddenY - ladderTraversal.startY) * eased;
      ladderTraversal.visualY = player.y;
      if (progress >= 1) {
        ladderTraversal.phase = "burrowing";
        ladderTraversal.time = 0;
        ladderTraversal.startY = player.y;
        ladderTraversal.visualY = null;
      }
      return true;
    }

    if (ladderTraversal.phase === "burrowing") {
      const progress = Math.min(1, ladderTraversal.time / CONFIG.ladderTraverseSeconds);
      const eased = progress * progress * (3 - 2 * progress);
      player.y = ladderTraversal.startY + (ladder.upperBody.y + 1 - ladderTraversal.startY) * eased;
      if (progress >= 1) {
        ladderTraversal.phase = "rolling";
        ladderTraversal.time = 0;
        ladderTraversal.startY = player.y;
        ladderTraversal.visualY = player.y;
      }
      return true;
    }

    const progress = Math.min(1, ladderTraversal.time / CONFIG.ladderRollSeconds);
    const eased = 1 - Math.pow(1 - progress, 3);
    const exitY = ladder.upperBody.y - player.height;
    player.y = ladderTraversal.startY + (exitY - ladderTraversal.startY) * eased;
    ladderTraversal.visualY = player.y;
    if (progress >= 1) {
      player.y = exitY;
      player.velocityX = 0;
      player.velocityY = 0;
      player.grounded = true;
      player.groundedAt = nowSeconds;
      player.airJumpsRemaining = 1;
      player.airJumpAt = -Infinity;
      player.standingBody = ladder.upperBody.kind === "text" ? ladder.upperBody : null;
      player.navigationBody = ladder.upperBody;
      ladderTraversal.graceUntil = nowSeconds + 0.35;
      ladderTraversal.completed += 1;
      cancelLadderTraversal();
    }
    return true;
  }

  function approach(value, target, amount) {
    if (value < target) return Math.min(target, value + amount);
    return Math.max(target, value - amount);
  }

  function standingTextBodies() {
    const feet = player.y + player.height;
    return state.textBodies
      .filter((body) =>
        player.x + player.width > body.x &&
        player.x < body.x + body.width &&
        Math.abs(body.y - feet) <= 5
      )
      .toSorted((a, b) => Math.abs(a.y - feet) - Math.abs(b.y - feet));
  }

  function standingTextBody() {
    return standingTextBodies()[0] || null;
  }

  function supportingMapBody() {
    const feet = player.y + player.height;
    return state.bodies
      .filter((body) =>
        player.x + player.width > body.x &&
        player.x < body.x + body.width &&
        Math.abs(body.y - feet) <= 5
      )
      .toSorted((a, b) => Math.abs(a.y - feet) - Math.abs(b.y - feet))[0] || null;
  }

  function sourceElementAt(body, worldX) {
    if (!body?.sourceRegions?.length) return null;
    return body.sourceRegions.toSorted((a, b) => {
      const distanceA = worldX < a.left ? a.left - worldX : worldX > a.right ? worldX - a.right : 0;
      const distanceB = worldX < b.left ? b.left - worldX : worldX > b.right ? worldX - b.right : 0;
      if (distanceA !== distanceB) return distanceA - distanceB;
      const missionA = a.element.closest("a[href]") === mission.portalAnchor;
      const missionB = b.element.closest("a[href]") === mission.portalAnchor;
      if (missionA !== missionB) return missionA ? -1 : 1;
      const linkA = Boolean(a.element.closest("a[href]"));
      const linkB = Boolean(b.element.closest("a[href]"));
      if (linkA !== linkB) return linkA ? -1 : 1;
      return (a.right - a.left) - (b.right - b.left);
    })[0].element;
  }

  function sidePortalAtPlayer() {
    const centerY = player.y + player.height * 0.5;
    const candidates = [];
    for (const body of state.textBodies) {
      const verticalDistance = Math.abs(centerY - (body.y + body.height * 0.5));
      if (verticalDistance > Math.max(22, player.height * 0.72 + body.height * 0.5)) continue;
      for (const region of body.sourceRegions || []) {
        const anchor = region.element.closest?.("a[href]");
        if (!portalTarget(anchor)) continue;
        const leftGap = region.left - (player.x + player.width);
        const rightGap = player.x - region.right;
        const side = leftGap >= -2 && leftGap <= 22
          ? -1
          : rightGap >= -2 && rightGap <= 22 ? 1 : 0;
        if (!side) continue;
        candidates.push({
          body,
          element: region.element,
          anchor,
          side,
          score: verticalDistance + Math.max(0, side < 0 ? leftGap : rightGap) * 2 -
            (anchor === mission.portalAnchor ? 180 : 0)
        });
      }
    }
    return candidates.toSorted((a, b) => a.score - b.score)[0] || null;
  }

  function hoverChain(element) {
    const chain = [];
    for (let current = element; current && current !== document.body; current = current.parentElement) {
      if (!isGameNode(current)) chain.push(current);
    }
    return chain;
  }

  function dispatchSyntheticHover(element, entering) {
    const clientX = player.x + player.width * 0.5 - window.scrollX;
    const clientY = player.y + player.height - window.scrollY;
    const eventInit = { bubbles: true, clientX, clientY, pointerType: "mouse" };
    try {
      element.dispatchEvent(new PointerEvent(entering ? "pointerover" : "pointerout", eventInit));
    } catch {
      // PointerEvent is optional; MouseEvent below covers the mirrored site.
    }
    element.dispatchEvent(new MouseEvent(entering ? "mouseover" : "mouseout", eventInit));
    element.dispatchEvent(new MouseEvent(entering ? "mouseenter" : "mouseleave", { ...eventInit, bubbles: false }));
  }

  function refreshPlayerHover(sourceElement, nowSeconds) {
    let changed = false;
    if (sourceElement) {
      const expiry = nowSeconds + CONFIG.hoverHoldSeconds;
      for (const element of hoverChain(sourceElement)) {
        if (!interaction.activeElements.has(element)) {
          element.classList.add("eimei-player-hover");
          dispatchSyntheticHover(element, true);
          changed = true;
        }
        interaction.activeElements.set(element, expiry);
      }
      interaction.sourceElement = sourceElement;
      interaction.holdUntil = expiry;
    }

    for (const [element, expiry] of interaction.activeElements) {
      if (expiry > nowSeconds) continue;
      element.classList.remove("eimei-player-hover");
      dispatchSyntheticHover(element, false);
      interaction.activeElements.delete(element);
      changed = true;
    }

    if (changed) {
      state.hoverLayoutChangingUntil = performance.now() + 650;
      scheduleRebuild({ hoverOnly: true });
    }
    return changed;
  }

  function portalTarget(anchor) {
    if (!anchor) return null;
    const rawHref = anchor.getAttribute("href")?.trim();
    if (!rawHref || rawHref.startsWith("#") || /^(?:javascript|mailto|tel):/i.test(rawHref)) return null;

    let target;
    try {
      target = new URL(rawHref, location.href);
    } catch {
      return null;
    }

    if (target.hostname === "www.eimei.ed.jp") {
      target = new URL(`${target.pathname.replace(/^\//, "")}${target.search}${target.hash}`, staticSiteRoot);
    } else if (target.protocol === "file:") {
      if (!target.href.startsWith(staticSiteRoot.href)) return null;
    } else if (target.origin !== location.origin) {
      return null;
    }

    const pathname = target.pathname.toLowerCase();
    const lastPart = pathname.split("/").at(-1) || "";
    if (lastPart && /\.[a-z0-9]+$/i.test(lastPart) && !/\.html?$/i.test(lastPart)) return null;
    if (unsupportedStagePages.has(pageIdentity(target))) return null;
    return target;
  }

  function anchorRegion(body, anchor) {
    const matching = body?.sourceRegions?.filter((region) => region.element.closest("a[href]") === anchor) || [];
    if (matching.length === 0) return { left: body.x, right: body.x + body.width };
    return {
      left: Math.min(...matching.map((region) => region.left)),
      right: Math.max(...matching.map((region) => region.right))
    };
  }

  function positionPortalForEntry(portal, body, anchor, entrySide = 0) {
    if (!portal || !body || !anchor || portal.entering) return;
    const region = anchorRegion(body, anchor);
    const center = Math.max(region.left, Math.min(player.x + player.width * 0.5, region.right));
    portal.entrySide = Math.sign(entrySide);
    portal.x = portal.entrySide < 0
      ? region.left - CONFIG.portalWidth
      : portal.entrySide > 0 ? region.right : center - CONFIG.portalWidth * 0.5;
    portal.baseY = portal.entrySide
      ? body.y + body.height * 0.5 + CONFIG.portalHeight * 0.5
      : body.y;
  }

  function playerIsNearPortal(portal) {
    if (!portal) return false;
    const rect = {
      x: portal.x,
      y: portal.baseY - CONFIG.portalHeight,
      width: CONFIG.portalWidth,
      height: CONFIG.portalHeight
    };
    return intersects(player, {
      x: rect.x - 7,
      y: rect.y - 4,
      width: rect.width + 14,
      height: rect.height + 9
    });
  }

  function beginPortalEntry(portal, nowSeconds = performance.now() / 1000) {
    if (!portal || portal.entering || portal.progress < 0.82 || !playerIsNearPortal(portal)) return false;
    input.downPressedAt = -Infinity;
    syncScoreAttackPortalTarget(portal);
    portal.entering = true;
    portal.enterProgress = 0;
    portal.enterStartedAt = nowSeconds;
    portal.enterDuration = isLowPowerDevice() ? 0.09 : 0.42;
    // Opening a dropdown schedules a collision rebuild. If that expensive
    // rebuild wins the event-loop race against this timer, weak devices stare
    // at an open door for several seconds before navigation. The old page is
    // leaving, so rebuilding its geometry has no value.
    window.clearTimeout(state.rebuildTimer);
    state.rebuildTimer = 0;
    state.needsRebuild = false;
    state.rebuildFull = false;
    window.dispatchEvent(new CustomEvent("eimei-portal-entering", {
      detail: { href: portal.target.href }
    }));
    if (isLowPowerDevice()) {
      // On the reduced renderer the outgoing page may already have a long
      // canvas task queued. Navigate in this input task so it cannot sit in
      // front of the new document for several seconds.
      // Stop outstanding images/preview iframes before asking the network for
      // the destination. They are disposable once the player enters the door.
      window.stop();
      try {
        sessionStorage.setItem("__eimei_portal_nav_called_at", String(Date.now()));
      } catch {
        // Navigation still works when storage is unavailable.
      }
      location.assign(portal.target.href);
    } else {
      portal.navigationTimer = window.setTimeout(() => {
        if (interaction.portal === portal && portal.entering) location.assign(portal.target.href);
      }, portal.enterDuration * 1000 + 10);
    }
    return true;
  }

  function updatePortal(sourceElement, standingBody, dt, nowSeconds, { entrySide = 0 } = {}) {
    const anchor = sourceElement?.closest?.("a[href]") || null;
    if (anchor && standingBody && interaction.portal?.anchor !== anchor) {
      let target = portalTarget(anchor);
      if (target && race.active) {
        target = new URL(target.href);
        for (const key of [...target.searchParams.keys()]) {
          if (key.startsWith("eimei-")) target.searchParams.delete(key);
        }
        target.searchParams.set("eimei-route", "race");
        target.searchParams.set("eimei-room", race.roomCode);
        target.searchParams.set("eimei-round", race.roundId);
        target.searchParams.set("eimei-from", pageIdentity());
      } else if (target && tutorial.active) {
        // The final tutorial door owns its destination. Do not rewrite it as a
        // normal inter-page mission continuation or it loops back into lessons.
        target = new URL(target.href);
      } else if (target && mission.initialized && mission.runId && !mission.completed) {
        target = new URL(target.href);
        target.searchParams.set("eimei-route", "continue");
        target.searchParams.set("eimei-mode", anchor === mission.portalAnchor ? mission.continuationMode || "any" : "any");
        target.searchParams.set("eimei-run", mission.runId);
        target.searchParams.set("eimei-segment", String(Math.min(CONFIG.missionMaximumSegments - 1, mission.segmentIndex + 1)));
        target.searchParams.set("eimei-from", pageIdentity());
        target.searchParams.set("eimei-visited", mission.visitedPaths.join("|"));
        const nextHeaderPortalStreak = isGlobalNavigationAnchor(anchor)
          ? Math.min(CONFIG.missionMaximumConsecutiveHeaderPortals, mission.headerPortalStreak + 1)
          : 0;
        target.searchParams.set("eimei-header-streak", String(nextHeaderPortalStreak));
        const nextHeaderPortalTotal = mission.headerPortalTotal + (isGlobalNavigationAnchor(anchor) ? 1 : 0);
        target.searchParams.set("eimei-header-total", String(nextHeaderPortalTotal));
        target.searchParams.delete("eimei-portals");
        if (mission.plannedPortalPages.length > 0) {
          target.searchParams.set("eimei-route-pages", mission.plannedPortalPages.join("|"));
        } else {
          target.searchParams.delete("eimei-route-pages");
        }
        if (mission.finalGoalReady) {
          target.searchParams.set("eimei-final-page", mission.finalGoalPage);
          target.searchParams.set("eimei-final-x", String(mission.finalGoalX));
          target.searchParams.set("eimei-final-y", String(mission.finalGoalY));
        }
      } else if (target) {
        target = new URL(target.href);
        target.searchParams.set("eimei-route", "arrival");
        target.searchParams.set("eimei-from", pageIdentity());
      }
      if (target) {
        interaction.portal = {
          anchor,
          target,
          x: 0,
          baseY: 0,
          entrySide: 0,
          color: getComputedStyle(anchor).color || standingBody.visualColor || "#333333",
          progress: 0,
          entering: false,
          enterProgress: 0,
          enterStartedAt: -Infinity,
          lastTouched: nowSeconds
        };
        positionPortalForEntry(interaction.portal, standingBody, anchor, entrySide);
        syncScoreAttackPortalTarget(interaction.portal);
        window.dispatchEvent(new CustomEvent("eimei-portal-warm", {
          detail: { href: target.href }
        }));
      }
    }
    if (anchor && interaction.portal?.anchor === anchor) {
      positionPortalForEntry(interaction.portal, standingBody, anchor, entrySide);
      interaction.portal.lastTouched = nowSeconds;
    }

    const portal = interaction.portal;
    if (!portal) return;
    const portalRect = {
      x: portal.x,
      y: portal.baseY - CONFIG.portalHeight,
      width: CONFIG.portalWidth,
      height: CONFIG.portalHeight
    };
    const nearPortal = playerIsNearPortal(portal);
    const guidedPortalVisible = portal.anchor === mission.portalAnchor &&
      portalBodyIsUsable(mission.goalBody, portal.anchor);
    const shouldRemain = portal.entering || anchor === portal.anchor || nearPortal || guidedPortalVisible || nowSeconds - portal.lastTouched < 0.65;
    portal.progress = Math.max(0, Math.min(1, portal.progress + (shouldRemain ? 1 : -1) * dt / CONFIG.portalGrowSeconds));

    if (portal.entering) {
      if (!portal.transitionMarked && portal.target.searchParams.get("eimei-route") === "continue") {
        portal.transitionMarked = true;
        try {
          sessionStorage.setItem("eimei-pending-transition", JSON.stringify({
            runId: portal.target.searchParams.get("eimei-run"),
            segment: Number.parseInt(portal.target.searchParams.get("eimei-segment") || "0", 10) || 0,
            pathname: portal.target.pathname
          }));
        } catch {
          // The URL carries the same data when session storage is unavailable.
        }
      }
      portal.enterProgress = Math.min(1, Math.max(
        0,
        (nowSeconds - portal.enterStartedAt) / Math.max(0.01, portal.enterDuration || 0.42)
      ));
      const doorwayCenter = portal.x + CONFIG.portalWidth * 0.56;
      player.x += (doorwayCenter - (player.x + player.width * 0.5)) * Math.min(1, dt * 10);
      player.velocityX = 0;
      player.velocityY = 0;
      if (portal.enterProgress >= 1) location.assign(portal.target.href);
      return;
    }

    if (
      nowSeconds - input.downPressedAt <= 0.18 &&
      portal.progress >= 0.82 &&
      nearPortal
    ) {
      beginPortalEntry(portal, nowSeconds);
      return;
    }

    if (portal.progress === 0 && !shouldRemain) interaction.portal = null;
  }

  function chooseWebAnchor() {
    const centerX = player.x + player.width * 0.5;
    const centerY = player.y + player.height * 0.45;
    const desiredDirection = Number(input.right) - Number(input.left) || player.facing || 1;
    let best = null;
    let bestScore = Infinity;
    refreshHatchCandidate();
    const hatchPoint = state.hatchCandidate ? {
      x: state.hatchCandidate.centerX,
      y: state.hatchCandidate.body.y + state.hatchCandidate.body.height,
      kind: "hatch-seam",
      hatchSeam: true
    } : null;
    const tutorialAnchorElement = tutorial.active
      ? tutorialCurrentCheckpoint()?.closest("[data-eimei-tutorial-stage]")
        ?.querySelector("[data-eimei-tutorial-web-anchor]")
      : null;
    const tutorialAnchorBody = tutorialBodyForElement(tutorialAnchorElement);
    const tutorialPoint = tutorialAnchorBody ? {
      x: bodyCenterX(tutorialAnchorBody),
      y: tutorialAnchorBody.y,
      kind: "tutorial-anchor",
      tutorialAnchor: true
    } : null;
    expireRacePlayerEffects();
    const remotePlayerPoints = race.active
      ? [...race.remotePlayers.values()].map((remote) => ({
        x: remote.x,
        y: remote.y,
        kind: "remote-player",
        remotePlayerId: remote.id,
        remotePlayer: true,
        palette: remote.palette
      }))
      : [];

    const preferredPoints = [hatchPoint, tutorialPoint].filter(Boolean);
    for (const point of [...preferredPoints, ...remotePlayerPoints, ...state.webPoints]) {
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance > CONFIG.webRange) continue;
      // The hatch seam is an intentional route tool. Bind it to its planned
      // ceiling directly so nearby glyphs cannot steal the auto-aim.
      const anchorBody = point.hatchSeam
        ? state.hatchCandidate?.body
        : point.tutorialAnchor ? tutorialAnchorBody : point.remotePlayer ? null : webBodyAtPoint(point);
      const regularAnchor = dy <= -CONFIG.webMinimumRise && distance >= CONFIG.webMinimumLength;
      const remoteAnchor = point.remotePlayer &&
        distance >= CONFIG.raceGrappleMinimumLength &&
        dx * desiredDirection >= -24;
      const shortHatchAnchor = isNearbyHatchAnchor(anchorBody, centerX, centerY, point.x, point.y);
      if (!regularAnchor && !shortHatchAnchor && !remoteAnchor) continue;
      if ((!anchorBody && !remoteAnchor) || !webLineIsClear(centerX, centerY, point.x, point.y, anchorBody)) continue;
      const behindPenalty = !point.hatchSeam && !point.tutorialAnchor && dx * desiredDirection < -18 ? 115 : 0;
      const kindPenalty = point.kind === "image" ? 28 : point.kind === "line" ? 8 : 0;
      const score = distance * (point.hatchSeam ? 0.42 : point.remotePlayer ? 0.64 : 1) + behindPenalty + kindPenalty +
        Math.abs(dx) * (point.hatchSeam ? 0.012 : 0.04) -
        (shortHatchAnchor ? 24 : 0) - (point.hatchSeam ? 190 : 0) -
        (point.tutorialAnchor ? 240 : 0) - (point.remotePlayer ? 135 : 0);
      if (score < bestScore) {
        best = shortHatchAnchor ? { ...point, shortHatchAnchor: true } : point;
        bestScore = score;
      }
    }
    return best;
  }

  function webBodyAtPoint(point) {
    if (!point) return null;
    return state.bodies
      .filter((body) =>
        (body.kind === "text" || body.kind === "line") &&
        point.x >= body.x - 2 &&
        point.x <= body.x + body.width + 2 &&
        point.y >= body.y - 4 &&
        point.y <= body.y + body.height + 4
      )
      .toSorted((a, b) => Math.abs(a.y - point.y) - Math.abs(b.y - point.y))[0] || null;
  }

  function isNearbyHatchAnchor(body, centerX, centerY, pointX, pointY) {
    if (!body || body.width < player.width + 2) return false;
    const bodyBottom = body.y + body.height;
    const ceilingGap = player.y - bodyBottom;
    const distance = Math.hypot(pointX - centerX, pointY - centerY);
    if (
      distance < 8 ||
      distance >= CONFIG.webMinimumLength ||
      pointY >= centerY - 4 ||
      ceilingGap < -3 ||
      ceilingGap > 38 ||
      centerX < body.x - 14 ||
      centerX > body.x + body.width + 14
    ) return false;
    return Number.isFinite(hatchExitPlayerX(body, pointX));
  }

  function segmentEntryTime(startX, startY, endX, endY, body) {
    const dx = endX - startX;
    const dy = endY - startY;
    const bounds = [
      [startX, dx, body.x - 1, body.x + body.width + 1],
      [startY, dy, body.y - 1, body.y + body.height + 1]
    ];
    let entry = 0;
    let exit = 1;
    for (const [start, delta, minimum, maximum] of bounds) {
      if (Math.abs(delta) < 0.0001) {
        if (start < minimum || start > maximum) return null;
        continue;
      }
      const first = (minimum - start) / delta;
      const second = (maximum - start) / delta;
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      if (entry > exit) return null;
    }
    return exit >= 0 && entry <= 1 ? Math.max(0, entry) : null;
  }

  function webLineIsClear(startX, startY, endX, endY, anchorBody) {
    return !state.bodies.some((body) => {
      if (body === anchorBody || (body.kind !== "text" && body.kind !== "line")) return false;
      // Tutorial checkpoints use a full-width bottom border as a physical
      // lock.  The reel lesson's intended hatch text lives in that same DOM
      // element, so its own border must not intercept the web just before the
      // seam. Other checkpoint locks remain solid.
      if (
        tutorial.active &&
        body.kind === "line" &&
        body.sourceElement?.matches?.("[data-eimei-tutorial-hatch]") &&
        anchorBody?.sourceRegions?.some((region) =>
          region.element === body.sourceElement || body.sourceElement.contains(region.element)
        )
      ) return false;
      const entry = segmentEntryTime(startX, startY, endX, endY, body);
      return Number.isFinite(entry) && entry > 0.001 && entry < 0.985;
    });
  }

  function attachWeb() {
    if (
      web.active ||
      web.mantlePhase !== "none" ||
      web.charges <= 0 ||
      dropHatch.phase !== "none" ||
      ladderTraversal.phase !== "none"
    ) return;
    const anchor = chooseWebAnchor();
    web.candidate = anchor;
    if (!anchor) return;
    const centerX = player.x + player.width * 0.5;
    const centerY = player.y + player.height * 0.45;
    web.active = true;
    web.anchorX = anchor.x;
    web.anchorY = anchor.y;
    const attachMinimumLength = anchor.shortHatchAnchor ? 8 : CONFIG.webMinimumLength;
    web.length = Math.max(attachMinimumLength, Math.hypot(centerX - anchor.x, centerY - anchor.y));
    web.remotePlayerId = anchor.remotePlayerId || null;
    web.anchorBody = web.remotePlayerId ? null : webBodyAtPoint(anchor);
    web.hatchPhase = "none";
    web.hatchTime = 0;
    web.charges -= 1;
    if (tutorial.active) {
      tutorial.webStartX = player.x;
      tutorial.lastWebLength = web.length;
      tutorial.reelDistance = 0;
    }
  }

  function detachWeb({ releaseBoost = false, force = false } = {}) {
    if ((web.hatchPhase !== "none" || web.mantlePhase !== "none") && !force) return;
    if (releaseBoost && web.active && !player.grounded) {
      player.velocityY = Math.min(player.velocityY, -CONFIG.webReleaseSpeed);
    }
    web.active = false;
    web.candidate = null;
    web.anchorBody = null;
    web.remotePlayerId = null;
    web.hatchPhase = "none";
    web.hatchTime = 0;
    web.mantlePhase = "none";
    web.mantleTime = 0;
    web.mantleBody = null;
  }

  function hatchExitPlayerX(body, preferredCenterX) {
    if (!body || body.width < player.width + 2) return null;
    const minimumX = body.x + 1;
    const maximumX = body.x + body.width - player.width - 1;
    if (maximumX < minimumX) return null;
    const preferredX = Math.max(minimumX, Math.min(preferredCenterX - player.width * 0.5, maximumX));
    const scanCount = Math.max(2, Math.ceil((maximumX - minimumX) / 4) + 1);
    const candidates = [
      preferredX,
      ...(body.navigationXs || []),
      ...Array.from(
        { length: scanCount },
        (_, index) => minimumX + (maximumX - minimumX) * (index / Math.max(1, scanCount - 1))
      )
    ]
      .map((x) => Math.max(minimumX, Math.min(x, maximumX)))
      .filter((x, index, all) => all.findIndex((other) => Math.abs(other - x) < 1) === index)
      .toSorted((a, b) => Math.abs(a - preferredX) - Math.abs(b - preferredX));

    return candidates.find((x) => {
      const standingClearance = {
        x: x - 1,
        y: body.y - player.height - 4,
        width: player.width + 2,
        height: player.height + 3
      };
      return !state.bodies.some((other) => other !== body && intersects(standingClearance, other));
    }) ?? null;
  }

  function webMantleExit(body) {
    if (!body || body.width < player.width + 4) return null;
    const bodyBottom = body.y + body.height;
    const surfaceGap = player.y - bodyBottom;
    if (surfaceGap < -5 || surfaceGap > 58) return null;
    const playerCenterX = player.x + player.width * 0.5;
    const direction = Number(input.right) - Number(input.left);
    const sides = [-1, 1].map((side) => {
      const edgeX = side < 0 ? body.x : body.x + body.width;
      const targetX = side < 0 ? body.x + 2 : body.x + body.width - player.width - 2;
      const outsideX = side < 0 ? body.x - player.width - 3 : body.x + body.width + 3;
      if (outsideX < 0 || outsideX + player.width > state.documentWidth) return null;
      const edgeDistance = Math.abs(playerCenterX - edgeX);
      if (edgeDistance > CONFIG.webMantleMaximumEdgeDistance) return null;
      const landingBox = {
        x: targetX - 1,
        y: body.y - player.height - 4,
        width: player.width + 2,
        height: player.height + 3
      };
      const outsideCorridor = {
        x: outsideX - 1,
        y: body.y - player.height - 4,
        width: player.width + 2,
        height: body.height + player.height + 8
      };
      const blocked = state.bodies.some((other) =>
        other !== body && (intersects(landingBox, other) || intersects(outsideCorridor, other))
      );
      if (blocked) return null;
      return {
        body,
        side,
        edgeX,
        outsideX,
        outsideY: bodyBottom + 2,
        targetX,
        targetY: body.y - player.height - 1,
        score: edgeDistance + (direction !== 0 && direction !== side ? 42 : 0)
      };
    }).filter(Boolean);
    return sides.toSorted((a, b) => a.score - b.score)[0] || null;
  }

  function beginWebMantle() {
    if (!web.active || !web.anchorBody || web.mantlePhase !== "none" || web.hatchPhase !== "none") return false;
    const exit = webMantleExit(web.anchorBody);
    if (!exit) return false;
    web.mantlePhase = "approaching";
    web.mantleTime = 0;
    web.mantleBody = exit.body;
    web.mantleStartX = player.x;
    web.mantleStartY = player.y;
    web.mantleOutsideX = exit.outsideX;
    web.mantleOutsideY = exit.outsideY;
    web.mantleTargetX = exit.targetX;
    web.mantleTargetY = exit.targetY;
    web.mantleSide = exit.side;
    web.mantlesStarted += 1;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.groundedAt = -Infinity;
    return true;
  }

  function updateWebMantle(dt, nowSeconds) {
    if (web.mantlePhase === "none" || !web.mantleBody) return false;
    web.mantleTime += dt;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;
    player.standingBody = null;
    player.navigationBody = null;

    if (web.mantlePhase === "approaching") {
      const progress = Math.min(1, web.mantleTime / CONFIG.webMantleApproachSeconds);
      const eased = progress * progress * (3 - 2 * progress);
      player.x = web.mantleStartX + (web.mantleOutsideX - web.mantleStartX) * eased;
      player.y = web.mantleStartY + (web.mantleOutsideY - web.mantleStartY) * eased;
      if (progress >= 1) {
        web.mantlePhase = "vaulting";
        web.mantleTime = 0;
        web.mantleStartX = player.x;
        web.mantleStartY = player.y;
      }
      return true;
    }

    const progress = Math.min(1, web.mantleTime / CONFIG.webMantleVaultSeconds);
    const riseProgress = Math.min(1, progress / 0.62);
    const moveProgress = Math.max(0, Math.min(1, (progress - 0.48) / 0.52));
    const riseEase = 1 - Math.pow(1 - riseProgress, 3);
    const moveEase = moveProgress * moveProgress * (3 - 2 * moveProgress);
    player.x = web.mantleOutsideX + (web.mantleTargetX - web.mantleOutsideX) * moveEase;
    player.y = web.mantleStartY + (web.mantleTargetY - web.mantleStartY) * riseEase - Math.sin(progress * Math.PI) * 4;
    if (progress >= 1) {
      const body = web.mantleBody;
      player.x = web.mantleTargetX;
      player.y = web.mantleTargetY;
      player.velocityX = web.mantleSide * 55;
      player.velocityY = 0;
      player.grounded = true;
      player.groundedAt = nowSeconds;
      player.standingBody = body.kind === "text" ? body : null;
      player.navigationBody = body;
      player.airJumpsRemaining = 1;
      player.airJumpAt = -Infinity;
      web.active = false;
      web.candidate = null;
      web.anchorBody = null;
      web.remotePlayerId = null;
      web.mantlePhase = "none";
      web.mantleTime = 0;
      web.mantleBody = null;
      web.mantlesCompleted += 1;
      refreshHatchCandidate({ force: true });
    }
    return true;
  }

  function beginWebHatch({ allowUnplannedCeiling = false } = {}) {
    if (!web.active || !web.anchorBody || web.hatchPhase !== "none") return;
    const body = web.anchorBody;
    const nowSeconds = performance.now() / 1000;
    if (nowSeconds < web.hatchDeniedUntil) return;
    if (!allowUnplannedCeiling && !hatchIsAvailableFor(body)) {
      web.hatchDeniedUntil = nowSeconds + 0.18;
      return;
    }
    const preferredCenterX = hatchIsAvailableFor(body)
      ? state.hatchCandidate?.centerX ?? web.anchorX
      : web.anchorX;
    const targetX = hatchExitPlayerX(body, preferredCenterX);
    if (!Number.isFinite(targetX)) {
      // Refuse a climb with no standing room. Otherwise the next collision
      // frame would eject the player elsewhere and look exactly like a warp.
      web.hatchDeniedUntil = nowSeconds + 0.55;
      return;
    }
    web.hatchPhase = "opening";
    web.hatchTime = 0;
    web.hatchStartX = player.x;
    web.hatchStartY = player.y;
    web.hatchTopY = body.y;
    web.hatchBottomY = body.y + body.height;
    web.hatchTargetX = targetX;
    web.hatchCenterX = web.hatchTargetX + player.width * 0.5;
    const edgeRoom = 2 * Math.min(web.hatchCenterX - body.x, body.x + body.width - web.hatchCenterX);
    web.hatchWidth = Math.max(player.width, Math.min(body.width, player.width * 1.95, edgeRoom));
    web.hatchEntryDuration = 1.08;
    web.hatchTraverseDuration = Math.min(0.72, Math.max(0.24, 0.18 + body.height * 0.006));
    web.hatchPassageDuration = Math.min(1.08, Math.max(0.68, 0.56 + body.height * 0.007));
    web.hatchesStarted += 1;
    player.velocityX = 0;
    player.velocityY = 0;
  }

  function updateWebHatch(dt) {
    const body = web.anchorBody;
    if (!body || web.hatchPhase === "none") return false;
    web.hatchTime += dt;
    const targetX = web.hatchTargetX;
    const belowY = web.hatchBottomY + 1;
    const exitY = web.hatchTopY - player.height - 1;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;

    if (web.hatchPhase === "opening") {
      const progress = Math.min(1, web.hatchTime / 0.46);
      const moveProgress = Math.max(0, (progress - 0.38) / 0.62);
      const eased = 1 - Math.pow(1 - moveProgress, 3);
      player.x = web.hatchStartX + (targetX - web.hatchStartX) * eased;
      player.y = web.hatchStartY + (belowY - web.hatchStartY) * eased;
      if (progress >= 1) {
        web.hatchPhase = "entering";
        web.hatchTime = 0;
        web.hatchStartY = player.y;
      }
      return true;
    }

    if (web.hatchPhase === "entering") {
      const progress = Math.min(1, web.hatchTime / web.hatchEntryDuration);
      const jamDepth = 0.54;
      let passageProgress;
      if (progress < 0.3) {
        const rush = progress / 0.3;
        passageProgress = jamDepth * (1 - Math.pow(1 - rush, 3));
      } else if (progress < 0.78) {
        const struggle = (progress - 0.3) / 0.48;
        const settle = Math.sin(struggle * Math.PI) * 0.018;
        passageProgress = jamDepth + settle;
      } else {
        const slip = (progress - 0.78) / 0.22;
        passageProgress = jamDepth + (1 - jamDepth) * Math.pow(slip, 2);
      }
      player.x = targetX + Math.sin(web.hatchTime * 35) * (progress > 0.28 && progress < 0.82 ? 0.7 : 0);
      player.y = belowY - (player.height + 2) * passageProgress;
      if (progress >= 1) {
        web.hatchPhase = "traversing";
        web.hatchTime = 0;
        web.hatchStartY = player.y;
      }
      return true;
    }

    if (web.hatchPhase === "traversing") {
      const progress = Math.min(1, web.hatchTime / web.hatchTraverseDuration);
      const eased = progress * progress * (3 - 2 * progress);
      player.x = targetX;
      player.y = web.hatchStartY + (web.hatchTopY + 1 - web.hatchStartY) * eased;
      if (progress >= 1) {
        web.hatchPhase = "emerging";
        web.hatchTime = 0;
        web.hatchStartY = player.y;
      }
      return true;
    }

    const progress = Math.min(1, web.hatchTime / web.hatchPassageDuration);
    // The top hatch exists closed before the character reaches it. Give the
    // panel time to be pushed open from inside, then begin the actual climb.
    const movementProgress = Math.max(0, Math.min(1, (progress - 0.18) / 0.82));
    const eased = movementProgress < 0.5
      ? 4 * movementProgress * movementProgress * movementProgress
      : 1 - Math.pow(-2 * movementProgress + 2, 3) / 2;
    player.x = targetX;
    player.y = web.hatchStartY + (exitY - web.hatchStartY) * eased;
    if (progress >= 1) {
      player.y = exitY;
      web.active = false;
      web.candidate = null;
      web.anchorBody = null;
      web.remotePlayerId = null;
      web.hatchPhase = "none";
      web.hatchTime = 0;
      web.hatchGraceUntil = performance.now() / 1000 + 0.45;
      web.hatchesCompleted += 1;
      player.velocityY = 0;
      player.grounded = true;
      player.groundedAt = performance.now() / 1000;
      player.airJumpsRemaining = 1;
      player.airJumpAt = -Infinity;
      player.standingBody = body.kind === "text" ? body : null;
      player.navigationBody = body;
      refreshHatchCandidate({ force: true });
    }
    return true;
  }

  function applyWebConstraint(dt, nowSeconds) {
    if (!web.active) return;
    if (web.hatchPhase !== "none" || web.mantlePhase !== "none") return;
    if (web.remotePlayerId) {
      syncRemoteWebAnchor(nowSeconds);
      return;
    }
    const reelMinimumLength = web.anchorBody
      ? Math.max(26, Math.min(46, web.anchorBody.height + player.height * 0.45 + 3))
      : CONFIG.webMinimumLength;
    if (input.up) {
      const previousLength = web.length;
      web.length = Math.max(reelMinimumLength, web.length - CONFIG.webReelSpeed * dt);
      if (tutorial.active) {
        tutorial.reelDistance += Math.max(0, previousLength - web.length);
        if (tutorial.reelDistance >= 54) tutorial.actions.reel = true;
      }
    }
    const centerX = player.x + player.width * 0.5;
    const centerY = player.y + player.height * 0.45;
    const dx = centerX - web.anchorX;
    const dy = centerY - web.anchorY;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const normalX = dx / distance;
    const normalY = dy / distance;

    if (distance > web.length) {
      const correction = distance - web.length;
      moveHorizontal(-normalX * correction);
      moveVertical(-normalY * correction, nowSeconds);
      const outwardVelocity = player.velocityX * normalX + player.velocityY * normalY;
      if (outwardVelocity > 0) {
        player.velocityX -= normalX * outwardVelocity;
        player.velocityY -= normalY * outwardVelocity;
      }
    }

    const direction = Number(input.right) - Number(input.left);
    if (direction !== 0) {
      const tangentX = -normalY;
      const tangentY = normalX;
      const tangentDirection = Math.sign(tangentX || 1) === direction ? 1 : -1;
      player.velocityX += tangentX * tangentDirection * CONFIG.webPumpAcceleration * dt;
      player.velocityY += tangentY * tangentDirection * CONFIG.webPumpAcceleration * dt;
    }
    if (
      tutorial.active &&
      Number.isFinite(tutorial.webStartX) &&
      Math.abs(player.x - tutorial.webStartX) >= 72 &&
      Math.abs(player.velocityX) >= 90
    ) tutorial.actions.swing = true;

    const hatchBody = web.anchorBody;
    // A short hatch web stops with the player's rope attachment point at the
    // reel limit. Because that point is below the top of the sprite, the head
    // itself rests roughly 12-16px under a thin line. The old fixed 9px test
    // could therefore never succeed even though the web was fully reeled in.
    const surfaceGap = hatchBody ? player.y - (hatchBody.y + hatchBody.height) : Infinity;
    const maximumHatchGap = Math.max(
      12,
      reelMinimumLength - player.height * 0.45 + 5
    );
    const underSurface = hatchBody && surfaceGap >= -4 && surfaceGap <= maximumHatchGap;
    const alignedWithSurface = hatchBody &&
      player.x + player.width * 0.5 >= hatchBody.x - 7 &&
      player.x + player.width * 0.5 <= hatchBody.x + hatchBody.width + 7;
    if (input.up && web.length <= reelMinimumLength + 0.5 && underSurface && alignedWithSurface) {
      if (hatchIsAvailableFor(hatchBody)) beginWebHatch();
      else if (Number.isFinite(hatchExitPlayerX(hatchBody, web.anchorX))) {
        beginWebHatch({ allowUnplannedCeiling: true });
      } else beginWebMantle();
    }
  }

  function updatePlayerInteractions(dt, nowSeconds) {
    const centerX = player.x + player.width * 0.5;
    const standingBodies = standingTextBodies();
    const missionPortalBody = mission.goalKind === "portal" && mission.portalAnchor
      ? standingBodies.find((body) => body.sourceRegions?.some((region) =>
        centerX >= region.left - 1 &&
        centerX <= region.right + 1 &&
        region.element.closest("a[href]") === mission.portalAnchor
      ))
      : null;
    const linkedBody = standingBodies.find((body) => body.sourceRegions?.some((region) =>
      centerX >= region.left - 1 &&
      centerX <= region.right + 1 &&
      region.element.closest("a[href]")
    ));
    player.standingBody = missionPortalBody || linkedBody || standingBodies[0] || null;
    player.navigationBody = supportingMapBody();
    if (
      web.hatchPhase !== "none" ||
      web.mantlePhase !== "none" ||
      ladderTraversal.phase !== "none" ||
      nowSeconds < web.hatchGraceUntil ||
      nowSeconds < ladderTraversal.graceUntil
    ) return;
    const standingSource = sourceElementAt(player.standingBody, centerX);
    const standingAnchor = standingSource?.closest?.("a[href]");
    const sidePortal = standingAnchor ? null : sidePortalAtPlayer();
    const sourceElement = sidePortal?.element || standingSource;
    const portalBody = sidePortal?.body || player.standingBody;
    refreshPlayerHover(sourceElement, nowSeconds);
    updatePortal(sourceElement, portalBody, dt, nowSeconds, { entrySide: sidePortal?.side || 0 });
  }

  function updateNavigationWisp(dt) {
    const point = mission.guidePoint;
    if (!mission.initialized || mission.completed || !point) return;
    const dx = point.x - mission.wispX;
    const dy = point.y - mission.wispY;
    const distance = Math.hypot(dx, dy);
    if (distance <= 3) {
      mission.wispX = point.x;
      mission.wispY = point.y;
      mission.wispAnchored = true;
      return;
    }

    mission.wispAnchored = false;
    const step = Math.min(distance, CONFIG.navigationFlightSpeed * dt);
    mission.wispX += dx / distance * step;
    mission.wispY += dy / distance * step;
    mission.trailClock += dt;
    if (mission.trailClock >= 0.025) {
      mission.trailClock = 0;
      mission.trail.push({ x: mission.wispX, y: mission.wispY });
      if (mission.trail.length > 14) mission.trail.shift();
    }
  }

  function completeRaceFlag(nowSeconds) {
    if (!race.active || race.finished || race.finishPending || !race.course?.goal) return false;
    race.finishPending = true;
    race.finishReportedAt = nowSeconds;
    mission.completed = true;
    mission.completedAt = nowSeconds;
    player.velocityX = 0;
    player.velocityY = 0;
    for (const key of Object.keys(input)) {
      if (typeof input[key] === "boolean") input[key] = false;
    }
    detachWeb({ force: true });
    mission.guideBody = null;
    mission.guidePoint = null;
    mission.wispAnchored = false;
    mission.trail.length = 0;
    window.dispatchEvent(new CustomEvent("eimei-race-finish", {
      detail: {
        page: pageIdentity(),
        roundId: race.roundId,
        goalId: race.course.goal.id
      }
    }));
    return true;
  }

  function advanceNavigationFrom(body, nowSeconds) {
    if (!body) return;
    const centerX = player.x + player.width * 0.5;
    if (
      race.active &&
      body === mission.goalBody &&
      mission.goalKind === "text" &&
      pageIdentity() === race.course?.goal?.page &&
      Math.abs(centerX - mission.goalPoint.x) <= Math.max(24, player.width * 1.5)
    ) {
      completeRaceFlag(nowSeconds);
      return;
    }
    if (mission.completed) return;
    if (tutorial.active && body === mission.goalBody) {
      if (mission.goalKind === "portal") {
        mission.guideBody = body;
        mission.guidePoint = { x: mission.goalPoint.x, y: body.y - 9 };
        return;
      }
      if (Math.abs(centerX - mission.goalPoint.x) <= Math.max(24, player.width * 1.5)) {
        completeTutorialStep(nowSeconds);
      }
      return;
    }
    if (body === mission.goalBody && mission.goalKind === "portal") {
      mission.guideBody = body;
      mission.guidePoint = { x: mission.goalPoint.x, y: body.y - 9 };
      return;
    }
    if (
      body === mission.goalBody &&
      mission.goalKind === "text" &&
      Math.abs(centerX - mission.goalPoint.x) <= Math.max(24, player.width * 1.5)
    ) {
      if (mission.scoreAttack) {
        collectScoreFlag(nowSeconds);
        return;
      }
      mission.completed = true;
      mission.completedAt = nowSeconds;
      player.velocityX = 0;
      player.velocityY = 0;
      for (const key of Object.keys(input)) {
        if (typeof input[key] === "boolean") input[key] = false;
      }
      detachWeb({ force: true });
      mission.guideBody = null;
      mission.guidePoint = null;
      mission.wispAnchored = false;
      mission.trail.length = 0;
      return;
    }

    if (body === mission.guideBody) {
      if (body === mission.goalBody) return;
      mission.routeIndex += 1;
      // Collision rebuilds can split one visible floor into consecutive body
      // objects. Skip those duplicate waypoints so the guide cannot wait for
      // the player to leave and re-enter what is visibly the same platform.
      while (
        mission.routeIndex < mission.route.length - 1 &&
        bodiesDescribeSamePlatform(body, mission.route[mission.routeIndex])
      ) mission.routeIndex += 1;
      mission.nextAdvanceAllowedAt = nowSeconds + CONFIG.navigationAdvanceCooldownSeconds;
      mission.lastAdvanceX = centerX;
      mission.lastAdvanceY = player.y + player.height;
      mission.needsReplan = false;
      mission.lostGuideSince = -Infinity;
      const next = mission.route[mission.routeIndex];
      // The swarm that was circling this platform departs from here as one
      // group. It should not repeatedly respawn on the player between steps.
      if (next) setGuideBody(next, { launchFromPlayer: false });
      else replanNavigation(body);
      return;
    }
  }

  function navigationArrivalZone(body) {
    const horizontalPadding = Math.max(
      48,
      Math.min(92, CONFIG.navigationArrivalHorizontalPx + Math.min(24, body.width * 0.08))
    );
    const verticalPadding = Math.max(
      64,
      Math.min(104, Math.max(CONFIG.navigationArrivalVerticalPx, window.innerHeight * 0.1))
    );
    return {
      left: body.x - horizontalPadding,
      right: body.x + body.width + horizontalPadding,
      top: body.y - verticalPadding,
      bottom: body.y + verticalPadding * 0.72,
      horizontalPadding,
      verticalPadding
    };
  }

  function isPlayerNearGuide(body) {
    if (!body) return false;
    const zone = navigationArrivalZone(body);
    const centerX = player.x + player.width * 0.5;
    const feet = player.y + player.height;
    if (
      body.y < feet - CONFIG.navigationHorizontalTolerancePx &&
      feet > body.y + Math.max(16, player.height * 0.68)
    ) return false;
    if (
      body.y > feet + CONFIG.navigationHorizontalTolerancePx &&
      feet < body.y - Math.max(38, player.height * 1.45)
    ) return false;
    return centerX >= zone.left && centerX <= zone.right && feet >= zone.top && feet <= zone.bottom;
  }

  function hasMovedSinceGuideAdvance() {
    if (!Number.isFinite(mission.lastAdvanceX + mission.lastAdvanceY)) return true;
    const centerX = player.x + player.width * 0.5;
    const feet = player.y + player.height;
    return Math.hypot(centerX - mission.lastAdvanceX, feet - mission.lastAdvanceY) >= CONFIG.navigationAdvanceMinimumTravelPx;
  }

  function isPlayerOnGoal(body, support) {
    if (!body || !support || !player.grounded) return false;
    const centerX = player.x + player.width * 0.5;
    const feet = player.y + player.height;
    const sameSurface = bodiesDescribeSamePlatform(support, body) || Boolean(
      Math.abs(feet - body.y) <= 7 && centerX >= body.x - 3 && centerX <= body.x + body.width + 3
    );
    return sameSurface && Math.abs(centerX - mission.goalPoint.x) <= Math.max(24, player.width * 1.5);
  }

  function isPlayerOnTutorialRelease(support) {
    if (!tutorial.active || !support || !player.grounded || mission.goalKind !== "text") return false;
    const release = document.querySelector(`[data-eimei-tutorial-release="${tutorial.step}"]`);
    if (!release || support.sourceElement !== release) return false;
    const centerX = player.x + player.width * 0.5;
    return Math.abs(centerX - mission.goalPoint.x) <= Math.max(52, player.width * 3.2);
  }

  function portalBodyIsUsable(body, anchor = mission.portalAnchor) {
    if (!body || !anchor || !state.textBodies.includes(body) || !body.navigationXs?.length) return false;
    if (body.sourceRegions?.some((region) => region.element.closest("a[href]") === anchor)) return true;
    const submenu = anchor.closest(".menu > li > ul");
    const hoverTrigger = submenu?.parentElement;
    return Boolean(
      submenu &&
      !isElementVisible(submenu) &&
      bodyRepresentsPortalTrigger(body, hoverTrigger, submenu)
    );
  }

  function portalStandingCenter(body, anchor, preferredX = null) {
    if (!body?.navigationXs?.length) return null;
    const hasLiveAnchor = body.sourceRegions?.some((region) => region.element.closest("a[href]") === anchor);
    const region = hasLiveAnchor ? anchorRegion(body, anchor) : { left: body.x, right: body.x + body.width };
    const centers = body.navigationXs
      .map((x) => x + player.width * 0.5)
      .filter((x) => x >= region.left && x <= region.right);
    if (centers.length === 0) return null;
    const targetX = Number.isFinite(preferredX) ? preferredX : bodyCenterX(body);
    return centers.toSorted((a, b) => Math.abs(a - targetX) - Math.abs(b - targetX))[0];
  }

  function applyPortalMissionTarget(body, anchor, destination, support, nowSeconds, continuationMode = null) {
    if (!portalBodyIsUsable(body, anchor)) return false;
    const portalX = portalStandingCenter(body, anchor, mission.goalPoint?.x);
    if (!Number.isFinite(portalX)) return false;
    const routeStart = support || nearestSupportingBody();
    let route = routeStart
      ? bodiesDescribeSamePlatform(routeStart, body)
        ? [routeStart]
        : navigationRouteBetween(routeStart, body)
      : [body];
    if (route.length === 0) return false;
    if (route.at(-1) !== body) route = [...route, body];
    if (!routeIsPhysicallyConnected(route)) return false;

    mission.goalBody = body;
    mission.goalElement = anchor;
    mission.goalPoint = { x: portalX, y: body.y };
    mission.portalAnchor = anchor;
    mission.portalDestination = destination || portalTarget(anchor);
    mission.continuationMode = continuationMode || mission.continuationMode || "any";
    mission.route = route;
    mission.routePhysicalAtPlan = true;
    mission.routeIndex = Math.max(0, route.length - 1);
    mission.needsReplan = false;
    mission.lostGuideSince = -Infinity;
    mission.portalRepairAt = nowSeconds;
    setGuideBody(body, { launchFromPlayer: false, preferredX: portalX });
    refreshHatchCandidate({ force: true });
    return true;
  }

  function ensureGuidedPortalDoor(body, nowSeconds) {
    const anchor = mission.portalAnchor;
    if (!anchor || !portalBodyIsUsable(body, anchor)) return false;
    const region = anchorRegion(body, anchor);
    const desiredCenter = Math.max(
      region.left,
      Math.min(mission.goalPoint?.x ?? player.x + player.width * 0.5, region.right)
    );
    if (interaction.portal?.anchor === anchor) {
      interaction.portal.x = desiredCenter - CONFIG.portalWidth * 0.5;
      interaction.portal.baseY = body.y;
      interaction.portal.color = getComputedStyle(anchor).color || body.visualColor || "#333333";
      interaction.portal.lastTouched = nowSeconds;
      return true;
    }
    updatePortal(anchor, body, 0, nowSeconds);
    return interaction.portal?.anchor === anchor;
  }

  function repairPortalGuideTarget(support, nowSeconds) {
    if (mission.goalKind !== "portal" || !mission.portalAnchor) return false;
    if (portalBodyIsUsable(mission.goalBody)) {
      if (!portalBodyIsUsable(mission.guideBody) || mission.guideBody !== mission.goalBody) {
        setGuideBody(mission.goalBody, {
          launchFromPlayer: false,
          preferredX: mission.goalPoint?.x
        });
        return true;
      }
      return false;
    }

    const submenu = mission.portalAnchor.closest(".menu > li > ul");
    if (
      submenu &&
      isElementVisible(submenu) &&
      state.baseCharacters.length > 0 &&
      nowSeconds - (mission.portalRepairAt || -Infinity) >= 0.12
    ) {
      // The submenu may have opened outside refreshPlayerHover (or a debounced
      // rebuild may have been cancelled). Materialize its real rows before
      // attempting a fallback, otherwise the parent-tab proxy wins forever.
      mission.portalRepairAt = nowSeconds;
      window.clearTimeout(state.rebuildTimer);
      state.rebuildTimer = 0;
      state.needsRebuild = false;
      const pendingFullRebuild = state.rebuildFull;
      state.rebuildFull = false;
      if (pendingFullRebuild) buildCollisionMap({ preservePlayer: true });
      else rebuildHoverCollisionMap();
      support = player.navigationBody || (player.grounded ? supportingMapBody() : null) || support;
      if (portalBodyIsUsable(mission.goalBody)) {
        if (!portalBodyIsUsable(mission.guideBody) || mission.guideBody !== mission.goalBody) {
          setGuideBody(mission.goalBody, {
            launchFromPlayer: false,
            preferredX: mission.goalPoint?.x
          });
        }
        return true;
      }
    }

    const remapped = portalBodyForAnchor(mission.portalAnchor);
    if (remapped && portalBodyIsUsable(remapped) && applyPortalMissionTarget(
      remapped,
      mission.portalAnchor,
      mission.portalDestination,
      support,
      nowSeconds
    )) return true;

    // A few legacy links have a visible parent but no physical text row after
    // expansion. Replace such an impossible target with another real portal,
    // while keeping the run ID and final goal intact.
    const routeStart = support || nearestSupportingBody();
    if (routeStart) {
      const destinationPage = mission.portalDestination ? pageIdentity(mission.portalDestination) : null;
      const desiredPages = [
        ...mission.plannedPortalPages,
        destinationPage,
        mission.finalGoalPage
      ].filter((page, index, pages) => page && page !== pageIdentity() && pages.indexOf(page) === index);
      const excluded = new Set(mission.visitedPaths || []);
      let pair = null;
      for (const desiredPage of desiredPages) {
        pair = pickPortalTowardFinalPage(routeStart, desiredPage, excluded, {
          allowGlobalNavigation:
            mission.headerPortalStreak < CONFIG.missionMaximumConsecutiveHeaderPortals &&
            mission.headerPortalTotal < CONFIG.missionMaximumHeaderPortals,
          allowFallback: false
        });
        if (pair) break;
      }
      if (pair && applyPortalMissionTarget(
        pair.goal,
        pair.portalAnchor,
        pair.portalDestination,
        routeStart,
        nowSeconds,
        pair.continuationMode
      )) return true;
    }

    // Never continue drawing a stale body's old coordinates. Retry after a
    // collision rebuild instead of leaving a convincing marker in empty space.
    mission.guideBody = null;
    mission.guidePoint = null;
    mission.wispAnchored = false;
    mission.trail.length = 0;
    if (nowSeconds - (mission.portalRepairAt || -Infinity) >= 0.55) {
      mission.portalRepairAt = nowSeconds;
      scheduleRebuild({ hoverOnly: visibleHoverOverlays().length > 0 });
    }
    return true;
  }

  function revealGuidedPortalMenu(support, nowSeconds) {
    if (mission.goalKind !== "portal" || !mission.portalAnchor || !mission.goalBody) return false;
    const submenu = mission.portalAnchor.closest(".menu > li > ul");
    const hoverTrigger = submenu?.parentElement;
    const menuIsOpen = Boolean(submenu && isElementVisible(submenu));
    const goalIsLiveAnchor = state.textBodies.includes(mission.goalBody) &&
      mission.goalBody.navigationXs?.length &&
      mission.goalBody.sourceRegions?.some((region) => region.element.closest("a[href]") === mission.portalAnchor);
    const visiblePortalBody = menuIsOpen
      ? goalIsLiveAnchor
        ? mission.goalBody
        : state.textBodies.find((body) =>
          body.navigationXs?.length &&
          body.sourceRegions?.some((region) => region.element.closest("a[href]") === mission.portalAnchor)
        )
      : null;
    if (visiblePortalBody) {
      const region = anchorRegion(visiblePortalBody, mission.portalAnchor);
      const previousX = mission.goalPoint?.x ?? bodyCenterX(visiblePortalBody);
      const matchingXs = visiblePortalBody.navigationXs.filter((x) => {
        const centerX = x + player.width * 0.5;
        return centerX >= region.left && centerX <= region.right;
      });
      const portalX = (matchingXs.length ? matchingXs : visiblePortalBody.navigationXs)
        .map((x) => x + player.width * 0.5)
        .toSorted((a, b) => Math.abs(a - previousX) - Math.abs(b - previousX))[0];
      const alreadySynchronized = mission.goalBody === visiblePortalBody &&
        mission.guideBody === visiblePortalBody &&
        Math.abs((mission.goalPoint?.x ?? portalX) - portalX) <= 0.5;
      if (alreadySynchronized) {
        ensureGuidedPortalDoor(visiblePortalBody, nowSeconds);
        return false;
      }

      // Hover collision rebuilding and mission remapping happen on separate
      // frames. A late remap can therefore restore the parent proxy after the
      // real row is already visible. Treat the live anchor row as authoritative
      // and repair the goal/guide immediately on every such mismatch.
      mission.goalBody = visiblePortalBody;
      mission.goalElement = mission.portalAnchor;
      mission.goalPoint = { x: portalX, y: visiblePortalBody.y };
      const route = support
        ? bodiesDescribeSamePlatform(support, visiblePortalBody)
          ? [support]
          : navigationRouteBetween(support, visiblePortalBody)
        : [];
      if (route.length > 0) {
        mission.route = route.at(-1) === visiblePortalBody ? route : [...route, visiblePortalBody];
        mission.routePhysicalAtPlan = routeIsPhysicallyConnected(mission.route);
      } else if (mission.route.length > 0) {
        mission.route[mission.route.length - 1] = visiblePortalBody;
      } else {
        mission.route = [visiblePortalBody];
      }
      mission.routeIndex = Math.max(0, mission.route.length - 1);
      setGuideBody(visiblePortalBody, {
        launchFromPlayer: false,
        preferredX: portalX,
        preserveTarget: false
      });
      mission.nextAdvanceAllowedAt = nowSeconds + CONFIG.navigationAdvanceCooldownSeconds;
      ensureGuidedPortalDoor(visiblePortalBody, nowSeconds);
      refreshHatchCandidate({ force: true });
      return true;
    }

    const goalIsProxy = state.textBodies.includes(mission.goalBody) &&
      bodyRepresentsPortalTrigger(mission.goalBody, hoverTrigger, submenu);
    const proxy = goalIsProxy
      ? mission.goalBody
      : state.textBodies.find((body) =>
        body.navigationXs?.length &&
        bodyRepresentsPortalTrigger(body, hoverTrigger, submenu)
      );
    if (!hoverTrigger || !proxy) return false;
    const standingOnProxy = Boolean(
      player.grounded &&
      support &&
      bodiesDescribeSamePlatform(support, proxy)
    );
    if (!standingOnProxy && !isPlayerNearGuide(proxy)) return false;

    // The ordinary source-element lookup can miss a parent tab on pages where
    // its text shares a merged collision surface with separators. The guide
    // already knows which hidden link it needs, so reaching that proxy may
    // safely reveal the owning menu and let the next hover rebuild re-anchor
    // the goal to the real link row.
    refreshPlayerHover(hoverTrigger, nowSeconds);
    if (isElementVisible(submenu) && state.baseCharacters.length > 0) {
      // This is a mission-critical menu opening. Waiting for the debounced
      // hover rebuild leaves the guide on the parent tab for several frames.
      // updatePlayerInteractions may have opened it earlier in this same tick,
      // so do not require this function to be the code that opened it.
      window.clearTimeout(state.rebuildTimer);
      state.rebuildTimer = 0;
      state.needsRebuild = false;
      const pendingFullRebuild = state.rebuildFull;
      state.rebuildFull = false;
      if (pendingFullRebuild) buildCollisionMap({ preservePlayer: true });
      else rebuildHoverCollisionMap();
    }
    return true;
  }

  function updateNavigation(dt, nowSeconds) {
    if (!mission.initialized) return;
    const support = player.navigationBody || (player.grounded ? supportingMapBody() : null);
    if (
      race.active &&
      !race.finished &&
      !race.finishPending &&
      mission.goalKind === "text" &&
      mission.goalBody &&
      mission.goalPoint &&
      pageIdentity() === race.course?.goal?.page &&
      isPlayerOnGoal(mission.goalBody, support)
    ) {
      advanceNavigationFrom(mission.goalBody, nowSeconds);
      mission.lastStandingBody = support;
      return;
    }
    let guide = mission.guideBody;
    // Every score round owns exactly one decisive marker. A menu/collision
    // rebuild can briefly clear that reference after the first pickup; restore
    // it from the still-valid goal instead of leaving the round playable but
    // visually unguided.
    if (
      mission.scoreAttack &&
      !mission.scoreFinished &&
      !mission.scorePlanningPortal &&
      !mission.completed &&
      (!guide || !mission.guidePoint) &&
      mission.goalBody &&
      mission.goalPoint &&
      state.bodies.includes(mission.goalBody)
    ) {
      setKeypointGuide({ launchFromPlayer: true });
      guide = mission.guideBody;
    }
    if (
      mission.goalKind === "portal" &&
      nowSeconds - state.lastPortalInspectionAt >= CONFIG.portalInspectionSeconds
    ) {
      state.lastPortalInspectionAt = nowSeconds;
      repairPortalGuideTarget(support, nowSeconds);
      revealGuidedPortalMenu(support, nowSeconds);
      // Either repair call may replace a deleted proxy body. Never continue
      // this tick using the local reference captured before that replacement.
      guide = mission.guideBody;
    }
    if (!guide) return;
    updateNavigationWisp(dt);

    if (isPlayerOnTutorialRelease(support)) {
      completeTutorialStep(nowSeconds);
      mission.lastStandingBody = support;
      return;
    }

    // Intermediate markers are areas, not pixel-perfect landing tests. Passing
    // close to the marked surface is enough to release the swarm to the next
    // step, including while the player is still in the air.
    const nearGuide = guide !== mission.goalBody && isPlayerNearGuide(guide);
    const standingOnGuide = Boolean(
      player.grounded &&
      support &&
      bodiesDescribeSamePlatform(support, guide)
    );
    if (nearGuide && !Number.isFinite(mission.guideNearSince)) mission.guideNearSince = nowSeconds;
    if (!nearGuide) mission.guideNearSince = -Infinity;
    if (
      guide !== mission.goalBody &&
      nowSeconds >= mission.nextAdvanceAllowedAt &&
      nowSeconds - mission.guideSetAt >= CONFIG.navigationMinimumDisplaySeconds &&
      nowSeconds - mission.guideNearSince >= CONFIG.navigationNearConfirmSeconds &&
      (hasMovedSinceGuideAdvance() || standingOnGuide) &&
      nearGuide
    ) {
      advanceNavigationFrom(guide, nowSeconds);
      mission.lastStandingBody = support || mission.lastStandingBody;
      return;
    }

    // Final flags remain real destinations: being nearby is not a free win.
    // Portals likewise keep their marker until the player enters the door.
    if (guide === mission.goalBody && mission.goalKind === "text" && isPlayerOnGoal(guide, support)) {
      advanceNavigationFrom(guide, nowSeconds);
      mission.lastStandingBody = support;
      return;
    }
    // Tutorial checkpoints deliberately stay fixed until the named action is
    // performed. Route recovery would turn a lesson into a moving target.
    if (tutorial.active) return;

    const feet = player.y + player.height;
    const beganLevelWithOrBelowGuide = Number.isFinite(mission.guideOriginY) &&
      mission.guideOriginY >= guide.y - 36;
    const overtookGuideUpward = beganLevelWithOrBelowGuide &&
      feet < guide.y - Math.max(CONFIG.navigationOvertakeVerticalPx, window.innerHeight * 0.15);
    if (overtookGuideUpward && !Number.isFinite(mission.overtookGuideSince)) {
      mission.overtookGuideSince = nowSeconds;
    }
    if (!overtookGuideUpward) mission.overtookGuideSince = -Infinity;
    if (
      overtookGuideUpward &&
      player.grounded &&
      support &&
      nowSeconds - mission.overtookGuideSince >= CONFIG.navigationOvertakeDelaySeconds &&
      nowSeconds - mission.guideSetAt >= 0.48
    ) {
      mission.needsReplan = false;
      mission.lostGuideSince = -Infinity;
      mission.overtookGuideSince = -Infinity;
      replanNavigation(support);
      mission.lastStandingBody = support;
      return;
    }

    const farBelowGuide = player.y > guide.y + Math.max(170, window.innerHeight * 0.24);
    const fallingAway = !player.grounded && player.velocityY > 230 && farBelowGuide;
    if (fallingAway && !Number.isFinite(mission.lostGuideSince)) {
      mission.lostGuideSince = nowSeconds;
    }
    if (
      Number.isFinite(mission.lostGuideSince) &&
      farBelowGuide &&
      nowSeconds - mission.lostGuideSince >= CONFIG.navigationReplanDelaySeconds
    ) {
      mission.needsReplan = true;
    }
    if (!farBelowGuide && !mission.needsReplan) mission.lostGuideSince = -Infinity;

    if (!player.grounded || !support) return;
    if (mission.needsReplan && nowSeconds >= mission.guideLockUntil) {
      mission.needsReplan = false;
      mission.lostGuideSince = -Infinity;
      replanNavigation(support);
      mission.lastStandingBody = support;
      return;
    }
    // Collision rebuilding can split one visual line into overlapping body
    // objects. Reaching the marked physical surface still counts even when
    // the support object is not reference-identical to the planned body.
    const centerX = player.x + player.width * 0.5;
    const reachedGuide = support === guide || Boolean(
      guide &&
      Math.abs(feet - guide.y) <= 6 &&
      centerX >= guide.x - 3 &&
      centerX <= guide.x + guide.width + 3
    );
    if (
      reachedGuide &&
      nowSeconds >= mission.nextAdvanceAllowedAt &&
      (guide === mission.goalBody || nowSeconds - mission.guideSetAt >= CONFIG.navigationMinimumDisplaySeconds) &&
      (guide === mission.goalBody || hasMovedSinceGuideAdvance())
    ) advanceNavigationFrom(guide, nowSeconds);
    mission.lastStandingBody = support;
  }

  function moveHorizontal(distance) {
    if (distance === 0) return;
    const startX = player.x;
    const startRight = startX + player.width;
    player.x += distance;
    const collisions = overlappingBodies(player);
    if (collisions.length === 0) return;

    // Resolve only a boundary crossed from outside during this movement. If a
    // ladder dismount begins a pixel inside a long text body, treating that as
    // a fresh wall collision pushes the player to the body's remote edge.
    const crossed = collisions.filter((body) => distance > 0
      ? startRight <= body.x + 0.5 && player.x + player.width > body.x
      : startX >= body.x + body.width - 0.5 && player.x < body.x + body.width
    );
    if (crossed.length === 0) return;

    if (distance > 0) {
      player.x = Math.min(...crossed.map((body) => body.x - player.width));
    } else {
      player.x = Math.max(...crossed.map((body) => body.x + body.width));
    }
    player.velocityX = 0;
  }

  function moveVertical(distance, nowSeconds) {
    player.grounded = false;
    if (distance === 0) return;
    player.y += distance;
    const collisions = overlappingBodies(player);
    if (collisions.length === 0) return;

    if (distance > 0) {
      player.y = Math.min(...collisions.map((body) => body.y - player.height));
      player.velocityY = 0;
      player.grounded = true;
      player.groundedAt = nowSeconds;
      player.airJumpsRemaining = 1;
      player.airJumpAt = -Infinity;
    } else {
      player.y = Math.max(...collisions.map((body) => body.y + body.height));
      player.velocityY = 0;
    }
  }

  function updatePhysics(dt, nowSeconds) {
    if (race.active && (race.frozen || race.finished || race.finishPending)) {
      player.velocityX = 0;
      player.velocityY = 0;
      return;
    }
    if (interaction.portal?.entering) {
      updatePortal(null, null, dt, nowSeconds);
      return;
    }
    if (
      mission.scoreAttack &&
      (mission.scoreFinished || (mission.completed && nowSeconds < mission.scoreNextRoundAt))
    ) {
      player.velocityX = 0;
      player.velocityY = 0;
      return;
    }
    if (mission.completed && nowSeconds - mission.completedAt < CONFIG.goalFreezeSeconds) {
      player.velocityX = 0;
      player.velocityY = 0;
      return;
    }
    if (updateLadderTraversal(dt, nowSeconds)) {
      updateNavigation(dt, nowSeconds);
      player.x = Math.max(0, Math.min(state.documentWidth - player.width, player.x));
      return;
    }
    if (updateDropHatch(dt, nowSeconds)) {
      updateNavigation(dt, nowSeconds);
      player.x = Math.max(0, Math.min(state.documentWidth - player.width, player.x));
      return;
    }
    if (updateWebMantle(dt, nowSeconds)) {
      updatePlayerInteractions(dt, nowSeconds);
      updateNavigation(dt, nowSeconds);
      player.x = Math.max(0, Math.min(state.documentWidth - player.width, player.x));
      return;
    }
    if (updateWebHatch(dt)) {
      updatePlayerInteractions(dt, nowSeconds);
      updateNavigation(dt, nowSeconds);
      player.x = Math.max(0, Math.min(state.documentWidth - player.width, player.x));
      return;
    }

    if (tryStartLadder()) {
      updateLadderTraversal(dt, nowSeconds);
      updateNavigation(dt, nowSeconds);
      player.x = Math.max(0, Math.min(state.documentWidth - player.width, player.x));
      return;
    }

    tryDropThrough(nowSeconds);

    const direction = Number(input.right) - Number(input.left);
    if (direction !== 0) {
      player.facing = direction;
      const acceleration = player.grounded ? CONFIG.runAcceleration : CONFIG.airAcceleration;
      player.velocityX = approach(player.velocityX, direction * CONFIG.maxRunSpeed, acceleration * dt);
    } else if (player.grounded) {
      player.velocityX = approach(player.velocityX, 0, CONFIG.groundFriction * dt);
    }

    const bufferedJump = nowSeconds - input.jumpPressedAt <= CONFIG.jumpBufferSeconds;
    if (bufferedJump && nowSeconds - player.groundedAt <= CONFIG.coyoteSeconds) {
      player.velocityY = -CONFIG.jumpSpeed;
      player.grounded = false;
      player.groundedAt = -Infinity;
      input.jumpPressedAt = -Infinity;
      if (tutorial.active) tutorial.actions.jump = true;
    } else if (
      bufferedJump &&
      !player.grounded &&
      !web.active &&
      player.airJumpsRemaining > 0
    ) {
      player.velocityY = -CONFIG.airJumpSpeed;
      player.airJumpsRemaining -= 1;
      player.airJumpAt = nowSeconds;
      input.jumpPressedAt = -Infinity;
      if (tutorial.active) tutorial.actions.doubleJump = true;
    }

    if (!input.jump && player.velocityY < -CONFIG.jumpSpeed * 0.42) {
      player.velocityY += CONFIG.gravity * 1.9 * dt;
    }

    player.velocityY = Math.min(CONFIG.maxFallSpeed, player.velocityY + CONFIG.gravity * dt);
    applyIncomingRaceGrapples(dt, nowSeconds);
    moveHorizontal(player.velocityX * dt);
    moveVertical(player.velocityY * dt, nowSeconds);
    applyWebConstraint(dt, nowSeconds);

    if (player.grounded && !web.active) {
      web.charges = CONFIG.webMaximumCharges;
      player.airJumpsRemaining = 1;
      player.airJumpAt = -Infinity;
    }
    updatePlayerInteractions(dt, nowSeconds);
    refreshHatchCandidate();
    updateNavigation(dt, nowSeconds);

    player.x = Math.max(0, Math.min(state.documentWidth - player.width, player.x));
    if (player.y > state.documentHeight + window.innerHeight * 0.35) respawn();
  }

  function resizeCanvas() {
    const ratioLimit = isLowPowerDevice() ? CONFIG.canvasPixelRatioLowPower : CONFIG.canvasPixelRatioMaximum;
    const ratio = Math.min(ratioLimit, window.devicePixelRatio || 1);
    state.viewportWidth = window.innerWidth;
    state.viewportHeight = window.innerHeight;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawBodies(scrollX, scrollY) {
    if (!state.debug) return;
    context.lineWidth = 1;

    for (const body of state.bodies) {
      const x = body.x - scrollX;
      const y = body.y - scrollY;
      if (x > state.viewportWidth || x + body.width < 0 || y > state.viewportHeight || y + body.height < 0) continue;

      if (body.kind === "line") {
        context.fillStyle = "rgba(255, 166, 0, 0.24)";
        context.strokeStyle = "rgba(255, 124, 0, 0.82)";
      } else {
        context.fillStyle = "rgba(0, 207, 255, 0.15)";
        context.strokeStyle = "rgba(0, 154, 210, 0.68)";
      }
      context.fillRect(x, y, body.width, body.height);
      context.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.max(0, Math.round(body.width) - 1), Math.max(0, Math.round(body.height) - 1));
    }
  }

  function drawLadders(scrollX, scrollY) {
    for (const ladder of activeLadders()) {
      const centerX = ladder.x - scrollX;
      const topY = ladder.topY - scrollY;
      const bottomY = ladder.bottomY - scrollY;
      if (centerX < -35 || centerX > state.viewportWidth + 35 || bottomY < -25 || topY > state.viewportHeight + 25) continue;
      const railGap = ladder.width * 0.34;
      const left = centerX - railGap;
      const right = centerX + railGap;
      const firstRungY = topY + 10;
      const rungSpacing = 17;

      context.save();
      context.lineCap = "round";
      context.strokeStyle = "rgba(0, 0, 0, 0.16)";
      context.lineWidth = 5.4;
      context.beginPath();
      context.moveTo(left, topY + 2);
      context.lineTo(left, bottomY);
      context.moveTo(right, topY + 2);
      context.lineTo(right, bottomY);
      context.stroke();

      context.strokeStyle = "#111111";
      context.lineWidth = 2.65;
      context.beginPath();
      context.moveTo(left, topY + 2);
      context.lineTo(left, bottomY);
      context.moveTo(right, topY + 2);
      context.lineTo(right, bottomY);
      context.stroke();

      for (let rungY = firstRungY; rungY < bottomY - 4; rungY += rungSpacing) {
        context.strokeStyle = "#111111";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(left, rungY);
        context.lineTo(right, rungY);
        context.stroke();
      }

      context.strokeStyle = "#111111";
      context.lineWidth = 3.1;
      for (const bandY of [topY + 4, bottomY - 3]) {
        context.beginPath();
        context.moveTo(left - 1.5, bandY);
        context.lineTo(left + 1.5, bandY);
        context.moveTo(right - 1.5, bandY);
        context.lineTo(right + 1.5, bandY);
        context.stroke();
      }

      context.strokeStyle = "#111111";
      context.lineWidth = 2.65;
      context.beginPath();
      context.arc(left + 4, topY + 2, 4, Math.PI, Math.PI * 1.5);
      context.arc(right - 4, topY + 2, 4, Math.PI * 1.5, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }

  function drawLadderPassage(scrollX, scrollY) {
    const ladder = ladderTraversal.ladder;
    if (!ladder || !["gripping", "threading", "burrowing", "rolling"].includes(ladderTraversal.phase)) return;
    const topSide = ladderTraversal.phase === "burrowing" || ladderTraversal.phase === "rolling";
    const surfaceY = (topSide ? ladder.upperBody.y : ladder.topY) - scrollY;
    const centerX = ladder.x - scrollX;
    const progress = ladderTraversal.phase === "rolling"
      ? Math.min(1, ladderTraversal.time / CONFIG.ladderRollSeconds)
      : ladderTraversal.phase === "threading"
        ? Math.min(1, ladderTraversal.time / CONFIG.ladderThreadSeconds)
        : 0;
    const width = 30;
    const bend = topSide ? Math.sin((1 - progress) * Math.PI) * 4 : Math.sin(progress * Math.PI) * 3;

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111111";
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(centerX - width * 0.5, surfaceY);
    context.quadraticCurveTo(centerX - width * 0.18, surfaceY + bend, centerX, surfaceY + (topSide ? -2 : 2));
    context.quadraticCurveTo(centerX + width * 0.18, surfaceY - bend, centerX + width * 0.5, surfaceY);
    context.stroke();
    context.strokeStyle = "#111111";
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(centerX - width * 0.28, surfaceY + (topSide ? -1 : 1));
    context.lineTo(centerX + width * 0.28, surfaceY + (topSide ? 1 : -1));
    context.stroke();
    context.restore();
  }

  function drawScoutParticle(x, y, index, time, radius = 1.8, alpha = 1) {
    const pulse = 0.72 + Math.sin(time * (5.8 + index % 4) + index * 1.73) * 0.28;
    const visibleAlpha = Math.max(0.16, alpha * pulse);
    // Canvas shadows on every particle are disproportionately expensive on
    // school Chromebooks. A cheap halo on the larger scouts keeps the same
    // firefly read without asking the GPU to blur dozens of circles per frame.
    if (radius >= 2.1) {
      context.fillStyle = `rgba(255, 198, 18, ${visibleAlpha * 0.2})`;
      context.beginPath();
      context.arc(x, y, radius * 1.9, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = `rgba(255, 214, 34, ${visibleAlpha})`;
    context.beginPath();
    context.arc(x, y, Math.max(0.8, radius * (0.82 + pulse * 0.25)), 0, Math.PI * 2);
    context.fill();
  }

  function particleCount(base, minimum = 1) {
    return Math.max(minimum, Math.round(base * state.particleDensity));
  }

  function drawGuideDirectionStream(scrollX, scrollY, time) {
    const point = mission.guidePoint;
    if (!point) return;
    const startX = player.x + player.width * 0.5;
    const startY = player.y + player.height * 0.36;
    const dx = point.x - startX;
    const dy = point.y - startY;
    const distance = Math.hypot(dx, dy);
    if (distance < 24) return;
    const directionX = dx / distance;
    const directionY = dy / distance;
    const normalX = -directionY;
    const normalY = directionX;
    const finalGoalGuide = mission.goalKind === "text" && mission.guideBody === mission.goalBody;
    const streamParticleCount = particleCount(finalGoalGuide ? 30 : 14, finalGoalGuide ? 10 : 5);
    const visibleLength = Math.min(
      distance - 8,
      Math.max(210, Math.min(finalGoalGuide ? 540 : 430, window.innerWidth * (finalGoalGuide ? 0.5 : 0.38)))
    );
    for (let index = 0; index < streamParticleCount; index += 1) {
      const phase = (time * (finalGoalGuide ? 0.58 : 0.42) + index / streamParticleCount) % 1;
      const along = 18 + phase * visibleLength;
      const wiggle = Math.sin(time * (finalGoalGuide ? 7.1 : 5.2) + index * 2.17) *
        (finalGoalGuide ? 5 + (index % 4) : 2.2 + (index % 3));
      drawScoutParticle(
        startX + directionX * along + normalX * wiggle - scrollX,
        startY + directionY * along + normalY * wiggle - scrollY,
        index,
        time,
        (finalGoalGuide ? 1.65 : 1.35) + (index % 4 === 0 ? 0.65 : 0),
        0.62 + phase * 0.34
      );
    }
  }

  function drawOffscreenGuideCluster(scrollX, scrollY, time) {
    const point = mission.guidePoint;
    if (!point) return;
    const margin = 34;
    const targetX = point.x - scrollX;
    const targetY = point.y - scrollY;
    if (
      targetX >= margin && targetX <= state.viewportWidth - margin &&
      targetY >= margin && targetY <= state.viewportHeight - margin
    ) return;
    const startX = Math.max(margin, Math.min(player.x + player.width * 0.5 - scrollX, state.viewportWidth - margin));
    const startY = Math.max(margin, Math.min(player.y + player.height * 0.36 - scrollY, state.viewportHeight - margin));
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const directionX = dx / distance;
    const directionY = dy / distance;
    const normalX = -directionY;
    const normalY = directionX;
    const edgeX = Math.max(margin, Math.min(targetX, state.viewportWidth - margin));
    const edgeY = Math.max(margin, Math.min(targetY, state.viewportHeight - margin));
    for (let index = 0; index < particleCount(11, 4); index += 1) {
      const tail = (index % 5) * 5.5;
      const spread = (Math.floor(index / 5) - 1) * (4 + index % 4);
      drawScoutParticle(
        edgeX - directionX * tail + normalX * spread,
        edgeY - directionY * tail + normalY * spread,
        index,
        time,
        index < 3 ? 2.5 : 1.7,
        0.82
      );
    }
  }

  function drawTravellingSwarm(scrollX, scrollY, time) {
    const point = mission.guidePoint;
    if (!point) return;
    const dx = point.x - mission.wispFromX;
    const dy = point.y - mission.wispFromY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const directionX = dx / length;
    const directionY = dy / length;
    const normalX = -directionY;
    const normalY = directionX;
    const travellingCount = particleCount(18, 7);
    for (let index = 0; index < travellingCount; index += 1) {
      const tail = (index / Math.max(1, travellingCount - 1)) * 58;
      const wave = Math.sin(time * 7 + index * 1.81) * (3 + index % 5);
      drawScoutParticle(
        mission.wispX - directionX * tail + normalX * wave - scrollX,
        mission.wispY - directionY * tail + normalY * wave - scrollY,
        index,
        time,
        index < 4 ? 2.15 : 1.45,
        1 - index / 31
      );
    }
  }

  function drawPlatformSwarm(body, scrollX, scrollY, time) {
    const visibleLeft = Math.max(body.x, scrollX - 24);
    const visibleRight = Math.min(body.x + body.width, scrollX + state.viewportWidth + 24);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    if (visibleWidth <= 0) return;
    const centerY = body.y - 4;
    const count = particleCount(Math.max(24, Math.min(48, Math.round(visibleWidth / 20))), 10);
    for (let index = 0; index < count; index += 1) {
      const phase = ((index * 0.6180339 + time * (0.018 + (index % 5) * 0.002)) % 1 + 1) % 1;
      const radiusY = 5 + (index % 7) * 1.55;
      drawScoutParticle(
        visibleLeft + phase * visibleWidth - scrollX,
        centerY + Math.sin(time * (1.9 + index % 4 * 0.13) + index * 2.17) * radiusY - scrollY,
        index,
        time,
        index % 8 === 0 ? 2.35 : 1.55,
        0.76 + (index % 4) * 0.06
      );
    }
  }

  function drawFinalGoalSwarm(body, scrollX, scrollY, time) {
    const goalX = mission.goalPoint.x;
    const goalY = body.y - 15;
    for (let index = 0; index < particleCount(72, 24); index += 1) {
      const ring = index % 5;
      const angle = index * 2.39996 + time * (0.86 + ring * 0.09);
      const breathe = 1 + Math.sin(time * 2.1 + ring * 1.4) * 0.14;
      const radiusX = (17 + ring * 11) * breathe;
      const radiusY = 7 + ring * 4.2;
      const lift = Math.sin(time * 1.35 + index * 0.77) * 5 - ring * 1.5;
      drawScoutParticle(
        goalX + Math.cos(angle) * radiusX - scrollX,
        goalY + Math.sin(angle * 1.08) * radiusY + lift - scrollY,
        index,
        time,
        index % 11 === 0 ? 2.8 : 1.7,
        0.82 + (index % 5) * 0.035
      );
    }
  }

  function drawPortalGoalSwarm(scrollX, scrollY, time) {
    if (!mission.goalBody || !mission.goalPoint) return;
    const centerX = mission.goalPoint.x - scrollX;
    const centerY = mission.goalBody.y - CONFIG.portalHeight * 0.5 - scrollY;
    const count = particleCount(64, 24);
    for (let index = 0; index < count; index += 1) {
      const lane = index % 5;
      const angle = index * 2.39996 + time * (0.72 + lane * 0.08);
      const radiusX = CONFIG.portalWidth * 0.58 + 7 + lane * 3.1;
      const radiusY = CONFIG.portalHeight * 0.5 + 6 + lane * 2.7;
      drawScoutParticle(
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY,
        index,
        time,
        index % 7 === 0 ? 3 : 1.8,
        0.9
      );
    }
    for (let index = 0; index < particleCount(20, 8); index += 1) {
      const phase = ((time * 0.58 + index / 24) % 1 + 1) % 1;
      drawScoutParticle(
        centerX + Math.sin(time * 4.1 + index * 1.73) * (7 + index % 4 * 2.5),
        centerY - CONFIG.portalHeight * 0.95 + phase * CONFIG.portalHeight * 1.42,
        index + count,
        time,
        index % 5 === 0 ? 3.2 : 2,
        0.96
      );
    }
  }

  function portalGuideIsCurrent() {
    if (mission.goalKind !== "portal" || !mission.portalAnchor || !mission.guideBody || !mission.goalBody) return false;
    return mission.guideBody === mission.goalBody ||
      bodiesDescribeSamePlatform(mission.guideBody, mission.goalBody) ||
      mission.routeIndex >= Math.max(0, mission.route.length - 1);
  }

  function drawGuideArrivalZone(body, scrollX, scrollY, time) {
    const zone = navigationArrivalZone(body);
    const y = body.y - scrollY - 4;
    if (y < -24 || y > state.viewportHeight + 24) return;
    const left = Math.max(-18, zone.left - scrollX);
    const right = Math.min(state.viewportWidth + 18, zone.right - scrollX);
    if (right <= left) return;
    const pulse = 0.34 + (Math.sin(time * 2.6) + 1) * 0.08;
    context.save();
    context.strokeStyle = `rgba(255, 205, 32, ${pulse})`;
    context.lineWidth = 1.15;
    context.lineCap = "round";
    context.setLineDash([1.5, 7]);
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.setLineDash([]);
    for (const edge of [left, right]) {
      context.beginPath();
      context.moveTo(edge, y - 10);
      context.lineTo(edge, y + 7);
      context.stroke();
    }
    context.restore();
  }

  function drawNavigation(scrollX, scrollY) {
    if (!mission.initialized) return;
    const time = performance.now() / 1000;

    if (mission.goalKind === "text" && mission.goalBody && mission.goalPoint) {
      const goalX = mission.goalPoint.x - scrollX;
      const goalY = mission.goalBody.y - scrollY;
      const sway = Math.sin(time * 2.3) * 1.8;
      context.save();
      context.strokeStyle = "#3f3428";
      context.fillStyle = mission.completed ? "#d9a441" : "#d87832";
      context.lineWidth = 1.8;
      context.beginPath();
      context.moveTo(goalX, goalY + 1);
      context.lineTo(goalX, goalY - 27);
      context.stroke();
      context.beginPath();
      context.moveTo(goalX + 1, goalY - 26);
      context.quadraticCurveTo(goalX + 9, goalY - 29 + sway, goalX + 17, goalY - 23 + sway * 0.4);
      context.lineTo(goalX + 1, goalY - 18);
      context.closePath();
      context.fill();
      context.stroke();
      if (mission.completed) {
        context.fillStyle = "#d9a441";
        context.fillRect(goalX - 12, goalY + 1, 25, 3);
      }
      context.restore();
    }

    if (mission.completed || !mission.guideBody || !mission.guidePoint) return;
    context.save();
    drawGuideArrivalZone(mission.guideBody, scrollX, scrollY, time);
    drawGuideDirectionStream(scrollX, scrollY, time);
    drawOffscreenGuideCluster(scrollX, scrollY, time);
    const portalGoalGuide = portalGuideIsCurrent();
    const swarmMovesToPortal = portalGoalGuide &&
      interaction.portal?.anchor === mission.portalAnchor &&
      interaction.portal?.progress > 0;
    if (mission.wispAnchored) {
      if (portalGoalGuide) {
        if (!swarmMovesToPortal) drawPortalGoalSwarm(scrollX, scrollY, time);
      } else if (!swarmMovesToPortal) {
        if (mission.goalKind === "text" && mission.guideBody === mission.goalBody) {
          drawFinalGoalSwarm(mission.guideBody, scrollX, scrollY, time);
        } else {
          drawPlatformSwarm(mission.guideBody, scrollX, scrollY, time);
        }
      }
    } else {
      drawTravellingSwarm(scrollX, scrollY, time);
    }
    context.restore();
  }

  function drawAvailableHatch(scrollX, scrollY) {
    const candidate = state.hatchCandidate;
    const body = candidate?.body;
    if (!body || !state.bodies.includes(body) || web.hatchPhase !== "none") return;
    const centerX = candidate.centerX - scrollX;
    const y = body.y + body.height - scrollY;
    if (centerX < -50 || centerX > state.viewportWidth + 50 || y < -20 || y > state.viewportHeight + 20) return;
    const elapsed = Math.max(0, performance.now() / 1000 - state.hatchCandidateSetAt);
    const grow = Math.min(1, elapsed / 0.24);
    const eased = 1 - Math.pow(1 - grow, 3);
    const halfWidth = candidate.width * 0.5 * eased;
    const color = body.visualColor || "#191919";
    context.save();
    context.lineCap = "round";
    context.strokeStyle = "rgba(250, 248, 240, 0.9)";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(centerX - halfWidth, y);
    context.lineTo(centerX + halfWidth, y);
    context.stroke();
    context.strokeStyle = color;
    context.lineWidth = 2.4;
    context.stroke();
    if (grow >= 0.72) {
      context.fillStyle = color;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.arc(centerX + side * halfWidth, y, 2, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  function drawScoreHud() {
    if (!mission.scoreAttack || !mission.initialized) return;
    const width = state.viewportWidth;
    const height = state.viewportHeight;
    const gaugeTop = Math.max(76, height * 0.12);
    const gaugeBottom = Math.min(height - 58, height * 0.9);
    const gaugeHeight = Math.max(120, gaugeBottom - gaugeTop);
    const gaugeX = width - 16;
    const ratio = Math.max(0, Math.min(1, mission.scoreTimeRemaining / CONFIG.scoreAttackSeconds));
    const urgency = 1 - ratio;
    const pickupAge = performance.now() / 1000 - mission.scorePickupAt;
    const scorePop = pickupAge >= 0 && pickupAge < 0.5
      ? Math.sin(pickupAge / 0.5 * Math.PI) * 0.18
      : 0;

    context.save();
    context.lineCap = "round";
    context.strokeStyle = "rgba(26, 30, 36, 0.42)";
    context.lineWidth = 10;
    context.beginPath();
    context.moveTo(gaugeX, gaugeTop);
    context.lineTo(gaugeX, gaugeBottom);
    context.stroke();
    const red = Math.round(226 + urgency * 18);
    const green = Math.round(155 - urgency * 94);
    context.strokeStyle = `rgb(${red}, ${green}, 42)`;
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(gaugeX, gaugeBottom);
    context.lineTo(gaugeX, gaugeBottom - gaugeHeight * ratio);
    context.stroke();
    context.lineWidth = 1.4;
    context.strokeStyle = "rgba(255, 255, 255, 0.74)";
    for (let index = 1; index < 4; index += 1) {
      const y = gaugeTop + gaugeHeight * index / 4;
      context.beginPath();
      context.moveTo(gaugeX - 6, y);
      context.lineTo(gaugeX + 5, y);
      context.stroke();
    }

    context.translate(width - 54, 36);
    context.scale(1 + scorePop, 1 + scorePop);
    context.fillStyle = "rgba(255, 253, 246, 0.92)";
    context.strokeStyle = "rgba(34, 38, 44, 0.72)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(-39, -21, 67, 42, 17);
    context.fill();
    context.stroke();
    context.strokeStyle = "#3f3428";
    context.lineWidth = 1.8;
    context.beginPath();
    context.moveTo(-25, 11);
    context.lineTo(-25, -11);
    context.stroke();
    context.fillStyle = "#d87832";
    context.beginPath();
    context.moveTo(-24, -11);
    context.lineTo(-8, -7);
    context.lineTo(-24, -1);
    context.closePath();
    context.fill();
    context.fillStyle = "#20242a";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 20px system-ui, sans-serif";
    context.fillText(String(mission.score), 10, 1);
    context.restore();
  }

  function drawIncomingRaceGrapples(scrollX, scrollY) {
    if (!race.active || race.incomingGrapples.size === 0) return;
    expireRacePlayerEffects();
    const targetX = player.x + player.width * 0.5 - scrollX;
    const targetY = player.y + player.height * 0.42 - scrollY;
    context.save();
    context.lineCap = "round";
    for (const grapple of race.incomingGrapples.values()) {
      const startX = grapple.x - scrollX;
      const startY = grapple.y - scrollY;
      context.strokeStyle = "rgba(6, 20, 38, 0.5)";
      context.lineWidth = 4.4;
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(targetX, targetY);
      context.stroke();
      context.strokeStyle = grapple.palette?.visor || "rgba(220, 252, 255, 0.98)";
      context.lineWidth = 1.8;
      context.stroke();
    }
    context.restore();
  }

  function drawWeb(scrollX, scrollY) {
    if (!web.active) return;
    if (web.remotePlayerId && !syncRemoteWebAnchor()) return;
    const startX = player.x + player.width * 0.5 - scrollX;
    const startY = player.y + player.height * 0.38 - scrollY;
    const endX = web.anchorX - scrollX;
    const endY = web.anchorY - scrollY;

    context.save();
    context.strokeStyle = "rgba(6, 32, 62, 0.48)";
    context.lineWidth = 4.2;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.strokeStyle = "rgba(220, 252, 255, 0.97)";
    context.lineWidth = 1.7;
    context.stroke();
    context.fillStyle = web.candidate?.palette?.glow || "rgba(64, 223, 255, 0.28)";
    context.beginPath();
    context.arc(endX, endY, 7.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = web.candidate?.palette?.visor || "#5eeaff";
    context.beginPath();
    context.arc(endX, endY, 3.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWebHatch(scrollX, scrollY) {
    const body = web.anchorBody;
    if (!body || web.hatchPhase === "none") return;
    const phaseProgress = web.hatchPhase === "opening"
      ? Math.min(1, web.hatchTime / 0.46)
      : web.hatchPhase === "entering" || web.hatchPhase === "traversing"
        ? 1
      : Math.min(1, web.hatchTime / web.hatchPassageDuration);
    const hatchWidth = web.hatchWidth || Math.min(body.width, Math.max(30, player.width * 1.95));
    const centerWorldX = web.hatchCenterX || web.hatchTargetX + player.width * 0.5;
    const hingeX = centerWorldX - hatchWidth * 0.5 - scrollX;
    const enteringFromBelow = web.hatchPhase !== "emerging";
    const y = (enteringFromBelow ? web.hatchBottomY : web.hatchTopY) - scrollY;
    let openProgress;
    if (enteringFromBelow) {
      const doorProgress = Math.min(1, phaseProgress / 0.58);
      openProgress = 1 - Math.pow(1 - doorProgress, 3);
    } else {
      const pushProgress = Math.max(0, Math.min(1, (phaseProgress - 0.06) / 0.24));
      const pushedOpen = pushProgress * pushProgress * (3 - 2 * pushProgress);
      const closeProgress = Math.max(0, Math.min(1, (phaseProgress - 0.76) / 0.24));
      const closing = closeProgress * closeProgress * (3 - 2 * closeProgress);
      openProgress = pushedOpen * (1 - closing);
    }
    const angle = enteringFromBelow
      ? Math.PI * 0.5 * openProgress
      : -Math.PI * 0.5 * openProgress;
    const endX = hingeX + Math.cos(angle) * hatchWidth;
    const endY = y + Math.sin(angle) * hatchWidth;
    const panelNormalX = -Math.sin(angle) * 2.2;
    const panelNormalY = Math.cos(angle) * 2.2;
    const color = body.visualColor || "#333333";

    context.save();
    context.lineCap = "round";
    context.strokeStyle = "rgba(15, 12, 9, 0.62)";
    context.lineWidth = 3.4;
    context.beginPath();
    context.moveTo(hingeX + 2, y);
    context.lineTo(hingeX + hatchWidth - 2, y);
    context.stroke();

    context.fillStyle = color;
    context.globalAlpha = 0.92;
    context.beginPath();
    context.moveTo(hingeX + panelNormalX, y + panelNormalY);
    context.lineTo(endX + panelNormalX, endY + panelNormalY);
    context.lineTo(endX - panelNormalX, endY - panelNormalY);
    context.lineTo(hingeX - panelNormalX, y - panelNormalY);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = color;
    context.lineWidth = 1.2;
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.68)";
    context.lineWidth = 1;
    for (const fraction of [0.3, 0.7]) {
      const railX = hingeX + Math.cos(angle) * hatchWidth * fraction;
      const railY = y + Math.sin(angle) * hatchWidth * fraction;
      context.beginPath();
      context.moveTo(railX + panelNormalX * 0.72, railY + panelNormalY * 0.72);
      context.lineTo(railX - panelNormalX * 0.72, railY - panelNormalY * 0.72);
      context.stroke();
    }

    context.fillStyle = color;
    context.beginPath();
    context.arc(hingeX, y, 2.7, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(endX - Math.cos(angle) * hatchWidth * 0.18, endY - Math.sin(angle) * hatchWidth * 0.18, 1.6, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }

  function drawDropHatch(scrollX, scrollY) {
    const body = dropHatch.body;
    if (!body || dropHatch.phase === "none") return;

    let openProgress = 1;
    if (dropHatch.phase === "kicking") {
      const kickProgress = Math.min(1, dropHatch.time / CONFIG.dropHatchKickSeconds);
      const released = Math.max(0, Math.min(1, (kickProgress - 0.5) / 0.26));
      openProgress = 1 - Math.pow(1 - released, 3);
    } else if (dropHatch.phase === "bursting") {
      const burstProgress = Math.min(1, dropHatch.time / CONFIG.dropHatchBurstSeconds);
      const closing = Math.max(0, Math.min(1, (burstProgress - 0.58) / 0.42));
      openProgress = 1 - closing * closing * (3 - 2 * closing);
    }

    const hatchWidth = dropHatch.width || player.width * 1.9;
    const hatchCenterX = dropHatch.centerX - scrollX;
    const facing = player.facing || 1;
    const hingeX = hatchCenterX + facing * hatchWidth * 0.5;
    const surfaceWorldY = ["kicking", "readying", "jumping", "diving"].includes(dropHatch.phase)
      ? dropHatch.topY
      : dropHatch.bottomY;
    const surfaceY = surfaceWorldY - scrollY;
    const angle = facing > 0
      ? Math.PI + Math.PI * 0.5 * openProgress
      : -Math.PI * 0.5 * openProgress;
    const endX = hingeX + Math.cos(angle) * hatchWidth;
    const endY = surfaceY + Math.sin(angle) * hatchWidth;
    const normalX = -Math.sin(angle) * 2.15;
    const normalY = Math.cos(angle) * 2.15;
    const color = body.visualColor || "#333333";

    context.save();
    context.lineCap = "round";
    context.strokeStyle = "rgba(18, 14, 10, 0.58)";
    context.lineWidth = 3.2;
    context.beginPath();
    context.moveTo(hatchCenterX - hatchWidth * 0.5 + 1, surfaceY);
    context.lineTo(hatchCenterX + hatchWidth * 0.5 - 1, surfaceY);
    context.stroke();

    context.fillStyle = color;
    context.globalAlpha = 0.94;
    context.beginPath();
    context.moveTo(hingeX + normalX, surfaceY + normalY);
    context.lineTo(endX + normalX, endY + normalY);
    context.lineTo(endX - normalX, endY - normalY);
    context.lineTo(hingeX - normalX, surfaceY - normalY);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = color;
    context.lineWidth = 1.25;
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.62)";
    context.lineWidth = 0.9;
    for (const fraction of [0.32, 0.7]) {
      const railX = hingeX + Math.cos(angle) * hatchWidth * fraction;
      const railY = surfaceY + Math.sin(angle) * hatchWidth * fraction;
      context.beginPath();
      context.moveTo(railX + normalX * 0.68, railY + normalY * 0.68);
      context.lineTo(railX - normalX * 0.68, railY - normalY * 0.68);
      context.stroke();
    }

    context.fillStyle = color;
    context.beginPath();
    context.arc(hingeX, surfaceY, 2.6, 0, Math.PI * 2);
    context.fill();

    if (dropHatch.phase === "kicking") {
      const kickProgress = Math.min(1, dropHatch.time / CONFIG.dropHatchKickSeconds);
      const impact = Math.sin(Math.max(0, Math.min(1, (kickProgress - 0.36) / 0.42)) * Math.PI);
      if (impact > 0.08) {
        const impactX = endX + 3;
        const impactY = endY - 1;
        context.globalAlpha = impact * 0.72;
        context.strokeStyle = "#241b13";
        context.lineWidth = 1.35;
        for (const offset of [-1, 0, 1]) {
          const rayAngle = -0.9 + offset * 0.48;
          context.beginPath();
          context.moveTo(impactX + Math.cos(rayAngle) * 3, impactY + Math.sin(rayAngle) * 3);
          context.lineTo(impactX + Math.cos(rayAngle) * 7, impactY + Math.sin(rayAngle) * 7);
          context.stroke();
        }
      }
    }
    context.restore();
  }

  function portalWorldRect(portal) {
    return {
      x: portal.x,
      y: portal.baseY - CONFIG.portalHeight,
      width: CONFIG.portalWidth,
      height: CONFIG.portalHeight
    };
  }

  function drawPortalSwarm(rect, progress, scrollX, scrollY, time) {
    const eased = 1 - Math.pow(1 - progress, 3);
    const centerX = rect.x + rect.width * 0.5 - scrollX;
    const centerY = rect.y + rect.height * 0.52 - scrollY;
    for (let index = 0; index < particleCount(56, 22); index += 1) {
      const angle = index * 2.39996 + time * (0.68 + (index % 6) * 0.035);
      const radiusX = (rect.width * 0.6 + 9 + (index % 6) * 2.4) * eased;
      const radiusY = (rect.height * 0.48 + 7 + (index % 8) * 1.8) * eased;
      drawScoutParticle(
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle * 1.09) * radiusY,
        index,
        time,
        index % 8 === 0 ? 2.9 : 1.7,
        0.84 + (index % 4) * 0.04
      );
    }
    const funnelCount = particleCount(22, 8);
    for (let index = 0; index < funnelCount; index += 1) {
      const phase = ((time * 0.64 + index / funnelCount) % 1 + 1) % 1;
      const tighten = 1 - phase * 0.64;
      drawScoutParticle(
        centerX + Math.sin(time * 4.6 + index * 1.91) * (rect.width * 0.48 + index % 4 * 2.4) * tighten,
        centerY - rect.height * 0.94 + phase * rect.height * 1.38,
        index + 80,
        time,
        index % 5 === 0 ? 3.25 : 2.05,
        0.98
      );
    }
  }

  function drawPortal(scrollX, scrollY) {
    const portal = interaction.portal;
    if (!portal || portal.progress <= 0) return;
    const eased = 1 - Math.pow(1 - portal.progress, 3);
    const rect = portalWorldRect(portal);
    const x = rect.x - scrollX;
    const baseY = portal.baseY - scrollY;
    const visibleHeight = rect.height * eased;
    const top = baseY - visibleHeight;
    const frameColor = portal.color || "#333333";
    const enter = portal.entering ? portal.enterProgress : 0;
    const doorLeft = x + 5;
    const doorWidth = rect.width - 10;
    const doorTop = top + 7;
    const doorHeight = Math.max(0, visibleHeight - 7);
    const openAngle = (1 - Math.pow(1 - enter, 2)) * 1.34;
    const apparentWidth = Math.max(2, doorWidth * Math.cos(openAngle));
    const skew = Math.sin(openAngle) * 5;

    context.save();
    context.strokeStyle = frameColor;
    context.lineWidth = 2;
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(x + 3, baseY);
    context.lineTo(x + 3, top + 4);
    context.lineTo(x + rect.width - 3, top + 4);
    context.lineTo(x + rect.width - 3, baseY);
    context.stroke();

    // A completely ordinary little door growing from a hyperlink is more
    // unsettling than a glowing portal. The panel swings on its left edge.
    context.fillStyle = "rgba(250, 247, 238, 0.97)";
    context.beginPath();
    context.moveTo(doorLeft, doorTop);
    context.lineTo(doorLeft + apparentWidth, doorTop + skew);
    context.lineTo(doorLeft + apparentWidth, doorTop + doorHeight - skew);
    context.lineTo(doorLeft, doorTop + doorHeight);
    context.closePath();
    context.fill();
    context.strokeStyle = frameColor;
    context.lineWidth = 1.6;
    context.stroke();

    if (apparentWidth > 7) {
      context.fillStyle = frameColor;
      context.beginPath();
      context.arc(doorLeft + apparentWidth * 0.78, doorTop + doorHeight * 0.54, 1.7, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();

    if (mission.goalKind === "portal" && portal.anchor === mission.portalAnchor) {
      context.save();
      drawPortalSwarm(rect, portal.progress, scrollX, scrollY, performance.now() / 1000);
      context.restore();
    }
  }

  function drawPlayer(scrollX, scrollY) {
    if (
      web.hatchPhase === "traversing" ||
      dropHatch.phase === "traversing" ||
      ladderTraversal.phase === "burrowing"
    ) return;
    const renderPlayerY = ladderTraversal.phase !== "none" && Number.isFinite(ladderTraversal.visualY)
      ? ladderTraversal.visualY
      : dropHatch.phase === "bursting" && Number.isFinite(dropHatch.visualY)
        ? dropHatch.visualY
        : player.y;
    const x = player.x - scrollX;
    const y = renderPlayerY - scrollY;
    const centerX = x + player.width * 0.5;
    const speedRatio = Math.min(1, Math.abs(player.velocityX) / CONFIG.maxRunSpeed);
    const runPhase = performance.now() * 0.018 * Math.max(0.25, speedRatio);
    const spriteScale = player.height / 32;
    const scaled = (value) => value * spriteScale;
    const bob = player.grounded ? Math.abs(Math.sin(runPhase)) * -scaled(1.2) * speedRatio : -scaled(1.4);
    const spriteRadius = scaled(15);
    const spriteCenterY = y + player.height - spriteRadius - scaled(2) + bob;
    const facing = player.facing || 1;
    const palette = player.palette;
    const entryProgress = web.hatchPhase === "entering"
      ? Math.min(1, web.hatchTime / web.hatchEntryDuration)
      : 0;
    const struggleAmount = entryProgress > 0.24 && entryProgress < 0.86
      ? Math.sin(Math.min(1, (entryProgress - 0.24) / 0.18) * Math.PI * 0.5) *
        Math.sin(Math.min(1, (0.86 - entryProgress) / 0.16) * Math.PI * 0.5)
      : 0;
    const kickPhase = performance.now() * 0.046;
    const dropKickProgress = dropHatch.phase === "kicking"
      ? Math.min(1, dropHatch.time / CONFIG.dropHatchKickSeconds)
      : 0;
    const dropKickAmount = dropKickProgress <= 0
      ? 0
      : dropKickProgress < 0.28
        ? 1 - Math.pow(1 - dropKickProgress / 0.28, 3)
        : dropKickProgress < 0.7
          ? 1
          : 1 - Math.pow((dropKickProgress - 0.7) / 0.3, 2);
    const dropReadyProgress = dropHatch.phase === "readying"
      ? Math.min(1, dropHatch.time / CONFIG.dropHatchReadySeconds)
      : 0;
    const dropDiveProgress = dropHatch.phase === "diving"
      ? Math.min(1, dropHatch.time / CONFIG.dropHatchDiveSeconds)
      : 0;
    const dropJumpProgress = dropHatch.phase === "jumping"
      ? Math.min(1, dropHatch.time / CONFIG.dropHatchJumpSeconds)
      : 0;
    const dropBurstProgress = dropHatch.phase === "bursting"
      ? Math.min(1, dropHatch.time / CONFIG.dropHatchBurstSeconds)
      : 0;
    const dropEntryAmount = dropJumpProgress > 0
      ? Math.max(0, Math.min(1, (dropJumpProgress - 0.62) / 0.38))
      : dropDiveProgress > 0
        ? 1
        : dropBurstProgress > 0 ? 1 - dropBurstProgress : 0;
    const ladderClimbAmount = ladderTraversal.phase === "climbing" ? 1 : 0;
    const ladderGripProgress = ladderTraversal.phase === "gripping"
      ? Math.min(1, ladderTraversal.time / CONFIG.ladderGripSeconds)
      : 0;
    const ladderThreadProgress = ladderTraversal.phase === "threading"
      ? Math.min(1, ladderTraversal.time / CONFIG.ladderThreadSeconds)
      : 0;
    const ladderRollProgress = ladderTraversal.phase === "rolling"
      ? Math.min(1, ladderTraversal.time / CONFIG.ladderRollSeconds)
      : 0;
    const ladderBackView = ladderTraversal.phase === "climbing" || ladderTraversal.phase === "gripping";
    const ladderStep = Math.sin(ladderTraversal.climbCycle);
    const footSwing = web.hatchPhase === "entering"
      ? Math.sin(kickPhase) * scaled(5.8) * struggleAmount
      : dropHatch.phase === "kicking"
        ? facing * scaled(7.2) * dropKickAmount
        : ladderClimbAmount
          ? ladderStep * scaled(4.4)
          : player.grounded ? Math.sin(runPhase) * scaled(3.2) * speedRatio : 0;
    const leftFootLift = web.hatchPhase === "entering"
      ? Math.max(0, Math.cos(kickPhase)) * scaled(4.2) * struggleAmount
      : dropHatch.phase === "kicking" && facing < 0
        ? scaled(6.5) * dropKickAmount
        : ladderClimbAmount ? Math.max(0, ladderStep) * scaled(3.2) : 0;
    const rightFootLift = web.hatchPhase === "entering"
      ? Math.max(0, -Math.cos(kickPhase)) * scaled(4.2) * struggleAmount
      : dropHatch.phase === "kicking" && facing >= 0
        ? scaled(6.5) * dropKickAmount
        : ladderClimbAmount ? Math.max(0, -ladderStep) * scaled(3.2) : 0;
    const crawlProgress = web.hatchPhase === "emerging" ? Math.min(1, web.hatchTime / web.hatchPassageDuration) : 0;
    const crawlAmount = crawlProgress > 0 ? Math.sin(crawlProgress * Math.PI) : 0;
    const doorEntry = interaction.portal?.entering ? interaction.portal.enterProgress : 0;
    const airJumpElapsed = performance.now() / 1000 - player.airJumpAt;
    const airJumpProgress = Math.max(0, Math.min(1, airJumpElapsed / CONFIG.airJumpSpinSeconds));
    const airJumpActive = Number.isFinite(airJumpElapsed) && airJumpElapsed >= 0 && airJumpElapsed < CONFIG.airJumpSpinSeconds;

    context.save();
    if (web.hatchPhase === "opening" || web.hatchPhase === "entering") {
      const undersideY = web.hatchBottomY - scrollY;
      context.beginPath();
      context.rect(0, undersideY, state.viewportWidth, Math.max(0, state.viewportHeight - undersideY));
      context.clip();
    } else if (web.hatchPhase === "emerging") {
      const surfaceY = web.hatchTopY - scrollY;
      context.beginPath();
      context.rect(0, 0, state.viewportWidth, Math.max(0, surfaceY));
      context.clip();
    } else if (dropHatch.phase === "diving") {
      const surfaceY = dropHatch.topY - scrollY;
      context.beginPath();
      context.rect(0, 0, state.viewportWidth, Math.max(0, surfaceY));
      context.clip();
    } else if (dropHatch.phase === "bursting") {
      const undersideY = dropHatch.bottomY - scrollY;
      context.beginPath();
      context.rect(0, undersideY, state.viewportWidth, Math.max(0, state.viewportHeight - undersideY));
      context.clip();
    } else if (ladderTraversal.phase === "threading") {
      const undersideY = ladderTraversal.ladder.topY - scrollY;
      context.beginPath();
      context.rect(0, undersideY, state.viewportWidth, Math.max(0, state.viewportHeight - undersideY));
      context.clip();
    } else if (ladderTraversal.phase === "rolling") {
      const surfaceY = ladderTraversal.ladder.upperBody.y - scrollY;
      context.beginPath();
      context.rect(0, 0, state.viewportWidth, Math.max(0, surfaceY));
      context.clip();
    }
    if (dropHatch.phase === "kicking") {
      context.translate(centerX, spriteCenterY);
      context.rotate(-facing * dropKickAmount * 0.2);
      context.scale(1 + dropKickAmount * 0.07, 1 - dropKickAmount * 0.09);
      context.translate(-centerX, -spriteCenterY);
    } else if (dropHatch.phase === "readying") {
      const crouch = dropReadyProgress * dropReadyProgress * (3 - 2 * dropReadyProgress);
      context.translate(centerX, y + player.height);
      context.scale(1 + crouch * 0.13, 1 - crouch * 0.2);
      context.translate(-centerX, -(y + player.height));
    } else if (dropHatch.phase === "jumping") {
      const leanProgress = Math.max(0, Math.min(1, (dropJumpProgress - 0.5) / 0.5));
      context.translate(centerX, spriteCenterY);
      context.rotate(facing * 0.18 * Math.sin(leanProgress * Math.PI));
      context.scale(1 - dropEntryAmount * 0.03, 1 + dropEntryAmount * 0.08);
      context.translate(-centerX, -spriteCenterY);
    } else if (dropHatch.phase === "diving") {
      context.translate(centerX, spriteCenterY);
      context.rotate(facing * 0.05 * (1 - dropDiveProgress));
      context.scale(0.97, 1.1);
      context.translate(-centerX, -spriteCenterY);
    } else if (dropHatch.phase === "bursting") {
      context.translate(centerX, spriteCenterY);
      context.scale(0.97 + dropBurstProgress * 0.03, 1.1 - dropBurstProgress * 0.1);
      context.translate(-centerX, -spriteCenterY);
    } else if (ladderTraversal.phase === "climbing") {
      context.translate(centerX, spriteCenterY);
      context.rotate(ladderStep * 0.035);
      context.translate(-centerX, -spriteCenterY);
    } else if (ladderTraversal.phase === "gripping") {
      const grip = Math.sin(ladderGripProgress * Math.PI);
      context.translate(centerX, spriteCenterY);
      context.scale(1 + grip * 0.13, 1 - grip * 0.16);
      context.translate(-centerX, -spriteCenterY);
    } else if (ladderTraversal.phase === "threading") {
      const squeeze = Math.sin(ladderThreadProgress * Math.PI * 0.5);
      context.translate(centerX, spriteCenterY);
      context.rotate(Math.sin(ladderThreadProgress * Math.PI * 4) * (1 - ladderThreadProgress) * 0.08);
      context.scale(1 - squeeze * 0.54, 1 + squeeze * 0.15);
      context.translate(-centerX, -spriteCenterY);
    } else if (ladderTraversal.phase === "rolling") {
      const settle = ladderRollProgress * ladderRollProgress * (3 - 2 * ladderRollProgress);
      context.translate(centerX, spriteCenterY);
      context.rotate(facing * Math.PI * 1.5 * (1 - settle));
      context.scale(1 + Math.sin(ladderRollProgress * Math.PI) * 0.14, 1 - Math.sin(ladderRollProgress * Math.PI) * 0.16);
      context.translate(-centerX, -spriteCenterY);
    } else if (web.mantlePhase !== "none") {
      const duration = web.mantlePhase === "approaching"
        ? CONFIG.webMantleApproachSeconds
        : CONFIG.webMantleVaultSeconds;
      const mantleProgress = Math.min(1, web.mantleTime / duration);
      const curl = Math.sin(mantleProgress * Math.PI);
      context.translate(centerX, spriteCenterY);
      context.rotate(web.mantleSide * curl * 0.48);
      context.scale(1 + curl * 0.12, 1 - curl * 0.15);
      context.translate(-centerX, -spriteCenterY);
    } else if (airJumpActive) {
      // The second jump is a compact two-somersault tumble rather than one
      // rigid turn. Fast tuck, long rotation, then a readable upright finish.
      const rotationProgress = 1 - Math.pow(1 - airJumpProgress, 1.22);
      const tuck = Math.sin(airJumpProgress * Math.PI);
      context.translate(centerX, spriteCenterY);
      context.rotate(facing * Math.PI * 4 * rotationProgress);
      context.scale(1 + tuck * 0.16, 1 - tuck * 0.22);
      context.translate(-centerX, -spriteCenterY);
    } else if (web.hatchPhase === "entering" && struggleAmount > 0) {
      context.translate(centerX, spriteCenterY);
      context.rotate(Math.sin(kickPhase * 0.72) * struggleAmount * 0.075);
      context.scale(1 + struggleAmount * 0.07, 1 - struggleAmount * 0.08);
      context.translate(-centerX, -spriteCenterY);
    } else if (crawlAmount > 0) {
      context.translate(centerX, spriteCenterY);
      context.rotate(facing * crawlAmount * 0.16);
      context.scale(1 + crawlAmount * 0.18, 1 - crawlAmount * 0.25);
      context.translate(-centerX, -spriteCenterY);
    } else if (doorEntry > 0) {
      context.translate(centerX, spriteCenterY);
      context.scale(Math.max(0.22, 1 - doorEntry * 0.78), 1 + Math.sin(doorEntry * Math.PI) * 0.08);
      context.translate(-centerX, -spriteCenterY);
    }

    // Small ground shadow keeps the one-head-tall silhouette readable over text.
    if (!["jumping", "diving", "bursting"].includes(dropHatch.phase) && ladderTraversal.phase === "none") {
      context.fillStyle = "rgba(5, 18, 38, 0.22)";
      context.beginPath();
      context.ellipse(centerX, y + player.height + scaled(1), scaled(11 - speedRatio * 1.5), scaled(2.8), 0, 0, Math.PI * 2);
      context.fill();
    }

    // Two tiny feet are enough to show running direction without making the
    // character taller than one head.
    context.strokeStyle = palette.dark;
    context.lineWidth = scaled(3.2);
    context.lineCap = "round";
    let leftFootX = centerX - scaled(4) + footSwing;
    let leftFootY = y + player.height - leftFootLift;
    let rightFootX = centerX + scaled(4) - footSwing;
    let rightFootY = y + player.height - rightFootLift;
    let strikingFootX = null;
    let strikingFootY = null;
    if (dropHatch.phase === "kicking") {
      const hatchNearEdgeX = dropHatch.centerX - facing * dropHatch.width * 0.5 - scrollX;
      const plantedY = y + player.height;
      if (facing > 0) {
        const raisedTargetX = hatchNearEdgeX + facing * scaled(4.2);
        rightFootX = centerX + scaled(4) + (raisedTargetX - (centerX + scaled(4))) * dropKickAmount;
        rightFootY = plantedY - scaled(11.5) * dropKickAmount;
        leftFootX = centerX - scaled(4.5);
        leftFootY = plantedY;
        strikingFootX = rightFootX;
        strikingFootY = rightFootY;
      } else {
        const raisedTargetX = hatchNearEdgeX + facing * scaled(4.2);
        leftFootX = centerX - scaled(4) + (raisedTargetX - (centerX - scaled(4))) * dropKickAmount;
        leftFootY = plantedY - scaled(11.5) * dropKickAmount;
        rightFootX = centerX + scaled(4.5);
        rightFootY = plantedY;
        strikingFootX = leftFootX;
        strikingFootY = leftFootY;
      }
    } else if (["jumping", "diving", "bursting"].includes(dropHatch.phase)) {
      const feetFirstReach = scaled(3.5) * dropEntryAmount;
      leftFootY += feetFirstReach;
      rightFootY += feetFirstReach;
    }
    context.beginPath();
    context.moveTo(centerX - scaled(4.5), spriteCenterY + scaled(11.5));
    context.lineTo(leftFootX, leftFootY);
    context.moveTo(centerX + scaled(4.5), spriteCenterY + scaled(11.5));
    context.lineTo(rightFootX, rightFootY);
    context.stroke();

    if (Number.isFinite(strikingFootX) && dropKickAmount > 0.12) {
      context.globalAlpha = dropKickAmount * 0.48;
      context.strokeStyle = palette.dark;
      context.lineWidth = scaled(1.2);
      for (const offset of [-1, 1]) {
        context.beginPath();
        context.moveTo(strikingFootX - facing * scaled(8), strikingFootY + offset * scaled(2.2));
        context.lineTo(strikingFootX - facing * scaled(3.8), strikingFootY + offset * scaled(1.2));
        context.stroke();
      }
      context.globalAlpha = 1;
    }

    // Orange scarf/accent: its length communicates speed and later doubles as
    // a clear visual origin for the web-swing animation.
    if (!ladderBackView) {
      const scarfLength = scaled(8 + speedRatio * 9);
      context.strokeStyle = palette.accent;
      context.lineWidth = scaled(3.3);
      context.beginPath();
      context.moveTo(centerX - facing * scaled(7), spriteCenterY - scaled(3));
      context.quadraticCurveTo(
        centerX - facing * (scaled(10) + scarfLength * 0.35),
        spriteCenterY - scaled(7) - Math.sin(runPhase) * scaled(1.5),
        centerX - facing * scarfLength,
        spriteCenterY - scaled(2) + Math.cos(runPhase * 0.8) * scaled(2)
      );
      context.stroke();
    }

    context.fillStyle = palette.glow;
    context.beginPath();
    context.arc(centerX, spriteCenterY, spriteRadius + scaled(2.2), 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette.primary;
    context.beginPath();
    context.arc(centerX, spriteCenterY, spriteRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.96)";
    context.lineWidth = scaled(1.7);
    context.stroke();

    if (dropEntryAmount > 0) {
      const balance = Math.sin(dropJumpProgress * Math.PI) * scaled(2.2) * dropEntryAmount;
      context.strokeStyle = palette.dark;
      context.lineWidth = scaled(2.8);
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(centerX - scaled(8), spriteCenterY - scaled(1));
      context.lineTo(centerX - scaled(9) - balance, spriteCenterY + scaled(7) * dropEntryAmount);
      context.moveTo(centerX + scaled(8), spriteCenterY - scaled(1));
      context.lineTo(centerX + scaled(9) + balance, spriteCenterY + scaled(7) * dropEntryAmount);
      context.stroke();
    }

    if (ladderTraversal.phase !== "none") {
      const reach = ladderTraversal.phase === "gripping"
        ? 1 + Math.sin(ladderGripProgress * Math.PI) * 0.24
        : ladderTraversal.phase === "rolling" ? 1 - ladderRollProgress * 0.5 : 0.86;
      const handStep = ladderTraversal.phase === "climbing" ? ladderStep : 0;
      context.strokeStyle = palette.dark;
      context.lineWidth = scaled(2.7);
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(centerX - scaled(7), spriteCenterY - scaled(1));
      context.lineTo(centerX - scaled(10), spriteCenterY - scaled(10 * reach) - handStep * scaled(3));
      context.moveTo(centerX + scaled(7), spriteCenterY - scaled(1));
      context.lineTo(centerX + scaled(10), spriteCenterY - scaled(10 * reach) + handStep * scaled(3));
      context.stroke();
    }

    if (ladderBackView) {
      // The character faces the ladder, so show a subdued back panel instead
      // of leaving the bright visor staring at the camera while climbing.
      context.fillStyle = "rgba(2, 15, 34, 0.72)";
      context.beginPath();
      context.roundRect(centerX - scaled(4.2), spriteCenterY - scaled(7.2), scaled(8.4), scaled(13.5), scaled(3.2));
      context.fill();
      context.strokeStyle = "rgba(118, 206, 231, 0.55)";
      context.lineWidth = scaled(1);
      context.beginPath();
      context.moveTo(centerX, spriteCenterY - scaled(5.2));
      context.lineTo(centerX, spriteCenterY + scaled(4.8));
      context.stroke();
    } else {
      // A single bright visor reads better than facial details at Chromebook
      // viewing distance and keeps the design clean.
      const visorX = centerX + facing * scaled(2.3);
      context.fillStyle = palette.visor;
      context.beginPath();
      context.roundRect(visorX - scaled(6), spriteCenterY - scaled(5.3), scaled(12), scaled(6.4), scaled(3.2));
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = scaled(1);
      context.stroke();
      context.strokeStyle = "rgba(255, 255, 255, 0.78)";
      context.lineWidth = scaled(0.8);
      context.beginPath();
      context.moveTo(visorX - scaled(3.8), spriteCenterY - scaled(3.6));
      context.lineTo(visorX + scaled(1.2), spriteCenterY - scaled(3.6));
      context.stroke();

      context.fillStyle = palette.accent;
      context.beginPath();
      context.arc(centerX - facing * scaled(9.8), spriteCenterY + scaled(6.2), scaled(2.3), 0, Math.PI * 2);
      context.fill();
    }

    // Two compact pips show the limited airborne web charges without text.
    for (let index = 0; index < CONFIG.webMaximumCharges; index += 1) {
      const pipX = centerX + (index - 0.5) * scaled(7);
      const pipY = spriteCenterY - spriteRadius - scaled(5);
      context.fillStyle = index < web.charges ? palette.visor : "rgba(7, 28, 58, 0.28)";
      context.strokeStyle = index < web.charges ? "#ffffff" : "rgba(7, 28, 58, 0.62)";
      context.lineWidth = scaled(1);
      context.beginPath();
      context.arc(pipX, pipY, scaled(2.2), 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();

    if (crawlAmount > 0 && web.anchorBody && player.y < web.hatchTopY) {
      const edgeY = web.hatchTopY - scrollY - 1;
      context.save();
      context.beginPath();
      context.rect(0, 0, state.viewportWidth, Math.max(0, edgeY + 1));
      context.clip();
      context.strokeStyle = palette.dark;
      context.lineWidth = 2.2;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(centerX - 6, spriteCenterY + 2);
      context.lineTo(centerX - 8, edgeY);
      context.moveTo(centerX + 5, spriteCenterY + 3);
      context.lineTo(centerX + 8, edgeY);
      context.stroke();
      context.restore();
    }
  }

  function goalCelebrationActive(nowSeconds = performance.now() / 1000) {
    if (mission.scoreAttack) {
      return mission.scoreFinished && nowSeconds - mission.completedAt < CONFIG.goalCelebrationSeconds;
    }
    return mission.completed && nowSeconds - mission.completedAt < CONFIG.goalCelebrationSeconds;
  }

  function drawFinishTapeHalf(centerX, y, width, direction, breakProgress) {
    if (width <= 0) return;
    const travel = direction * breakProgress * state.viewportWidth * 0.34;
    const rotation = direction * breakProgress * 0.12;
    const left = direction < 0 ? -width : 0;
    context.save();
    context.translate(centerX + travel, y + Math.sin(breakProgress * Math.PI) * 10);
    context.rotate(rotation);
    context.fillStyle = "#fff9e7";
    context.strokeStyle = "#182d4c";
    context.lineWidth = 3;
    context.fillRect(left, -16, width, 32);
    context.strokeRect(left, -16, width, 32);
    context.fillStyle = "#e77d28";
    context.fillRect(left, -4, width, 8);
    context.fillStyle = "#182d4c";
    for (let offset = 8; offset < width; offset += 34) {
      const stripeX = direction < 0 ? -offset - 11 : offset;
      context.save();
      context.translate(stripeX, 0);
      context.rotate(-0.42);
      context.fillRect(-4, -15, 8, 30);
      context.restore();
    }
    context.restore();
  }

  function drawGoalCelebration() {
    if (!goalCelebrationActive()) return;
    const elapsed = performance.now() / 1000 - mission.completedAt;
    const endFade = Math.max(0, Math.min(1, (CONFIG.goalCelebrationSeconds - elapsed) / 0.48));
    const tapeArrival = Math.max(0, Math.min(1, elapsed / 0.2));
    const breakProgress = Math.max(0, Math.min(1, (elapsed - 0.46) / 0.62));
    const stampProgress = Math.max(0, Math.min(1, (elapsed - 0.58) / 0.5));
    const stampEase = stampProgress === 0
      ? 0
      : 1 + 2.7 * Math.pow(stampProgress - 1, 3) + 1.7 * Math.pow(stampProgress - 1, 2);
    const centerX = state.viewportWidth * 0.5;
    const centerY = state.viewportHeight * 0.5;
    const tapeY = Math.max(105, Math.min(state.viewportHeight - 105, player.y + player.height * 0.45 - window.scrollY));
    context.save();
    context.globalAlpha = endFade;

    const flash = Math.max(0, 1 - elapsed / 0.42);
    if (flash > 0) {
      context.fillStyle = `rgba(255, 249, 222, ${flash * 0.86})`;
      context.fillRect(0, 0, state.viewportWidth, state.viewportHeight);
    }

    const barHeight = 18 + Math.sin(Math.min(1, elapsed / 0.35) * Math.PI * 0.5) * 22;
    context.fillStyle = "rgba(13, 27, 48, 0.88)";
    context.fillRect(0, 0, state.viewportWidth, barHeight);
    context.fillRect(0, state.viewportHeight - barHeight, state.viewportWidth, barHeight);

    const halfWidth = state.viewportWidth * 0.5 * tapeArrival;
    drawFinishTapeHalf(centerX, tapeY, halfWidth, -1, breakProgress);
    drawFinishTapeHalf(centerX, tapeY, halfWidth, 1, breakProgress);

    if (stampProgress > 0) {
      context.save();
      context.translate(centerX, centerY);
      context.rotate(-0.035 + Math.sin(stampProgress * Math.PI) * 0.018);
      context.scale(stampEase, stampEase);
      context.shadowColor = "rgba(24, 19, 13, 0.36)";
      context.shadowBlur = 18;
      context.shadowOffsetY = 8;
      context.fillStyle = "#fffaf0";
      context.beginPath();
      context.arc(0, 0, 92, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = "transparent";
      context.strokeStyle = "#192e4d";
      context.lineWidth = 7;
      context.stroke();
      context.beginPath();
      context.arc(0, 0, 78, 0, Math.PI * 2);
      context.strokeStyle = "#df7829";
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = "#192e4d";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = mission.scoreAttack
        ? "700 31px Georgia, 'Times New Roman', serif"
        : "700 42px Georgia, 'Times New Roman', serif";
      context.fillText(mission.scoreAttack ? "FINISH" : "GOAL", 0, -8);
      context.fillStyle = "#df7829";
      context.fillRect(-49, 25, 98, 6);
      if (mission.scoreAttack) {
        context.fillStyle = "#192e4d";
        context.font = "700 24px system-ui, sans-serif";
        context.fillText(String(mission.score), 0, 48);
      }
      context.restore();
    }
    context.restore();
  }

  function missionPreviewActive(nowSeconds = performance.now() / 1000) {
    return nowSeconds < mission.previewUntil;
  }

  function startMissionPreviewCountdown() {
    if (!mission.previewAwaitingPhoto) return;
    mission.previewAwaitingPhoto = false;
    if (mission.previewFallbackTimer) window.clearTimeout(mission.previewFallbackTimer);
    mission.previewFallbackTimer = 0;
    mission.previewStartedAt = performance.now() / 1000;
    mission.previewUntil = mission.previewStartedAt + 3.4;
  }

  function beginMissionPreview({ pageUrl, goalX, goalY }) {
    const previewWorldX = mission.goalKind === "text" ? mission.goalPoint.x : bodyCenterX(mission.goalBody);
    const previewWorldY = mission.goalBody.y - window.innerHeight * 0.12;
    mission.previewStartedAt = performance.now() / 1000;
    mission.previewUntil = Infinity;
    mission.previewShownAt = mission.previewStartedAt;
    mission.previewPhotoLoadedAt = -Infinity;
    mission.previewRenderedImages = 0;
    // Relaunch the scout swarm when the photo closes. Otherwise a round made
    // during the pickup freeze can inherit the previous flag's cleared wisp.
    mission.previewGuidePending = true;
    mission.previewScrollX = Math.max(0, Math.min(state.documentWidth - window.innerWidth, previewWorldX - window.innerWidth * 0.5));
    mission.previewScrollY = Math.max(0, Math.min(state.documentHeight - window.innerHeight, previewWorldY - window.innerHeight * 0.48));
    showMissionPreviewPhoto({ pageUrl, goalX, goalY });
    mission.previewAwaitingPhoto = Boolean(missionPreviewPhoto);
    if (!mission.previewAwaitingPhoto) {
      mission.previewStartedAt = performance.now() / 1000;
      mission.previewUntil = mission.previewStartedAt + 3.4;
      return;
    }
    // A broken preview must not lock input forever. Normal same-origin pages
    // start the countdown from their load event; this is only a safe fallback.
    mission.previewFallbackTimer = window.setTimeout(startMissionPreviewCountdown, 2400);
  }

  function clearFinalGoalPlanner() {
    if (!mission.plannerFrame) return;
    mission.plannerFrame.remove();
    mission.plannerFrame = null;
  }

  function planFinalGoal(destination, {
    remainingDistance = 0,
    hopsLeft = 0,
    headerPortalStreak = 0,
    headerPortalTotal = 0
  } = {}) {
    clearFinalGoalPlanner();
    if (!destination) return;
    mission.previewStartedAt = performance.now() / 1000;
    mission.previewUntil = Infinity;
    const previewWorldX = bodyCenterX(mission.goalBody);
    mission.previewScrollX = Math.max(0, Math.min(state.documentWidth - window.innerWidth, previewWorldX - window.innerWidth * 0.5));
    mission.previewScrollY = Math.max(0, Math.min(state.documentHeight - window.innerHeight, mission.goalBody.y - window.innerHeight * 0.48));

    const firstPortalPage = pageIdentity(destination);
    const requiredDistance = Math.max(0, remainingDistance) * CONFIG.missionPlanningCompletionRatio;
    const visitedPages = new Set(mission.visitedPaths);
    let bestPlan = null;
    let settled = false;
    let activeReceive = null;
    let activeTimeout = 0;

    const clearActiveStage = () => {
      if (activeReceive) window.removeEventListener("message", activeReceive);
      if (activeTimeout) window.clearTimeout(activeTimeout);
      activeReceive = null;
      activeTimeout = 0;
      clearFinalGoalPlanner();
    };
    const finish = (data) => {
      if (settled) return;
      if (!data?.ok || !Number.isFinite(data.x + data.y) || typeof data.page !== "string") {
        settled = true;
        clearActiveStage();
        mission.scorePlanningPortal = false;
        if (mission.scoreAttack) {
          fallbackToLocalScoreRound();
          return;
        }
        mission.previewUntil = -Infinity;
        return;
      }
      const plannedDistance = mission.routeDistance + Math.max(0, data.plannedDistance || 0);
      const minimumAcceptedDistance = mission.targetRouteDistance * CONFIG.missionPlanningMinimumAcceptRatio;
      if (
        !mission.scoreAttack &&
        mission.segmentIndex === 0 &&
        mission.targetRouteDistance > 0 &&
        plannedDistance < minimumAcceptedDistance &&
        mission.startAttempt < CONFIG.missionStartMaximumAttempts &&
        redirectToRandomStartPage({
          force: true,
          startAttempt: mission.startAttempt,
          triedPageKeys: mission.startTriedPages
        })
      ) {
        settled = true;
        clearActiveStage();
        return;
      }
      settled = true;
      clearActiveStage();
      mission.finalGoalPage = data.page;
      mission.finalGoalX = data.x;
      mission.finalGoalY = data.y;
      mission.finalGoalReady = true;
      mission.scorePlanningPortal = false;
      mission.plannedPortalPages = [
        firstPortalPage,
        ...(Array.isArray(data.portalPages) ? data.portalPages : [])
      ].filter((path, index, pages) => pages.indexOf(path) === index);
      mission.plannedPortalTransitions = mission.plannedPortalPages.length;
      mission.plannedRouteDistance = plannedDistance;
      if (mission.scoreAttack) rememberScoreTarget(data.page, data.x, data.y);
      const finalPageUrl = new URL(data.page.replace(/^\//, ""), staticSiteRoot);
      beginMissionPreview({ pageUrl: finalPageUrl.href, goalX: data.x, goalY: data.y });
    };

    const scanStage = (
      stageUrl,
      fromPage,
      remaining,
      remainingHops,
      accumulatedDistance,
      portalPages,
      consecutiveHeaderPortals,
      totalHeaderPortals
    ) => {
      if (settled) return;
      clearActiveStage();
      const token = `${mission.runId}-${randomIndex(0x100000).toString(36)}`;
      const planner = document.createElement("iframe");
      planner.dataset.eimeiGame = "goal-planner";
      planner.setAttribute("aria-hidden", "true");
      Object.assign(planner.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${window.innerWidth}px`,
        height: `${window.innerHeight}px`,
        border: "0",
        opacity: "0",
        zIndex: "-1",
        pointerEvents: "none"
      });
      mission.plannerFrame = planner;
      mission.plannerToken = token;
      const plannerUrl = new URL(stageUrl.href || stageUrl, staticSiteRoot);
      const stagePage = pageIdentity(plannerUrl);
      visitedPages.add(stagePage);
      for (const key of [...plannerUrl.searchParams.keys()]) {
        if (key.startsWith("eimei-")) plannerUrl.searchParams.delete(key);
      }
      plannerUrl.searchParams.set("eimei-route", "plan");
      plannerUrl.searchParams.set("eimei-run", mission.runId);
      plannerUrl.searchParams.set("eimei-from", fromPage);
      plannerUrl.searchParams.set("eimei-plan-token", token);
      plannerUrl.searchParams.set("eimei-plan-distance", String(Math.max(0, remaining)));
      plannerUrl.searchParams.set("eimei-plan-hops", String(Math.max(0, remainingHops)));
      plannerUrl.searchParams.set("eimei-plan-header-streak", String(Math.max(0, consecutiveHeaderPortals)));
      plannerUrl.searchParams.set("eimei-plan-header-total", String(Math.max(0, totalHeaderPortals)));
      plannerUrl.searchParams.set("eimei-visited", [...visitedPages].join("|"));

      activeReceive = (event) => {
        if (event.source !== planner.contentWindow || event.data?.type !== "eimei-final-goal-plan" || event.data.token !== token) return;
        const scan = event.data;
        clearActiveStage();
        mission.planningTrace.push({
          page: scan?.page || stagePage,
          remaining,
          accumulatedDistance,
          headerPortalStreak: Number.isFinite(scan?.headerPortalStreak)
            ? scan.headerPortalStreak
            : null,
          headerPortalTotal: Number.isFinite(scan?.headerPortalTotal)
            ? scan.headerPortalTotal
            : null,
          localDistance: Number.isFinite(scan?.localGoal?.distance) ? scan.localGoal.distance : null,
          bridges: Array.isArray(scan?.bridges)
            ? scan.bridges.map((bridge) => ({
              page: bridge.page,
              distance: bridge.distance,
              globalNavigation: Boolean(bridge.globalNavigation)
            }))
            : []
        });
        if (!scan?.ok || !scan.scan) {
          finish(bestPlan);
          return;
        }
        const local = scan.localGoal;
        if (local && Number.isFinite(local.x + local.y + local.distance)) {
          const candidate = {
            ok: true,
            page: local.page,
            x: local.x,
            y: local.y,
            plannedDistance: accumulatedDistance + Math.max(0, local.distance),
            portalPages
          };
          if (!bestPlan || candidate.plannedDistance > bestPlan.plannedDistance) bestPlan = candidate;
          if (candidate.plannedDistance >= requiredDistance || remainingHops <= 0) {
            finish(candidate);
            return;
          }
        }
        const bridge = (Array.isArray(scan.bridges) ? scan.bridges : []).find((candidate) =>
          typeof candidate?.href === "string" &&
          typeof candidate?.page === "string" &&
          Number.isFinite(candidate.distance) &&
          !visitedPages.has(candidate.page)
        );
        if (!bridge || remainingHops <= 0) {
          finish(bestPlan);
          return;
        }
        scanStage(
          new URL(bridge.href, staticSiteRoot),
          scan.page,
          Math.max(0, remaining - Math.max(0, bridge.distance)),
          remainingHops - 1,
          accumulatedDistance + Math.max(0, bridge.distance),
          [...portalPages, bridge.page],
          bridge.globalNavigation ? consecutiveHeaderPortals + 1 : 0,
          totalHeaderPortals + (bridge.globalNavigation ? 1 : 0)
        );
      };
      window.addEventListener("message", activeReceive);
      activeTimeout = window.setTimeout(() => finish(bestPlan), 5000);
      planner.src = plannerUrl.href;
      document.documentElement.append(planner);
    };

    scanStage(
      destination,
      pageIdentity(),
      remainingDistance,
      hopsLeft,
      0,
      [],
      Math.max(0, headerPortalStreak),
      Math.max(0, headerPortalTotal)
    );
  }

  function clearMissionPreviewPhoto() {
    if (mission.previewFallbackTimer) window.clearTimeout(mission.previewFallbackTimer);
    mission.previewFallbackTimer = 0;
    mission.previewAwaitingPhoto = false;
    missionPreviewPhoto?.root?.remove();
    missionPreviewPhoto = null;
  }

  function positionMissionPreviewPhoto() {
    const photo = missionPreviewPhoto;
    if (!photo?.iframe?.contentWindow || !photo.iframe.contentDocument) return;
    const previewWindow = photo.iframe.contentWindow;
    const previewDocument = photo.iframe.contentDocument;
    const goalX = photo.goalX;
    const goalY = photo.goalY;
    const width = state.viewportWidth;
    const height = state.viewportHeight;
    const documentWidth = Math.max(previewDocument.documentElement.scrollWidth, previewDocument.body?.scrollWidth || 0);
    const documentHeight = Math.max(previewDocument.documentElement.scrollHeight, previewDocument.body?.scrollHeight || 0);
    const targetX = Math.max(0, Math.min(documentWidth - width, goalX - width * 0.5));
    const targetY = Math.max(0, Math.min(documentHeight - height, goalY - height * 0.5));
    previewWindow.scrollTo(targetX, targetY);
    requestAnimationFrame(() => {
      if (missionPreviewPhoto !== photo) return;
      photo.marker.style.left = `${Math.max(13, Math.min(width - 13, goalX - previewWindow.scrollX)) * photo.scale}px`;
      photo.marker.style.top = `${Math.max(18, Math.min(height - 13, goalY - previewWindow.scrollY)) * photo.scale}px`;
      photo.root.classList.add("is-loaded");
      mission.previewPhotoLoadedAt = performance.now() / 1000;
      mission.previewRenderedImages = [...previewDocument.images]
        .filter((image) => image.complete && image.naturalWidth > 0).length;
      startMissionPreviewCountdown();
    });
  }

  function showMissionPreviewPhoto({ pageUrl = location.href, goalX, goalY } = {}) {
    clearMissionPreviewPhoto();
    if (!Number.isFinite(goalX + goalY)) return;

    const root = document.createElement("div");
    root.className = "eimei-goal-photo";
    root.dataset.eimeiGame = "goal-photo";
    root.setAttribute("aria-hidden", "true");
    const mount = document.createElement("div");
    mount.className = "eimei-goal-photo-mount";
    const iframe = document.createElement("iframe");
    iframe.className = "eimei-goal-photo-frame";
    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
    const marker = document.createElement("span");
    marker.className = "eimei-goal-photo-marker";
    const caption = document.createElement("p");
    caption.className = "eimei-goal-photo-caption";
    caption.textContent = "次の目的地";
    mount.append(iframe, marker);
    root.append(mount, caption);
    document.documentElement.append(root);
    const availableWidth = Math.min(1080, window.innerWidth * 0.82);
    const availableHeight = Math.min(540, window.innerHeight * 0.58);
    const photoScale = Math.min(availableWidth / state.viewportWidth, availableHeight / state.viewportHeight);
    mount.style.width = `${state.viewportWidth * photoScale + 26}px`;
    mount.style.height = `${state.viewportHeight * photoScale + 26}px`;
    iframe.style.width = `${state.viewportWidth}px`;
    iframe.style.height = `${state.viewportHeight}px`;
    iframe.style.transform = `scale(${photoScale})`;
    missionPreviewPhoto = { root, iframe, marker, caption, scale: photoScale, goalX, goalY };

    const previewUrl = new URL(pageUrl, location.href);
    for (const key of [...previewUrl.searchParams.keys()]) {
      if (key.startsWith("eimei-")) previewUrl.searchParams.delete(key);
    }
    previewUrl.searchParams.set("eimei-preview", "1");
    previewUrl.hash = "";
    iframe.addEventListener("load", () => {
      if (missionPreviewPhoto?.iframe !== iframe) return;
      positionMissionPreviewPhoto();
      window.setTimeout(positionMissionPreviewPhoto, 160);
      window.setTimeout(positionMissionPreviewPhoto, 520);
    }, { once: true });
    iframe.src = previewUrl.href;
  }

  function syncMissionPreviewPhoto(nowSeconds) {
    if (!missionPreviewPhoto) return;
    if (!missionPreviewActive(nowSeconds)) {
      clearMissionPreviewPhoto();
      return;
    }
    const duration = Math.max(0.01, mission.previewUntil - mission.previewStartedAt);
    const progress = Math.max(0, Math.min(1, (nowSeconds - mission.previewStartedAt) / duration));
    const opacity = Math.min(1, progress / 0.1, (1 - progress) / 0.16);
    missionPreviewPhoto.root.style.opacity = String(Math.max(0, opacity));
  }

  function drawMissionPreview() {
    const nowSeconds = performance.now() / 1000;
    if (!missionPreviewActive(nowSeconds)) return;
    const progress = Math.max(0, Math.min(1, (nowSeconds - mission.previewStartedAt) / Math.max(0.01, mission.previewUntil - mission.previewStartedAt)));
    const fade = Math.min(1, progress / 0.12, (1 - progress) / 0.18);
    const inset = 17;
    const corner = 30;
    context.save();
    context.globalAlpha = Math.max(0, fade);
    context.shadowColor = "rgba(20, 15, 10, 0.38)";
    context.shadowBlur = 14;
    context.strokeStyle = "rgba(255, 252, 242, 0.98)";
    context.lineWidth = 13;
    context.strokeRect(inset, inset, state.viewportWidth - inset * 2, state.viewportHeight - inset * 2);
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(60, 50, 40, 0.5)";
    context.lineWidth = 1.4;
    context.strokeRect(inset + 7, inset + 7, state.viewportWidth - inset * 2 - 14, state.viewportHeight - inset * 2 - 14);
    context.strokeStyle = "rgba(255, 252, 242, 0.98)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(inset, inset + corner);
    context.lineTo(inset, inset);
    context.lineTo(inset + corner, inset);
    context.moveTo(state.viewportWidth - inset - corner, inset);
    context.lineTo(state.viewportWidth - inset, inset);
    context.lineTo(state.viewportWidth - inset, inset + corner);
    context.moveTo(inset, state.viewportHeight - inset - corner);
    context.lineTo(inset, state.viewportHeight - inset);
    context.lineTo(inset + corner, state.viewportHeight - inset);
    context.moveTo(state.viewportWidth - inset - corner, state.viewportHeight - inset);
    context.lineTo(state.viewportWidth - inset, state.viewportHeight - inset);
    context.lineTo(state.viewportWidth - inset, state.viewportHeight - inset - corner);
    context.stroke();
    context.fillStyle = `rgba(255, 252, 242, ${Math.max(0, 0.34 - progress * 1.8)})`;
    context.fillRect(0, 0, state.viewportWidth, state.viewportHeight);
    context.restore();
  }

  function updateCamera(nowSeconds = performance.now() / 1000) {
    const desiredX = Math.max(0, Math.min(state.documentWidth - window.innerWidth, player.x - window.innerWidth * 0.46));
    const desiredY = Math.max(0, Math.min(state.documentHeight - window.innerHeight, player.y - window.innerHeight * 0.5));
    let cameraX = desiredX;
    let cameraY = desiredY;
    if (missionPreviewActive(nowSeconds)) {
      const progress = Math.max(0, Math.min(1, (nowSeconds - mission.previewStartedAt) / Math.max(0.01, mission.previewUntil - mission.previewStartedAt)));
      const returnProgress = Math.max(0, (progress - 0.74) / 0.26);
      const easedReturn = returnProgress * returnProgress * (3 - 2 * returnProgress);
      cameraX = mission.previewScrollX + (desiredX - mission.previewScrollX) * easedReturn;
      cameraY = mission.previewScrollY + (desiredY - mission.previewScrollY) * easedReturn;
    }
    if (Math.abs(window.scrollX - cameraX) > 1 || Math.abs(window.scrollY - cameraY) > 1) {
      window.scrollTo(cameraX, cameraY);
    }
  }

  function render() {
    context.clearRect(0, 0, state.viewportWidth, state.viewportHeight);
    drawBodies(window.scrollX, window.scrollY);
    drawLadders(window.scrollX, window.scrollY);
    drawNavigation(window.scrollX, window.scrollY);
    drawAvailableHatch(window.scrollX, window.scrollY);
    drawIncomingRaceGrapples(window.scrollX, window.scrollY);
    drawWeb(window.scrollX, window.scrollY);
    drawWebHatch(window.scrollX, window.scrollY);
    drawDropHatch(window.scrollX, window.scrollY);
    drawLadderPassage(window.scrollX, window.scrollY);
    drawPortal(window.scrollX, window.scrollY);
    drawPlayer(window.scrollX, window.scrollY);
    drawScoreHud();
    drawGoalCelebration();
    drawMissionPreview();
  }

  function frame(time) {
    const frameSeconds = Math.min(CONFIG.maxFrameSeconds, Math.max(0, (time - state.lastTime) / 1000));
    const frameMilliseconds = Math.max(0, time - state.lastTime);
    state.lastTime = time;
    state.accumulator += frameSeconds;

    updateScoreAttackState(frameSeconds, time / 1000);
    const previewActive = missionPreviewActive(time / 1000);
    if (
      !previewActive &&
      mission.previewGuidePending &&
      mission.scoreAttack &&
      !mission.scoreFinished &&
      !mission.completed
    ) {
      mission.previewGuidePending = false;
      if (mission.goalBody && mission.goalPoint) setKeypointGuide({ launchFromPlayer: true });
    }
    if (previewActive) {
      state.accumulator = 0;
    } else {
      while (state.accumulator >= CONFIG.physicsStepSeconds) {
        updatePhysics(CONFIG.physicsStepSeconds, time / 1000);
        state.accumulator -= CONFIG.physicsStepSeconds;
      }
    }

    const renderInterval = CONFIG.renderStepSeconds * 1000;
    if (!Number.isFinite(state.lastRenderAt) || time - state.lastRenderAt >= renderInterval - 0.5) {
      state.lastRenderAt = time;
      syncMissionPreviewPhoto(time / 1000);
      updateCamera(time / 1000);
      const renderStartedAt = performance.now();
      render();
      const renderMilliseconds = performance.now() - renderStartedAt;
      if (!previewActive && frameMilliseconds > 0 && frameMilliseconds < 100) {
        const metrics = state.performance;
        const weight = metrics.samples < 30 ? 0.12 : 0.035;
        metrics.averageFrameMs += (frameMilliseconds - metrics.averageFrameMs) * weight;
        metrics.averageRenderMs += (renderMilliseconds - metrics.averageRenderMs) * weight;
        metrics.samples += 1;
        if (metrics.samples >= 90 && metrics.samples % 30 === 0) {
          if (metrics.averageRenderMs > 8) {
            state.particleDensity = Math.min(state.particleDensity, 0.24);
            metrics.quality = "performance";
          } else if (metrics.averageRenderMs > 5) {
            state.particleDensity = Math.min(state.particleDensity, 0.32);
            if (metrics.quality === "standard") metrics.quality = "balanced";
          }
        }
      }
    }
    requestAnimationFrame(frame);
  }

  function isEditableTarget(target) {
    return target instanceof HTMLElement && (target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  }

  function onKey(event, pressed) {
    if (isEditableTarget(event.target)) return;
    if (event.code === "KeyR") {
      if (pressed && !event.repeat) resetGame();
      event.preventDefault();
      return;
    }
    if (race.active && (race.frozen || race.finished || race.finishPending)) {
      event.preventDefault();
      return;
    }
    if (goalCelebrationActive()) {
      event.preventDefault();
      return;
    }
    if (missionPreviewActive()) {
      event.preventDefault();
      return;
    }
    let handled = true;
    switch (event.code) {
      case "ArrowLeft":
      case "KeyA":
        input.left = pressed;
        if (tutorial.active && pressed) tutorial.actions.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        input.right = pressed;
        if (tutorial.active && pressed) tutorial.actions.right = true;
        break;
      case "Space":
        input.space = pressed;
        input.jump = pressed;
        if (pressed && !event.repeat) input.jumpPressedAt = performance.now() / 1000;
        break;
      case "ArrowUp":
      case "KeyW":
        input.up = pressed;
        if (
          !web.active &&
          web.hatchPhase === "none" &&
          ladderTraversal.phase === "none" &&
          !ladderInReach()
        ) {
          input.jump = pressed;
          if (pressed && !event.repeat) input.jumpPressedAt = performance.now() / 1000;
        } else {
          input.jump = false;
          if (pressed) input.jumpPressedAt = -Infinity;
        }
        break;
      case "ArrowDown":
      case "KeyS":
        input.down = pressed;
        if (pressed && !event.repeat) {
          input.downPressedAt = performance.now() / 1000;
          beginPortalEntry(interaction.portal, input.downPressedAt);
        }
        break;
      case "ShiftLeft":
      case "ShiftRight":
      case "KeyX":
        input.web = pressed;
        if (pressed && !event.repeat) attachWeb();
        if (!pressed) detachWeb({ releaseBoost: true });
        break;
      case "F2":
        if (pressed && !event.repeat) state.debug = !state.debug;
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }

  function scheduleRebuild({ hoverOnly = false } = {}) {
    state.needsRebuild = true;
    if (!hoverOnly) state.rebuildFull = true;
    window.clearTimeout(state.rebuildTimer);
    state.rebuildTimer = window.setTimeout(() => {
      if (interaction.portal?.entering) return;
      if (
        web.hatchPhase !== "none" ||
        web.mantlePhase !== "none" ||
        dropHatch.phase !== "none" ||
        ladderTraversal.phase !== "none"
      ) {
        scheduleRebuild({ hoverOnly: !state.rebuildFull });
        return;
      }
      const rebuildFull = state.rebuildFull;
      state.rebuildFull = false;
      if (rebuildFull) buildCollisionMap({ preservePlayer: true });
      else rebuildHoverCollisionMap();
    }, 180);
  }

  window.addEventListener("keydown", (event) => onKey(event, true), { passive: false });
  window.addEventListener("keyup", (event) => onKey(event, false), { passive: false });
  window.addEventListener("resize", () => {
    resizeCanvas();
    scheduleRebuild();
  });

  let observedBodyWidth = document.body.scrollWidth;
  let observedBodyHeight = document.body.scrollHeight;
  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = document.body.scrollWidth;
    const nextHeight = document.body.scrollHeight;
    if (Math.abs(nextWidth - observedBodyWidth) < 1 && Math.abs(nextHeight - observedBodyHeight) < 1) return;
    observedBodyWidth = nextWidth;
    observedBodyHeight = nextHeight;
    scheduleRebuild({ hoverOnly: performance.now() < state.hoverLayoutChangingUntil });
  });
  resizeObserver.observe(document.body);

  window.EimeiMap = {
    active: true,
    config: CONFIG,
    state,
    player,
    input,
    interaction,
    web,
    dropHatch,
    ladderTraversal,
    mission,
    tutorial,
    race,
    resetGame,
    setTutorialStep,
    completeTutorialStep,
    tutorialRequirementMet,
    startNextScoreRound,
    collectScoreFlag,
    scoreTick: updateScoreAttackState,
    rebuild: () => buildCollisionMap({ preservePlayer: true }),
    respawn,
    navigationTick: updateNavigation,
    navigationEdgeIsPhysical: bodiesHaveNavigationEdge,
    normalNavigationEdgeIsPhysical: bodiesHaveNormalNavigationEdge,
    navigationEdgeDiagnostics,
    portalBodyForAnchor,
    portalTarget,
    refreshHatchCandidate,
    configureRaceRound,
    setRaceNavigationEnabled,
    setRaceFrozen,
    setPlayerPalette,
    setRaceRemotePlayer,
    removeRaceRemotePlayer,
    applyRaceGrapple,
    startPageCandidateKeys: () => startPageCandidates().map((candidate) => candidate.key),
    spawnCandidateCount: () => navigationBodies().filter((body) =>
      body.width >= Math.max(70, player.width * 3)
    ).length,
    normalRouteForCurrent() {
      const support = player.navigationBody || supportingMapBody();
      return support && mission.goalBody ? normalRouteFromTo(support, mission.goalBody) : [];
    },
    webMantleExit,
    setDebug(value) {
      state.debug = Boolean(value);
    }
  };

  async function start() {
    // The public entrance is the tutorial. Redirect as soon as the deferred
    // script runs instead of downloading every image on the mirrored home page
    // only to leave it immediately.
    if (redirectToTutorialStart()) return;
    if ((isPlanningDocument || isRaceDocument) && document.readyState === "loading") {
      await new Promise((resolve) => window.addEventListener("DOMContentLoaded", resolve, { once: true }));
    } else if (!isPlanningDocument && document.readyState !== "complete") {
      await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
    }
    if (!isTutorialDocument && redirectToRandomStartPage()) return;
    prepareWorld();
    if (!isPlanningDocument) {
      installPlayerHoverRules();
      resizeCanvas();
    }
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    buildCollisionMap({ preservePlayer: false });
    if (isPlanningDocument || isCatalogDocument) return;
    state.lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  start();
})();
