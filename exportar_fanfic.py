import os
import re

src_dir = 'sagas/harry_black_potter/libros/1_cuervo/capitulos'
out_html_dir = 'export_fanfiction/harry_black_potter/html'
out_txt_dir = 'export_fanfiction/harry_black_potter/txt'

os.makedirs(out_html_dir, exist_ok=True)
os.makedirs(out_txt_dir, exist_ok=True)

files = sorted([f for f in os.listdir(src_dir) if f.endswith('.md')])

def md_to_fanfiction_html(md_text):
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', md_text) if p.strip()]
    html_parts = []
    for p in paragraphs:
        if p.startswith('#'):
            h_text = re.sub(r'^#+\s*', '', p)
            html_parts.append('<p style="text-align:center;"><strong>' + h_text + '</strong></p>')
        else:
            p_html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', p)
            p_html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', p_html)
            html_parts.append('<p>' + p_html + '</p>')
    return '\n\n'.join(html_parts)

def md_to_fanfiction_txt(md_text):
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', md_text) if p.strip()]
    cleaned_paras = []
    for p in paragraphs:
        p_clean = re.sub(r'^#+\s*', '', p)
        p_clean = p_clean.replace('**', '').replace('*', '')
        cleaned_paras.append(p_clean)
    return '\n\n'.join(cleaned_paras)

for f in files:
    base = f[:-3]
    with open(os.path.join(src_dir, f), 'r', encoding='utf-8') as src:
        content = src.read()
    
    html_out = md_to_fanfiction_html(content)
    txt_out = md_to_fanfiction_txt(content)
    
    with open(os.path.join(out_html_dir, base + '.html'), 'w', encoding='utf-8') as hf:
        hf.write(html_out)
    with open(os.path.join(out_txt_dir, base + '.txt'), 'w', encoding='utf-8') as tf:
        tf.write(txt_out)

print(f'Exported {len(files)} chapters successfully!')
