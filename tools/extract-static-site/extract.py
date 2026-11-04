#!/usr/bin/env python3
"""
One-off: turn the approved v1.4.0 pages into the content model the dashboard edits.

  python3 tools/extract-static-site/extract.py <folder with the v1.4.0 build> content

For each page it writes content/pages/<slug>.json:
  head      everything up to and including <main id="main">, with the SEO values, analytics and asset
            version as tokens ({{seo:title}}, {{site:analytics}}, {{site:v}} ...)
  sections  each <section> in <main> as a part: tag, attributes and its inner HTML with every editable
            value replaced by {{fN}}, plus the values (Heading, Paragraph, Photo, Button link ...)
  tail      everything after the footer (pop-up, structured data, scripts), with tokens
and content/chrome.json with the footer, shared by every page.

Rendering the result with the v1.4.0 settings gives the v1.4.0 pages back byte for byte, apart from the
<!-- config:... --> markers the old build used (scripts/qa-parity.ts proves it).
Kept in the repo for the record; it is not part of the build.
"""
import json
import os
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
ORIGIN = 'https://example.com'

PAGES = [
    # file, slug, name, path, group
    ('index.html', 'home', 'Home', '/', 'Main pages'),
    ('book-now/index.html', 'book-now', 'Book Now', '/book-now/', 'Main pages'),
    ('privacy-policy/index.html', 'privacy-policy', 'Privacy Policy', '/privacy-policy/', 'Legal and practice information'),
    ('404.html', 'not-found', 'Page not found', '/404', 'Legal and practice information'),
]

VOID = {'img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'track', 'wbr', 'area', 'base', 'col', 'embed', 'param'}
RAW = {'script', 'style', 'textarea', 'title'}
INLINE = {'a', 'strong', 'em', 'b', 'i', 'span', 'br', 'sup', 'sub', 'mark', 'small', 'abbr', 'time', 's', 'u', 'q', 'cite', 'code'}
SKIP = {'svg', 'script', 'style', 'template', 'noscript', 'select', 'textarea', 'iframe', 'video', 'audio', 'canvas'}


class Node:
    def __init__(self, tag, start, open_end, attrs_raw):
        self.tag = tag
        self.start = start          # index of '<'
        self.open_end = open_end    # index after '>' of the opening tag
        self.close_start = open_end  # index of '</tag>'
        self.end = open_end          # index after the closing tag
        self.attrs_raw = attrs_raw
        self.children = []
        self.parent = None

    def attr(self, name):
        m = re.search(r'(?:^|\s)' + re.escape(name) + r'(?:="([^"]*)")?(?=\s|/?$)', self.attrs_raw)
        if not m:
            return None
        return m.group(1) if m.group(1) is not None else ''


def parse(html, base=0):
    """A small parser for the generated, well formed pages. Returns the root's children."""
    root = Node('#root', 0, 0, '')
    stack = [root]
    i = 0
    n = len(html)
    while i < n:
        lt = html.find('<', i)
        if lt < 0:
            break
        if html.startswith('<!--', lt):
            i = html.index('-->', lt) + 3
            continue
        if html.startswith('<!', lt):
            i = html.index('>', lt) + 1
            continue
        m = re.match(r'<(/?)([a-zA-Z][\w:-]*)', html[lt:lt + 64])
        if not m:
            i = lt + 1
            continue
        j = lt + len(m.group(0))
        q = None
        while j < n:
            c = html[j]
            if q:
                if c == q:
                    q = None
            elif c in '"\'':
                q = c
            elif c == '>':
                break
            j += 1
        tag = m.group(2).lower()
        if m.group(1):  # closing
            while len(stack) > 1:
                top = stack.pop()
                if top.tag == tag:
                    top.close_start = lt
                    top.end = j + 1
                    break
            i = j + 1
            continue
        raw_attrs = html[lt + len(m.group(0)):j].rstrip('/').strip()
        node = Node(tag, lt, j + 1, raw_attrs)
        node.parent = stack[-1]
        stack[-1].children.append(node)
        i = j + 1
        if tag in VOID or html[j - 1] == '/':
            node.close_start = node.end = j + 1
            continue
        if tag in RAW:
            close = html.lower().index('</' + tag, i)
            node.close_start = close
            node.end = html.index('>', close) + 1
            i = node.end
            continue
        stack.append(node)
    return root.children


def text_of(html):
    t = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    t = re.sub(r'\{\{site:\w+\}\}', ' ', t)
    t = re.sub(r'<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


LABELS = {
    'h1': 'Main heading', 'h2': 'Heading', 'h3': 'Small heading', 'h4': 'Small heading', 'p': 'Paragraph',
    'li': 'List item', 'blockquote': 'Quote', 'figcaption': 'Caption', 'button': 'Button words', 'label': 'Label',
    'dt': 'Term', 'dd': 'Description', 'span': 'Words', 'div': 'Words', 'summary': 'Question', 'a': 'Link words',
}


class Extractor:
    def __init__(self):
        self.n = 0
        self.fields = []

    def new(self, label, ftype, value, **extra):
        self.n += 1
        fid = f'f{self.n}'
        f = {'id': fid, 'label': label, 'type': ftype, 'value': value}
        f.update(extra)
        self.fields.append(f)
        return fid

    def no_edit(self, node):
        """Parts the booking script fills in, and offer wording that only shows while a special is running."""
        if node.attr('hidden') is not None:
            return True
        if node.attr('id') == 'booking':
            return True
        cls = node.attr('class') or ''
        return bool(re.search(r'\b(special-ribbon|special-note|special-card|faq-count)\b', cls))

    def is_text_container(self, node, html):
        """Only words and inline markup inside, with something to read."""
        def inline_only(nd):
            for c in nd.children:
                if c.tag not in INLINE or c.tag == 'a' and (c.attr('class') or '').find('btn') >= 0:
                    return False
                if not inline_only(c):
                    return False
            return True
        inner = html[node.open_end:node.close_start]
        return inline_only(node) and text_of(inner) != ''

    def render(self, node, html, mirrors):
        """The node's source with editable values replaced by {{fN}}."""
        out = []
        pos = node.open_end
        for c in node.children:
            out.append(self.text_between(html, pos, c.start))
            out.append(self.node_html(c, html, mirrors))
            pos = c.end
        out.append(self.text_between(html, pos, node.close_start))
        return ''.join(out)

    def text_between(self, html, a, b):
        """Loose words next to an icon (a button's label beside its arrow) become a field of their own."""
        seg = html[a:b]
        out = []
        for part in re.split(r'(<!--.*?-->)', seg, flags=re.S):
            if part.startswith('<!--') or not text_of(part):
                out.append(part)
                continue
            m = re.match(r'^(\s*)(.*?)(\s*)$', part, re.S)
            out.append(m.group(1) + '{{' + self.new('Words', 'text', m.group(2)) + '}}' + m.group(3))
        return ''.join(out)

    def open_tag(self, node, html, repl):
        t = html[node.start:node.open_end]
        for attr, fid in repl:
            t = re.sub(r'(\s' + re.escape(attr) + r'=")[^"]*(")', lambda m: m.group(1) + '{{' + fid + '}}' + m.group(2), t, count=1)
        return t

    def node_html(self, node, html, mirrors):
        tag = node.tag
        whole = html[node.start:node.end]
        if tag in SKIP or self.no_edit(node):
            return whole
        if tag == 'picture':
            return self.picture(node, html)
        if tag == 'img':
            return self.img(node, html, None)
        if tag in VOID:
            return whole
        inner = html[node.open_end:node.close_start]
        if tag == 'a' or (tag == 'button'):
            # a button or a link standing on its own: its words, and for a link its address
            repl = []
            href = node.attr('href')
            if tag == 'a' and href is not None and '{{' not in href:
                repl.append(('href', self.new('Button link' if 'btn' in (node.attr('class') or '') else 'Link address', 'href', href)))
            if node.children and not self.is_text_container(node, html):
                body = self.render(node, html, mirrors)
            elif text_of(inner):
                key = text_of(inner)
                if tag == 'button' and key in mirrors:
                    body = '{{' + mirrors[key] + '}}'
                else:
                    body = '{{' + self.new('Button words' if tag == 'button' or 'btn' in (node.attr('class') or '') else 'Link words',
                                          'richtext' if node.children else 'text', inner) + '}}'
            else:
                body = inner
            return self.open_tag(node, html, repl) + body + html[node.close_start:node.end]
        if self.is_text_container(node, html):
            label = LABELS.get(tag, 'Words')
            cls = node.attr('class') or ''
            if 'eyebrow' in cls:
                label = 'Small heading above'
            elif tag == 'p' and 'sub' in cls.split():
                label = 'Introduction'
            fid = self.new(label, 'richtext', inner)
            if tag in ('h3',) and node.parent is not None and 'faq-card' in (node.parent.attr('class') or ''):
                mirrors.setdefault('__faq__', []).append((text_of(inner), fid))
            return html[node.start:node.open_end] + '{{' + fid + '}}' + html[node.close_start:node.end]
        return html[node.start:node.open_end] + self.render(node, html, mirrors) + html[node.close_start:node.end]

    def img(self, node, html, srcset_of):
        repl = []
        src = node.attr('src')
        alt = node.attr('alt')
        if src is None or '{{' in src:
            return html[node.start:node.end]
        fid = self.new('Photo', 'image', src, original=src)
        repl.append(('src', fid))
        if alt is not None and alt != '':
            repl.append(('alt', self.new('Photo description', 'alt', alt)))
        if srcset_of is not None:
            srcset_of.append(fid)
        return self.open_tag(node, html, repl)

    def picture(self, node, html):
        # the <img> decides the photo; each <source> follows it (dropped back to the one photo once replaced)
        img = [c for c in node.children if c.tag == 'img']
        if not img:
            return html[node.start:node.end]
        out = html[node.start:node.open_end]
        holder = []
        img_html = self.img(img[0], html, holder)
        img_id = holder[0] if holder else None
        pos = node.open_end
        for c in node.children:
            out += html[pos:c.start]
            if c.tag == 'source' and img_id:
                srcset = c.attr('srcset')
                sid = self.new('Photo sizes', 'srcset', srcset, of=img_id)
                out += re.sub(r'(\ssrcset=")[^"]*(")', lambda m: m.group(1) + '{{' + sid + '}}' + m.group(2), html[c.start:c.end], count=1)
            elif c is img[0]:
                out += img_html
            else:
                out += html[c.start:c.end]
            pos = c.end
        out += html[pos:node.close_start] + html[node.close_start:node.end]
        return out


def attrs_of(node, html):
    raw = html[node.start + len(node.tag) + 1:node.open_end - 1].rstrip('/')
    out = {}
    for m in re.finditer(r'([\w:-]+)(?:="([^"]*)")?', raw):
        out[m.group(1)] = m.group(2) if m.group(2) is not None else None
    return out


def section_label(node, html, i):
    lab = node.attr('aria-label')
    if lab:
        return lab
    h = re.search(r'<h([12])[^>]*>(.*?)</h\1>', html[node.open_end:node.close_start], re.S)
    if h:
        t = text_of(h.group(2))
        return t if len(t) <= 60 else t[:57].rsplit(' ', 1)[0] + '...'
    return f'Section {i + 1}'


def unmark_config(s):
    return re.sub(r'<!-- /?config:\w+ -->', '', s)


def tokenise_head(head, page):
    title = re.search(r'<title>(.*?)</title>', head).group(1)
    desc_m = re.search(r'<meta name="description" content="([^"]*)"/>', head)
    meta = {'title': title}
    head = head.replace(f'<title>{title}</title>', '<title>{{seo:title}}</title>', 1)
    for prop in ('og:title', 'twitter:title'):
        key = 'property' if prop.startswith('og') else 'name'
        head = head.replace(f'<meta {key}="{prop}" content="{title}"/>', f'<meta {key}="{prop}" content="{{{{seo:title}}}}"/>')
    if desc_m:
        d = desc_m.group(1)
        meta['description'] = d
        head = head.replace(f'<meta name="description" content="{d}"/>', '<meta name="description" content="{{seo:description}}"/>')
        head = head.replace(f'<meta property="og:description" content="{d}"/>', '<meta property="og:description" content="{{seo:description}}"/>')
        head = head.replace(f'<meta name="twitter:description" content="{d}"/>', '<meta name="twitter:description" content="{{seo:description}}"/>')
    url = ORIGIN + page['path']
    head = head.replace(f'<link rel="canonical" href="{url}"/>', '<link rel="canonical" href="{{seo:url}}"/>')
    head = head.replace(f'<meta property="og:url" content="{url}"/>', '<meta property="og:url" content="{{seo:url}}"/>')
    og = re.search(r'<meta property="og:image" content="([^"]*)"/>', head)
    if og:
        meta['ogImage'] = og.group(1).replace(ORIGIN, '')
        head = head.replace(og.group(0), '<meta property="og:image" content="{{seo:ogImage}}"/>')
        head = head.replace(f'<meta name="twitter:image" content="{og.group(1)}"/>', '<meta name="twitter:image" content="{{seo:ogImage}}"/>')
        extra = re.search(r'<meta property="og:image:width"[^>]*/><meta property="og:image:height"[^>]*/><meta property="og:image:alt"[^>]*/>', head)
        head = head.replace(extra.group(0), '{{seo:ogImageExtra}}')
    robots = '<meta name="robots" content="noindex, follow"/>'
    meta['noindex'] = robots in head
    head = head.replace(robots, '')
    head = head.replace('<meta name="application-name" content="The Anxious Patient Experience™"/>',
                        '<meta name="application-name" content="The Anxious Patient Experience™"/>{{seo:robots}}', 1)
    head = re.sub(r'<!-- config:analytics -->.*?<!-- /config:analytics -->', '{{site:analytics}}', head)
    head = head.replace('?v=1.4.0', '?v={{site:v}}')
    # the Blog link joins the menus once the first post is published
    head = re.sub(r'(<li><a href="/?#faqs" data-section="faqs">FAQs</a></li>)', r'\1{{site:blogNav}}', head)
    assert '{{seo:robots}}' in head and 'example.com' not in head, page['slug']
    return head, meta


def tokenise_tail(tail, page_slug):
    tail = re.sub(r'<!-- config:schema -->.*?<!-- /config:schema -->', '{{site:schema}}', tail, flags=re.S)
    tail = re.sub(r'<script type="application/ld\+json">\{"@context":"https://schema.org","@type":"FAQPage".*?</script>',
                  '{{gen:faqSchema}}', tail, flags=re.S)
    tail = tail.replace(ORIGIN, '{{site:origin}}').replace('?v=1.4.0', '?v={{site:v}}')
    return tail


def footer_part(html):
    nodes = parse(html)
    footer = None

    def find(ns):
        nonlocal footer
        for nd in ns:
            if nd.tag == 'footer':
                footer = nd
                return
            find(nd.children)
    find(nodes)
    seg = html[footer.start:footer.end]
    seg = re.sub(r'<!-- config:contact -->.*?<!-- /config:contact -->', '{{site:footerContact}}', seg, flags=re.S)
    seg = unmark_config(seg)
    seg = seg.replace('href="#top"', 'href="{{site:pageTop}}"')
    seg = re.sub(r'href="#(understanding|who-is-it-for|meet-the-team|faqs)"', r'href="{{site:pageBase}}#\1"', seg)
    seg = seg.replace('<li><a href="{{site:pageBase}}#faqs">FAQs</a></li>', '<li><a href="{{site:pageBase}}#faqs">FAQs</a></li>{{site:blogFooter}}')
    root = parse(seg)[0]
    ex = Extractor()
    template = ex.render(root, seg, {})
    return {
        'key': 'footer', 'kind': 'footer', 'label': 'Footer', 'tag': 'footer', 'attrs': attrs_of(root, seg),
        'template': template, 'fields': ex.fields,
    }


def extract_page(file, slug, name, path, group):
    html = open(os.path.join(SRC, file), encoding='utf-8').read()
    main_open = html.index('<main id="main">') + len('<main id="main">')
    main_close = html.index('</main>')
    fstart = html.index('<footer')
    fend = html.index('</footer>') + len('</footer>')
    assert html[main_close:fstart] == '</main>', slug
    page = {'slug': slug, 'name': name, 'path': path, 'group': group}
    head, meta = tokenise_head(html[:main_open], page)
    main = unmark_config(html[main_open:main_close])
    main = re.sub(r'<a href="tel:\+61285999815">\(02\) 8599 9815</a>', '{{site:phoneLink}}', main)
    main = re.sub(r'<span class="clinic-name">The Cronulla Dentists</span> <span class="clinic-address">.*?</a></span>',
                  '{{site:clinicLine}}', main, flags=re.S)
    assert 'example.com' not in main
    nodes = parse(main)
    sections = []
    order = []
    between = []
    pos = 0
    for i, nd in enumerate(nodes):
        assert nd.tag == 'section', (slug, nd.tag)
        between.append(main[pos:nd.start])
        pos = nd.end
        ex = Extractor()
        mirrors = {}
        # FAQ: the quick links repeat each question, so they share the question's field
        if 'faqs-section' in (nd.attr('class') or ''):
            template = ex.render(nd, main, mirrors)
            qmap = {t: fid for t, fid in mirrors.pop('__faq__', [])}
            template = rewrite_jumps(template, qmap, ex.fields)
        else:
            template = ex.render(nd, main, mirrors)
        cls = nd.attr('class') or ''
        kind = 'hero' if re.search(r'\bhero\b', cls) and i == 0 else ('faq' if 'faqs-section' in cls else 'content')
        sections.append({
            'key': nd.attr('id') or f's{i + 1}', 'kind': kind, 'label': section_label(nd, main, i), 'tag': 'section',
            'attrs': attrs_of(nd, main), 'template': template, 'fields': ex.fields,
        })
        order.append(f'section:{i}')
    assert all(b == '' for b in between) and main[pos:] == '', slug
    tail = tokenise_tail(html[fend:], slug)
    page.update({'meta': meta, 'head': head, 'sections': sections, 'order': order, 'tail': tail})
    return page, html


def rewrite_jumps(template, qmap, fields):
    """<button class="faq-jump" ...>{{f12}}</button> -> the question's own field, and drop the copy."""
    drop = set()

    def sub(m):
        fid = m.group(2)
        f = next(x for x in fields if x['id'] == fid)
        q = text_of(f['value'])
        if q in qmap:
            drop.add(fid)
            return m.group(1) + '{{' + qmap[q] + '}}' + m.group(3)
        return m.group(0)
    template = re.sub(r'(<button type="button" class="faq-jump"[^>]*>)\{\{(f\d+)\}\}(</button>)', sub, template)
    fields[:] = [f for f in fields if f['id'] not in drop]
    return template


def main():
    os.makedirs(os.path.join(OUT, 'pages'), exist_ok=True)
    chrome = None
    for file, slug, name, path, group in PAGES:
        page, html = extract_page(file, slug, name, path, group)
        if chrome is None:
            chrome = {'parts': {'footer': footer_part(html)}}
        with open(os.path.join(OUT, 'pages', f'{slug}.json'), 'w', encoding='utf-8') as fh:
            json.dump(page, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        print(slug, len(page['sections']), 'sections', sum(len(s['fields']) for s in page['sections']), 'fields')
    with open(os.path.join(OUT, 'chrome.json'), 'w', encoding='utf-8') as fh:
        json.dump(chrome, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print('footer', len(chrome['parts']['footer']['fields']), 'fields')


main()
