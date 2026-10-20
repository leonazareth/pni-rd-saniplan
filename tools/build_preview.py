"""Gera preview/index.html (sem <html>/<head>/<body>) para a prévia publicada no Claude.
O site do GitHub Pages usa o index.html normal."""
import re
from pathlib import Path
root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', "", head)
(root / "preview.html").write_text(head.strip() + "\n" + body.strip() + "\n", encoding="utf-8")
print("preview.html ok")
