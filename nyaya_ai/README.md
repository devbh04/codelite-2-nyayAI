# 🏛️ NyayaAI

**Production-Grade Multi-Agent AI System for Autonomous Legal Contract Red-Flagging (India-Focused)**

NyayaAI is an intelligent contract analysis system that uses multiple specialized AI agents coordinated through LangGraph to identify risks, provide legal references, and suggest improvements for contracts under Indian law.

---

## 🎯 Features

- **📄 PDF to Markdown Conversion**: Structured extraction of contract clauses (machine-readable PDFs only)
- **🏷️ Intelligent Clause Classification**: Categorizes clauses into 13 types (Termination, Indemnity, Arbitration, etc.)
- **⚠️ Risk Detection & Scoring**: 
  - Qualitative risk assessment via LLM
  - Deterministic scoring via rule-based engine
  - Three-tier risk system (High/Medium/Low)
  - **Smart Tagging**: Only flags clauses with actual risks (H/M/L with issues)
  - Standard/fair/balanced clauses remain untagged for cleaner output
- **⚖️ Legal Cross-Reference**: Retrieves relevant Indian law citations (Contract Act 1872, IT Act 2000, etc.)
- **✏️ Redline Suggestions**: Generates balanced clause rewrites with rationale
- **📊 Executive Summaries**: Non-lawyer friendly contract summaries
- **🤝 Negotiation Simulation**: (Bonus) Simulates contract negotiations between parties

---

## 🏗️ Architecture

```
PDF → Markdown → Classification → Risk Detection → Legal Retrieval → Redlining → Summary
```

### Tech Stack

- **Python 3.11+**
- **LangGraph** (Mandatory workflow orchestration)
- **LangChain Core** (Agent framework)
- **FastAPI** (Future API support)
- **DuckDuckGo Search** (Real-time legal web search)
- **Google Gemini 2.0-flash-exp** (AI model)
- **PyMuPDF** (PDF processing)
- **Pydantic** (Data validation)

### Project Structure

```
nyaya_ai/
├── agents/
│   ├── clause_classifier.py      # Classifies clause types
│   ├── risk_detector.py           # Detects and tags risks
│   ├── legal_retriever.py         # Finds legal citations
│   ├── redline_generator.py       # Generates suggestions
│   ├── summary_agent.py           # Creates executive summary
│   └── negotiation_simulator.py   # Simulates negotiations (bonus)
│
├── orchestrator/
│   └── workflow.py                # LangGraph orchestration
│
├── schemas/
│   └── models.py                  # Pydantic models
│
├── risk_engine.py                 # Deterministic scoring engine
├── pdf_to_markdown.py             # PDF extraction module
├── main.py                        # Entry point
├── requirements.txt
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11 or higher
- Google API key (Gemini)
- Machine-readable PDF contracts (no OCR support)

### Installation

1. **Clone the repository**

```bash
cd nyaya_ai
```

2. **Create virtual environment**

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

3. **Install dependencies**

```bash
pip install -r requirements.txt
```

4. **Configure environment**

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Google API key
# GOOGLE_API_KEY=your_key_here
# Get your key from: https://makersuite.google.com/app/apikey
```

### Usage

**🌟 Recommended: Web Interface**

The easiest way to use NyayaAI is through the Streamlit web interface:

```bash
# Terminal 1: Start backend
uvicorn api.app:app --reload

# Terminal 2: Start frontend
streamlit run streamlit_app.py
```

Then open http://localhost:8501 in your browser and upload your contract!

See [RUN.md](RUN.md) for detailed instructions.

**Alternative: Command Line**

```bash
python main.py --pdf path/to/contract.pdf
```

**With custom output directory:**

```bash
python main.py --pdf contract.pdf --output my_analysis
```

**With debug logging:**

```bash
python main.py --pdf contract.pdf --log-level DEBUG --log-file analysis.log
```

---

## 📋 Output Files

After analysis, you'll get:

1. **`risk_report_YYYYMMDD_HHMMSS.json`**
   - Complete analysis in JSON format
   - Clause-by-clause risk scores
   - All citations and redlines

2. **`executive_summary_YYYYMMDD_HHMMSS.txt`**
   - Plain-language summary for non-lawyers
   - Top 5 risks
   - Actionable recommendations

3. **`annotated_contract_YYYYMMDD_HHMMSS.md`**
   - Original contract in Markdown (formatting preserved)
   - Risk tags: `-hr-` (High), `-mr-` (Medium), `-lr-` (Low) only for risky clauses
   - Standard/fair/balanced clauses remain untagged
   - Legal citations: `-ipc-` (short: section, law name, 2-3 line description)
   - Suggestions: `-sg-` (short: 3-4 lines of concise advice, not full rewrites)

---

## 🧠 How It Works

### 1️⃣ PDF to Markdown
- Extracts text using PyMuPDF
- Identifies clause numbering (1., 1.1, 2.3.4, etc.)
- **Preserves original formatting** (spacing, line breaks, indentation)
- Maintains document structure and layout

### 2️⃣ Clause Classification
- Uses LLM (temperature 0.1) with strict JSON schema
- Classifies into 13 categories:
  - Termination, Indemnity, Arbitration, Jurisdiction
  - IP Assignment, Confidentiality, Penalty
  - Rent Escalation, Non-compete, Data Protection
  - Payment Terms, Liability, Other

### 3️⃣ Risk Detection
**Qualitative (LLM):**
- Analyzes clause for potential risks
- Identifies specific problematic terms
- Assigns risk level: High/Medium/Low
- **Only tags clauses with actual issues**
- Clauses with no risks remain completely untagged

**Tagged Clauses:**
- **High Risk**: Severe issues (unilateral terms, unlimited liability, IP loss)
- **Medium Risk**: Moderate issues (one-sided provisions, unclear terms)
- **Low Risk**: Minor concerns (slight imbalances, minor ambiguities)

**Untagged Clauses:**
- Standard boilerplate provisions
- Balanced and fair terms
- Normal business clauses with no risks

**Quantitative (Deterministic):**
- Base scores: High=70, Medium=40, Low=10
- Modifiers based on keywords:
  - +10: Unilateral language
  - +15: Unlimited liability
  - +10: IP issues
  - +10: Broad indemnity
  - +5: Vague terms
  - -5: Balanced language
- Final score: 0-100

### 4️⃣ Legal Retrieval
- Uses Gemini's web search capabilities to find real citations
- Searches authentic Indian law websites:
  - indiankanoon.org (case law and legislation)
  - legislative.gov.in (central acts)
  - indiacode.nic.in (laws of India)
  - lawcommissionofindia.nic.in (reports)
- Retrieves relevant Indian law sections:
  - Indian Contract Act 1872
  - IT Act 2000
  - Consumer Protection Act 2019
  - Arbitration & Conciliation Act 1996
  - And more...
- **NO HALLUCINATION**: Only extracts citations from actual search results
- **Concise Format**: Section name, law name, and short 2-3 line description

### 5️⃣ Redline Generation
- Provides **short, actionable advice** (3-4 lines) on improving clauses
- NOT full rewrites, but concise suggestions for betterment
- Key improvements:
  - Convert unilateral → bilateral terms
  - Add notice periods and liability caps
  - Clarify vague language
  - Add procedural safeguards
- Maintains legal enforceability
- Context-aware recommendations based on legal citations

### 6️⃣ Summary Generation
- Computes contract-level risk score
- Identifies top 5 risks
- Provides negotiation recommendations
- Uses plain language for business stakeholders

---

## 🎯 Indian Law Focus

NyayaAI is specifically designed for Indian contracts and includes:

- **Indian Contract Act 1872**: Core contract principles
- **Information Technology Act 2000**: Data protection and cyber law
- **Consumer Protection Act 2019**: Consumer rights and unfair contracts
- **Arbitration and Conciliation Act 1996**: Dispute resolution
- **Indian Penal Code**: Criminal liability provisions
- **Specific Relief Act 1963**: Contract enforcement

---

## 🔧 Configuration

All agents use **Google Gemini 2.0-flash-exp** with configurable temperature settings:

```bash
# API Configuration
GOOGLE_API_KEY=your_key_here

# Temperature Settings (creativity vs determinism)
CLASSIFIER_TEMPERATURE=0.1           # Very deterministic
RISK_DETECTOR_TEMPERATURE=0.2        # Mostly deterministic
LEGAL_RETRIEVER_TEMPERATURE=0.1      # No hallucination
REDLINE_TEMPERATURE=0.3              # Some creativity
SUMMARY_TEMPERATURE=0.3              # Balanced
```

**Note**: All agents use the same model (gemini-2.5-flash) optimized for:
- Fast response times
- High accuracy
- Cost-effectiveness
- Consistent JSON output

---

## 📊 Example Output

```
================================================================================
ANALYSIS COMPLETE
================================================================================

Overall Risk Score: 67/100
Risk Distribution:
  - High Risk:   25.0%
  - Medium Risk: 45.0%
  - Low Risk:    30.0%

Total Clauses Analyzed: 20
Citations Found: 12
Redline Suggestions: 14

================================================================================
All outputs saved to: D:\output\
================================================================================
```

---

## 🔒 Strict Rules Compliance

✅ **No OCR**: Only machine-readable PDFs  
✅ **No Placeholders**: Complete implementations  
✅ **No Hallucinated Citations**: Conservative legal retrieval  
✅ **Deterministic Scoring**: Rule-based risk engine  
✅ **Strict JSON Schema**: All LLM outputs validated  
✅ **LangGraph Required**: Full workflow orchestration  
✅ **Evolving Markdown**: Shared artifact across agents  

---

## 🧪 Testing

Test with a sample contract:

```bash
# Download a sample Indian contract PDF or use your own
python main.py --pdf sample_contract.pdf --output test_output
```

Check the outputs in `test_output/` directory.

---

## 🛠️ Development

### Customizing Web Search

Edit `agents/legal_retriever.py` to add more Indian law websites:

```python
def _search_indian_law(self, query: str) -> List[Dict[str, Any]]:
    # Add your custom law website here
    search_query = f"{query} site:yourwebsite.gov.in OR site:indiankanoon.org"
```

### Adding New Clause Types

1. Update `schemas/models.py` → `ClauseType` enum
2. Update `agents/clause_classifier.py` → `CLASSIFICATION_CATEGORIES`

### Customizing Risk Scoring

Edit `risk_engine.py`:
- Modify `BASE_SCORES`
- Add new keyword patterns
- Adjust modifier values

---

## 📈 Performance

- **Clause Classification**: ~2-3 seconds per clause
- **Risk Detection**: ~3-5 seconds per clause
- **Legal Retrieval**: ~3-5 seconds per clause (web search)
- **Redline Generation**: ~4-6 seconds per clause
- **Overall**: ~20-30 seconds for a 15-clause contract

*Note: Times depend on Google Gemini API response times and web search latency.*

---

## ⚠️ Limitations

- **No OCR**: Cannot process scanned PDFs or images
- **Machine-readable only**: Requires text-extractable PDFs
- **Indian law focus**: Optimized for Indian contracts
- **Not legal advice**: Automated analysis requires human review
- **API costs**: Uses Google Gemini API (paid service)
- **Web search dependency**: Requires internet connection for legal citations

---

## 🤝 Contributing

This is a hackathon project. For production use:

1. Expand web search to more legal sources
2. Add caching for frequently searched provisions
3. Implement proper error handling and retries
4. Add authentication and rate limiting for API
5. Create comprehensive test suite
6. Add support for more document formats
7. Implement rate limiting for web searches

---

## 📄 License

This project is for educational and demonstration purposes.

---

## 🙏 Acknowledgments

- Built with LangChain and LangGraph
- Powered by Google Gemini models
- Indian legal provisions from government sources
- Web search via DuckDuckGo
- Inspired by the need for accessible legal technology in India

---

## 📞 Support

For issues or questions:
1. Check logs in specified `--log-file`
2. Verify `.env` configuration
3. Ensure PDF is machine-readable
4. Check Google API key and credits
5. Verify internet connection for web search

---

**Made with ⚖️ for Indian legal tech**

*NyayaAI - Making legal contracts accessible and understandable*
