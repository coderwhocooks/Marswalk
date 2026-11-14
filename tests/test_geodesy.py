import math
import pytest
from backend.core.geodesy import (
    MarsGeodesy,
    MARS_RADIUS_M,
    lonlat_to_xy,
    xy_to_lonlat,
    mars_haversine_distance,
)

def test_mars_radius():
    assert MARS_RADIUS_M == 3396190.0

def test_lonlat_to_xy_equator_prime_meridian():
    x, y = lonlat_to_xy(0.0, 0.0)
    assert x == pytest.approx(0.0, abs=1e-5)
    assert y == pytest.approx(0.0, abs=1e-5)

def test_roundtrip_coordinate_conversion():
    test_cases = [
        (77.4508, 18.4447),  # Octavia E. Butler Landing Site
        (77.3820, 18.4112),  # Kodiak Butte
        (77.4042, 18.4725),  # Belva Crater
        (0.0, 0.0),
        (-45.0, 30.0),
    ]
    for lon, lat in test_cases:
        x, y = lonlat_to_xy(lon, lat)
        lon_back, lat_back = xy_to_lonlat(x, y)
        assert lon_back == pytest.approx(lon, abs=1e-6)
        assert lat_back == pytest.approx(lat, abs=1e-6)

def test_mars_haversine_distance():
    # 1 degree of latitude on Mars sphere is R * pi / 180
    expected_1deg_lat = MARS_RADIUS_M * (math.pi / 180.0)
    dist = mars_haversine_distance(0.0, 0.0, 0.0, 1.0)
    assert dist == pytest.approx(expected_1deg_lat, rel=1e-5)
    assert dist == pytest.approx(59274.697, abs=0.1)

def test_pixel_to_lonlat_roundtrip():
    geodesy = MarsGeodesy(
        x0=4573663.250853,
        y0=1109693.140188,
        pixel_size=20.0,
        width=1596,
        height=1512
    )
    col, row = 500, 400
    lon, lat = geodesy.pixel_to_lonlat(col, row)
    col_back, row_back = geodesy.lonlat_to_pixel(lon, lat)
    assert col_back == pytest.approx(col, abs=1e-4)
    assert row_back == pytest.approx(row, abs=1e-4)
