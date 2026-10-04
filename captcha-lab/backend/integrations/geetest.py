import hashlib
import hmac
import os
import httpx
from typing import Dict, Any

GEETEST_VALIDATE_URL = "http://gcaptcha4.geetest.com/validate"

def getGeetestId() -> str:
    return os.environ.get("GEETEST_ID", "test_geetest_id_sandbox")

get_geetest_id = getGeetestId

async def verifyGeetestToken(
    lotNumber: str,
    passToken: str,
    genTime: str,
    captchaOutput: str
) -> Dict[str, Any]:
    geetestId = getGeetestId()
    geetestKey = os.environ.get("GEETEST_KEY", "test_geetest_key_sandbox")

    if not (lotNumber and passToken and genTime and captchaOutput):
        return {"result": "fail", "reason": "Missing required parameters"}

    if geetestId == "test_geetest_id_sandbox" or not os.environ.get("GEETEST_KEY"):
        return {
            "result": "success",
            "reason": "Sandbox mode passed",
            "captcha_args": {
                "lot_number": lotNumber,
                "gen_time": genTime
            }
        }

    try:
        signToken = hmac.new(geetestKey.encode("utf-8"), lotNumber.encode("utf-8"), digestmod=hashlib.sha256).hexdigest()
        params = {
            "lot_number": lotNumber,
            "captcha_output": captchaOutput,
            "pass_token": passToken,
            "gen_time": genTime,
            "sign_token": signToken,
            "captcha_id": geetestId
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(GEETEST_VALIDATE_URL, data=params)
            return resp.json()
    except Exception as e:
        return {
            "result": "fail",
            "reason": f"Verification error: {str(e)}"
        }

verify_geetest_token = verifyGeetestToken
