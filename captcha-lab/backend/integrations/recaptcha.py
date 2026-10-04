import os
import httpx
from typing import Dict, Any

RECAPTCHA_DEFAULT_TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
RECAPTCHA_DEFAULT_TEST_SECRET = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"
GOOGLE_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

def getRecaptchaSiteKey() -> str:
    return os.environ.get("RECAPTCHA_SITE_KEY", RECAPTCHA_DEFAULT_TEST_SITE_KEY)

get_recaptcha_site_key = getRecaptchaSiteKey

async def verifyRecaptchaToken(responseToken: str, remoteIp: str = "") -> Dict[str, Any]:
    secretKey = os.environ.get("RECAPTCHA_SECRET_KEY", RECAPTCHA_DEFAULT_TEST_SECRET)
    if not responseToken:
        return {"success": False, "error_codes": ["missing-input-response"]}

    try:
        data = {"secret": secretKey, "response": responseToken}
        if remoteIp:
            data["remoteip"] = remoteIp

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(GOOGLE_VERIFY_URL, data=data)
            result = resp.json()
            return {
                "success": result.get("success", False),
                "hostname": result.get("hostname"),
                "challenge_ts": result.get("challenge_ts"),
                "error_codes": result.get("error-codes", [])
            }
    except Exception as e:
        return {
            "success": False,
            "error_codes": ["server_verification_error"],
            "detail": str(e)
        }

verify_recaptcha_token = verifyRecaptchaToken
