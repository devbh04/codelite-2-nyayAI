"""
Main Entry Point for NyayaAI System.
Production-grade multi-agent legal contract analysis.

Usage:
    python main.py --pdf path/to/contract.pdf [--output output_dir]
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

from orchestrator.workflow import create_workflow
from agents.summary_agent import create_summary_agent

# Load environment variables
load_dotenv()

# Configure logging
def setup_logging(log_level: str = "INFO", log_file: Optional[str] = None):
    """
    Configure logging for the application.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional file to write logs to
    """
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    handlers = [logging.StreamHandler(sys.stdout)]
    
    if log_file:
        handlers.append(logging.FileHandler(log_file))
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=log_format,
        handlers=handlers
    )


def save_outputs(final_state, output_dir: Path):
    """
    Save all outputs from the workflow.
    
    Args:
        final_state: Final state from workflow execution
        output_dir: Directory to save outputs
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate timestamp for file naming
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 1. Save Risk Report JSON
    risk_report = {
        "analysis_timestamp": datetime.now().isoformat(),
        "pdf_path": final_state.get("pdf_path", ""),
        "overall_risk_score": final_state["contract_risk_summary"].overall_risk_score if final_state["contract_risk_summary"] else 0,
        "risk_distribution": {
            "high": final_state["contract_risk_summary"].risk_distribution.high if final_state["contract_risk_summary"] else 0,
            "medium": final_state["contract_risk_summary"].risk_distribution.medium if final_state["contract_risk_summary"] else 0,
            "low": final_state["contract_risk_summary"].risk_distribution.low if final_state["contract_risk_summary"] else 0,
        } if final_state["contract_risk_summary"] else {},
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
                "original": r.original_text[:200] + "...",
                "suggested": r.suggested_text[:200] + "...",
                "rationale": r.rationale
            }
            for r in final_state.get("redlines", [])
        ]
    }
    
    risk_report_path = output_dir / f"risk_report_{timestamp}.json"
    with open(risk_report_path, 'w', encoding='utf-8') as f:
        json.dump(risk_report, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Risk Report saved: {risk_report_path}")
    
    # 2. Save Executive Summary Text
    if final_state.get("executive_summary"):
        summary_agent = create_summary_agent(os.getenv("GOOGLE_API_KEY"))
        summary_text = summary_agent.create_executive_summary_text(
            final_state["executive_summary"]
        )
        
        summary_path = output_dir / f"executive_summary_{timestamp}.txt"
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(summary_text)
        
        print(f"✓ Executive Summary saved: {summary_path}")
    
    # 3. Copy annotated markdown to output
    if final_state.get("markdown_path"):
        markdown_source = Path(final_state["markdown_path"])
        markdown_dest = output_dir / f"annotated_contract_{timestamp}.md"
        
        if markdown_source.exists():
            import shutil
            shutil.copy(markdown_source, markdown_dest)
            print(f"✓ Annotated Contract saved: {markdown_dest}")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description="NyayaAI - AI-powered legal contract analysis for India"
    )
    parser.add_argument(
        "--pdf",
        required=True,
        help="Path to the PDF contract file"
    )
    parser.add_argument(
        "--output",
        default="output",
        help="Output directory for results (default: output)"
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)"
    )
    parser.add_argument(
        "--log-file",
        help="Optional log file path"
    )
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.log_level, args.log_file)
    logger = logging.getLogger(__name__)
    
    # Validate PDF path
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        logger.error(f"PDF file not found: {pdf_path}")
        sys.exit(1)
    
    if not pdf_path.suffix.lower() == '.pdf':
        logger.error(f"File is not a PDF: {pdf_path}")
        sys.exit(1)
    
    # Get API key
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.error("GOOGLE_API_KEY not found in environment variables")
        logger.error("Please set it in .env file or environment")
        sys.exit(1)
    
    # Print banner
    print("\n" + "=" * 80)
    print("NyayaAI - Legal Contract Analysis System")
    print("India-focused Contract Red-Flagging using Multi-Agent AI")
    print("=" * 80)
    print(f"\nAnalyzing: {pdf_path.name}")
    print(f"Output Directory: {args.output}\n")
    
    try:
        # Create workflow
        logger.info("Initializing NyayaAI workflow...")
        workflow = create_workflow(
            api_key=api_key,
            config={"output_dir": args.output}
        )
        
        # Execute workflow
        logger.info(f"Starting analysis of {pdf_path}")
        final_state = workflow.execute(str(pdf_path.absolute()))
        
        # Check for errors
        if final_state.get("error"):
            logger.error(f"Analysis completed with errors: {final_state['error']}")
            print(f"\n⚠️  Analysis completed with errors: {final_state['error']}")
        else:
            # Save outputs
            output_dir = Path(args.output)
            save_outputs(final_state, output_dir)
            
            # Print summary
            if final_state.get("contract_risk_summary"):
                print("\n" + "=" * 80)
                print("ANALYSIS COMPLETE")
                print("=" * 80)
                
                risk_summary = final_state["contract_risk_summary"]
                print(f"\nOverall Risk Score: {risk_summary.overall_risk_score}/100")
                print(f"Risk Distribution:")
                print(f"  - High Risk:   {risk_summary.risk_distribution.high:.1f}%")
                print(f"  - Medium Risk: {risk_summary.risk_distribution.medium:.1f}%")
                print(f"  - Low Risk:    {risk_summary.risk_distribution.low:.1f}%")
                
                print(f"\nTotal Clauses Analyzed: {len(final_state['clauses'])}")
                print(f"Citations Found: {sum(1 for c in final_state.get('citations', []) if c.found)}")
                print(f"Redline Suggestions: {len(final_state.get('redlines', []))}")
                
                print("\n" + "=" * 80)
                print(f"All outputs saved to: {output_dir.absolute()}")
                print("=" * 80 + "\n")
        
        logger.info("NyayaAI execution completed")
        
    except KeyboardInterrupt:
        logger.warning("Analysis interrupted by user")
        print("\n\n⚠️  Analysis interrupted by user")
        sys.exit(1)
        
    except Exception as e:
        logger.exception(f"Fatal error during execution: {e}")
        print(f"\n\n❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
