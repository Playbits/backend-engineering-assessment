from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"


class ReportFormatter:
    """Starter formatter utility for future report-generation work."""

    def __init__(self) -> None:
        self._env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(enabled_extensions=("html", "xml"), default_for_string=True),
        )

    def render_briefing(self, briefing: Any) -> str:
        template = self._env.get_template("briefing_report.html")
        return template.render(briefing=briefing, generated_at=self.generated_timestamp())

    @staticmethod
    def generated_timestamp() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
