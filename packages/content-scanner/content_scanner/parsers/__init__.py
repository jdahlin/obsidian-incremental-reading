"""Document parsers."""

from content_scanner.parsers.pdf import parse_pdf
from content_scanner.parsers.html import parse_html

__all__ = ["parse_pdf", "parse_html"]
