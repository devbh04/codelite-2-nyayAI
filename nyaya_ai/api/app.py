"""
FastAPI Backend for NyayaAI
Provides REST API endpoints for contract analysis
"""

import os
import logging
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
import tempfile
import json

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from orchestrator.workflow import create_workflow
from agents.summary_agent import create_summary_agent

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="NyayaAI API",
    description="Multi-Agent AI System for Legal Contract Red-Flagging (India-Focused)",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global workflow instance
workflow = None


def truncate_to_complete_sentence(text: str, max_length: int = 400) -> str:
    """
    Truncate text to a reasonable length, but only at sentence boundaries.
    If text is longer than max_length, find the last complete sentence within that limit.
    
    Args:
        text: The text to truncate
        max_length: Maximum character length before truncation
    
    Returns:
        Truncated text ending with a complete sentence
    """
    if len(text) <= max_length:
        return text
    
    # Find the last sentence ending within max_length
    truncated = text[:max_length]
    
    # Look for sentence endings: period, exclamation, question mark
    last_period = truncated.rfind('.')
    last_exclamation = truncated.rfind('!')
    last_question = truncated.rfind('?')
    
    # Find the rightmost sentence ending
    last_sentence_end = max(last_period, last_exclamation, last_question)
    
    if last_sentence_end > 0:
        # Include the punctuation mark
        return truncated[:last_sentence_end + 1]
    else:
        # No sentence ending found, just truncate and add ellipsis
        return truncated.rstrip() + "..."
output_dir = Path("api_outputs")
output_dir.mkdir(exist_ok=True)


class HealthResponse(BaseModel):
    status: str
    api_key_configured: bool
    timestamp: str


class AnalysisStatus(BaseModel):
    status: str
    message: str
    job_id: str = None


class AnalysisResult(BaseModel):
    job_id: str
    overall_risk_score: int
    risk_distribution: Dict[str, float]
    total_clauses: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    citations_found: int
    redlines_generated: int
    executive_summary: str
    top_risks: list
    files: Dict[str, str]


@app.on_event("startup")
async def startup_event():
    """Initialize workflow on startup"""
    global workflow
    api_key = os.getenv("GOOGLE_API_KEY")
    
    if not api_key:
        logger.error("GOOGLE_API_KEY not found in environment")
        raise RuntimeError("GOOGLE_API_KEY not configured")
    
    try:
        workflow = create_workflow(api_key=api_key)
        logger.info("NyayaAI workflow initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize workflow: {e}")
        raise


@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "message": "NyayaAI API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    api_key = os.getenv("GOOGLE_API_KEY")
    
    return HealthResponse(
        status="healthy" if workflow and api_key else "unhealthy",
        api_key_configured=bool(api_key),
        timestamp=datetime.now().isoformat()
    )


def save_analysis_outputs(final_state: Dict[str, Any], job_dir: Path, job_id: str):
    """
    Save all outputs from the workflow to files.
    
    Args:
        final_state: Final state from workflow execution
        job_dir: Directory to save outputs
        job_id: Job identifier for file naming
    """
    # 1. Save Risk Report JSON
    risk_summary = final_state.get("contract_risk_summary")
    risk_report = {
        "analysis_timestamp": datetime.now().isoformat(),
        "pdf_path": final_state.get("pdf_path", ""),
        "overall_risk_score": risk_summary.overall_risk_score if risk_summary else 0,
        "risk_distribution": {
            "high": risk_summary.risk_distribution.high if risk_summary else 0,
            "medium": risk_summary.risk_distribution.medium if risk_summary else 0,
            "low": risk_summary.risk_distribution.low if risk_summary else 0,
        } if risk_summary else {},
        "total_clauses": len(final_state.get("clauses", [])),
        "high_risk_clauses": sum(1 for r in final_state.get("risk_outputs", []) if r.risk_level.value == "High"),
        "medium_risk_clauses": sum(1 for r in final_state.get("risk_outputs", []) if r.risk_level.value == "Medium"),
        "low_risk_clauses": sum(1 for r in final_state.get("risk_outputs", []) if r.risk_level.value == "Low"),
        "clauses": [
            {
                "clause_id": c.clause_id,
                "heading": c.heading,
                "page": c.page,
                "type": final_state["classified_dict"].get(c.clause_id, "Unknown"),
                "risk_level": final_state["risk_levels_dict"].get(c.clause_id).value if c.clause_id in final_state["risk_levels_dict"] else "Unknown",
                "risk_score": next((r.risk_score for r in final_state["risk_outputs"] if r.clause_id == c.clause_id), 0)
            }
            for c in final_state.get("clauses", [])
        ],
        "citations": [
            {
                "clause_id": c.clause_id,
                "found": c.found,
                "section": c.section,
                "law_name": c.law_name,
                "explanation": c.explanation
            }
            for c in final_state.get("citations", [])
        ],
        "redlines": [
            {
                "clause_id": r.clause_id,
                "original": truncate_to_complete_sentence(r.original_text, 300),
                "suggested": truncate_to_complete_sentence(r.suggested_text, 400),
                "rationale": r.rationale
            }
            for r in final_state.get("redlines", [])
        ]
    }
    
    risk_report_path = job_dir / f"risk_report_{job_id}.json"
    with open(risk_report_path, 'w', encoding='utf-8') as f:
        json.dump(risk_report, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Risk report saved: {risk_report_path}")
    
    # 2. Save Executive Summary Text
    if final_state.get("executive_summary"):
        api_key = os.getenv("GOOGLE_API_KEY")
        summary_agent = create_summary_agent(api_key)
        summary_text = summary_agent.create_executive_summary_text(
            final_state["executive_summary"]
        )
        
        summary_path = job_dir / f"executive_summary_{job_id}.txt"
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(summary_text)
        
        logger.info(f"Executive summary saved: {summary_path}")
    
    # 3. Save annotated markdown if available
    markdown_path = final_state.get("markdown_path")
    if markdown_path and Path(markdown_path).exists():
        with open(markdown_path, 'r', encoding='utf-8') as f:
            markdown_content = f.read()
        
        annotated_path = job_dir / f"annotated_contract_{job_id}.md"
        with open(annotated_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        logger.info(f"Annotated contract saved: {annotated_path}")


@app.post("/analyze", response_model=AnalysisResult)
async def analyze_contract(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """
    Analyze a contract PDF
    
    Args:
        file: PDF file to analyze
        
    Returns:
        Analysis results with risk scores, citations, and suggestions
    """
    if not workflow:
        raise HTTPException(status_code=503, detail="Workflow not initialized")
    
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Generate job ID
    job_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    job_dir = output_dir / job_id
    job_dir.mkdir(exist_ok=True)
    
    # Save uploaded file
    pdf_path = job_dir / file.filename
    try:
        with open(pdf_path, "wb") as f:
            content = await file.read()
            f.write(content)
        logger.info(f"Saved uploaded file: {pdf_path}")
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Run analysis
    try:
        logger.info(f"Starting analysis for job {job_id}")
        result = workflow.execute(str(pdf_path))
        logger.info(f"Analysis complete for job {job_id}")
        
        # Save outputs to job directory
        save_analysis_outputs(result, job_dir, job_id)
        logger.info(f"Outputs saved for job {job_id}")
        
        # Extract results
        risk_summary = result.get("contract_risk_summary")
        if not risk_summary:
            raise HTTPException(status_code=500, detail="Analysis failed to produce risk summary")
        
        # Count items
        clauses = result.get("clauses", [])
        citations = result.get("citations", [])
        redlines = result.get("redlines", [])
        risk_levels = result.get("risk_levels_dict", {})
        
        # Count risk levels properly (handle both enum and string values)
        high_count = sum(1 for v in risk_levels.values() if (v.value if hasattr(v, 'value') else v) == "High")
        medium_count = sum(1 for v in risk_levels.values() if (v.value if hasattr(v, 'value') else v) == "Medium")
        low_count = sum(1 for v in risk_levels.values() if (v.value if hasattr(v, 'value') else v) == "Low")
        
        # Get executive summary
        exec_summary = result.get("executive_summary", "")
        if hasattr(exec_summary, 'summary_text'):
            exec_summary_text = exec_summary.summary_text
        else:
            exec_summary_text = str(exec_summary)
        
        # Extract top risks
        top_risks = []
        if hasattr(exec_summary, 'top_risks'):
            top_risks = exec_summary.top_risks[:5]
        
        # Find output files
        files = {}
        for f in job_dir.glob("*"):
            if f.is_file() and f.name != file.filename:
                files[f.stem] = str(f.relative_to(output_dir))
        
        # Convert risk distribution to dict
        risk_dist_dict = {
            "high": risk_summary.risk_distribution.high,
            "medium": risk_summary.risk_distribution.medium,
            "low": risk_summary.risk_distribution.low
        }
        
        return AnalysisResult(
            job_id=job_id,
            overall_risk_score=risk_summary.overall_risk_score,
            risk_distribution=risk_dist_dict,
            total_clauses=len(clauses),
            high_risk_count=high_count,
            medium_risk_count=medium_count,
            low_risk_count=low_count,
            citations_found=len(citations),
            redlines_generated=len(redlines),
            executive_summary=exec_summary_text,
            top_risks=top_risks,
            files=files
        )
        
    except Exception as e:
        logger.error(f"Analysis failed for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/download/{job_id}/{filename}")
async def download_file(job_id: str, filename: str):
    """Download analysis output file"""
    file_path = output_dir / job_id / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type='application/octet-stream'
    )


@app.get("/jobs/{job_id}")
async def get_job_info(job_id: str):
    """Get information about a specific job"""
    job_dir = output_dir / job_id
    
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    
    files = [f.name for f in job_dir.glob("*") if f.is_file()]
    
    return {
        "job_id": job_id,
        "files": files,
        "created": datetime.fromtimestamp(job_dir.stat().st_mtime).isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
