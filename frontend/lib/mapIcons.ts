import L from "leaflet"

export const plainPin = L.divIcon({
  className: "",
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:white;border:2px solid #185FA5;
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
})

export const tickPin = L.divIcon({
  className: "",
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:#185FA5;border:2px solid #185FA5;
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:14px;line-height:1;
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
  ">✓</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
})
