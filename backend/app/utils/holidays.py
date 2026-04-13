"""
Holiday API — Fetches Korean public holidays from data.go.kr.
Updates the Settings table with holiday entries for workday calculations.
"""

import requests
from typing import List, Dict
from datetime import datetime
import logging

from app import models

logger = logging.getLogger(__name__)

API_BASE_URL = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService"


def fetch_holidays_for_year(year: int, service_key: str) -> List[str]:
    holidays = set()
    for month in range(1, 13):
        month_str = f"{month:02d}"
        national_holidays = _fetch_holidays(year, month_str, "getHoliDeInfo", service_key)
        holidays.update(national_holidays)
        public_holidays = _fetch_holidays(year, month_str, "getRestDeInfo", service_key)
        holidays.update(public_holidays)
    return sorted(list(holidays))


def _fetch_holidays(year: int, month: str, endpoint: str, service_key: str) -> List[str]:
    url = f"{API_BASE_URL}/{endpoint}"
    params = {
        "solYear": year,
        "solMonth": month,
        "ServiceKey": service_key,
        "_type": "json",
        "numOfRows": "100"
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        header = data.get("response", {}).get("header", {})
        if header.get("resultCode") != "00":
            logger.error(f"API error: {header.get('resultMsg')}")
            return []

        items = data.get("response", {}).get("body", {}).get("items", {})
        if not items:
            return []

        item_list = items.get("item", [])
        if isinstance(item_list, dict):
            item_list = [item_list]

        holidays = []
        for item in item_list:
            if item.get("isHoliday") == "Y":
                locdate = item.get("locdate")
                if locdate:
                    date_obj = datetime.strptime(str(locdate), "%Y%m%d")
                    holidays.append(date_obj.strftime("%Y-%m-%d"))
        return holidays
    except requests.RequestException as e:
        logger.error(f"Failed to fetch holidays from {endpoint}: {e}")
        return []
    except Exception as e:
        logger.error(f"Error parsing holiday data: {e}")
        return []


def update_holidays_in_db(db, year: int) -> Dict[str, any]:
    service_key_setting = db.query(models.Settings).filter(models.Settings.key == "holiday_api_service_key").first()
    if not service_key_setting or not service_key_setting.value:
        return {"success": False, "message": "Service key not configured"}

    service_key = service_key_setting.value
    fetched_holidays = fetch_holidays_for_year(year, service_key)
    if not fetched_holidays:
        return {"success": False, "message": "No holidays fetched"}

    holiday_setting = db.query(models.Settings).filter(models.Settings.key == "holidays").first()
    new_entries = [{"start_date": h, "end_date": h, "condition": ""} for h in fetched_holidays]

    if holiday_setting:
        existing_holidays = holiday_setting.value or []
        year_prefix = f"{year}-"
        existing_other_years = [h for h in existing_holidays if not h.get("start_date", "").startswith(year_prefix)]
        merged_holidays = sorted(existing_other_years + new_entries, key=lambda x: x["start_date"])
        holiday_setting.value = merged_holidays
        holiday_setting.updated_by = "holiday_api"
    else:
        db.add(models.Settings(key="holidays", value=new_entries, updated_by="holiday_api"))
        merged_holidays = new_entries

    db.commit()
    logger.info(f"Added {len(fetched_holidays)} holidays for year {year}")
    return {
        "success": True, "year": year,
        "count": len(fetched_holidays), "total": len(merged_holidays),
        "holidays": merged_holidays
    }
