"""
Mars Geodetic Reference System & Projections.
Compliant with IAU 2000 Mars Sphere standards and USGS Mars 2020 cartographic specifications.
"""
import math
from typing import Tuple

# Mars 2000 Mean Sphere Equatorial Radius in meters
# Specified by IAU/IAG Working Group on Cartographic Coordinates and Rotational Elements
MARS_RADIUS_M = 3396190.0

def lonlat_to_xy(lon_deg: float, lat_deg: float, r: float = MARS_RADIUS_M) -> Tuple[float, float]:
    """
    Transform planetocentric longitude and latitude (degrees) to Equirectangular
    projected coordinates (meters), with standard parallel at 0 degrees.
    """
    x = r * math.radians(lon_deg)
    y = r * math.radians(lat_deg)
    return x, y

def xy_to_lonlat(x: float, y: float, r: float = MARS_RADIUS_M) -> Tuple[float, float]:
    """
    Transform Equirectangular projected coordinates (meters) to planetocentric
    longitude and latitude (degrees).
    """
    lon_deg = math.degrees(x / r)
    lat_deg = math.degrees(y / r)
    return lon_deg, lat_deg

def mars_haversine_distance(
    lon1_deg: float,
    lat1_deg: float,
    lon2_deg: float,
    lat2_deg: float,
    r: float = MARS_RADIUS_M
) -> float:
    """
    Calculate great-circle distance (meters) between two points on the Martian sphere.
    """
    phi1 = math.radians(lat1_deg)
    phi2 = math.radians(lat2_deg)
    delta_phi = math.radians(lat2_deg - lat1_deg)
    delta_lambda = math.radians(lon2_deg - lon1_deg)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c

class MarsGeodesy:
    """
    Handles affine transformations between raster pixel coordinates (col, row)
    and Martian spatial reference frames (projected meters and Lon/Lat).
    """
    def __init__(
        self,
        x0: float,
        y0: float,
        pixel_size: float,
        width: int,
        height: int,
        radius: float = MARS_RADIUS_M
    ):
        self.x0 = float(x0)
        self.y0 = float(y0)
        self.pixel_size = float(pixel_size)
        self.width = int(width)
        self.height = int(height)
        self.radius = float(radius)

        # Precompute bounding box in projected meters
        self.x_min = self.x0
        self.x_max = self.x0 + self.width * self.pixel_size
        self.y_max = self.y0
        self.y_min = self.y0 - self.height * self.pixel_size

        # Precompute bounding box in degrees
        self.lon_min, self.lat_min = xy_to_lonlat(self.x_min, self.y_min, self.radius)
        self.lon_max, self.lat_max = xy_to_lonlat(self.x_max, self.y_max, self.radius)

    def pixel_to_xy(self, col: float, row: float) -> Tuple[float, float]:
        """Convert raster col, row to projected meters (x, y)."""
        x = self.x0 + col * self.pixel_size
        y = self.y0 - row * self.pixel_size
        return x, y

    def xy_to_pixel(self, x: float, y: float) -> Tuple[float, float]:
        """Convert projected meters (x, y) to raster col, row."""
        col = (x - self.x0) / self.pixel_size
        row = (self.y0 - y) / self.pixel_size
        return col, row

    def pixel_to_lonlat(self, col: float, row: float) -> Tuple[float, float]:
        """Convert raster col, row to longitude and latitude degrees."""
        x, y = self.pixel_to_xy(col, row)
        return xy_to_lonlat(x, y, self.radius)

    def lonlat_to_pixel(self, lon_deg: float, lat_deg: float) -> Tuple[float, float]:
        """Convert longitude and latitude degrees to raster col, row."""
        x, y = lonlat_to_xy(lon_deg, lat_deg, self.radius)
        return self.xy_to_pixel(x, y)

    def contains_lonlat(self, lon_deg: float, lat_deg: float) -> bool:
        """Check if coordinates fall inside the raster bounds."""
        return (self.lon_min <= lon_deg <= self.lon_max and
                self.lat_min <= lat_deg <= self.lat_max)
