// Exposure values are starting points for the sunlit lunar surface, not metering.
export function photoGuide(illumination, device = "phone") {
  const phase = illumination < 0.01 ? "new" : illumination < 0.35 ? "crescent" : illumination < 0.85 ? "partial" : "full";
  return { phase, device, shutter: phase === "full" ? "1/250" : phase === "partial" ? "1/125" : "1/60", aperture: "f/8", iso: 100 };
}

export function photoAdvice(guide, english = false) {
  const t = (zh, en) => english ? en : zh;
  const subject = {
    new: t("接近新月，月面很難拍到。可切換日期尋找眉月，或改拍夜景。", "Near new Moon, the lunar surface is difficult to photograph. Try another date for a crescent, or photograph the night landscape."),
    crescent: t("適合拍纖細眉月與地景；明暗交界的陰影能呈現月面起伏。", "Frame the slender crescent with the landscape; shadows along the terminator reveal lunar relief."),
    partial: t("適合拍月海與隕石坑，優先對準明暗交界，地形陰影更明顯。", "Photograph lunar seas and craters, especially along the terminator where terrain shadows stand out."),
    full: t("適合拍完整月面與地標同框；接近滿月時，月面陰影較少。", "Capture the whole lunar disk or frame it with a landmark. Near full Moon, surface shadows are less pronounced."),
  }[guide.phase];
  const settings = guide.phase === "new" ? t("沒有建議月面曝光參數，請先選擇可見月相。", "No lunar exposure suggested; choose a visible lunar phase first.")
    : guide.device === "camera" ? t(`M 模式 · ISO ${guide.iso} · ${guide.aperture} · ${guide.shutter} 秒起拍。月面過白就加快快門，太暗則放慢；以上僅供一般未月食的受光月面試拍。`, `Start in M mode at ISO ${guide.iso}, ${guide.aperture}, ${guide.shutter} s. Use a faster shutter if lunar highlights clip, or slower if too dark. These are starting points for the sunlit surface outside an eclipse.`)
    : t("點選月亮對焦，若支援則鎖定對焦與曝光，再降低曝光直到看見月面細節。拍月面先關閉閃光燈與長曝光夜景模式。", "Tap the Moon to focus, lock focus and exposure if supported, then lower exposure until surface detail appears. Turn off flash and long-exposure night mode for lunar detail.");
  const technique = guide.device === "camera"
    ? t("月面特寫可用現有的長焦鏡頭，放大預覽後手動微調對焦；架穩腳架並用 2 秒自拍。可拍攝 RAW，連拍幾張比較清晰度。", "For close-ups, use an available telephoto lens and refine manual focus in magnified live view. Stabilize your tripod and use a 2-second timer. Shoot RAW if available and compare several frames for sharpness.")
    : t("優先使用手機原生光學焦段，避免過度數位放大；靠穩欄杆或用腳架，搭配 2 秒自拍。月亮太小時，把樹影或建築納入畫面。", "Use native optical focal lengths and avoid excessive digital zoom. Support the phone or use a tripod with a 2-second timer. If the Moon is small, include tree silhouettes or buildings.");
  return { subject, settings, technique };
}
