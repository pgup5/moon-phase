import {viewingScore} from './viewing-score.js';
// Clip both the window and its peak so a recommendation cannot point into the past.
export function remainingViewingWindows(windows,date){
  return windows.filter(w=>+w.end>+date).map(w=>{
    const start=new Date(Math.max(+w.start,+date));
    const peak=new Date(Math.max(+start,Math.min(+w.peak,+w.end-1)));
    return {...w,start,peak};
  });
}
export function viewingAdvice(date,windows,lat,lon,weather=null){
  if(!windows.length)return {kind:'none'};
  const remaining=remainingViewingWindows(windows,date);
  if(!remaining.length)return {kind:'ended'};
  const result=viewingScore(remaining,lat,lon,weather);
  const window=remaining.find(w=>+result.date>=+w.start&&+result.date<=+w.end);
  return {kind:'window',result,window};
}
