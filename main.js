const STREAMPixel_ORIGIN = "https://share.streampixel.io";
const streamIframe = document.getElementById("streamIframe");

// 1. Clean, straightforward mobile detection
function isMobileDevice() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || "";
    const hasTouch = navigator.maxTouchPoints > 0;
    const narrowScreen = window.matchMedia("(max-width: 1000px)").matches;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (hasTouch && narrowScreen);
}

// 2. The core function to send the exact JSON your Blueprint expects
function sendMobilePayload() {
    if (!streamIframe || !streamIframe.contentWindow) return;

    // Based on your manual button working, this is the exact payload structure you need
    const payload = {
        message: "clipboardPaste",
        value: "Mobile"
    };

    const jsonString = JSON.stringify(payload);
    streamIframe.contentWindow.postMessage(jsonString, STREAMPixel_ORIGIN);
    console.log("[Stream] Fired Mobile payload:", jsonString);
}

// 3. Trigger Strategy A: Wait for the stream to officially announce it is ready
window.addEventListener("message", (event) => {
    if (event.origin !== STREAMPixel_ORIGIN) return;

    const data = event.data;

    if (data && data.type === "stream-state" && data.value === "loadingComplete") {
        console.log("[Stream] Stream loading complete detected.");
        
        // Hide navbar on small screens if you still want that
        if (window.matchMedia("(width <= 1000px)").matches) {
            const navbar = document.getElementById("navbar");
            if (navbar) navbar.style.display = "none";
        }

        if (isMobileDevice()) {
            console.log("[Mobile] Mobile detected. Firing payload sequence...");
            // Fire immediately
            sendMobilePayload();
            
            // Fire follow-ups to ensure the WebRTC data channel has settled
            setTimeout(sendMobilePayload, 1500);
            setTimeout(sendMobilePayload, 4000);
        }
    }
});

// 4. Trigger Strategy B: The First Interaction (bypasses mobile browser auto-play blocks)
document.addEventListener("touchstart", () => {
    if (isMobileDevice()) {
        console.log("[Mobile] First touch detected. Firing payload...");
        sendMobilePayload();
    }
}, { once: true, passive: true });


// 5. Keep your manual paste button working just in case
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("pasteClipboardBtn");
    if (btn) {
        btn.addEventListener("click", async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    streamIframe.contentWindow.postMessage(JSON.stringify({ message: "clipboardPaste", value: text }), STREAMPixel_ORIGIN);
                }
            } catch (err) {
                console.warn("Clipboard access denied.", err);
            }
        });
    }
});
