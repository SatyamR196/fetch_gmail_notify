// This function is a generic error handler for both synchronous and asynchronous functions.
// It catches errors and logs them to the console, while also preserving the context (`this`) 
// and arguments of the original function.See bottom page for a table of features.
function errorHandler(fn) {
    return function (...args) {
        try {
            const result = fn.apply(this, args);
            if (result instanceof Promise) {
                return result.catch((err) => {
                    console.error("Async Error:", err);
                });
            }
            return result;
        } catch (err) {
            console.error("Error:", err);
        }
    };
}

export {errorHandler}

// Feature | Handles it? | How?
// Sync errors | ✅ | try/catch
// Async errors | ✅ | .catch() on the returned promise
// Preserves this | ✅ | .apply(this, args)
// Flexible args | ✅ | ...args (rest parameter)
// Clean logging | ✅ | console.error(...)
