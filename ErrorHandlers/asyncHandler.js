function asyncHandler(fn) {
    return async function (...args) {
        try {
            return await fn.apply(this, args);
        } catch (err) {
            console.error("Caught error:", err);
        }
    };
}

export {asyncHandler}
