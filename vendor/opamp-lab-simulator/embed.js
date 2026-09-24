/* Presentation only. The standalone simulator keeps its own header and scrolling. */
const simulatorParams = new URLSearchParams(window.location.search);
if (window.parent !== window && simulatorParams.get('embed') === '1') {
  document.documentElement.classList.add('embedded');
  if (simulatorParams.get('exam') === '1') {
    document.documentElement.classList.add('exam-mode');
  }
}
