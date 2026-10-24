import pytest
from app.services.rxnorm.rxnorm_client import verify_medicine_terminology, INDIAN_BRAND_MAP


@pytest.mark.asyncio
async def test_regional_indian_brand_mapping():
    # Test Dolo 650 mapping
    res_dolo = await verify_medicine_terminology("Dolo 650", "650mg")
    assert res_dolo.is_regional_brand is True
    assert res_dolo.verification_status == "verified_match"
    assert "Paracetamol" in res_dolo.normalized_name

    # Test Augmentin 625 mapping
    res_aug = await verify_medicine_terminology("Tab. Augmentin 625")
    assert res_aug.is_regional_brand is True
    assert "Amoxicillin" in res_aug.normalized_name

    # Test Pantocid mapping
    res_panto = await verify_medicine_terminology("Pantocid 40")
    assert res_panto.is_regional_brand is True
    assert "Pantoprazole" in res_panto.normalized_name


@pytest.mark.asyncio
async def test_unmatched_drug_returns_no_verified_match():
    # Completely fictitious made up name
    res = await verify_medicine_terminology("Xylofakomedicinez9999")
    assert res.verification_status == "no_verified_match"
    assert res.normalized_name is None
