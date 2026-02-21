"""
Example usage script for NyayaAI.
Demonstrates how to use the system programmatically.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from orchestrator.workflow import create_workflow
from agents.summary_agent import create_summary_agent


def analyze_contract(pdf_path: str, output_dir: str = "output"):
    """
    Analyze a contract PDF programmatically.
    
    Args:
        pdf_path: Path to PDF contract
        output_dir: Output directory for results
    
    Returns:
        dict: Analysis results
    """
    # Load environment
    load_dotenv()
    api_key = os.getenv("GOOGLE_API_KEY")
    
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in environment")
    
    # Create workflow
    print(f"Analyzing: {pdf_path}")
    workflow = create_workflow(api_key=api_key, config={"output_dir": output_dir})
    
    # Execute
    result = workflow.execute(pdf_path)
    
    # Print summary
    if result.get("contract_risk_summary"):
        summary = result["contract_risk_summary"]
        print(f"\n✓ Analysis Complete!")
        print(f"Overall Risk Score: {summary.overall_risk_score}/100")
        print(f"High Risk Clauses: {int(summary.risk_distribution.high)}%")
        
        # Generate executive summary text
        if result.get("executive_summary"):
            summary_agent = create_summary_agent(api_key)
            text = summary_agent.create_executive_summary_text(result["executive_summary"])
            print("\n" + "="*80)
            print(text)
    
    return result


def quick_risk_check(pdf_path: str):
    """
    Quick risk check without full analysis.
    
    Args:
        pdf_path: Path to PDF contract
    
    Returns:
        int: Risk score (0-100)
    """
    result = analyze_contract(pdf_path)
    
    if result.get("contract_risk_summary"):
        return result["contract_risk_summary"].overall_risk_score
    
    return 0


if __name__ == "__main__":
    # Example usage
    if len(sys.argv) < 2:
        print("Usage: python example.py <path_to_contract.pdf>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not Path(pdf_path).exists():
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)
    
    # Run analysis
    result = analyze_contract(pdf_path)
    
    print("\n✓ Results saved to: output/")
