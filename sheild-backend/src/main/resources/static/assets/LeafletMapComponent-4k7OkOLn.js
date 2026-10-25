import{r as c,j as e,P as j,N as w}from"./index-Ck_AZxT2.js";import{M as v,T as y,a as u,P as b,L as p,u as f,C as N,b as k,c as $}from"./leaflet-B7s-hBLP.js";delete p.Icon.Default.prototype._getIconUrl;p.Icon.Default.mergeOptions({iconRetinaUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",iconUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",shadowUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"});const C=p.divIcon({className:"custom-pulsing-icon",html:`
      <div style="
        width: 28px; 
        height: 28px; 
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <div style="
            position: absolute;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(255, 59, 48, 0.45);
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>
        <div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #FF3B30;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 0 14px rgba(255, 59, 48, 1);
            position: relative;
            z-index: 2;
        "></div>
      </div>
    `,iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-14]}),z=(r,a)=>p.divIcon({className:"custom-member-icon",html:`
      <div style="display: flex; flex-direction: column; align-items: center;">
        <div style="
            background: ${r?"#EF4444":"#141416"};
            color: #FFFFFF;
            padding: 3px 9px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 4px 14px rgba(0,0,0,0.8);
            border: 1px solid ${r?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.18)"};
            margin-bottom: 4px;
        ">
            ${r?"🚨 ":""}${a}
        </div>
        <div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${r?"#EF4444":"#3B82F6"};
            border: 2px solid #FFFFFF;
            box-shadow: 0 0 12px ${r?"rgba(239,68,68,0.9)":"rgba(59,130,246,0.8)"};
        "></div>
      </div>
    `,iconSize:[80,44],iconAnchor:[40,40],popupAnchor:[0,-40]});function M(r,a=!1){const s=r==="police",o=s?"#1D4ED8":r==="hospital"?"#059669":"#DC2626",n=a?"#FFFFFF":s?"#60A5FA":r==="hospital"?"#34D399":"#F87171",d=s?"🚓":r==="hospital"?"🏥":"📞",i=a?42:32,l=i/2;return p.divIcon({className:`sz-marker ${a?"sz-marker-selected":""}`,html:`
          <div style="
            width: ${i}px; 
            height: ${i}px;
            background: ${o};
            border: ${a?"3px solid #FFFFFF":`2px solid ${n}`};
            border-radius: 50%;
            display: flex; 
            align-items: center; 
            justify-content: center;
            font-size: ${a?"20px":"15px"}; 
            box-shadow: ${a?"0 0 24px rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.9)":"0 4px 14px rgba(0,0,0,0.8)"};
            transition: all 0.3s ease;
          ">${d}</div>
        `,iconSize:[i,i],iconAnchor:[l,l],popupAnchor:[0,-l-6]})}function P(){const r=f();return c.useEffect(()=>{const a=()=>{r.invalidateSize()};a();const s=setTimeout(a,80),o=setTimeout(a,250),n=setTimeout(a,700);return window.addEventListener("resize",a),()=>{clearTimeout(s),clearTimeout(o),clearTimeout(n),window.removeEventListener("resize",a)}},[r]),null}function T({center:r,zoom:a,triggerFocus:s}){const o=f();return c.useEffect(()=>{r&&r[0]&&r[1]&&o.flyTo(r,a,{animate:!0,duration:1.2})},[s,r,a,o]),null}function A({onRecenter:r}){const a=f();return e.jsxs("div",{className:"absolute right-4 bottom-8 z-[500] flex flex-col gap-2 pointer-events-auto",children:[e.jsx("button",{onClick:r,className:"w-11 h-11 rounded-2xl bg-surface/90 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-card hover:bg-surface-2 active:scale-95 transition-all",title:"Center on my location","aria-label":"Center on my location",children:e.jsx(N,{size:20,className:"text-primary"})}),e.jsxs("div",{className:"bg-surface/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-card overflow-hidden flex flex-col",children:[e.jsx("button",{onClick:()=>a.zoomIn(),className:"w-11 h-11 text-white hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors border-b border-white/5","aria-label":"Zoom in",children:e.jsx(k,{size:18})}),e.jsx("button",{onClick:()=>a.zoomOut(),className:"w-11 h-11 text-white hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors","aria-label":"Zoom out",children:e.jsx($,{size:18})})]})]})}function R({center:r,zoom:a,myLocation:s,activeLocations:o=[],safeZones:n=[],triggerFocus:d,selectedZoneId:i,onLocateMe:l}){const h=c.useRef(null),x=c.useRef({});return c.useEffect(()=>{if(i&&x.current[i]){const t=setTimeout(()=>{x.current[i]?.openPopup()},600);return()=>clearTimeout(t)}else!i&&h.current&&s&&h.current.openPopup()},[i,d,s]),e.jsxs(v,{center:r,zoom:a,className:"h-full w-full z-0 font-sans",zoomControl:!1,children:[e.jsx(y,{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",maxZoom:19,className:"map-tiles-pitch-black"}),s&&e.jsx(u,{position:[s.lat,s.lng],icon:C,ref:h,children:e.jsx(b,{autoPan:!1,children:e.jsx("div",{className:"font-bold text-center text-xs text-white",children:"📍 You are here"})})}),o.map(t=>e.jsx(u,{position:[t.lat,t.lng],icon:z(t.isSos,t.name||"Member"),ref:m=>{m&&(x.current[t.id]=m)},children:e.jsx(b,{autoPan:!1,children:e.jsxs("div",{className:"p-1 text-xs",children:[e.jsx("b",{className:"text-sm text-white",children:t.name||"Member"}),e.jsx("br",{}),e.jsx("span",{className:t.isSos?"text-red-400 font-bold":"text-zinc-400",children:t.isSos?"🚨 SOS Alert Active!":"Live Location Tracking"})]})})},t.id)),n.map(t=>{const m=t.category==="police",F=i===t.id;return e.jsx(u,{position:[t.lat,t.lng],icon:M(t.category,F),ref:g=>{g&&(x.current[t.id]=g)},children:e.jsx(b,{autoPan:!1,children:e.jsxs("div",{className:"p-2 min-w-[210px] text-xs",children:[e.jsxs("div",{className:"flex items-center gap-1.5 mb-1.5",children:[e.jsx("span",{className:"text-base",children:m?"🚓":"🏥"}),e.jsxs("div",{children:[e.jsx("b",{className:"text-[13px] text-white font-bold block leading-snug",children:t.name}),e.jsxs("span",{className:"text-[10px] text-emerald-400 font-semibold",children:[t.distanceKm>0?`${t.distanceKm} km away (Nearest)`:"Safe Zone"," • 24/7 Verified"]})]})]}),t.address&&e.jsx("p",{className:"text-[11px] text-zinc-300 mb-2 line-clamp-2 leading-relaxed",children:t.address}),e.jsxs("div",{className:"flex items-center gap-2 mt-2 pt-2 border-t border-white/10",children:[t.phone&&e.jsxs("a",{href:`tel:${t.phone.replace(/\s/g,"")}`,className:"flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md border border-red-400/40",style:{color:"#FFFFFF",textDecoration:"none"},children:[e.jsx(j,{size:13,className:"text-white fill-current"}),e.jsx("span",{style:{color:"#FFFFFF"},className:"font-bold",children:"Call"})]}),t.googleMapsUri&&e.jsxs("a",{href:t.googleMapsUri,target:"_blank",rel:"noreferrer",className:"flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 border border-white/15 active:scale-95 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all",style:{color:"#FFFFFF",textDecoration:"none"},children:[e.jsx(w,{size:13,className:"text-white"}),e.jsx("span",{style:{color:"#FFFFFF"},className:"font-semibold",children:"Directions"})]})]})]})})},t.id)}),e.jsx(P,{}),e.jsx(T,{center:r,zoom:a,triggerFocus:d}),e.jsx(A,{onRecenter:l||(()=>{})}),e.jsx("style",{children:`
                .leaflet-container { 
                    background: #000000 !important; 
                    outline: none;
                }
                .map-tiles-pitch-black {
                    filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(120%) grayscale(95%);
                }
                .leaflet-popup-content-wrapper, .leaflet-popup-tip {
                    background: #121214 !important;
                    color: #FFFFFF !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    border-radius: 14px !important;
                    box-shadow: 0 10px 36px rgba(0,0,0,0.9) !important;
                }
                .leaflet-container a, .leaflet-popup-content a {
                    color: #FFFFFF !important;
                    text-decoration: none !important;
                }
                .leaflet-popup-content {
                    margin: 8px 12px !important;
                    line-height: 1.4 !important;
                }
                .custom-pulsing-icon, .custom-member-icon, .sz-marker { 
                    background: transparent !important; 
                    border: none !important;
                }
                .sz-marker-selected {
                    z-index: 1000 !important;
                }
                @keyframes pulse-ring {
                    0% { transform: scale(0.6); opacity: 0.9; }
                    50% { transform: scale(1.6); opacity: 0.3; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
            `})]})}export{R as default};
