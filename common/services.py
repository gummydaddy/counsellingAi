"""Insight extraction service - extracts clinical patterns from completed sessions."""

from common.models import ClinicalInsight


class InsightExtractionService:
    """Extract clinical insights from completed counselling sessions."""

    @staticmethod
    def extract_insights_from_session(session) -> list[ClinicalInsight]:
        """
        Extract patterns from completed session and create ClinicalInsight objects.
        
        Args:
            session: CounsellingSession instance with completed result
            
        Returns:
            List of ClinicalInsight objects (not yet saved)
        """
        if not session.result:
            return []

        insights = []
        result = session.result

        # Pattern 1: Risk flag patterns
        if result.get('riskAssessment', {}).get('flags'):
            flags = result['riskAssessment']['flags']
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"Risk flags: {', '.join(flags)} in {session.session_type} context",
                recommendation=f"Monitor for {', '.join(flags)}; consider early intervention and safety planning",
                confidence_score=0.8
            ))

        # Pattern 2: Archetype + dominant trait combination
        traits = result.get('traits', {})
        dominant_traits = [k for k, v in traits.items() if v > 70]
        archetype = result.get('archetype', 'Unknown')
        if dominant_traits:
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"Archetype '{archetype}' with dominant traits: {', '.join(dominant_traits)} in {session.session_type}",
                recommendation=f"Leverage strengths in {', '.join(dominant_traits)}; support development in weaker areas for balanced growth",
                confidence_score=0.75
            ))

        # Pattern 3: Risk level patterns (High/Critical)
        risk_level = result.get('riskAssessment', {}).get('level', 'Low')
        if risk_level in ['High', 'Critical']:
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"{risk_level} risk detected with archetype '{archetype}' in {session.session_type}",
                recommendation="Immediate professional referral recommended; safety planning and crisis resources needed",
                confidence_score=0.9
            ))

        # Pattern 4: Career path suggestions pattern
        career_paths = result.get('careerPathSuggestions', [])
        if career_paths:
            top_careers = [c.get('title', '') for c in career_paths[:3] if c.get('title')]
            if top_careers:
                insights.append(ClinicalInsight(
                    user=session.user,
                    source_session=session,
                    session_type=session.session_type,
                    pattern=f"Career alignment: {', '.join(top_careers)} suggested for archetype '{archetype}'",
                    recommendation=f"Explore paths in {', '.join(top_careers)}; consider skill development and networking in these domains",
                    confidence_score=0.7
                ))

        # Pattern 5: Professional diagnosis pattern (medical/psychological)
        diagnosis = result.get('professionalDiagnosis')
        if diagnosis:
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"Potential diagnosis indicator: {diagnosis} in {session.session_type} context",
                recommendation="Recommend formal clinical evaluation by qualified professional; do not self-diagnose",
                confidence_score=0.6  # Lower confidence as this is AI-generated, not clinical
            ))

        # Pattern 6: Root causes pattern (psychological)
        root_causes = result.get('rootCauses', [])
        if root_causes:
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"Identified root causes: {', '.join(root_causes[:3])} contributing to {session.session_type} concerns",
                recommendation="Address root causes through targeted therapy; consider CBT, trauma-informed care, or specialized modalities",
                confidence_score=0.7
            ))

        # Pattern 7: Interpersonal strategy pattern (relationship)
        interpersonal = result.get('interpersonalStrategy')
        if interpersonal:
            insights.append(ClinicalInsight(
                user=session.user,
                source_session=session,
                session_type=session.session_type,
                pattern=f"Relationship pattern: {interpersonal} in {session.session_type} context",
                recommendation="Practice communication skills; consider couples/family therapy if patterns persist",
                confidence_score=0.7
            ))

        return insights

    @staticmethod
    def save_insights(insights: list[ClinicalInsight]) -> int:
        """Save insights to database."""
        saved_count = 0
        for insight in insights:
            try:
                insight.save()
                saved_count += 1
            except Exception as e:
                # Log error but continue with other insights
                import logging
                logging.error(f"Failed to save insight: {e}")
        return saved_count