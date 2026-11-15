"""
Script to extract and consolidate real, georeferenced Schools and Hospitals in Cochabamba (Cercado)
using OpenStreetMap / Nominatim datasets and official district boundary validation via Shapely.
"""
import json
import os
import time
import urllib.parse
import urllib.request
from shapely.geometry import Point, shape

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "src", "backend", "data")
DISTRICTS_PATH = os.path.join(DATA_DIR, "distritos_cercado_cochabamba.geojson")

def load_district_polygons():
    with open(DISTRICTS_PATH, "r", encoding="utf-8") as f:
        fc = json.load(f)
    polys = []
    for feat in fc["features"]:
        dist_id = int(feat["properties"]["distrito"])
        geom = shape(feat["geometry"])
        polys.append((dist_id, feat["properties"]["nombre"], geom))
    return polys

def fetch_nominatim(query: str, user_agent: str = "EcoUrbaCochabamba/1.0 (svfabio.andres@gmail.com)"):
    url = (
        f"https://nominatim.openstreetmap.org/search?"
        f"q={urllib.parse.quote(query)}&format=json&limit=50&viewbox=-66.25,-17.30,-66.08,-17.52&bounded=1"
    )
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        print(f"Error querying '{query}': {e}")
        return []

def clean_name(raw_name: str) -> str:
    # Remove leading/trailing quotes and extra comma-separated address parts if display_name
    parts = raw_name.split(",")
    main = parts[0].strip()
    return main

def main():
    district_polys = load_district_polygons()
    print(f"Loaded {len(district_polys)} municipal districts of Cercado.")

    # 1. SCHOOLS
    school_queries = [
        "Unidad Educativa Cochabamba",
        "Colegio Cochabamba",
        "Escuela Cochabamba",
        "U.E. Cochabamba",
        "Colegio Cercado Cochabamba",
        "Unidad Educativa Cercado Cochabamba",
        "Colegio Adela Zamudio Cochabamba",
        "Unidad Educativa Adela Zamudio Cochabamba",
        "Escuela Adela Zamudio Cochabamba",
        "Colegio Tunari Cochabamba",
        "Unidad Educativa Tunari Cochabamba",
        "Colegio Molle Cochabamba",
        "Unidad Educativa Molle Cochabamba",
        "Colegio Alejo Calatayud Cochabamba",
        "Unidad Educativa Alejo Calatayud Cochabamba",
        "Colegio Valle Hermoso Cochabamba",
        "Unidad Educativa Valle Hermoso Cochabamba",
        "Colegio Itocta Cochabamba",
        "Unidad Educativa Itocta Cochabamba",
        "Colegio Sebastian Pagador Cochabamba",
        "Unidad Educativa Sebastian Pagador Cochabamba",
        "Colegio Kara Kara Cochabamba",
        "Unidad Educativa K'ara K'ara Cochabamba",
        "Unidad Educativa Pucara Cochabamba",
        "Colegio Ushpa Ushpa Cochabamba",
        "Colegio Alto Cochabamba",
        "Colegio Tamborada Cochabamba",
        "Unidad Educativa Tamborada Cochabamba",
    ]

    schools = {}
    for q in school_queries:
        items = fetch_nominatim(q)
        for it in items:
            osm_id = it.get("osm_id")
            if not osm_id or osm_id in schools:
                continue
            lat = float(it["lat"])
            lon = float(it["lon"])
            pt = Point(lon, lat)
            for d_id, d_name, geom in district_polys:
                if geom.contains(pt):
                    name = clean_name(it.get("name") or it.get("display_name"))
                    schools[osm_id] = {
                        "id": f"school-osm-{osm_id}",
                        "name": name,
                        "type": "school",
                        "lat": round(lat, 5),
                        "lng": round(lon, 5),
                        "district_id": d_id,
                        "sub_type": "Unidad Educativa",
                        "description": f"Unidad Educativa en {d_name} (Cercado)",
                    }
                    break
        time.sleep(1.0)
        print(f"Schools after '{q}': {len(schools)}")

    schools_list = sorted(list(schools.values()), key=lambda x: (x["district_id"], x["name"]))
    schools_output = os.path.join(DATA_DIR, "schools_cercado.json")
    with open(schools_output, "w", encoding="utf-8") as f:
        json.dump(schools_list, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(schools_list)} real schools to {schools_output}")

    # 2. HOSPITALS & HEALTH CENTERS
    hosp_queries = [
        "Hospital Cochabamba",
        "Centro de Salud Cochabamba",
        "Clinica Cochabamba",
        "Posta de Salud Cochabamba",
        "Hospital Cercado Cochabamba",
        "Centro de Salud Cercado Cochabamba",
        "Centro de Salud Adela Zamudio Cochabamba",
        "Centro de Salud Tunari Cochabamba",
        "Centro de Salud Molle Cochabamba",
        "Centro de Salud Alejo Calatayud Cochabamba",
        "Centro de Salud Valle Hermoso Cochabamba",
        "Centro de Salud Itocta Cochabamba",
    ]

    hospitals = {}
    for q in hosp_queries:
        items = fetch_nominatim(q)
        for it in items:
            osm_id = it.get("osm_id")
            if not osm_id or osm_id in hospitals:
                continue
            lat = float(it["lat"])
            lon = float(it["lon"])
            pt = Point(lon, lat)
            for d_id, d_name, geom in district_polys:
                if geom.contains(pt):
                    name = clean_name(it.get("name") or it.get("display_name"))
                    hospitals[osm_id] = {
                        "id": f"hospital-osm-{osm_id}",
                        "name": name,
                        "type": "hospital",
                        "lat": round(lat, 5),
                        "lng": round(lon, 5),
                        "district_id": d_id,
                        "sub_type": "Centro de Salud / Hospital",
                        "description": f"Establecimiento de salud en {d_name} (Cercado)",
                    }
                    break
        time.sleep(1.0)
        print(f"Hospitals after '{q}': {len(hospitals)}")

    hospitals_list = sorted(list(hospitals.values()), key=lambda x: (x["district_id"], x["name"]))
    hospitals_output = os.path.join(DATA_DIR, "hospitals_cercado.json")
    with open(hospitals_output, "w", encoding="utf-8") as f:
        json.dump(hospitals_list, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(hospitals_list)} real hospitals to {hospitals_output}")

if __name__ == "__main__":
    main()
