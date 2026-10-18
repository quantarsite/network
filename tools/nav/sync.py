#!/usr/bin/env python3
"""Puts the same site menu on every page.

Run from the repo root:  python3 tools/nav/sync.py
To change the menu (links, order, look), edit LINKS or nav.html here and run
again. The block between <!-- QN-NAV START --> and <!-- QN-NAV END --> is
rewritten on every page; nothing else is touched once a page is converted.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent

LINKS = [
    ("home", "/", "Home"),
    ("technology", "/technology", "Technology"),
    ("hydrax", "/hydrax", "HYDRA-X"),
    ("benchmark", "/benchmark", "Benchmark"),
    ("whitepaper", "/whitepaper", "Whitepaper"),
    ("article", "/article", "Article"),
    ("testnet", "/testnet", "Testnet"),
    ("monitor", "/monitor", "Monitor"),
    ("team", "/professionalteam", "Team"),
    ("cashbook", "/cashbook", "Cash Book"),
]
CTA = ("invest", "/invest", "Invest")

# page file -> (active key, needs spacer). The spacer keeps content from
# sliding under the fixed menu on pages whose old menu was in the page flow.
PAGES = {
    "index.html": ("home", False),
    "technology/index.html": ("technology", True),
    "hydrax/index.html": ("hydrax", False),
    "benchmark/index.html": ("benchmark", True),
    "whitepaper/index.html": ("whitepaper", False),
    "article/index.html": ("article", True),
    "testnet.html": ("testnet", False),
    "monitor.html": ("monitor", True),
    "professionalteam/index.html": ("team", True),
    "cashbook/index.html": ("cashbook", False),
    "invest/index.html": ("invest", False),
    "dataroom.html": ("invest", True),
    "tools/dataroom/template.html": ("invest", True),
    "tools/dataroom/cashbook.template.html": ("cashbook", False),
}

START, END = "<!-- QN-NAV START -->", "<!-- QN-NAV END -->"


def block(active, spacer):
    def link(key, href, label, cls="qn-link"):
        cur = ' aria-current="page"' if key == active else ""
        return f'<a class="{cls}" href="{href}"{cur}>{label}</a>'
    links = "\n        ".join(link(*l) for l in LINKS)
    cta = link(*CTA, cls="qn-link qn-cta")
    html = (HERE / "nav.html").read_text(encoding="utf-8")
    html = html.replace("{{LINKS}}", links).replace("{{CTA}}", cta)
    html = html.replace("{{SPACER}}", '<div class="qn-nav-spacer" aria-hidden="true"></div>' if spacer else "")
    return f"{START}\n{html.strip()}\n{END}"


def convert(path, active, spacer):
    p = ROOT / path
    s = p.read_text(encoding="utf-8")
    new = block(active, spacer)
    if START in s:
        s = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda m: new, s, count=1, flags=re.S)
    else:
        # drop the page's own <nav> (only the first one, the site menu)
        s, n = re.subn(r"\n?[ \t]*(<!--[^>]*NAV[^>]*-->\s*)?<nav\b[^>]*>.*?</nav>", "", s, count=1, flags=re.S)
        m = re.search(r"<body\b[^>]*>", s)
        if not m:
            sys.exit(f"{path}: no <body>")
        s = s[: m.end()] + "\n" + new + "\n" + s[m.end():]
    p.write_text(s, encoding="utf-8")


if __name__ == "__main__":
    for path, (active, spacer) in PAGES.items():
        convert(path, active, spacer)
        print("ok", path)
