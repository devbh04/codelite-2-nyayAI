"""
Negotiation Simulator Agent for NyayaAI (BONUS Feature).
Simulates contract negotiation between two parties.
Party A seeks maximum protection, Party B seeks fairness.
"""

import logging
from typing import List
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

from schemas.models import NegotiationResult, NegotiationRound, RiskLevel

logger = logging.getLogger(__name__)


class NegotiationSimulatorAgent:
    """
    Agent that simulates contract negotiations between two parties.
    Demonstrates how clauses can be improved through negotiation.
    """
    
    def __init__(
        self, 
        api_key: str, 
        model: str = "gemini-2.5-flash",
        temperature: float = 0.4,
        rounds: int = 3
    ):
        """
        Initialize the negotiation simulator agent.
        
        Args:
            api_key: Google API key
            model: Model to use
            temperature: Temperature for LLM (higher for varied positions)
            rounds: Number of negotiation rounds
        """
        self.llm = ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            google_api_key=api_key
        )
        
        self.rounds = rounds
        self.parser = JsonOutputParser()
        
        logger.info(f"NegotiationSimulatorAgent initialized with {rounds} rounds")
    
    def _create_prompt_for_party_a(self, round_num: int) -> ChatPromptTemplate:
        """Create prompt for Party A (seeks maximum protection)."""
        return ChatPromptTemplate.from_messages([
            ("system", """You are a legal negotiator representing Party A in a contract negotiation.

Your goal: Maximize protection and minimize risk for your client.

Guidelines:
- Push for balanced terms, not one-sided in favor of the other party
- Add safeguards, notice periods, liability caps
- Request mutual obligations where currently one-sided
- Be professional but firm
- Cite Indian Contract Act principles where applicable

Current round: {round_num}/{total_rounds}

Respond with ONLY a valid JSON object:
{{
    "position": "Your proposed clause modification",
    "reasoning": "Brief justification"
}}
"""),
            ("user", "Original Clause:\n{original}\n\nCurrent State:\n{current_state}\n\nOther Party's Position:\n{other_position}")
        ])
    
    def _create_prompt_for_party_b(self, round_num: int) -> ChatPromptTemplate:
        """Create prompt for Party B (seeks fairness)."""
        return ChatPromptTemplate.from_messages([
            ("system", """You are a legal negotiator representing Party B in a contract negotiation.

Your goal: Maintain a fair, enforceable contract that works for both parties.

Guidelines:
- Accept reasonable protections that don't harm your interests
- Resist terms that are excessively restrictive or costly
- Propose middle-ground solutions
- Focus on practical business needs
- Reference Indian Contract Act and standard practices

Current round: {round_num}/{total_rounds}

Respond with ONLY a valid JSON object:
{{
    "position": "Your response or counter-proposal",
    "reasoning": "Brief justification"
}}
"""),
            ("user", "Original Clause:\n{original}\n\nCurrent State:\n{current_state}\n\nOther Party's Position:\n{other_position}")
        ])
    
    def _create_compromise_prompt(self) -> ChatPromptTemplate:
        """Create prompt for generating compromise."""
        return ChatPromptTemplate.from_messages([
            ("system", """You are a neutral mediator helping two parties reach a fair contract agreement.

Analyze both positions and create a balanced compromise that:
- Addresses concerns of both parties
- Maintains legal enforceability
- Reflects fair business practices
- Complies with Indian Contract Act principles

Respond with ONLY a valid JSON object:
{{
    "compromise": "Balanced clause incorporating both parties' concerns"
}}
"""),
            ("user", "Party A Position:\n{party_a}\n\nParty B Position:\n{party_b}\n\nOriginal Clause:\n{original}")
        ])
    
    def simulate_negotiation(
        self,
        clause_id: str,
        original_clause: str,
        risk_level: RiskLevel
    ) -> NegotiationResult:
        """
        Simulate a multi-round negotiation for a clause.
        
        Args:
            clause_id: ID of the clause
            original_clause: Original clause text
            risk_level: Risk level of the clause
            
        Returns:
            NegotiationResult with final clause and negotiation log
        """
        logger.info(f"Starting negotiation simulation for {clause_id}")
        
        negotiation_log = []
        current_state = original_clause
        
        try:
            for round_num in range(1, self.rounds + 1):
                logger.debug(f"Negotiation round {round_num}/{self.rounds}")
                
                # Party A proposes
                party_a_prompt = self._create_prompt_for_party_a(round_num)
                party_a_chain = party_a_prompt | self.llm | self.parser
                
                party_a_response = party_a_chain.invoke({
                    "round_num": round_num,
                    "total_rounds": self.rounds,
                    "original": original_clause[:800],
                    "current_state": current_state[:800],
                    "other_position": "Initial review" if round_num == 1 else negotiation_log[-1].party_b_position
                })
                
                party_a_position = party_a_response.get("position", "No change proposed")
                
                # Party B responds
                party_b_prompt = self._create_prompt_for_party_b(round_num)
                party_b_chain = party_b_prompt | self.llm | self.parser
                
                party_b_response = party_b_chain.invoke({
                    "round_num": round_num,
                    "total_rounds": self.rounds,
                    "original": original_clause[:800],
                    "current_state": current_state[:800],
                    "other_position": party_a_position
                })
                
                party_b_position = party_b_response.get("position", "No change proposed")
                
                # Generate compromise for this round
                compromise_prompt = self._create_compromise_prompt()
                compromise_chain = compromise_prompt | self.llm | self.parser
                
                compromise_response = compromise_chain.invoke({
                    "party_a": party_a_position,
                    "party_b": party_b_position,
                    "original": original_clause[:800]
                })
                
                compromise = compromise_response.get("compromise", current_state)
                
                # Log this round
                negotiation_log.append(NegotiationRound(
                    round_number=round_num,
                    party_a_position=party_a_position,
                    party_b_position=party_b_position,
                    compromise=compromise
                ))
                
                current_state = compromise
            
            logger.info(f"Completed negotiation for {clause_id}")
            
            return NegotiationResult(
                clause_id=clause_id,
                final_clause=current_state,
                negotiation_log=negotiation_log
            )
            
        except Exception as e:
            logger.error(f"Error in negotiation simulation for {clause_id}: {e}")
            return NegotiationResult(
                clause_id=clause_id,
                final_clause=original_clause,
                negotiation_log=[]
            )
    
    def simulate_top_risks(
        self,
        clauses: List,
        risk_levels: dict,
        top_n: int = 3
    ) -> List[NegotiationResult]:
        """
        Simulate negotiations for top N risky clauses.
        
        Args:
            clauses: List of all clauses
            risk_levels: Dict mapping clause_id to RiskLevel
            top_n: Number of top risky clauses to simulate
            
        Returns:
            List of NegotiationResult objects
        """
        # Get high-risk clauses
        high_risk_clauses = [
            c for c in clauses 
            if risk_levels.get(c.clause_id) == RiskLevel.HIGH
        ]
        
        # Limit to top_n
        clauses_to_simulate = high_risk_clauses[:top_n]
        
        results = []
        for clause in clauses_to_simulate:
            result = self.simulate_negotiation(
                clause.clause_id,
                clause.content,
                RiskLevel.HIGH
            )
            results.append(result)
        
        logger.info(f"Completed negotiation simulations for {len(results)} clauses")
        
        return results


def create_negotiation_simulator_agent(
    api_key: str,
    model: str = "gemini-2.5-flash",
    rounds: int = 3
) -> NegotiationSimulatorAgent:
    """
    Factory function to create a NegotiationSimulatorAgent.
    
    Args:
        api_key: Google API key
        model: Model name to use
        rounds: Number of negotiation rounds
        
    Returns:
        Configured NegotiationSimulatorAgent
    """
    return NegotiationSimulatorAgent(api_key=api_key, model=model, rounds=rounds)
