const STREAMPixel_ORIGIN = "https://share.streampixel.io";
const streamIframe = document.getElementById("streamIframe");
const navbar = document.getElementById("navbar");
const footer = document.getElementById("footer");
const MOBILE_VALUE = "Mobile";
const BURST_DELAYS_MS = [0, 1000, 5000, 30000];
const scheduledBursts = new Set();
const APP_MODE_CLASS = "app-mode";
const INSTALLABLE_CLASS = "installable-web-app";

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

function shouldUseStandaloneLayout() {
	const displayStandalone = window.matchMedia("(display-mode: standalone)").matches;
	const displayFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
	const legacyIOSStandalone = window.navigator.standalone === true;
	return displayStandalone || displayFullscreen || legacyIOSStandalone;
}

function applyAppModeLayout() {
	const appMode = shouldUseStandaloneLayout();
	document.documentElement.classList.toggle(APP_MODE_CLASS, appMode);
	document.body.classList.toggle(APP_MODE_CLASS, appMode);
	if (appMode) {
		if (navbar) navbar.setAttribute("aria-hidden", "true");
		if (footer) footer.setAttribute("aria-hidden", "true");
	} else {
		if (navbar) navbar.removeAttribute("aria-hidden");
		if (footer) footer.removeAttribute("aria-hidden");
	}
}

function markInstallableEnvironment() {
	const installable = isIOSDevice() || "BeforeInstallPromptEvent" in window || window.matchMedia("(display-mode: standalone)").matches;
	document.documentElement.classList.toggle(INSTALLABLE_CLASS, installable);
	document.body.classList.toggle(INSTALLABLE_CLASS, installable);
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

function focusStream(delayMs = 120) {
	window.setTimeout(() => {
		if (streamIframe) {
			streamIframe.focus();
			console.log("[Stream] Refocused stream iframe.");
		}
	}, delayMs);
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
			if (isSmallScreen && !shouldUseStandaloneLayout()) hideNavbar();
			scheduleMobileBurst("loadingComplete");
			focusStream();
		}
	}
});

window.addEventListener("resize", () => {
	applyAppModeLayout();
	focusStream(180);
});

window.addEventListener("orientationchange", () => {
	applyAppModeLayout();
	focusStream(250);
});

window.matchMedia("(display-mode: standalone)").addEventListener?.("change", applyAppModeLayout);
window.matchMedia("(display-mode: fullscreen)").addEventListener?.("change", applyAppModeLayout);

if (streamIframe) {
	streamIframe.addEventListener("load", () => {
		console.log("[Stream] iframe load event fired.");
		scheduleMobileBurst("iframe-load");
		focusStream();
	});
}

document.addEventListener("click", () => {
	scheduleMobileBurst("first-click");
}, { once: true });

document.addEventListener("touchstart", () => {
	scheduleMobileBurst("first-touch");
}, { once: true, passive: true });

document.addEventListener("DOMContentLoaded", () => {
	const btn = document.getElementById("pasteClipboardBtn");
	if (btn) {
		btn.addEventListener("click", handlePasteButtonClick);
		console.log("[Clipboard] Paste button wired.");
	}

	markInstallableEnvironment();
	applyAppModeLayout();

	if (isMobileDevice()) {
		console.log("[Mobile] Mobile device detected.");
		scheduleMobileBurst("dom-ready");
	}

	if (shouldUseStandaloneLayout()) {
		console.log("[AppMode] Running in installed web app mode.");
	}

	if (isIOSDevice()) {
		console.log("[Install] iOS detected: use Add to Home Screen and keep 'Open as Web App' enabled.");
	}
});
