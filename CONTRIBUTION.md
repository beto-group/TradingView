# 🛠️ Contributing to Trading View (main)

Welcome! This document outlines the core developer standards, unit testing frameworks, and compilation guidelines required to maintain the advanced implementation of the Trading View.

---

## 🏛️ Core Architecture Pillars

1.  **Full-Pane DOM Interception**:
    *   The view targets the nearest `.workspace-leaf-content` ancestor and replaces standard Markdown leaves with a full-pane portal overlay.
    *   Dynamic lifecycle hooks (`useFullTab`) manage mounting and cleanups edge-to-edge.
2.  **Anti-Bleed Style Isolation**:
    *   All styles must be scoped tightly under standard container class keys (`.trading-folder-view-container`) to avoid spilling into the Obsidian UI or interfering with active user themes.
3.  **Automated Unit Testing Framework**:
    *   This component features a built-in automated test suite (`vitest` / Preact testing library) run inside a custom interactive client test runner. All layout modifications must pass the test suites before shipping.
4.  **Sterile Zero-Dependency Flow**:
    *   The view must rely strictly on standard pre-loaded React hooks (`useState`, `useEffect`, `useRef`) provided by the `dc` host workspace compiler leaf. No external node_modules allowed.

---

## 🚀 Local Compilation & Test Runner Loop

*   **Hot Reload Trigger**: During development, use the reload action menu or press the reload button inside the UI panel to invoke `dc.app.workspace.activeLeaf.rebuildView()`. This automatically flushes Obsidian's internal module cache, loading your latest React changes instantly with zero system reboots.
