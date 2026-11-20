import sys, json, numpy as np
from PIL import Image, ImageFilter
src=sys.argv[1]
im=np.asarray(Image.open(src).convert('RGB')).astype(int)
H,W,_=im.shape
pts={'helix':(150,300),'scapha':(600,400),'antihelix':(450,400),'fossa':(290,290),'cymba':(350,500),
'cavum':(380,650),'tragus':(150,700),'antitragus':(360,900),'lobule':(300,1050)}
ref={k:im[y-4:y+5,x-4:x+5].reshape(-1,3).mean(0) for k,(x,y) in pts.items()}
for k,v in ref.items(): print(k,[int(a) for a in v])
keys=list(ref); R=np.array([ref[k] for k in keys])
mx=im.max(2); mn=im.min(2); sat=mx-mn
d=((im[:,:,None,:]-R[None,None])**2).sum(-1)
lab=d.argmin(2); dmin=np.sqrt(d.min(2))
fg=(sat>28)&(dmin<70)
lab=np.where(fg,lab,-1)
# mode filter
L=Image.fromarray((lab+1).astype(np.uint8)).filter(ImageFilter.ModeFilter(7))
lab=np.asarray(L).astype(int)-1
from scipy import ndimage
for i in range(len(keys)):
    cc,n=ndimage.label(lab==i)
    if n>1:
        sizes=ndimage.sum(np.ones_like(cc),cc,range(1,n+1))
        keep=[j+1 for j,sz in enumerate(sizes) if sz>=0.05*sizes.max()]
        lab[(lab==i)&~np.isin(cc,keep)]=-1
ys,xs=np.where(lab>=0); x0,x1,y0,y1=xs.min()-10,xs.max()+10,ys.min()-10,ys.max()+10
lab=lab[y0:y1,x0:x1]; h,w=lab.shape
OW=760; OH=round(h*OW/w); s=OW/w
print('out',OW,OH)
cent={}
for i,k in enumerate(keys):
    yy,xx=np.where(lab==i); cent[k]=[round(float(np.median(xx))*s),round(float(np.median(yy))*s),int(len(xx))]
json.dump({'size':[OW,OH],'cent':cent,'colors':{k:'#%02X%02X%02X'%tuple(int(a) for a in ref[k]) for k in keys}},open('meta.json','w'),indent=1)
def render(sel):
    # Fondo transparente: la oreja se apoya sobre el crema de la tarjeta
    out=np.zeros((h,w,4),np.uint8); out[...,:3]=250
    for i,k in enumerate(keys):
        m=lab==i
        out[m,3]=255
        if sel is None or k==sel: out[m,:3]=ref[k].astype(np.uint8)
        else: out[m,:3]=(226,232,228)  # gris verdoso suave, de la familia jade
    return Image.fromarray(out,'RGBA').resize((OW,OH),Image.LANCZOS)
import os; os.makedirs('out',exist_ok=True)  # salida en ./out/
render(None).save('out/oreja-partes.png',optimize=True)
for k in keys: render(k).save(f'out/oreja-{k}.png',optimize=True)
