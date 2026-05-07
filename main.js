const STREAMPixel_ORIGIN = "https://share.streampixel.io";
const streamIframe = document.getElementById("streamIframe");
const playerShell = document.getElementById("playerShell");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const navbar = document.getElementById("navbar");
const footer = document.getElementById("footer");
const MOBILE_VALUE = "Mobile";
const BURST_DELAYS_MS = [0, 1000, 5000, 30000];
const scheduledBursts = new Set();
const IOS_PSEUDO_FULLSCREEN_CLASS = "ios-pseudo-fullscreen";
let lastFullscreenToggleAt = 0;

function isMobileDevice() {
	const ua = navigator.userAgent || navigator.vendor || window.opera || "";
	const hasTouch = navigator.maxTouchPoints > 0;
	const narrowScreen = window.matchMedia("(max-width: 1000px)").matches;
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (hasTouch && narrowScreen);
}

function isIOSDevice() {
	const ua = navigator.userAgent || navigator.vendor || window.opera || "";
	const platform = navigator.platform || "";
	const isAppleMobileUA = /iPad|iPhone|iPod/i.test(ua);
	const isTouchMac = platform === "MacIntel" && navigator.maxTouchPoints > 1;
	return isAppleMobileUA || isTouchMac;
}

function prefersPseudoFullscreen() {
	return isIOSDevice();
}

function hideNavbar() {
	if (navbar) navbar.style.display = "none";
}

function postPayloadToStream(payload) {
	if (!streamIframe || !streamIframe.contentWindow) {
		console.warn("[Stream] iframe or contentWindow not available.");
		return false;
	}

	streamIframe.contentWindow.postMessage(payload, STREAMPixel_ORIGIN);
	console.log("[Stream] Sent payload:", payload);
	return true;
}

function sendMobileMarker() {
	return postPayloadToStream({
		message: "clipboardPaste",
		value: MOBILE_VALUE,
	});
}

function sendClipboardToStream(text) {
	if (!text) return false;
	return postPayloadToStream({
		message: "clipboardPaste",
		value: text,
	});
}

function scheduleMobileBurst(triggerName) {
	if (!isMobileDevice()) return;
	if (scheduledBursts.has(triggerName)) return;
	scheduledBursts.add(triggerName);

	console.log(`[Mobile] Scheduling burst from ${triggerName}`);
	BURST_DELAYS_MS.forEach((delayMs) => {
		window.setTimeout(() => {
			console.log(`[Mobile] Sending ${MOBILE_VALUE} after ${delayMs}ms from ${triggerName}`);
			sendMobileMarker();
		}, delayMs);
	});
}

function getActiveFullscreenElement() {
	return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function isPseudoFullscreenActive() {
	return document.documentElement.classList.contains(IOS_PSEUDO_FULLSCREEN_CLASS);
}

function isFullscreenActive() {
	return !!getActiveFullscreenElement() || isPseudoFullscreenActive();
}

function updateFullscreenButtonLabel() {
	if (!fullscreenBtn) return;
	fullscreenBtn.textContent = isFullscreenActive() ? "Exit Fullscreen" : "Fullscreen";
}

function focusStreamAfterTransition(delayMs = 120) {
	window.setTimeout(() => {
		if (streamIframe) {
			streamIframe.focus();
			console.log("[Fullscreen] Refocused stream iframe.");
		}
	}, delayMs);
}

function syncPseudoFullscreenViewport() {
	if (!isPseudoFullscreenActive() || !playerShell) return;
	const viewport = window.visualViewport;
	const width = viewport ? viewport.width : window.innerWidth;
	const height = viewport ? viewport.height : window.innerHeight;
	playerShell.style.width = `${Math.round(width)}px`;
	playerShell.style.height = `${Math.round(height)}px`;
}

function enterPseudoFullscreen() {
	document.documentElement.classList.add(IOS_PSEUDO_FULLSCREEN_CLASS);
	document.body.classList.add(IOS_PSEUDO_FULLSCREEN_CLASS);
	if (navbar) navbar.setAttribute("aria-hidden", "true");
	if (footer) footer.setAttribute("aria-hidden", "true");
	syncPseudoFullscreenViewport();
	window.scrollTo(0, 0);
	console.log("[Fullscreen] Entered iOS pseudo fullscreen.");
}

function exitPseudoFullscreen() {
	document.documentElement.classList.remove(IOS_PSEUDO_FULLSCREEN_CLASS);
	document.body.classList.remove(IOS_PSEUDO_FULLSCREEN_CLASS);
	if (navbar) navbar.removeAttribute("aria-hidden");
	if (footer) footer.removeAttribute("aria-hidden");
	if (playerShell) {
		playerShell.style.removeProperty("width");
		playerShell.style.removeProperty("height");
	}
	console.log("[Fullscreen] Exited iOS pseudo fullscreen.");
}

async function enterNativeFullscreen() {
	if (!playerShell) return;

	if (playerShell.requestFullscreen) {
		await playerShell.requestFullscreen({ navigationUI: "hide" });
		return;
	}

	if (playerShell.webkitRequestFullscreen) {
		playerShell.webkitRequestFullscreen();
		return;
	}

	throw new Error("Fullscreen API not available for this element.");
}

async function exitNativeFullscreen() {
	if (document.exitFullscreen) {
		await document.exitFullscreen();
		return;
	}

	if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
		return;
	}

	throw new Error("Exit fullscreen API not available.");
}

async function toggleFullscreen(event) {
	if (event) {
		event.preventDefault();
		event.stopPropagation();
	}

	const now = Date.now();
	if (now - lastFullscreenToggleAt < 700) {
		console.log("[Fullscreen] Ignored duplicate toggle event.");
		return;
	}
	lastFullscreenToggleAt = now;

	if (!playerShell) {
		console.warn("[Fullscreen] playerShell not found.");
		return;
	}

	try {
		if (prefersPseudoFullscreen()) {
			if (isPseudoFullscreenActive()) {
				exitPseudoFullscreen();
			} else {
				enterPseudoFullscreen();
			}
		} else if (!getActiveFullscreenElement()) {
			console.log("[Fullscreen] Entering native fullscreen.");
			await enterNativeFullscreen();
		} else {
			console.log("[Fullscreen] Exiting native fullscreen.");
			await exitNativeFullscreen();
		}

		updateFullscreenButtonLabel();
		focusStreamAfterTransition();
		scheduleMobileBurst("fullscreen-toggle");
	} catch (err) {
		console.warn("[Fullscreen] Native fullscreen failed, using pseudo fallback:", err);
		if (isPseudoFullscreenActive()) {
			exitPseudoFullscreen();
		} else {
			enterPseudoFullscreen();
		}
		updateFullscreenButtonLabel();
		focusStreamAfterTransition();
		scheduleMobileBurst("fullscreen-toggle-fallback");
	}
}

async function handlePasteButtonClick() {
	console.log("[Clipboard] Paste button clicked.");
	try {
		if (!navigator.clipboard || !navigator.clipboard.readText) {
			alert("Clipboard API not available in this browser.");
			return;
		}
		const text = await navigator.clipboard.readText();
		if (!text) {
			alert("Clipboard is empty.");
			return;
		}
		sendClipboardToStream(text);
		if (streamIframe) streamIframe.focus();
	} catch (err) {
		console.warn("[Clipboard] Failed to read clipboard:", err);
		alert("Clipboard access was blocked. Please allow clipboard permissions in your browser.");
	}
}

window.addEventListener("paste", (event) => {
	const text = event.clipboardData?.getData("text") || "";
	if (!text) return;
	event.preventDefault();
	sendClipboardToStream(text);
});

window.addEventListener("keydown", (event) => {
	const isMac = navigator.platform.toUpperCase().includes("MAC");
	const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
	if (!cmdOrCtrl || event.key.toLowerCase() !== "v") return;
	if (!navigator.clipboard || !navigator.clipboard.readText) return;

	navigator.clipboard.readText().then((text) => {
		if (text) sendClipboardToStream(text);
	}).catch((err) => {
		console.warn("[Clipboard] Failed to read via navigator.clipboard:", err);
	});
});

window.addEventListener("message", (event) => {
	if (event.origin !== STREAMPixel_ORIGIN) return;
	const data = event.data;
	const isSmallScreen = window.matchMedia("(width <= 1000px)").matches;

	if (data && typeof data === "object" && data.type === "stream-state") {
		console.log("[Stream] State:", data.value);
		if (data.value === "loadingComplete") {
			if (isSmallScreen && !isPseudoFullscreenActive()) hideNavbar();
			scheduleMobileBurst("loadingComplete");
		}
	}
});

window.addEventListener("fullscreenchange", () => {
	console.log("[Fullscreen] fullscreenchange:", getActiveFullscreenElement());
	updateFullscreenButtonLabel();
	focusStreamAfterTransition();
	scheduleMobileBurst("fullscreenchange");
});

window.addEventListener("webkitfullscreenchange", () => {
	console.log("[Fullscreen] webkitfullscreenchange:", getActiveFullscreenElement());
	updateFullscreenButtonLabel();
	focusStreamAfterTransition();
	scheduleMobileBurst("webkitfullscreenchange");
});

window.addEventListener("resize", syncPseudoFullscreenViewport);
window.visualViewport?.addEventListener("resize", syncPseudoFullscreenViewport);
window.visualViewport?.addEventListener("scroll", syncPseudoFullscreenViewport);
window.addEventListener("orientationchange", () => {
	syncPseudoFullscreenViewport();
	focusStreamAfterTransition(250);
});

if (streamIframe) {
	streamIframe.addEventListener("load", () => {
		console.log("[Stream] iframe load event fired.");
		scheduleMobileBurst("iframe-load");
	});
}

if (fullscreenBtn) {
	fullscreenBtn.addEventListener("click", toggleFullscreen);
	fullscreenBtn.addEventListener("touchstart", toggleFullscreen, { passive: false });
	fullscreenBtn.addEventListener("pointerdown", toggleFullscreen, { passive: false });
}

document.addEventListener("click", () => {
	scheduleMobileBurst("first-click");
}, { once: true });

document.addEventListener("touchstart", () => {
	scheduleMobileBurst("first-touch");
}, { once: true, passive: true });

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && isPseudoFullscreenActive()) {
		exitPseudoFullscreen();
		updateFullscreenButtonLabel();
	}
});

document.addEventListener("DOMContentLoaded", () => {
	const btn = document.getElementById("pasteClipboardBtn");
	if (btn) {
		btn.addEventListener("click", handlePasteButtonClick);
		console.log("[Clipboard] Paste button wired.");
	}
	updateFullscreenButtonLabel();
	if (isMobileDevice()) {
		console.log("[Mobile] Mobile device detected.");
		scheduleMobileBurst("dom-ready");
	}
	if (prefersPseudoFullscreen()) {
		console.log("[Fullscreen] iOS detected: using pseudo fullscreen fallback.");
	}
});
