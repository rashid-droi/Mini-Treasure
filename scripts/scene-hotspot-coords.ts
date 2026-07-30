/**
 * Calibrated hotspot coordinates for Scene 1 & Scene 2 (6000×3346 source, maxZoom=5).
 * Map units: targetX = px / 32, targetY = -px / 32 (Leaflet CRS.Simple).
 */

export const SCENE_SCALE = 32;
export const SCENE_W = 6000;
export const SCENE_H = 3346;

/** Legacy 1248×698 reference image → full 6000×3346 scale factor. */
export const LEGACY_PX_SCALE = SCENE_W / 1248;

export function mapCoords(px: number, py: number): { targetX: number; targetY: number } {
  return { targetX: px / SCENE_SCALE, targetY: -py / SCENE_SCALE };
}

export function fromLegacy1248(px: number, py: number): { targetX: number; targetY: number } {
  return mapCoords(px * LEGACY_PX_SCALE, py * LEGACY_PX_SCALE);
}

// Scene 1 — wide festival (same layout as legacy 1248×698 reference).
// [order, label, description, px, py] on 6000×3346 canvas.
export const SCENE1_CLUES: [number, string, string, number, number][] = [
  [1, "Falcon", "Find a falcon.", 408, 1536],
  [2, "Man running", "Find a man running.", 2440, 1987],
  [3, "Date fruit", "Find a date fruit.", 288, 744],
  [4, "Girl drinking Arabic coffee", "Find a girl drinking Arabic coffee.", 4230, 2885],
  [5, "Camel sitting down", "Find a camel sitting down.", 5020, 1580],
  [6, "Camel standing up", "Find a camel standing up.", 3840, 1385],
  [7, "Boy holding UAE flag", "Find a boy holding a UAE flag.", 3710, 1600],
  [8, "Woman carrying coffee pot", "Find a woman carrying a coffee pot.", 3065, 1928],
  [9, "Dallah coffee pot", "Find a dallah coffee pot.", 3825, 2135],
  [10, "Cup of gahwa", "Find a cup of gahwa.", 3728, 2435],
  [11, "Basket of dates", "Find a basket of dates.", 938, 2206],
  [12, "Pearl necklace", "Find a pearl necklace.", 408, 2230],
  [13, "Small oud instrument", "Find a small oud instrument.", 875, 2024],
  [14, "Man taking a selfie", "Find a man taking a selfie.", 4248, 1958],
  [15, "Girl wearing sunglasses", "Find a girl wearing sunglasses.", 3175, 2504],
  [16, "Tourist holding a map", "Find a tourist holding a map.", 4480, 1913],
  [17, "Child flying a kite", "Find a child flying a kite.", 4105, 770],
  [18, "Desert fox", "Find a desert fox.", 5090, 995],
  [19, "Hidden lizard", "Find a hidden lizard.", 5538, 1154],
  [20, "Palm tree with dates", "Find a palm tree with dates.", 480, 360],
  [21, "Henna artist", "Find a henna artist.", 1178, 3010],
  [22, "Woman with henna on hand", "Find a woman with henna on her hand.", 1395, 2520],
  [23, "Man wearing a kandura", "Find a man wearing a kandura.", 1033, 1418],
  [24, "Woman wearing an abaya", "Find a woman wearing an abaya.", 1680, 2518],
  [25, "Security guard", "Find a security guard.", 1920, 2710],
  [26, "Chef grilling food", "Find a chef grilling food.", 2408, 2590],
  [27, "Plate of luqaimat", "Find a plate of luqaimat.", 2240, 3135],
  [28, "Cup of karak tea", "Find a cup of karak tea.", 5400, 2455],
  [29, "Food truck", "Find a food truck.", 3225, 1298],
  [30, "Bicycle", "Find a bicycle.", 2720, 1298],
  [31, "Red sports car", "Find a red sports car.", 3275, 986],
  [32, "Camel saddle", "Find a camel saddle.", 4950, 1520],
  [33, "Traditional lantern", "Find a traditional lantern.", 553, 2638],
  [34, "Golden teapot", "Find a golden teapot.", 3880, 2080],
  [35, "Small treasure chest", "Find a small treasure chest.", 5840, 2910],
  [36, "Child holding balloons", "Find a child holding balloons.", 3708, 3082],
  [37, "Man reading a newspaper", "Find a man reading a newspaper.", 1226, 2193],
  [38, "Woman taking a photo", "Find a woman taking a photo.", 2920, 2735],
  [39, "Group doing a team activity", "Find a group doing a team activity.", 3655, 1043],
  [40, "Hidden sand timer", "Find a hidden sand timer.", 5780, 3120],
  [41, "Pair of binoculars", "Find a pair of binoculars.", 4460, 1880],
  [42, "Backpack", "Find a backpack.", 4210, 2010],
  [43, "Drone in the sky", "Find a drone in the sky.", 2875, 250],
  [44, "Hot-air balloon", "Find a hot-air balloon in the distance.", 5330, 192],
  [45, "Luxury resort entrance", "Find a luxury resort entrance.", 1080, 960],
  [46, "Tent with cushions", "Find a tent with cushions.", 4938, 1345],
  [47, "Majlis seating area", "Find a majlis seating area.", 5440, 2038],
  [48, "Falcon glove", "Find a falcon glove.", 448, 1588],
  [49, "Horse in the background", "Find a horse in the background.", 5200, 745],
  [50, "Boat model", "Find a boat model.", 1778, 2110],
  [51, "Shopping bag", "Find a shopping bag.", 2925, 2738],
  [52, "Football", "Find a football.", 4288, 2696],
  [53, "Child eating ice cream", "Find a child eating ice cream.", 3268, 1320],
  [54, "Man carrying luggage", "Find a man carrying luggage.", 4800, 3098],
  [55, "Small golden key", "Find a small golden key.", 5810, 2880],
];

// Scene 2 — fort on right, white henna tent left (6000×3346).
export const SCENE2_CLUES: [number, string, string, number, number][] = [
  [1, "Falcon on a Stand", "Find a falcon perched on a stand.", 360, 1720],
  [2, "Camel Sitting", "Find a camel sitting on the sand.", 1380, 1580],
  [3, "Camel Near Market", "Find a camel standing near the market.", 2180, 1480],
  [4, "Camel with Saddle", "Find a camel wearing a decorative saddle.", 2380, 1460],
  [5, "Horse in Background", "Find a horse in the background.", 5180, 1180],
  [6, "Small Desert Fox", "Find a small desert fox.", 5420, 1980],
  [7, "Man Running", "Find a man running in the desert.", 2980, 880],
  [8, "Child Flying a Kite", "Find a child flying a kite.", 1760, 380],
  [9, "Drone", "Find a drone in the sky.", 780, 320],
  [10, "Hot-Air Balloon", "Find a hot-air balloon.", 5280, 280],
  [11, "Red Sports Car", "Find a red sports car.", 3180, 1080],
  [12, "Colourful Food Truck", "Find a colourful food truck.", 3760, 1140],
  [13, "Bicycle by Palm Tree", "Find a bicycle near a palm tree.", 2960, 1260],
  [14, "Football", "Find a football on the ground.", 4180, 2760],
  [15, "Child Holding Balloons", "Find a child holding balloons.", 3580, 1360],
  [16, "Boy with UAE Flag", "Find a boy holding a UAE flag.", 2360, 1680],
  [17, "Flag on a Building", "Find a UAE flag displayed on a building.", 4980, 760],
  [18, "Security Guard", "Find a security guard.", 2280, 1620],
  [19, "Chef Grilling", "Find a chef grilling food.", 2980, 2180],
  [20, "Plate of Luqaimat", "Find a plate filled with luqaimat.", 3040, 2240],
  [21, "Man Reading Newspaper", "Find a man reading a newspaper.", 1180, 2680],
  [22, "Man Taking a Selfie", "Find a man taking a selfie.", 3180, 2880],
  [23, "Woman Photographing", "Find a woman taking a photograph.", 4480, 2380],
  [24, "Tourist with a Map", "Find a tourist holding a map.", 3360, 2820],
  [25, "Man Carrying Luggage", "Find a man carrying luggage.", 4760, 2560],
  [26, "Person Pulling Suitcase", "Find a person pulling a suitcase.", 3980, 2860],
  [27, "Woman with Shopping Bags", "Find a woman carrying shopping bags.", 2760, 1980],
  [28, "Girl with Sunglasses", "Find a girl wearing sunglasses.", 4580, 2660],
  [29, "Woman with Blue Handbag", "Find a woman holding a blue handbag.", 2580, 1860],
  [30, "Child Eating Ice Cream", "Find a child eating ice cream.", 3660, 2080],
  [31, "Two Children with a Ball", "Find two children playing with a ball.", 4080, 2720],
  [32, "Desert Activity Group", "Find a group taking part in a desert activity.", 4780, 2780],
  [33, "Man in Kandura (Red Ghutra)", "Find a man wearing a white kandura and red head covering.", 1080, 2620],
  [34, "Woman in Black Abaya", "Find a woman wearing a black abaya.", 880, 2480],
  [35, "Woman in Green Abaya", "Find a woman wearing a green abaya.", 1980, 1880],
  [36, "Henna Artist in Tent", "Find a henna artist working inside a tent.", 680, 2560],
  [37, "Woman Showing Henna", "Find a woman showing henna on her hand.", 820, 2520],
  [38, "Woman Drinking Coffee", "Find a woman drinking Arabic coffee.", 1280, 2720],
];
