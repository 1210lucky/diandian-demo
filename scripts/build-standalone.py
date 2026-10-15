from pathlib import Path
import base64, mimetypes, re
root = Path(__file__).resolve().parent.parent

def asset(path):
    p = root / path
    kind = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return 'data:' + kind + ';base64,' + base64.b64encode(p.read_bytes()).decode()

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
