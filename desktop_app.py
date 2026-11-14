"""
MARSWALK Desktop Application Shell.
Native desktop wrapper built with PySide6 and QtWebEngine.
Provides an integrated hardware-accelerated workstation with native menu controls,
shortcut keys, and an embedded background API server.
"""
import sys
import os
import threading
import time
import urllib.request

from PySide6.QtCore import QUrl, Qt
from PySide6.QtGui import QIcon, QKeySequence, QAction
from PySide6.QtWidgets import (
    QApplication,
    QMainWindow,
    QMessageBox,
    QStatusBar,
    QVBoxLayout,
    QWidget
)
from PySide6.QtWebEngineWidgets import QWebEngineView

# Embedded FastAPI server runner
def start_backend_server():
    import uvicorn
    from backend.main import app
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

def wait_for_server(url="http://127.0.0.1:8000/health", timeout_sec=10):
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False

class MarswalkMainWindow(QMainWindow):
    def __init__(self, app_url="http://127.0.0.1:8000"):
        super().__init__()
        self.app_url = app_url
        self.setWindowTitle("MARSWALK — Martian Astronaut Route and Scientific Exploration Planner")
        self.resize(1440, 900)
        self.setMinimumSize(1024, 700)

        # Main Central WebEngine View
        self.browser = QWebEngineView(self)
        self.browser.setUrl(QUrl(self.app_url))
        self.setCentralWidget(self.browser)

        # Status Bar
        self.status_bar = QStatusBar(self)
        self.setStatusBar(self.status_bar)
        self.status_bar.setStyleSheet("background-color: #0E131D; color: #64748B; font-family: monospace; font-size: 11px;")
        self.status_bar.showMessage(
            "MARSWALK 3D Workstation | Sector: Jezero Crater (18.4°N, 77.4°E) | USGS 20m CTX DTM: 2,413,152 Nodes | NASA Space Apps 2026"
        )

        self._create_menus()

    def _create_menus(self):
        menubar = self.menuBar()
        menubar.setStyleSheet("""
            QMenuBar { background-color: #0E131D; color: #F8FAFC; border-bottom: 1px solid #1F293D; }
            QMenuBar::item:selected { background-color: #1F293D; }
            QMenu { background-color: #0E131D; color: #F8FAFC; border: 1px solid #1F293D; }
            QMenu::item:selected { background-color: #38BDF8; color: #000000; font-weight: bold; }
        """)

        # 1. Mission Menu
        mission_menu = menubar.addMenu("&Mission")

        briefing_act = QAction("Generate Expedition Briefing", self)
        briefing_act.setShortcut(QKeySequence("Ctrl+E"))
        briefing_act.triggered.connect(self._action_briefing)
        mission_menu.addAction(briefing_act)

        mission_menu.addSeparator()

        quit_act = QAction("Exit Workstation", self)
        quit_act.setShortcut(QKeySequence("Ctrl+Q"))
        quit_act.triggered.connect(self.close)
        mission_menu.addAction(quit_act)

        # 2. View Menu
        view_menu = menubar.addMenu("&View")

        reload_act = QAction("Reload Viewport", self)
        reload_act.setShortcut(QKeySequence.Refresh)
        reload_act.triggered.connect(self.browser.reload)
        view_menu.addAction(reload_act)

        fullscreen_act = QAction("Toggle Fullscreen", self)
        fullscreen_act.setShortcut(QKeySequence("F11"))
        fullscreen_act.triggered.connect(self._toggle_fullscreen)
        view_menu.addAction(fullscreen_act)

        zoom_in_act = QAction("Zoom UI In", self)
        zoom_in_act.setShortcut(QKeySequence.ZoomIn)
        zoom_in_act.triggered.connect(lambda: self.browser.setZoomFactor(self.browser.zoomFactor() + 0.1))
        view_menu.addAction(zoom_in_act)

        zoom_out_act = QAction("Zoom UI Out", self)
        zoom_out_act.setShortcut(QKeySequence.ZoomOut)
        zoom_out_act.triggered.connect(lambda: self.browser.setZoomFactor(max(0.7, self.browser.zoomFactor() - 0.1)))
        view_menu.addAction(zoom_out_act)

        # 3. Help Menu
        help_menu = menubar.addMenu("&Help")

        datasets_act = QAction("Planetary Datasets Provenance", self)
        datasets_act.triggered.connect(self._show_datasets_info)
        help_menu.addAction(datasets_act)

        about_act = QAction("About MARSWALK", self)
        about_act.triggered.connect(self._show_about)
        help_menu.addAction(about_act)

    def _toggle_fullscreen(self):
        if self.isFullScreen():
            self.showNormal()
        else:
            self.showFullScreen()

    def _action_briefing(self):
        # Trigger report button via JavaScript in WebEngine
        self.browser.page().runJavaScript(
            "document.querySelector('button:has(svg.lucide-file-text)')?.click();"
        )

    def _show_datasets_info(self):
        QMessageBox.information(
            self,
            "Integrated Planetary Datasets",
            "MARSWALK Planetary Dataset Heritage:\n\n"
            "• USGS Mars 2020 20m CTX DTM: 2.41 million metric elevation nodes (MOLA geoid datum).\n"
            "• NASA Mars Trek CTX WMTS: 6m/pixel orthorectified imagery mosaic.\n"
            "• USGS SIM 3464: Geologic Map of Jezero Crater & Nili Planum (1:75,000 scale).\n"
            "• Perseverance Rover MEDA: In-situ diurnal atmospheric pressure, temperature, wind, and dust.\n"
            "• MSL Curiosity RAD: Gale Crater surface ionizing radiation dosimetry benchmark (0.64 mSv/day)."
        )

    def _show_about(self):
        QMessageBox.about(
            self,
            "About MARSWALK",
            "MARSWALK — Martian Astronaut Route & Scientific Exploration Planner\n"
            "NASA Space Apps Challenge 2026\n\n"
            "A scientifically grounded 3D Martian exploration, terrain intelligence, "
            "and astronaut EVA mission-planning platform.\n\n"
            "Engineered with Python, FastAPI, NumPy, SciPy, Three.js, React, OpenLayers, and PySide6."
        )

def main():
    # Start embedded server thread if not already running
    try:
        urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1)
        server_ready = True
    except Exception:
        server_ready = False

    if not server_ready:
        server_thread = threading.Thread(target=start_backend_server, daemon=True)
        server_thread.start()
        wait_for_server()

    # Launch PySide6 GUI
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    window = MarswalkMainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
