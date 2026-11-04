"""Generate the /c/ 'old way' trail: SVG paths + HTML labels + timing CSS.
usage: python3 trail.py <page> ; splices into the page between markers."""
import sys, math

W, H = 600, 1235
SHIFT_FROM, SHIFT = 330, 55   # room under step 2's longer label
DRAW_START, DRAW_DUR = 0.3, 3.0   # seconds

def loop(cx, cy, r=22, start='top'):
    # four points round a circle, clockwise from the top, ending near the top
    return [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy), (cx + 2, cy - r + 1)]

S = {}  # station name -> index in MAIN
MAIN = []
def add(*pts): MAIN.extend(pts)
def st(name, p): S[name] = len(MAIN); MAIN.append(p)

st('start', (100, 40))
add((120, 85))
st('s1', (100, 130))
add((85, 180), (130, 220), (210, 228), (270, 214))
add(*loop(300, 234))
add((350, 222), (420, 245), (480, 232), (525, 262))
st('s2', (500, 300))
add((470, 345), (420, 385), (350, 365), (280, 392), (210, 368), (140, 395), (95, 428))
st('s3', (100, 470))
add((115, 520), (170, 555), (232, 548))
add(*loop(258, 570))
add((318, 562), (366, 578))
add(*loop(398, 568))
add((458, 566), (528, 600))
st('s4', (500, 640))
add((480, 690), (390, 728), (310, 700), (230, 735), (150, 725), (92, 768))
st('s5', (100, 810))
add((125, 860), (210, 893), (290, 875), (340, 900), (300, 925), (380, 938), (460, 915), (528, 945))
st('s6', (500, 980))
add((475, 1030), (400, 1062), (330, 1090))
st('end', (300, 1128))

DEAD = {
    's2': [(500, 300), (535, 325), (565, 362), (580, 405)],
    's3': [(100, 470), (70, 500), (45, 538), (30, 582)],
    's4': [(500, 640), (535, 665), (565, 702), (580, 745)],
}

MAIN[:] = [(x, y + SHIFT if y > SHIFT_FROM else y) for x, y in MAIN]
for k in DEAD:
    DEAD[k] = [(x, y + SHIFT if y > SHIFT_FROM else y) for x, y in DEAD[k]]

def cr2bez(pts):
    """Catmull-Rom through pts -> list of cubic segments (p0, c1, c2, p1)."""
    segs = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        segs.append((p1, c1, c2, p2))
    return segs

def d_of(segs):
    f = lambda p: f'{p[0]:.1f} {p[1]:.1f}'
    return f'M{f(segs[0][0])} ' + ' '.join(f'C{f(c1)} {f(c2)} {f(p1)}' for _, c1, c2, p1 in segs)

def seglen(s, n=40):
    p0, c1, c2, p1 = s
    def at(t):
        u = 1 - t
        return (u**3*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t**3*p1[0],
                u**3*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t**3*p1[1])
    pts = [at(i / n) for i in range(n + 1)]
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(n))

main = cr2bez(MAIN)
lens = [seglen(s) for s in main]
total = sum(lens)
cum = [0]
for l in lens: cum.append(cum[-1] + l)
def t_at(name):  # seconds when the draw reaches a station
    return DRAW_START + DRAW_DUR * cum[S[name]] / total

def pct(x, y): return f'--x:{x / W * 100:.2f}%;--y:{y / H * 100:.2f}%'

STEPS = [
    ('s1', 1, 'Find something to do', [('tiktok', 'TikTok'), ('googlemaps', 'Google Maps'), ('gemini', 'Gemini')],
     'Scroll for ideas, save five, pick none.', None),
    ('s2', 2, 'Find someone to go with', [('whatsapp', 'WhatsApp'), ('timeleft', 'Timeleft')],
     'Friends: “anyone free?” Seen by 4, no replies. New people: the next dinner with strangers is Wednesday.',
     'most plans die here: no one to go with'),
    ('s3', 3, 'Agree on a time and place', [('whatsapp', 'WhatsApp'), ('messenger', 'Messenger')],
     '47 messages later: “maybe next week?”', 'plan dies'),
    ('s4', 4, 'Book it', [('thefork', 'TheFork'), ('kide', 'Kide.app')],
     'Fully booked. Sold out. Another night?', 'plan dies'),
    ('s5', 5, 'Pay', [('mobilepay', 'MobilePay')],
     'At the counter. “I’ll send you mine later.”', None),
    ('s6', 6, 'Get there', [('hsl', 'HSL'), ('googlemaps', 'Google Maps')],
     'Across town. Two changes. You’re late.', None),
]

I = '            '
out = []
out.append(f'{I}<div class="trail" role="img" aria-label="The old way: six steps across many apps, and plans die at finding people, agreeing on a time, and booking.">')
out.append(f'{I}  <svg class="trail__svg" viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">')
out.append(f'{I}    <defs>')
out.append(f'{I}      <mask id="trail-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">')
out.append(f'{I}        <path class="trail__draw" pathLength="1" d="{d_of(main)}"/>')
for k, pts in DEAD.items():
    out.append(f'{I}        <path class="trail__draw trail__draw--{k}" pathLength="1" d="{d_of(cr2bez(pts))}"/>')
out.append(f'{I}      </mask>')
out.append(f'{I}    </defs>')
out.append(f'{I}    <g mask="url(#trail-reveal)">')
out.append(f'{I}      <path class="trail__path" d="{d_of(main)}"/>')
for k, pts in DEAD.items():
    out.append(f'{I}      <path class="trail__path trail__path--dead" d="{d_of(cr2bez(pts))}"/>')
out.append(f'{I}    </g>')
out.append(f'{I}  </svg>')

sx, sy = MAIN[S['start']]
out.append(f'{I}  <span class="trail__end trail__end--start" style="{pct(sx, sy)}">“I’m bored”</span>')
for k, n, title, apps, pain, dies in STEPS:
    x, y = MAIN[S[k]]
    side = 'l' if x < W / 2 else 'r'
    out.append(f'{I}  <span class="trail__pin{" is-death" if dies else ""}" style="{pct(x, y)};--t:{t_at(k):.2f}s" aria-hidden="true"></span>')
    out.append(f'{I}  <div class="trail__stop trail__stop--{side}" style="{pct(x, y)};--t:{t_at(k):.2f}s">')
    icons = ''.join(f'<img src="/assets/img/apps/{f}.png" alt="{a}" width="24" height="24" loading="lazy">' for f, a in apps)
    out.append(f'{I}    <p class="trail__title"><span class="trail__n">{n}</span> {title} <span class="trail__apps">{icons}</span></p>')
    out.append(f'{I}    <p class="trail__pain">{pain}</p>')
    if dies:
        out.append(f'{I}    <em class="ow__dies">{dies}</em>')
    out.append(f'{I}  </div>')
for k, pts in DEAD.items():
    x, y = pts[-1]
    out.append(f'{I}  <span class="trail__x" style="{pct(x, y)};--t:{t_at(k) + 0.55:.2f}s" aria-hidden="true">✕</span>')
ex, ey = MAIN[S['end']]
out.append(f'{I}  <span class="trail__end trail__end--finish" style="{pct(ex, ey)};--t:{DRAW_START + DRAW_DUR:.2f}s">finally out, days later</span>')
out.append(f'{I}</div>')
html = '\n'.join(out) + '\n'

# per-dead-end draw delay
dead_css = '\n'.join(
    f'  .in .trail__draw--{k} {{ transition-delay: {t_at(k) + 0.05:.2f}s; }}' for k in DEAD)

page = sys.argv[1]
s = open(page).read()
a = s.index('            <div class="trail"')
b = s.index('            <p class="ow__total ow__total--old">')
s = s[:a] + html + s[b:]
import re
s = re.sub(r'(  \.in \.trail__draw--s\d .*\n)+', dead_css + '\n', s, count=1)
s = re.sub(r'transition-delay: [0-9.]+s;   /\* once the trail', f'transition-delay: {DRAW_START + DRAW_DUR + 0.2:.1f}s;   /* once the trail', s)
s = s.replace('aspect-ratio: 600 / 1180', f'aspect-ratio: 600 / {H}')
s = s.replace('aspect-ratio: 600 / 1720', f'aspect-ratio: 600 / {round(H * 1.75)}')
open(page, 'w').write(s)
print('total len', round(total), {k: round(t_at(k), 2) for k in S})
