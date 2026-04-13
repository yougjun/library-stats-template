"""
Weather Service — Historical data fetching, forecast retrieval, and prediction adjustments.

Merges three original modules:
  - weather_api.py: ASOS daily weather data from KMA
  - weather_forecast.py: Short-term (3-day) and mid-term (3-10 day) forecasts
  - weather_adjustment.py: Weather-based visitor prediction adjustments

Grid conversion uses Lambert Conformal Conic projection for KMA API compatibility.
Correlation factors (temp: -0.59, precip: -0.53) derived from 2024-2025 analysis.
"""

import math
import requests
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import extract, update
import logging

from app import models

logger = logging.getLogger(__name__)

# === Grid Conversion Constants (Lambert Conformal Conic) ===
RE = 6371.00877
GRID = 5.0
SLAT1 = 30.0
SLAT2 = 60.0
OLON = 126.0
OLAT = 38.0
XO = 43
YO = 136

# === API Endpoints ===
ASOS_DAILY_URL = "http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"
SHORT_TERM_FORECAST_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
MID_TERM_TEMP_URL = "http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa"
MID_TERM_LAND_URL = "http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst"
MID_TERM_REGION_CODE = "11B10101"

# === Weather Adjustment Constants ===
TEMP_CORRELATION = -0.59
PRECIP_CORRELATION = -0.53
BASELINE_TEMP = 15.0
BASELINE_PRECIP = 100.0
TEMP_ADJUSTMENT_FACTOR = 0.01
PRECIP_ADJUSTMENT_FACTOR = 0.0005
HIGH_RAIN_THRESHOLD = 200
HIGH_RAIN_PENALTY = 0.15


# ──────────────────────────────────────────────
# Grid Conversion
# ─────────────��────────────────────────────────

def lat_lon_to_grid(lat: float, lon: float) -> Tuple[int, int]:
    """Convert WGS84 lat/lon to KMA 5km grid coordinates using Lambert Conformal Conic.

    The projection uses two standard parallels (30N, 60N) and origin (126E, 38N)
    matching KMA's official grid system. Steps:
      1. Compute the cone constant (sn) from the two standard parallels.
      2. Compute the scale factor (sf) and polar distance (ro) at the origin.
      3. Project the target point to (ra, theta) in polar coordinates.
      4. Convert to Cartesian grid offsets (x, y) relative to grid origin (XO, YO).
    """
    DEGRAD = math.pi / 180.0
    re = RE / GRID
    slat1 = SLAT1 * DEGRAD
    slat2 = SLAT2 * DEGRAD
    olon = OLON * DEGRAD
    olat = OLAT * DEGRAD

    # Step 1: cone constant — ratio of angles on the cone to angles on the sphere
    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    # Step 2: scale factor and polar distance at map origin
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / math.pow(ro, sn)

    # Step 3: polar coordinates of the target point
    ra = math.tan(math.pi * 0.25 + (lat * DEGRAD) * 0.5)
    ra = re * sf / math.pow(ra, sn)
    theta = lon * DEGRAD - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn

    # Step 4: Cartesian grid indices
    x = math.floor(ra * math.sin(theta) + XO + 0.5)
    y = math.floor(ro - ra * math.cos(theta) + YO + 0.5)
    return int(x), int(y)


# ────���─────────────────────────────────────────
# Historical Weather Data (ASOS)
# ���──────���────────────────────────────────────��─

def fetch_weather_for_date_range(
    start_date: str, end_date: str, station_id: str, service_key: str
) -> List[Dict]:
    params = {
        "ServiceKey": service_key,
        "dataType": "JSON",
        "dataCd": "ASOS",
        "dateCd": "DAY",
        "startDt": start_date.replace("-", ""),
        "endDt": end_date.replace("-", ""),
        "stnIds": station_id,
        "numOfRows": "999"
    }

    try:
        response = requests.get(ASOS_DAILY_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        header = data.get("response", {}).get("header", {})
        if header.get("resultCode") != "00":
            logger.error(f"API error: {header.get('resultMsg')}")
            return []

        item_list = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
        if isinstance(item_list, dict):
            item_list = [item_list]

        weather_records = []
        for item in item_list:
            try:
                tm = item.get("tm")
                if not tm:
                    continue
                tm_str = str(tm)
                date_obj = datetime.strptime(tm_str, "%Y-%m-%d" if "-" in tm_str else "%Y%m%d")
                weather_records.append({
                    "date": date_obj.strftime("%Y-%m-%d"),
                    "station_id": str(item.get("stnId", station_id)),
                    "avg_temp": float(item.get("avgTa")) if item.get("avgTa") else None,
                    "max_temp": float(item.get("maxTa")) if item.get("maxTa") else None,
                    "min_temp": float(item.get("minTa")) if item.get("minTa") else None,
                    "precipitation": float(item.get("sumRn")) if item.get("sumRn") else None,
                    "humidity": float(item.get("avgRhm")) if item.get("avgRhm") else None
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Error parsing weather record: {e}")
                continue
        return weather_records
    except requests.RequestException as e:
        logger.error(f"Failed to fetch weather data: {e}")
        return []
    except Exception as e:
        logger.error(f"Error parsing weather data: {e}")
        return []


def update_weather_in_db(db: Session, start_date: str, end_date: str, station_id: Optional[str] = None) -> Dict:
    service_key_setting = db.query(models.Settings).filter(
        models.Settings.key == "holiday_api_service_key"
    ).first()
    if not service_key_setting or not service_key_setting.value:
        return {"success": False, "message": "Service key not configured"}

    service_key = service_key_setting.value
    if not station_id:
        station_setting = db.query(models.Settings).filter(models.Settings.key == "weather_station_id").first()
        station_id = station_setting.value if station_setting else "131"

    weather_records = fetch_weather_for_date_range(start_date, end_date, station_id, service_key)
    if not weather_records:
        return {"success": False, "message": "No weather data fetched"}

    inserted_count = 0
    updated_count = 0

    dates = [r["date"] for r in weather_records]
    existing_records = db.query(models.WeatherData).filter(
        models.WeatherData.date.in_(dates),
        models.WeatherData.station_id == station_id
    ).all()
    existing_lookup = {(r.date, r.station_id): r for r in existing_records}

    for record in weather_records:
        key = (record["date"], record["station_id"])
        existing = existing_lookup.get(key)
        if existing:
            db.execute(
                update(models.WeatherData)
                .where(models.WeatherData.id == existing.id)
                .values(
                    avg_temp=record["avg_temp"], max_temp=record["max_temp"],
                    min_temp=record["min_temp"], precipitation=record["precipitation"],
                    humidity=record["humidity"], updated_at=datetime.now()
                )
            )
            updated_count += 1
        else:
            db.add(models.WeatherData(**record))
            inserted_count += 1

    db.commit()
    logger.info(f"Weather data updated: {inserted_count} inserted, {updated_count} updated")
    return {
        "success": True, "start_date": start_date, "end_date": end_date,
        "station_id": station_id, "inserted": inserted_count,
        "updated": updated_count, "total": len(weather_records)
    }


# ──────���────────────────────────���──────────────
# Forecast
# ─────────��──────────────────��─────────────────

def get_forecast_base_time():
    now = datetime.now()
    base_hours = [2, 5, 8, 11, 14, 17, 20, 23]
    base_hour = None
    for h in reversed(base_hours):
        if now.hour >= h:
            base_hour = h
            break
    if base_hour is None:
        return (now - timedelta(days=1)).strftime("%Y%m%d"), "2300"
    return now.strftime("%Y%m%d"), f"{base_hour:02d}00"


def fetch_short_term_forecast(lat: float, lon: float, service_key: str, days: int = 3) -> List[Dict]:
    nx, ny = lat_lon_to_grid(lat, lon)
    base_date, base_time = get_forecast_base_time()
    logger.info(f"Fetching forecast for grid ({nx}, {ny}) at {base_date} {base_time}")

    params = {
        "ServiceKey": service_key, "dataType": "JSON",
        "base_date": base_date, "base_time": base_time,
        "nx": nx, "ny": ny, "numOfRows": 1000
    }

    try:
        response = requests.get(SHORT_TERM_FORECAST_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        header = data.get("response", {}).get("header", {})
        if header.get("resultCode") != "00":
            logger.error(f"API error: {header.get('resultMsg')}")
            return []

        items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
        if not items:
            return []

        daily_data = {}
        for item in items:
            fcst_date = item.get("fcstDate")
            category = item.get("category")
            value = item.get("fcstValue")
            if not fcst_date:
                continue

            if fcst_date not in daily_data:
                daily_data[fcst_date] = {
                    "date": f"{fcst_date[:4]}-{fcst_date[4:6]}-{fcst_date[6:]}",
                    "temps": [], "precip": 0.0, "humidity": []
                }

            if category == "TMP":
                try:
                    daily_data[fcst_date]["temps"].append(float(value))
                except (ValueError, TypeError):
                    pass
            elif category == "PCP":
                try:
                    if value != "강수없음":
                        val_str = value.replace("mm", "").strip()
                        if val_str:
                            daily_data[fcst_date]["precip"] += float(val_str)
                except (ValueError, TypeError):
                    pass
            elif category == "REH":
                try:
                    daily_data[fcst_date]["humidity"].append(float(value))
                except (ValueError, TypeError):
                    pass

        forecasts = []
        for date_key in sorted(daily_data.keys())[:days]:
            day = daily_data[date_key]
            temps = day["temps"]
            humidity = day["humidity"]
            if temps:
                forecasts.append({
                    "date": day["date"],
                    "avg_temp": round(sum(temps) / len(temps), 2),
                    "max_temp": round(max(temps), 2),
                    "min_temp": round(min(temps), 2),
                    "precipitation": round(day["precip"], 2),
                    "humidity": round(sum(humidity) / len(humidity), 2) if humidity else None,
                    "forecast_type": "short_term"
                })

        logger.info(f"Fetched {len(forecasts)} days of short-term forecast")
        return forecasts
    except requests.RequestException as e:
        logger.error(f"Failed to fetch short-term forecast: {e}")
        return []
    except Exception as e:
        logger.error(f"Error parsing short-term forecast: {e}")
        return []


def fetch_mid_term_temperature_forecast(service_key: str, region_code: str = MID_TERM_REGION_CODE) -> List[Dict]:
    now = datetime.now()
    if now.hour < 6:
        tm_fc = (now - timedelta(days=1)).strftime("%Y%m%d") + "1800"
    elif now.hour < 18:
        tm_fc = now.strftime("%Y%m%d") + "0600"
    else:
        tm_fc = now.strftime("%Y%m%d") + "1800"

    params = {
        "ServiceKey": service_key, "dataType": "JSON",
        "regId": region_code, "tmFc": tm_fc, "numOfRows": 10
    }

    try:
        response = requests.get(MID_TERM_TEMP_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        header = data.get("response", {}).get("header", {})
        if header.get("resultCode") != "00":
            logger.error(f"Mid-term temp API error: {header.get('resultMsg')}")
            return []

        items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
        if not items:
            return []

        item = items[0] if isinstance(items, list) else items
        forecasts = []
        base_date = datetime.strptime(tm_fc[:8], "%Y%m%d")

        for day in range(3, 11):
            min_key = f"taMin{day}"
            max_key = f"taMax{day}"
            if min_key in item and max_key in item:
                forecast_date = base_date + timedelta(days=day)
                min_temp = item[min_key]
                max_temp = item[max_key]
                if min_temp is not None and max_temp is not None:
                    forecasts.append({
                        "date": forecast_date.strftime("%Y-%m-%d"),
                        "min_temp": float(min_temp),
                        "max_temp": float(max_temp),
                        "avg_temp": round((float(min_temp) + float(max_temp)) / 2, 2),
                        "forecast_type": "mid_term"
                    })

        logger.info(f"Fetched {len(forecasts)} days of mid-term temperature forecast")
        return forecasts
    except requests.RequestException as e:
        logger.error(f"Failed to fetch mid-term temperature forecast: {e}")
        return []
    except Exception as e:
        logger.error(f"Error parsing mid-term temperature forecast: {e}")
        return []


def fetch_combined_forecast(lat: float, lon: float, service_key: str) -> List[Dict]:
    short_term = fetch_short_term_forecast(lat, lon, service_key, days=3)
    mid_term = fetch_mid_term_temperature_forecast(service_key)
    combined = short_term.copy()
    short_term_dates = {f["date"] for f in short_term}
    for forecast in mid_term:
        if forecast["date"] not in short_term_dates:
            combined.append(forecast)
    combined.sort(key=lambda x: x["date"])
    logger.info(f"Combined forecast: {len(combined)} days total")
    return combined


def update_forecast_in_db(db: Session, lat: Optional[float] = None, lon: Optional[float] = None) -> Dict:
    service_key_setting = db.query(models.Settings).filter(
        models.Settings.key == "holiday_api_service_key"
    ).first()
    if not service_key_setting or not service_key_setting.value:
        return {"success": False, "message": "Service key not configured"}

    service_key = service_key_setting.value
    if lat is None or lon is None:
        lat, lon = 37.5665, 126.9780

    forecasts = fetch_combined_forecast(lat, lon, service_key)
    if not forecasts:
        return {"success": False, "message": "No forecast data fetched"}

    inserted_count = 0
    updated_count = 0

    for forecast in forecasts:
        forecast_date = forecast["date"]
        existing = db.query(models.WeatherForecast).filter(
            models.WeatherForecast.forecast_date == forecast_date
        ).first()

        if existing:
            db.execute(
                update(models.WeatherForecast)
                .where(models.WeatherForecast.id == existing.id)
                .values(
                    avg_temp=forecast.get("avg_temp"), max_temp=forecast.get("max_temp"),
                    min_temp=forecast.get("min_temp"), precipitation=forecast.get("precipitation"),
                    humidity=forecast.get("humidity"), forecast_type=forecast.get("forecast_type"),
                    created_at=datetime.now()
                )
            )
            updated_count += 1
        else:
            db.add(models.WeatherForecast(
                forecast_date=forecast_date,
                avg_temp=forecast.get("avg_temp"), max_temp=forecast.get("max_temp"),
                min_temp=forecast.get("min_temp"), precipitation=forecast.get("precipitation"),
                humidity=forecast.get("humidity"), forecast_type=forecast.get("forecast_type")
            ))
            inserted_count += 1

    db.commit()
    logger.info(f"Forecast data updated: {inserted_count} inserted, {updated_count} updated")
    return {
        "success": True, "latitude": lat, "longitude": lon,
        "nx": lat_lon_to_grid(lat, lon)[0], "ny": lat_lon_to_grid(lat, lon)[1],
        "inserted": inserted_count, "updated": updated_count, "total": len(forecasts),
        "forecasts": forecasts
    }


# ���─────────────────────────────────────────────
# Weather-Based Prediction Adjustment
# ──────────────────────���───────────────────────

def calculate_weather_adjustment(avg_temp: float, total_precip: float, baseline_visitors: int) -> Dict:
    temp_diff = avg_temp - BASELINE_TEMP
    temp_adjustment = temp_diff * TEMP_ADJUSTMENT_FACTOR * TEMP_CORRELATION

    precip_diff = total_precip - BASELINE_PRECIP
    precip_adjustment = precip_diff * PRECIP_ADJUSTMENT_FACTOR * PRECIP_CORRELATION

    high_rain_adjustment = -HIGH_RAIN_PENALTY if total_precip > HIGH_RAIN_THRESHOLD else 0
    total_adjustment = max(-0.30, min(0.20, temp_adjustment + precip_adjustment + high_rain_adjustment))
    adjusted_value = int(baseline_visitors * (1 + total_adjustment))

    return {
        'baseline': baseline_visitors,
        'adjusted': adjusted_value,
        'adjustment_percent': round(total_adjustment * 100, 1),
        'factors': {
            'temperature': {
                'value': avg_temp,
                'diff_from_baseline': round(temp_diff, 1),
                'adjustment': round(temp_adjustment * 100, 2)
            },
            'precipitation': {
                'value': total_precip,
                'diff_from_baseline': round(precip_diff, 1),
                'adjustment': round(precip_adjustment * 100, 2),
                'high_rain_penalty': round(high_rain_adjustment * 100, 1) if high_rain_adjustment else 0
            }
        }
    }


def get_forecast_weather(db: Session, target_month: str) -> Optional[Dict]:
    month_num = int(target_month.split('-')[1])
    try:
        historical = db.query(models.WeatherData).filter(
            extract('month', models.WeatherData.date) == month_num
        ).all()
        if historical:
            temps = [float(r.avg_temp) for r in historical if r.avg_temp is not None]
            precips = [float(r.precipitation or 0) for r in historical]
            if temps:
                avg_temp = sum(temps) / len(temps)
                total_precip = sum(precips) / (len(historical) / 30)
                return {
                    'avg_temp': round(avg_temp, 1),
                    'total_precip': round(total_precip, 1),
                    'source': 'historical_average',
                    'data_points': len(historical)
                }
    except Exception as e:
        logger.warning(f"Failed to get weather data: {e}")
    return None


def apply_weather_to_predictions(db: Session, predictions: Dict, target_months: List[str]) -> tuple:
    weather_info = {}
    for month in target_months:
        weather = get_forecast_weather(db, month)
        if weather:
            weather_info[month] = weather

    if not weather_info:
        return predictions, None

    adjusted_predictions = {}
    adjustment_details = {}

    for category, month_data in predictions.items():
        adjusted_predictions[category] = {}
        for month, pred in month_data.items():
            if month in weather_info:
                weather = weather_info[month]
                baseline = pred.get('predicted', pred.get('value', 0))
                if baseline and baseline > 0:
                    adj_result = calculate_weather_adjustment(
                        weather['avg_temp'], weather['total_precip'], baseline
                    )
                    adjusted_predictions[category][month] = {
                        **pred,
                        'predicted': adj_result['adjusted'],
                        'weather_adjusted': True,
                        'original_predicted': baseline,
                        'adjustment_percent': adj_result['adjustment_percent']
                    }
                    if month not in adjustment_details:
                        adjustment_details[month] = {
                            'weather': weather, 'sample_adjustment': adj_result
                        }
                else:
                    adjusted_predictions[category][month] = pred
            else:
                adjusted_predictions[category][month] = pred

    return adjusted_predictions, {
        'applied': True,
        'months': list(weather_info.keys()),
        'details': adjustment_details
    }
