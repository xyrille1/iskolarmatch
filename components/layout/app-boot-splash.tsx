// First-paint splash (docs/iskolar-ux-design.md §4.19 font-loading: the
// editorial look depends on the serif being ready). Rendered into the initial
// server HTML so it paints instantly, covering the viewport in paper until
// `document.fonts` resolves -- then it fades out. Styling lives in globals.css
// (#app-splash); the inline script only toggles classes, never removes the
// node, so React keeps ownership and hydration stays clean.
//
// Robustness: the node self-fades via a CSS safety animation, so a JS failure
// or a no-JS visitor is never trapped behind it. `suppressHydrationWarning`
// covers the rare case where the script toggles a class before hydration.
const HIDE_SCRIPT = `(function(){
  var s=document.getElementById('app-splash');
  if(!s)return;
  var done=false;
  function gone(){s.classList.add('is-gone');}
  function hide(){
    if(done)return;done=true;
    s.classList.add('is-hidden');
    s.addEventListener('transitionend',gone,{once:true});
    setTimeout(gone,700);
  }
  try{
    if(document.fonts&&document.fonts.ready){
      document.fonts.ready.then(function(){requestAnimationFrame(hide);});
    }
  }catch(e){}
  window.addEventListener('load',function(){setTimeout(hide,120);});
  setTimeout(hide,3500);
})();`;

export function AppBootSplash() {
  return (
    <>
      <div id="app-splash" role="presentation" aria-hidden="true" suppressHydrationWarning>
        <span className="app-splash__mark">
          <span className="app-splash__dot" />
          IskolarMatch
        </span>
        <span className="app-splash__bar">
          <span />
        </span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: HIDE_SCRIPT }} />
    </>
  );
}
