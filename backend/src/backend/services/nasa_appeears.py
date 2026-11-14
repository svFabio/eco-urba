import httpx
from backend.core.config import settings


class AppEEARSClient:
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.NASA_APPEEARS_API_URL
        self._token: str | None = None

    def login(
        self,
        username: str | None = None,
        password: str | None = None,
    ) -> str:
        """Authenticate with NASA Earthdata credentials and retrieve bearer token."""
        user = username or settings.NASA_EARTHDATA_USERNAME
        pwd = password or (
            settings.NASA_EARTHDATA_PASSWORD.get_secret_value()
            if hasattr(settings.NASA_EARTHDATA_PASSWORD, "get_secret_value")
            else str(settings.NASA_EARTHDATA_PASSWORD)
        )

        if not user or not pwd:
            raise ValueError(
                "NASA Earthdata credentials are required. Set NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD in .env."
            )

        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{self.base_url}/login",
                auth=(user, pwd),
            )
            response.raise_for_status()
            data = response.json()
            self._token = data.get("token")
            return self._token

    def _get_headers(self) -> dict[str, str]:
        if not self._token:
            self.login()
        return {"Authorization": f"Bearer {self._token}"}

    def get_product_layers(self, product_prefix: str = "HLSL30_VI") -> tuple[str, list[str]]:
        """Find the latest version of a product and return available layer names."""
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(f"{self.base_url}/product")
            resp.raise_for_status()
            products = resp.json()

            matches = [
                p["ProductAndVersion"]
                for p in products
                if p.get("ProductAndVersion", "").startswith(product_prefix)
            ]
            if not matches:
                raise RuntimeError(f"No product found matching prefix '{product_prefix}'")

            product = matches[-1]

            layers_resp = client.get(f"{self.base_url}/product/{product}")
            layers_resp.raise_for_status()
            layers = list(layers_resp.json().keys())
            return product, layers

    def submit_point_task(
        self,
        task_name: str,
        product: str,
        layer: str,
        coordinates: list[dict],
        start_date: str = "01-01-2024",
        end_date: str = "01-31-2024",
    ) -> dict:
        """Submit a point sample extraction task to AppEEARS."""
        headers = self._get_headers()
        payload = {
            "task_type": "point",
            "task_name": task_name,
            "params": {
                "dates": [{"startDate": start_date, "endDate": end_date}],
                "layers": [{"product": product, "layer": layer}],
                "coordinates": coordinates,
            },
        }

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                f"{self.base_url}/task",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    def get_task_status(self, task_id: str) -> dict:
        """Check status of a submitted extraction task."""
        headers = self._get_headers()
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(
                f"{self.base_url}/task/{task_id}",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()


appeears_client = AppEEARSClient()
