"""Build an offline, portable HTML with all runtime code and assets embedded."""
import base64
from pathlib import Path
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
license_text = (root / 'assets' / 'Inter-LICENSE.txt').read_text()
html = html.replace('</head>', '<!-- Embedded Inter font license:\n' + license_text.replace('--', '—') + '\n-->\n</head>')
css = (root / 'styles.css').read_text()
for name in ['inter-400.woff2', 'inter-600.woff2']:
    data = base64.b64encode((root / 'assets' / name).read_bytes()).decode()
    css = css.replace('assets/' + name, 'data:font/woff2;base64,' + data)
html = html.replace('<link rel="stylesheet" href="styles.css" />', '<style>\n' + css + '\n</style>')
for name in ['embed.js', 'sfg1013.js', 'routing.js', 'ua741.js', 'presets.js', 'app.js', 'layout.js', 'schematics.js']:
    html = html.replace(f'<script src="{name}"></script>', '<script>\n' + (root / name).read_text() + '\n</script>')
for name, mime in [('chula-logo.webp', 'image/webp'), ('favicon.svg', 'image/svg+xml')]:
    data = base64.b64encode((root / 'assets' / name).read_bytes()).decode()
    html = html.replace('assets/' + name, f'data:{mime};base64,' + data)
(root / 'gds1202b_opamp_sim_single_file.html').write_text(html)
print('Standalone simulator rebuilt with embedded assets.')
