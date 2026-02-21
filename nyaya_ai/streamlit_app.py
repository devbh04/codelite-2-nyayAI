"""
Streamlit Frontend for NyayaAI
User-friendly interface for contract analysis
"""

import streamlit as st
import requests
import time
from pathlib import Path
import io

# Configure page
st.set_page_config(
    page_title="NyayaAI - Contract Analysis",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# API endpoint
API_URL = "http://localhost:8000"

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 3rem;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 1rem;
    }
    .sub-header {
        font-size: 1.2rem;
        color: #666;
        text-align: center;
        margin-bottom: 2rem;
    }
    .risk-high {
        background-color: #ffebee;
        border-left: 5px solid #f44336;
        padding: 1rem;
        margin: 0.5rem 0;
    }
    .risk-medium {
        background-color: #fff3e0;
        border-left: 5px solid #ff9800;
        padding: 1rem;
        margin: 0.5rem 0;
    }
    .risk-low {
        background-color: #e8f5e9;
        border-left: 5px solid #4caf50;
        padding: 1rem;
        margin: 0.5rem 0;
    }
    .metric-card {
        background-color: #f5f5f5;
        padding: 1rem;
        border-radius: 0.5rem;
        text-align: center;
    }
</style>
""", unsafe_allow_html=True)


def check_api_health():
    """Check if API is running"""
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        return response.status_code == 200
    except:
        return False


def analyze_contract(pdf_file):
    """Send PDF to API for analysis"""
    try:
        files = {"file": (pdf_file.name, pdf_file, "application/pdf")}
        response = requests.post(
            f"{API_URL}/analyze",
            files=files,
            timeout=1200  # 20 minutes timeout for analysis
        )
        
        if response.status_code == 200:
            return response.json(), None
        else:
            return None, f"Error: {response.status_code} - {response.text}"
    except requests.exceptions.Timeout:
        return None, "Analysis timed out. Please try with a smaller contract."
    except Exception as e:
        return None, f"Error: {str(e)}"


def download_file(job_id, filename):
    """Download analysis output file"""
    try:
        response = requests.get(f"{API_URL}/download/{job_id}/{filename}")
        if response.status_code == 200:
            return response.content
        return None
    except:
        return None


def display_risk_score(score):
    """Display risk score with color coding"""
    if score >= 70:
        color = "#f44336"
        level = "High Risk"
    elif score >= 40:
        color = "#ff9800"
        level = "Medium Risk"
    else:
        color = "#4caf50"
        level = "Low Risk"
    
    st.markdown(f"""
    <div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, {color}22, {color}44); border-radius: 1rem;">
        <h1 style="color: {color}; font-size: 4rem; margin: 0;">{score}/100</h1>
        <h3 style="color: {color}; margin-top: 0.5rem;">{level}</h3>
    </div>
    """, unsafe_allow_html=True)


def main():
    # Header
    st.markdown('<h1 class="main-header">⚖️ NyayaAI</h1>', unsafe_allow_html=True)
    st.markdown('<p class="sub-header">Production-Grade Multi-Agent AI System for Legal Contract Red-Flagging (India-Focused)</p>', unsafe_allow_html=True)
    
    # Sidebar
    with st.sidebar:
        st.header("📋 About")
        st.markdown("""
        **NyayaAI** analyzes legal contracts using:
        - 🤖 6 Specialized AI Agents
        - 📊 Deterministic Risk Scoring
        - ⚖️ Indian Law Citations
        - ✏️ Redline Suggestions
        - 📝 Executive Summaries
        """)
        
        st.divider()
        
        st.header("🔧 System Status")
        if check_api_health():
            st.success("✅ API Connected")
        else:
            st.error("❌ API Not Running")
            st.info("Start the API with: `uvicorn api.app:app --reload`")
        
        st.divider()
        
        st.header("📚 Features")
        st.markdown("""
        - PDF to Markdown Conversion
        - 13 Clause Types Classification
        - 3-Tier Risk Assessment
        - Real-time Web Search for Legal Citations
        - Balanced Clause Rewrites
        - Executive Summaries
        """)
    
    # Main content
    st.header("📄 Upload Contract for Analysis")
    
    uploaded_file = st.file_uploader(
        "Choose a PDF contract (machine-readable only, no scanned images)",
        type=['pdf'],
        help="Upload a machine-readable PDF contract for analysis. OCR is not supported."
    )
    
    if uploaded_file:
        col1, col2 = st.columns([3, 1])
        with col1:
            st.info(f"📎 **File:** {uploaded_file.name} ({uploaded_file.size / 1024:.1f} KB)")
        with col2:
            analyze_button = st.button("🚀 Analyze Contract", type="primary", use_container_width=True)
        
        if analyze_button:
            # Check API health first
            if not check_api_health():
                st.error("❌ Backend API is not running. Please start it first.")
                st.code("uvicorn api.app:app --reload", language="bash")
                return
            
            # Show progress
            with st.spinner("🔍 Analyzing contract... This may take 20-30 seconds..."):
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                # Simulate progress (actual analysis happens on backend)
                for i in range(100):
                    time.sleep(0.2)
                    progress_bar.progress(i + 1)
                    if i < 20:
                        status_text.text("📄 Extracting text from PDF...")
                    elif i < 40:
                        status_text.text("🏷️ Classifying clauses...")
                    elif i < 60:
                        status_text.text("⚠️ Detecting risks...")
                    elif i < 80:
                        status_text.text("⚖️ Searching legal citations...")
                    else:
                        status_text.text("✏️ Generating suggestions...")
                
                # Analyze
                result, error = analyze_contract(uploaded_file)
                
                progress_bar.empty()
                status_text.empty()
            
            if error:
                st.error(f"❌ Analysis Failed: {error}")
                return
            
            if not result:
                st.error("❌ No results returned from analysis")
                return
            
            # Store result in session state
            st.session_state['analysis_result'] = result
    
    # Display results if available
    if 'analysis_result' in st.session_state:
        result = st.session_state['analysis_result']
        
        st.success("✅ Analysis Complete!")
        st.divider()
        
        # Overall Risk Score
        st.header("📊 Overall Risk Assessment")
        col1, col2, col3 = st.columns([2, 1, 1])
        
        with col1:
            display_risk_score(result['overall_risk_score'])
        
        with col2:
            st.metric("Total Clauses", result['total_clauses'])
            st.metric("Citations Found", result['citations_found'])
        
        with col3:
            st.metric("High Risk", result['high_risk_count'], delta=None, delta_color="inverse")
            st.metric("Redlines", result['redlines_generated'])
        
        st.divider()
        
        # Risk Distribution
        st.header("📈 Risk Distribution")
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.markdown('<div class="risk-high">', unsafe_allow_html=True)
            st.metric("High Risk", f"{result['risk_distribution'].get('high', 0):.1f}%")
            st.markdown(f"**{result['high_risk_count']} clauses**")
            st.markdown('</div>', unsafe_allow_html=True)
        
        with col2:
            st.markdown('<div class="risk-medium">', unsafe_allow_html=True)
            st.metric("Medium Risk", f"{result['risk_distribution'].get('medium', 0):.1f}%")
            st.markdown(f"**{result['medium_risk_count']} clauses**")
            st.markdown('</div>', unsafe_allow_html=True)
        
        with col3:
            st.markdown('<div class="risk-low">', unsafe_allow_html=True)
            st.metric("Low Risk", f"{result['risk_distribution'].get('low', 0):.1f}%")
            st.markdown(f"**{result['low_risk_count']} clauses**")
            st.markdown('</div>', unsafe_allow_html=True)
        
        st.divider()
        
        # Executive Summary
        st.header("📝 Executive Summary")
        st.markdown(result['executive_summary'])
        
        # Top Risks
        if result.get('top_risks'):
            st.divider()
            st.header("⚠️ Top Risks Identified")
            for idx, risk in enumerate(result['top_risks'], 1):
                with st.expander(f"**Risk {idx}:** {risk}", expanded=(idx == 1)):
                    st.warning(risk)
        
        st.divider()
        
        # Download outputs
        st.header("📥 Download Analysis Reports")
        
        job_id = result['job_id']
        files = result.get('files', {})
        
        if files:
            cols = st.columns(len(files))
            for idx, (file_type, file_path) in enumerate(files.items()):
                with cols[idx]:
                    filename = Path(file_path).name
                    
                    # Determine icon
                    if 'risk_report' in filename:
                        icon = "📊"
                        label = "Risk Report (JSON)"
                    elif 'executive_summary' in filename:
                        icon = "📝"
                        label = "Executive Summary"
                    elif 'annotated' in filename:
                        icon = "📄"
                        label = "Annotated Contract"
                    else:
                        icon = "📁"
                        label = filename
                    
                    if st.button(f"{icon} {label}", key=filename):
                        file_content = download_file(job_id, filename)
                        if file_content:
                            st.download_button(
                                label=f"💾 Download {filename}",
                                data=file_content,
                                file_name=filename,
                                mime="application/octet-stream",
                                key=f"download_{filename}"
                            )
        else:
            st.info("No output files available for download")
        
        # New analysis button
        st.divider()
        if st.button("🔄 Analyze Another Contract"):
            del st.session_state['analysis_result']
            st.rerun()


if __name__ == "__main__":
    main()
