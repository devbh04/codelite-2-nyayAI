import os
import asyncio
import tempfile
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymupdf4llm

from database import users_collection
from negotiation import run_negotiation

app = FastAPI(title="NyayaAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth Models ──────────────────────────────────────────────────────────────

class SignUpRequest(BaseModel):
    name: str
    phone: str


class SignInRequest(BaseModel):
    phone: str


class UserResponse(BaseModel):
    id: str
    name: str
    phone: str


# ── Auth Endpoints ───────────────────────────────────────────────────────────

@app.post("/auth/signup", response_model=UserResponse)
async def signup(req: SignUpRequest):
    existing = await users_collection.find_one({"phone": req.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user_doc = {
        "name": req.name,
        "phone": req.phone,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await users_collection.insert_one(user_doc)
    return UserResponse(id=str(result.inserted_id), name=req.name, phone=req.phone)


@app.post("/auth/signin", response_model=UserResponse)
async def signin(req: SignInRequest):
    user = await users_collection.find_one({"phone": req.phone})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please sign up first.")
    return UserResponse(id=str(user["_id"]), name=user["name"], phone=user["phone"])


# ── Upload Endpoint ──────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        markdown_text = pymupdf4llm.to_markdown(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to convert PDF: {str(e)}")
    finally:
        os.unlink(tmp_path)

    return {"markdown": markdown_text, "filename": file.filename}


# ── Generate Final Draft ─────────────────────────────────────────────────────

class Replacement(BaseModel):
    original: str
    replacement: str

class GenerateDraftRequest(BaseModel):
    original_md: str
    replacements: list[Replacement]

@app.post("/generate-draft")
async def generate_draft(req: GenerateDraftRequest):
    """
    Simple find-and-replace: for each accepted replacement, find the original
    clause text in the markdown and replace it with the new clause wrapped in
    a <mark> tag for green highlighting on frontend.
    """
    result = req.original_md
    for r in req.replacements:
        if r.original and r.replacement:
            highlighted = f'<mark data-negotiated="accepted">{r.replacement}</mark>'
            result = result.replace(r.original, highlighted, 1)
    return {"markdown": result}


# ── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── WebSocket Negotiation ────────────────────────────────────────────────────

@app.websocket("/ws/negotiate")
async def negotiate_ws(websocket: WebSocket):
    await websocket.accept()

    try:
        # Receive initial payload
        data = await websocket.receive_json()
        risks = data.get("risks", [])

        if not risks:
            await websocket.send_json({"type": "error", "message": "No risks provided"})
            await websocket.close()
            return

        # Negotiate each risk sequentially
        for risk in risks:
            try:
                async for event in run_negotiation(risk):
                    await websocket.send_json(event)
                    await asyncio.sleep(0.1)

            except Exception as e:
                print(f"[negotiate] Error for {risk.get('id', '?')}: {e}")
                await websocket.send_json({
                    "type": "error",
                    "risk_id": risk.get("id", ""),
                    "message": str(e),
                })

        await websocket.send_json({"type": "done"})
        print(f"[negotiate] Done. Debated {len(risks)} risks.")

    except WebSocketDisconnect:
        print("[negotiate] Client disconnected")
    except Exception as e:
        print(f"[negotiate] Fatal error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
