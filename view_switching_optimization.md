# Performance Optimization Report: View Switching

## Identified Issue
Switching from "Export" (DataPage) back to "Quellen" (HomePage) was slow ("recht lang").

## Root Cause Analysis
1.  **Synchronous Heavy Calculation on Mount:** `HomePage` was performing expensive filtering and sorting of the entire file list immediately upon mounting. This blocked the main thread, delaying the initial paint.
2.  **Inefficient Sorting:** The sorting logic created new `Date` objects for every comparison (`O(N log N)`), causing massive object allocation and garbage collection overhead.
3.  **Unnecessary Store Updates:** The component was dispatching `setFilteredFilesCount` in a `useEffect` loop, updating the global store. This value was never read by any component, making the update purely wasteful.

## Actions Taken
1.  **Deferred Rendering:** Implemented a "mount deferred" pattern using `requestAnimationFrame`. The component now mounts immediately with an empty/loading state, allowing the browser to paint the UI instantly. The heavy file list processing happens in the next frame.
2.  **Optimized Sorting:** Replaced `new Date().getTime()` comparisons with direct string comparisons for `updatedAt`. This eliminates thousands of object allocations per sort, significantly speeding up the process.
3.  **Removed Dead Code:** Removed the `setFilteredFilesCount` call and its associated effect, eliminating unnecessary global state updates.

## Verification
-   `HomePage` logic is now non-blocking on mount.
-   Sorting is O(1) memory allocation instead of O(N).
-   No regression in functionality (filtering and sorting still work).

The "Quellen" view should now appear almost instantly, with the file list populating a split second later.
