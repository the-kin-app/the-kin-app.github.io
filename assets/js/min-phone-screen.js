// The illustrative app UI becomes a high-resolution texture on the 3D glass.
// `scale` trades texture memory for sharpness: on a phone the glass is ~90 px
// across, so half resolution is 4x less VRAM and no visible difference.
export async function phoneScreenTexture(THREE, scale = 1) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 720 * scale; canvas.height = 1500 * scale;
  const c = canvas.getContext('2d');
  c.scale(scale, scale);
  const round = (x,y,w,h,r,fill,stroke) => {
    c.beginPath(); c.roundRect(x,y,w,h,r);
    if (fill) { c.fillStyle=fill; c.fill(); }
    if (stroke) { c.strokeStyle=stroke; c.lineWidth=2; c.stroke(); }
  };
  const text = (s,x,y,size=26,color='#ede6e1',weight=400) => {
    c.fillStyle=color; c.font=`${weight} ${size}px Nunito, sans-serif`; c.fillText(s,x,y);
  };
  const bg = c.createLinearGradient(0,0,720,1500);
  bg.addColorStop(0,'#514842'); bg.addColorStop(1,'#2c2627');
  round(0,0,720,1500,66,bg);
  text('9:41',54,58,23,'#faf6ed',700);
  round(259,24,202,56,28,'#171515');
  text('•••',584,58,26); round(638,39,33,17,4,'#faf6ed');
  const logo = new Image(); logo.src='/assets/img/min-logo-flat-white.svg';
  try { await logo.decode(); c.drawImage(logo,50,123,122,78); } catch { text('min',50,181,60,'#fff',700); }
  round(490,140,178,53,26,'#ffffff08','#ffffff30'); text('↗ Helsinki',515,175,25);
  text('A LITTLE TIME. A LITTLE POSSIBILITY.',50,254,19,'#d6c3df');
  text('Your people.',50,329,56,'#fbf8f4',700);
  text('Closer than you think.',50,391,50,'#fbf8f4',700);
  text('Let’s see who’s around.',50,447,28,'#d5c7bf');
  c.strokeStyle='#f0d9ef20'; c.lineWidth=2;
  for(const [rx,ry] of [[278,163],[165,101]]) { c.beginPath(); c.ellipse(360,668,rx,ry,-.19,0,Math.PI*2); c.stroke(); }
  const person=(x,y,letter,name,color)=>{
    const g=c.createLinearGradient(x-40,y-40,x+30,y+45);g.addColorStop(0,'#e3d5dd');g.addColorStop(.3,color);g.addColorStop(1,'#55454f');
    round(x-42,y-43,84,87,38,g,'#e7d9e455'); text(letter,x-10,y+13,34,'#fff');
    c.textAlign='center'; text(name,x,y+76,22,'#e1d7d0');c.textAlign='left';
  };
  person(211,551,'J','Jules','#ac90b4');person(557,650,'A','Aino','#a0ac94');person(219,727,'E','Elias','#b19a78');
  c.fillStyle='#d9bde425';c.beginPath();c.arc(360,669,27,0,Math.PI*2);c.fill();
  c.fillStyle='#e4c4f3';c.beginPath();c.arc(360,669,10,0,Math.PI*2);c.fill();
  c.textAlign='center';text('You',360,724,23,'#ddcfe0');text('Good company, a short walk away',360,849,22,'#cbbfc8');c.textAlign='left';
  round(37,891,646,453,45,'#ffffff09','#e9d7dd40');
  c.fillStyle='#d4dfbe';c.beginPath();c.arc(73,936,5,0,Math.PI*2);c.fill();
  text('A little nudge from Min',90,945,23,'#e4d6e9');text('now',610,945,21,'#bcb1b7');
  round(66,987,82,86,36,'#9a829f'); text('J',97,1041,36,'#fff');
  text('Meet Jules',169,1028,38,'#fff7ef',700);text('5 min walk · Up for a coffee',169,1064,22,'#d0c3bd');text('✧',607,1041,50,'#d7bfe3');
  text('You both love slow mornings and finding',67,1122,25,'#e0d3cc');
  text('new corners of the city. Coffee together?',67,1160,25,'#e0d3cc');
  const lavender=c.createLinearGradient(66,0,653,0);lavender.addColorStop(0,'#ebd9f1');lavender.addColorStop(1,'#c2a8d1');
  round(66,1202,588,94,47,lavender);text('Let’s meet',101,1263,32,'#3c2b44',700);text('↗',596,1263,38,'#3c2b44');
  c.textAlign='center';text('Open to a little spontaneity',360,1400,23,'#d0c4bc');c.textAlign='left';
  round(249,1455,222,8,4,'#e4d8cc');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}
