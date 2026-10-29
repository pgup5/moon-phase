// Rounded selenographic coordinates; east positive. Educational near-side map.
export const LUNAR_FEATURES = [
  {id:'tranquility',zh:'寧靜海',en:'Mare Tranquillitatis',lat:8.35,lon:30.83,type:'mare',
    story:['深色的玄武岩平原，名稱雖有「海」，卻沒有海水。阿波羅 11 號在它的西南部著陸。','A dark basalt plain, not a sea of water. Apollo 11 landed in its southwestern region.'],
    tip:['雙筒鏡可辨認大片深色區域，接近滿月時適合比較月海輪廓。','Binoculars reveal the dark plain; near full Moon, compare the outlines of the lunar seas.'],url:'https://planetarynames.wr.usgs.gov/Feature/3691'},
  {id:'imbrium',zh:'雨海',en:'Mare Imbrium',lat:32.8,lon:-15.6,type:'mare',
    story:['大型撞擊盆地中的熔岩平原，是月球正面醒目的深色區域之一。','Lava plains fill a large impact basin, forming a prominent dark region on the near side.'],
    tip:['先找北半部的大型深色圓形區，再沿周圍明暗交界觀察山脈。','Find the large dark basin in the northern half, then trace mountains along the nearby terminator.'],url:'https://science.nasa.gov/wp-content/uploads/2024/01/moon-features.pdf'},
  {id:'tycho',zh:'第谷隕石坑',en:'Tycho',lat:-43.31,lon:-11.36,type:'crater',
    story:['位於南部高地，撞擊噴出的明亮物質形成向外延伸的輻射紋。','In the southern highlands, bright material ejected by the impact forms extensive rays.'],
    tip:['接近滿月時找明亮輻射紋；明暗交界經過時再用望遠鏡看坑壁陰影。','Look for bright rays near full Moon; use a telescope for rim shadows when the terminator crosses the crater.'],url:'https://science.nasa.gov/resource/tycho-crater-on-the-moon-labeled/'},
  {id:'copernicus',zh:'哥白尼隕石坑',en:'Copernicus',lat:9.62,lon:-20.08,type:'crater',
    story:['月球正面著名的輻射紋隕石坑，位於雨海南方，坑內具有中央峰。','A prominent ray crater south of Mare Imbrium, with central peaks within its floor.'],
    tip:['用小型望遠鏡觀察坑壁與中央峰；滿月附近可比較它與第谷的輻射紋。','Use a small telescope for the rim and central peaks; near full Moon, compare its rays with Tycho’s.'],url:'https://eclipse2017.nasa.gov/small-telescope-moon-observing-challenge'},
  {id:'apollo11',zh:'阿波羅 11 號',en:'Apollo 11',lat:0.67409,lon:23.47298,type:'landing',
    story:['1969 年人類首次登月的位置，位於寧靜海西南部的「靜海基地」。','The site of humanity’s first crewed lunar landing in 1969: Tranquility Base in southwestern Mare Tranquillitatis.'],
    tip:['可辨識著陸區所在月海；地面業餘望遠鏡無法分辨登月艙或足跡。','Locate the surrounding lunar sea; amateur telescopes on Earth cannot resolve the lander or footprints.'],url:'https://nasa.gov/wp-content/uploads/static/history/alsj/a11/a11ov.html'},
];
export function lunarPoint(lat,lon,southern=false){
  const r=Math.PI/180, sign=southern?-1:1;
  return {x:200+sign*166*Math.cos(lat*r)*Math.sin(lon*r),y:200-sign*166*Math.sin(lat*r)};
}
export function featureLighting(feature,elong){
  // Approximate subsolar longitude, ignoring libration and solar latitude.
  const r=Math.PI/180;
  return Math.cos(feature.lat*r)*Math.cos((feature.lon-(180-elong))*r)>0;
}
