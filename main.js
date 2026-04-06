const STREAMPixel_ORIGIN = "https://share.streampixel.io";
const streamIframe = document.getElementById("streamIframe");

let mobileMessageSent = false;
let mobileRetryTimeouts = [];

function isMobileDevice() {
	const ua = navigator.userAgent || navigator.vendor || window.opera || "";
	const hasTouch = navigator.maxTouchPoints > 0;
	const narrowScreen = window.matchMedia("(max-width: 1000px)").matches;

	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (hasTouch && narrowScreen);
}

function closePopup() {
	const popup = document.getElementById("popup");
	if (popup) {
		popup.style.display = "none";
	}
	console.log("[UI] Popup closed.");
	if (streamIframe) {
		streamIframe.focus();
	}
}

function hideNavbar() {
	const navbar = document.getElementById("navbar");
	if (navbar) {
		navbar.style.display = "none";
	}
}

function postJsonStringToStream(payload) {
	if (!streamIframe || !streamIframe.contentWindow) {
		console.warn("[Stream] iframe or contentWindow not available.");
		return false;
	}

	const jsonString = JSON.stringify(payload);
	streamIframe.contentWindow.postMessage(jsonString, STREAMPixel_ORIGIN);
	console.log("[Stream] Sent JSON string:", jsonString);
	return true;
}

function sendClipboardToStream(text) {
	if (!text) {
		return false;
	}

	return postJsonStringToStream({
		message: "clipboardPaste",
		value: text,
	});
}

function sendMobileMarker() {
	if (!isMobileDevice()) {
		return false;
	}

	const sent = sendClipboardToStream("Mobile");
	if (sent) {
		mobileMessageSent = true;
	}
	return sent;
}

function clearMobileRetries() {
	mobileRetryTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
	mobileRetryTimeouts = [];
}

function queueMobileMarkerRetries(reason) {
	if (!isMobileDevice() || mobileMessageSent) {
		return;
	}

	clearMobileRetries();
	console.log(`[Mobile] Queueing automatic Mobile message retries (${reason}).`);

	const retryDelaysMs = [0, 1200, 3000, 6000, 10000, 15000];

	retryDelaysMs.forEach((delay) => {
		const timeoutId = window.setTimeout(() => {
			if (!mobileMessageSent) {
				sendMobileMarker();
			}
		}, delay);

		mobileRetryTimeouts.push(timeoutId);
	});
}

async function handlePasteButtonClick() {
	console.log("[Clipboard] Paste button clicked.");
	try {
		if (!navigator.clipboard || !navigator.clipboard.readText) {
			alert("Clipboard API not available in this browser.");
			console.warn("[Clipboard] navigator.clipboard.readText not available.");
			return;
		}

		const text = await navigator.clipboard.readText();
		if (!text) {
			console.log("[Clipboard] Clipboard is empty.");
			return;
		}

		sendClipboardToStream(text);
		if (streamIframe) {
			streamIframe.focus();
		}
	} catch (err) {
		console.warn("[Clipboard] Failed to read clipboard:", err);
		alert("Clipboard access was blocked. Please allow clipboard permissions in your browser.");
	}
}

window.addEventListener("paste", (event) => {
	const text = event.clipboardData?.getData("text") || "";
	if (!text) {
		return;
	}

	event.preventDefault();
	sendClipboardToStream(text);
});

window.addEventListener("keydown", (event) => {
	const isMac = navigator.platform.toUpperCase().includes("MAC");
	const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

	if (!cmdOrCtrl || event.key.toLowerCase() !== "v") {
		return;
	}

	if (!streamIframe) {
		return;
	}

	if (navigator.clipboard && navigator.clipboard.readText) {
		navigator.clipboard
			.readText()
			.then((text) => {
				if (!text) {
					return;
				}
				sendClipboardToStream(text);
			})
			.catch((err) => {
				console.warn("[Clipboard] Failed to read via navigator.clipboard:", err);
			});
	}
});

window.addEventListener("message", (event) => {
	if (event.origin !== STREAMPixel_ORIGIN) {
		return;
	}

	const data = event.data;
	const isSmallScreen = window.matchMedia("(width <= 1000px)").matches;

	if (data && typeof data === "object" && data.type === "stream-state") {
		console.log("[Stream] State:", data.value);

		if (data.value === "loadingComplete") {
			if (isSmallScreen) {
				hideNavbar();
			}
			queueMobileMarkerRetries("loadingComplete");
		}
	}
});

if (streamIframe) {
	streamIframe.addEventListener("load", () => {
		console.log("[Stream] iframe load event fired.");
		queueMobileMarkerRetries("iframe-load");
	});
}

function handleFirstInteraction() {
	queueMobileMarkerRetries("first-interaction");
}

document.addEventListener("click", handleFirstInteraction, { once: true });
document.addEventListener("touchstart", handleFirstInteraction, { once: true, passive: true });

document.addEventListener("DOMContentLoaded", () => {
	const btn = document.getElementById("pasteClipboardBtn");
	if (btn) {
		btn.addEventListener("click", handlePasteButtonClick);
		console.log("[Clipboard] Paste button wired.");
	} else {
		console.warn("[Clipboard] pasteClipboardBtn not found.");
	}

	if (isMobileDevice()) {
		console.log("[Mobile] Mobile device detected.");
		queueMobileMarkerRetries("dom-ready");
	}
});
