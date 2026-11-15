"""
Unit tests for NASA API integration client.
"""
import pytest
from backend.core.nasa_client import NasaApiClient

def test_nasa_client_initialization():
    client = NasaApiClient()
    assert client.api_key == "kqFjP8wdHQcMfWgCGfHGFNWwRBPBPN6BwwcBNdRP"

def test_nasa_insight_weather_structure():
    client = NasaApiClient()
    weather = client.get_insight_weather()
    assert weather is not None
    assert "sol_keys" in weather
    assert "latest_sol" in weather
    assert "air_temp" in weather
    assert "pressure" in weather
    assert "wind_speed" in weather
    assert weather["data_source"] == "NASA InSight Mars Weather Service"

def test_nasa_mission_media():
    client = NasaApiClient()
    media = client.search_mission_media(query="jezero crater", limit=5)
    assert isinstance(media, list)
    assert len(media) > 0
    item = media[0]
    assert "title" in item
    assert "nasa_id" in item
    assert "image_url" in item

def test_nasa_ephemeris():
    client = NasaApiClient()
    eph = client.get_mars_ephemeris()
    assert eph is not None
    assert "mars_sun_distance_au" in eph
    assert "mars_earth_distance_au" in eph
    assert "sub_solar_lon" in eph
