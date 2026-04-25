"""Vitals — Personal health data dashboard."""
import os
import secrets
from pathlib import Path
from datetime import datetime, timedelta

import bcrypt
from fastapi import FastAPI, Request, Form, HTTPException, Depends, status
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"
SCRIPTS_DIR = BASE_DIR.parent / "scripts"

load_dotenv(BASE_DIR.parent / ".env")

SECRET_KEY = os.environ["VITALS_SECRET_KEY"]
AUTH_EMAIL = os.environ["VITALS_AUTH_EMAIL"].lower()
AUTH_HASH = os.environ["VITALS_AUTH_HASH"].encode()
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
COOKIE_NAME = "vitals_session"

signer = URLSafeTimedSerializer(SECRET_KEY, salt="vitals-session")

app = FastAPI(title="Vitals")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


def current_user(request: Request) -> str | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        email = signer.loads(token, max_age=SESSION_MAX_AGE)
        return email
    except (BadSignature, SignatureExpired):
        return None


def require_auth(request: Request) -> str:
    user = current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_303_SEE_OTHER,
            headers={"Location": "/login"},
        )
    return user


def human_size(n: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def list_tree(rel_path: str = ""):
    """Safe listing of data dir preventing path traversal."""
    target = (DATA_DIR / rel_path).resolve()
    if not str(target).startswith(str(DATA_DIR.resolve())):
        raise HTTPException(403, "Forbidden path")
    if not target.exists():
        raise HTTPException(404, "Not found")

    if target.is_file():
        return None, target

    entries = []
    for p in sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
        if p.name.startswith("."):
            continue
        entries.append({
            "name": p.name,
            "is_dir": p.is_dir(),
            "rel": str(p.relative_to(DATA_DIR)),
            "size": human_size(p.stat().st_size) if p.is_file() else "",
            "mtime": datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d"),
        })
    return entries, target


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str | None = None):
    if current_user(request):
        return RedirectResponse("/", status_code=303)
    return templates.TemplateResponse("login.html", {"request": request, "error": error})


@app.post("/login")
async def login_submit(request: Request, email: str = Form(...), password: str = Form(...)):
    if email.lower() != AUTH_EMAIL or not bcrypt.checkpw(password.encode(), AUTH_HASH):
        return RedirectResponse("/login?error=1", status_code=303)
    token = signer.dumps(email.lower())
    resp = RedirectResponse("/", status_code=303)
    resp.set_cookie(
        COOKIE_NAME, token,
        max_age=SESSION_MAX_AGE,
        httponly=True, secure=True, samesite="lax",
    )
    return resp


@app.get("/logout")
async def logout():
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(COOKIE_NAME)
    return resp


@app.get("/", response_class=HTMLResponse)
async def home(request: Request, user: str = Depends(require_auth)):
    # Top-level stats
    categories = []
    for item in sorted(DATA_DIR.iterdir()):
        if item.name.startswith(".") or item.is_file():
            continue
        file_count = sum(1 for _ in item.rglob("*") if _.is_file())
        categories.append({
            "name": item.name,
            "rel": item.name,
            "count": file_count,
        })
    root_files = [p for p in DATA_DIR.iterdir() if p.is_file() and not p.name.startswith(".")]
    return templates.TemplateResponse("home.html", {
        "request": request, "user": user,
        "categories": categories, "root_files": root_files,
    })


@app.get("/browse/{rel_path:path}", response_class=HTMLResponse)
async def browse(request: Request, rel_path: str, user: str = Depends(require_auth)):
    entries, target = list_tree(rel_path)
    if entries is None:
        # file — serve inline
        return FileResponse(target, filename=target.name)

    parts = []
    accum = ""
    for part in rel_path.split("/"):
        if not part:
            continue
        accum = f"{accum}/{part}" if accum else part
        parts.append({"name": part, "rel": accum})

    return templates.TemplateResponse("browse.html", {
        "request": request, "user": user,
        "entries": entries, "breadcrumbs": parts,
        "current": rel_path,
    })


@app.get("/reports", response_class=HTMLResponse)
async def reports(request: Request, user: str = Depends(require_auth)):
    pdfs = sorted(DATA_DIR.rglob("*.pdf"))
    report_list = [{
        "name": p.name,
        "rel": str(p.relative_to(DATA_DIR)),
        "size": human_size(p.stat().st_size),
        "mtime": datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d"),
    } for p in pdfs]
    report_list.sort(key=lambda x: x["mtime"], reverse=True)
    return templates.TemplateResponse("reports.html", {
        "request": request, "user": user, "reports": report_list,
    })


@app.get("/health-check")
async def health_check():
    return {"ok": True, "ts": datetime.utcnow().isoformat()}
