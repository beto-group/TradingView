/* eslint-disable @microsoft/sdl/no-inner-html, no-unsanitized/property */

async function View({ folderPath, dc }) {
    const { useEffect, useState, useRef } = dc;
    const { App } = await dc.require(folderPath + "/src/App.jsx");

    const FULLTAB_ID = 'fulltab-trading-view-888';

    const immersiveCss = `
        body > .app-container .status-bar, .status-bar,
        .inline-title, .view-footer, .workspace-leaf-content-footer,
        .mod-footer, .embedded-backlinks { display: none !important; }
        .workspace-leaf-content { padding: 0 !important; margin: 0 !important; }
        .markdown-preview-view, .markdown-preview-section { padding: 0 !important; max-width: 100% !important; }
        .markdown-preview-sizer { padding: 0 !important; margin: 0 !important; min-height: unset !important; }
    `;

    function RootView(props) {
        const rootRef = useRef(null);
        const [hijacked, setHijacked] = useState(false);

        // Layer 1: CSS Suppression to hide standard Obsidian UI elements
        useEffect(() => {
            let el = activeDocument.getElementById(FULLTAB_ID);
            if (!el) {
                el = activeDocument.createElement('style');
                el.id = FULLTAB_ID;
                el.textContent = immersiveCss;
                activeDocument.head.appendChild(el);
            }
            return () => { 
                const s = activeDocument.getElementById(FULLTAB_ID); 
                if (s) s.remove(); 
            };
        }, []);

        // Layer 2: DOM Reparenting into the .cm-scroller for true edge-to-edge
        useEffect(() => {
            const root = rootRef.current;
            if (!root) return;
            let attempts = 0;
            const hijack = () => {
                const leaf = root.closest('.workspace-leaf');
                const scroller = leaf?.querySelector('.cm-scroller');
                if (scroller) {
                    scroller.appendChild(root);
                    Object.assign(root.style, { 
                        position: 'absolute', 
                        top: '0', 
                        left: '0', 
                        width: '100%', 
                        height: '100%', 
                        zIndex: '10', 
                        visibility: 'visible' 
                    });
                    setHijacked(true); 
                    return true;
                }
                return false;
            };
            
            if (hijack()) return;
            const p = window.setInterval(() => { 
                if (hijack() || attempts++ > 100) window.clearInterval(p); 
            }, 16);
            return () => window.clearInterval(p);
        }, []);

        return (
            <div ref={rootRef} style={{ visibility: 'hidden', width: '100%', height: '100%' }} className="trading-folder-view-container">
                {hijacked && <App folderPath={folderPath} {...props} />}
            </div>
        );
    }

    return <RootView />;
}

return { View };

