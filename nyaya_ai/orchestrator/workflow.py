"""
LangGraph Workflow Orchestrator for NyayaAI.
MANDATORY: Coordinates all agents using LangGraph.
Handles state management, error recovery, and async execution.
"""

import logging
import asyncio
from typing import Dict, Any, TypedDict, Annotated
from pathlib import Path

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from schemas.models import (
    Clause, ClassifiedClause, RiskOutput, Citation, 
    Redline, ContractRiskSummary, ExecutiveSummary, RiskLevel
)
from pdf_to_markdown import convert_pdf_to_markdown
from agents.clause_classifier import create_classifier_agent
from agents.risk_detector import create_risk_detector_agent
from agents.legal_retriever import create_legal_retriever_agent
from agents.redline_generator import create_redline_generator_agent
from agents.summary_agent import create_summary_agent
from risk_engine import compute_contract_score

logger = logging.getLogger(__name__)


class WorkflowState(TypedDict):
    """State for the LangGraph workflow."""
    pdf_path: str
    markdown_path: str
    clauses: list[Clause]
    classified: list[ClassifiedClause]
    classified_dict: dict[str, str]
    risk_outputs: list[RiskOutput]
    risk_levels_dict: dict[str, RiskLevel]
    citations: list[Citation]
    citations_dict: dict[str, Citation]
    redlines: list[Redline]
    contract_risk_summary: ContractRiskSummary | None
    executive_summary: ExecutiveSummary | None
    error: str | None
    stage: str


class NyayaAIWorkflow:
    """
    Main workflow orchestrator using LangGraph.
    Coordinates all agents in the correct sequence.
    """
    
    def __init__(self, api_key: str, config: Dict[str, Any] = None):
        """
        Initialize the NyayaAI workflow.
        
        Args:
            api_key: OpenAI API key
            config: Optional configuration dictionary
        """
        self.api_key = api_key
        self.config = config or {}
        
        # Initialize agents
        self.classifier_agent = create_classifier_agent(api_key)
        self.risk_detector_agent = create_risk_detector_agent(api_key)
        self.legal_retriever_agent = create_legal_retriever_agent(api_key)
        self.redline_agent = create_redline_generator_agent(api_key)
        self.summary_agent = create_summary_agent(api_key)
        
        # Build graph
        self.workflow = self._build_workflow()
        self.app = self.workflow.compile(checkpointer=MemorySaver())
        
        logger.info("NyayaAI Workflow initialized with all agents")
    
    def _build_workflow(self) -> StateGraph:
        """
        Build the LangGraph workflow.
        
        Returns:
            Configured StateGraph
        """
        workflow = StateGraph(WorkflowState)
        
        # Add nodes
        workflow.add_node("pdf_to_markdown", self._pdf_to_markdown_node)
        workflow.add_node("classify_clauses", self._classify_clauses_node)
        workflow.add_node("detect_risks", self._detect_risks_node)
        workflow.add_node("retrieve_legal", self._retrieve_legal_node)
        workflow.add_node("generate_redlines", self._generate_redlines_node)
        workflow.add_node("generate_summary", self._generate_summary_node)
        
        # Define edges (sequential flow)
        workflow.set_entry_point("pdf_to_markdown")
        workflow.add_edge("pdf_to_markdown", "classify_clauses")
        workflow.add_edge("classify_clauses", "detect_risks")
        workflow.add_edge("detect_risks", "retrieve_legal")
        workflow.add_edge("retrieve_legal", "generate_redlines")
        workflow.add_edge("generate_redlines", "generate_summary")
        workflow.add_edge("generate_summary", END)
        
        logger.info("Workflow graph built successfully")
        
        return workflow
    
    def _pdf_to_markdown_node(self, state: WorkflowState) -> WorkflowState:
        """
        Node 1: Convert PDF to Markdown.
        """
        logger.info(f"[1/6] PDF to Markdown: Processing {state['pdf_path']}")
        
        try:
            markdown_path, clauses = convert_pdf_to_markdown(
                state["pdf_path"],
                output_dir=self.config.get("output_dir")
            )
            
            state["markdown_path"] = markdown_path
            state["clauses"] = clauses
            state["stage"] = "markdown_generated"
            
            logger.info(f"✓ Generated markdown with {len(clauses)} clauses")
            
        except Exception as e:
            logger.error(f"✗ Error in PDF to Markdown: {e}")
            state["error"] = f"PDF conversion failed: {str(e)}"
        
        return state
    
    def _classify_clauses_node(self, state: WorkflowState) -> WorkflowState:
        """
        Node 2: Classify all clauses.
        """
        logger.info(f"[2/6] Clause Classification: Processing {len(state['clauses'])} clauses")
        
        try:
            classified = self.classifier_agent.classify_clauses(state["clauses"])
            
            # Create lookup dictionary
            classified_dict = {
                c.clause_id: c.type.value 
                for c in classified
            }
            
            state["classified"] = classified
            state["classified_dict"] = classified_dict
            state["stage"] = "clauses_classified"
            
            logger.info(f"✓ Classified {len(classified)} clauses")
            
        except Exception as e:
            logger.error(f"✗ Error in Classification: {e}")
            state["error"] = f"Classification failed: {str(e)}"
        
        return state
    
    def _detect_risks_node(self, state: WorkflowState) -> WorkflowState:
        """
        Node 3: Detect and score risks.
        """
        logger.info(f"[3/6] Risk Detection: Analyzing {len(state['clauses'])} clauses")
        
        try:
            risk_outputs, updated_markdown = self.risk_detector_agent.process_all_clauses(
                state["clauses"],
                state["classified_dict"],
                state["markdown_path"]
            )
            
            # Create lookup dictionary
            risk_levels_dict = {
                r.clause_id: r.risk_level 
                for r in risk_outputs
            }
            
            state["risk_outputs"] = risk_outputs
            state["risk_levels_dict"] = risk_levels_dict
            state["markdown_path"] = updated_markdown
            state["stage"] = "risks_detected"
            
            # Count risks
            high = sum(1 for r in risk_outputs if r.risk_level == RiskLevel.HIGH)
            medium = sum(1 for r in risk_outputs if r.risk_level == RiskLevel.MEDIUM)
            low = sum(1 for r in risk_outputs if r.risk_level == RiskLevel.LOW)
            
            logger.info(f"✓ Risk detection complete: High={high}, Medium={medium}, Low={low}")
            
        except Exception as e:
            logger.error(f"✗ Error in Risk Detection: {e}")
            state["error"] = f"Risk detection failed: {str(e)}"
        
        return state
    
    def _retrieve_legal_node(self, state: WorkflowState) -> WorkflowState:
        """
        Node 4: Retrieve legal citations.
        """
        logger.info(f"[4/6] Legal Retrieval: Finding citations")
        
        try:
            citations, updated_markdown = self.legal_retriever_agent.process_risk_tagged_markdown(
                state["markdown_path"],
                state["clauses"],
                state["risk_levels_dict"]
            )
            
            # Create lookup dictionary
            citations_dict = {
                c.clause_id: c 
                for c in citations
            }
            
            state["citations"] = citations
            state["citations_dict"] = citations_dict
            state["markdown_path"] = updated_markdown
            state["stage"] = "citations_retrieved"
            
            found = sum(1 for c in citations if c.found)
            logger.info(f"✓ Legal retrieval complete: Found {found}/{len(citations)} citations")
            
        except Exception as e:
            logger.error(f"✗ Error in Legal Retrieval: {e}")
            state["error"] = f"Legal retrieval failed: {str(e)}"
        
        return state
    
    def _generate_redlines_node(self, state: WorkflowState) -> WorkflowState:
        """
        Node 5: Generate redline suggestions.
        """
        logger.info(f"[5/6] Redline Generation: Creating suggestions")
        
        try:
            redlines, updated_markdown = self.redline_agent.process_cited_markdown(
                state["markdown_path"],
                state["clauses"],
                state["risk_levels_dict"],
                state["citations_dict"]
            )
            
            state["redlines"] = redlines
            state["markdown_path"] = updated_markdown
            state["stage"] = "redlines_generated"
            
            logger.info(f"✓ Generated {len(redlines)} redline suggestions")
            
        except Exception as e:
            logger.error(f"✗ Error in Redline Generation: {e}")
            state["error"] = f"Redline generation failed: {str(e)}"
        
        return state
    
    def _generate_summary_node(self, state: WorkflowState) -> WorkflowState:
        """
        Node 6: Generate executive summary.
        """
        logger.info(f"[6/6] Summary Generation: Creating executive summary")
        
        try:
            # Compute contract-level risk score
            clause_scores = [r.scoring_breakdown for r in state["risk_outputs"]]
            clause_scores_list = [
                type('ClauseScore', (), {
                    'clause_id': r.clause_id,
                    'final_risk_score': r.risk_score,
                    'scoring_breakdown': r.scoring_breakdown
                })()
                for r in state["risk_outputs"]
            ]
            
            contract_risk = compute_contract_score(
                clause_scores_list,
                state["risk_levels_dict"]
            )
            
            # Generate executive summary
            executive_summary = self.summary_agent.generate_summary(
                state["clauses"],
                state["risk_levels_dict"],
                clause_scores_list,
                state["classified_dict"],
                contract_risk
            )
            
            state["contract_risk_summary"] = contract_risk
            state["executive_summary"] = executive_summary
            state["stage"] = "completed"
            
            logger.info(
                f"✓ Analysis complete! Overall Risk Score: "
                f"{contract_risk.overall_risk_score}/100"
            )
            
        except Exception as e:
            logger.error(f"✗ Error in Summary Generation: {e}")
            state["error"] = f"Summary generation failed: {str(e)}"
        
        return state
    
    def execute(self, pdf_path: str, thread_id: str = "default") -> WorkflowState:
        """
        Execute the complete workflow.
        
        Args:
            pdf_path: Path to the PDF contract
            thread_id: Thread ID for checkpointing
            
        Returns:
            Final workflow state
        """
        logger.info("=" * 80)
        logger.info("STARTING NYAYA AI WORKFLOW")
        logger.info("=" * 80)
        
        # Initialize state
        initial_state: WorkflowState = {
            "pdf_path": pdf_path,
            "markdown_path": "",
            "clauses": [],
            "classified": [],
            "classified_dict": {},
            "risk_outputs": [],
            "risk_levels_dict": {},
            "citations": [],
            "citations_dict": {},
            "redlines": [],
            "contract_risk_summary": None,
            "executive_summary": None,
            "error": None,
            "stage": "initialized"
        }
        
        # Execute workflow
        try:
            config = {"configurable": {"thread_id": thread_id}}
            final_state = self.app.invoke(initial_state, config)
            
            if final_state.get("error"):
                logger.error(f"Workflow completed with errors: {final_state['error']}")
            else:
                logger.info("=" * 80)
                logger.info("WORKFLOW COMPLETED SUCCESSFULLY")
                logger.info("=" * 80)
            
            return final_state
            
        except Exception as e:
            logger.error(f"Fatal error in workflow execution: {e}")
            initial_state["error"] = f"Workflow execution failed: {str(e)}"
            return initial_state


def create_workflow(api_key: str, config: Dict[str, Any] = None) -> NyayaAIWorkflow:
    """
    Factory function to create NyayaAI workflow.
    
    Args:
        api_key: OpenAI API key
        config: Optional configuration
        
    Returns:
        Configured NyayaAIWorkflow
    """
    return NyayaAIWorkflow(api_key=api_key, config=config)
