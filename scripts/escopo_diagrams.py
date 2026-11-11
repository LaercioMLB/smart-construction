"""Diagramas vetoriais das conexões declaradas no Compose local."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

from reportlab.graphics import renderSVG
from reportlab.graphics.shapes import Drawing, Line, Polygon, PolyLine, Rect, String
from reportlab.lib import colors

RED = colors.HexColor("#C62828")
INK = colors.HexColor("#303033")
GRAY = colors.HexColor("#747478")
PALE = colors.HexColor("#FFF8F8")
RULE = colors.HexColor("#E6DADA")
WHITE = colors.white


@dataclass(frozen=True)
class Node:
    key: str
    x: float
    y: float
    width: float
    height: float
    title: str
    lines: tuple[str, ...] = ()
    local_file: bool = False


@dataclass(frozen=True)
class Edge:
    source: str
    target: str
    points: tuple[tuple[float, float], ...]
    description: str
    label: tuple[float, float, str] | None = None
    local_file: bool = False


RUNTIME_NODES = (
    Node("browser", 164, 384, 164, 40, "Visitante / administrador", ("Navegador web",)),
    Node(
        "gateway",
        164,
        308,
        164,
        48,
        "Gateway Nginx",
        ("gateway :80", "Entrada local :8081"),
    ),
    Node(
        "web",
        20,
        200,
        190,
        62,
        "Frontend Next.js",
        ("web :3000", "Páginas, assets e JSON editorial local"),
    ),
    Node(
        "api",
        282,
        200,
        190,
        62,
        "Backend FastAPI",
        ("api :8000", "Autenticação, cadastros e publicação"),
    ),
    Node(
        "editorial",
        8,
        64,
        146,
        76,
        "SeaweedFS editorial",
        ("storage :8333 / S3", "Bucket smart-assets"),
    ),
    Node(
        "db",
        173,
        64,
        146,
        76,
        "PostgreSQL 17",
        ("db :5432 / SQL", "Banco smart_construction"),
    ),
    Node(
        "private",
        338,
        64,
        146,
        76,
        "SeaweedFS privado",
        ("private-storage :8333 / S3", "Bucket smart-cadastros-private"),
    ),
    Node(
        "editorial_volume",
        8,
        14,
        146,
        30,
        "storage-data",
        ("Volume persistente",),
        True,
    ),
    Node("db_volume", 173, 14, 146, 30, "backend-data", ("Volume persistente",), True),
    Node(
        "private_volume",
        338,
        14,
        146,
        30,
        "private-storage-data",
        ("Volume persistente",),
        True,
    ),
)

RUNTIME_EDGES = (
    Edge(
        "browser",
        "gateway",
        ((246, 384), (246, 356)),
        "HTTP 127.0.0.1:8081 para gateway:80",
        (365, 372, "HTTP :8081 para :80"),
    ),
    Edge(
        "gateway",
        "web",
        ((210, 308), (210, 282), (115, 282), (115, 262)),
        "HTTP :3000 / páginas e assets",
        (110, 291, "HTTP :3000 / páginas e assets"),
    ),
    Edge(
        "gateway",
        "api",
        ((282, 308), (282, 282), (377, 282), (377, 262)),
        "HTTP :8000 /api/v1",
        (381, 291, "HTTP :8000 /api/v1"),
    ),
    Edge(
        "web",
        "api",
        ((210, 232), (282, 232)),
        "HTTP :8000 / leituras SSR e proxy da API",
        (246, 246, "HTTP :8000"),
    ),
    Edge(
        "web",
        "editorial",
        ((81, 200), (81, 140)),
        "HTTP/S3 :8333 /assets / leitura editorial",
        (127, 170, "S3 :8333"),
    ),
    Edge(
        "api",
        "db",
        ((328, 200), (328, 171), (246, 171), (246, 140)),
        "SQL :5432 / runtime smart_api",
        (273, 181, "SQL :5432"),
    ),
    Edge(
        "api",
        "private",
        ((416, 200), (416, 140)),
        "S3 autenticado :8333 / arquivos dos cadastros",
        (454, 170, "S3 :8333"),
    ),
    Edge(
        "editorial",
        "editorial_volume",
        ((81, 64), (81, 44)),
        "Persistência local dos objetos editoriais",
        local_file=True,
    ),
    Edge(
        "db",
        "db_volume",
        ((246, 64), (246, 44)),
        "Persistência local do PostgreSQL",
        local_file=True,
    ),
    Edge(
        "private",
        "private_volume",
        ((411, 64), (411, 44)),
        "Persistência local dos arquivos privados",
        local_file=True,
    ),
)

PREPARATION_NODES = (
    Node("migration", 4, 320, 182, 44, "api-migrate", ("Alembic / smart_migrator",)),
    Node(
        "admin_cli",
        4,
        266,
        182,
        44,
        "CLI manual dentro da API",
        ("Administrador, profissões e auditoria",),
    ),
    Node(
        "tests",
        4,
        212,
        182,
        44,
        "api-test / perfil tools",
        ("Bancos smart_test_<uuid> e objetos S3",),
    ),
    Node(
        "private_init",
        4,
        158,
        182,
        44,
        "private-storage-init",
        ("Preparação do bucket privado",),
    ),
    Node(
        "editorial_tools",
        4,
        78,
        182,
        64,
        "storage-init / storage-cli",
        ("Carga de public/images, índice", "e manutenção editorial sob demanda"),
    ),
    Node(
        "db",
        337,
        276,
        151,
        76,
        "PostgreSQL 17",
        ("db :5432 / SQL", "Migrations, gestão e testes isolados"),
    ),
    Node(
        "private",
        337,
        184,
        151,
        76,
        "SeaweedFS privado",
        ("private-storage :8333 / S3", "Bootstrap e testes de arquivos"),
    ),
    Node(
        "editorial",
        337,
        90,
        151,
        76,
        "SeaweedFS editorial",
        ("storage :8333 / S3", "Objetos, políticas e índice"),
    ),
    Node(
        "setup",
        4,
        0,
        150,
        44,
        "Setup local",
        ("setup.*, backend-setup", "storage-setup"),
        True,
    ),
    Node("config", 185, 0, 126, 44, ".env e .secrets", ("Arquivos locais",), True),
    Node(
        "compose", 342, 0, 146, 44, "Docker Compose", ("Injeta env e segredos",), True
    ),
)

PREPARATION_EDGES = (
    Edge(
        "migration",
        "db",
        ((186, 342), (256, 342), (256, 334), (337, 334)),
        "SQL :5432 / migrações Alembic",
    ),
    Edge(
        "admin_cli",
        "db",
        ((186, 288), (282, 288), (282, 314), (337, 314)),
        "SQL :5432 / gestão manual",
    ),
    Edge(
        "tests",
        "db",
        ((186, 234), (306, 234), (306, 294), (337, 294)),
        "SQL :5432 / bancos smart_test_<uuid>",
    ),
    Edge(
        "tests",
        "private",
        ((186, 220), (260, 220), (260, 226), (337, 226)),
        "S3 :8333 / objetos isolados de teste",
    ),
    Edge(
        "private_init",
        "private",
        ((186, 180), (282, 180), (282, 206), (337, 206)),
        "S3 :8333 / bootstrap privado",
    ),
    Edge(
        "editorial_tools",
        "editorial",
        ((186, 112), (337, 112)),
        "S3 :8333 / carga e manutenção editorial",
    ),
    Edge(
        "setup",
        "config",
        ((154, 22), (185, 22)),
        "Cria e preserva configuração e segredos locais",
        local_file=True,
    ),
    Edge(
        "config",
        "compose",
        ((311, 22), (342, 22)),
        "Montagem de secrets e variáveis nos serviços",
        local_file=True,
    ),
)


def add_node(drawing: Drawing, node: Node) -> None:
    drawing.add(
        Rect(
            node.x,
            node.y,
            node.width,
            node.height,
            rx=7,
            ry=7,
            fillColor=WHITE if node.local_file else PALE,
            strokeColor=RULE if node.local_file else RED,
            strokeWidth=0.8,
        )
    )
    center = node.x + node.width / 2
    gap = 11
    line_count = 1 + len(node.lines)
    baseline = node.y + node.height / 2 + (line_count - 1) * gap / 2 - 3
    drawing.add(
        String(
            center,
            baseline,
            node.title,
            textAnchor="middle",
            fontName="Helvetica-Bold",
            fontSize=9.3,
            fillColor=INK,
        )
    )
    for index, text in enumerate(node.lines, 1):
        drawing.add(
            String(
                center,
                baseline - gap * index,
                text,
                textAnchor="middle",
                fontName="Helvetica",
                fontSize=7.6,
                fillColor=GRAY,
            )
        )


def add_edge(drawing: Drawing, edge: Edge) -> None:
    color = GRAY if edge.local_file else RED
    points = [coordinate for point in edge.points for coordinate in point]
    drawing.add(
        PolyLine(
            points,
            strokeColor=color,
            strokeWidth=1.2,
            strokeDashArray=[3, 3] if edge.local_file else None,
            fillColor=None,
        )
    )
    previous, end = edge.points[-2:]
    angle = math.atan2(end[1] - previous[1], end[0] - previous[0])
    size, spread = 5, 2.5
    back_x = end[0] - size * math.cos(angle)
    back_y = end[1] - size * math.sin(angle)
    drawing.add(
        Polygon(
            [
                end[0],
                end[1],
                back_x + spread * math.sin(angle),
                back_y - spread * math.cos(angle),
                back_x - spread * math.sin(angle),
                back_y + spread * math.cos(angle),
            ],
            fillColor=color,
            strokeColor=color,
            strokeWidth=0.3,
        )
    )
    if edge.label:
        x, y, label = edge.label
        drawing.add(
            String(
                x,
                y,
                label,
                textAnchor="middle",
                fontName="Helvetica",
                fontSize=7.4,
                fillColor=INK,
            )
        )


def diagram(kind: str, width: float | None = None) -> Drawing:
    if kind == "runtime":
        drawing = Drawing(492, 430)
        drawing.add(
            Rect(
                0,
                6,
                492,
                365,
                rx=10,
                ry=10,
                strokeColor=RULE,
                strokeWidth=0.8,
                fillColor=WHITE,
            )
        )
        drawing.add(
            String(
                10,
                375,
                "Rede Docker smart-construction_default",
                fontName="Helvetica",
                fontSize=7.5,
                fillColor=GRAY,
            )
        )
        nodes, edges = RUNTIME_NODES, RUNTIME_EDGES
    elif kind == "preparation":
        drawing = Drawing(492, 382)
        drawing.add(
            String(
                4,
                373,
                "TAREFAS SOB DEMANDA",
                fontName="Helvetica-Bold",
                fontSize=7.3,
                fillColor=GRAY,
            )
        )
        drawing.add(
            String(
                337,
                373,
                "DESTINOS INTERNOS",
                fontName="Helvetica-Bold",
                fontSize=7.3,
                fillColor=GRAY,
            )
        )
        drawing.add(Line(4, 60, 488, 60, strokeColor=RULE, strokeWidth=0.7))
        nodes, edges = PREPARATION_NODES, PREPARATION_EDGES
    else:
        raise ValueError(f"Diagrama desconhecido: {kind}")
    for edge in edges:
        add_edge(drawing, edge)
    for node in nodes:
        add_node(drawing, node)
    if width is not None:
        factor = width / drawing.width
        drawing.scale(factor, factor)
        drawing.width *= factor
        drawing.height *= factor
    return drawing


def mermaid(kind: str) -> str:
    nodes, edges = (
        (RUNTIME_NODES, RUNTIME_EDGES)
        if kind == "runtime"
        else (PREPARATION_NODES, PREPARATION_EDGES)
    )
    output = ["flowchart TB"]
    for node in nodes:
        label = "<br/>".join(
            text.replace("<", "&lt;").replace(">", "&gt;")
            for text in (node.title, *node.lines)
        )
        output.append(f'  {node.key}["{label}"]')
    for edge in edges:
        arrow = "-.->" if edge.local_file else "-->"
        description = edge.description.replace("<", "&lt;").replace(">", "&gt;")
        output.append(f'  {edge.source} {arrow}|"{description}"| {edge.target}')
    output.extend(
        [
            "  classDef default fill:#fff8f8,stroke:#c62828,color:#303033;",
        ]
    )
    return "\n".join(output) + "\n"


def write_assets(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for kind in ("runtime", "preparation"):
        renderSVG.drawToFile(diagram(kind), str(directory / f"{kind}-connections.svg"))
        (directory / f"{kind}-connections.mmd").write_text(
            mermaid(kind), encoding="utf-8"
        )
