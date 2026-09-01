"""Dummy doc_generator for pipeline package."""
import logging

logger = logging.getLogger(__name__)


async def generate_intake_doc(ctx, intake_submission_id: str):
    """No-op placeholder — real implementation is in ai/doc_generator.py."""
    logger.info("generate_intake_doc skipped (placeholder)", intake_submission_id=intake_submission_id)
    return None
