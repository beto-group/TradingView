---
layout: component-layout
autoLoad: true
---

```datacorejsx
const activeFile = dc.useCurrentPath ? dc.useCurrentPath() : dc.resolvePath("TRADING VIEW.md");
const folderPath = activeFile 
    ? activeFile.substring(0, activeFile.lastIndexOf('/')) 
    : "_RESOURCES/DATACORE/_DONE/TradingView";
const { View } = await dc.require(folderPath + "/src/index.jsx");
return await View({ folderPath, dc, app: dc.app });
```
