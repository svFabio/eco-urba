#!/usr/bin/env python3
"""Script to test AppEEARS NDVI point extraction for Cochabamba."""

import json
from backend.services.nasa_appeears import appeears_client


def main():
    print("1. Buscando producto HLSL30_VI y capa NDVI...")
    product, layers = appeears_client.get_product_layers("HLSL30_VI")
    print(f"   Producto: {product}")

    ndvi_layer = next((l for l in layers if l.upper() == "NDVI"), None)
    if not ndvi_layer:
        print("   Capas disponibles:", layers)
        raise RuntimeError("No se encontró la capa NDVI.")
    print(f"   Capa NDVI: {ndvi_layer}")

    print("\n2. Autenticando con NASA Earthdata (desde .env)...")
    token = appeears_client.login()
    print("   Autenticación exitosa. Token obtenido.")

    print("\n3. Enviando tarea de prueba (Cochabamba - CBBA_01)...")
    coordinates = [
        {"id": "CBBA_01", "latitude": -17.3895, "longitude": -66.1568}
    ]
    task = appeears_client.submit_point_task(
        task_name="PLANETERRA_NDVI_COCHABAMBA",
        product=product,
        layer=ndvi_layer,
        coordinates=coordinates,
        start_date="01-01-2024",
        end_date="01-31-2024",
    )

    task_id = task.get("task_id")
    print(f"   Tarea registrada con éxito! ID: {task_id}")

    print("\n4. Consultando estado inicial de la tarea...")
    status = appeears_client.get_task_status(task_id)
    print(f"   Estado actual: {status.get('status')}")
    print(f"   Detalles completos: {json.dumps(status, indent=2)}")


if __name__ == "__main__":
    main()
