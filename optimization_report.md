# Performance Optimization Report

## Identified Issues
1.  **Excessive Re-renders:** The main application components (`App`, `HomePage`, `DataSidebar`, `FilePreviewPanel`) were subscribing to the entire Zustand store. This meant that *any* state change (e.g., a background file scan update, a search query change, or even a loading spinner toggle) caused all these components to re-render, leading to a sluggish UI.
2.  **Unnecessary Parent Re-renders:** `HomePage` re-rendering caused `FilePreviewPanel` to re-render even if the previewed file hadn't changed.

## Actions Taken
1.  **Implemented Shallow Selectors:** Refactored `useAppStore` hooks in `App.tsx`, `HomePage.tsx`, `DataSidebar.tsx`, and `FilePreviewPanel.tsx` to use `useShallow` from `zustand/react/shallow`. This ensures components only re-render when the specific slice of state they depend on changes.
2.  **Memoized Components:** Wrapped `FilePreviewPanel` in `React.memo` to prevent re-renders triggered solely by parent updates when props remain unchanged.
3.  **Code Cleanup:** 
    - Removed unused variables and imports in `FilePreviewPanel.tsx` and `HomePage.tsx`.
    - Removed debug `console.log` statements from `HomePage.tsx` to reduce noise.

## Verification
- Validated that `FilePreviewPanel` only updates when relevant data (file content, privacy rules, active tab) changes.
- Validated that `HomePage` list filtering and sorting logic is isolated from unrelated state updates.
- Corrected syntax errors introduced during refactoring (missing closing brackets, import order).

The application should now feel significantly more responsive, especially during background operations or when interacting with the sidebar.
