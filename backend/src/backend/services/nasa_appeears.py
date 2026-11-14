import logging
import httpx
from pydantic import JsonValue

from backend.core.config import settings

logger = logging.getLogger(__name__)


class AppEEARSError(Exception):
    """Base exception for AppEEARS API errors."""
    pass


class AppEEARSAuthError(AppEEARSError):
    """Authentication failure with NASA Earthdata Login."""
    pass


class ProductNotFoundError(AppEEARSError):
    """Requested product or layer not found."""
    pass


class AppEEARSClient:
    """Asynchronous client for NASA AppEEARS API."""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.NASA_APPEEARS_API_URL).rstrip("/")
        self._token: str | None = None

    def _get_credentials(
        self,
        username: str | None = None,
        password: str | None = None,
    ) -> tuple[str, str]:
        user = username or settings.NASA_EARTHDATA_USERNAME
        pwd = password or (
            settings.NASA_EARTHDATA_PASSWORD.get_secret_value()
            if hasattr(settings.NASA_EARTHDATA_PASSWORD, "get_secret_value")
            else str(settings.NASA_EARTHDATA_PASSWORD)
        )
        if not user or not pwd:
            raise AppEEARSAuthError(
                "NASA Earthdata credentials missing. Set NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD in .env."
            )
        return user, pwd

    async def login(
        self,
        username: str | None = None,
        password: str | None = None,
    ) -> str:
        """Authenticate with NASA Earthdata and obtain bearer token."""
        user, pwd = self._get_credentials(username, password)

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/login",
                    auth=(user, pwd),
                )
                if response.status_code in (401, 403):
                    raise AppEEARSAuthError(f"Invalid NASA credentials: {response.text}")
                response.raise_for_status()
                data = response.json()
                self._token = data.get("token")
                return self._token
            except httpx.HTTPError as exc:
                raise AppEEARSAuthError(f"Network error during login: {exc}") from exc

    async def _request_with_retry(
        self,
        method: str,
        path: str,
        **kwargs: JsonValue,
    ) -> httpx.Response:
        """Execute HTTP request with automatic token refresh on 401."""
        if not self._token:
            await self.login()

        url = f"{self.base_url}{path}"
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self._token}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401:
                logger.warning("AppEEARS token expired. Re-authenticating...")
                await self.login()
                headers["Authorization"] = f"Bearer {self._token}"
                resp = await client.request(method, url, headers=headers, **kwargs)

            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise AppEEARSError(f"AppEEARS HTTP {resp.status_code}: {resp.text}") from exc
            return resp

    async def get_product_layers(self, product_prefix: str = "HLSL30_VI") -> tuple[str, list[str]]:
        """Find the latest version of a product and return its available layer names."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                resp = await client.get(f"{self.base_url}/product")
                resp.raise_for_status()
                products = resp.json()
            except httpx.HTTPError as exc:
                raise AppEEARSError(f"Failed to fetch product catalog: {exc}") from exc

        matches = [
            p["ProductAndVersion"]
            for p in products
            if p.get("ProductAndVersion", "").startswith(product_prefix)
        ]
        if not matches:
            raise ProductNotFoundError(f"No product found matching prefix '{product_prefix}'")

        product = matches[-1]

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                layers_resp = await client.get(f"{self.base_url}/product/{product}")
                layers_resp.raise_for_status()
                layers = list(layers_resp.json().keys())
                return product, layers
            except httpx.HTTPError as exc:
                raise AppEEARSError(f"Failed to fetch layers for product {product}: {exc}") from exc

    async def submit_point_task(
        self,
        task_name: str,
        product: str,
        layer: str,
        coordinates: list[dict[str, JsonValue]],
        start_date: str = "01-01-2024",
        end_date: str = "01-31-2024",
    ) -> dict[str, JsonValue]:
        """Submit a point sample extraction task to AppEEARS."""
        payload: dict[str, JsonValue] = {
            "task_type": "point",
            "task_name": task_name,
            "params": {
                "dates": [{"startDate": start_date, "endDate": end_date}],
                "layers": [{"product": product, "layer": layer}],
                "coordinates": coordinates,  # type: ignore[dict-item]
            },
        }
        resp = await self._request_with_retry("POST", "/task", json=payload)  # type: ignore[arg-type]
        return resp.json()

    async def get_task_status(self, task_id: str) -> dict[str, JsonValue]:
        """Check status of a submitted extraction task."""
        resp = await self._request_with_retry("GET", f"/task/{task_id}")
        return resp.json()


appeears_client = AppEEARSClient()
