import * as fs from 'fs';
import { datetime } from 'fast-printf'; // Or just use new Date()

const MIN_LAT = 6.5;
const MAX_LAT = 14.0;
const MIN_LNG = 2.5;
const MAX_LNG = 14.5;
const STEP_LAT = 0.12;
const STEP_LNG = 0.14;

const HOTSPOTS = [
    { n: "Sambisa", lat: 11.5, lng: 13.5, r: 0.8, l: 9 },
    { n: "Lake Chad", lat: 13.6, lng: 14.1, r: 0.5, l: 10 },
    { n: "Alagarno", lat: 11.8, lng: 12.8, r: 0.4, l: 9 },
    { n: "Kuyambana Forest", lat: 10.5, lng: 6.5, r: 0.7, l: 8 },
    { n: "Kamuku Forest", lat: 10.8, lng: 6.2, r: 0.5, l: 8 },
    { n: "Birnin Gwari", lat: 10.6, lng: 6.7, r: 0.4, l: 9 },
    { n: "Falgore Forest", lat: 11.0, lng: 8.6, r: 0.3, l: 6 },
    { n: "Mandara Mountains", lat: 10.8, lng: 13.3, r: 0.6, l: 7 },
];

const HIGHWAYS = [
    { n: "Kaduna-Abuja", p1: [10.5, 7.4], p2: [9.0, 7.5], l: 7 },
    { n: "Maiduguri-Damaturu", p1: [11.8, 13.1], p2: [11.7, 11.9], l: 8 },
];

function getThreatLevel(lat: number, lng: number): number {
    let maxL = 1;
    for (const h of HOTSPOTS) {
        const dist = Math.sqrt(Math.pow(lat - h.lat, 2) + Math.pow(lng - h.lng, 2));
        if (dist < h.r) {
            const l = Math.floor(h.l * (1 - (dist / h.r)));
            maxL = Math.max(maxL, l);
        }
    }
    
    for (const hw of HIGHWAYS) {
        const dist1 = Math.sqrt(Math.pow(lat - hw.p1[0], 2) + Math.pow(lng - hw.p1[1], 2));
        const dist2 = Math.sqrt(Math.pow(lat - hw.p2[0], 2) + Math.pow(lng - hw.p2[1], 2));
        if (dist1 < 0.2 || dist2 < 0.2) {
            maxL = Math.max(maxL, hw.l);
        }
    }
    
    if (lat > 11 && lng > 11) maxL = Math.max(maxL, 4);
    if (lat > 11 && lng < 8) maxL = Math.max(maxL, 3);
        
    return Math.min(10, Math.max(1, maxL));
}

const hex_grid: any[] = [];
let count = 0;
const latRows = Math.floor((MAX_LAT - MIN_LAT) / STEP_LAT) + 1;
for (let rIdx = 0; rIdx < latRows; rIdx++) {
    const lat = MIN_LAT + rIdx * STEP_LAT;
    const stagger = rIdx % 2 === 1 ? 0.07 : 0.0;
    const lngCols = Math.floor((MAX_LNG - MIN_LNG) / STEP_LNG) + 1;
    for (let j = 0; j < lngCols; j++) {
        const lng = MIN_LNG + stagger + j * STEP_LNG;
        if (lng > MAX_LNG) continue;
        count++;
        const level = getThreatLevel(lat, lng);
        hex_grid.push({
            id: `h${count}`,
            lat: parseFloat(lat.toFixed(3)),
            lng: parseFloat(lng.toFixed(3)),
            l: level
        });
    }
}

const STATES = [
    "Adamawa", "Bauchi", "Benue", "Borno", "Gombe", "Jigawa", "Kaduna", "Kano", 
    "Katsina", "Kebbi", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", 
    "Sokoto", "Taraba", "Yobe", "Zamfara"
];

const state_data = STATES.map(s => {
    let l = 2;
    if (["Borno", "Yobe"].includes(s)) l = 8;
    if (["Zamfara", "Katsina", "Kaduna"].includes(s)) l = 7;
    if (["Niger", "Adamawa"].includes(s)) l = 5;
    if (["Taraba", "Plateau"].includes(s)) l = 4;
    
    return {
        n: s,
        l: l,
        w: l < 5 ? "Scattered Clouds" : "Dusty/Haze",
        t: s === "Plateau" ? "Hilly terrain" : "Savanna/Forest mix",
        s: `High situational awareness required in ${s} border zones.`
    };
});

const db = {
    meta: {
        generated_at: new Date().toISOString(),
        grid_type: "HEXAGONAL_STAGGERED",
        point_count: hex_grid.length
    },
    states: state_data,
    reports: [
        {id: "r1", src: "SIGINT", c: "Anomalous radio traffic detected in Alagarno corridor.", st: "Borno", ts: new Date().toISOString(), l: 9},
        {id: "r2", src: "SAT", c: "Smoke plumes observed in Kuyambana forest sector 4.", st: "Zamfara", ts: new Date().toISOString(), l: 7}
    ],
    hex_grid: hex_grid,
    comms_fallback: [
        {k: ["status", "grid"], r: `Grid operational. ${hex_grid.length} tactical hexes currently monitored.`},
        {k: ["borno", "maiduguri"], r: "ALERT: High insurgent mobility reported in Sambisa buffer zones. Avoid nighttime transit."},
        {k: ["kaduna", "highway"], r: "CAUTION: Highway patrols increased between KM 40-70 due to kidnapping risks."},
        {k: ["zamfara", "forest"], r: "DANGER: Kuyambana and Bagega sectors identified as active bandit staging grounds."}
    ]
};

fs.writeFileSync('./src/data/tactical_db.json', JSON.stringify(db));
console.log(`Generated ${hex_grid.length} hex points.`);
