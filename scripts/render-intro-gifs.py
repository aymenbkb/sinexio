"""Render the custom intro artwork as seamless 2D GIFs and still PNGs."""
from pathlib import Path
import math
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'img'
SIZE, SCALE, FRAMES = 320, 3, 100
PEACH, EDGE, PALE = '#FFC6A5', '#F3A47D', '#FFF3EA'


def point(x, y):
    return (round(x*SCALE), round(y*SCALE))


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(tuple(round(v*SCALE) for v in box), fill, outline, round(width*SCALE))


def line(draw, pts, color, width=2):
    draw.line([point(*p) for p in pts], fill=color, width=round(width*SCALE), joint='curve')


def ornament(draw, t):
    for a in range(0, 360, 12):
        r = math.radians(a)
        x, y = 160+128*math.cos(r), 160+128*math.sin(r)
        ellipse(draw, (x-1, y-1, x+1, y+1), '#FBE1CE')
    for x, y, phase in [(58,75,0), (271,135,1.7), (70,248,3.2)]:
        extent = 3 + 2*(1+math.sin(t+phase))
        line(draw, [(x-extent,y),(x+extent,y)], '#F6BB95', 1.6)
        line(draw, [(x,y-extent),(x,y+extent)], '#F6BB95', 1.6)
    a = -t + .6
    x, y = 160+128*math.cos(a), 160+128*math.sin(a)
    ellipse(draw, (x-4,y-4,x+4,y+4), '#FFD1B2')


def gear(draw, cx, cy, radius, teeth, rotation, fill):
    pts = []
    for tooth in range(teeth):
        for fraction, size in [(0,.85),(.18,.85),(.29,1),(.71,1),(.82,.85)]:
            a = rotation + (tooth+fraction)*math.tau/teeth
            pts.append(point(cx+radius*size*math.cos(a),cy+radius*size*math.sin(a)))
    draw.polygon(pts, fill=fill)
    draw.line(pts+[pts[0]], fill=EDGE, width=round(1.7*SCALE), joint='curve')
    ellipse(draw,(cx-radius*.57,cy-radius*.57,cx+radius*.57,cy+radius*.57),'#FFE4CF',EDGE,1.3)
    for n in range(3):
        a = rotation+n*math.tau/3
        x,y=cx+radius*.41*math.cos(a),cy+radius*.41*math.sin(a)
        ellipse(draw,(x-3,y-3,x+3,y+3),'#F7B891')
    ellipse(draw,(cx-radius*.23,cy-radius*.23,cx+radius*.23,cy+radius*.23),(0,0,0,0),EDGE,1.8)
    ellipse(draw,(cx-3,cy-3,cx+3,cy+3),'#FFD7B9')


def gear_frame(t):
    im=Image.new('RGBA',(SIZE*SCALE,)*2); d=ImageDraw.Draw(im)
    ornament(d,t)
    # 12:8 ratio and opposite rotation keep the teeth in sync.
    gear(d,126,133,73,12,2*t,PEACH)
    gear(d,211,210,48.7,8,-3*t+.23,'#FFDBBD')
    return im


def wrench_frame(t):
    im=Image.new('RGBA',(SIZE*SCALE,)*2); d=ImageDraw.Draw(im)
    ornament(d,t)
    tool=Image.new('RGBA',im.size); w=ImageDraw.Draw(tool)
    # Open jaw, rounded handle, inset grip and engraved details.
    w.rounded_rectangle(tuple(round(v*SCALE) for v in (141,118,179,266)),radius=19*SCALE,fill=PEACH,outline=EDGE,width=2*SCALE)
    ellipse(w,(112,54,208,150),PEACH,EDGE,2)
    w.polygon([point(132,45),point(143,99),point(160,111),point(177,99),point(188,45)],fill=(0,0,0,0))
    line(w,[(132,55),(143,99),(160,111),(177,99),(188,55)],EDGE,2)
    w.rounded_rectangle(tuple(round(v*SCALE) for v in (151,156,169,226)),radius=9*SCALE,fill='#FFE3CA')
    line(w,[(148,137),(148,148)],'#FFF6EF',3)
    for y in (174,185,196,207):
        line(w,[(156,y),(164,y-3)],'#F4B58D',1.2)
    ellipse(w,(153,241,167,255),(0,0,0,0),EDGE,1.5)
    angle=-34+11*math.sin(t)
    tool=tool.rotate(angle,resample=Image.Resampling.BICUBIC,center=point(160,158))
    im.alpha_composite(tool,(0,round(3*SCALE*math.sin(t))))
    # A small turning hex fastener reinforces the tool's mechanical motion.
    d=ImageDraw.Draw(im)
    pts=[point(236+19*math.cos(t+i*math.tau/6),70+19*math.sin(t+i*math.tau/6)) for i in range(6)]
    d.polygon(pts,fill='#FFE3CA'); d.line(pts+[pts[0]],fill=EDGE,width=2*SCALE)
    ellipse(d,(229,63,243,77),(0,0,0,0),EDGE,1.4)
    return im


def render(name, draw_frame):
    frames=[draw_frame(math.tau*i/FRAMES).resize((SIZE,SIZE),Image.Resampling.LANCZOS) for i in range(FRAMES)]
    # One shared palette prevents frame-to-frame colour shimmer.
    palette=frames[0].convert('RGB').quantize(colors=128,method=Image.Quantize.MEDIANCUT)
    indexed=[]
    for frame in frames:
        gif_frame=frame.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)
        # GIF has binary alpha: reserve index 255 for transparent pixels.
        gif_frame.paste(255,mask=frame.getchannel('A').point(lambda a: 255 if a < 128 else 0))
        gif_frame.info['transparency']=255
        indexed.append(gif_frame)
    # Clear each frame to transparency so moving artwork leaves no trails.
    indexed[0].save(OUT/f'{name}.gif',save_all=True,append_images=indexed[1:],duration=40,loop=0,optimize=False,disposal=2,transparency=255,background=255)
    frames[0].save(OUT/f'{name}-still.png')
    with Image.open(OUT/f'{name}.gif') as check:
        assert check.n_frames==FRAMES and check.info['loop']==0
        assert check.info['transparency']==255
        for i in range(check.n_frames):
            check.seek(i)
            assert check.convert('RGBA').getpixel((0,0))[3]==0
    print(f'{name}: {FRAMES} frames, 4s seamless loop, {(OUT / (name+".gif")).stat().st_size // 1024} KB')


if __name__=='__main__':
    render('intro-wrench',wrench_frame)
    render('intro-gears',gear_frame)
