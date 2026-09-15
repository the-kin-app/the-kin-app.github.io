/* The steps sit together as one cluster beside the phone; neither moves.
   What scroll changes is only WHICH step is open, so selection comes from
   how far the sticky pair has travelled through its track — not from where
   each step happens to be on screen. No snap rules, no wheel interception. */
export function howItWorks() {
  const grid=document.querySelector('[data-steps]');
  if(!grid)return;
  const items=[...grid.querySelectorAll('.steps__item')];
  const stage=grid.querySelector('.steps__stage');
  const screens=[...grid.querySelectorAll('[data-screen]')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let queued=false,current=-1;
  grid.classList.add('is-live');   // JS owns the open/closed state from here
  const pin=grid.querySelector('.steps__pin');
  const band=grid.querySelector('.steps__band');
  /* The track: the stretch of scroll where BOTH the phone and the cluster
     are parked. Taking it from the phone alone was wrong on mobile, where
     the cluster starts lower in the grid and is shorter, so it releases and
     slides away while step 3 is still arriving. Each sticky element has its
     own pinned range; the track is where those ranges overlap.

     Which box sticks depends on the breakpoint: on desktop it is
     .steps__pin (heading, phone and pebbles parked as one block), below
     901px it is .steps__band (phone and pebbles only — the heading is let
     go, because all three don't fit a phone screen). Both are listed here
     and range() skips whichever is not `sticky`, so nothing in this file
     has to know the breakpoint. Whatever sticks, the track is the stretch
     where all of it is parked. */
  const pinned=[pin,band].filter(Boolean);
  let within=pinned.map(()=>0);
  /* Where each one sits in the grid before anything sticks. This CANNOT be
     read while an element is stuck: `offsetTop` on a stuck sticky element
     reports the position it has been pushed to, not its position in the
     layout, so reading it mid-scroll made `start` follow scrollY and the
     progress below was permanently 0. Dropping to `static` for the read is
     the only way to get the honest number back. Cached — this forces a
     reflow, so it runs on resize, never per scroll frame. */
  function measure(){
    const kept=pinned.map(el=>el.style.position);
    pinned.forEach(el=>{el.style.position='static';});
    within=pinned.map(el=>el.offsetTop-grid.offsetTop);
    pinned.forEach((el,i)=>{el.style.position=kept[i];});
  }
  function range(el,i){
    const cs=getComputedStyle(el);
    if(cs.position!=='sticky')return null;                    // nothing pins here
    const offset=parseFloat(cs.top)||0;
    const top=scrollY+grid.getBoundingClientRect().top;       // the grid, in the document
    return {
      start: top+within[i]-offset,                            // it reaches its parked line
      end:   top+grid.offsetHeight-el.offsetHeight-offset,    // its foot reaches the grid's
    };
  }
  function track(){
    const parts=pinned.map(range).filter(Boolean);
    if(!parts.length)return {start:scrollY,span:0};
    const start=Math.max(...parts.map(p=>p.start));
    return {start,span:Math.min(...parts.map(p=>p.end))-start};
  }
  function update(){
    queued=false;
    /* The dock hides ONLY over the closer, which carries the same form.
       Everywhere else it is the one persistent way to sign up, so it stays
       up. The threshold is the closer's top reaching the lower third of
       the screen — late enough that the two CTAs are never both in frame. */
    const cl=document.querySelector('#closer');
    document.body.classList.toggle('is-near-closer',
      !!cl && cl.getBoundingClientRect().top < innerHeight*0.72);
    const t=track();
    // A track with no runway (short phones, reduced motion) leaves step 1 open.
    const progress=t.span>40?Math.max(0,Math.min(1,(scrollY-t.start)/t.span)):0;
    const nearest=Math.min(items.length-1,Math.floor(progress*items.length));
    if(current!==nearest){
      current=nearest;
      items.forEach((el,i)=>el.classList.toggle('is-on',i===nearest));
      screens.forEach((el,i)=>el.classList.toggle('is-on',i===nearest));    }
    // The mobile band's scrim only has a job once the box is actually
    // parked. That state belongs to whichever box is sticky at this width,
    // not to the stage — the stage no longer sticks to anything of its own.
    const stuck=pinned.find(el=>getComputedStyle(el).position==='sticky');
    stage.classList.toggle('is-parked', !!stuck &&
      stuck.getBoundingClientRect().top<=(parseFloat(getComputedStyle(stuck).top)||0)+1);
    // The phone does NOT move. It used to take a scroll-driven float and a
    // tilt that swept -1.5deg to +1.5deg across the section, which read as
    // parallax against a cluster that is nailed down. Its resting tilt is
    // CSS (.pmock) and nothing overrides it.
  }
  /* Read the scroll, never write it. There used to be a `settle()` here
     that smooth-scrolled the page to the middle of a step's band 240ms
     after you stopped — so the page carried on moving ~100px on its own
     after you let go. That is the section moving itself, which is exactly
     what it must not do. */
  function onScroll(){if(!queued){queued=true;requestAnimationFrame(update);}}
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',()=>{measure();update();},{passive:true});
  reduced.addEventListener('change',update);
  new ResizeObserver(()=>{measure();update();}).observe(grid);
  measure();update();
}
