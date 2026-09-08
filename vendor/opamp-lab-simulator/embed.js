/* Presentation only. The standalone simulator keeps its own header and scrolling. */
if (window.parent !== window && new URLSearchParams(window.location.search).get('embed') === '1') {
  document.documentElement.classList.add('embedded');
}
