function syncHandler(fn, fallbackValue = null) {
    return function (...args) {
        try {
            return fn.apply(this, args);
        } catch (err) {
            console.error("❌ Caught error:", err.message);
            return fallbackValue; // return fallback if needed
        }
    };
}

export {syncHandler}