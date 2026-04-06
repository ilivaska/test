const STREAMPixel_ORIGIN = "https://share.streampixel.io";
const streamIframe = document.getElementById("streamIframe");

let streamIsReady = false;
let mobileMessageSent = false;
let mobileRetryTimeouts = [];

function isMobileDevice() {
	const ua = navigator.userAgent || navigator.vendor || window.opera || "";
	const hasTouch = navigator.maxTouchPoints > 0;
	const narrowScreen = window.matchMedia("(max-width: 1000px)").matches;

	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (hasTouch && narrowScreen);
}

/**
 * Close the info popup and return focus to the stream iframe.
 */
function closePopup() {
	const popup = document.getElementById("popup");
	if (popup) {
		popup.style.display = "none";
	}
	console.log("Popup closed.");
	if (streamIframe) {
		streamIframe.focus();
	}
}

/**
 * Hide the navbar – used on mobile once the stream is ready.
 */
function hideNavbar() {
	const navbar = document.getElementById("navbar");
	if (navbar) {
		navbar.style.display = "none";
	}
}

/**
 * Generic helper to send a message to the Streampixel iframe.
 * The payload is sent as a JSON string, per the request.
 */
function postJsonStringToStream(payload) {
	if (!streamIframe || !streamIframe.contentWindow) {
		console.warn("[Stream] iframe or contentWindow not available.");
		return false;
	}

	const jsonString = JSON.stringify(payload);
	streamIframe.contentWindow.postMessage(jsonString, STREAMPixel_ORIGIN);
	console.log("[Stream] Sent JSON string to stream:", jsonString);
	return true;
}

/**
 * Send the mobile-device marker to Unreal.
 * Payload shape: { message: "deviceType", value: "Mobile" }
 */
function sendMobileDeviceMessage() {
	if (!isMobileDevice()) {
		return false;
	}

	const sent = postJsonStringToStream({
		message: "deviceType",
		value: "Mobile",
	});

	if (sent) {
		mobileMessageSent = true;
	}

	return sent;
}

/**
 * The cloud VM / Unreal app can take a bit longer even after the player reports ready.
 * So after `loadingComplete`, retry a few times to reduce the chance of missing the app startup window.
 */
/*function queueMobileReadyMessage() {
	if (!isMobileDevice() || mobileMessageSent) {
		return;
	}

	mobileRetryTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
	mobileRetryTimeouts = [];

	const retryDelaysMs = [0, 1500, 4000];

	retryDelaysMs.forEach((delay) => {
		const timeoutId = window.setTimeout(() => {
			if (!mobileMessageSent) {
				sendMobileDeviceMessage();
			}
		}, delay);

		mobileRetryTimeouts.push(timeoutId);
	});
}*/

/**
 * Send clipboard text to the Streampixel iframe.
 * Payload shape: { message: 'clipboardPaste', value: '<pasted text>' }
 */
function sendClipboardToStream(text) {
	if (!text) {
		return;
	}

	postJsonStringToStream({
		message: "clipboardPaste",
		value: text,
	});
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
			streamIsReady = true;

			if (isSmallScreen) {
				hideNavbar();
			}

			queueMobileReadyMessage();
		}
	}
});

/**
 * Extra fallback: on the first user interaction after the stream is ready,
 * try once more in case Unreal finished initializing slightly after loadingComplete.
 */

