"""
Deterministic Risk Scoring Engine for NyayaAI.
NO LLM USAGE - Pure rule-based scoring system.
Provides transparent, reproducible risk scoring.
"""

import re
import logging
from typing import List, Dict
from schemas.models import (
    RiskLevel, ClauseRiskScore, ScoringBreakdown, 
    ScoreModifier, ContractRiskSummary, RiskDistribution
)

logger = logging.getLogger(__name__)


class RiskEngine:
    """
    Deterministic risk scoring engine.
    Uses keyword matching and rule-based logic to compute risk scores.
    """
    
    # Base scores for risk levels
    BASE_SCORES = {
        RiskLevel.HIGH: 70,
        RiskLevel.MEDIUM: 40,
        RiskLevel.LOW: 10
    }
    
    # Keyword patterns for risk modifiers
    UNILATERAL_KEYWORDS = [
        "sole discretion",
        "without notice",
        "absolute right",
        "at its discretion",
        "unilaterally",
        "without consent",
        "without approval",
        "at any time without",
        "sole judgment",
        "at our sole option",
        "may terminate immediately",
        "without cause",
        "at will",
        "in its sole opinion",
        "as we deem fit",
        "reserves the right to",
        "without any obligation",
        "absolute authority",
        "unfettered discretion",
        "without restriction",
        "exclusive right to",
        "unconditional right"
    ]
    
    UNLIMITED_LIABILITY_KEYWORDS = [
        "unlimited liability",
        "no cap on liability",
        "without limitation",
        "no maximum liability",
        "unlimited damages",
        "no limit to liability",
        "full liability",
        "entire liability",
        "complete indemnification",
        "all damages",
        "any and all losses",
        "consequential damages unlimited",
        "punitive damages",
        "all direct and indirect",
        "unlimited indemnity"
    ]
    
    IP_NO_COMPENSATION_KEYWORDS = [
        "assigns all rights",
        "transfers all intellectual property",
        "work for hire without additional",
        "ip assignment without compensation",
        "irrevocably assigns",
        "waives all rights to",
        "exclusive ownership without",
        "perpetual license without",
        "all proprietary rights",
        "intellectual property vests",
        "ownership automatically transfers",
        "assigns without consideration"
    ]
    
    BROAD_INDEMNITY_KEYWORDS = [
        "indemnify and hold harmless",
        "fully indemnify",
        "shall indemnify for any",
        "indemnify against all claims",
        "unlimited indemnification",
        "defend and indemnify",
        "indemnify from any and all",
        "hold harmless from all",
        "indemnification without limit",
        "indemnify against any liability",
        "save harmless",
        "bear all liability",
        "responsible for all claims"
    ]
    
    VAGUE_PHRASES = [
        "as deemed appropriate",
        "from time to time",
        "reasonable at its discretion",
        "as necessary",
        "as required",
        "such other",
        "and/or similar",
        "at the discretion of",
        "in its opinion",
        "as it sees fit",
        "at such times",
        "in such manner",
        "may be required",
        "reasonably required",
        "appropriate measures",
        "sufficient notice",
        "adequate protection",
        "reasonable time",
        "as appropriate",
        "among other things"
    ]
    
    BALANCED_LANGUAGE = [
        "mutual",
        "both parties",
        "subject to notice period",
        "with prior written notice",
        "mutually agree",
        "reasonable notice",
        "upon mutual consent",
        "jointly",
        "reciprocal",
        "either party",
        "each party",
        "mutually acceptable",
        "written consent of both",
        "joint decision",
        "bilateral",
        "equal footing",
        "fair and reasonable",
        "on similar terms",
        "symmetrical",
        "equitable"
    ]
    
    # Indian legal context - protective terms (positive signals)
    INDIAN_PROTECTIVE_TERMS = [
        "registered agreement",
        "stamp duty",
        "notarized",
        "force majeure",
        "as per indian law",
        "subject to indian courts",
        "arbitration under arbitration act",
        "governed by laws of india",
        "jurisdiction of indian courts",
        "indian contract act",
        "consumer protection act",
        "msme act compliance",
        "registered under companies act"
    ]
    
    # Indian legal context - warning signs (negative signals)
    INDIAN_WARNING_SIGNS = [
        "waiver of consumer rights",
        "no recourse to courts",
        "foreign law governed",
        "waiver of statutory rights",
        "excluding indian jurisdiction",
        "arbitration outside india",
        "foreign arbitration mandatory",
        "no msme protection",
        "waiver under contract act",
        "governed by foreign law exclusively"
    ]
    
    # Payment and financial red flags
    PAYMENT_RED_FLAGS = [
        "payment at sole discretion",
        "no refund policy",
        "non-refundable",
        "forfeiture of deposit",
        "penalty without limit",
        "liquidated damages unlimited",
        "charges without notice",
        "price change without notice",
        "payment terms subject to change"
    ]
    
    # Termination red flags
    TERMINATION_RED_FLAGS = [
        "terminate without cause",
        "immediate termination without notice",
        "no cure period",
        "forfeit all payments on termination",
        "no compensation on termination",
        "terminate for convenience",
        "unilateral termination right"
    ]
    
    def __init__(self):
        """Initialize the risk engine."""
        pass
    
    def _check_keywords(self, text: str, keywords: List[str]) -> List[str]:
        """
        Check if any keywords are present in text (case-insensitive).
        
        Args:
            text: Text to search
            keywords: List of keywords to search for
            
        Returns:
            List of matched keywords
        """
        text_lower = text.lower()
        matched = []
        
        for keyword in keywords:
            if keyword.lower() in text_lower:
                matched.append(keyword)
        
        return matched
    
    def compute_clause_risk_score(
        self, 
        clause_id: str,
        clause_content: str,
        llm_risk_level: RiskLevel
    ) -> ClauseRiskScore:
        """
        Compute deterministic risk score for a single clause.
        
        Args:
            clause_id: Unique identifier for the clause
            clause_content: Full text of the clause
            llm_risk_level: Risk level determined by LLM
            
        Returns:
            ClauseRiskScore with detailed breakdown
        """
        # Start with base score based on LLM risk level
        base_score = self.BASE_SCORES[llm_risk_level]
        modifiers = []
        
        # Check for unilateral keywords (+10)
        unilateral_matches = self._check_keywords(
            clause_content, 
            self.UNILATERAL_KEYWORDS
        )
        if unilateral_matches:
            modifiers.append(ScoreModifier(
                modifier_type="unilateral_language",
                value=10,
                reason=f"Unilateral terms detected: {', '.join(unilateral_matches[:3])}"
            ))
        
        # Check for unlimited liability (+15)
        unlimited_liability_matches = self._check_keywords(
            clause_content,
            self.UNLIMITED_LIABILITY_KEYWORDS
        )
        if unlimited_liability_matches:
            modifiers.append(ScoreModifier(
                modifier_type="unlimited_liability",
                value=15,
                reason=f"Unlimited liability terms: {', '.join(unlimited_liability_matches[:2])}"
            ))
        
        # Check for IP assignment without compensation (+10)
        ip_matches = self._check_keywords(
            clause_content,
            self.IP_NO_COMPENSATION_KEYWORDS
        )
        if ip_matches:
            modifiers.append(ScoreModifier(
                modifier_type="ip_no_compensation",
                value=10,
                reason="IP assignment without clear compensation"
            ))
        
        # Check for broad indemnity (+10)
        indemnity_matches = self._check_keywords(
            clause_content,
            self.BROAD_INDEMNITY_KEYWORDS
        )
        if indemnity_matches:
            modifiers.append(ScoreModifier(
                modifier_type="broad_indemnity",
                value=10,
                reason=f"Broad indemnity clause: {indemnity_matches[0]}"
            ))
        
        # Check for vague phrases (+5)
        vague_matches = self._check_keywords(
            clause_content,
            self.VAGUE_PHRASES
        )
        if vague_matches:
            modifiers.append(ScoreModifier(
                modifier_type="vague_language",
                value=5,
                reason=f"Vague terms detected: {', '.join(vague_matches[:3])}"
            ))
        
        # Check for balanced language (-5)
        balanced_matches = self._check_keywords(
            clause_content,
            self.BALANCED_LANGUAGE
        )
        if balanced_matches:
            modifiers.append(ScoreModifier(
                modifier_type="balanced_language",
                value=-5,
                reason=f"Balanced terms found: {', '.join(balanced_matches[:2])}"
            ))
        
        # Check for Indian warning signs (+8)
        warning_matches = self._check_keywords(
            clause_content,
            self.INDIAN_WARNING_SIGNS
        )
        if warning_matches:
            modifiers.append(ScoreModifier(
                modifier_type="indian_warning_signs",
                value=8,
                reason=f"Indian legal concerns: {', '.join(warning_matches[:2])}"
            ))
        
        # Check for payment red flags (+7)
        payment_red_flags = self._check_keywords(
            clause_content,
            self.PAYMENT_RED_FLAGS
        )
        if payment_red_flags:
            modifiers.append(ScoreModifier(
                modifier_type="payment_red_flags",
                value=7,
                reason=f"Payment concerns: {', '.join(payment_red_flags[:2])}"
            ))
        
        # Check for termination red flags (+8)
        termination_red_flags = self._check_keywords(
            clause_content,
            self.TERMINATION_RED_FLAGS
        )
        if termination_red_flags:
            modifiers.append(ScoreModifier(
                modifier_type="termination_red_flags",
                value=8,
                reason=f"Termination concerns: {', '.join(termination_red_flags[:2])}"
            ))
        
        # Check for Indian protective terms (-3)
        protective_matches = self._check_keywords(
            clause_content,
            self.INDIAN_PROTECTIVE_TERMS
        )
        if protective_matches:
            modifiers.append(ScoreModifier(
                modifier_type="indian_protective_terms",
                value=-3,
                reason=f"Indian legal protections: {', '.join(protective_matches[:2])}"
            ))
        
        # Calculate final score
        total_modifiers = sum(m.value for m in modifiers)
        final_score = base_score + total_modifiers
        
        # Ensure score is between 0 and 100
        final_score = max(0, min(100, final_score))
        
        logger.debug(
            f"Clause {clause_id}: Base={base_score}, "
            f"Modifiers={total_modifiers}, Final={final_score}"
        )
        
        return ClauseRiskScore(
            clause_id=clause_id,
            final_risk_score=final_score,
            scoring_breakdown=ScoringBreakdown(
                base_score=base_score,
                modifiers=modifiers
            )
        )
    
    def compute_contract_risk_score(
        self,
        clause_scores: List[ClauseRiskScore],
        risk_levels: Dict[str, RiskLevel]
    ) -> ContractRiskSummary:
        """
        Compute overall contract risk score.
        
        Args:
            clause_scores: List of individual clause scores
            risk_levels: Dictionary mapping clause_id to RiskLevel
            
        Returns:
            ContractRiskSummary with overall assessment
        """
        if not clause_scores:
            raise ValueError("No clause scores provided")
        
        # Count risk levels
        high_count = sum(1 for cid, level in risk_levels.items() if level == RiskLevel.HIGH)
        medium_count = sum(1 for cid, level in risk_levels.items() if level == RiskLevel.MEDIUM)
        low_count = sum(1 for cid, level in risk_levels.items() if level == RiskLevel.LOW)
        total_count = len(risk_levels)
        
        # Calculate percentages
        high_percentage = (high_count / total_count * 100) if total_count > 0 else 0
        medium_percentage = (medium_count / total_count * 100) if total_count > 0 else 0
        
        # Get average score of ONLY risky clauses (High and Medium)
        # Low risk clauses should NOT increase the overall risk!
        risky_clause_scores = [
            cs.final_risk_score for cs in clause_scores
            if risk_levels.get(cs.clause_id) in [RiskLevel.HIGH, RiskLevel.MEDIUM]
        ]
        avg_risky_score = (
            sum(risky_clause_scores) / len(risky_clause_scores)
            if risky_clause_scores else 0
        )
        
        # NEW FORMULA:
        # - High risk %: weighted 60 (severe impact)
        # - Medium risk %: weighted 30 (moderate impact)
        # - Low risk clauses: contribute 0 (they're safe!)
        # - Avg risky clause score: small boost (20% weight)
        raw_score = (
            (high_percentage * 0.6) +
            (medium_percentage * 0.3) +
            (avg_risky_score * 0.2)
        )
        
        overall_score = max(0, min(100, int(raw_score)))
        
        # Calculate risk distribution percentages
        risk_distribution = RiskDistribution(
            high=round((high_count / total_count) * 100, 2) if total_count > 0 else 0.0,
            medium=round((medium_count / total_count) * 100, 2) if total_count > 0 else 0.0,
            low=round((low_count / total_count) * 100, 2) if total_count > 0 else 0.0
        )
        
        # Find most critical clause (highest score)
        most_critical = max(clause_scores, key=lambda x: x.final_risk_score)
        
        # Calculate risk concentration index (0-1)
        # Higher value means risk is concentrated in fewer clauses
        if total_count > 0:
            risk_concentration = (high_count / total_count) * (avg_risky_score / 100)
        else:
            risk_concentration = 0.0
        
        logger.info(
            f"Contract Risk Score: {overall_score} | "
            f"High: {high_count} ({high_percentage:.1f}%), "
            f"Medium: {medium_count} ({medium_percentage:.1f}%), "
            f"Low: {low_count} | Avg Risky Score: {avg_risky_score:.1f}"
        )
        
        return ContractRiskSummary(
            overall_risk_score=overall_score,
            risk_distribution=risk_distribution,
            most_critical_clause=most_critical.clause_id,
            risk_concentration_index=round(risk_concentration, 3)
        )


# Singleton instance
risk_engine = RiskEngine()


def compute_clause_score(
    clause_id: str,
    clause_content: str,
    llm_risk_level: RiskLevel
) -> ClauseRiskScore:
    """
    Convenience function to compute clause risk score.
    """
    return risk_engine.compute_clause_risk_score(
        clause_id, clause_content, llm_risk_level
    )


def compute_contract_score(
    clause_scores: List[ClauseRiskScore],
    risk_levels: Dict[str, RiskLevel]
) -> ContractRiskSummary:
    """
    Convenience function to compute contract risk score.
    """
    return risk_engine.compute_contract_risk_score(clause_scores, risk_levels)
