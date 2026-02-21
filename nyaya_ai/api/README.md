# NyayaAI FastAPI Backend

REST API for NyayaAI contract analysis system.

## Endpoints

### Health Check
```
GET /health
```
Returns API health status and configuration.

### Analyze Contract
```
POST /analyze
```
Upload and analyze a PDF contract.

**Request:**
- Content-Type: multipart/form-data
- Body: PDF file

**Response:**
```json
{
  "job_id": "20260221_143022",
  "overall_risk_score": 67,
  "risk_distribution": {
    "high": 25.0,
    "medium": 45.0,
    "low": 30.0
  },
  "total_clauses": 20,
  "high_risk_count": 5,
  "medium_risk_count": 9,
  "low_risk_count": 6,
  "citations_found": 12,
  "redlines_generated": 14,
  "executive_summary": "...",
  "top_risks": ["..."],
  "files": {
    "risk_report": "20260221_143022/risk_report_20260221_143022.json",
    "executive_summary": "20260221_143022/executive_summary_20260221_143022.txt"
  }
}
```

### Download File
```
GET /download/{job_id}/{filename}
```
Download analysis output files.

### Get Job Info
```
GET /jobs/{job_id}
```
Get information about a specific analysis job.

## Running

```bash
uvicorn api.app:app --reload --port 8000
```

Access interactive docs at: http://localhost:8000/docs

## Configuration

Set `GOOGLE_API_KEY` in `.env` file.
