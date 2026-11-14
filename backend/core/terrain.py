"""
Marswalk Terrain Intelligence Engine.
Processes Digital Elevation Models (DEMs), computes metric slope gradients,
surface roughness, traversability masks, and handles NoData uncertainty.
"""
from typing import Optional, Tuple
import numpy as np
import scipy.ndimage
import tifffile
from backend.core.geodesy import MarsGeodesy, MARS_RADIUS_M

class TerrainModel:
    """
    Planetary digital elevation model with derived terrain intelligence metrics.
    """
    def __init__(
        self,
        elevation: np.ndarray,
        pixel_size: float,
        x0: float,
        y0: float,
        nodata_threshold: float = -10000.0,
        radius: float = MARS_RADIUS_M
    ):
        self.elevation = np.asarray(elevation, dtype=np.float32)
        self.height, self.width = self.elevation.shape
        self.pixel_size = float(pixel_size)
        self.x0 = float(x0)
        self.y0 = float(y0)
        self.nodata_threshold = float(nodata_threshold)
        self.radius = float(radius)

        self.geodesy = MarsGeodesy(
            x0=self.x0,
            y0=self.y0,
            pixel_size=self.pixel_size,
            width=self.width,
            height=self.height,
            radius=self.radius
        )

        # Detect NoData and NaN cells
        self.nodata_mask = (self.elevation <= self.nodata_threshold) | np.isnan(self.elevation)

        # Compute terrain derivatives lazily or on init
        self._slope_deg: Optional[np.ndarray] = None
        self._roughness: Optional[np.ndarray] = None

    @classmethod
    def from_geotiff(cls, filepath: str, nodata_threshold: float = -10000.0) -> "TerrainModel":
        """
        Load a Martian GeoTIFF elevation raster and parse its cartographic tags.
        """
        with tifffile.TiffFile(filepath) as tif:
            page = tif.pages[0]
            arr = page.asarray()

            # Extract pixel scale and tiepoint
            pixel_scale = page.tags.get("ModelPixelScaleTag")
            tiepoint = page.tags.get("ModelTiepointTag")

            if pixel_scale is not None:
                ps = float(pixel_scale.value[0])
            else:
                ps = 20.0

            if tiepoint is not None:
                # tiepoint is (I, J, K, X, Y, Z)
                x0 = float(tiepoint.value[3])
                y0 = float(tiepoint.value[4])
            else:
                x0 = 0.0
                y0 = 0.0

            return cls(
                elevation=arr,
                pixel_size=ps,
                x0=x0,
                y0=y0,
                nodata_threshold=nodata_threshold
            )

    @property
    def slope_deg(self) -> np.ndarray:
        """
        Calculate terrain slope angle in degrees using 2D finite difference gradients.
        Horn's method / 2nd-order central differences:
        grad_y = dZ / dy
        grad_x = dZ / dx
        slope = arctan(sqrt(grad_x^2 + grad_y^2)) * (180 / pi)
        """
        if self._slope_deg is None:
            # Mask out nodata by filling with nearest valid for gradient calculation
            filled = np.copy(self.elevation)
            if np.any(self.nodata_mask):
                valid_median = float(np.nanmedian(filled[~self.nodata_mask])) if np.any(~self.nodata_mask) else 0.0
                filled[self.nodata_mask] = valid_median

            # np.gradient computes differences: row axis is y (downwards), col axis is x (rightwards)
            # Row index increases downwards (South), col index increases rightwards (East)
            gy, gx = np.gradient(filled, self.pixel_size, self.pixel_size)
            hypot = np.hypot(gx, gy)
            slope = np.degrees(np.arctan(hypot))

            # Re-apply nodata: slope in nodata cells is set to high hazard / NaN
            slope[self.nodata_mask] = 90.0
            self._slope_deg = slope.astype(np.float32)

        return self._slope_deg

    @property
    def roughness(self) -> np.ndarray:
        """
        Calculate surface roughness as the local standard deviation of elevation in a 3x3 window.
        Uses fast O(N) uniform filtering: Var = E[X^2] - (E[X])^2.
        """
        if self._roughness is None:
            filled = np.copy(self.elevation)
            if np.any(self.nodata_mask):
                valid_mean = float(np.nanmean(filled[~self.nodata_mask])) if np.any(~self.nodata_mask) else 0.0
                filled[self.nodata_mask] = valid_mean

            mean_val = scipy.ndimage.uniform_filter(filled, size=3, mode='reflect')
            sq_mean = scipy.ndimage.uniform_filter(filled**2, size=3, mode='reflect')
            var = np.maximum(sq_mean - mean_val**2, 0.0)
            std = np.sqrt(var)
            std[self.nodata_mask] = 999.0 # High penalty for nodata
            self._roughness = std.astype(np.float32)

        return self._roughness

    def is_traversable(self, row: int, col: int, max_slope_deg: float = 20.0) -> bool:
        """
        Check if a given raster cell satisfies hard traversability constraints.
        """
        if row < 0 or row >= self.height or col < 0 or col >= self.width:
            return False
        if self.nodata_mask[row, col]:
            return False
        if self.slope_deg[row, col] > max_slope_deg:
            return False
        return True

    def get_elevation_at_lonlat(self, lon_deg: float, lat_deg: float) -> Optional[float]:
        """Query elevation (meters relative to MOLA geoid) at given coordinates."""
        col, row = self.geodesy.lonlat_to_pixel(lon_deg, lat_deg)
        r = int(round(row))
        c = int(round(col))
        if 0 <= r < self.height and 0 <= c < self.width:
            if self.nodata_mask[r, c]:
                return None
            return float(self.elevation[r, c])
        return None

    def get_slope_at_lonlat(self, lon_deg: float, lat_deg: float) -> Optional[float]:
        """Query terrain slope angle (degrees) at given coordinates."""
        col, row = self.geodesy.lonlat_to_pixel(lon_deg, lat_deg)
        r = int(round(row))
        c = int(round(col))
        if 0 <= r < self.height and 0 <= c < self.width:
            if self.nodata_mask[r, c]:
                return None
            return float(self.slope_deg[r, c])
        return None

    def downsample(self, factor: int) -> "TerrainModel":
        """
        Create a downsampled TerrainModel by averaging blocks of size (factor x factor).
        Useful for accelerated path planning over large geographic expanses.
        """
        if factor <= 1:
            return self

        new_h = self.height // factor
        new_w = self.width // factor

        cropped = self.elevation[:new_h * factor, :new_w * factor]
        reshaped = cropped.reshape(new_h, factor, new_w, factor)
        downsampled_elev = reshaped.mean(axis=(1, 3)).astype(np.float32)

        new_pixel_size = self.pixel_size * factor

        return TerrainModel(
            elevation=downsampled_elev,
            pixel_size=new_pixel_size,
            x0=self.x0,
            y0=self.y0,
            nodata_threshold=self.nodata_threshold,
            radius=self.radius
        )
