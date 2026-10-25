import{r as c,j as e,P as v,N as y}from"./index-uoC8IKQy.js";import{M as z,T as N,a as b,P as g,L as p,u as m,C as k,b as C,c as T}from"./leaflet-UveUcofm.js";delete p.Icon.Default.prototype._getIconUrl;p.Icon.Default.mergeOptions({iconRetinaUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",iconUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",shadowUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"});const M=p.divIcon({className:"custom-pulsing-icon",html:`
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
            background: rgba(255, 59, 48, 0.4);
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
    `,iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-14]});function R(t,r=!1){const a=t==="police",i=a?"#1D4ED8":t==="hospital"?"#059669":"#DC2626",n=r?"#FFFFFF":a?"#60A5FA":t==="hospital"?"#34D399":"#F87171",d=a?"🚓":t==="hospital"?"🏥":"📞",s=r?42:36,l=s/2;return p.divIcon({className:`sz-marker ${r?"sz-marker-selected":""}`,html:`
          <div style="
            width: ${s}px; 
            height: ${s}px;
            background: ${i};
            border: ${r?"3px solid #FFFFFF":`2px solid ${n}`};
            border-radius: 50%;
            display: flex; 
            align-items: center; 
            justify-content: center;
            font-size: ${r?"20px":"17px"}; 
            box-shadow: ${r?"0 0 24px rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.9)":"0 4px 16px rgba(0,0,0,0.85)"};
            transition: all 0.3s ease;
          ">${d}</div>
        `,iconSize:[s,s],iconAnchor:[l,l],popupAnchor:[0,-l-6]})}function $(){const t=m();return c.useEffect(()=>{const r=()=>{t.invalidateSize()};r();const a=setTimeout(r,80),i=setTimeout(r,250),n=setTimeout(r,600);return window.addEventListener("resize",r),()=>{clearTimeout(a),clearTimeout(i),clearTimeout(n),window.removeEventListener("resize",r)}},[t]),null}function D({center:t,zoom:r=14,triggerFocus:a}){const i=m();return c.useEffect(()=>{t&&t[0]&&t[1]&&i.flyTo(t,r,{animate:!0,duration:1.1})},[t,r,a,i]),null}function P({onRecenter:t}){const r=m();return e.jsxs("div",{className:"absolute right-4 bottom-6 z-[500] flex flex-col gap-2 pointer-events-auto",children:[e.jsx("button",{onClick:t,className:"w-11 h-11 rounded-2xl bg-surface/90 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-card hover:bg-surface-2 active:scale-95 transition-all",title:"Center on my location","aria-label":"Center on my location",children:e.jsx(k,{size:20,className:"text-primary"})}),e.jsxs("div",{className:"bg-surface/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-card overflow-hidden flex flex-col",children:[e.jsx("button",{onClick:()=>r.zoomIn(),className:"w-11 h-11 text-white hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors border-b border-white/5","aria-label":"Zoom in",children:e.jsx(C,{size:18})}),e.jsx("button",{onClick:()=>r.zoomOut(),className:"w-11 h-11 text-white hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors","aria-label":"Zoom out",children:e.jsx(T,{size:18})})]})]})}function U({userLocation:t,places:r,center:a,zoom:i,selectedPlaceId:n,triggerFocus:d=0}){const s=c.useRef(null),l=c.useRef({}),x=c.useRef(d),u=a||(t?[t.lat,t.lng]:[28.4595,77.502]),h=i||(t?14:12),F=()=>{x.current+=1,s.current&&s.current.openPopup()};return c.useEffect(()=>{if(n&&l.current[n]){const o=setTimeout(()=>{l.current[n]?.openPopup()},600);return()=>clearTimeout(o)}else!n&&s.current&&t&&s.current.openPopup()},[n,d,t]),e.jsx("div",{className:"h-full w-full relative bg-bg",children:e.jsxs(z,{center:u,zoom:h,className:"h-full w-full z-0 font-sans",zoomControl:!1,children:[e.jsx(N,{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",maxZoom:19,className:"map-tiles-pitch-black"}),t&&e.jsx(b,{position:[t.lat,t.lng],icon:M,ref:s,children:e.jsx(g,{autoPan:!1,children:e.jsx("div",{className:"p-1 text-center font-bold text-xs text-white",children:"📍 You are here"})})}),r.map(o=>{const j=o.category==="police",w=n===o.id;return e.jsx(b,{position:[o.lat,o.lng],icon:R(o.category,w),ref:f=>{f&&(l.current[o.id]=f)},children:e.jsx(g,{autoPan:!1,children:e.jsxs("div",{className:"p-2 min-w-[210px] text-xs",children:[e.jsxs("div",{className:"flex items-center gap-1.5 mb-1.5",children:[e.jsx("span",{className:"text-base",children:j?"🚓":"🏥"}),e.jsxs("div",{children:[e.jsx("b",{className:"text-[13px] text-white font-bold block leading-snug",children:o.name}),e.jsxs("span",{className:"text-[10px] text-emerald-400 font-semibold",children:[o.distanceKm>0?`${o.distanceKm} km away (Nearest)`:"Safe Zone"," • 24/7 Verified"]})]})]}),o.address&&e.jsx("p",{className:"text-[11px] text-zinc-300 mb-2 line-clamp-2 leading-relaxed",children:o.address}),e.jsxs("div",{className:"flex items-center gap-2 mt-2 pt-2 border-t border-white/10",children:[o.phone&&e.jsxs("a",{href:`tel:${o.phone.replace(/\s/g,"")}`,className:"flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md border border-red-400/40",style:{color:"#FFFFFF",textDecoration:"none"},children:[e.jsx(v,{size:13,className:"text-white fill-current"}),e.jsx("span",{style:{color:"#FFFFFF"},className:"font-bold",children:"Call"})]}),o.googleMapsUri&&e.jsxs("a",{href:o.googleMapsUri,target:"_blank",rel:"noreferrer",className:"flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 border border-white/15 active:scale-95 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all",style:{color:"#FFFFFF",textDecoration:"none"},children:[e.jsx(y,{size:13,className:"text-white"}),e.jsx("span",{style:{color:"#FFFFFF"},className:"font-semibold",children:"Directions"})]})]})]})})},o.id)}),e.jsx($,{}),e.jsx(D,{center:u,zoom:h,triggerFocus:d||x.current}),e.jsx(P,{onRecenter:F}),e.jsx("style",{children:`
                    .leaflet-container { 
                        background: #000000 !important; 
                        outline: none;
                    }
                    .map-tiles-pitch-black {
                        filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(120%) grayscale(95%);
                    }
                    .leaflet-popup-content-wrapper, .leaflet-popup-tip {
                        background: #121214 !important;
                        color: white !important;
                        border: 1px solid rgba(255, 255, 255, 0.12) !important;
                        border-radius: 14px !important;
                        box-shadow: 0 10px 36px rgba(0,0,0,0.9) !important;
                    }
                    .leaflet-container a, .leaflet-popup-content a {
                        color: #FFFFFF !important;
                        text-decoration: none !important;
                    }
                    .leaflet-popup-content {
                        margin: 10px 12px !important;
                    }
                    .custom-pulsing-icon, .sz-marker { 
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
                `})]})})}export{U as default};
