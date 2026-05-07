const STREAMPixel_ORIGIN = "https://share.streampixel.io";
const streamIframe = document.getElementById("streamIframe");
const MOBILE_VALUE = "Mobile";
const BURST_DELAYS_MS = [0, 1000, 5000, 30000];
const scheduledBursts = new Set();

function isMobileDevice() {
	const ua = navigator.userAgent || navigator.vendor || window.opera || "";
	const hasTouch = navigator.maxTouchPoints > 0;
	const narrowScreen = window.matchMedia("(max-width: 1000px)").matches;
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (hasTouch && narrowScreen);
}

function hideNavbar() {
	const navbar = document.getElementById("navbar");
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
			if (isSmallScreen) hideNavbar();
			scheduleMobileBurst("loadingComplete");
		}
	}
});

if (streamIframe) {
	streamIframe.addEventListener("load", () => {
		console.log("[Stream] iframe load event fired.");
		scheduleMobileBurst("iframe-load");
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
	if (isMobileDevice()) {
		console.log("[Mobile] Mobile device detected.");
		scheduleMobileBurst("dom-ready");
	}
});


document.addEventListener("touchstart", function () {
    if (streamIframe) { streamIframe.focus(); }
}, { passive: false });

document.body.addEventListener('touchmove', function(e) {
    if (e.target.id === "streamIframe") { e.preventDefault(); }
}, { passive: false });
