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

    def render_briefing(self, view_model: Any) -> str:
        """
        Renders a briefing report using the provided View Model.
        
        Args:
            view_model: A BriefingReportViewModel instance containing pre-formatted data.
        """
        template = self._env.get_template("briefing_report.html")
        return template.render(view_model=view_model)
