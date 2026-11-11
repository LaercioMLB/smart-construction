"""Gera o PDF institucional a partir de docs/escopo.md, sem acessar os serviços."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from escopo_diagrams import diagram, write_assets
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "escopo.md"
LOGO = ROOT / "docs" / "branding" / "bubikas-holdings-logo.png"
RED = colors.HexColor("#C62828")
INK = colors.HexColor("#303033")
MUTED = colors.HexColor("#737378")
RULE = colors.HexColor("#EDDADA")
WHITE = colors.white
WIDTH, HEIGHT = A4
MARGIN = 52
CONTENT_WIDTH = WIDTH - 2 * MARGIN


def register_fonts() -> None:
    """Vera acompanha o ReportLab; as fontes são incorporadas ao PDF."""
    directory = Path(reportlab.__file__).parent / "fonts"
    for name, filename in (("BrandSans", "Vera.ttf"), ("BrandSans-Bold", "VeraBd.ttf")):
        pdfmetrics.registerFont(TTFont(name, str(directory / filename)))
    pdfmetrics.registerFontFamily(
        "BrandSans", normal="BrandSans", bold="BrandSans-Bold"
    )


def styles() -> dict[str, ParagraphStyle]:
    return {
        "page": ParagraphStyle(
            "PageTitle",
            fontName="BrandSans-Bold",
            fontSize=24,
            leading=30,
            textColor=RED,
            spaceAfter=16,
        ),
        "section": ParagraphStyle(
            "Section",
            fontName="BrandSans-Bold",
            fontSize=12,
            leading=18,
            textColor=RED,
            spaceBefore=12,
            spaceAfter=8,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            fontName="BrandSans",
            fontSize=10.2,
            leading=15.2,
            textColor=INK,
            spaceAfter=9,
        ),
        "list": ParagraphStyle(
            "List",
            fontName="BrandSans",
            fontSize=10,
            leading=14.5,
            textColor=INK,
        ),
        "marker": ParagraphStyle(
            "Marker",
            fontName="BrandSans-Bold",
            fontSize=9,
            leading=14.5,
            textColor=RED,
            alignment=TA_LEFT,
        ),
        "cover": ParagraphStyle(
            "CoverCopy",
            fontName="BrandSans",
            fontSize=12,
            leading=19,
            textColor=INK,
        ),
    }


def inline_markdown(text: str) -> str:
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escape(text))
    return re.sub(r"`([^`]+)`", r'<font name="Courier" size="9.1">\1</font>', text)


def read_sections() -> dict[int, tuple[str, str]]:
    source = SOURCE.read_text(encoding="utf-8")
    matches = list(re.finditer(r"^## (\d+)\. (.+)$", source, re.MULTILINE))
    sections = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(source)
        sections[int(match[1])] = (match[2], source[match.end() : end].strip())
    if set(sections) != set(range(1, 9)):
        raise ValueError("O escopo deve conter as oito seções numeradas de 1 a 8.")
    return sections


def section_flowables(number: int, title: str, text: str, theme: dict) -> list:
    return [
        Paragraph(f"{number:02d}. {escape(title)}", theme["section"]),
        *markdown_flowables(text, theme),
    ]


def markdown_flowables(text: str, theme: dict) -> list:
    result = []
    for block in re.split(r"\n\s*\n", text):
        lines = block.splitlines()
        image = re.fullmatch(
            r"!\[.*\]\(diagrams/(runtime|preparation)-connections\.svg\)", block
        )
        if image:
            result.extend([diagram(image[1], CONTENT_WIDTH - 12), Spacer(1, 8)])
        elif block.startswith("### "):
            result.append(Paragraph(escape(block[4:]), theme["section"]))
        elif all(re.match(r"^(?:- |\d+\. )", line) for line in lines):
            for line in lines:
                match = re.match(r"^(-|\d+\.)\s+(.+)$", line)
                marker = "•" if match[1] == "-" else match[1]
                row = Table(
                    [
                        [
                            Paragraph(marker, theme["marker"]),
                            Paragraph(inline_markdown(match[2]), theme["list"]),
                        ]
                    ],
                    colWidths=[23, CONTENT_WIDTH - 23],
                    style=TableStyle(
                        [
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 0),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                            ("TOPPADDING", (0, 0), (-1, -1), 0),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                        ]
                    ),
                )
                result.append(KeepTogether([row, Spacer(1, 6)]))
        else:
            result.append(Paragraph(inline_markdown(" ".join(lines)), theme["body"]))
    return result


def draw_logo(pdf: canvas.Canvas, x: float, top: float, width: float) -> None:
    image = ImageReader(str(LOGO))
    pixel_width, pixel_height = image.getSize()
    height = width * pixel_height / pixel_width
    pdf.drawImage(image, x, top - height, width, height, mask="auto")


def spaced_text(pdf: canvas.Canvas, x: float, y: float, text: str) -> None:
    pdf.saveState()
    label = pdf.beginText(x, y)
    label.setFont("BrandSans-Bold", 8)
    label.setCharSpace(1.6)
    label.textOut(text)
    pdf.drawText(label)
    pdf.restoreState()


def draw_cover(pdf: canvas.Canvas, document: SimpleDocTemplate) -> None:
    pdf.saveState()
    pdf.setFillColor(WHITE)
    pdf.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
    draw_logo(pdf, MARGIN - 8, HEIGHT - 48, 274)

    pdf.setFillColor(RED)
    spaced_text(pdf, MARGIN, HEIGHT - 207, "UM PROJETO DA BUBIKAS HOLDINGS")
    pdf.setFont("BrandSans-Bold", 52)
    pdf.drawString(MARGIN - 3, HEIGHT - 274, "Smart")
    pdf.setFont("BrandSans-Bold", 44)
    pdf.drawString(MARGIN - 3, HEIGHT - 329, "Construction")
    pdf.setFillColor(INK)
    pdf.setFont("BrandSans", 15)
    pdf.drawString(MARGIN, HEIGHT - 366, "Escopo de implantação em nuvem")
    pdf.setStrokeColor(RED)
    pdf.setLineWidth(3)
    pdf.line(MARGIN, HEIGHT - 388, MARGIN + 52, HEIGHT - 388)

    copy = Paragraph(
        "Depois do sucesso do <b>Organizadin</b>, a Bubikas Holdings aposta em uma "
        "plataforma para conectar serviços, materiais e profissionais "
        "da construção civil.",
        styles()["cover"],
    )
    _, height = copy.wrap(CONTENT_WIDTH - 25, 100)
    copy.drawOn(pdf, MARGIN, HEIGHT - 413 - height)

    for x, label, value in (
        (MARGIN, "DOCUMENTO", "Escopo de projeto"),
        (MARGIN + 178, "CENÁRIO", "Laboratório acadêmico"),
        (MARGIN + 368, "EDIÇÃO", document.edition),
    ):
        pdf.setFillColor(MUTED)
        pdf.setFont("BrandSans-Bold", 7)
        pdf.drawString(x, 289, label)
        pdf.setFillColor(INK)
        pdf.setFont("BrandSans", 9)
        pdf.drawString(x, 272, value)

    pdf.setFillColor(RED)
    pdf.rect(0, 0, WIDTH, 213, fill=1, stroke=0)
    pdf.setFillColor(WHITE)
    pdf.setFont("BrandSans-Bold", 22)
    pdf.drawString(MARGIN, 154, "Organizadin abriu caminho.")
    pdf.setFont("BrandSans", 17)
    pdf.drawString(MARGIN, 119, "Smart Construction é o próximo passo.")
    pdf.setFont("BrandSans", 9)
    pdf.drawString(MARGIN, 87, "Uma nova iniciativa no portfólio da Bubikas Holdings.")
    pdf.setStrokeColor(colors.HexColor("#E38383"))
    pdf.setLineWidth(0.5)
    pdf.line(MARGIN, 53, WIDTH - MARGIN, 53)
    pdf.setFont("BrandSans", 7.5)
    pdf.drawString(MARGIN, 34, "LABORATÓRIO DE ENGENHARIA DE SOFTWARE")
    pdf.restoreState()


def draw_body_page(pdf: canvas.Canvas, document: SimpleDocTemplate) -> None:
    pdf.saveState()
    draw_logo(pdf, MARGIN - 4, HEIGHT - 31, 137)
    pdf.setFillColor(MUTED)
    pdf.setFont("BrandSans", 7.5)
    pdf.drawRightString(WIDTH - MARGIN, HEIGHT - 48, "SMART CONSTRUCTION / ESCOPO")
    pdf.setStrokeColor(RED)
    pdf.setLineWidth(0.8)
    pdf.line(MARGIN, HEIGHT - 89, WIDTH - MARGIN, HEIGHT - 89)
    pdf.setStrokeColor(RULE)
    pdf.setLineWidth(0.5)
    pdf.line(MARGIN, 53, WIDTH - MARGIN, 53)
    pdf.setFillColor(MUTED)
    pdf.setFont("BrandSans", 7.5)
    pdf.drawString(MARGIN, 34, "BUBIKAS HOLDINGS  /  SMART CONSTRUCTION")
    pdf.restoreState()


class PageNumbers(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.saved_pages = []

    def showPage(self):
        self.saved_pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self.saved_pages)
        for state in self.saved_pages:
            self.__dict__.update(state)
            self.setFillColor(WHITE if self._pageNumber == 1 else MUTED)
            self.setFont("BrandSans", 7.5)
            self.drawRightString(
                WIDTH - MARGIN, 34, f"{self._pageNumber:02d} / {total:02d}"
            )
            super().showPage()
        super().save()


def render(output: Path, edition: str) -> None:
    register_fonts()
    sections = read_sections()
    write_assets(ROOT / "docs" / "diagrams")
    connection_pages = []
    received_title, received_body = sections[3]
    subheadings = list(
        re.finditer(r"^### (3\.[12]\. .+)$", received_body, re.MULTILINE)
    )
    if subheadings:
        if len(subheadings) != 2:
            raise ValueError("O mapa de conexões deve conter as duas vistas 3.1 e 3.2.")
        sections[3] = (received_title, received_body[: subheadings[0].start()].strip())
        for index, match in enumerate(subheadings):
            end = (
                subheadings[index + 1].start()
                if index + 1 < len(subheadings)
                else len(received_body)
            )
            connection_pages.append(
                (match[1], received_body[match.end() : end].strip())
            )
    theme = styles()
    document = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=107,
        bottomMargin=72,
        title="Smart Construction — Escopo | Bubikas Holdings",
        author="Bubikas Holdings",
        subject=(
            "Organizadin e a nova iniciativa Smart Construction; escopo do laboratório"
        ),
        creator="Bubikas Holdings / scripts/render-escopo.py",
        pageCompression=1,
    )
    document.edition = edition
    pages = [
        ("Contexto e plataforma", (1, 2, 3)),
        ("Infraestrutura e planejamento", (4, 5)),
        ("Entregas e critérios de aceite", (6, 7, 8)),
    ]
    story = [Spacer(1, 1), PageBreak()]
    for index, (title, numbers) in enumerate(pages):
        if index:
            story.append(PageBreak())
        story.append(Paragraph(title, theme["page"]))
        for number in numbers:
            section_title, content = sections[number]
            story.extend(section_flowables(number, section_title, content, theme))
        if index == 0:
            for title, content in connection_pages:
                story.extend(
                    [
                        PageBreak(),
                        Paragraph(escape(title), theme["page"]),
                        *markdown_flowables(content, theme),
                    ]
                )
    document.build(
        story,
        onFirstPage=draw_cover,
        onLaterPages=draw_body_page,
        canvasmaker=PageNumbers,
    )
    print(f"PDF gerado: {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "escopo.pdf")
    parser.add_argument("--edition", default="11/11/2026")
    args = parser.parse_args()
    render(args.output.resolve(), args.edition)


if __name__ == "__main__":
    main()
