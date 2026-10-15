from pathlib import Path
import base64, mimetypes, re, io
from PIL import Image
from functools import lru_cache
root = Path(__file__).resolve().parent.parent

@lru_cache(maxsize=None)
def asset(path):
    p = root / path
    kind = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    data = p.read_bytes()
    if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
        im = Image.open(io.BytesIO(data))
        side = 96 if 'avatar' in p.name else 480
        im.thumbnail((side, side))
        output = io.BytesIO()
        im.save(output, format='WEBP', quality=75, method=6)
        data = output.getvalue()
        kind = 'image/webp'
    return 'data:' + kind + ';base64,' + base64.b64encode(data).decode()

html = (root / 'index.template.html').read_text()
html = re.sub(r'<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?">', lambda m: '<style>' + (root/m[1]).read_text() + '</style>', html)
html = re.sub(r'src="(assets/[^"?]+)(?:\?[^"]*)?"', lambda m: 'src="'+asset(m[1])+'"', html)
def script(m):
    js = (root/m[1]).read_text()
    js = re.sub(r'assets/[A-Za-z0-9_/-]+\.svg', lambda a: asset(a[0]), js)
    return '<script>' + js.replace('</script', '<\\/script') + '</script>'
html = re.sub(r'<script src="([^"?]+)(?:\?[^"]*)?"></script>', script, html)
(root/'index.html').write_text(html)
print('Built standalone page:',len(html.encode()),'bytes')
